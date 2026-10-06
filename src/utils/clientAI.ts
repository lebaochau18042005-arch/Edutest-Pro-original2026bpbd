import { recognizeAndGradePaper } from "./paperGrading";
import { withGradingTimeout } from "./gradingTimeout";
/**
 * clientAI.ts - Client-side Gemini API adapter for Vercel SPA and offline/online deployment
 * Direct @google/genai browser calls with auto fallback across models and local regex parser.
 */
import { GoogleGenAI, Type } from "@google/genai";
import { getStoredApiKey, getStoredSelectedModel } from "../components/ModelSettingsModal";
import { Question, QuestionType, TrueFalseStatement } from "../types";
import { normalizeExamQuestions3Parts } from "./examHelpers";

export const FALLBACK_MODELS = [
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-3.1-pro-preview",
  "gemini-3.1-flash-lite",
];

function getAI(apiKey?: string): GoogleGenAI | null {
  const key = (apiKey || getStoredApiKey() || "").trim();
  if (!key) return null;
  try {
    return new GoogleGenAI({ apiKey: key });
  } catch (e) {
    console.warn("Error initializing GoogleGenAI client:", e);
    return null;
  }
}

export async function generateWithFallback(
  contents: any,
  apiKey?: string,
  preferredModel?: string,
  config?: any,
  deadline?: number
): Promise<string> {
  const key = apiKey || getStoredApiKey();
  const ai = getAI(key);
  if (!ai) {
    throw new Error("Vui lòng cấu hình Google Gemini API Key trong phần Cài Đặt (nút đỏ trên Header).");
  }

  const selectedModel = preferredModel || getStoredSelectedModel() || "gemini-3.5-flash";
  const modelsToTry = [
    selectedModel,
    ...FALLBACK_MODELS.filter((m) => m !== selectedModel),
  ];

  let lastError: any;
  for (const model of (deadline ? modelsToTry.slice(0, 2) : modelsToTry)) {
    if (deadline && Date.now() >= deadline) throw new Error("Chấm bài quá thời gian chờ. Vui lòng thử lại.");
    try {
      const request = (abortSignal?: AbortSignal) => ai.models.generateContent({
        model,
        contents,
        config: abortSignal ? { ...config, abortSignal } : config,
      });
      const resp = deadline
        ? await withGradingTimeout(request, Math.min(45000, deadline - Date.now()))
        : await request();
      return resp.text ?? "";
    } catch (err: any) {
      lastError = err;
      console.warn(`Model ${model} failed, trying fallback...`, err?.message || err);
      if (err?.status === 400 && (err?.message?.includes("API key not valid") || err?.message?.includes("API_KEY_INVALID"))) {
        throw new Error("API Key không hợp lệ. Vui lòng kiểm tra lại Google AI Studio API Key của bạn.");
      }
    }
  }

  const rawMsg = lastError?.message || String(lastError || "");
  let cleanMsg = rawMsg;
  try {
    const parsed = JSON.parse(rawMsg);
    if (parsed?.error?.message) {
      cleanMsg = parsed.error.message;
    }
  } catch (e) {}

  if (
    cleanMsg.includes("is not found for API version") ||
    cleanMsg.includes("NOT_FOUND") ||
    cleanMsg.includes("gemini-1.5") ||
    cleanMsg.includes("gemini-2.0") ||
    cleanMsg.includes("gemini-2.5")
  ) {
    cleanMsg = "Model AI hiện tại không khả dụng hoặc đã được nâng cấp. Hệ thống đã tự động chuyển sang Gemini 3.5 Flash.";
    if (typeof window !== "undefined") {
      localStorage.setItem("gemini_selected_model", "gemini-3.5-flash");
    }
  }

  throw new Error(cleanMsg || "Không thể kết nối đến Gemini AI. Vui lòng kiểm tra API Key trong phần Cài Đặt.");
}

/**
 * Robust JSON sanitizer to repair unescaped LaTeX backslashes and invalid Unicode escape sequences from LLMs
 */
function sanitizeJsonStringLiterals(jsonStr: string): string {
  let result = "";
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];

    if (!inString) {
      if (char === '"') {
        inString = true;
      }
      result += char;
    } else {
      if (isEscaped) {
        isEscaped = false;
        if (
          char === '"' ||
          char === '\\' ||
          char === '/' ||
          char === 'b' ||
          char === 'f' ||
          char === 'n' ||
          char === 'r' ||
          char === 't'
        ) {
          result += char;
        } else if (char === 'u') {
          // Check if followed by 4 valid hex digits
          const hex = jsonStr.substring(i + 1, i + 5);
          if (/^[0-9a-fA-F]{4}$/.test(hex)) {
            result += char;
          } else {
            // Unescaped LaTeX command like \underline or \upsilon, double escape it
            result += "\\u";
          }
        } else {
          // Non-standard JSON escape like \frac, \sqrt, \alpha, \vec, \Delta. Double escape
          result += "\\" + char;
        }
      } else {
        if (char === '\\') {
          isEscaped = true;
          result += char;
        } else if (char === '"') {
          inString = false;
          result += char;
        } else if (char === '\n') {
          result += "\\n";
        } else if (char === '\r') {
          result += "\\r";
        } else if (char === '\t') {
          result += "\\t";
        } else {
          result += char;
        }
      }
    }
  }

  return result;
}

export function safeJsonParse<T>(text: string, defaultValue: T): T {
  if (!text || !text.trim()) return defaultValue;

  let cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // Try direct parse
  try {
    return JSON.parse(cleaned);
  } catch (firstErr) {
    // Proceed to repair
  }

  // Find array or object boundaries
  const firstSquare = cleaned.indexOf("[");
  const firstCurly = cleaned.indexOf("{");
  let startIdx = 0;
  let endIdx = cleaned.length;

  if (firstSquare !== -1 && (firstCurly === -1 || firstSquare < firstCurly)) {
    startIdx = firstSquare;
    const lastSquare = cleaned.lastIndexOf("]");
    if (lastSquare !== -1) endIdx = lastSquare + 1;
  } else if (firstCurly !== -1) {
    startIdx = firstCurly;
    const lastCurly = cleaned.lastIndexOf("}");
    if (lastCurly !== -1) endIdx = lastCurly + 1;
  }

  cleaned = cleaned.substring(startIdx, endIdx);

  // Fix 1: Bad Unicode escapes (\u not followed by 4 hex digits)
  cleaned = cleaned.replace(/\\u(?![0-9a-fA-F]{4})/g, "\\\\u");

  // Fix 2: Unescaped LaTeX backslashes (\frac, \sqrt, \vec, etc.)
  cleaned = cleaned.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, "\\\\");

  // Fix 3: Trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([\]}])/g, "$1");

  try {
    return JSON.parse(cleaned);
  } catch (secondErr) {
    try {
      const sanitized = sanitizeJsonStringLiterals(cleaned);
      return JSON.parse(sanitized);
    } catch (thirdErr) {
      console.warn("safeJsonParse repair attempt failed:", thirdErr);
      return defaultValue;
    }
  }
}

/// ──────────────────────────────────────────────
// Helper: Extract inline options A, B, C, D (Part I - Case Sensitive UPPERCASE)
// ──────────────────────────────────────────────
export function splitRawTextIntoOptions(text: string): string[] {
  if (!text || !text.trim()) return [];
  let clean = text.replace(/\u00A0/g, " ").trim();

  // 1. Dạng dòng bảng Markdown
  if (clean.includes("|")) {
    const pipeCells = clean
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0 && !/^:?-+:?$/.test(c));

    const optionCells = pipeCells.filter((c) => /^(?:\*{0,2}(?:\[?[A-D]\]?|\([A-D]\))[.)/:\-–—]\*{0,2})/g.test(c));
    if (optionCells.length >= 2) {
      return optionCells.map((c) => c.replace(/^(?:\*{0,2}(?:\[?[A-D]\]?|\([A-D]\))[.)/:\-–—]\*{0,2})\s*/g, "").trim());
    }
  }

  // 2. Regex tìm vị trí các phương án A, B, C, D (UPPERCASE ONLY có ký tự phân cách bắt buộc)
  const pattern = /(?:^|[\n\r\t]|\s{2,}|\s+)(?:\*{0,2}(?:\[([A-D])\]|\(([A-D])\)|([A-D])(?:\)|\.|\:|\/|\s*[-–—]))\*{0,2})\s*/g;
  const matches: { letter: string; index: number; matchLength: number }[] = [];
  let m;

  while ((m = pattern.exec(clean)) !== null) {
    const matchIdx = m.index;
    const beforeStr = clean.substring(0, matchIdx);

    const lastUrlOpen = beforeStr.lastIndexOf("](");
    const lastUrlClose = beforeStr.lastIndexOf(")");
    if (lastUrlOpen !== -1 && (lastUrlClose === -1 || lastUrlClose < lastUrlOpen)) continue;

    const lastAltOpen = beforeStr.lastIndexOf("![");
    const lastAltClose = beforeStr.lastIndexOf("]");
    if (lastAltOpen !== -1 && (lastAltClose === -1 || lastAltClose < lastAltOpen)) continue;

    const letter = (m[1] || m[2] || m[3] || "").toUpperCase();
    if (!letter || !["A", "B", "C", "D"].includes(letter)) continue;

    matches.push({
      letter,
      index: m.index,
      matchLength: m[0].length,
    });
  }

  if (matches.length >= 2) {
    const options: string[] = [];
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const start = current.index + current.matchLength;
      const end = i < matches.length - 1 ? matches[i + 1].index : clean.length;
      const optVal = clean.substring(start, end).trim();
      if (optVal) {
        options.push(optVal);
      }
    }
    if (options.length >= 2) {
      return options;
    }
  }

  // 3. Fallback check B. ... C. ... D. ...
  const bMatch = clean.search(/(?:[\n\r\t]|\s{2,}|\s+)(?:\*{0,2}(?:\[?B\]?|\(B\))[.)/:\-–—]\*{0,2})\s*/);
  if (bMatch > 0) {
    const textA = clean.substring(0, bMatch).replace(/^(?:\*{0,2}(?:\[?A\]?|\(A\))[.)/:\-–—]\*{0,2})\s*/, "").trim();
    const rest = clean.substring(bMatch);
    const subMatches: { letter: string; index: number; matchLength: number }[] = [];
    const subPattern = /(?:^|[\n\r\t]|\s{2,}|\s+)(?:\*{0,2}(?:\[?([B-D])\]?|\(([B-D])\))[.)/:\-–—]\*{0,2})\s*/g;
    let sm;
    while ((sm = subPattern.exec(rest)) !== null) {
      const letter = (sm[1] || sm[2] || "").toUpperCase();
      subMatches.push({
        letter,
        index: sm.index,
        matchLength: sm[0].length,
      });
    }
    if (subMatches.length >= 1) {
      const subOptions: string[] = [textA];
      for (let i = 0; i < subMatches.length; i++) {
        const cur = subMatches[i];
        const start = cur.index + cur.matchLength;
        const end = i < subMatches.length - 1 ? subMatches[i + 1].index : rest.length;
        const val = rest.substring(start, end).trim();
        if (val) subOptions.push(val);
      }
      if (subOptions.length >= 2) {
        return subOptions;
      }
    }
  }

  return [clean];
}

