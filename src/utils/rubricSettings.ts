import type { ExamRubric, RubricItem } from "../types";

export type NormalizedRubricType = "multiple_choice" | "true_false" | "short_answer" | "essay";

export function rubricType(item: RubricItem): NormalizedRubricType {
  if (item.questionType === "essay") return "essay";
  if (item.questionType === "fill_in" || item.questionType === "short_answer") return "short_answer";
  if (item.questionType === "true_false") return "true_false";
  if (item.questionType === "multiple_choice") return "multiple_choice";
  const part = Number(item.part);
  if (part === 2) return "true_false";
  if (part === 3) return "short_answer";
  return "multiple_choice";
}

function parseTrueFalseAnswer(value: string): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  const text = String(value || "").trim();
  if (/^[ĐDSSTFđsstf]{4}$/i.test(text)) {
    [...text].slice(0, 4).forEach((ch, i) => {
      out[["a", "b", "c", "d"][i]] = /[ĐDT]/i.test(ch);
    });
    return out;
  }
  const rx = /([a-d])\s*\)?\s*[:=.)-]?\s*(Đúng|Sai|True|False|Đ|S|T|F)(?=\s|[|,;]|$)/gi;
  for (const m of text.matchAll(rx)) {
    out[m[1].toLowerCase()] = /^(Đúng|Đ|True|T)$/i.test(m[2]);
  }
  return out;
}

export function trueFalsePoints(correctSubCount: number, item: RubricItem): number {
  const max = Number(item.points);
  if (!Number.isFinite(max) || max <= 0) return 0;
  const count = Math.max(0, Math.min(4, Math.trunc(correctSubCount)));
  switch (item.trueFalseScoring || "tiered") {
    case "linear":
      return Math.round((max * count / 4) * 100) / 100;
    case "all_or_nothing":
      return count === 4 ? max : 0;
    case "tiered":
    default: {
      const ratio = [0, 0.1, 0.25, 0.5, 1][count] || 0;
      return Math.round((max * ratio) * 100) / 100;
    }
  }
}

export function validateRubricSettings(rubric: ExamRubric | null | undefined): string[] {
  const errors: string[] = [];
  if (!rubric) return ["Chưa có biểu điểm để chấm."];
  const maxScore = Number(rubric.maxScore);
  if (!Number.isFinite(maxScore) || maxScore <= 0) errors.push("Thang điểm phải lớn hơn 0.");
  if (!Array.isArray(rubric.items) || rubric.items.length === 0) {
    errors.push("Biểu điểm chưa có câu hỏi nào.");
    return errors;
  }

  const seen = new Set<string>();
  rubric.items.forEach((item, index) => {
    const type = rubricType(item);
    const label = `Câu ${item.printedNumber ?? item.questionIndex ?? index + 1}`;
    const printedNumber = Number(item.printedNumber ?? item.questionIndex);
    if (!Number.isInteger(printedNumber) || printedNumber < 1) {
      errors.push(`${label}: số câu in trên phiếu phải là số nguyên dương.`);
    } else {
      const key = `${type}:${printedNumber}`;
      if (seen.has(key)) errors.push(`${label}: bị trùng số câu trong cùng dạng.`);
      seen.add(key);
    }

    const points = Number(item.points);
    if (!Number.isFinite(points) || points <= 0) errors.push(`${label}: chưa thiết lập điểm tối đa hợp lệ.`);

    const answer = String(item.correctAnswer || "").trim();
    if (type === "multiple_choice") {
      if (!/^[A-D](?:\b|[\s:.)-])/i.test(answer) && !/^[A-D]$/i.test(answer)) {
        errors.push(`${label}: phải chọn đáp án giáo viên A, B, C hoặc D.`);
      }
    } else if (type === "true_false") {
      const fromStatements = Array.isArray(item.statements) && item.statements.length >= 4 && item.statements.slice(0, 4).every((s: any) => typeof s?.correctValue === "boolean");
      const parsed = parseTrueFalseAnswer(answer);
      if (!fromStatements && Object.keys(parsed).length !== 4) {
        errors.push(`${label}: đáp án Đúng/Sai phải đủ 4 ý a, b, c, d.`);
      }
    } else if (type === "short_answer") {
      if (!answer) errors.push(`${label}: chưa nhập đáp án trả lời ngắn.`);
    } else if (type === "essay") {
      if (!answer && !String(item.criteria || "").trim()) errors.push(`${label}: cần có đáp án hoặc barem tự luận.`);
    }
  });

  const total = rubric.items.reduce((sum, item) => sum + (Number(item.points) || 0), 0);
  if (Number.isFinite(maxScore) && maxScore > 0 && Math.abs(total - maxScore) > 0.01) {
    errors.push(`Tổng điểm từng câu hiện là ${Number(total.toFixed(2))}, chưa khớp thang điểm ${maxScore}.`);
  }
  return errors;
}
