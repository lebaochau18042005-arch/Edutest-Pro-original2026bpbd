import JSZip from "jszip";
import { ExamConfig, ExamQuestionVariant, Question } from "../types";
import { getSourcePackage } from "./sourcePackageStore";

const QUESTION_START_RE = /^\s*(?:Câu|Bài|Question)\s*(\d+)\s*[.):\-]?/i;
const ANSWER_SECTION_RE = /^\s*(?:BẢNG\s+ĐÁP\s+ÁN|ĐÁP\s+ÁN(?:\s+VÀ\s+LỜI\s+GIẢI)?|HƯỚNG\s+DẪN\s+CHẤM|HƯỚNG\s+DẪN\s+GIẢI)\b/i;

export interface ExactDocxExportReport {
  ok: boolean;
  fileName?: string;
  sourcePackageId?: string;
  preservedQuestionCount: number;
  warnings: string[];
  blockingIssues: string[];
}

interface IndexedBody {
  preamble: Element[];
  groups: Element[][];
  sectionProperties: Element | null;
  trailing: Element[];
}

function localTag(el: Element): string {
  return (el.localName || el.nodeName || "").replace(/^.*:/, "").toLowerCase();
}

function wordTextNodes(el: Element): Element[] {
  const direct = Array.from(el.getElementsByTagName("w:t"));
  if (direct.length) return direct;
  return Array.from(el.getElementsByTagName("t"));
}

function visibleText(el: Element): string {
  const nodes = wordTextNodes(el);
  if (nodes.length) return nodes.map((n) => n.textContent || "").join("");
  return el.textContent || "";
}

function cloneElements(elements: Element[]): Element[] {
  return elements.map((el) => el.cloneNode(true) as Element);
}

function indexBody(body: Element): IndexedBody {
  const preamble: Element[] = [];
  const groups: Element[][] = [];
  const trailing: Element[] = [];
  let sectionProperties: Element | null = null;
  let current: Element[] | null = null;
  let stopped = false;

  for (const child of Array.from(body.children)) {
    const tag = localTag(child);
    if (tag === "sectpr") {
      sectionProperties = child.cloneNode(true) as Element;
      continue;
    }

    const text = visibleText(child).replace(/\u00A0/g, " ").trim();
    if (!stopped && groups.length > 0 && ANSWER_SECTION_RE.test(text)) {
      if (current && current.length) {
        groups.push(current);
        current = null;
      }
      stopped = true;
    }
    if (stopped) {
      trailing.push(child.cloneNode(true) as Element);
      continue;
    }

    const isStart = QUESTION_START_RE.test(text);
    if (isStart) {
      if (current && current.length) groups.push(current);
      current = [child.cloneNode(true) as Element];
      continue;
    }

    if (current) current.push(child.cloneNode(true) as Element);
    else preamble.push(child.cloneNode(true) as Element);
  }
  if (current && current.length) groups.push(current);

  return { preamble, groups, sectionProperties, trailing };
}

function replaceRangeAcrossTextNodes(root: Element, start: number, end: number, replacement: string): boolean {
  const nodes = wordTextNodes(root);
  let cursor = 0;
  let inserted = false;
  let touched = false;

  for (const node of nodes) {
    const value = node.textContent || "";
    const nodeStart = cursor;
    const nodeEnd = cursor + value.length;
    cursor = nodeEnd;

    if (nodeEnd <= start || nodeStart >= end) continue;
    touched = true;
    const localStart = Math.max(0, start - nodeStart);
    const localEnd = Math.min(value.length, end - nodeStart);
    const before = value.slice(0, localStart);
    const after = value.slice(localEnd);
    if (!inserted) {
      node.textContent = before + replacement + after;
      inserted = true;
    } else {
      node.textContent = before + after;
    }
  }
  return touched && inserted;
}