// ──────────────────────────────────────────────
// Helper: Extract statements a, b, c, d (Part II - Case Sensitive LOWERCASE)
// ──────────────────────────────────────────────
export function splitRawTextIntoStatements(text: string): TrueFalseStatement[] {
  if (!text || !text.trim()) return [];
  const clean = text.replace(/\u00A0/g, " ").trim();

  // 1. Kiểm tra nếu là dạng bảng Markdown
  if (clean.includes("|")) {
    const lines = clean.split("\n");
    const tableStmts: TrueFalseStatement[] = [];
    for (const line of lines) {
      if (!line.includes("|") || /^\|?[\s\-:]+(\|[\s\-:]+)+\|?$/.test(line.trim())) continue;
      const cells = line.split("|").map((c) => c.trim()).filter((c) => c.length > 0);

      // Structure: | a | Nội dung mệnh đề | Đúng | hoặc | a) | Nội dung | [Đúng] |
      if (cells.length >= 2) {
        const firstCellMatch = cells[0].match(/^(?:(?:\*{0,2}(?:(?:Ý|Mệnh đề|Khẳng định|Mục|Câu)\s*)(?:\[?([a-dA-D])\]?|\(([a-dA-D])\)|([a-dA-D]))[.):/\-–—\s]*\*{0,2})|(?:\*{0,2}(?:\[([a-d])\]|\(([a-d])\)|([a-d])(?:\)|\.|\:|\/|\s*[-–—]))\*{0,2}))\s*$/);
        if (firstCellMatch) {
          const l = (firstCellMatch[1] || firstCellMatch[2] || firstCellMatch[3] || firstCellMatch[4] || firstCellMatch[5] || firstCellMatch[6] || "a").toLowerCase();
          const stmtText = cells[1] || "";
          const restRow = cells.slice(2).join(" ");
          const isCorrect = /\(Đúng\)|\[Đúng\]|Đúng|\(Đ\)|\bTrue\b|\[x\]|✓|\*/i.test(restRow) || /\(Đúng\)|\[Đúng\]|\(Đ\)/i.test(stmtText);
          const cleanText = stmtText.replace(/\(Đúng\)|\(Sai\)|\[Đúng\]|\[Sai\]|\(Đ\)|\(S\)|\bTrue\b|\bFalse\b/gi, "").trim();
          tableStmts.push({
            id: l,
            label: `${l})`,
            text: cleanText || `Ý ${l}`,
            correctValue: isCorrect,
          });
          continue;
        }
      }

      // Structure: | a) Nội dung mệnh đề | Đúng | hoặc | a. Nội dung | b. Nội dung |
      for (let cIdx = 0; cIdx < cells.length; cIdx++) {
        const cell = cells[cIdx];
        const sm = cell.match(/^(?:(?:\*{0,2}(?:(?:Ý|Mệnh đề|Khẳng định|Mục|Câu)\s*)(?:\[?([a-dA-D])\]?|\(([a-dA-D])\)|([a-dA-D]))[.):/\-–—\s]*\*{0,2})|(?:\*{0,2}(?:\[([a-d])\]|\(([a-d])\)|([a-d])(?:\)|\.|\:|\/|\s*[-–—]))\*{0,2}))\s*(.*)/);
        if (sm) {
          const l = (sm[1] || sm[2] || sm[3] || sm[4] || sm[5] || sm[6] || "a").toLowerCase();
          const rawVal = sm[7] || "";
          const restCells = cells.slice(cIdx + 1).join(" ");
          const isCorrect = /\(Đúng\)|\[Đúng\]|Đúng|\(Đ\)|\bTrue\b|\[x\]|✓|\*/i.test(rawVal) || /\(Đúng\)|\[Đúng\]|Đúng|\(Đ\)|\bTrue\b|\[x\]|✓|\*/i.test(restCells);
          const cleanText = rawVal.replace(/\(Đúng\)|\(Sai\)|\[Đúng\]|\[Sai\]|\(Đ\)|\(S\)|\bTrue\b|\bFalse\b/gi, "").trim();
          tableStmts.push({
            id: l,
            label: `${l})`,
            text: cleanText || `Ý ${l}`,
            correctValue: isCorrect,
          });
        }
      }
    }
    if (tableStmts.length >= 2) {
      const uniqueMap: Record<string, TrueFalseStatement> = {};
      tableStmts.forEach((st) => { uniqueMap[st.id] = st; });
      const required = ["a", "b", "c", "d"];
      const result: TrueFalseStatement[] = [];
      required.forEach((r) => {
        if (uniqueMap[r]) result.push(uniqueMap[r]);
      });
      if (result.length >= 2) return result;
    }
  }

  // 2. Protect LaTeX math formulas ($...$ or $$...$$) to prevent matching math variables like $f(a)$, $(a, b)$
  const mathTokens: string[] = [];
  let tokenized = clean.replace(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g, (m) => {
    const placeholder = `__MATH_STMT_TOK_${mathTokens.length}__`;
    mathTokens.push(m);
    return placeholder;
  });

  // 3. Position-based splitting for non-table text
  // IMPORTANT: Only match lowercase a-d markers (or explicit prefixed markers like "Ý a/A", "Mệnh đề a/A")
  // MUST NOT match raw uppercase A., B., C., D. options or math products like a.e + b
  const markerRegex = /(?:^|[\n\r\t]|\s{2,}|\s+)(?:(?:\*{0,2}(?:Ý|Mệnh đề|Khẳng định|Mục|Câu)\s*(?:\[?([a-dA-D])\]?|\(([a-dA-D])\)|([a-dA-D]))(?:\)|\.|\:|\/|\s*[-–—]|\s+)\*{0,2})|(?:\*{0,2}(?:\[([a-d])\]|\(([a-d])\)|([a-d])\)|([a-d])(?:\.|\:|\/|\s*[-–—])(?=\s))\*{0,2}))\s*/g;
  const matches: { letter: string; index: number; matchLength: number }[] = [];
  let m;

  while ((m = markerRegex.exec(tokenized)) !== null) {
    const matchIdx = m.index;
    const beforeStr = tokenized.substring(0, matchIdx);

    // Skip if inside markdown link/image
    const lastUrlOpen = beforeStr.lastIndexOf("](");
    const lastUrlClose = beforeStr.lastIndexOf(")");
    if (lastUrlOpen !== -1 && (lastUrlClose === -1 || lastUrlClose < lastUrlOpen)) continue;

    const lastAltOpen = beforeStr.lastIndexOf("![");
    const lastAltClose = beforeStr.lastIndexOf("]");
    if (lastAltOpen !== -1 && (lastAltClose === -1 || lastAltClose < lastAltOpen)) continue;

    const letter = (m[1] || m[2] || m[3] || m[4] || m[5] || m[6] || "").toLowerCase();
    if (!letter || !["a", "b", "c", "d"].includes(letter)) continue;

    // Avoid false positives: (a) preceded by function names like f(a), g(a), sin(a)
    const prevChar = beforeStr.trim().slice(-1);
    if (/^[a-zA-Z0-9_]$/.test(prevChar) && (m[0].trim().startsWith("(") || m[0].trim().startsWith("["))) {
      continue;
    }

    matches.push({
      letter,
      index: m.index,
      matchLength: m[0].length,
    });
  }

  // Filter to keep only sequential matches
  if (matches.length >= 2) {
    const firstAIdx = matches.findIndex((match) => match.letter === "a");
    const candidateMatches = firstAIdx !== -1 ? matches.slice(firstAIdx) : matches;

    const filtered: typeof matches = [];
    const seenLetters = new Set<string>();

    for (const match of candidateMatches) {
      if (!seenLetters.has(match.letter)) {
        if (filtered.length === 0 && match.letter === "a") {
          filtered.push(match);
          seenLetters.add(match.letter);
        } else if (filtered.length > 0) {
          const lastLetterCode = filtered[filtered.length - 1].letter.charCodeAt(0);
          const currentLetterCode = match.letter.charCodeAt(0);
          if (currentLetterCode > lastLetterCode) {
            filtered.push(match);
            seenLetters.add(match.letter);
          }
        }
      }
    }

    const finalMatches = filtered.length >= 2 ? filtered : matches;

    if (finalMatches.length >= 2) {
      const stmts: TrueFalseStatement[] = [];
      for (let i = 0; i < finalMatches.length; i++) {
        const current = finalMatches[i];
        const start = current.index + current.matchLength;
        const end = i < finalMatches.length - 1 ? finalMatches[i + 1].index : tokenized.length;
        let rawTextVal = tokenized.substring(start, end).trim();

        // If this is the last statement, ensure it doesn't swallow the next Question header
        if (i === finalMatches.length - 1) {
          const nextQIdx = rawTextVal.search(/(?:^|[\n\r]+)(?:\*{0,2}(?:Câu|Bài|Question)\s*\d+|\*{0,2}\d+[.)/:]|\[Câu\s*\d+\]|PHẦN\s*(?:I|II|III|1|2|3)\b)/i);
          if (nextQIdx !== -1) {
            rawTextVal = rawTextVal.substring(0, nextQIdx).trim();
          }
        }

        // Restore math tokens
        mathTokens.forEach((tok, tokIdx) => {
          rawTextVal = rawTextVal.replace(`__MATH_STMT_TOK_${tokIdx}__`, tok);
        });

        const startsWithSai = /^(?:\(Sai\)|\[Sai\]|\(S\)|Sai\b|False\b)/i.test(rawTextVal);
        const startsWithDung = /^(?:\(Đúng\)|\[Đúng\]|\(Đ\)|Đúng\b|True\b)/i.test(rawTextVal);
        const isCorrect = startsWithDung
          ? true
          : startsWithSai
          ? false
          : /\(Đúng\)|\[Đúng\]|(?::\s*|\s+-\s*|\s*->\s*)Đúng|\(Đ\)|\bTrue\b|\[x\]|✓|\*/i.test(rawTextVal);

        let cleanText = rawTextVal
          .replace(/\(Đúng\)|\(Sai\)|\[Đúng\]|\[Sai\]|\(Đ\)|\(S\)|\bTrue\b|\bFalse\b|\(Đúng\s*[\/\-–]\s*Sai\)|\(Sai\s*[\/\-–]\s*Đúng\)|\[Đúng\s*[\/\-–]\s*Sai\]|\[Sai\s*[\/\-–]\s*Đúng\]/gi, "")
          .replace(/[:\-–—]\s*(?:Đúng|Sai)\s*$/i, "")
          .replace(/^(?:Đúng|Sai)[,.:\-–—\s]+/i, "")
          .replace(/^(?:vì|do|bởi vì)\s+/i, "")
          .trim();

        stmts.push({
          id: current.letter,
          label: `${current.letter})`,
          text: cleanText || `Ý ${current.letter}`,
          correctValue: isCorrect,
        });
      }

      if (stmts.length >= 2) {
        return stmts;
      }
    }
  }

  return [];
}

