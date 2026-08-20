/**
 * clientAI.ts - Client-side Gemini API adapter for Vercel SPA and offline/online deployment
 * Direct @google/genai browser calls with auto fallback across models and local regex parser.
 */
import { GoogleGenAI, Type } from "@google/genai";
import { getStoredApiKey, getStoredSelectedModel } from "../components/ModelSettingsModal";
import { Question, QuestionType, TrueFalseStatement } from "../types";

export const FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.1-pro-preview",
  "gemini-2.5-flash-lite",
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
  config?: any
): Promise<string> {
  const key = apiKey || getStoredApiKey();
  const ai = getAI(key);
  if (!ai) {
    throw new Error("Vui lòng cấu hình Google Gemini API Key trong phần Cài Đặt (nút đỏ trên Header).");
  }

  const selectedModel = preferredModel || getStoredSelectedModel() || "gemini-2.5-flash";
  const modelsToTry = [
    selectedModel,
    ...FALLBACK_MODELS.filter((m) => m !== selectedModel),
  ];

  let lastError: any;
  for (const model of modelsToTry) {
    try {
      const resp = await ai.models.generateContent({
        model,
        contents,
        config,
      });
      return resp.text ?? "";
    } catch (err: any) {
      lastError = err;
      console.warn(`Model ${model} failed, trying fallback...`, err?.message || err);
      if (err?.status === 400 && (err?.message?.includes("API key not valid") || err?.message?.includes("API_KEY_INVALID"))) {
        throw new Error("API Key không hợp lệ. Vui lòng kiểm tra lại Google AI Studio API Key của bạn.");
      }
    }
  }
  throw lastError || new Error("Không thể kết nối đến Gemini AI.");
}

