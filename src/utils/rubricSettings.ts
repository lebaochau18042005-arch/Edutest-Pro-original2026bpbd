import type { ExamRubric, RubricItem } from "../types";

export function rubricType(item: RubricItem): string {
  if (item.questionType === "fill_in") return "short_answer";
  if (item.questionType) return item.questionType;
  return item.part === 2 || item.part === "part2" ? "true_false" : item.part === 3 || item.part === "part3" ? "short_answer" : "multiple_choice";
}

export function trueFalsePoints(count: number, item: RubricItem): number {
  const mode = item.trueFalseScoring || "tiered";
  const fraction = mode === "linear" ? count / 4 : mode === "all_or_nothing" ? Number(count === 4) : [0, .1, .25, .5, 1][count];
  return Math.round(fraction * item.points * 100) / 100;
}

export function validateRubricSettings(rubric: ExamRubric): string[] {
  const errors: string[] = [];
  if (!rubric.title.trim()) errors.push("Nhập tên bài kiểm tra.");
  if (!rubric.items.length) errors.push("Thêm ít nhất một câu hỏi.");
  if (!Number.isFinite(rubric.maxScore) || rubric.maxScore <= 0) errors.push("Thang điểm phải lớn hơn 0.");
  if (rubric.gradeWeight !== undefined && (!Number.isFinite(rubric.gradeWeight) || rubric.gradeWeight <= 0)) errors.push("Hệ số tổng hợp phải lớn hơn 0.");
  const seen = new Set<string>();
  const totals: Record<string, number> = {};
  for (const item of rubric.items) {
    const type = rubricType(item);
    const number = item.printedNumber ?? (totals[type] || 0) + 1;
    totals[type] = (totals[type] || 0) + 1;
    const key = `${type}:${number}`;
    if (!Number.isInteger(number) || number < 1 || seen.has(key)) errors.push(`Số câu ${number} trong cùng dạng bị trùng hoặc không hợp lệ.`);
    seen.add(key);
    if (!Number.isFinite(item.points) || item.points <= 0) errors.push(`Câu ${number}: điểm phải lớn hơn 0.`);
    const answer = item.correctAnswer.trim();
    if (!answer) errors.push(`Câu ${number}: chưa có đáp án.`);
    if (type === "multiple_choice" && !/^[A-D](?:$|\s|[.:)])/i.test(answer)) errors.push(`Câu ${number}: chọn đáp án A, B, C hoặc D.`);
    if (type === "true_false") {
      const compact = answer.toUpperCase().replace(/D/g, "Đ");
      const labels = [...answer.matchAll(/([a-d])\s*\)?\s*[:=.)-]\s*(Đúng|Sai|True|False|Đ|S)(?=\s|[|,;]|$)/gi)].map(m => m[1].toLowerCase());
      if (!/^[ĐS]{4}$/.test(compact) && new Set(labels).size !== 4) errors.push(`Câu ${number}: đáp án đúng/sai phải đủ bốn ý, ví dụ ĐSĐS.`);
      if (item.trueFalseScoring && !["tiered", "linear", "all_or_nothing"].includes(item.trueFalseScoring)) errors.push(`Câu ${number}: cách chấm đúng/sai không hợp lệ.`);
    }
  }
  const total = rubric.items.reduce((sum, item) => sum + item.points, 0);
  if (Math.abs(total - rubric.maxScore) > .005) errors.push(`Tổng điểm các câu (${Number(total.toFixed(2))}) chưa bằng thang điểm (${rubric.maxScore}).`);
  return errors;
}