// ──────────────────────────────────────────────
// Local Parser Fallback for Vietnamese Exams (3 Parts)
// ──────────────────────────────────────────────
export function fallbackParseExam(text: string, subject = "Toán học", grade = "Khối 12"): Question[] {
  const questions: Question[] = [];

  let mainBody = text;
  const answerKeyMap: Record<number, { choice?: number; tf?: Record<string, boolean>; shortAns?: string }> = {};
  const answerKeyMapByPart: Record<1 | 2 | 3, Record<number, { choice?: number; tf?: Record<string, boolean>; shortAns?: string }>> = {
    1: {},
    2: {},
    3: {},
  };

  const bottomKeyIndex = text.search(/(?:BẢNG ĐÁP ÁN|ĐÁP ÁN VÀ LỜI GIẢI|HƯỚNG DẪN CHẤM|BẢNG TRẢ LỜI|HƯỚNG DẪN GIẢI)/i);
  if (bottomKeyIndex !== -1 && bottomKeyIndex > 100) {
    mainBody = text.substring(0, bottomKeyIndex);
    const keySection = text.substring(bottomKeyIndex);

    // Split key section into parts if present
    const keyLines = keySection.split("\n");
    let keyCurrentPart: 1 | 2 | 3 = 1;

    const keyPart1Reg = /(?:PHẦN|Phần|PART|Part|DẠNG|Dạng)\s*(?:I|1)\b/i;
    const keyPart2Reg = /(?:PHẦN|Phần|PART|Part|DẠNG|Dạng)\s*(?:II|2)\b/i;
    const keyPart3Reg = /(?:PHẦN|Phần|PART|Part|DẠNG|Dạng)\s*(?:III|3)\b|\bTRẢ LỜI NGẮN\b|\bĐIỀN SỐ\b|\bĐIỀN KHUYẾT\b/i;

    for (const kl of keyLines) {
      const klt = kl.trim();
      if (!klt) continue;
      if (keyPart1Reg.test(klt)) { keyCurrentPart = 1; continue; }
      if (keyPart2Reg.test(klt)) { keyCurrentPart = 2; continue; }
      if (keyPart3Reg.test(klt)) { keyCurrentPart = 3; continue; }

      // Look for matches on this line
      const itemRegex = /(?:Câu\s*)?(\d+)[\s.:-]+([A-D]|(?:[a-d][\s.:-]+[ĐSđsTrueFalse]+[\s,;]*)+|[-+]?\d*(?:[.,]\d+)?(?:\/\d+)?|[A-Za-z0-9_+\-/^]+)/gi;
      let match;
      while ((match = itemRegex.exec(klt)) !== null) {
        const qNum = parseInt(match[1], 10);
        const rawAns = match[2].trim();

        if (/^[A-D]$/i.test(rawAns)) {
          const letterIdx = ["A", "B", "C", "D"].indexOf(rawAns.toUpperCase());
          const info = { choice: letterIdx !== -1 ? letterIdx : 0 };
          answerKeyMap[qNum] = info;
          answerKeyMapByPart[1][qNum] = info;
        } else if (/[a-d][\s.:-]+[ĐSđsTrueFalse]/i.test(rawAns)) {
          const tfObj: Record<string, boolean> = {};
          const subMatches = rawAns.matchAll(/([a-d])[\s.:-]+([ĐSđsTrueFalse])/gi);
          for (const sm of subMatches) {
            const subL = sm[1].toLowerCase();
            const isT = /[ĐđTrue]/i.test(sm[2]);
            tfObj[subL] = isT;
          }
          const info = { tf: tfObj };
          answerKeyMap[qNum] = info;
          answerKeyMapByPart[2][qNum] = info;
        } else if (/^[-+]?\d*(?:[.,]\d+)?(?:\/\d+)?$/i.test(rawAns) || keyCurrentPart === 3) {
          const info = { shortAns: rawAns.replace(",", ".") };
          answerKeyMap[qNum] = info;
          answerKeyMapByPart[3][qNum] = info;
        }
      }
    }
  }

  const lines = mainBody.split("\n");
  let currentPart: 1 | 2 | 3 = 1;
  let currentQ: any = null;
  let questionCounter = 0;

  const part1Regex = /^(?:[#*_\s-]*)(?:(?:PHẦN|Phần|PART|Part|DẠNG\s*THỨC|Dạng\s*thức|DẠNG|Dạng)\s*(?:I|1|THỨ\s*NHẤT|THỨ\s*1|MỘT)\b|\bI\s*[.:\-\)]\s*(?:TRẮC\s*NGHIỆM|CÂU\s*HỎI|PHẦN)|\bTRẮC\s*NGHIỆM\s*(?:NHIỀU\s*PHƯƠNG\s*ÁN|4\s*LỰA\s*CHỌN|4\s*PHƯƠNG\s*ÁN|NHIỀU\s*LỰA\s*CHỌN)\b|\bCÂU\s*TRẮC\s*NGHIỆM\s*NHIỀU\s*PHƯƠNG\s*ÁN\b)/i;
  const part2Regex = /^(?:[#*_\s-]*)(?:(?:PHẦN|Phần|PART|Part|DẠNG\s*THỨC|Dạng\s*thức|DẠNG|Dạng)\s*(?:II|2|THỨ\s*HAI|THỨ\s*2|HAI)\b|\bII\s*[.:\-\)]\s*(?:TRẮC\s*NGHIỆM|ĐÚNG\s*SAI|CÂU\s*HỎI|PHẦN)|\bTRẮC\s*NGHIỆM\s*ĐÚNG\s*[\/\-]?\s*SAI\b|\bCÂU\s*TRẮC\s*NGHIỆM\s*ĐÚNG\s*SAI\b)/i;
  const part3Regex = /^(?:[#*_\s-]*)(?:(?:PHẦN|Phần|PART|Part|DẠNG\s*THỨC|Dạng\s*thức|DẠNG|Dạng)\s*(?:III|3|THỨ\s*BA|THỨ\s*3|BA)\b|\bIII\s*[.:\-\)]\s*(?:TRẮC\s*NGHIỆM|TRẢ\s*LỜI|ĐIỀN|CÂU\s*HỎI|PHẦN)|\bTRẮC\s*NGHIỆM\s*TRẢ\s*LỜI\s*NGẮN\b|\bCÂU\s*(?:TRẮC\s*NGHIỆM\s*)?(?:HỎI\s*)?TRẢ\s*LỜI\s*NGẮN\b|\bTHÍ\s*SINH\s*TRẢ\s*LỜI\s*TỪ\s*CÂU\b)/i;

  const questionRegex = /^(?:[#*_\s-]*)(?:(?:Câu|Bài|Question)\s*(\d+)|\*{0,2}(\d+)[.)/:]|\[Câu\s*(\d+)\])(?:\s*[\(\[][^\)\]]+[\)\]])?[\s.:-]/i;
  // Option regex MUST match UPPERCASE A-D only (no /i flag) to prevent matching statement a) as option A
  const optionRegex = /^(?:\*{0,2}([A-D])[.)/:]\*{0,2})\s*(.*)/;
  // Sub-statement regex matches lowercase a-d or explicit "Ý a/A", "Mệnh đề a/A"
  const subStatementRegex = /^(?:\*{0,2}(?:(?:Ý|Mệnh đề|Khẳng định|Mục|Câu)\s*)?(?:\[?([a-dA-D])\]?|\(([a-dA-D])\)|([a-dA-D]))[.):/\-–—\s]*\*{0,2})\s*(.*)/i;
  const answerLineRegex = /^(?:[#*_\s-]*)(?:Đáp án|Đáp số|Kết quả|Đ\/A|Key|Answer|Điền số|ĐA|KQ|Kết luận)[\s.:]+(.*)/i;

  const finalizeCurrentQ = () => {
    if (!currentQ) return;

    // Check extracted options and statements
    const extractedOpts = currentQ.options && currentQ.options.length >= 2
      ? currentQ.options
      : splitRawTextIntoOptions(currentQ.content || "");
    const extractedStmts = currentQ.statements && currentQ.statements.length >= 2
      ? currentQ.statements
      : splitRawTextIntoStatements(currentQ.content || "");

    const hasOpts = extractedOpts.length >= 2;
    const hasStmts = extractedStmts.length >= 2;

    // 1. KHÓA CHẶT THEO TIÊU ĐỀ PHẦN VÀ DỮ LIỆU ĐẶC TRƯNG
    if (currentQ.part === 1) {
      if (!hasOpts && hasStmts && !currentQ.options?.length) {
        currentQ.part = 2;
        currentQ.questionType = "true_false";
        currentQ.statements = extractedStmts;
        currentQ.options = [];
      } else {
        currentQ.part = 1;
        currentQ.questionType = "multiple_choice";
        currentQ.statements = undefined;
        currentQ.shortAnswer = undefined;
      }
    } else if (currentQ.part === 2) {
      if (hasOpts && !hasStmts) {
        currentQ.part = 1;
        currentQ.questionType = "multiple_choice";
        currentQ.options = extractedOpts;
        currentQ.statements = undefined;
      } else {
        currentQ.part = 2;
        currentQ.questionType = "true_false";
        currentQ.options = [];
        currentQ.shortAnswer = undefined;

        // Bóc tách statements a, b, c, d nếu chưa có
        if (!currentQ.statements || currentQ.statements.length < 4) {
          if (extractedStmts.length >= 2) {
            currentQ.statements = extractedStmts;
            const firstLetterMatch = currentQ.content.search(/(?:^|[\n\r]|\s{2,})(?:(?:\*{0,2}(?:(?:Ý|Mệnh đề|Khẳng định|Mục|Câu)\s*)(?:\[?([a-dA-D])\]?|\(([a-dA-D])\)|([a-dA-D]))[.):/\-–—\s]*\*{0,2})|(?:\*{0,2}(?:\[?([a-d])\]?|\(([a-d])\)|([a-d]))[.):/\-–—\s]*\*{0,2}|\(([a-d])\)|\b([a-d])\)))\s*/);
            if (firstLetterMatch !== -1) {
              currentQ.content = currentQ.content.substring(0, firstLetterMatch).trim();
            }
          }
        }
      }
    } else if (currentQ.part === 3) {
      if (hasOpts && !hasStmts) {
        currentQ.part = 1;
        currentQ.questionType = "multiple_choice";
        currentQ.options = extractedOpts;
        currentQ.statements = undefined;
      } else if (hasStmts && !hasOpts) {
        currentQ.part = 2;
        currentQ.questionType = "true_false";
        currentQ.statements = extractedStmts;
        currentQ.options = [];
      } else {
        currentQ.part = 3;
        currentQ.questionType = "short_answer";
        currentQ.options = [];
        currentQ.statements = undefined;
      }
    } else {
      currentQ.part = 1;
      currentQ.questionType = "multiple_choice";
      currentQ.statements = undefined;
      currentQ.shortAnswer = undefined;
    }

    // 4. Structure completion per part
    if (currentQ.part === 2) {
      const requiredLetters = ["a", "b", "c", "d"];
      const existingMap: Record<string, any> = {};
      (currentQ.statements || []).forEach((s: any) => {
        existingMap[s.id] = s;
      });
      currentQ.statements = requiredLetters.map((l, lIdx) => {
        if (existingMap[l]) {
          let cleanText = (existingMap[l].text || "").trim();
          cleanText = cleanText
            .replace(
              new RegExp(
                `^(?:\\*{0,2}(?:(?:Ý|Mệnh đề|Khẳng định|Mục|Câu)\\s*)?(?:\\[?${l}\\]|\\(${l}\\)|${l}[.):/\\-–—])\\*{0,2}|\\(${l}\\)|${l}[.):/\\-–—]|Một\\)|Hai\\)|Ba\\)|Bốn\\))\\s*`,
                "i"
              ),
              ""
            )
            .replace(/^[.,;:-]\s*/, "")
            .trim();
          if (/^Khẳng định/i.test(cleanText) && currentQ.options && currentQ.options[lIdx] && !/^Phương án/i.test(currentQ.options[lIdx].trim())) {
            cleanText = currentQ.options[lIdx];
          }
          return {
            id: l,
            label: `${l})`,
            text: cleanText || `Mệnh đề ${l}`,
            correctValue: Boolean(existingMap[l].correctValue),
            explanation: existingMap[l].explanation || "",
          };
        }
        if (currentQ.options && currentQ.options[lIdx] && !/^Phương án/i.test(currentQ.options[lIdx].trim())) {
          return {
            id: l,
            label: `${l})`,
            text: currentQ.options[lIdx],
            correctValue: lIdx === (currentQ.correctIndex || 0),
            explanation: "",
          };
        }
        return {
          id: l,
          label: `${l})`,
          text: `Mệnh đề ${l}`,
          correctValue: true,
          explanation: "",
        };
      });
      currentQ.options = [];
    } else if (currentQ.part === 3) {
      currentQ.options = [];
      currentQ.statements = undefined;
      // Extract shortAnswer from content if not yet found
      if (!currentQ.shortAnswer && currentQ.content) {
        const ansMatch = currentQ.content.match(/(?:Đáp án|Đáp số|Kết quả|KQ|Key|Answer|Điền số)[\s.:]+([-+]?\d*(?:[.,]\d+)?(?:\/\d+)?|[A-Za-z0-9_+\-/^]+)/i);
        if (ansMatch) {
          currentQ.shortAnswer = ansMatch[1].replace(",", ".").trim();
          currentQ.content = currentQ.content.replace(ansMatch[0], "").trim();
        }
      }
    } else if (currentQ.part === 1) {
      const isMerged = currentQ.options.some((opt: string) =>
        /(?:[\n\r\t]|\s{2,}|\s+)(?:\*{0,2}(?:\[?[B-D]\]?|\(B\))[.)/:]\*{0,2})\s+/i.test(opt)
      );
      if (currentQ.options.length === 1 || isMerged) {
        const splitted = splitRawTextIntoOptions(currentQ.options.join(" \n "));
        if (splitted.length >= 2) {
          currentQ.options = splitted;
        }
      }
      if (currentQ.options.length < 2) {
        // Only extract options after any markdown table block to protect data tables
        const contentLines = currentQ.content.split("\n");
        let lastTableLineIdx = -1;
        for (let li = 0; li < contentLines.length; li++) {
          if (contentLines[li].trim().startsWith("|") && contentLines[li].trim().endsWith("|")) {
            lastTableLineIdx = li;
          }
        }

        if (lastTableLineIdx !== -1) {
          const preTable = contentLines.slice(0, lastTableLineIdx + 1).join("\n");
          const postTable = contentLines.slice(lastTableLineIdx + 1).join("\n");
          const splitted = splitRawTextIntoOptions(postTable);
          if (splitted.length >= 2) {
            currentQ.options = splitted;
            currentQ.content = preTable.trim();
          }
        } else {
          const optStart = currentQ.content.search(/(?:^|[\n\r]|\s{2,})(?:\*{0,2}(?:\[?A\]?|\(A\))[.)/:]\*{0,2})\s+/i);
          if (optStart !== -1) {
            const optSec = currentQ.content.substring(optStart);
            const splitted = splitRawTextIntoOptions(optSec);
            if (splitted.length >= 2) {
              currentQ.options = splitted;
              currentQ.content = currentQ.content.substring(0, optStart).trim();
            }
          }
        }
      }
      currentQ.options = currentQ.options.map((opt: string, oIdx: number) => {
        const letter = ["A", "B", "C", "D"][oIdx] || "A";
        return opt
          .replace(new RegExp(`^(?:\\*{0,2}\\[?${letter}\\]?[.)/:]\\*{0,2})\\s*`, "i"), "")
          .replace(/^(?:\*{0,2}\([A-D]\)\*{0,2})\s*/i, "")
          .trim();
      });
      const defOpts = ["Phương án A", "Phương án B", "Phương án C", "Phương án D"];
      while (currentQ.options.length < 4) {
        currentQ.options.push(defOpts[currentQ.options.length]);
      }
    }

    // Apply answer key lookup
    const keyInfo = (answerKeyMapByPart[currentQ.part as 1 | 2 | 3] && answerKeyMapByPart[currentQ.part as 1 | 2 | 3][currentQ.qNumber]) || answerKeyMap[currentQ.qNumber];
    if (keyInfo) {
      if (keyInfo.choice !== undefined && currentQ.part === 1) {
        currentQ.correctIndex = keyInfo.choice;
      }
      if (keyInfo.tf && currentQ.part === 2 && currentQ.statements) {
        currentQ.statements.forEach((st: any) => {
          if (keyInfo.tf![st.id] !== undefined) {
            st.correctValue = keyInfo.tf![st.id];
          }
        });
      }
      if (keyInfo.shortAns && currentQ.part === 3) {
        currentQ.shortAnswer = keyInfo.shortAns;
      }
    }

    questions.push(currentQ);
    currentQ = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (part1Regex.test(trimmed)) {
      finalizeCurrentQ();
      currentPart = 1;
      continue;
    }
    if (part2Regex.test(trimmed)) {
      finalizeCurrentQ();
      currentPart = 2;
      continue;
    }
    if (part3Regex.test(trimmed)) {
      finalizeCurrentQ();
      currentPart = 3;
      continue;
    }

    // Skip general document header metadata so it never triggers false questions
    if (
      /^(?:HƯỚNG\s*DẪN|THỜI\s*GIAN|MÃ\s*ĐỀ|TRANG\s*\d+|SỞ\s*GD|BỘ\s*GD|TRƯỜNG\s*THPT|ĐỀ\s*THI|KỲ\s*THI|HỌ\s*VÀ\s*TÊN|SỐ\s*BÁO\s*DANH|LƯU\s*Ý|MỤC\s*TIÊU)/i.test(trimmed)
    ) {
      continue;
    }

    const qMatch = trimmed.match(questionRegex);
    if (qMatch) {
      const isPureNumberMatch = Boolean(qMatch[2]);
      const restText = trimmed.replace(questionRegex, "").trim();

      // If matched a raw number without "Câu/Bài/Question", ensure it's not metadata
      if (isPureNumberMatch && /^(?:hướng dẫn|mục tiêu|lưu ý|thời gian|phần|trang|mã đề|chú ý|họ và tên)/i.test(restText)) {
        continue;
      }

      finalizeCurrentQ();
      questionCounter++;
      const qNum = parseInt(qMatch[1] || qMatch[2] || qMatch[3], 10) || questionCounter;

      let inferredPart: 1 | 2 | 3 = currentPart;

      const contentText = restText || trimmed;
      currentQ = {
        id: `q_parsed_${Date.now()}_${questionCounter}_${Math.random().toString(36).substring(2, 6)}`,
        qNumber: qNum,
        subject: subject || "Toán học",
        grade: grade || "Khối 12",
        level: "Thông hiểu",
        chapter: "Trích xuất từ đề thi",
        part: inferredPart,
        questionType: inferredPart === 2 ? "true_false" : inferredPart === 3 ? "short_answer" : "multiple_choice",
        content: contentText,
        options: [],
        correctIndex: 0,
        statements: inferredPart === 2 ? [] : undefined,
        shortAnswer: "",
        explanation: "",
        hasTableOrDiagram: trimmed.includes("|"),
      };
      continue;
    }

    if (currentQ) {
      if (trimmed.includes("|")) {
        currentQ.hasTableOrDiagram = true;
      }

      const ansMatch = trimmed.match(answerLineRegex);
      if (ansMatch) {
        const val = ansMatch[1].trim();
        if (/^[A-D]$/i.test(val) && currentQ.part === 1) {
          const letterIdx = ["A", "B", "C", "D"].indexOf(val.toUpperCase());
          if (letterIdx !== -1) currentQ.correctIndex = letterIdx;
        } else {
          currentQ.shortAnswer = val.replace(",", ".");
          if (currentQ.part !== 2) {
            currentQ.part = 3;
            currentQ.questionType = "short_answer";
            currentQ.options = [];
          }
        }
        continue;
      }

      if (currentQ.part === 1) {
        const splitted = splitRawTextIntoOptions(trimmed);
        if (splitted.length >= 2) {
          splitted.forEach((optText) => {
            const isCorrect = /\(Đúng\)|\[x\]|\*|✓/i.test(optText);
            const cleanOpt = optText.replace(/\(Đúng\)|\(Sai\)|\[x\]|\*|✓/gi, "").trim();
            currentQ.options.push(cleanOpt);
            if (isCorrect) {
              currentQ.correctIndex = currentQ.options.length - 1;
            }
          });
        } else {
          const optMatch = trimmed.match(optionRegex);
          if (optMatch) {
            const isCorrect = /\(Đúng\)|\[x\]|\*|✓/i.test(trimmed);
            const optText = (optMatch[2] || "").replace(/\(Đúng\)|\(Sai\)|\[x\]|\*|✓/gi, "").trim();
            currentQ.options.push(optText);
            if (isCorrect) {
              currentQ.correctIndex = currentQ.options.length - 1;
            }
          } else if (currentQ.options.length === 0) {
            currentQ.content += "\n" + trimmed;
          } else {
            currentQ.options[currentQ.options.length - 1] += " " + trimmed;
          }
        }
      } else if (currentQ.part === 2) {
        const subMatch = trimmed.match(subStatementRegex);
        if (subMatch) {
          if (!currentQ.statements) currentQ.statements = [];
          const subLetter = (subMatch[1] || subMatch[2] || subMatch[3] || "a").toLowerCase();
          const isCorrect = /\(Đúng\)|\[Đúng\]|Đúng|\(Đ\)|true/i.test(trimmed);
          const rawSubText = subMatch[4] || "";
          const subText = rawSubText
            .replace(/\(Đúng\)|\(Sai\)|\[Đúng\]|\[Sai\]|\(Đ\)|\(S\)|\bTrue\b|\bFalse\b/gi, "")
            .replace(/^[.,;:-]\s*/, "")
            .replace(/[:\-–—]\s*(?:Đúng|Sai)\s*$/i, "")
            .trim();
          currentQ.statements.push({
            id: subLetter,
            label: `${subLetter})`,
            text: subText || `Ý ${subLetter}`,
            correctValue: isCorrect,
          });
        } else if (!currentQ.statements || currentQ.statements.length === 0) {
          currentQ.content += "\n" + trimmed;
        } else {
          currentQ.statements[currentQ.statements.length - 1].text += " " + trimmed;
        }
      } else {
        // PART 3: Short Answer / Numeric Fill
        if (currentQ.shortAnswer) {
          currentQ.explanation += (currentQ.explanation ? "\n" : "") + trimmed;
        } else if (/^(?:Đáp án|Đáp số|Kết quả|KQ|ĐA|Key|Answer)?[\s.:]*([-+]?\d*(?:[.,]\d+)?(?:\/\d+)?)$/i.test(trimmed)) {
          const numMatch = trimmed.match(/([-+]?\d*(?:[.,]\d+)?(?:\/\d+)?)/);
          if (numMatch && numMatch[1]) {
            currentQ.shortAnswer = numMatch[1].replace(",", ".");
          }
        } else {
          currentQ.content += "\n" + trimmed;
        }
      }
    }
  }

  finalizeCurrentQ();
  return normalizeExamQuestions3Parts(questions);
}
function isSyntheticPlaceholder(value: unknown): boolean {
  const text = String(value || "").trim();
  return !text || /^(?:Phương án|Mệnh đề|Ý|Khẳng định(?: ý)?)\s*[A-Da-d]?$/i.test(text) || /^[.,;:-]$/.test(text);
}

/**
 * Keep text extracted directly from the source document authoritative. AI is
 * still useful for classification and answer metadata, but it must not replace
 * exact stems/options/statements with shortened text or placeholders.
 */
/**
 * Pre-processes text to automatically detect tabular data (tab-delimited or multi-space aligned)
 * and convert them into standardized Markdown tables (| col1 | col2 |).
 */
export function convertRawTextTablesToMarkdown(rawText: string): string {
  if (!rawText || !rawText.trim()) return rawText;

  const lines = rawText.split("\n");
  const processedLines: string[] = [];
  let buffer: string[] = [];
  let bufferType: "tab" | "pipe" | "spaces" | null = null;

  const flushBuffer = () => {
    if (buffer.length === 0) return;

    if (buffer.length >= 2) {
      if (bufferType === "tab") {
        const rows = buffer.map((line) => line.split("\t").map((c) => c.trim()).filter((c) => c.length > 0));
        const maxCols = Math.max(...rows.map((r) => r.length));
        if (maxCols >= 2) {
          const header = rows[0];
          while (header.length < maxCols) header.push("");
          processedLines.push("| " + header.map((c) => c || "-").join(" | ") + " |");
          processedLines.push("| " + Array(maxCols).fill(":---").join(" | ") + " |");
          for (let r = 1; r < rows.length; r++) {
            const row = rows[r];
            while (row.length < maxCols) row.push("");
            processedLines.push("| " + row.map((c) => c || "").join(" | ") + " |");
          }
          buffer = [];
          bufferType = null;
          return;
        }
      } else if (bufferType === "pipe") {
        // If pipe table doesn't have divider row, insert it
        const hasDivider = buffer.some((l) => /^\|?[\s\-:]+(\|[\s\-:]+)+\|?$/.test(l.trim()));
        if (!hasDivider && buffer.length >= 2) {
          const firstLine = buffer[0].trim();
          let cleanFirst = firstLine;
          if (cleanFirst.startsWith("|")) cleanFirst = cleanFirst.slice(1);
          if (cleanFirst.endsWith("|")) cleanFirst = cleanFirst.slice(0, -1);
          const colCount = Math.max(2, cleanFirst.split("|").length);
          const divider = "| " + Array(colCount).fill(":---").join(" | ") + " |";
          processedLines.push(buffer[0]);
          processedLines.push(divider);
          for (let r = 1; r < buffer.length; r++) {
            processedLines.push(buffer[r]);
          }
          buffer = [];
          bufferType = null;
          return;
        }
      } else if (bufferType === "spaces") {
        const rows = buffer.map((line) => line.trim().split(/\s{2,}|\t/).map((c) => c.trim()).filter(Boolean));
        const colCounts = rows.map((r) => r.length);
        const maxCols = Math.max(...colCounts);
        const minCols = Math.min(...colCounts);
        const hasNumbers = buffer.some((l) => /\d+([.,]\d+)?/.test(l));
        if (maxCols >= 2 && maxCols - minCols <= 1 && hasNumbers) {
          const header = rows[0];
          while (header.length < maxCols) header.push("");
          processedLines.push("| " + header.map((c) => c || "-").join(" | ") + " |");
          processedLines.push("| " + Array(maxCols).fill(":---").join(" | ") + " |");
          for (let r = 1; r < rows.length; r++) {
            const row = rows[r];
            while (row.length < maxCols) row.push("");
            processedLines.push("| " + row.map((c) => c || "").join(" | ") + " |");
          }
          buffer = [];
          bufferType = null;
          return;
        }
      }
    }

    processedLines.push(...buffer);
    buffer = [];
    bufferType = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    const isQHeader = /^(?:\*{0,2}(?:Câu|Bài|Question)\s*\d+|\*{0,2}\d+[.)/:]|\[Câu\s*\d+\])/i.test(trimmed);
    const isOption = /^(?:\*{0,2}[A-D][.)/:]\*{0,2})\s+/i.test(trimmed);
    const isStatement = /^(?:\*{0,2}(?:(?:Ý|Mệnh đề|Khẳng định)\s*)?(?:\[?[a-d]\]?|\([a-d]\)|[a-d])[.)/:]\*{0,2})\s+/i.test(trimmed);

    if (isQHeader || isOption || isStatement || !trimmed) {
      flushBuffer();
      processedLines.push(rawLine);
      continue;
    }

    const tabCols = trimmed.split("\t").filter((c) => c.trim().length > 0);
    if (tabCols.length >= 2) {
      if (bufferType && bufferType !== "tab") flushBuffer();
      bufferType = "tab";
      buffer.push(rawLine);
      continue;
    }

    const isPipe = (trimmed.startsWith("|") && trimmed.endsWith("|")) || (trimmed.includes("|") && trimmed.split("|").length >= 3);
    if (isPipe) {
      if (bufferType && bufferType !== "pipe") flushBuffer();
      bufferType = "pipe";
      buffer.push(rawLine);
      continue;
    }

    const spaceCols = trimmed.split(/\s{2,}/).filter(Boolean);
    const hasDataIndicator = /(?:năm|gdp|\bha\b|\bkm\b|tấn|triệu|tỉ|%|\$|\d{2,})/i.test(trimmed);
    if (spaceCols.length >= 2 && hasDataIndicator) {
      if (bufferType && bufferType !== "spaces") flushBuffer();
      bufferType = "spaces";
      buffer.push(rawLine);
      continue;
    }

    flushBuffer();
    processedLines.push(rawLine);
  }

  flushBuffer();
  return processedLines.join("\n");
}

