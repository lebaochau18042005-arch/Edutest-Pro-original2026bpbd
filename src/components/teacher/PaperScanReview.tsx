import React, { useState } from "react";
import type { ExamRubric } from "../../types";
import type { PaperScan } from "../../utils/paperGrading";
import { rubricType } from "../../utils/rubricSettings";

export function PaperScanReview({ scan, rubric, imageUrl, mimeType, onConfirm, onCancel }: {
  scan: PaperScan; rubric: ExamRubric; imageUrl: string; mimeType: string;
  onConfirm: (scan: PaperScan) => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState<PaperScan>(() => structuredClone(scan));
  const [confirmed, setConfirmed] = useState(false);
  const [zoom, setZoom] = useState(100);
  const counts: Record<string, number> = {};
  const rows = rubric.items.map(item => {
    const type = rubricType(item);
    counts[type] = (counts[type] || 0) + 1;
    return { type, number: item.printedNumber ?? counts[type] };
  }).filter(row => row.type !== "essay");
  const valid = rows.every(({ type, number }) => type === "multiple_choice"
    ? ["", "A", "B", "C", "D"].includes(draft.part1[number])
    : type === "true_false"
      ? [..."abcd"].every(k => ["", "Đ", "S"].includes(draft.part2[number]?.[k]))
      : typeof draft.part3[number] === "string" && !/[?？]/.test(draft.part3[number]));
  const codeMatches = !rubric.examCode || draft.examCode?.trim() === rubric.examCode.trim();
  const change = (edit: (value: PaperScan) => void) => {
    setDraft(value => { const next = structuredClone(value); edit(next); return next; });
    setConfirmed(false);
  };
  const choice = (value: string | undefined, choices: string[], label: string, update: (v: string) => void) => <select aria-label={label} className="border rounded p-2 bg-white" value={value !== undefined && choices.includes(value) ? value : "?"} onChange={e => update(e.target.value)}>
    <option value="?">Cần kiểm tra</option><option value="">Bỏ trống</option>{choices.filter(Boolean).map(v => <option key={v}>{v}</option>)}
  </select>;
  return <div className="fixed inset-0 z-[70] bg-slate-950/80 p-3 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Duyệt đáp án trên phiếu">
    <div className="bg-white rounded-2xl w-full max-w-7xl h-[94vh] flex flex-col p-4 gap-3">
      <h2 className="text-lg font-bold">Duyệt đáp án đã đọc — chưa tính điểm</h2>
      <p className="text-sm">Đối chiếu từng câu với ảnh, sửa đáp án đọc sai. Chỉ chọn “Bỏ trống” khi thấy rõ học sinh không tô. Không thể đọc rõ thì dừng và tải ảnh khác.</p>
      <div className="grid md:grid-cols-2 gap-4 flex-1 min-h-0 overflow-auto">
        <div className="overflow-auto bg-slate-100 rounded-xl">
          <label className="block p-2 sticky top-0 bg-slate-100">Phóng to <input aria-label="Phóng to ảnh phiếu" type="range" min="100" max="300" step="25" value={zoom} onChange={e => setZoom(Number(e.target.value))} /> {zoom}%</label>
          {mimeType.includes("pdf") ? <object data={imageUrl} type="application/pdf" className="w-full h-full"><a href={imageUrl} target="_blank" rel="noreferrer">Mở phiếu PDF</a></object> : <img src={imageUrl} alt="Phiếu học sinh gốc để đối chiếu" style={{ width: `${zoom}%`, maxWidth: "none" }} />}
        </div>
        <div className="overflow-auto space-y-3 p-2">
          <label className="block">Mã đề đọc trên phiếu <input className="border p-2 rounded" value={draft.examCode || ""} onChange={e => change(s => { s.examCode = e.target.value; })} /></label>
          {!codeMatches && <p className="text-red-700">Mã đề chưa khớp biểu điểm. Kiểm tra mã trên ảnh hoặc chọn lại biểu điểm; không sửa mã theo đáp án nếu phiếu khác đề.</p>}
          {rows.map(({ type, number }) => <div key={`${type}:${number}`} className="border rounded-xl p-3 flex flex-wrap items-center gap-3">
            <strong>{type === "multiple_choice" ? "Phần I" : type === "true_false" ? "Phần II" : "Phần III"} · Câu {number}</strong>
            {type === "multiple_choice" ? choice(draft.part1[number], ["", "A", "B", "C", "D"], `Phần I câu ${number}`, v => change(s => { s.part1[number] = v; }))
              : type === "true_false" ? [..."abcd"].map(k => <label key={k}>{k}) {choice(draft.part2[number]?.[k], ["", "Đ", "S"], `Phần II câu ${number} ý ${k}`, v => change(s => { s.part2[number] = { ...s.part2[number], [k]: v }; }))}</label>)
              : <><input aria-label={`Phần III câu ${number}`} className="border p-2 rounded" placeholder="Chưa đọc được" value={draft.part3[number] ?? ""} onChange={e => change(s => { s.part3[number] = e.target.value; })} /><button type="button" className="text-blue-700" onClick={() => change(s => { s.part3[number] = ""; })}>Xác nhận bỏ trống</button></>}
          </div>)}
        </div>
      </div>
      {!valid && <p className="text-amber-800">Có câu chưa đọc rõ hoặc thiếu dữ liệu. Hãy kiểm tra các câu trước khi chấm.</p>}
      <label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> Tôi đã đối chiếu tất cả đáp án ở trên với phiếu gốc.</label>
      <div className="flex justify-end gap-3"><button type="button" onClick={onCancel} className="border rounded-lg p-3">Dừng, kiểm tra lại phiếu</button><button type="button" disabled={!valid || !codeMatches || !confirmed} onClick={() => onConfirm(draft)} className="bg-blue-600 text-white rounded-lg p-3 disabled:opacity-40">Xác nhận đáp án và tính điểm</button></div>
    </div>
  </div>;
}
