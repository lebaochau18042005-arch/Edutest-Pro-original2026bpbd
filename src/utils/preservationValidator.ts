import { Question } from "../types";
import { hasSourcePackage } from "./sourcePackageStore";

export interface PreservationValidationIssue {
  questionId: string;
  severity: "warning" | "error";
  message: string;
}

export interface PreservationValidationReport {
  ok: boolean;
  blockingIssues: PreservationValidationIssue[];
  warnings: PreservationValidationIssue[];
  checkedQuestions: number;
}

const UNRESOLVED_TOKEN_RE = /__(?:FORMULA|IMG)_TOKEN_\d+__/;

function questionTextSnapshot(q: Question): string {
  return [
    q.content,
    ...(q.options || []),
    ...(q.statements || []).map((s) => s.text),
    ...(q.statements || []).map((s) => s.explanation || ""),
    q.shortAnswer || "",
    q.explanation || "",
    q.passageContent || "",
  ].join("\n");
}

export async function validateQuestionsWithSourceStore(
  questions: Array<Question | any>
): Promise<PreservationValidationReport> {
  const blockingIssues: PreservationValidationIssue[] = [];
  const warnings: PreservationValidationIssue[] = [];

  for (const q of questions) {
    const snapshot = questionTextSnapshot(q);
    if (UNRESOLVED_TOKEN_RE.test(snapshot)) {
      blockingIssues.push({
        questionId: q.id || q.originalId || "unknown",
        severity: "error",
        message: "Còn token công thức/hình chưa được khôi phục.",
      });
    }

    if (q.preservation?.status === "FAIL") {
      blockingIssues.push({
        questionId: q.id || q.originalId || "unknown",
        severity: "error",
        message: "Câu hỏi có trạng thái bảo toàn FAIL.",
      });
    }

    const hasLegacyMathType = Boolean(
      q.formulaAssets?.some((f) => f.type === "mathtype") ||
      q.preservation?.warnings?.some((w) => /OLE|MathType/i.test(w))
    );

    if (hasLegacyMathType) {
      const sourceId = q.originalSource?.fileId;
      if (!sourceId) {
        blockingIssues.push({
          questionId: q.id || q.originalId || "unknown",
          severity: "error",
          message: "Có MathType/OLE nhưng câu hỏi không còn sourcePackageId của DOCX gốc.",
        });
      } else if (!(await hasSourcePackage(sourceId))) {
        blockingIssues.push({
          questionId: q.id || q.originalId || "unknown",
          severity: "error",
          message: "Có MathType/OLE nhưng file DOCX nguồn không còn trong IndexedDB của trình duyệt này.",
        });
      }
    }

    if (q.originalSource?.fileType === "docx" && q.originalSource?.sourcePreserved && !q.originalSource?.ooxmlQuestionIndex) {
      warnings.push({
        questionId: q.id || q.originalId || "unknown",
        severity: "warning",
        message: "DOCX nguồn đã lưu nhưng chưa có chỉ mục câu OOXML; không thể dùng xuất Word OOXML bảo toàn Phase 4.",
      });
    }

    if (q.preservation?.status === "NEEDS_REVIEW" || q.needsReview) {
      warnings.push({
        questionId: q.id || q.originalId || "unknown",
        severity: "warning",
        message: "Câu hỏi vẫn cần giáo viên kiểm duyệt trước khi xuất bản.",
      });
    }
  }

  return {
    ok: blockingIssues.length === 0,
    blockingIssues,
    warnings,
    checkedQuestions: questions.length,
  };
}