/**
 * Intelligently merges parsed content and source content so that:
 * 1. Data tables (|...|) are 100% preserved and never degraded into prose.
 * 2. Charts, diagrams, and image tokens (![...], __IMG_TOKEN_X__) are 100% preserved.
 */
function mergeQuestionContentPreservingTablesAndDiagrams(
  parsedContent: string,
  sourceContent: string
): string {
  const p = (parsedContent || "").trim();
  const s = (sourceContent || "").trim();

  if (!p) return s;
  if (!s) return p;

  const pHasTable = p.includes("|") && p.split("\n").some((l) => l.trim().startsWith("|") && l.trim().endsWith("|"));
  const sHasTable = s.includes("|") && s.split("\n").some((l) => l.trim().startsWith("|") && l.trim().endsWith("|"));

  const imageRegex = /!\[.*?\]\([^\)]+\)|__IMG_TOKEN_\d+__/g;
  const pImages = p.match(imageRegex) || [];
  const sImages = s.match(imageRegex) || [];
  const allImages = Array.from(new Set([...sImages, ...pImages]));

  let baseContent = "";
  if (pHasTable && !sHasTable) {
    // AI successfully formatted data into a Markdown table -> PRESERVE AI TABLE!
    baseContent = p;
  } else if (sHasTable && !pHasTable) {
    // Source has original table, AI flattened it -> RESTORE SOURCE TABLE!
    baseContent = s;
  } else if (p.length >= s.length) {
    baseContent = p;
  } else {
    baseContent = s;
  }

  // Ensure ALL diagram and chart tokens are retained in the final content
  allImages.forEach((imgToken) => {
    if (!baseContent.includes(imgToken)) {
      baseContent = baseContent + "\n\n" + imgToken;
    }
  });

  return baseContent;
}