function renumberQuestionGroup(group: Element[], newNumber: number): boolean {
  for (const block of group.slice(0, 3)) {
    const combined = wordTextNodes(block).map((n) => n.textContent || "").join("");
    const m = combined.match(QUESTION_START_RE);
    if (!m || m.index === undefined) continue;
    const digits = m[1];
    const rel = m[0].lastIndexOf(digits);
    const start = m.index + rel;
    const end = start + digits.length;
    return replaceRangeAcrossTextNodes(block, start, end, String(newNumber));
  }
  return false;
}

function replaceExamCodeInPreamble(preamble: Element[], fromCode?: string, toCode?: string): boolean {
  if (!fromCode || !toCode || fromCode === toCode) return false;
  for (const block of preamble) {
    const combined = wordTextNodes(block).map((n) => n.textContent || "").join("");
    const idx = combined.indexOf(fromCode);
    if (idx !== -1) return replaceRangeAcrossTextNodes(block, idx, idx + fromCode.length, toCode);
  }
  return false;
}

function serializeChildren(elements: Element[], serializer: XMLSerializer): string {
  return elements.map((el) => serializer.serializeToString(el)).join("");
}

function safeFileName(value: string): string {
  return (value || "de-thi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function sameOptions(a?: string[], b?: string[]): boolean {
  const aa = a || [];
  const bb = b || [];
  return aa.length === bb.length && aa.every((v, i) => v === bb[i]);
}

export async function exportExactPreservedDocxVariant(
  variantQuestions: ExamQuestionVariant[],
  originalQuestions: Question[],
  config: Partial<ExamConfig> & { title?: string; examCode?: string }
): Promise<ExactDocxExportReport> {
  const warnings: string[] = [];
  const blockingIssues: string[] = [];
  const originalById = new Map(originalQuestions.map((q) => [q.id, q]));
  const sourceIds = Array.from(new Set(variantQuestions.map((q) => q.originalSource?.fileId).filter(Boolean))) as string[];

  if (sourceIds.length !== 1) {
    blockingIssues.push(
      sourceIds.length === 0
        ? "Không có DOCX nguồn liên kết với các câu hỏi."
        : "Word bảo toàn OOXML Phase 4 hiện yêu cầu các câu trong mã đề xuất phát từ cùng một DOCX nguồn."
    );
  }

  for (const q of variantQuestions) {
    if (q.originalSource?.fileType !== "docx") {
      blockingIssues.push(`Câu ${q.questionIndex}: nguồn không phải DOCX.`);
      continue;
    }
    if (!q.originalSource?.ooxmlQuestionIndex) {
      blockingIssues.push(`Câu ${q.questionIndex}: thiếu chỉ mục khối OOXML nguồn.`);
    }
    const original = originalById.get(q.originalId);
    if (original && !sameOptions(original.options, q.options)) {
      blockingIssues.push(
        `Câu ${q.questionIndex}: phương án đã bị xáo. Để xuất Word giữ nguyên MathType/OLE byte-for-byte, hãy tắt "Trộn phương án" rồi tạo lại mã đề.`
      );
    }
  }

  if (blockingIssues.length > 0) {
    return { ok: false, preservedQuestionCount: 0, warnings, blockingIssues };
  }

  const sourceId = sourceIds[0];
  const record = await getSourcePackage(sourceId);
  if (!record) {
    return {
      ok: false,
      sourcePackageId: sourceId,
      preservedQuestionCount: 0,
      warnings,
      blockingIssues: ["DOCX nguồn không còn trong IndexedDB của trình duyệt này."],
    };
  }

  const sourceBytes = await record.blob.arrayBuffer();
  const zip = await JSZip.loadAsync(sourceBytes);
  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    return { ok: false, sourcePackageId: sourceId, preservedQuestionCount: 0, warnings, blockingIssues: ["DOCX nguồn thiếu word/document.xml."] };
  }

  const docXml = await docFile.async("text");
  const parser = new DOMParser();
  const doc = parser.parseFromString(docXml, "application/xml");
  const parserError = doc.getElementsByTagName("parsererror")[0];
  if (parserError) {
    return { ok: false, sourcePackageId: sourceId, preservedQuestionCount: 0, warnings, blockingIssues: ["Không thể phân tích document.xml của DOCX nguồn."] };
  }

  const body = doc.getElementsByTagName("w:body")[0] || doc.getElementsByTagName("body")[0];
  if (!body) {
    return { ok: false, sourcePackageId: sourceId, preservedQuestionCount: 0, warnings, blockingIssues: ["Không tìm thấy w:body trong DOCX nguồn."] };
  }

  const indexed = indexBody(body);
  if (indexed.groups.length === 0) {
    return { ok: false, sourcePackageId: sourceId, preservedQuestionCount: 0, warnings, blockingIssues: ["Không tách được các khối 'Câu n' từ DOCX nguồn."] };
  }

  const selectedGroups: Element[][] = [];
  for (const q of variantQuestions) {
    const sourceIndex = Number(q.originalSource?.ooxmlQuestionIndex || 0);
    const group = indexed.groups[sourceIndex - 1];
    if (!group) {
      blockingIssues.push(`Câu ${q.questionIndex}: chỉ mục OOXML ${sourceIndex} vượt quá ${indexed.groups.length} câu nguồn.`);
      continue;
    }
    const cloned = cloneElements(group);
    const displayNumber = q.partQuestionIndex || q.questionIndex;
    if (!renumberQuestionGroup(cloned, displayNumber)) {
      warnings.push(`Câu ${q.questionIndex}: không đổi được số câu trong XML, nội dung gốc vẫn được giữ nguyên.`);
    }
    selectedGroups.push(cloned);
  }
  if (blockingIssues.length) {
    return { ok: false, sourcePackageId: sourceId, preservedQuestionCount: 0, warnings, blockingIssues };
  }

  const preamble = cloneElements(indexed.preamble);
  const targetCode = config.examCode || config.originalExamCode;
  const codeChanged = replaceExamCodeInPreamble(preamble, config.originalExamCode, targetCode);
  if (targetCode && config.originalExamCode && targetCode !== config.originalExamCode && !codeChanged) {
    warnings.push(`Không tìm thấy mã đề gốc ${config.originalExamCode} ở phần đầu DOCX để đổi sang ${targetCode}.`);
  }

  // Rebuild only w:body. All relationships, media and OLE embeddings remain untouched in the cloned source package.
  while (body.firstChild) body.removeChild(body.firstChild);
  for (const el of preamble) body.appendChild(doc.importNode(el, true));
  for (const group of selectedGroups) {
    for (const el of group) body.appendChild(doc.importNode(el, true));
  }
  if (indexed.sectionProperties) body.appendChild(doc.importNode(indexed.sectionProperties, true));

  const serializer = new XMLSerializer();
  const rebuiltXml = serializer.serializeToString(doc);
  zip.file("word/document.xml", rebuiltXml);

  // Add a small audit manifest inside customXml without touching Word relationships.
  const manifest = {
    schema: "edutest-pro-ooxml-preserved-v4",
    createdAt: new Date().toISOString(),
    sourcePackageId: sourceId,
    sourceFileName: record.fileName,
    sourceSha256: record.sha256,
    examCode: targetCode,
    questionOrder: variantQuestions.map((q) => ({
      originalId: q.originalId,
      sourceQuestionIndex: q.originalSource?.ooxmlQuestionIndex,
      outputQuestionIndex: q.questionIndex,
      partQuestionIndex: q.partQuestionIndex,
    })),
    preservation: "The DOCX package was cloned from the original source; word/media, word/embeddings and relationship files were not regenerated.",
  };
  zip.file("edutest-preservation-manifest.json", JSON.stringify(manifest, null, 2));

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const url = URL.createObjectURL(blob);
  const code = targetCode || "GOC";
  const title = safeFileName(config.title || record.fileName.replace(/\.docx$/i, "")) || "de-thi";
  const fileName = `${title}_MA_${safeFileName(code)}_OOXML_BAO_TOAN.docx`;
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }

  return {
    ok: true,
    fileName,
    sourcePackageId: sourceId,
    preservedQuestionCount: selectedGroups.length,
    warnings,
    blockingIssues: [],
  };
}
