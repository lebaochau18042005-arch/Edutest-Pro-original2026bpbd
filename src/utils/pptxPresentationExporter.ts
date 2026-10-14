import type { ExamConfig } from "../types";

function esc(s: any) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildPresentationHtml(questions: any[], config: ExamConfig, examCode: string) {
  const slides = (questions || []).map((q, i) => `<section class="slide"><div class="meta">${esc(config.subject || "Môn học")} · Mã ${esc(examCode)}</div><h2>Câu ${i + 1}</h2><div class="q">${esc(q.content)}</div>${Array.isArray(q.options) ? `<ol type="A">${q.options.map((o: string) => `<li>${esc(o)}</li>`).join("")}</ol>` : ""}</section>`).join("");
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EduTest Pro Slides</title><style>body{margin:0;font-family:system-ui;background:#0f172a;color:#fff}.slide{min-height:100vh;box-sizing:border-box;padding:7vh 8vw;display:flex;flex-direction:column;justify-content:center;border-bottom:1px solid #334155}.meta{color:#94a3b8}.q{font-size:2rem;line-height:1.45;margin:1.5rem 0}li{font-size:1.35rem;margin:.8rem 0}h2{font-size:2.5rem}</style></head><body>${slides || '<section class="slide"><h2>Chưa có câu hỏi</h2></section>'}</body></html>`;
}

export function openPresentationInNewTab(questions: any[], config: ExamConfig, examCode = "101") {
  const html = buildPresentationHtml(questions, config, examCode);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function exportPresentationHTMLFile(questions: any[], config: ExamConfig, examCode = "101") {
  const blob = new Blob([buildPresentationHtml(questions, config, examCode)], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `EduTestPro_Slides_${examCode}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