/**
 * Keep text extracted directly from the source document authoritative. AI is
 * still useful for classification and answer metadata, but it must not replace
 * exact stems/options/statements with shortened text or placeholders.
 */
export function mergeParsedQuestionsWithSource(
  parsedQuestions: Question[],
  sourceQuestions: Question[]
): Question[] {
  if (!sourceQuestions || sourceQuestions.length === 0) return parsedQuestions;
  if (!parsedQuestions || parsedQuestions.length === 0) return sourceQuestions;

  // Case 1: Exact 1-to-1 matching when question counts match
  if (parsedQuestions.length === sourceQuestions.length) {
    return parsedQuestions.map((parsedQ, idx) => {
      const sourceQ = sourceQuestions[idx];
      // Authoritative part is determined by the source question's intrinsic format
      const targetPart = (sourceQ.part as (1 | 2 | 3)) || (parsedQ.part as (1 | 2 | 3)) || 1;
      const questionType: QuestionType =
        targetPart === 2 ? "true_false" : targetPart === 3 ? "short_answer" : "multiple_choice";

      // Preserve options if Part 1
      let options: string[] = [];
      if (targetPart === 1) {
        const sourceOpts = (sourceQ.options || []).filter((o) => !isSyntheticPlaceholder(o));
        const parsedOpts = (parsedQ.options || []).filter((o) => !isSyntheticPlaceholder(o));
        options = (sourceOpts.length >= 2 ? sourceOpts : parsedOpts).slice(0, 4);
      }

      // Preserve statements if Part 2
      let statements: TrueFalseStatement[] | undefined = undefined;
      if (targetPart === 2) {
        const sourceStmts = (sourceQ.statements || []).filter((s) => s && !isSyntheticPlaceholder(s.text));
        const parsedStmts = (parsedQ.statements || []).filter((s) => s && !isSyntheticPlaceholder(s.text));

        // Use source statement text (authoritative verbatim text from Word/doc), enriched with AI correctValue
        const aiValues: Record<string, boolean> = {};
        (parsedQ.statements || []).forEach((s) => {
          if (s.id && typeof s.correctValue === "boolean") {
            aiValues[s.id.toLowerCase()] = s.correctValue;
          }
        });

        const baseStmts = sourceStmts.length >= 2 ? sourceStmts : parsedStmts;
        if (baseStmts.length >= 2) {
          statements = baseStmts.map((s) => {
            const id = (s.id || "a").toLowerCase();
            return {
              id,
              label: `${id})`,
              text: s.text,
              correctValue: aiValues[id] !== undefined ? aiValues[id] : Boolean(s.correctValue),
              explanation: s.explanation,
            };
          });
        }
      }

      // Merge content preserving tables and diagrams
      const content = mergeQuestionContentPreservingTablesAndDiagrams(
        parsedQ.content || "",
        sourceQ.content || ""
      );

      return {
        ...parsedQ,
        part: targetPart,
        questionType,
        content,
        options: targetPart === 1 ? options : [],
        statements: targetPart === 2 ? statements : undefined,
        shortAnswer: targetPart === 3 ? (parsedQ.shortAnswer || sourceQ.shortAnswer || "") : undefined,
        correctIndex: typeof parsedQ.correctIndex === "number" ? parsedQ.correctIndex : (sourceQ.correctIndex ?? 0),
        passageContent: sourceQ.passageContent || parsedQ.passageContent,
        hasTableOrDiagram: Boolean(
          parsedQ.hasTableOrDiagram ||
          sourceQ.hasTableOrDiagram ||
          content.includes("![") ||
          content.includes("__IMG_TOKEN_") ||
          content.includes("|")
        ),
        diagramUrl: parsedQ.diagramUrl || sourceQ.diagramUrl,
        needsReview: Boolean(parsedQ.needsReview),
      };
    });
  }

  // Case 2: Different question counts (e.g. AI combined or split questions)
  const sourceByPart: Record<1 | 2 | 3, Question[]> = {
    1: sourceQuestions.filter((q) => q.part === 1),
    2: sourceQuestions.filter((q) => q.part === 2),
    3: sourceQuestions.filter((q) => q.part === 3),
  };
  const partOffsets: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };

  return parsedQuestions.map((question) => {
    const part = question.part === 2 ? 2 : question.part === 3 ? 3 : 1;
    const source = sourceByPart[part][partOffsets[part]++];
    if (!source) {
      return {
        ...question,
        options: part === 1 ? (question.options || []) : [],
        statements: part === 2 ? question.statements : undefined,
        shortAnswer: part === 3 ? (question.shortAnswer || "") : undefined,
      };
    }

    const sourceContent = String(source.content || "").trim();
    const parsedContent = String(question.content || "").trim();
    const parsedOptions = (question.options || []).filter((option) => !isSyntheticPlaceholder(option));
    const sourceOptions = (source.options || []).filter((option) => !isSyntheticPlaceholder(option));
    const options = part === 1
      ? (sourceOptions.length >= 2 ? sourceOptions : parsedOptions).slice(0, 4)
      : [];

    let statements: Question["statements"] = undefined;
    if (part === 2) {
      const sourceMap = new Map(
        (source.statements || [])
          .filter((statement) => !isSyntheticPlaceholder(statement.text))
          .map((statement) => [String(statement.id || "").toLowerCase(), statement])
      );
      const parsedMap = new Map(
        (question.statements || [])
          .map((statement) => [String(statement.id || "").toLowerCase(), statement])
      );

      statements = ["a", "b", "c", "d"].flatMap((id) => {
        const sourceStatement = sourceMap.get(id);
        const parsedStatement = parsedMap.get(id);
        const parsedText = isSyntheticPlaceholder(parsedStatement?.text) ? "" : parsedStatement?.text;
        const text = String(sourceStatement?.text || parsedText || "").trim();
        if (!text || isSyntheticPlaceholder(text)) return [];

        return [{
          id,
          label: `${id})`,
          text,
          correctValue:
            typeof parsedStatement?.correctValue === "boolean"
              ? parsedStatement.correctValue
              : Boolean(sourceStatement?.correctValue),
          explanation: parsedStatement?.explanation || sourceStatement?.explanation,
        }];
      });
    }

    const content = mergeQuestionContentPreservingTablesAndDiagrams(parsedContent, sourceContent);
    return {
      ...question,
      content,
      options: part === 1 ? options : [],
      statements: part === 2 ? statements : undefined,
      shortAnswer: part === 3 ? (question.shortAnswer || source.shortAnswer || "") : undefined,
      passageContent: source.passageContent || question.passageContent,
      hasTableOrDiagram: Boolean(
        question.hasTableOrDiagram ||
          source.hasTableOrDiagram ||
          content.includes("![") ||
          content.includes("__IMG_TOKEN_") ||
          content.includes("|")
      ),
      diagramUrl: question.diagramUrl || source.diagramUrl,
    };
  });
}