// ──────────────────────────────────────────────
// Helper: Extract inline options A, B, C, D
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

    const optionCells = pipeCells.filter((c) => /^(?:\*{0,2}\[?[A-D]\]?[.)/:]\*{0,2})/i.test(c));
    if (optionCells.length >= 2) {
      return optionCells.map((c) => c.replace(/^(?:\*{0,2}\[?[A-D]\]?[.)/:]\*{0,2})\s*/i, "").trim());
    }
  }

  // 2. Regex tìm vị trí các phương án A, B, C, D
  const pattern = /(?:^|[\n\r\t\s]|[.)\]\s])(?:\*{0,2}(?:\[?([A-D])\]?|\(([A-D])\)|\.?([A-D]))[.)/:]\*{0,2})\s*/gi;
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
  const bMatch = clean.search(/(?:[\n\r\t]|\s{2,}|\s+)(?:\*{0,2}(?:\[?B\]?|\(B\))[.)/:]\*{0,2})\s*/i);
  if (bMatch > 0) {
    const textA = clean.substring(0, bMatch).replace(/^(?:\*{0,2}(?:\[?A\]?|\(A\))[.)/:]\*{0,2})\s*/i, "").trim();
    const rest = clean.substring(bMatch);
    const subMatches: { letter: string; index: number; matchLength: number }[] = [];
    const subPattern = /(?:^|[\n\r\t]|\s{2,}|\s+)(?:\*{0,2}(?:\[?([B-D])\]?|\(([B-D])\))[.)/:]\*{0,2})\s*/gi;
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
// Helper: Extract statements a, b, c, d
// ──────────────────────────────────────────────
export function splitRawTextIntoStatements(text: string): TrueFalseStatement[] {
  if (!text || !text.trim()) return [];
  const clean = text.replace(/\u00A0/g, " ").trim();

  if (clean.includes("|")) {
    const lines = clean.split("\n");
    const tableStmts: TrueFalseStatement[] = [];
    for (const line of lines) {
      if (!line.includes("|") || /^\|[\s-:]+\|$/.test(line.trim())) continue;
      const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
      for (const cell of cells) {
        const sm = cell.match(/^(?:\*{0,2}(?:\[?([a-d])\]?|\(([a-d])\))[.)/:]\*{0,2})\s*(.*)/i);
        if (sm) {
          const l = (sm[1] || sm[2] || "a").toLowerCase();
          const rawVal = sm[3] || "";
          const isCorrect = /\(Đúng\)|\[Đúng\]|Đúng|\(Đ\)|true/i.test(rawVal) || /\bĐúng\b/i.test(cell);
          const cleanText = rawVal.replace(/\(Đúng\)|\(Sai\)|\[Đúng\]|\[Sai\]|\(Đ\)|\(S\)/gi, "").trim();
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
      return tableStmts;
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

  const bottomKeyIndex = text.search(/(?:BẢNG ĐÁP ÁN|ĐÁP ÁN VÀ LỜI GIẢI|HƯỚNG DẪN CHẤM|BẢNG TRẢ LỜI)/i);
  if (bottomKeyIndex !== -1 && bottomKeyIndex > 100) {
    mainBody = text.substring(0, bottomKeyIndex);
    const keySection = text.substring(bottomKeyIndex);

    const keyItemRegex = /(?:Câu\s*)?(\d+)[\s.:-]+([A-D]|(?:[a-d][\s.:-]+[ĐSđsTrueFalse]+[\s,;]*)+|[-+]?\d*[.,]?\d+)/gi;
    let match;
    while ((match = keyItemRegex.exec(keySection)) !== null) {
      const qNum = parseInt(match[1], 10);
      const rawAns = match[2].trim();

      if (/^[A-D]$/i.test(rawAns)) {
        const letterIdx = ["A", "B", "C", "D"].indexOf(rawAns.toUpperCase());
        answerKeyMap[qNum] = { choice: letterIdx !== -1 ? letterIdx : 0 };
      } else if (/[a-d][\s.:-]+[ĐSđs]/i.test(rawAns)) {
        const tfObj: Record<string, boolean> = {};
        const subMatches = rawAns.matchAll(/([a-d])[\s.:-]+([ĐSđsTrueFalse])/gi);
        for (const sm of subMatches) {
          const subL = sm[1].toLowerCase();
          const isT = /[ĐđTrue]/i.test(sm[2]);
          tfObj[subL] = isT;
        }
        answerKeyMap[qNum] = { tf: tfObj };
      } else if (/^[-+]?\d*[.,]?\d+$/.test(rawAns)) {
        answerKeyMap[qNum] = { shortAns: rawAns.replace(",", ".") };
      }
    }
  }

  const lines = mainBody.split("\n");
  let currentPart: 1 | 2 | 3 = 1;
  let currentQ: any = null;
  let questionCounter = 0;

  const part1Regex = /(?:\*{0,2}(?:PHẦN|Phần|PART|DẠNG|Dạng)\s*(?:I|1|THỨ NHẤT|MỘT)\b|\bTRẮC NGHIỆM NHIỀU PHƯƠNG ÁN\b|\bTRẮC NGHIỆM 4 LỰA CHỌN\b)/i;
  const part2Regex = /(?:\*{0,2}(?:PHẦN|Phần|PART|DẠNG|Dạng)\s*(?:II|2|THỨ HAI|HAI)\b|\bTRẮC NGHIỆM ĐÚNG\s*[\/\-]?\s*SAI\b|\bĐÚNG SAI\b)/i;
  const part3Regex = /(?:\*{0,2}(?:PHẦN|Phần|PART|DẠNG|Dạng)\s*(?:III|3|THỨ BA|BA)\b|\bTRẢ LỜI NGẮN\b|\bĐIỀN KHUYẾT\b|\bĐIỀN SỐ\b)/i;

  const questionRegex = /^(?:\*{0,2}(?:Câu|Bài|Question)\s*(\d+)|\*{0,2}(\d+)[.)/:]|\[Câu\s*(\d+)\])(?:\s*[\(\[][^\)\]]+[\)\]])?[\s.:-]/i;
  const optionRegex = /^(?:\*{0,2}([A-D])[.)/:]\*{0,2})\s*(.*)/i;
  const subStatementRegex = /^(?:\*{0,2}([a-d])[.)/:]\*{0,2})\s*(.*)/i;
  const inlineSubStatementRegex = /\b([a-d])[.)/:]\s*([^a-d\n]+)/gi;
  const answerLineRegex = /^(?:Đáp án|Kết quả|Đ\/A|Key|Answer)[\s.:]+(.*)/i;

  const finalizeCurrentQ = () => {
    if (!currentQ) return;

    if (currentQ.part === 2 && currentQ.statements.length < 4 && currentQ.content) {
      const inlineMatches = Array.from(currentQ.content.matchAll(inlineSubStatementRegex)) as RegExpMatchArray[];
      if (inlineMatches.length >= 2) {
        const foundMap: Record<string, any> = {};
        currentQ.statements.forEach((s: any) => { foundMap[s.id] = s; });
        inlineMatches.forEach((m) => {
          const l = m[1].toLowerCase();
          if (!foundMap[l]) {
            const isCorrect = /\(Đúng\)|\[Đúng\]|Đúng|\(Đ\)|true/i.test(m[2]);
            const textVal = m[2].replace(/\(Đúng\)|\(Sai\)|\[Đúng\]|\[Sai\]|\(Đ\)|\(S\)/gi, "").trim();
            currentQ.statements.push({
              id: l,
              label: `${l})`,
              text: textVal || `Ý ${l}`,
              correctValue: isCorrect,
            });
          }
        });
      }
    }

    if (currentQ.statements && currentQ.statements.length >= 2) {
      currentQ.part = 2;
      currentQ.questionType = "true_false";
      currentQ.options = [];
    } else if (currentQ.part === 3 || (!currentQ.options.length && currentQ.shortAnswer)) {
      currentQ.part = 3;
      currentQ.questionType = "short_answer";
      currentQ.options = [];
    } else if (currentQ.options.length >= 2) {
      currentQ.part = 1;
      currentQ.questionType = "multiple_choice";
    }

    if (currentQ.part === 2) {
      const requiredLetters = ["a", "b", "c", "d"];
      const existingLetters = currentQ.statements.map((s: any) => s.id);
      requiredLetters.forEach((l) => {
        if (!existingLetters.includes(l)) {
          currentQ.statements.push({
            id: l,
            label: `${l})`,
            text: `Khẳng định ý ${l}`,
            correctValue: true,
          });
        }
      });
      currentQ.statements.sort((a: any, b: any) => a.id.localeCompare(b.id));
      currentQ.options = [];
    }

    const keyInfo = answerKeyMap[currentQ.qNumber];
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

    if (currentQ.part === 3) {
      currentQ.options = [];
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

    const qMatch = trimmed.match(questionRegex);
    if (qMatch) {
      finalizeCurrentQ();
      questionCounter++;
      const qNum = parseInt(qMatch[1] || qMatch[2] || qMatch[3], 10) || questionCounter;

      let inferredPart: 1 | 2 | 3 = currentPart;
      if (qNum >= 23 && qNum <= 28) inferredPart = 3;
      else if (qNum >= 19 && qNum <= 22 && currentPart === 1) inferredPart = 2;

      const contentText = trimmed.replace(questionRegex, "").trim() || trimmed;
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
        statements: [],
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
        if (/^[A-D]$/i.test(val)) {
          const letterIdx = ["A", "B", "C", "D"].indexOf(val.toUpperCase());
          if (letterIdx !== -1) currentQ.correctIndex = letterIdx;
        } else {
          currentQ.shortAnswer = val.replace(",", ".");
          if (currentQ.part !== 2) {
            currentQ.part = 3;
            currentQ.questionType = "short_answer";
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
          const subLetter = (subMatch[1] || "a").toLowerCase();
          const isCorrect = /\(Đúng\)|\[Đúng\]|Đúng|\(Đ\)|true/i.test(trimmed);
          const subText = (subMatch[2] || "").replace(/\(Đúng\)|\(Sai\)|\[Đúng\]|\[Sai\]|\(Đ\)|\(S\)/gi, "").trim();
          currentQ.statements.push({
            id: subLetter,
            label: `${subLetter})`,
            text: subText,
            correctValue: isCorrect,
          });
        } else if (currentQ.statements.length === 0) {
          currentQ.content += "\n" + trimmed;
        } else {
          currentQ.statements[currentQ.statements.length - 1].text += " " + trimmed;
        }
      } else {
        if (currentQ.shortAnswer) {
          currentQ.explanation += " " + trimmed;
        } else if (/^[-+]?\d*[.,]?\d+$/.test(trimmed)) {
          currentQ.shortAnswer = trimmed.replace(",", ".");
        } else {
          currentQ.content += "\n" + trimmed;
        }
      }
    }
  }

  finalizeCurrentQ();
  return questions;
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
  const { rawText, subject, grade, apiKey, model } = payload;
  if (!rawText || !rawText.trim()) {
    return { success: false, error: "Nội dung đề thi không được để trống" };
  }

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
    const prompt = `Bạn là chuyên gia phân tích và bóc tách đề thi Tốt nghiệp THPT chuẩn Bộ GD&ĐT Việt Nam (Chương trình GDPT 2018).
Hãy đọc kỹ toàn bộ văn bản đề thi dưới đây và trích xuất TOÀN BỘ CÁC CÂU HỎI VÀ ĐỦ 100% CÁC LỆNH HỎI.

QUY TẮC BẢO TOÀN CÔNG THỨC TOÁN, HÌNH ẢNH & ĐỒ THỊ:
1. CÔNG THỨC TOÁN HỌC: Tất cả công thức toán, phân số, căn thức, tích phân, đạo hàm, véc-tơ PHẢI ĐƯỢC BIỂU DIỄN BẰNG LATEX kẹp giữa $...$ hoặc $$...$$.
2. HÌNH VẼ, BIỂU ĐỒ: Giữ nguyên các token hình ảnh Markdown dạng ![Alt](url) hoặc __IMG_TOKEN_X__ trong "content".
3. PHẦN I: Trắc nghiệm 4 lựa chọn (part: 1, questionType: "multiple_choice") -> "options": ["A...", "B...", "C...", "D..."], "correctIndex": 0..3.
4. PHẦN II: Trắc nghiệm Đúng/Sai (part: 2, questionType: "true_false") -> "statements": 4 mệnh đề a, b, c, d kèm correctValue (boolean).
5. PHẦN III: Trả lời ngắn / Điền số (part: 3, questionType: "short_answer") -> "shortAnswer": kết quả ngắn dạng số hoặc text.

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
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned || "[]");

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("Phản hồi rỗng từ AI");
    }

    const totalRaw = parsed.length;
    const formatted: Question[] = parsed.map((item: any, idx: number) => {
      let part: 1 | 2 | 3 = 1;
      if (item.part === 1 || item.part === 2 || item.part === 3) {
        part = item.part;
      } else if (totalRaw === 28) {
        if (idx < 18) part = 1;
        else if (idx < 22) part = 2;
        else part = 3;
      } else if (totalRaw === 22) {
        if (idx < 12) part = 1;
        else if (idx < 16) part = 2;
        else part = 3;
      } else if (item.statements && item.statements.length > 0) {
        part = 2;
      } else if (item.shortAnswer && (!item.options || item.options.length === 0)) {
        part = 3;
      }

      const questionType: QuestionType = part === 2 ? "true_false" : part === 3 ? "short_answer" : "multiple_choice";
      let cleanContent = item.content || "";

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

      let statements: TrueFalseStatement[] | undefined = item.statements;
      if (part === 2) {
        const requiredIds = ["a", "b", "c", "d"];
        const existingMap: Record<string, any> = {};
        if (Array.isArray(statements)) {
          statements.forEach((st: any) => {
            const letter = (st.id || st.label?.replace(/[^a-d]/gi, "") || "a").toLowerCase();
            existingMap[letter] = st;
          });
        }
        statements = requiredIds.map((letter) => ({
          id: letter,
          label: `${letter})`,
          text: existingMap[letter]?.text || `Khẳng định ý ${letter}`,
          correctValue: typeof existingMap[letter]?.correctValue === "boolean" ? existingMap[letter].correctValue : true,
          explanation: existingMap[letter]?.explanation || "",
        }));
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
        groupTitle: item.groupTitle || undefined,
        passageContent: item.passageContent || undefined,
        needsReview: item.needsReview ?? false,
        isAiGenerated: true,
        hasTableOrDiagram: Boolean(item.hasTableOrDiagram || cleanContent.includes("|")),
      };
    });

    return { success: true, data: formatted };
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
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const solutions = JSON.parse(cleaned || "[]");

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
    return { success: false, error: "Vui lòng cấu hình Google Gemini API Key trước khi phân tích file đa phương tiện." };
  }

  const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, "");

  try {
    const promptText = `Bạn là chuyên gia OCR và phân tích đề thi THPT Quốc gia chuẩn Bộ GD&ĐT Việt Nam (2025/2026).
