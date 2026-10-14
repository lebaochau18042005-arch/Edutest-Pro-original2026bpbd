import type { ExamPackage, Question, StudentSubmission } from "../types";

type BackupPayload = {
  version: 1;
  exportedAt: string;
  questions: Question[];
  exams: ExamPackage[];
  submissions: StudentSubmission[];
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportAppDataBackupFile(
  questions: Question[],
  exams: ExamPackage[],
  submissions: StudentSubmission[]
) {
  const payload: BackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    questions: questions || [],
    exams: exams || [],
    submissions: submissions || [],
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  downloadBlob(blob, `EduTestPro_Backup_${new Date().toISOString().slice(0, 10)}.edutest`);
}

export async function importAppDataBackupFile(file: File): Promise<BackupPayload> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.questions) || !Array.isArray(parsed.exams) || !Array.isArray(parsed.submissions)) {
    throw new Error("File sao lưu EduTest Pro không hợp lệ.");
  }
  return {
    version: 1,
    exportedAt: String(parsed.exportedAt || new Date().toISOString()),
    questions: parsed.questions,
    exams: parsed.exams,
    submissions: parsed.submissions,
  };
}