// ──────────────────────────────────────────────
// 1. AI Parse Exam Text (ExamShuffler)
// ──────────────────────────────────────────────
export async function clientParseExam(payload: {
  rawText: string;
  subject?: string;
  grade?: string;
  apiKey?: string;
  model?: string;
}): Promise<{ success: boolean; data?: Question[]; error?: string; warning?: string }> {
  let { rawText, subject, grade, apiKey, model } = payload;
  if (!rawText || !rawText.trim()) {
    return { success: false, error: "Nội dung đề thi không được để trống" };
  }

  // Pre-normalize raw text tables (convert tabs or multi-space aligned data into proper Markdown tables)
  rawText = convertRawTextTablesToMarkdown(rawText);

  const key = apiKey || getStoredApiKey();
  const ai = getAI(key);

  // If no API key configured, use local regex parser immediately
  if (!ai || !key) {
    const fallback = fallbackParseExam(rawText, subject, grade);
    return {
      success: true,
      data: fallback,
      warning: "Đã phân tích bằng bộ xử lý cú pháp tiêu chuẩn (Chưa nhập API Key Gemini).",
    };
  }

  try {
    const prompt = `Bạn là chuyên gia phân tích và bóc tách đề thi Tốt nghiệp THPT chuẩn Bộ GD&ĐT Việt Nam (Chương trình GDPT 2018 mới nhất).
Hãy đọc kỹ toàn bộ văn bản đề thi dưới đây và trích xuất TOÀN BỘ CÁC CÂU HỎI VÀ ĐỦ 100% CÁC LỆNH HỎI CẢ 3 PHẦN, KHÔNG ĐƯỢC BỎ SÓT NỘI DUNG NÀO!

CẤU TRÚC ĐỀ THI 3 PHẦN GDPT 2018 BẮT BUỘC:
1. PHẦN I: Trắc nghiệm 4 lựa chọn (part: 1, questionType: "multiple_choice") -> "options": ["A...", "B...", "C...", "D..."], "correctIndex": 0..3. TUYỆT ĐỐI KHÔNG gộp phương án.
2. PHẦN II: Trắc nghiệm Đúng/Sai (part: 2, questionType: "true_false"):
   - "content": CHỈ chứa phần thân/dẫn/đề bài chung của câu hỏi (kể cả Bảng số liệu nếu có). TUYỆT ĐỐI KHÔNG để các ý a, b, c, d trong "content".
   - "statements": MỖI CÂU BẮT BUỘC ĐỦ 4 MỆNH ĐỀ a, b, c, d. Thuộc tính "text" của mỗi statement BẮT BUỘC PHẢI CHỨA 100% NGUYÊN VĂN NỘI DUNG CỦA MỆNH ĐỀ ĐÓ từ file gốc (kể cả công thức LaTeX).
   - TUYỆT ĐỐI KHÔNG ĐƯỢC để "text" rỗng hoặc ghi placeholder như "Ý a", "Khẳng định ý a"!
   - "correctValue": true nếu mệnh đề đó đúng, false nếu mệnh đề đó sai.
   - "options": BẮT BUỘC LÀ MẢNG RỖNG [].
3. PHẦN III: Trắc nghiệm Trả lời ngắn / Điền số (part: 3, questionType: "short_answer"):
   - Thí sinh tự tính toán và điền kết quả dạng số hoặc biểu thức ngắn.
   - "shortAnswer": kết quả ngắn dạng số hoặc text (nếu có trong đề bài/đáp án) hoặc để trống "" nếu chưa có đáp án.
   - "options": BẮT BUỘC LÀ MẢNG RỖNG []. TUYỆT ĐỐI KHÔNG gán phương án A, B, C, D cho câu hỏi Phần III!

QUY TẮC BẢO TOÀN CÔNG THỨC TOÁN, HÌNH ẢNH, BIỂU ĐỒ & BẢNG SỐ LIỆU (BẮT BUỘC TUÂN THỦ 100%):
4. CÔNG THỨC TOÁN HỌC, VẬT LÝ, HÓA HỌC & SINH HỌC:
   - Giữ NGUYÊN từng chuỗi LaTeX đã có, kể cả cặp dấu $...$ hoặc $$...$$; không đổi thành ảnh hoặc văn bản thường.
   - Công thức mới phải dùng LaTeX: phân số, căn, tích phân, đạo hàm, véc-tơ, chỉ số/đơn vị vật lý, công thức phân tử, điện tích ion, đồng vị và mũi tên phản ứng.
   - Bảo toàn chính xác chữ hoa/thường khoa học như f(x), pH, DNA, mRNA và tên gene/protein.
   - Ví dụ định dạng: $H_2SO_4$, $Ca^{2+}$, $\\,{}^{14}_{6}C$, $m/s^2$, $10^{-3}$, $A \\rightleftharpoons B$.
5. HÌNH VẼ, BIỂU ĐỒ, ĐỒ THỊ (CHARTS & DIAGRAMS):
   - BẢO TOÀN 100% mọi token hình ảnh Markdown dạng ![Alt](url) hoặc __IMG_TOKEN_X__ hoặc diagramUrl trong "content".
   - TUYỆT ĐỐI KHÔNG ĐƯỢC XÓA BỎ TOKEN HÌNH ẢNH, KHÔNG ĐƯỢC THAY THẾ BIỂU ĐỒ BẰNG ĐOẠN VĂN MÔ TẢ TÙY TIỆN!
   - Luôn gán "hasTableOrDiagram": true cho mọi câu hỏi có hình vẽ, biểu đồ hoặc đồ thị.
6. BẢNG SỐ LIỆU / BẢNG THỐNG KÊ / BẢNG BIẾN THIÊN / BẢNG PHÂN BỐ TẦN SỐ (BẮT BUỘC):
   - MỌI BẢNG SỐ LIỆU (nhất là môn Địa lý, Kinh tế, Sinh học, Hóa học, Toán thống kê) PHẢI ĐƯỢC GIỮ NGUYÊN 100% Ở ĐỊNH DẠNG BẢNG MARKDOWN CHUẨN:
     | Tiêu đề 1 | Tiêu đề 2 | Tiêu đề 3 |
     | :--- | :--- | :--- |
     | Dòng 1 | Dòng 2 | Dòng 3 |
   - NGHIÊM CẤM TUYỆT ĐỐI việc biến bảng số liệu thành dạng câu văn xuôi, đoạn văn hay kể lể số liệu!
   - Toàn bộ các giá trị, số liệu, năm, tỷ lệ, đơn vị phải nằm nguyên vẹn trong các ô của Bảng Markdown.
   - Bảng số liệu thuộc câu nào phải nằm đúng trong thuộc tính "content" của câu đó, và đặt "hasTableOrDiagram": true.
7. BẢO TOÀN CHÍNH XÁC SỐ LƯỢNG CÂU HỎI (QUAN TRỌNG):
   - Đề bài tải lên có bao nhiêu câu hỏi thì trích xuất ĐÚNG VÀ ĐỦ 100% bấy nhiêu câu hỏi.
   - TUYỆT ĐỐI KHÔNG tự ý bỏ bớt câu hỏi, không gộp câu hỏi độc lập lại với nhau, và KHÔNG tự ý sinh thêm câu hỏi giả lập/dư thừa!

Văn bản đề thi:
"""
${rawText.slice(0, 50000)}
"""`;

    const config = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            part: { type: Type.INTEGER },
            questionType: { type: Type.STRING },
            content: { type: Type.STRING },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            correctIndex: { type: Type.INTEGER },
            statements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  label: { type: Type.STRING },
                  text: { type: Type.STRING },
                  correctValue: { type: Type.BOOLEAN },
                  explanation: { type: Type.STRING },
                },
                required: ["id", "label", "text", "correctValue"],
              },
            },
            shortAnswer: { type: Type.STRING },
            explanation: { type: Type.STRING },
            level: { type: Type.STRING },
            groupId: { type: Type.STRING },
            groupTitle: { type: Type.STRING },
            passageContent: { type: Type.STRING },
            needsReview: { type: Type.BOOLEAN },
            hasTableOrDiagram: { type: Type.BOOLEAN },
          },
          required: ["content"],
        },
      },
    };

    const text = await generateWithFallback(prompt, key, model, config);
    const parsed = safeJsonParse<any[]>(text, []);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("Phản hồi rỗng từ AI");
    }

    const totalRaw = parsed.length;
    const formatted: Question[] = parsed.map((item: any, idx: number) => {
      let part: 1 | 2 | 3 = 1;
      const rawPartNum = Number(item.part);
      const itemContent = item.content || "";

      // 1. KHÓA CHẶT 100% THEO ĐỀ GỐC NẾU ĐÃ CÓ TIÊU ĐỀ PHẦN HOẶC QUESTION_TYPE:
      if (rawPartNum === 1 || item.questionType === "multiple_choice") {
        part = 1;
      } else if (rawPartNum === 2 || item.questionType === "true_false") {
        part = 2;
      } else if (rawPartNum === 3 || item.questionType === "short_answer") {
        part = 3;
      }
      // 2. FALLBACK THEO DỮ LIỆU ĐẶC TRƯNG & MA TRẬN BGD NẾU CHƯA CÓ PART:
      else {
        const hasRealOpts = Array.isArray(item.options) && item.options.filter((o: any) => o && !isSyntheticPlaceholder(o)).length >= 2;
        const hasRealStmts = Array.isArray(item.statements) && item.statements.filter((s: any) => s && !isSyntheticPlaceholder(s.text)).length >= 2;
        if (hasRealStmts) {
          part = 2;
        } else if (hasRealOpts) {
          part = 1;
        } else if (item.shortAnswer) {
          part = 3;
        } else if (totalRaw === 28) {
          if (idx < 18) part = 1;
          else if (idx < 22) part = 2;
          else part = 3;
        } else if (totalRaw === 22) {
          if (idx < 12) part = 1;
          else if (idx < 16) part = 2;
          else part = 3;
        } else {
          part = 1;
        }
      }

      const questionType: QuestionType = part === 2 ? "true_false" : part === 3 ? "short_answer" : "multiple_choice";
      let cleanContent = itemContent;

      let finalOptions: string[] = [];
      if (part === 1) {
        let rawOpts = Array.isArray(item.options) ? item.options.map((o: any) => String(o || "").trim()).filter(Boolean) : [];
        if (rawOpts.length === 1) {
          rawOpts = splitRawTextIntoOptions(rawOpts[0]);
        }
        finalOptions = rawOpts.map((opt: string, oIdx: number) => {
          const letter = ["A", "B", "C", "D"][oIdx] || "A";
          return opt.replace(new RegExp(`^(?:\\*{0,2}\\[?${letter}\\]?[.)/:]\\*{0,2})\\s*`, "i"), "").trim();
        });
        while (finalOptions.length < 4) {
          finalOptions.push(`Phương án ${["A", "B", "C", "D"][finalOptions.length]}`);
        }
      }

      let statements: TrueFalseStatement[] | undefined = undefined;
      if (part === 2) {
        if (Array.isArray(item.statements) && item.statements.length > 0 && !item.statements.every((s: any) => !s || isSyntheticPlaceholder(s.text))) {
          statements = item.statements;
        } else {
          const stmtsFromContent = splitRawTextIntoStatements(cleanContent);
          if (stmtsFromContent.length >= 2) {
            statements = stmtsFromContent;
            const firstLetterMatch = cleanContent.search(/(?:^|[\n\r]|\s{2,})(?:\*{0,2}(?:(?:Ý|Mệnh đề|Khẳng định|Mục|Câu)\s*)?(?:\[?a\]?|\(a\)|a)[.):/\-–—\s]*\*{0,2}|\(a\)|\ba\))\s*/i);
            if (firstLetterMatch !== -1) {
              cleanContent = cleanContent.substring(0, firstLetterMatch).trim();
            }
          }
        }
      }

      return {
        id: `parsed_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        subject: subject || "Toán học",
        grade: grade || "Khối 12",
        chapter: "Trích xuất từ file đề BGD",
        level: item.level || "Thông hiểu",
        part,
        questionType,
        content: cleanContent,
        options: part === 1 ? finalOptions.slice(0, 4) : [],
        correctIndex: typeof item.correctIndex === "number" ? item.correctIndex : 0,
        statements: part === 2 ? statements : undefined,
        shortAnswer: part === 3 ? (item.shortAnswer || "") : undefined,
        explanation: item.explanation || "",
        groupId: item.groupId || undefined,
        groupTitle: item.groupTitle && !/^(?:PHẦN|Phần|PART|Part|DẠNG|Dạng)\s*(?:I|II|III|1|2|3|THỨ\s*NHẤT|THỨ\s*HAI|THỨ\s*BA)/i.test(item.groupTitle.trim())
          ? item.groupTitle.trim()
          : undefined,
        passageContent: item.passageContent || undefined,
        needsReview: item.needsReview ?? false,
        isAiGenerated: true,
        hasTableOrDiagram: Boolean(item.hasTableOrDiagram || cleanContent.includes("|")),
      };
    });

    // --- RAWTEXT RECOVERY: For Part II questions where AI returned placeholder statements ---
    // Search the original rawText directly for a/b/c/d markers near each question's content.
    // This is the most reliable fallback since rawText contains 100% of the original document.
    const sourceMerged = mergeParsedQuestionsWithSource(formatted, fallbackParseExam(rawText, subject, grade));
    const enriched = sourceMerged.map((q) => {
      // STRICT GUARD: ONLY apply to Part 2 questions. Never touch Part 1 or Part 3!
      if (!rawText || q.part !== 2) return q;

      const hasInvalidStatements =
        !q.statements ||
        q.statements.length < 4 ||
        q.statements.some(
          (s) =>
            !s.text ||
            !s.text.trim() ||
            s.text.trim().length < 5 ||
            /^(?:Khẳng định|Ý|Mệnh đề|Phương án|Câu)\s*[a-d]?$/i.test(s.text.trim())
        );

      if (!hasInvalidStatements) return q;

      // Find where this question's content starts in rawText
      const contentSnippet = (q.content || "").trim().substring(0, 50).toLowerCase();
      let idx = -1;
      if (contentSnippet.length >= 15) {
        idx = rawText.toLowerCase().indexOf(contentSnippet.substring(0, 30));
      }
      if (idx === -1 && contentSnippet.length >= 10) {
        idx = rawText.toLowerCase().indexOf(contentSnippet.substring(0, 20));
      }

      let searchWindow = "";
      if (idx !== -1) {
        // Cut window before the NEXT question or next section to avoid swallowing next questions
        const nextQIdx = rawText.substring(idx + 10).search(/(?:^|[\n\r]+)(?:\*{0,2}(?:Câu|Bài|Question)\s*\d+|\*{0,2}\d+[.)/:]|\[Câu\s*\d+\]|PHẦN\s*(?:I|II|III|1|2|3)\b)/i);
        const winLen = nextQIdx !== -1 ? (nextQIdx + 10) : 3000;
        searchWindow = rawText.substring(idx, idx + winLen);
      } else {
        searchWindow = q.content || "";
      }

      const recovered = splitRawTextIntoStatements(searchWindow);

      if (recovered.length >= 2) {
        const aiCorrectValues: Record<string, boolean> = {};
        (q.statements || []).forEach((s: any) => {
          if (s.id && typeof s.correctValue === "boolean") {
            aiCorrectValues[s.id] = s.correctValue;
          }
        });

        const finalStmts = recovered.map((s) => ({
          ...s,
          correctValue: aiCorrectValues[s.id] !== undefined ? aiCorrectValues[s.id] : s.correctValue,
        }));

        let cleanContent = q.content;
        const firstLetterMatch = cleanContent.search(/(?:^|[\n\r]|\s{2,})(?:\*{0,2}(?:(?:Ý|Mệnh đề|Khẳng định|Mục|Câu)\s*)?(?:\[?a\]?|\(a\)|a)[.):/\-–—\s]*\*{0,2}|\(a\)|\ba\))\s*/i);
        if (firstLetterMatch !== -1) {
          cleanContent = cleanContent.substring(0, firstLetterMatch).trim();
        }

        return {
          ...q,
          part: 2 as const,
          questionType: "true_false" as const,
          content: cleanContent,
          statements: finalStmts,
          options: [],
          shortAnswer: undefined,
        };
      }
      return q;
    });

    return { success: true, data: normalizeExamQuestions3Parts(enriched) };
  } catch (err: any) {
    console.warn("AI parse encountered error, falling back to local parser:", err?.message || err);
    const fallback = fallbackParseExam(rawText, subject, grade);
    return {
      success: true,
      data: fallback,
      warning: `Hệ thống đã tự động chuyển sang bộ bóc tách cú pháp tiêu chuẩn (${fallback.length} câu trích xuất thành công).`,
    };
  }
}

// ──────────────────────────────────────────────
// 2. AI Solve Exam Questions (ExamShuffler)
// ──────────────────────────────────────────────
export async function clientSolveExam(payload: {
  questions: Question[];
  subject?: string;
  grade?: string;
  apiKey?: string;
  model?: string;
}): Promise<{ success: boolean; data?: Question[]; error?: string }> {
  const { questions, subject, grade, apiKey, model } = payload;
  if (!questions || questions.length === 0) {
    return { success: false, error: "Không có câu hỏi nào để giải" };
  }

  const key = apiKey || getStoredApiKey();
  const ai = getAI(key);
  if (!ai || !key) {
    return { success: false, error: "Vui lòng nhập Google Gemini API Key trước khi sử dụng tính năng giải tự động." };
  }

  try {
    const prompt = `Bạn là chuyên gia giải đề thi quốc gia chuẩn Bộ GD&ĐT Việt Nam (Môn: ${subject || "Toán"}, Lớp: ${grade || "Khối 12"}).
Hãy giải cẩn thận và chính xác từng câu hỏi trắc nghiệm dưới đây.
Hỗ trợ cả 3 dạng:
- Dạng 1 (Nhiều lựa chọn): Chọn correctIndex (0..3) và viết explanation chi tiết.
- Dạng 2 (Đúng/Sai): Xác định correctValue (true/false) cho từng ý a, b, c, d trong statements và giải thích.
- Dạng 3 (Trả lời ngắn): Điền kết quả chính xác vào shortAnswer và viết explanation.

Danh sách câu hỏi cần giải:
${JSON.stringify(
  questions.map((q: Question, i: number) => ({
    index: i,
    part: q.part || 1,
    questionType: q.questionType || "multiple_choice",
    content: q.content,
    options: q.options,
    statements: q.statements,
    shortAnswer: q.shortAnswer,
  })),
  null,
  2
)}`;

    const config = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            index: { type: Type.INTEGER },
            correctIndex: { type: Type.INTEGER },
            statements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  label: { type: Type.STRING },
                  correctValue: { type: Type.BOOLEAN },
                  explanation: { type: Type.STRING },
                },
                required: ["id", "correctValue"],
              },
            },
            shortAnswer: { type: Type.STRING },
            explanation: { type: Type.STRING },
          },
          required: ["index", "explanation"],
        },
      },
    };

    const text = await generateWithFallback(prompt, key, model, config);
    const solutions = safeJsonParse<any[]>(text, []);

    const updatedQuestions = questions.map((q: Question, i: number) => {
      const sol = solutions.find((s: any) => s.index === i);
      if (sol) {
        let updatedStatements = q.statements;
        if (q.part === 2 && sol.statements && Array.isArray(sol.statements)) {
          updatedStatements = (q.statements || []).map((st) => {
            const solSt = sol.statements.find((s: any) => s.id?.toLowerCase() === st.id?.toLowerCase());
            return solSt ? { ...st, correctValue: solSt.correctValue, explanation: solSt.explanation || st.explanation } : st;
          });
        }

        return {
          ...q,
          correctIndex: sol.correctIndex !== undefined ? sol.correctIndex : q.correctIndex,
          statements: updatedStatements,
          shortAnswer: sol.shortAnswer || q.shortAnswer,
          explanation: sol.explanation || q.explanation,
          needsReview: true,
          isAiGenerated: true,
        };
      }
      return q;
    });

    return { success: true, data: updatedQuestions };
  } catch (err: any) {
    return { success: false, error: err.message || "Lỗi khi giải đề thi bằng AI." };
  }
}

// ──────────────────────────────────────────────
// 3. AI Multimodal File Parser (PDF, PNG, JPG, WEBP)
// ──────────────────────────────────────────────
export async function clientParseExamFile(payload: {
  fileBase64: string;
  mimeType: string;
  fileName?: string;
  subject?: string;
  grade?: string;
  apiKey?: string;
  model?: string;
}): Promise<{ success: boolean; data?: Question[]; error?: string }> {
  const { fileBase64, mimeType, fileName, subject, grade, apiKey, model } = payload;
  const key = apiKey || getStoredApiKey();
  const ai = getAI(key);

  if (!ai || !key) {
    try {
      const resp = await fetch("/api/ai/parse-exam-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64, mimeType, fileName, subject, grade }),
      });
      if (resp.ok) {
        const resJson = await resp.json();
        if (resJson.success && resJson.data && resJson.data.length > 0) {
          return { success: true, data: normalizeExamQuestions3Parts(resJson.data) };
        }
      }
    } catch (e) {}

    return {
      success: false,
      error: "Vui lòng nhập Google Gemini API Key trong phần Cài Đặt (nút đỏ trên Header) để nhận diện ảnh đề thi.",
    };
  }

  const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, "");

  try {
    const promptText = `Bạn là chuyên gia OCR và phân tích đề thi THPT Quốc gia chuẩn Bộ GD&ĐT Việt Nam (2025/2026).
Hãy đọc và trích xuất TOÀN BỘ CÂU HỎI từ tài liệu đính kèm này (${fileName || "Đề thi"}) mà TUYỆT ĐỐI KHÔNG ĐƯỢC BỎ SÓT BẤT KỲ CÂU NÀO HOẶC MỆNH ĐỀ NÀO!

QUY TẮC PHÂN LOẠI 3 PHẦN BẮT BUỘC:
1. PHẦN I: Trắc nghiệm 4 lựa chọn A, B, C, D (CHỈ CHỌN 1 ĐÁP ÁN ĐÚNG DUY NHẤT). Mọi câu hỏi có các lựa chọn A, B, C, D đều BẮT BUỘC là PHẦN I (part: 1, questionType: "multiple_choice") -> "options": ["Phương án A...", "Phương án B...", "Phương án C...", "Phương án D..."], "correctIndex": 0..3. TUYỆT ĐỐI KHÔNG gộp phương án.
2. PHẦN II: Trắc nghiệm Đúng / Sai (Mỗi câu gồm 4 mệnh đề nhỏ a, b, c, d; học sinh chọn Đúng hoặc Sai cho TỪNG ý a, b, c, d) -> (part: 2, questionType: "true_false"):
   - "content": CHỈ chứa phần dẫn chung của câu hỏi. TUYỆT ĐỐI KHÔNG để các ý a, b, c, d trong "content".
   - "statements": BẮT BUỘC ĐỦ 4 phần tử a, b, c, d. Thuộc tính "text" BẮT BUỘC PHẢI CHỨA 100% NGUYÊN VĂN NỘI DUNG CỦA MỆNH ĐỀ ĐÓ (kể cả công thức LaTeX). TUYỆT ĐỐI KHÔNG ĐƯỢC để trống "text" hay ghi "Ý a", "Khẳng định ý a".
   - "options": BẮT BUỘC LÀ MẢNG RỖNG [].
3. PHẦN III: Trắc nghiệm Trả lời ngắn / Điền số (part: 3, questionType: "short_answer") -> "shortAnswer": kết quả số hoặc biểu thức ngắn, "options": []. TUYỆT ĐỐI KHÔNG gán phương án A, B, C, D cho câu hỏi Phần III.

QUY TẮC BẢNG SỐ LIỆU, BIỂU ĐỒ & CÔNG THỨC (BẮT BUỘC TUÂN THỦ 100%):
4. BẢNG SỐ LIỆU / BẢNG THỐNG KÊ / BẢNG BIẾN THIÊN:
   - BẮT BUỘC trích xuất 100% ở định dạng BẢNG MARKDOWN CHUẨN:
     | Tiêu đề 1 | Tiêu đề 2 | Tiêu đề 3 |
     | :--- | :--- | :--- |
     | Giá trị 1 | Giá trị 2 | Giá trị 3 |
   - NGHIÊM CẤM TUYỆT ĐỐI việc viết hoặc chuyển bảng thành dạng đoạn văn xuôi hay kể lể số liệu! Mọi số liệu phải nằm nguyên trong các ô của Bảng Markdown!
   - Đặt "hasTableOrDiagram": true cho mọi câu hỏi có bảng số liệu.
5. HÌNH VẼ / BIỂU ĐỒ / ĐỒ THỊ (CHARTS & DIAGRAMS):
   - Mọi câu hỏi có biểu đồ (biểu đồ cột, đường, tròn, miền, kết hợp), đồ thị hàm số, hình vẽ: BẮT BUỘC bảo toàn nội dung câu hỏi và gán "hasTableOrDiagram": true. Không được bỏ qua câu hỏi có biểu đồ!
6. CÔNG THỨC TOÁN/LÝ/HÓA/SINH: Dùng LaTeX kẹp trong $...$ hoặc $$...$$ cho phân số, véc-tơ, chỉ số, đơn vị, công thức phân tử, ion, đồng vị và phản ứng hóa học.
   - Không làm mất chỉ số trên/dưới; ví dụ $H_2SO_4$, $Ca^{2+}$, $\\,{}^{14}_{6}C$, $m/s^2$, $10^{-3}$.
   - Bảo toàn chính xác chữ hoa/thường như f(x), pH, DNA, mRNA, tên gene và protein.
   - Không thay công thức bằng ký tự đại diện hoặc ảnh trắng.
7. BẢO TOÀN CHÍNH XÁC SỐ LƯỢNG CÂU HỎI (QUAN TRỌNG):
   - Tài liệu/ảnh đề tải lên có bao nhiêu câu hỏi thì trích xuất ĐÚNG VÀ ĐỦ 100% bấy nhiêu câu hỏi.
   - TUYỆT ĐỐI KHÔNG tự ý bỏ bớt câu hỏi hoặc sinh thêm câu hỏi thừa!`;

    const contents = [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: mimeType || "image/png",
              data: cleanBase64,
            },
          },
          {
            text: promptText,
          },
        ],
      },
    ];

    const config = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            part: { type: Type.INTEGER },
            questionType: { type: Type.STRING },
            content: { type: Type.STRING },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            correctIndex: { type: Type.INTEGER },
            statements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  label: { type: Type.STRING },
                  text: { type: Type.STRING },
                  correctValue: { type: Type.BOOLEAN },
                  explanation: { type: Type.STRING },
                },
                required: ["id", "label", "text", "correctValue"],
              },
            },
            shortAnswer: { type: Type.STRING },
            explanation: { type: Type.STRING },
            level: { type: Type.STRING },
            hasTableOrDiagram: { type: Type.BOOLEAN },
          },
          required: ["content"],
        },
      },
    };

    const text = await generateWithFallback(contents, key, model, config);
    const parsed = safeJsonParse<any[]>(text, []);

    const isImageFile = (mimeType || "").startsWith("image/");
    const fullImageDataUri = isImageFile ? `data:${mimeType || "image/png"};base64,${cleanBase64}` : undefined;

    const formatted: Question[] = parsed.map((item: any, idx: number) => {
      // Strict Part Classification
      let part: 1 | 2 | 3 = 1;
      const rawPartNum = Number(item.part);
      let cleanContent = item.content || "";

      // 1. KHÓA CHẶT 100% THEO ĐỀ GỐC NẾU ĐÃ CÓ TIÊU ĐỀ PHẦN HOẶC QUESTION_TYPE:
      if (rawPartNum === 1 || item.questionType === "multiple_choice") {
        part = 1;
      } else if (rawPartNum === 2 || item.questionType === "true_false") {
        part = 2;
      } else if (rawPartNum === 3 || item.questionType === "short_answer") {
        part = 3;
      }
      // 2. FALLBACK THEO DỮ LIỆU ĐẶC TRƯNG & MA TRẬN BGD NẾU CHƯA CÓ PART:
      else {
        const hasRealOptions = Array.isArray(item.options) && item.options.filter((o: any) => o && !isSyntheticPlaceholder(o)).length >= 2;
        const hasStatements = Array.isArray(item.statements) && item.statements.filter((s: any) => s && !isSyntheticPlaceholder(s.text)).length >= 2;
        if (hasStatements) {
          part = 2;
        } else if (hasRealOptions) {
          part = 1;
        } else if (item.shortAnswer) {
          part = 3;
        } else {
          part = 1;
        }
      }

      const questionType: QuestionType = part === 2 ? "true_false" : part === 3 ? "short_answer" : "multiple_choice";

      let finalOptions: string[] = [];
      if (part === 1) {
        finalOptions = (item.options || []).map((o: any, oIdx: number) => {
          const letter = ["A", "B", "C", "D"][oIdx] || "A";
          return String(o || "").replace(new RegExp(`^(?:\\*{0,2}\\[?${letter}\\]?[.)/:]\\*{0,2})\\s*`, "i"), "").trim();
        });
        while (finalOptions.length < 4) {
          finalOptions.push(`Phương án ${["A", "B", "C", "D"][finalOptions.length]}`);
        }
      }

      let statements: TrueFalseStatement[] | undefined = undefined;
      if (part === 2) {
        if (Array.isArray(item.statements) && item.statements.length > 0 && !item.statements.every((s: any) => !s || isSyntheticPlaceholder(s.text))) {
          statements = item.statements;
        } else {
          const stmtsFromContent = splitRawTextIntoStatements(cleanContent);
          if (stmtsFromContent.length >= 2) {
            statements = stmtsFromContent;
            const firstLetterMatch = cleanContent.search(/(?:^|[\n\r]|\s{2,})(?:\*{0,2}(?:(?:Ý|Mệnh đề|Khẳng định|Mục|Câu)\s*)?(?:\[?a\]?|\(a\)|a)[.):/\-–—\s]*\*{0,2}|\(a\)|\ba\))\s*/i);
            if (firstLetterMatch !== -1) {
              cleanContent = cleanContent.substring(0, firstLetterMatch).trim();
            }
          }
        }
      }

      const hasDiagram = Boolean(
        item.hasTableOrDiagram ||
        /hình|đồ thị|biểu đồ|bảng|sơ đồ/i.test(item.content || "")
      );

      return {
        id: `file_parsed_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        subject: subject || "Tổng hợp",
        grade: grade || "Khối 12",
        chapter: `Trích xuất từ ${fileName || "tài liệu"}`,
        level: item.level || "Thông hiểu",
        part,
        questionType,
        content: cleanContent || item.content || "",
        options: part === 1 ? finalOptions.slice(0, 4) : [],
        correctIndex: typeof item.correctIndex === "number" ? item.correctIndex : 0,
        statements: part === 2 ? statements : undefined,
        shortAnswer: part === 3 ? (item.shortAnswer || "") : undefined,
        explanation: item.explanation || "",
        needsReview: true,
        isAiGenerated: true,
        hasTableOrDiagram: hasDiagram || Boolean(item.content?.includes("|")),
        diagramUrl: (hasDiagram && fullImageDataUri && !item.content?.includes("![") && !item.content?.includes("|")) ? fullImageDataUri : undefined,
      };
    });

    return { success: true, data: normalizeExamQuestions3Parts(formatted) };
  } catch (err: any) {
    return { success: false, error: err.message || "Lỗi khi trích xuất tài liệu đa phương tiện." };
  }
}

