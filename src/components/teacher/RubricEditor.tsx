import React, { useEffect, useState } from "react";
import type { ExamRubric, RubricItem } from "../../types";
import { rubricType, validateRubricSettings } from "../../utils/rubricSettings";

const types = { multiple_choice: "Chọn A/B/C/D", true_false: "Đúng / Sai", short_answer: "Trả lời ngắn", essay: "Tự luận" };
const field = "border border-slate-300 rounded-lg p-2 w-full bg-white text-sm";
function editable(rubric: ExamRubric): ExamRubric {
  const counts: Record<string, number> = {};
  return { ...rubric, items: rubric.items.map(item => {
    const type = rubricType(item);
    counts[type] = (counts[type] || 0) + 1;
    return { ...item, questionType: type as RubricItem["questionType"], printedNumber: item.printedNumber ?? counts[type] };
  }) };
}

export function RubricEditor({ rubric, onSave }: { rubric: ExamRubric | null; onSave: (value: ExamRubric) => void }) {
  const blank = (): ExamRubric => ({ id: `rubric-${Date.now()}`, title: "Bài kiểm tra mới", subject: "", grade: "", maxScore: 10, gradeWeight: 1, assessmentType: "regular", sourceType: "manual_text", items: [], createdAt: new Date().toISOString() });
  const [draft, setDraft] = useState<ExamRubric>(() => rubric ? editable(rubric) : blank());
  const [message, setMessage] = useState("");
  useEffect(() => { if (rubric) setDraft(editable(rubric)); setMessage(""); }, [rubric]);
  const update = (patch: Partial<ExamRubric>) => { setDraft(d => ({ ...d, ...patch })); setMessage(""); };
  const updateItem = (index: number, patch: Partial<RubricItem>) => update({ items: draft.items.map((item, i) => i === index ? { ...item, ...patch } : item) });
  const errors = validateRubricSettings(draft);
  return <section className="bg-white rounded-3xl border border-blue-200 p-6 space-y-4">
    <div className="flex justify-between gap-3"><h3 className="font-bold">Thiết lập đáp án và biểu điểm (không cần AI)</h3><button type="button" onClick={() => { setDraft(blank()); setMessage(""); }} className="text-blue-700 font-bold">Tạo bài mới</button></div>
    <div className="grid sm:grid-cols-3 gap-3">
      <label>Tên bài<input className={field} value={draft.title} onChange={e => update({ title: e.target.value })} /></label>
      <label>Môn học<input className={field} value={draft.subject} onChange={e => update({ subject: e.target.value })} /></label>
      <label>Khối / lớp<input className={field} value={draft.grade} onChange={e => update({ grade: e.target.value })} /></label>
      <label>Loại bài<select className={field} value={draft.assessmentType || "custom"} onChange={e => update({ assessmentType: e.target.value as ExamRubric["assessmentType"] })}><option value="regular">Thường xuyên / 15 phút</option><option value="midterm">Định kì / Giữa kì</option><option value="final">Định kì / Cuối kì</option><option value="custom">Tùy chỉnh</option></select></label>
      <label>Mã đề<input className={field} value={draft.examCode || ""} onChange={e => update({ examCode: e.target.value })} /></label>
      <label>Thang điểm<input className={field} type="number" min="0.01" step="0.01" value={draft.maxScore} onChange={e => update({ maxScore: Number(e.target.value) })} /></label>
      <label>Hệ số khi tổng hợp điểm<input className={field} type="number" min="0.01" step="0.01" value={draft.gradeWeight ?? 1} onChange={e => update({ gradeWeight: Number(e.target.value) })} /></label>
    </div>
    <p className="text-sm text-slate-600">Hệ số được lưu cùng kết quả, không nhân vào điểm bài làm. Số câu là số in trên phiếu và có thể bắt đầu lại từ 1 ở mỗi dạng. Điểm tối đa phải cộng đủ thang điểm.</p>
    {draft.items.some(item => rubricType(item) === "essay") && <p className="text-sm text-amber-800">Tự luận: lưu đáp án và barem để giáo viên kiểm tra, nhập điểm sau khi đọc bài. Hiện chưa tự động chấm riêng từng câu tự luận.</p>}
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{["Dạng câu", "Số trên phiếu", "Đáp án / Barem", "Điểm tối đa", "Cách chấm đúng/sai", ""].map(t => <th key={t} className="p-2 text-left">{t}</th>)}</tr></thead><tbody>
      {draft.items.map((item, index) => <tr key={index}>
        <td className="p-1 min-w-36"><select aria-label={`Dạng câu ${index + 1}`} className={field} value={rubricType(item)} onChange={e => updateItem(index, { questionType: e.target.value as RubricItem["questionType"], part: undefined, statements: undefined, correctAnswer: "" })}>{Object.entries(types).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></td>
        <td className="p-1"><input aria-label={`Số trên phiếu ${index + 1}`} className={field} type="number" min="1" step="1" value={item.printedNumber ?? 1} onChange={e => updateItem(index, { printedNumber: Number(e.target.value) })} /></td>
        <td className="p-1 min-w-48">{rubricType(item) === "multiple_choice" ? <select aria-label={`Đáp án ${index + 1}`} className={field} value={item.correctAnswer.trim().match(/^[A-D]/i)?.[0].toUpperCase() || ""} onChange={e => updateItem(index, { correctAnswer: e.target.value })}><option value="">Chọn đáp án</option>{[..."ABCD"].map(a => <option key={a}>{a}</option>)}</select> : <input aria-label={`Đáp án ${index + 1}`} className={field} placeholder={rubricType(item) === "true_false" ? "ĐSĐS (a, b, c, d)" : "Nhập đáp án"} value={item.correctAnswer} onChange={e => updateItem(index, { correctAnswer: e.target.value, statements: undefined })} />}
          {rubricType(item) === "essay" && <textarea aria-label={`Barem ${index + 1}`} className={field} placeholder="Tiêu chí và điểm từng ý" value={item.criteria || ""} onChange={e => updateItem(index, { criteria: e.target.value })} />}</td>
        <td className="p-1"><input aria-label={`Điểm câu ${index + 1}`} className={field} type="number" min="0.01" step="0.01" value={item.points} onChange={e => updateItem(index, { points: Number(e.target.value) })} /></td>
        <td className="p-1 min-w-48">{rubricType(item) === "true_false" && <select aria-label={`Cách chấm câu ${index + 1}`} className={field} value={item.trueFalseScoring || "tiered"} onChange={e => updateItem(index, { trueFalseScoring: e.target.value as RubricItem["trueFalseScoring"] })}><option value="tiered">Theo bậc: 0 / 10 / 25 / 50 / 100%</option><option value="linear">Chia đều: 25% mỗi ý đúng</option><option value="all_or_nothing">Đúng cả 4 ý mới có điểm</option></select>}</td>
        <td><button type="button" aria-label={`Xóa câu ${index + 1}`} className="text-red-600 p-2" onClick={() => update({ items: draft.items.filter((_, i) => i !== index) })}>Xóa</button></td>
      </tr>)}
    </tbody></table></div>
    <div className="flex flex-wrap gap-3">{Object.entries(types).map(([type, title]) => <button type="button" className="border rounded-lg px-3 py-2 text-blue-700" key={type} onClick={() => update({ items: [...draft.items, { questionIndex: Math.max(0, ...draft.items.map(i => Number(i.questionIndex) || 0)) + 1, printedNumber: Math.max(0, ...draft.items.filter(i => rubricType(i) === type).map(i => i.printedNumber || 0)) + 1, questionType: type as RubricItem["questionType"], correctAnswer: "", points: 1 }] })}>+ {title}</button>)}</div>
    <p>Tổng điểm đã đặt: <strong>{Number(draft.items.reduce((s, i) => s + i.points, 0).toFixed(2))} / {draft.maxScore}</strong></p>
    {errors.length > 0 && <ul className="text-amber-800 text-sm list-disc pl-5">{errors.map((error, i) => <li key={i}>{error}</li>)}</ul>}
    <button type="button" disabled={errors.length > 0} className="bg-blue-600 text-white rounded-xl px-4 py-2 disabled:opacity-40" onClick={() => { try { onSave(draft); setMessage("Đã lưu và áp dụng biểu điểm trên trình duyệt này."); } catch { setMessage("Không lưu được. Bộ nhớ trình duyệt có thể đã đầy."); } }}>Lưu và áp dụng biểu điểm</button>
    {message && <p role="status">{message}</p>}
  </section>;
}
