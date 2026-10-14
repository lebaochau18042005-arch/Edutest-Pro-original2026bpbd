import React from "react";
import { X } from "lucide-react";
import type { GradedPaperResult } from "../../types";

export function GradedPaperReview({ paper, onClose, onScore, onNotes }: { paper: GradedPaperResult; onClose: () => void; onScore?: (questionIndex: number | string, score: number, feedback?: string, part?: string) => void; onNotes?: (notes: string) => void }) {
  return <div className="fixed inset-0 z-[80] bg-slate-950/70 flex items-center justify-center p-4" role="dialog" aria-modal="true">
    <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-auto p-6 space-y-4">
      <div className="flex items-center justify-between"><div><h2 className="font-bold text-lg">Rà soát bài chấm</h2><p className="text-sm text-slate-500">{(paper as any).studentName || (paper as any).fileName || "Bài làm"}</p></div><button onClick={onClose} className="p-2"><X /></button></div>
      <div className="grid gap-3">{((paper as any).details || (paper as any).questionDetails || []).map((d: any, i: number) => <div key={i} className="border rounded-xl p-3 flex gap-3 items-center"><div className="flex-1"><strong>Câu {d.questionIndex ?? i+1}</strong><div className="text-xs text-slate-600">{d.feedback || d.studentAnswerDisplay || ""}</div></div>{onScore && <input type="number" step="0.01" min="0" value={Number(d.pointsAwarded ?? 0)} onChange={e=>onScore(d.questionIndex ?? i+1, Number(e.target.value), d.feedback, d.part)} className="w-24 border rounded p-2"/>}</div>)}</div>
      {onNotes && <textarea className="w-full border rounded-xl p-3" placeholder="Ghi chú của giáo viên" defaultValue={(paper as any).teacherNotes || ""} onBlur={e=>onNotes(e.target.value)} />}
    </div>
  </div>;
}
