import { Question, ExamPackage, StudentSubmission, ExamConfig } from "../types";

export interface FullAppDataBackup {
  version: string;
  timestamp: string;
  questionBank: Question[];
  activeExams: ExamPackage[];
  submissions: StudentSubmission[];
  appSettings?: {
    apiKeySet: boolean;
    lastSync?: string;
  };
}

/**
 * Exports all local application data into a formatted JSON .edutest backup file
 */
export function exportAppDataBackupFile(
  questionBank: Question[],
  activeExams: ExamPackage[],
  submissions: StudentSubmission[]
) {
  const backupData: FullAppDataBackup = {
    version: "2026.5.0",
    timestamp: new Date().toISOString(),
    questionBank,
    activeExams,
    submissions,
    appSettings: {
      apiKeySet: true,
      lastSync: new Date().toLocaleString("vi-VN"),
    },
  };

  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);

  const link = document.createElement("a");
  link.href = url;
  link.download = `EDUTEST_PRO_BACKUP_${dateStr}.edutest`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Imports and parses a .edutest JSON backup file
 */
export function importAppDataBackupFile(
  file: File
): Promise<FullAppDataBackup> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text) as FullAppDataBackup;

        if (!parsed || !Array.isArray(parsed.questionBank)) {
          throw new Error("Định dạng tập tin sao lưu .edutest không hợp lệ!");
        }

        resolve(parsed);
      } catch (err: any) {
        reject(err.message || "Không thể đọc dữ liệu sao lưu!");
      }
    };
    reader.onerror = () => reject("Lỗi khi đọc tập tin!");
    reader.readAsText(file);
  });
}

/**
 * Calculates Student Anti-Cheat Trust Score Index (0..100%)
 */
export function calculateTrustScore(submission: StudentSubmission): {
  trustScore: number; // 0..100
  riskLevel: "safe" | "warning" | "high_risk";
  trustLabel: string;
  violationsCount: number;
} {
  let score = 100;
  const violations = submission.tabSwitchCount || (submission as any).tabViolations || 0;
  const logs = submission.violationLogs || (submission as any).antiCheatLog || [];

  // Tab switching penalty (-15 points per violation)
  score -= violations * 15;

  // Detailed log checks
  logs.forEach((item: any) => {
    if (item.type === "paste" || item.action === "paste") score -= 10;
    if (item.type === "devtools" || item.action === "devtools") score -= 25;
    if (item.type === "focus_lost" || item.action === "tab_switch") score -= 5;
  });

  // Clamp 0..100
  const finalScore = Math.max(0, Math.min(100, score));

  let riskLevel: "safe" | "warning" | "high_risk" = "safe";
  let trustLabel = "Độ tin cậy cao (An toàn)";

  if (finalScore < 60) {
    riskLevel = "high_risk";
    trustLabel = "Nghi vấn gian lận cao";
  } else if (finalScore < 85) {
    riskLevel = "warning";
    trustLabel = "Cần kiểm tra lại (Có bất thường)";
  }

  return {
    trustScore: finalScore,
    riskLevel,
    trustLabel,
    violationsCount: violations + logs.length,
  };
}