// ──────────────────────────────────────────────
// 4. Generate Questions for QuestionBank
// ──────────────────────────────────────────────
export async function clientGenerateQuestions(payload: {
  subject: string;
  grade: string;
  topic: string;
  count: number;
  level?: string;
  part?: number;
  apiKey?: string;
  model?: string;
}): Promise<{ success: boolean; data?: Question[]; error?: string }> {
  try {
    const { subject, grade, topic, count, level, part, apiKey, model } = payload;
    const numQuestions = Math.min(Math.max(Number(count) || 4, 1), 20);
    const requestedPart = Number(part) || 1;

    const prompt = `Bạn là chuyên gia khảo thí và soạn đề thi trắc nghiệm chuẩn của Bộ GD&ĐT Việt Nam (Chương trình GDPT 2018).
Hãy tạo ${numQuestions} câu hỏi cho:
- Môn học: ${subject || "Toán học"}
- Khối lớp: ${grade || "Khối 12"}
- Chủ đề/Chương: ${topic || "Tổng hợp kiến thức trọng tâm"}
- Mức độ nhận thức: ${level || "Thông hiểu"}
- Dạng câu hỏi: ${
      requestedPart === 2
        ? "PHẦN II: Trắc nghiệm Đúng/Sai (Mỗi câu gồm 4 mệnh đề a, b, c, d kèm correctValue true/false)"
        : requestedPart === 3
        ? "PHẦN III: Trắc nghiệm Trả lời ngắn (Câu hỏi tính toán yêu cầu điền kết quả số vào shortAnswer)"
        : "PHẦN I: Trắc nghiệm nhiều phương án lựa chọn (4 phương án A, B, C, D)"
    }

YÊU CẦU ĐỊNH DẠNG:
- Giữ định dạng Bảng Markdown (| Cột 1 | Cột 2 |) và công thức toán/hóa LaTeX ($...$).
- Trả về JSON array chuẩn theo schema.`;

    const config = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            part: { type: Type.INTEGER },
            questionType: { type: Type.STRING },
            content: { type: Type.STRING },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            correctIndex: { type: Type.INTEGER },
            statements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  label: { type: Type.STRING },
                  text: { type: Type.STRING },
                  correctValue: { type: Type.BOOLEAN },
                  explanation: { type: Type.STRING },
                },
                required: ["id", "label", "text", "correctValue"],
              },
            },
            shortAnswer: { type: Type.STRING },
            explanation: { type: Type.STRING },
            level: { type: Type.STRING },
          },
          required: ["content"],
        },
      },
    };

    const raw = await generateWithFallback(prompt, apiKey, model, config);
    const parsed = safeJsonParse<any[]>(raw, []);

    const questions: Question[] = parsed.map((item: any) => ({
      id: `ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      subject: subject || "Toán học",
      grade: grade || "Khối 12",
      chapter: topic || "Tự động tạo bởi AI",
      level: item.level || level || "Thông hiểu",
      part: item.part || requestedPart || 1,
      questionType: item.questionType || (requestedPart === 2 ? "true_false" : requestedPart === 3 ? "short_answer" : "multiple_choice"),
      content: item.content,
      options: item.options || (requestedPart === 1 ? ["A", "B", "C", "D"] : []),
      correctIndex: typeof item.correctIndex === "number" ? item.correctIndex : 0,
      statements: item.statements,
      shortAnswer: item.shortAnswer,
      explanation: item.explanation || "",
      isAiGenerated: true,
    }));

    return { success: true, data: questions };
  } catch (err: any) {
    return { success: false, error: err.message || "Lỗi tạo câu hỏi từ AI" };
  }
}

// ──────────────────────────────────────────────
// 5. Extract Rubric (AIGraderView)
// ──────────────────────────────────────────────
export async function clientExtractRubric(payload: {
  rawText?: string;
  fileData?: string;
  mimeType?: string;
  fileName?: string;
  subject?: string;
  grade?: string;
  apiKey?: string;
  model?: string;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { rawText, fileData, mimeType, fileName, subject, grade, apiKey, model } = payload;
    const prompt = `Bạn là chuyên gia khảo thí và xây dựng biểu điểm / đáp án đề thi (Rubric).
Hãy đọc tài liệu / văn bản sau đây và trích xuất TOÀN BỘ CÂU HỎI VÀ ĐÁP ÁN / BIỂU ĐIỂM CHẤM (Môn: ${subject || "Tổng hợp"}, Lớp: ${grade || "Khối 12"}).
Bao gồm:
- questionIndex: Số thứ tự câu (1, 2, 3...)
- content: Tóm tắt nội dung câu hỏi
- correctAnswer: Đáp án đúng chuẩn (Trắc nghiệm A/B/C/D, Đúng/Sai a-b-c-d, Điền số, hoặc Barem tự luận từng bước)
- points: Điểm số tối đa cho câu này
- criteria: Tiêu chí chấm chi tiết
- questionType: "multiple_choice" | "true_false" | "short_answer" | "essay"

Trả về JSON array các rubric item.`;

    let contents: any;
    if (fileData && mimeType) {
      const cleanBase64 = fileData.replace(/^data:[^;]+;base64,/, "");
      contents = [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: cleanBase64 } },
            { text: prompt },
          ],
        },
      ];
    } else {
      contents = `${prompt}\n\nVĂN BẢN ĐỀ VÀ ĐÁP ÁN:\n${rawText || ""}`;
    }

    const config = {
      responseMimeType: "application/json",
    };

    const text = await generateWithFallback(contents, apiKey, model, config);
    const items = safeJsonParse<any[]>(text, []);

    const rubric = {
      id: `rubric_${Date.now()}`,
      title: `Đáp án & Biểu điểm: ${fileName || subject || "Đề thi"}`,
      subject: subject || "Tổng hợp",
      grade: grade || "Khối 12",
      totalPoints: items.reduce((sum: number, it: any) => sum + (Number(it.points) || 1), 0),
      items: items.map((it: any, i: number) => ({
        id: `r_item_${i + 1}`,
        questionIndex: it.questionIndex || i + 1,
        content: it.content || `Câu ${i + 1}`,
        correctAnswer: String(it.correctAnswer || ""),
        points: Number(it.points) || 1,
        criteria: it.criteria || "",
        questionType: it.questionType || "multiple_choice",
      })),
      createdAt: new Date().toISOString(),
    };

    return { success: true, data: rubric };
  } catch (err: any) {
    return { success: false, error: err.message || "Lỗi trích xuất biểu điểm" };
  }
}

// ──────────────────────────────────────────────
// 6. AI Grade Paper (AIGraderView & StudentPortal)
// ──────────────────────────────────────────────
export async function clientGradePaper(payload: {
  reviewScan?: import("./paperGrading").ReviewPaperScan;
  paperFile: { data: string; mimeType: string; fileName: string };
  rubric: any;
  studentNameOverride?: string;
  studentClassOverride?: string;
  gradingStrictness?: string;
  apiKey?: string;
  model?: string;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { paperFile, rubric, studentNameOverride, studentClassOverride, gradingStrictness, apiKey, model } = payload;
    // Share one budget across OCR, fallback and optional essay assessment.
    const deadline = Date.now() + 90000;
    const result = await recognizeAndGradePaper(paperFile, rubric,
      (contents, config) => generateWithFallback(contents, apiKey, model, config, deadline), gradingStrictness, payload.reviewScan);

    const gradedPaper = {
      assessmentType: rubric.assessmentType,
      gradeWeight: rubric.gradeWeight ?? 1,
      id: `graded_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      studentName: studentNameOverride || result.studentName || "Học sinh",
      studentClass: studentClassOverride || result.studentClass || "12A",
      studentId: result.studentId || result.sbd || "",
      sbd: result.sbd || result.studentId || "",
      examCode: result.examCode || rubric?.examCode || "",
      detectedExamCode: result.examCode || rubric?.examCode || "",
      examTitle: rubric?.title || "Bài kiểm tra",
      fileName: paperFile.fileName,
      fileData: paperFile.data ? (paperFile.data.length < 2000000 ? paperFile.data : undefined) : undefined,
      fileType: paperFile.mimeType?.includes("pdf") ? "pdf" : "image",
      gradedAt: new Date().toISOString(),
      totalScore: result.totalScore,
      maxScore: result.maxScore,
      gradeClassification: result.gradeClassification,
      summaryEvaluation: result.summaryEvaluation || "Đã hoàn thành chấm điểm chi tiết bằng AI.",
      teacherNotes: result.teacherNotes || "",
      details: result.details,
      bubbleCoordinates: result.bubbleCoordinates || [],
      isReviewedByTeacher: false,
    };

    return { success: true, data: gradedPaper };
  } catch (err: any) {
    return { success: false, error: err.message || "Lỗi chấm bài thi bằng AI" };
  }
}

