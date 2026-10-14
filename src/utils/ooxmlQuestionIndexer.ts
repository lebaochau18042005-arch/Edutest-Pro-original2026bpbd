import JSZip from "jszip";

export interface OoxmlQuestionIndexResult {
  questionCount: number;
  questionNumbers: number[];
  warnings: string[];
}

const QUESTION_START_RE = /^\s*(?:Câu|Bài|Question)\s*(\d+)\s*[.):\-]?/i;
const ANSWER_SECTION_RE = /^\s*(?:BẢNG\s+ĐÁP\s+ÁN|ĐÁP\s+ÁN(?:\s+VÀ\s+LỜI\s+GIẢI)?|HƯỚNG\s+DẪN\s+CHẤM|HƯỚNG\s+DẪN\s+GIẢI)\b/i;

function tagName(el: Element): string {
  return (el.localName || el.nodeName || "").replace(/^.*:/, "").toLowerCase();
}

function visibleText(el: Element): string {
  const texts = Array.from(el.getElementsByTagName("w:t"));
  if (texts.length) return texts.map((n) => n.textContent || "").join("");
  return (el.textContent || "").replace(/\s+/g, " ");
}

export async function indexDocxQuestions(arrayBuffer: ArrayBuffer): Promise<OoxmlQuestionIndexResult> {
  const warnings: string[] = [];
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docFile = zip.file("word/document.xml");
    if (!docFile) return { questionCount: 0, questionNumbers: [], warnings: ["DOCX không có word/document.xml."] };

    const xml = await docFile.async("text");
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const body = doc.getElementsByTagName("w:body")[0] || doc.getElementsByTagName("body")[0];
    if (!body) return { questionCount: 0, questionNumbers: [], warnings: ["Không tìm thấy w:body trong DOCX."] };

    const numbers: number[] = [];
    for (const child of Array.from(body.children)) {
      if (tagName(child) === "sectpr") continue;
      const text = visibleText(child).replace(/\u00A0/g, " ").trim();
      if (!text) continue;
      if (ANSWER_SECTION_RE.test(text) && numbers.length > 0) break;
      const m = text.match(QUESTION_START_RE);
      if (m) numbers.push(Number(m[1]));
    }

    if (numbers.length === 0) {
      warnings.push("Không nhận diện được mốc 'Câu n' ở cấp block OOXML; Word bảo toàn nguồn sẽ không khả dụng cho file này.");
    }
    return { questionCount: numbers.length, questionNumbers: numbers, warnings };
  } catch (err: any) {
    return { questionCount: 0, questionNumbers: [], warnings: [`Lỗi lập chỉ mục OOXML: ${err?.message || String(err)}`] };
  }
}
