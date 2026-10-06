import React, { useState } from "react";
import { X, ZoomIn, ZoomOut, RotateCw, Maximize2 } from "lucide-react";
import type { GradedPaperResult } from "../../types";

const statuses = { correct: ["Đúng", "text-emerald-700 bg-emerald-50"], incorrect: ["Sai", "text-rose-700 bg-rose-50"], partial: ["Một phần", "text-amber-800 bg-amber-50"], ungraded: ["Cần kiểm tra", "text-slate-700 bg-slate-100"] };
const partName = (part?: string) => ({ part1: "I", part2: "II", part3: "III", essay: "Tự luận" }[part || ""] || "—");
export function GradedPaperReview({ paper, onClose, onScore, onNotes }: {
  key?: string; paper: GradedPaperResult; onClose: () => void;
  onScore: (question: number | string, score: number, feedback?: string, part?: string) => void;
  onNotes: (notes: string) => void;
}) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [selected, setSelected] = useState(0);
  const [filter, setFilter] = useState("all");
  const [source, setSource] = useState(paper.fileData || "");
  const [sourceType, setSourceType] = useState(paper.fileType);
  const [error, setError] = useState("");
  const detail = paper.details[selected];
  const rows = paper.details.map((d, index) => ({ d, index })).filter(({ d }) => filter === "all" || (filter === "review" ? d.status !== "correct" : d.status === filter));
  return <div className="fixed inset-0 z-50 bg-slate-950/70 p-2 sm:p-3 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="paper-review-title">
    <div className="bg-white w-full max-w-[1600px] h-[96vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-4 border-b px-5 py-3">
        <div className="min-w-0"><p className="text-xs font-bold text-blue-700">ĐỐI CHIẾU BÀI CHẤM · MÃ ĐỀ {paper.examCode || "Chưa rõ"}</p><h2 id="paper-review-title" title={paper.studentName} className="text-lg font-bold text-slate-900 truncate">{paper.studentName}</h2><p className="text-sm text-slate-500">Lớp {paper.studentClass || "—"} · {paper.examTitle}</p></div>
        <button type="button" aria-label="Đóng bài chấm" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><X /></button>
      </header>
      <div className="grid lg:grid-cols-2 flex-1 min-h-0 overflow-auto lg:overflow-hidden">
        <section className="bg-slate-100 flex flex-col min-h-[55vh] lg:min-h-0 border-r">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white border-b">
            <span className="font-semibold text-sm">Phiếu bài làm gốc</span><div className="flex items-center gap-2">
              <button type="button" aria-label="Thu nhỏ" onClick={() => setZoom(z => Math.max(50, z - 25))} className="p-2 rounded border"><ZoomOut size={17} /></button><span className="text-sm w-12 text-center">{zoom}%</span>
              <button type="button" aria-label="Phóng to" onClick={() => setZoom(z => Math.min(300, z + 25))} className="p-2 rounded border"><ZoomIn size={17} /></button>
              <button type="button" aria-label="Xoay ảnh" onClick={() => setRotation(r => (r + 90) % 360)} className="p-2 rounded border"><RotateCw size={17} /></button>
              <button type="button" aria-label="Vừa khung" onClick={() => { setZoom(100); setRotation(0); }} className="p-2 rounded border"><Maximize2 size={17} /></button>
            </div>
          </div>
          <div className="overflow-auto flex-1 p-3">
            {source ? sourceType === "pdf" ? <object data={source} type="application/pdf" className="w-full h-full min-h-[60vh]"><p>Không xem được PDF trong trình duyệt này.</p></object> : <div style={{ width: `${zoom}%` }} className="relative mx-auto">
              <img src={source} alt="Phiếu học sinh đã làm" className="w-full max-w-none shadow rounded" style={{ transform: `rotate(${rotation}deg)` }} />
            </div> : <div className="p-10 text-center text-slate-600">Ảnh gốc chưa được lưu cùng kết quả. Tải lại phiếu bên dưới để đối chiếu.</div>}
          </div>
          <div className="p-3 border-t text-xs bg-white space-y-2"><p className="truncate" title={paper.fileName}>{paper.fileName}</p><label className="text-blue-700 font-semibold">Tải lại ảnh / PDF để đối chiếu<input aria-label="Tải lại phiếu gốc" type="file" accept="image/*,application/pdf" className="block mt-1 max-w-full" onChange={e => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { setSource(String(reader.result)); setSourceType(file.type.includes("pdf") ? "pdf" : "image"); setError(""); }; reader.onerror = () => setError("Không đọc được tệp. Vui lòng thử lại."); reader.readAsDataURL(file); }} /></label>{error && <p role="alert">{error}</p>}</div>
        </section>
        <section className="flex flex-col min-h-[65vh] lg:min-h-0 bg-white">
          <div className="px-5 py-4 border-b space-y-3">
            <div className="flex justify-between items-center"><div><p className="text-xs uppercase font-bold text-slate-500">Tổng điểm bài làm</p><p className="text-4xl font-black text-red-600 tabular-nums">{paper.totalScore}<span className="text-xl text-slate-400 font-medium"> / {paper.maxScore}</span></p></div><div className="text-right text-sm text-slate-600"><p>{paper.details.length} câu hỏi</p><p className="text-emerald-700">{paper.details.filter(d => d.status === "correct").length} câu đúng</p></div></div>
            <label className="text-sm flex gap-3 items-center">Hiển thị<select className="border rounded-lg p-2 flex-1" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Tất cả câu hỏi</option><option value="review">Sai / Một phần / Cần kiểm tra</option><option value="correct">Câu đúng</option></select></label>
            <p className="text-xs text-slate-500">Chọn một dòng để xem nhận xét. Có thể sửa điểm trực tiếp trong bảng.</p>
          </div>
          <div className="overflow-auto flex-1 min-h-[230px]">
            <table className="w-full text-sm text-center border-collapse"><thead className="sticky top-0 bg-slate-200 text-slate-700 z-10"><tr>{["Câu", "HS chọn", "Đáp án", "Điểm", "Kết quả"].map(t => <th className="px-3 py-3 whitespace-nowrap" key={t}>{t}</th>)}</tr></thead><tbody>
              {rows.map(({ d, index }) => <tr key={`${d.part}:${d.questionIndex}:${index}`} onClick={() => setSelected(index)} className={`border-b cursor-pointer ${selected === index ? "bg-blue-50 outline outline-1 -outline-offset-1 outline-blue-300" : index % 2 ? "bg-slate-50" : "bg-white"}`}>
                <td className="p-3 whitespace-nowrap"><button type="button" onClick={() => setSelected(index)} className="font-bold text-blue-800">{partName(d.part)} · {d.questionIndex}</button></td>
                <td className="p-3 font-semibold max-w-40 break-words">{d.studentAnswer || "Bỏ trống"}</td><td className="p-3 max-w-40 break-words">{d.teacherAnswer || "—"}</td>
                <td className="p-2 whitespace-nowrap"><input aria-label={`Điểm phần ${partName(d.part)} câu ${d.questionIndex}`} type="number" min="0" max={d.maxPoints} step="0.01" value={d.pointsAwarded} onChange={e => { const v = e.target.valueAsNumber; if (Number.isFinite(v)) onScore(d.questionIndex, Math.max(0, Math.min(d.maxPoints, v)), undefined, d.part); }} className="w-16 text-center border rounded p-1.5 font-bold text-blue-700 bg-white" /><span className="text-xs text-slate-500"> /{d.maxPoints}</span></td>
                <td className="p-2"><span className={`inline-block rounded-md px-2 py-1 text-xs font-semibold ${statuses[d.status][1]}`}>{statuses[d.status][0]}</span></td>
              </tr>)}
              {!rows.length && <tr><td colSpan={5} className="p-8 text-slate-500">Không có câu nào trong bộ lọc này.</td></tr>}
            </tbody></table>
          </div>
          <div className="border-t p-4 space-y-3 bg-slate-50 max-h-[30vh] overflow-auto">
            {detail && <p className="text-sm"><strong>Phần {partName(detail.part)} · Câu {detail.questionIndex}: </strong>{detail.feedback || "Chưa có nhận xét."}</p>}
            <details><summary className="text-sm font-semibold cursor-pointer">Nhận xét tổng thể và ghi chú giáo viên</summary><p className="text-sm py-2">{paper.summaryEvaluation}</p><textarea aria-label="Ghi chú giáo viên" defaultValue={paper.teacherNotes || ""} onBlur={e => onNotes(e.target.value)} className="w-full border rounded-lg p-2 text-sm" rows={2} /></details>
            <p className="text-xs text-slate-500">Ảnh gốc được giữ nguyên. Chưa vẽ vòng đúng/sai khi chưa có tọa độ ô tô đã xác minh.</p>
          </div>
        </section>
      </div>
    </div>
  </div>;
}