// ──────────────────────────────────────────────
// 7. AI Diagnostic & Remediation (AIDiagnosticCard)
// ──────────────────────────────────────────────
export async function clientDiagnosticRemediation(payload: {
  submission?: any;
  wrongQuestions: any[];
  correctQuestions: any[];
  subject: string;
  grade: string;
  apiKey?: string;
  model?: string;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { wrongQuestions, correctQuestions, subject, grade, apiKey, model } = payload;

    const wrongList = wrongQuestions.slice(0, 8).map((q, i) =>
      `${i + 1}. [Câu ${q.questionIndex}] ${q.content?.slice(0, 100)}... (Đáp án đúng: ${q.correctAnswer})`
    ).join("\n");

    const correctList = correctQuestions.slice(0, 5).map(q =>
      `- ${q.content?.slice(0, 60)}...`
    ).join("\n");

    const prompt = `Bạn là chuyên gia giáo dục Việt Nam. Phân tích kết quả bài thi môn ${subject}, ${grade}.

CÂU SAI (${wrongQuestions.length} câu):
${wrongList}

CÂU ĐÚNG (${correctQuestions.length} câu):
${correctList}

Hãy trả về JSON hợp lệ (không markdown, chỉ JSON thuần) với cấu trúc:
{
  "overallDiagnosis": "nhận xét tổng quát ngắn gọn về năng lực",
  "weakAreas": ["chủ đề yếu 1", "chủ đề yếu 2"],
  "strongAreas": ["điểm mạnh 1"],
  "remediationQuestions": [
    {
      "content": "Câu hỏi ôn tập 1",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correctIndex": 0,
      "explanation": "Giải thích ngắn"
    }
  ]
}
Tạo đúng 3 câu hỏi ôn tập trắc nghiệm phù hợp với chủ đề yếu.`;

    const raw = await generateWithFallback(prompt, apiKey, model);
    const data = safeJsonParse<any>(raw, {});
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Lỗi phân tích AI" };
  }
}

// ──────────────────────────────────────────────
// 8. Question Tutor Chat (AITutorModal)
// ──────────────────────────────────────────────
export async function clientQuestionTutor(payload: {
  question: any;
  studentAnswer: any;
  isCorrect: boolean;
  userMessage: string;
  chatHistory: { role: string; text: string }[];
  apiKey?: string;
  model?: string;
}): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    const { question, studentAnswer, isCorrect, userMessage, chatHistory, apiKey, model } = payload;

    const historyText = chatHistory.slice(-6).map(m =>
      `${m.role === "user" ? "Học sinh" : "Gia sư AI"}: ${m.text}`
    ).join("\n");

    const answerInfo = typeof studentAnswer === "number"
      ? `Học sinh chọn đáp án: ${["A", "B", "C", "D"][studentAnswer] ?? studentAnswer}`
      : `Học sinh trả lời: ${String(studentAnswer)}`;

    const prompt = `Bạn là Gia sư AI môn học cấp THPT Việt Nam, thân thiện và ngắn gọn.

CÂU HỎI: ${question?.content ?? ""}
${question?.options ? `Phương án:\nA. ${question.options[0]}\nB. ${question.options[1]}\nC. ${question.options[2]}\nD. ${question.options[3]}` : ""}
ĐÁP ÁN ĐÚNG: ${question?.correctIndex !== undefined ? ["A", "B", "C", "D"][question.correctIndex] + ". " + (question?.options?.[question.correctIndex] ?? "") : question?.shortAnswer ?? ""}
${answerInfo}
KẾT QUẢ: ${isCorrect ? "✓ Đúng" : "✗ Sai"}
${question?.explanation ? `GIẢI THÍCH GỢI Ý: ${question.explanation}` : ""}

${historyText ? `LỊCH SỬ TRƯỚC:\n${historyText}\n` : ""}
HỌC SINH HỎI: ${userMessage}

Trả lời ngắn gọn, dễ hiểu, dùng ký hiệu toán học khi cần, hướng dẫn rõ phương pháp:`;

    const text = await generateWithFallback(prompt, apiKey, model);
    return { success: true, text };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