Hãy đọc và trích xuất TOÀN BỘ CÂU HỎI từ tài liệu đính kèm này (${fileName || "Đề thi"}) mà TUYỆT ĐỐI KHÔNG ĐƯỢC BỎ SÓT.

QUY TẮC BẮT BUỘC:
1. PHẦN I: Trắc nghiệm 4 lựa chọn (part: 1, questionType: "multiple_choice") -> "options": ["Nội dung A...", "Nội dung B...", "Nội dung C...", "Nội dung D..."], "correctIndex": 0..3.
2. PHẦN II: Trắc nghiệm Đúng / Sai (part: 2, questionType: "true_false") -> "statements": 4 ý a, b, c, d kèm correctValue (boolean).
3. PHẦN III: Trả lời ngắn / Điền số (part: 3, questionType: "short_answer") -> "shortAnswer": kết quả ngắn.
4. BẢO TOÀN DỮ LIỆU & BẢNG BIỂU: Giữ nguyên công thức Toán/Lý/Hóa LaTeX ($...$) và bảng Markdown chuẩn.`;

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
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned || "[]");

    const formatted: Question[] = parsed.map((item: any, idx: number) => {
      const part: 1 | 2 | 3 = item.part === 2 ? 2 : item.part === 3 ? 3 : 1;
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

      return {
        id: `file_parsed_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        subject: subject || "Tổng hợp",
        grade: grade || "Khối 12",
        chapter: `Trích xuất từ ${fileName || "tài liệu"}`,
        level: item.level || "Thông hiểu",
        part,
        questionType,
        content: item.content || "",
        options: part === 1 ? finalOptions.slice(0, 4) : [],
        correctIndex: typeof item.correctIndex === "number" ? item.correctIndex : 0,
        statements: item.statements,
        shortAnswer: item.shortAnswer,
        explanation: item.explanation || "",
        needsReview: true,
        isAiGenerated: true,
        hasTableOrDiagram: Boolean(item.hasTableOrDiagram || item.content?.includes("|")),
      };
    });

    return { success: true, data: formatted };
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
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned || "[]");

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
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const items = JSON.parse(cleaned || "[]");

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
    const cleanBase64 = paperFile.data.replace(/^data:[^;]+;base64,/, "");

    const promptText = `Bạn là giám khảo chấm thi AI công tâm, chính xác.
Hãy đọc ảnh / bài làm của học sinh đính kèm, đối chiếu với Biểu điểm (Rubric) sau đây để chấm điểm chi tiết:

BIỂU ĐIỂM CHUẨN:
${JSON.stringify(rubric?.items || [], null, 2)}

Mức độ chấm: ${gradingStrictness || "standard"} (linh hoạt cho điểm từng bước theo tiến trình).

Yêu cầu:
1. Nhận diện Họ và tên học sinh, Lớp từ đầu trang bài làm (nếu có).
2. Chấm từng câu trong biểu điểm:
   - questionIndex: số thứ tự câu
   - questionContent: nội dung tóm tắt
   - studentAnswer: câu trả lời của học sinh đọc được từ bài làm
   - teacherAnswer: đáp án đúng từ rubric
   - pointsAwarded: số điểm chấm cho câu này
   - maxPoints: điểm tối đa câu này
   - status: "correct" | "partial" | "incorrect"
   - feedback: nhận xét ngắn gọn tại sao đúng/sai/thiếu ý
3. Tính totalScore (tổng điểm đạt được) và maxScore (tổng điểm tối đa).
4. Viết summaryEvaluation (nhận xét tổng thể) và teacherNotes (lời khuyên học sinh).`;

    const contents = [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: paperFile.mimeType || "image/png",
              data: cleanBase64,
            },
          },
          { text: promptText },
        ],
      },
    ];

    const config = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          studentName: { type: Type.STRING },
          studentClass: { type: Type.STRING },
          studentId: { type: Type.STRING },
          examCode: { type: Type.STRING },
          totalScore: { type: Type.NUMBER },
          maxScore: { type: Type.NUMBER },
          gradeClassification: { type: Type.STRING },
          summaryEvaluation: { type: Type.STRING },
          teacherNotes: { type: Type.STRING },
          details: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                questionIndex: { type: Type.INTEGER },
                questionContent: { type: Type.STRING },
                studentAnswer: { type: Type.STRING },
                teacherAnswer: { type: Type.STRING },
                pointsAwarded: { type: Type.NUMBER },
                maxPoints: { type: Type.NUMBER },
                status: { type: Type.STRING },
                feedback: { type: Type.STRING },
              },
              required: ["questionIndex", "pointsAwarded", "maxPoints", "status"],
            },
          },
        },
        required: ["totalScore", "maxScore", "details"],
      },
    };

    const text = await generateWithFallback(contents, apiKey, model, config);
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const result = JSON.parse(cleaned || "{}");

    const gradedPaper = {
      id: `graded_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      studentName: studentNameOverride || result.studentName || "Học sinh",
      studentClass: studentClassOverride || result.studentClass || "12A",
      studentId: result.studentId || "",
      examCode: result.examCode || "101",
      examTitle: rubric?.title || "Bài kiểm tra",
      fileName: paperFile.fileName,
      fileType: paperFile.mimeType?.includes("pdf") ? "pdf" : "image",
      gradedAt: new Date().toISOString(),
      totalScore: Number(result.totalScore) || 0,
      maxScore: Number(result.maxScore) || 10,
      gradeClassification: result.gradeClassification || "Khá",
      summaryEvaluation: result.summaryEvaluation || "Đã hoàn thành chấm bài bằng AI.",
      teacherNotes: result.teacherNotes || "",
      details: result.details || [],
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
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const data = JSON.parse(cleaned);
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

