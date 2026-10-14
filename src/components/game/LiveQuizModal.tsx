import React, { useMemo, useState } from "react";
import { X, ChevronRight, RotateCcw } from "lucide-react";
import type { ExamConfig, Question } from "../../types";

export function LiveQuizModal({ isOpen, onClose, questions, config }: { isOpen: boolean; onClose: () => void; questions: Question[]; config?: ExamConfig }) {
  const usable = useMemo(() => (questions || []).filter((q: any) => (q.part || 1) === 1 && Array.isArray(q.options) && q.options.length > 1), [questions]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  if (!isOpen) return null;
  const q: any = usable[index];
  return <div className="fixed inset-0 z-[90] bg-slate-950/80 flex items-center justify-center p-4" role="dialog" aria-modal="true">
    <div className="bg-white rounded-3xl max-w-3xl w-full p-6 space-y-5 shadow-2xl">
      <div className="flex justify-between items-center"><div><h2 className="font-black text-lg">Đấu trường Quiz</h2><p className="text-xs text-slate-500">{config?.subject || "Ôn tập nhanh"}</p></div><button onClick={onClose} className="p-2"><X /></button></div>
      {!q ? <p className="p-8 text-center text-slate-500">Chưa có câu trắc nghiệm 4 lựa chọn để chơi.</p> : <>
        <div className="text-sm font-bold text-indigo-700">Câu {index + 1}/{usable.length}</div>
        <div className="text-lg font-semibold">{q.content}</div>
        <div className="grid sm:grid-cols-2 gap-3">{q.options.map((o: string, i: number) => <button key={i} onClick={() => setRevealed(true)} className={`text-left p-4 rounded-xl border ${revealed && i === q.correctIndex ? "bg-emerald-100 border-emerald-400" : "bg-slate-50"}`}>{String.fromCharCode(65+i)}. {o}</button>)}</div>
        <div className="flex justify-between"><button onClick={() => {setIndex(0);setRevealed(false)}} className="px-3 py-2 border rounded-xl flex gap-1"><RotateCcw className="w-4 h-4"/>Làm lại</button><button onClick={() => {setIndex((index+1)%usable.length);setRevealed(false)}} className="px-4 py-2 bg-indigo-600 text-white rounded-xl flex gap-1">Câu tiếp<ChevronRight className="w-4 h-4"/></button></div>
      </>}
    </div>
  </div>;
}
