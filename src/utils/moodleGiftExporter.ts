import type { ExamConfig } from "../types";

function downloadText(text: string, filename: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function cleanText(v: any) {
  return String(v ?? "").replace(/[{}~=#:]/g, " ").trim();
}

export function exportToGIFTFile(questions: any[], config: ExamConfig, examCode = "101") {
  const gift = (questions || []).map((q, i) => {
    const title = `Câu ${i + 1} - Mã ${examCode}`;
    if ((q.part || 1) === 1 && Array.isArray(q.options) && Number.isInteger(q.correctIndex)) {
      const opts = q.options.map((o: string, idx: number) => `${idx === q.correctIndex ? "=" : "~"}${cleanText(o)}`).join(" ");
      return `::${title}::${cleanText(q.content)} {${opts}}`;
    }
    if ((q.part || 1) === 3 && q.shortAnswer) {
      return `::${title}::${cleanText(q.content)} {=${cleanText(q.shortAnswer)}}`;
    }
    return `// ${title}: dạng câu này cần kiểm tra khi nhập Moodle\n::${title}::${cleanText(q.content)} {}`;
  }).join("\n\n");
  downloadText(gift, `Moodle_${config.subject || "MonHoc"}_${examCode}.gift`, "text/plain;charset=utf-8");
}

export function exportToMoodleXMLFile(questions: any[], config: ExamConfig, examCode = "101") {
  const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const body = (questions || []).map((q, i) => {
    if ((q.part || 1) !== 1 || !Array.isArray(q.options) || !Number.isInteger(q.correctIndex)) {
      return `<!-- Câu ${i + 1}: dạng câu chưa hỗ trợ xuất Moodle XML tự động -->`;
    }
    const answers = q.options.map((o: string, idx: number) => `<answer fraction="${idx === q.correctIndex ? 100 : 0}"><text>${esc(o)}</text></answer>`).join("");
    return `<question type="multichoice"><name><text>Câu ${i + 1} - Mã ${esc(examCode)}</text></name><questiontext format="html"><text>${esc(q.content)}</text></questiontext><single>true</single>${answers}</question>`;
  }).join("\n");
  downloadText(`<?xml version="1.0" encoding="UTF-8"?><quiz>${body}</quiz>`, `Moodle_${config.subject || "MonHoc"}_${examCode}.xml`, "application/xml;charset=utf-8");
}
