import * as XLSX from "xlsx";
import {
  Question,
  ExamConfig,
  ExamVariant,
  StudentSubmission,
  ExamQuestionVariant,
  QuestionResultDetail,
  ExamPart,
  SubjectType,
  ExamStructureType,
  GradedPaperResult,
} from "../types";

export const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Quy định chuẩn số phần & dạng câu hỏi theo từng môn học theo Bộ GD&ĐT:
 * - 3 Phần (Toán, Vật lý, Hóa học, Sinh học, Địa lý, Tin học, Công nghệ):
 *   + Đề KHTN / Địa / Tin / CN: 28 câu (40 lệnh hỏi) -> Phần I (18 câu, 4.5đ), Phần II (4 câu Đúng/Sai, 4.0đ), Phần III (6 câu Trả lời ngắn, 1.5đ)
 *   + Đề Toán: 22 câu (34 lệnh hỏi) -> Phần I (12 câu, 3.0đ), Phần II (4 câu Đúng/Sai, 4.0đ), Phần III (6 câu Trả lời ngắn, 3.0đ)
 * - 2 Phần (Lịch sử, GDKT&PL):
 *   + 28 câu (40 lệnh hỏi) -> Phần I (24 câu, 6.0đ), Phần II (4 câu Đúng/Sai, 4.0đ)
 * - 1 Phần (Tiếng Anh / Ngoại ngữ):
 *   + 40 câu trắc nghiệm nhiều lựa chọn (10.0đ)
 */
export function getSubjectDefaultStructure(subjectName: string): {
  structureType: ExamStructureType;
  totalQuestions: number;
  totalCommands: number;
  part1Count: number;
  part2Count: number;
  part3Count: number;
  description: string;
} {
  const sub = subjectName.toLowerCase();

  if (sub.includes("tiếng anh") || sub.includes("ngoại ngữ") || sub.includes("english")) {
    return {
      structureType: "1_part",
      totalQuestions: 40,
      totalCommands: 40,
      part1Count: 40,
      part2Count: 0,
      part3Count: 0,
      description: "Môn Tiếng Anh: Full trắc nghiệm khách quan 4 lựa chọn (40 câu - 10.0 điểm).",
    };
  }

  if (sub.includes("lịch sử") || sub.includes("sử") || sub.includes("gdkt") || sub.includes("kinh tế") || sub.includes("pháp luật")) {
    return {
      structureType: "2_parts",
      totalQuestions: 28,
      totalCommands: 40,
      part1Count: 24,
      part2Count: 4,
      part3Count: 0,
      description: "Môn Lịch sử / GDKT&PL: 28 câu (40 lệnh hỏi) gồm Phần I: 24 câu nhiều lựa chọn (6.0đ) và Phần II: 4 câu Đúng/Sai (4.0đ).",
    };
  }

  if (sub.includes("toán")) {
    return {
      structureType: "3_parts",
      totalQuestions: 22,
      totalCommands: 34,
      part1Count: 12,
      part2Count: 4,
      part3Count: 6,
      description: "Môn Toán học: 22 câu (34 lệnh hỏi) gồm Phần I: 12 câu (3.0đ), Phần II: 4 câu Đúng/Sai (4.0đ), Phần III: 6 câu Trả lời ngắn (3.0đ).",
    };
  }

  // Mặc định KHTN (Lý, Hóa, Sinh, Địa, Tin, Công nghệ): 28 câu (40 lệnh hỏi)
  return {
    structureType: "3_parts",
    totalQuestions: 28,
    totalCommands: 40,
    part1Count: 18,
    part2Count: 4,
    part3Count: 6,
    description: "Chuẩn BGD (Vật lý, Hóa, Sinh, Địa, Tin, Công nghệ): 28 câu (40 lệnh hỏi) gồm Phần I (18 câu - 4.5đ), Phần II (4 câu Đúng/Sai - 4.0đ), Phần III (6 câu Trả lời ngắn - 1.5đ).",
  };
}

/**
 * QUY TẮC TÍNH ĐIỂM CHUẨN BỘ GIÁO DỤC VÀ ĐÀO TẠO CHO CÂU ĐÚNG / SAI (Phần II):
 * Mỗi câu có 4 ý a, b, c, d (tổng tối đa 1.0 điểm/câu):
 * - Đúng 1 ý: 0.10 điểm
 * - Đúng 2 ý: 0.25 điểm
 * - Đúng 3 ý: 0.50 điểm
 * - Đúng 4 ý: 1.00 điểm
 * - Đúng 0 ý: 0.00 điểm
 */
export function calculateTrueFalseScore(correctSubCount: number): number {
  switch (correctSubCount) {
    case 4:
      return 1.0;
    case 3:
      return 0.5;
    case 2:
      return 0.25;
    case 1:
      return 0.1;
    default:
      return 0.0;
  }
}

/**
 * Chuẩn hóa chuỗi trả lời ngắn (Part III):
 * Bỏ dấu cách thừa, chuyển chữ thường, thay dấu phẩy số thập phân `,` thành dấu chấm `.`
 */
export function normalizeShortAnswer(val: string | undefined | null): string {
  if (!val) return "";
  return val
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/,/g, ".");
}

/**
 * Trích xuất giá trị số học từ chuỗi (hỗ trợ số thập phân, phân số vd 1/2, -3/4, 0.5)
 */
export function evaluateMathNumeric(str: string | undefined | null): number | null {
  if (!str) return null;
  const clean = str.trim().replace(/,/g, ".").replace(/\s+/g, "");
  // Định dạng số thông thường: +5, -3.14, 0.5
  if (/^[+-]?\d+(\.\d+)?$/.test(clean)) {
    const num = parseFloat(clean);
    return isNaN(num) ? null : num;
  }
  // Định dạng phân số: 1/2, -3/4, 5/10
  if (/^[+-]?\d+(\.\d+)?\/[+-]?\d+(\.\d+)?$/.test(clean)) {
    const parts = clean.split("/");
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    if (!isNaN(num) && !isNaN(den) && den !== 0) {
      return num / den;
    }
  }
  return null;
}

/**
 * So khớp thông minh câu trả lời ngắn: kiểm tra cả chuỗi chuẩn hóa lẫn giá trị số học tương đương
 */
export function isShortAnswerEquivalent(
  studentAns: string | undefined | null,
  teacherAns: string | undefined | null,
  acceptableAnswers?: string[]
): boolean {
  if (!studentAns) return false;
  const normStudent = normalizeShortAnswer(studentAns);
  if (!normStudent) return false;

  const targets = [teacherAns, ...(acceptableAnswers || [])]
    .filter(Boolean)
    .map((a) => normalizeShortAnswer(a!));

  // 1. So khớp chuỗi chuẩn hóa trực tiếp
  if (targets.some((t) => t === normStudent)) return true;

  // 2. So khớp giá trị số học với dung sai sai số thực nghiệm 1e-4
  const studentNum = evaluateMathNumeric(studentAns);
  if (studentNum !== null) {
    for (const target of targets) {
      const targetNum = evaluateMathNumeric(target);
      if (targetNum !== null && Math.abs(studentNum - targetNum) <= 0.0001) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Tính điểm toàn diện cho bài thi theo quy chế Bộ GD&ĐT:
 */
export function gradeSubmission(
  answers: Record<number, any>,
  variant: ExamVariant,
  subject: string = "Toán học"
): {
  score: number;
  part1Score: number;
  part2Score: number;
  part3Score: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  detailedResults: Record<number, QuestionResultDetail>;
} {
  const structure = getSubjectDefaultStructure(subject);
  const detailedResults: Record<number, QuestionResultDetail> = {};

  let part1Score = 0;
  let part2Score = 0;
  let part3Score = 0;

  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;

  // Xác định điểm đơn vị từng câu Phần I và Phần III theo môn
  const isMath = subject.toLowerCase().includes("toán");
  const isEnglish = structure.structureType === "1_part";
  const isHistoryOrLaw = structure.structureType === "2_parts";

  const part1PointPerQ = isEnglish ? 0.25 : isHistoryOrLaw ? 0.25 : isMath ? 0.25 : 0.25;
  const part3PointPerQ = isMath ? 0.5 : 0.25;

  variant.questions.forEach((q) => {
    const qIndex = q.questionIndex;
    const studentAns = answers[qIndex];
    const part = q.part || 1;

    if (part === 1 || q.questionType === "multiple_choice") {
      // PHẦN I: Trắc nghiệm 4 lựa chọn A, B, C, D
      const isUnanswered = studentAns === undefined || studentAns === null || studentAns === -1;
      const isCorrect = !isUnanswered && Number(studentAns) === q.correctIndex;
      const pointsEarned = isCorrect ? part1PointPerQ : 0;

      if (isCorrect) {
        correctCount++;
        part1Score += pointsEarned;
      } else if (isUnanswered) {
        unansweredCount++;
      } else {
        wrongCount++;
      }

      detailedResults[qIndex] = {
        questionIndex: qIndex,
        part: 1,
        questionType: "multiple_choice",
        isCorrect,
        pointsEarned,
        maxPoints: part1PointPerQ,
        studentAnswerDisplay: isUnanswered ? "Chưa chọn" : LETTERS[Number(studentAns)] || "-",
        correctAnswerDisplay: LETTERS[q.correctIndex] || "A",
      };
    } else if (part === 2 || q.questionType === "true_false") {
      // PHẦN II: Trắc nghiệm Đúng / Sai (4 ý a, b, c, d)
      const stmts = q.statements || [
        { id: "a", label: "a)", text: "Ý a", correctValue: true },
        { id: "b", label: "b)", text: "Ý b", correctValue: false },
        { id: "c", label: "c)", text: "Ý c", correctValue: true },
        { id: "d", label: "d)", text: "Ý d", correctValue: false },
      ];

      const studentAnsObj = (typeof studentAns === "object" && studentAns !== null) ? studentAns : {};
      let subCorrectCount = 0;
      let hasAnyAnswered = false;

      const subResults = stmts.map((st) => {
        const studentVal = studentAnsObj[st.id] !== undefined ? Boolean(studentAnsObj[st.id]) : undefined;
        if (studentVal !== undefined) hasAnyAnswered = true;
        const isSubCorrect = studentVal === st.correctValue;
        if (isSubCorrect) subCorrectCount++;

        return {
          label: st.label,
          text: st.text,
          studentValue: studentVal,
          correctValue: st.correctValue,
          isCorrect: isSubCorrect,
        };
      });

      const qPoints = calculateTrueFalseScore(subCorrectCount);
      part2Score += qPoints;

      if (!hasAnyAnswered) {
        unansweredCount++;
      } else if (subCorrectCount === 4) {
        correctCount++;
      } else if (subCorrectCount > 0) {
        // Đúng 1 phần
        correctCount += subCorrectCount / 4;
        wrongCount += (4 - subCorrectCount) / 4;
      } else {
        wrongCount++;
      }

      const formatTfAns = (obj: any) =>
        stmts.map((s) => `${s.label.replace(")", "")}: ${obj[s.id] === undefined ? "?" : obj[s.id] ? "Đ" : "S"}`).join(" | ");

      const formatCorrectTf = () =>
        stmts.map((s) => `${s.label.replace(")", "")}: ${s.correctValue ? "Đ" : "S"}`).join(" | ");

      detailedResults[qIndex] = {
        questionIndex: qIndex,
        part: 2,
        questionType: "true_false",
        isCorrect: subCorrectCount === 4,
        pointsEarned: qPoints,
        maxPoints: 1.0,
        studentAnswerDisplay: hasAnyAnswered ? formatTfAns(studentAnsObj) : "Chưa trả lời",
        correctAnswerDisplay: formatCorrectTf(),
        trueFalseSubResults: subResults,
        correctSubCount: subCorrectCount,
      };
    } else {
      // PHẦN III: Trắc nghiệm Trả lời ngắn
      const studentStr = typeof studentAns === "string" ? studentAns : studentAns !== undefined && studentAns !== null ? String(studentAns) : "";
      const isUnanswered = !normalizeShortAnswer(studentStr);
      const isCorrect = !isUnanswered && isShortAnswerEquivalent(studentStr, q.shortAnswer, q.acceptableAnswers);
      const pointsEarned = isCorrect ? part3PointPerQ : 0;

      if (isCorrect) {
        correctCount++;
        part3Score += pointsEarned;
      } else if (isUnanswered) {
        unansweredCount++;
      } else {
        wrongCount++;
      }

      detailedResults[qIndex] = {
        questionIndex: qIndex,
        part: 3,
        questionType: "short_answer",
        isCorrect,
        pointsEarned,
        maxPoints: part3PointPerQ,
        studentAnswerDisplay: isUnanswered ? "Chưa điền" : String(studentAns),
        correctAnswerDisplay: q.shortAnswer || "Đáp án chuẩn",
      };
    }
  });

  const rawScore = part1Score + part2Score + part3Score;
  const score = Math.min(10.0, Math.max(0, Number(rawScore.toFixed(2))));

  return {
    score,
    part1Score: Number(part1Score.toFixed(2)),
    part2Score: Number(part2Score.toFixed(2)),
    part3Score: Number(part3Score.toFixed(2)),
    correctCount: Math.round(correctCount),
    wrongCount: Math.round(wrongCount),
    unansweredCount,
    detailedResults,
  };
}

/**
 * Tách nội dung trắc nghiệm trên 1 hàng hoặc văn bản bị gộp (VD: "A. ... B. ... C. ... D. ...")
 * hoặc dạng bảng Markdown (| A. ... | B. ... |) thành các phương án A, B, C, D độc lập chuẩn xác 100% nguyên gốc.
 */
export function splitRawTextIntoOptions(text: string): string[] {
  if (!text || !text.trim()) return [];
  // Chuẩn hóa ký tự khoảng trắng không ngắt (non-breaking space \u00A0)
  let clean = text.replace(/\u00A0/g, " ").trim();

  // 1. Kiểm tra nếu là dạng dòng bảng Markdown (| A. ... | B. ... | hoặc | A | B | C | D |)
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

  // 2. Pattern tìm vị trí các phương án A, B, C, D (hoặc A., B., A), B), [A], **A.**, .A., .B., etc.)
  // Đảm bảo không match nhầm bên trong markdown image link ![...](...) hoặc token __IMG_TOKEN_...__
  const pattern = /(?:^|[\n\r\t\s]|[.)\]\s])(?:\*{0,2}(?:\[?([A-D])\]?|\(([A-D])\)|\.?([A-D]))[.)/:]\*{0,2})\s*/gi;
  const matches: { letter: string; index: number; matchLength: number }[] = [];
  let m;

  while ((m = pattern.exec(clean)) !== null) {
    const matchIdx = m.index;
    const beforeStr = clean.substring(0, matchIdx);
    
    // Kiểm tra xem vị trí match có nằm trong link markdown ![alt](url) không
    const lastUrlOpen = beforeStr.lastIndexOf("](");
    const lastUrlClose = beforeStr.lastIndexOf(")");
    if (lastUrlOpen !== -1 && (lastUrlClose === -1 || lastUrlClose < lastUrlOpen)) {
      continue; // Đang nằm trong URL của ảnh
    }

    const lastAltOpen = beforeStr.lastIndexOf("![");
    const lastAltClose = beforeStr.lastIndexOf("]");
    if (lastAltOpen !== -1 && (lastAltClose === -1 || lastAltClose < lastAltOpen)) {
      continue; // Đang nằm trong alt text của ảnh
    }

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

  // 3. Trường hợp không bắt đầu bằng A. nhưng chứa B. ... C. ... D. ...
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

/**
 * Tách các khẳng định đúng sai Phần II bị gộp trên 1 dòng hoặc trong bảng hoặc trong văn bản
 */
export function splitRawTextIntoStatements(text: string): { id: string; label: string; text: string; correctValue: boolean }[] {
  if (!text || !text.trim()) return [];
  const clean = text.replace(/\u00A0/g, " ").trim();

  // 1. Kiểm tra nếu là dạng bảng Markdown
  if (clean.includes("|")) {
    const lines = clean.split("\n");
    const tableStmts: { id: string; label: string; text: string; correctValue: boolean }[] = [];
    for (const line of lines) {
      if (!line.includes("|") || /^\|?[\s\-:]+(\|[\s\-:]+)+\|?$/.test(line.trim())) continue;
      const cells = line.split("|").map((c) => c.trim()).filter((c) => c.length > 0);

      // Structure: | a | Nội dung mệnh đề | Đúng | hoặc | a) | Nội dung | [Đúng] |
      if (cells.length >= 2) {
        const firstCellMatch = cells[0].match(/^(?:\*{0,2}(?:(?:Ý|Mệnh đề|Khẳng định|Mục|Câu)\s*)?(?:\[?([a-d])\]?|\(([a-d])\)|([a-d]))[.):/\-–—\s]*\*{0,2}|\(([a-d])\)|\b([a-d])\))\s*$/i);
        if (firstCellMatch) {
          const l = (firstCellMatch[1] || firstCellMatch[2] || firstCellMatch[3] || firstCellMatch[4] || firstCellMatch[5] || "a").toLowerCase();
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
        const sm = cell.match(/^(?:\*{0,2}(?:(?:Ý|Mệnh đề|Khẳng định|Mục|Câu)\s*)?(?:\[?([a-d])\]?|\(([a-d])\)|([a-d]))[.):/\-–—\s]\*{0,2}|\(([a-d])\)|\b([a-d])\))\s*(.*)/i);
        if (sm) {
          const l = (sm[1] || sm[2] || sm[3] || sm[4] || sm[5] || "a").toLowerCase();
          const rawVal = sm[6] || "";
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
      const uniqueMap: Record<string, { id: string; label: string; text: string; correctValue: boolean }> = {};
      tableStmts.forEach((st) => { uniqueMap[st.id] = st; });
      const required = ["a", "b", "c", "d"];
      const result: { id: string; label: string; text: string; correctValue: boolean }[] = [];
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
  const markerRegex = /(?:^|[\n\r\t]|\s{2,}|\s+)(?:\*{0,2}(?:(?:Ý|Mệnh đề|Khẳng định|Mục|Câu)\s*)?(?:\[?([a-d])\]?|\(([a-d])\)|\b([a-d]))[.):/\-–—\s]\*{0,2}|\(([a-d])\)|\b([a-d])\))\s*/gi;
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

    const letter = (m[1] || m[2] || m[3] || m[4] || m[5] || "").toLowerCase();
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
      const stmts: { id: string; label: string; text: string; correctValue: boolean }[] = [];
      for (let i = 0; i < finalMatches.length; i++) {
        const current = finalMatches[i];
        const start = current.index + current.matchLength;
        const end = i < finalMatches.length - 1 ? finalMatches[i + 1].index : tokenized.length;
        let rawTextVal = tokenized.substring(start, end).trim();

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
          .replace(/\(Đúng\)|\(Sai\)|\[Đúng\]|\[Sai\]|\(Đ\)|\(S\)|\bTrue\b|\bFalse\b/gi, "")
          .replace(/[:\-–—]\s*(?:Đúng|Sai)\s*$/i, "")
          .replace(/^(?:Đúng|Sai)[,.:\-–—\s]+/i, "")
          .replace(/^(?:vì|do|bởi vì)\s+/i, "")
          .trim();

        if (cleanText) {
          cleanText = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);
        }

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

/**
 * Chuẩn hóa danh sách câu hỏi theo cấu trúc 3 dạng Bộ GD&ĐT:
 * - Phần I: Trắc nghiệm 4 lựa chọn (Đủ 4 phương án A, B, C, D, 1 lệnh hỏi/câu)
 * - Phần II: Đúng / Sai (BẮT BUỘC ĐỦ 4 ý a, b, c, d có đúng/sai, 4 lệnh hỏi/câu)
 * - Phần III: Trả lời ngắn / Điền số (1 lệnh hỏi/câu)
 * - BÓC TÁCH NGUYÊN BẢN 100% CÁC PHƯƠNG ÁN A, B, C, D VÀ CÁC MỆNH ĐỀ a, b, c, d TỪ FILE GỐC, KHÔNG ĐỂ RƠI RỚT HOẶC MẤT NỘI DUNG
 */
export function normalizeExamQuestions3Parts(rawQuestions: Question[]): Question[] {
  const total = rawQuestions.length;
  return rawQuestions.map((q, idx) => {
    let part: ExamPart = 1;
    if (q.part === 1 || q.part === 2 || q.part === 3) {
      part = q.part;
    } else if (q.options && q.options.length >= 2) {
      part = 1;
    } else if (q.statements && q.statements.length >= 2) {
      part = 2;
    } else if (q.shortAnswer && (!q.options || q.options.length === 0)) {
      part = 3;
    } else if (total === 28) {
      if (idx < 18) part = 1;
      else if (idx < 22) part = 2;
      else part = 3;
    } else if (total === 22) {
      if (idx < 12) part = 1;
      else if (idx < 16) part = 2;
      else part = 3;
    }

    const questionType = part === 2 ? "true_false" : part === 3 ? "short_answer" : "multiple_choice";
    let cleanContent = q.content || "";

    // XỬ LÝ VÀ BÓC TÁCH TOÀN BỘ PHƯƠNG ÁN PHẦN I ĐẢM BẢO 100% NGUYÊN FILE GỐC
    let finalOptions: string[] = [];
    if (part === 1) {
      let rawOpts = Array.isArray(q.options) ? q.options.map((o) => String(o || "").trim()).filter(Boolean) : [];

      // Kiểm tra nếu các phương án bị gộp vào bên trong 1 phần tử (VD: options[0] chứa "B. ... C. ... D. ...")
      const isMergedInOption = rawOpts.some((opt) =>
        /(?:[\n\r\t]|\s{2,}|\s+)(?:\*{0,2}(?:\[?[B-D]\]?|\([B-D]\))[.)/:]\*{0,2})\s+/i.test(opt)
      );

      if (rawOpts.length === 1 || isMergedInOption) {
        const combined = rawOpts.join(" \n ");
        const splitted = splitRawTextIntoOptions(combined);
        if (splitted.length >= 2) {
          rawOpts = splitted;
        }
      }

      // Kiểm tra nếu nội dung câu hỏi (content) chứa luôn các phương án A. B. C. D. ở cuối
      const isPlaceholderOnly = rawOpts.length === 0 || rawOpts.every((opt) => /^Phương án [A-D]$/i.test(opt.trim()));
      if (isPlaceholderOnly || rawOpts.length < 2) {
        const optionStartMatch = cleanContent.search(/(?:^|[\n\r]|\s{2,})(?:\*{0,2}(?:\[?A\]?|\(A\))[.)/:]\*{0,2})\s+/i);
        if (optionStartMatch !== -1) {
          const optSection = cleanContent.substring(optionStartMatch);
          const splitted = splitRawTextIntoOptions(optSection);
          if (splitted.length >= 2) {
            rawOpts = splitted;
            cleanContent = cleanContent.substring(0, optionStartMatch).trim();
          }
        }
      }

      // Làm sạch tiền tố A., B., C., D. thừa ở từng phần tử nếu còn sót
      finalOptions = rawOpts.map((opt, oIdx) => {
        const letter = ["A", "B", "C", "D", "E", "F"][oIdx];
        return opt
          .replace(new RegExp(`^(?:\\*{0,2}\\[?${letter}\\]?[.)/:]\\*{0,2})\\s*`, "i"), "")
          .replace(/^(?:\*{0,2}\([A-D]\)\*{0,2})\s*/i, "")
          .trim();
      });

      // Nếu còn thiếu thì bổ sung đủ 4 phương án
      while (finalOptions.length < 4) {
        finalOptions.push(`Phương án ${["A", "B", "C", "D"][finalOptions.length]}`);
      }
    }

    // XỬ LÝ VÀ BÓC TÁCH 4 MỆNH ĐỀ PHẦN II (ĐÚNG/SAI) BẢO ĐẢM KHÔNG BỎ SÓT NỘI DUNG
    let statements = q.statements ? [...q.statements] : undefined;
    if (part === 2) {
      // 1. Kiểm tra nếu statements rỗng, bị gộp hoặc chỉ là placeholder "Khẳng định ý a"
      const isPlaceholderStatements =
        !statements ||
        statements.length < 2 ||
        statements.every(
          (s) =>
            !s.text ||
            !s.text.trim() ||
            /^Khẳng định ý [a-d]$/i.test(s.text.trim()) ||
            /^Ý [a-d]$/i.test(s.text.trim()) ||
            /^Mệnh đề [a-d]$/i.test(s.text.trim())
        );

      const mergedStatementTexts = (statements || []).map((s) => s.text || "").join("\n");
      const hasMergedSubLetters = /(?:[\n\r\t]|\s{2,})(?:\*{0,2}(?:\[?[b-d]\]?|\([b-d]\)|[b-d])[.):/\-–—\s]\*{0,2})\s+/i.test(mergedStatementTexts);

      if (isPlaceholderStatements || hasMergedSubLetters) {
        const candidatePool = [
          cleanContent,
          mergedStatementTexts,
          q.passageContent || "",
          q.explanation || "",
          q.groupTitle || "",
        ];

        let recovered: { id: string; label: string; text: string; correctValue: boolean }[] = [];
        let sourceUsed = "";

        for (const cand of candidatePool) {
          if (cand && cand.trim()) {
            const spl = splitRawTextIntoStatements(cand);
            if (spl.length >= 2) {
              recovered = spl;
              sourceUsed = cand;
              break;
            }
          }
        }

        if (recovered.length >= 2) {
          statements = recovered;
          if (sourceUsed === cleanContent) {
            const firstLetterMatch = cleanContent.search(/(?:^|[\n\r]|\s{2,})(?:\*{0,2}(?:(?:Ý|Mệnh đề|Khẳng định|Mục|Câu)\s*)?(?:\[?a\]?|\(a\)|a)[.):/\-–—\s]*\*{0,2}|\(a\)|\ba\))\s*/i);
            if (firstLetterMatch !== -1) {
              cleanContent = cleanContent.substring(0, firstLetterMatch).trim();
            }
          }
        }
      }

      // 2. Nếu statements đã có một số phần tử nhưng bị thiếu text hoặc là placeholder, hãy bổ sung
      if (statements && statements.length > 0) {
        const hasSomeEmptyOrPlaceholder = statements.some(
          (s) =>
            !s.text ||
            !s.text.trim() ||
            /^Khẳng định ý [a-d]$/i.test(s.text.trim()) ||
            /^Ý [a-d]$/i.test(s.text.trim()) ||
            /^Mệnh đề [a-d]$/i.test(s.text.trim())
        );
        if (hasSomeEmptyOrPlaceholder) {
          const fromContent = splitRawTextIntoStatements(cleanContent);
          const fromMerged = splitRawTextIntoStatements((statements || []).map((s) => s.text || "").join("\n"));
          const fromPassage = q.passageContent ? splitRawTextIntoStatements(q.passageContent) : [];
          const fromExplanation = q.explanation ? splitRawTextIntoStatements(q.explanation) : [];
          const recoveredList = fromContent.length >= 2 ? fromContent : fromMerged.length >= 2 ? fromMerged : fromPassage.length >= 2 ? fromPassage : fromExplanation;

          if (recoveredList.length >= 2) {
            const contentMap: Record<string, { text: string; correctValue?: boolean }> = {};
            recoveredList.forEach((st) => { contentMap[st.id] = { text: st.text, correctValue: st.correctValue }; });
            statements = statements.map((st) => {
              const isPl =
                !st.text ||
                !st.text.trim() ||
                /^Khẳng định ý [a-d]$/i.test(st.text.trim()) ||
                /^Ý [a-d]$/i.test(st.text.trim()) ||
                /^Mệnh đề [a-d]$/i.test(st.text.trim());
              if (isPl && contentMap[st.id]) {
                return {
                  ...st,
                  text: contentMap[st.id].text,
                  correctValue: contentMap[st.id].correctValue !== undefined ? contentMap[st.id].correctValue : st.correctValue,
                };
              }
              return st;
            });
            if (recoveredList === fromContent) {
              const firstLetterMatch = cleanContent.search(/(?:^|[\n\r]|\s{2,})(?:\*{0,2}(?:(?:Ý|Mệnh đề|Khẳng định|Mục|Câu)\s*)?(?:\[?a\]?|\(a\)|a)[.):/\-–—\s]*\*{0,2}|\(a\)|\ba\))\s*/i);
              if (firstLetterMatch !== -1) {
                cleanContent = cleanContent.substring(0, firstLetterMatch).trim();
              }
            }
          }
        }
      }

      const requiredLetters = ["a", "b", "c", "d"];
      const existingMap: Record<string, any> = {};
      (statements || []).forEach((st) => {
        const key = (st.id || st.label?.replace(/[^a-d]/gi, "") || "a").toLowerCase();
        existingMap[key] = st;
      });

      statements = requiredLetters.map((l) => {
        if (existingMap[l]) {
          let cleanText = (existingMap[l].text || "").trim();
          // Làm sạch tiền tố redundant a), a., Ý a:, (a) ở đầu nội dung nếu bị thừa
          cleanText = cleanText.replace(new RegExp(`^(?:\\*{0,2}(?:(?:Ý|Mệnh đề|Khẳng định|Mục|Câu)\\s*)?(?:\\[?${l}\\]?|\\(${l}\\)|${l})[.):/\\-–—\\s]*\\*{0,2}|\\(${l}\\)|\\b${l}\\))\\s*`, "i"), "").trim();
          return {
            id: l,
            label: `${l})`,
            text: cleanText || `Ý ${l}`,
            correctValue: Boolean(existingMap[l].correctValue),
            explanation: existingMap[l].explanation || "",
          };
        }
        return {
          id: l,
          label: `${l})`,
          text: `Khẳng định ý ${l}`,
          correctValue: true,
          explanation: "",
        };
      });
    }

    // XỬ LÝ PHẦN III (TRẢ LỜI NGẮN / ĐIỀN SỐ)
    let finalShortAnswer = q.shortAnswer || "";
    if (part === 3 && !finalShortAnswer) {
      const ansMatch = cleanContent.match(/(?:Đáp án|Kết quả|Key|Answer)[\s.:]+([-+]?\d*[.,]?\d+|[A-Za-z0-9_+\-/]+)/i);
      if (ansMatch) {
        finalShortAnswer = ansMatch[1].replace(",", ".").trim();
        cleanContent = cleanContent.replace(ansMatch[0], "").trim();
      }
    }

    return {
      ...q,
      content: cleanContent,
      part,
      questionType,
      options: part === 1 ? finalOptions.slice(0, 4) : [],
      statements: part === 2 ? statements : undefined,
      shortAnswer: part === 3 ? (q.shortAnswer || finalShortAnswer || "") : undefined,
    };
  });
}

/**
 * Trộn đề chuẩn Bộ GD&ĐT:
 * - TUÂN THỦ NGUYÊN TẮC 3 DẠNG RIÊNG BIỆT:
 *   + Các câu hỏi trong cùng 1 dạng chỉ trộn TRONG NỘI BỘ DẠNG ĐÓ.
 *   + TUYỆT ĐỐI KHÔNG TRỘN DẠNG 1 SANG DẠNG II VÀ SANG DẠNG III VÀ NGƯỢC LẠI!
 * - Trong Phần I: Trộn thứ tự câu và xáo đáp án A, B, C, D (nếu không phải ngữ liệu gộp).
 * - Trong Phần II: Trộn thứ tự các câu trong Phần II, giữ nguyên cấu trúc Đúng/Sai của 4 ý a, b, c, d.
 * - Trong Phần III: Trộn thứ tự câu hỏi trong Phần III.
 * - Đối với nhóm câu hỏi ngữ liệu gộp (Passage/Table): Giữ nguyên vị trí nhóm, chỉ trộn câu trong nhóm.
 */
export function generateVariantsFromQuestions(
  questions: Question[],
  config: ExamConfig
): ExamVariant[] {
  // Chuẩn hóa và bảo đảm cấu trúc 3 phần
  const normalizedQuestions = normalizeExamQuestions3Parts(questions);

  // Tách biệt tuyệt đối 3 phần
  const part1Questions = normalizedQuestions.filter((q) => q.part === 1);
  const part2Questions = normalizedQuestions.filter((q) => q.part === 2);
  const part3Questions = normalizedQuestions.filter((q) => q.part === 3);

  // Helper gán partTitle và partQuestionIndex
  const attachPartMetadata = (q: Question, globalIndex: number, partIndex: number): ExamQuestionVariant => {
    let partTitle = "";
    if (q.part === 1) {
      partTitle = "PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn (Thí sinh chỉ chọn một phương án)";
    } else if (q.part === 2) {
      partTitle = "PHẦN II. Câu trắc nghiệm đúng sai (Mỗi câu gồm 4 ý a, b, c, d; thí sinh chọn đúng hoặc sai)";
    } else {
      partTitle = "PHẦN III. Câu trắc nghiệm trả lời ngắn (Thí sinh điền kết quả)";
    }

    return {
      originalId: q.id,
      questionIndex: globalIndex,
      partQuestionIndex: partIndex,
      partTitle,
      part: q.part,
      questionType: q.questionType,
      content: q.content,
      options: [...(q.options || [])],
      correctIndex: q.correctIndex ?? 0,
      originalCorrectIndex: q.correctIndex ?? 0,
      statements: q.statements ? JSON.parse(JSON.stringify(q.statements)) : undefined,
      shortAnswer: q.shortAnswer,
      acceptableAnswers: q.acceptableAnswers ? [...q.acceptableAnswers] : undefined,
      points: q.points,
      level: q.level,
      subject: q.subject,
      explanation: q.explanation,
      groupId: q.groupId,
      groupTitle: q.groupTitle,
      passageContent: q.passageContent,
      hasTableOrDiagram: q.hasTableOrDiagram,
      diagramUrl: q.diagramUrl,
    };
  };

  // If user chose to KEEP ORIGINAL (Giữ nguyên đề gốc không trộn):
  if (config.isOriginalKept) {
    const originalCode = config.originalExamCode?.trim() || "101";
    let globalIdx = 0;

    const mappedP1 = part1Questions.map((q, pIdx) => attachPartMetadata(q, ++globalIdx, pIdx + 1));
    const mappedP2 = part2Questions.map((q, pIdx) => attachPartMetadata(q, ++globalIdx, pIdx + 1));
    const mappedP3 = part3Questions.map((q, pIdx) => attachPartMetadata(q, ++globalIdx, pIdx + 1));

    const allMapped = [...mappedP1, ...mappedP2, ...mappedP3];

    const answerKey: Record<number, string> = {};
    allMapped.forEach((q) => {
      if (q.part === 1 || q.questionType === "multiple_choice") {
        answerKey[q.questionIndex] = LETTERS[q.correctIndex] || "A";
      } else if (q.part === 2 || q.questionType === "true_false") {
        const tf = (q.statements || []).map((s) => `${s.label.replace(")", "")}:${s.correctValue ? "Đ" : "S"}`).join(",");
        answerKey[q.questionIndex] = tf || "a:Đ,b:S,c:Đ,d:S";
      } else {
        answerKey[q.questionIndex] = q.shortAnswer || "";
      }
    });

    return [
      {
        examCode: originalCode,
        questions: allMapped,
        answerKey,
        isOriginalVariant: true,
      },
    ];
  }

  // Trộn tạo các mã đề mới:
  const codes = config.examCodes && config.examCodes.length > 0 ? config.examCodes : ["101", "102", "103", "104"];

  return codes.map((code) => {
    // Helper xáo trong nội bộ 1 phần độc lập (có hỗ trợ nhóm bài đọc)
    const shufflePartQuestions = (partList: Question[]): Question[] => {
      if (partList.length === 0) return [];
      if (!config.shuffleQuestions) return [...partList];

      // Gom nhóm ngữ liệu gộp
      const blocks: { groupId?: string; groupTitle?: string; passageContent?: string; questions: Question[] }[] = [];
      partList.forEach((q) => {
        if (q.groupId) {
          const existing = blocks.find((b) => b.groupId === q.groupId);
          if (existing) {
            existing.questions.push(q);
          } else {
            blocks.push({
              groupId: q.groupId,
              groupTitle: q.groupTitle,
              passageContent: q.passageContent,
              questions: [q],
            });
          }
        } else {
          blocks.push({ questions: [q] });
        }
      });

      // Xáo các khối trong cùng phần
      const shuffledBlocks = shuffleArray(blocks);
      const result: Question[] = [];

      shuffledBlocks.forEach((block) => {
        if (block.groupId && block.questions.length > 1) {
          const inGroup = config.shuffleQuestions ? shuffleArray(block.questions) : block.questions;
          result.push(...inGroup);
        } else {
          result.push(...block.questions);
        }
      });

      return result;
    };

    // 1. Trộn ĐỘC LẬP trong Phần I
    const orderedP1 = shufflePartQuestions(part1Questions);
    // 2. Trộn ĐỘC LẬP trong Phần II
    const orderedP2 = shufflePartQuestions(part2Questions);
    // 3. Trộn ĐỘC LẬP trong Phần III
    const orderedP3 = shufflePartQuestions(part3Questions);

    let globalIdx = 0;

    // Xử lý Phần I: xáo options nếu có cấu hình
    const mappedP1: ExamQuestionVariant[] = orderedP1.map((q, pIdx) => {
      globalIdx++;
      let options = [...(q.options || [])];
      let correctIndex = q.correctIndex ?? 0;

      if (config.shuffleOptions && options.length > 1) {
        const indexedOptions = options.map((opt, optIdx) => ({
          text: opt,
          isCorrect: optIdx === q.correctIndex,
        }));
        const shuffled = shuffleArray(indexedOptions);
        options = shuffled.map((item) => item.text);
        correctIndex = shuffled.findIndex((item) => item.isCorrect);
        if (correctIndex === -1) correctIndex = 0;
      }

      return {
        ...attachPartMetadata(q, globalIdx, pIdx + 1),
        options,
        correctIndex,
      };
    });

    // Xử lý Phần II: Giữ nguyên 4 ý mệnh đề a, b, c, d
    const mappedP2: ExamQuestionVariant[] = orderedP2.map((q, pIdx) => {
      globalIdx++;
      return attachPartMetadata(q, globalIdx, pIdx + 1);
    });

    // Xử lý Phần III: Giữ nguyên đáp án số
    const mappedP3: ExamQuestionVariant[] = orderedP3.map((q, pIdx) => {
      globalIdx++;
      return attachPartMetadata(q, globalIdx, pIdx + 1);
    });

    // Ghép theo đúng thứ tự: PHẦN I TRƯỚC -> PHẦN II TIẾP THEO -> PHẦN III CUỐI CÙNG
    const allOrdered = [...mappedP1, ...mappedP2, ...mappedP3];

    // Xây dựng Bảng đáp án chuẩn cho mã đề
    const answerKey: Record<number, string> = {};
    allOrdered.forEach((q) => {
      if (q.part === 1 || q.questionType === "multiple_choice") {
        answerKey[q.questionIndex] = LETTERS[q.correctIndex] || "A";
      } else if (q.part === 2 || q.questionType === "true_false") {
        const tf = (q.statements || []).map((s) => `${s.label.replace(")", "")}:${s.correctValue ? "Đ" : "S"}`).join(",");
        answerKey[q.questionIndex] = tf || "a:Đ,b:S,c:Đ,d:S";
      } else {
        answerKey[q.questionIndex] = q.shortAnswer || "";
      }
    });

    return {
      examCode: code,
      questions: allOrdered,
      answerKey,
      isOriginalVariant: false,
    };
  });
}

// Export student submissions to Excel (.xlsx) file
export function exportSubmissionsToExcel(submissions: StudentSubmission[], examTitle = "Bang_Diem_Trac_Nghiem") {
  const data = submissions.map((s, index) => ({
    STT: index + 1,
    "Mã Học Sinh": s.studentId || `HS${index + 1}`,
    "Họ và Tên": s.studentName,
    Lớp: s.studentClass,
    Trường: s.school,
    Khối: s.grade,
    "Kì Kiểm Tra": s.examPeriod || "Định kỳ",
    "Tên Bài Thi": s.examTitle,
    "Mã Đề": s.examCode,
    "Điểm Tổng (Thang 10)": s.score,
    "Điểm Phần I (Nhiều lựa chọn)": s.part1Score ?? "-",
    "Điểm Phần II (Đúng / Sai)": s.part2Score ?? "-",
    "Điểm Phần III (Trả lời ngắn)": s.part3Score ?? "-",
    "Số Câu Đúng Tuyệt Đối": s.correctCount,
    "Số Câu Sai / Bị Trừ": s.wrongCount,
    "Chưa Trả Lời": s.unansweredCount,
    "Tổng Câu": s.totalQuestions,
    "Thời Gian Làm (phút)": (s.durationTakenSeconds / 60).toFixed(1),
    "Rời Tab / Cửa Sổ": s.tabSwitchCount,
    "Copy / Paste Vi Phạm": s.copyPasteCount || 0,
    "Phím Tắt / DevTools": s.devToolsCount || 0,
    "Trả Lời Siêu Nhanh (<3s)": s.suspiciousSpeedCount || 0,
    "Trạng Thái Gian Lận": s.isLockedDueToCheating
      ? "ĐÃ KHÓA DO GIAN LẬN (> 3 LẦN)"
      : (s.tabSwitchCount + (s.copyPasteCount || 0) + (s.devToolsCount || 0) + (s.suspiciousSpeedCount || 0)) > 0
      ? `Cảnh báo (${s.violationLogs.length} vi phạm)`
      : "Hợp lệ (0 vi phạm)",
    "Thời Gian Nộp": new Date(s.submittedAt).toLocaleString("vi-VN"),
    "Trạng Thái": s.status === "locked" ? "Bị khóa" : "Hoàn thành",
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Kết Quả Học Sinh");
  XLSX.writeFile(workbook, `${examTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// Export answer key matrix for multiple codes (Bảng ma trận đáp án)
export function exportAnswerKeyMatrix(variants: ExamVariant[], examTitle = "Bang_Dap_An_Ma_Tran") {
  if (variants.length === 0) return;

  const totalQuestions = variants[0].questions.length;
  const rows: any[] = [];

  for (let qNum = 1; qNum <= totalQuestions; qNum++) {
    const qObj = variants[0].questions.find((q) => q.questionIndex === qNum);
    const partLabel = qObj?.part === 1 ? "Phần I (Nhiều lựa chọn)" : qObj?.part === 2 ? "Phần II (Đúng/Sai)" : "Phần III (Trả lời ngắn)";

    const row: any = {
      "Câu": `Câu ${qNum}`,
      "Dạng / Phần": partLabel,
    };

    variants.forEach((v) => {
      row[`Mã Đề ${v.examCode}`] = v.answerKey[qNum] || "";
    });
    rows.push(row);
  }

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Bảng Đáp Án Ma Trận");
  XLSX.writeFile(workbook, `${examTitle}.xlsx`);
}

// Generate TSV string for instant copy-paste into Google Sheets
export function generateGoogleSheetsTSV(submissions: StudentSubmission[]): string {
  const headers = [
    "STT",
    "Mã Học Sinh",
    "Họ và Tên",
    "Lớp",
    "Trường",
    "Khối",
    "Kì Kiểm Tra",
    "Tên Bài Thi",
    "Mã Đề",
    "Điểm Tổng",
    "Điểm Phần I",
    "Điểm Phần II",
    "Điểm Phần III",
    "Số Câu Đúng",
    "Số Câu Sai",
    "Chưa Làm",
    "Tổng Câu",
    "Thời Gian Làm (phút)",
    "Rời Tab",
    "Copy/Paste",
    "Phím Tắt / Tools",
    "Trả Lời Siêu Nhanh",
    "Tổng Vi Phạm",
    "Cảnh Báo Gian Lận",
    "Thời Gian Nộp",
    "Trạng Thái",
  ];

  const lines = [headers.join("\t")];

  submissions.forEach((s, idx) => {
    const totalViolations = s.violationLogs?.length || 0;
    const row = [
      idx + 1,
      s.studentId || `HS${idx + 1}`,
      s.studentName,
      s.studentClass,
      s.school,
      s.grade,
      s.examPeriod || "Định kỳ",
      s.examTitle,
      s.examCode,
      s.score,
      s.part1Score ?? "-",
      s.part2Score ?? "-",
      s.part3Score ?? "-",
      s.correctCount,
      s.wrongCount,
      s.unansweredCount,
      s.totalQuestions,
      (s.durationTakenSeconds / 60).toFixed(1),
      s.tabSwitchCount,
      s.copyPasteCount || 0,
      s.devToolsCount || 0,
      s.suspiciousSpeedCount || 0,
      totalViolations,
      s.isLockedDueToCheating
        ? "BỊ KHÓA (QUÁ SỐ LẦN)"
        : totalViolations > 0
        ? `Cảnh báo (${totalViolations} vi phạm)`
        : "Không vi phạm",
      new Date(s.submittedAt).toLocaleString("vi-VN"),
      s.status === "locked" ? "Bị khóa" : "Đã nộp bài",
    ];
    lines.push(row.join("\t"));
  });

  return lines.join("\n");
}

// -------------------------------------------------------------
// SAMPLE EXAMS CHUẨN CẤU TRÚC 3 DẠNG BỘ GIÁO DỤC VÀ ĐÀO TẠO (2025/2026)
// -------------------------------------------------------------

/**
 * Đề mẫu chuẩn 28 câu với 40 lệnh hỏi (KHTN / Địa lý / Tin học / Công nghệ):
 * - PHẦN I: 18 câu trắc nghiệm nhiều lựa chọn (4.5 điểm)
 * - PHẦN II: 4 câu trắc nghiệm Đúng / Sai với 16 ý a, b, c, d (4.0 điểm)
 * - PHẦN III: 6 câu trắc nghiệm Trả lời ngắn (1.5 điểm)
 * Có đầy đủ Bảng số liệu Table Markdown và sơ đồ / biểu đồ!
 */
export const SAMPLE_28Q_BGD_EXAM_TEXT = `BỘ GIÁO DỤC VÀ ĐÀO TẠO
KỲ THI TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG NĂM 2026
MÔN: VẬT LÍ - ĐỊA LÍ - KHTN CHUẨN 28 CÂU (40 LỆNH HỎI)
Thời gian làm bài: 50 phút, không kể thời gian phát đề

PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn. Thí sinh trả lời từ câu 1 đến câu 18. Mỗi câu hỏi thí sinh chỉ chọn một phương án.

Câu 1: Một vật dao động điều hòa với phương trình x = 5cos(4πt + π/3) (cm). Biên độ dao động của vật là:
A. 5 cm
B. 4 cm
C. 10 cm
D. π/3 cm

Câu 2: Đơn vị của điện dung trong hệ SI là:
A. Fara (F)
B. Vôn (V)
C. Ampe (A)
D. Cu-lông (C)

Câu 3: Hiện tượng quang điện ngoài xảy ra khi ánh sáng kích thích có bước sóng:
A. Nhỏ hơn hoặc bằng giới hạn quang điện λ₀
B. Lớn hơn giới hạn quang điện λ₀
C. Bằng 2 lần giới hạn quang điện λ₀
D. Thuộc vùng hồng ngoại bất kỳ

Câu 4: Hạt nhân mang điện tích dương vì được cấu tạo từ:
A. Proton mang điện tích dương và nơtron không mang điện
B. Electron và proton
C. Nơtron và electron
D. Chỉ toàn proton

Câu 5: Cho bảng số liệu nhiệt độ trung bình các tháng tại Hà Nội (°C):
| Tháng | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9 | T10 | T11 | T12 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Nhiệt độ (°C) | 16.4 | 17.0 | 20.2 | 23.7 | 27.3 | 28.8 | 28.9 | 28.2 | 27.2 | 24.6 | 21.4 | 18.2 |
Tháng có nhiệt độ trung bình cao nhất trong năm là:
A. Tháng 7
B. Tháng 6
C. Tháng 5
D. Tháng 8

Câu 6: Sóng cơ lan truyền trong môi trường đàn hồi có bước sóng λ. Khoảng cách giữa hai điểm gần nhau nhất trên cùng một phương truyền sóng dao động ngược pha là:
A. λ/2
B. λ
C. 2λ
D. λ/4

Câu 7: Một con lắc lò xo có độ cứng k = 100 N/m, vật nặng có khối lượng m = 0.25 kg. Tần số góc riêng của con lắc là:
A. 20 rad/s
B. 10 rad/s
C. 40 rad/s
D. 5 rad/s

Câu 8: Tia laze có đặc điểm nào sau đây?
A. Tính đơn sắc cao và định hướng cao
B. Luôn là ánh sáng trắng
C. Không mang năng lượng
D. Có bước sóng lớn hơn sóng vô tuyến

Câu 9: Trong sơ đồ khối của máy phát thanh vô tuyến đơn giản không có bộ phận nào sau đây?
A. Mạch tách sóng
B. Micro
C. Mạch biến điệu
D. Anten phát

Câu 10: Cho bảng tỉ trọng các ngành kinh tế trong GDP nước ta (%):
| Năm | Nông - Lâm - Thủy sản | Công nghiệp - Xây dựng | Dịch vụ |
| :--- | :--- | :--- | :--- |
| 2010 | 18.9 | 38.2 | 42.9 |
| 2020 | 14.8 | 33.7 | 51.5 |
Xu hướng chuyển dịch cơ cấu ngành kinh tế của nước ta là:
A. Tăng tỉ trọng ngành dịch vụ, giảm tỉ trọng nông nghiệp
B. Tăng tỉ trọng nông nghiệp, giảm dịch vụ
C. Tỉ trọng công nghiệp đạt trên 70%
D. Cơ cấu kinh tế không có sự thay đổi

Câu 11: Một khung dây phẳng diện tích S đặt trong từ trường đều có cảm ứng từ B. Từ thông qua khung dây cực đại khi góc giữa vecto pháp tuyến n và B bằng:
A. 0 độ
B. 90 độ
C. 180 độ
D. 45 độ

Câu 12: Đại lượng đặc trưng cho mức độ bền vững của hạt nhân là:
A. Năng lượng liên kết riêng
B. Năng lượng liên kết
C. Độ hụt khối
D. Khối lượng hạt nhân

Câu 13: Tia X không có ứng dụng nào sau đây?
A. Sấy khô và sưởi ấm nông sản
B. Chụp X-quang y tế
C. Kiểm tra hành lý sân bay
D. Nghiên cứu cấu trúc tinh thể

Câu 14: Đoạn mạch xoay chiều chỉ có tụ điện C thì cường độ dòng điện trong mạch:
A. Sớm pha π/2 so với điện áp hai đầu tụ điện
B. Trễ pha π/2 so với điện áp hai đầu tụ điện
C. Cùng pha với điện áp hai đầu tụ điện
D. Ngược pha với điện áp hai đầu tụ điện

Câu 15: Theo thuyết tương đối, năng lượng nghỉ E₀ của một vật có khối lượng m₀ là:
A. E₀ = m₀c²
B. E₀ = 0.5m₀c²
C. E₀ = m₀c
D. E₀ = 2m₀c²

Câu 16: Chiết suất của thủy tinh đối với các ánh sáng đơn sắc giảm dần theo thứ tự:
A. Tím, chàm, lam, lục, vàng, da cam, đỏ
B. Đỏ, da cam, vàng, lục, lam, chàm, tím
C. Tím, vàng, đỏ, lục, lam
D. Đỏ, vàng, lục, lam, tím

Câu 17: Một sợi dây đàn hồi dài L có hai đầu cố định. Điều kiện để có sóng dừng trên dây là L bằng:
A. Số nguyên lần nửa bước sóng (kλ/2)
B. Số lẻ lần một phần tư bước sóng
C. Số nguyên lần bước sóng (kλ)
D. Một nửa bước sóng duy nhất

Câu 18: Kim loại dẫn điện tốt nhất trong các kim loại dưới đây là:
A. Bạc (Ag)
B. Đồng (Cu)
C. Nhôm (Al)
D. Sắt (Fe)

PHẦN II. Câu trắc nghiệm đúng sai. Thí sinh trả lời từ câu 1 đến câu 4. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.

Câu 1: Một nhóm học sinh tiến hành thí nghiệm khảo sát mạch điện xoay chiều RLC nối tiếp gồm điện trở thuần R = 40 Ω, cuộn cảm thuần L = 0.4/π H và tụ điện C = 10⁻³/(8π) F. Đặt vào hai đầu đoạn mạch điện áp xoay chiều u = 120√2cos(100πt) (V).
a) Cảm kháng của cuộn cảm trong mạch là Z_L = 40 Ω. (Đúng)
b) Dung kháng của tụ điện trong mạch là Z_C = 80 Ω. (Đúng)
c) Tổng trở của toàn đoạn mạch RLC bằng 40√2 Ω. (Đúng)
d) Điện áp hai đầu đoạn mạch cùng pha với cường độ dòng điện trong mạch. (Sai)

Câu 2: Cho bảng số liệu dân số thành thị và nông thôn nước ta giai đoạn 2015 - 2022 (Đơn vị: Nghìn người):
| Năm | Dân số thành thị | Dân số nông thôn | Tổng số dân |
| :--- | :--- | :--- | :--- |
| 2015 | 31131.4 | 60579.5 | 91710.9 |
| 2020 | 35932.1 | 61649.9 | 97582.0 |
| 2022 | 37380.0 | 62080.0 | 99460.0 |
a) Dân số thành thị nước ta có xu hướng tăng liên tục qua các năm. (Đúng)
b) Tỉ lệ dân số thành thị năm 2022 chiếm trên 50% tổng dân số cả nước. (Sai)
c) Tốc độ tăng trưởng dân số nông thôn nhanh hơn tốc độ tăng dân số thành thị. (Sai)
d) Đô thị hóa và công nghiệp hóa là nguyên nhân chủ yếu thúc đẩy tăng dân số thành thị. (Đúng)

Câu 3: Một chất khí lý tưởng đơn nguyên tử thực hiện chu trình biến đổi trạng thái được biểu diễn trên đồ thị áp suất - thể tích (p-V) như sau:
┌────────────── p (10⁵ Pa) ─────────────┐
│ (1) ──── p₁ = 4 ──────── (2)          │
│  │                        │           │
│ (4) ──── p₂ = 2 ──────── (3)          │
│  │                        │           │
│  0 ──── V₁ = 1 ───────── V₂ = 3 ── V(m³)│
└───────────────────────────────────────┘
a) Quá trình (1) -> (2) là quá trình đẳng áp với nhiệt độ khí tăng. (Đúng)
b) Quá trình (2) -> (3) là quá trình đẳng tích với áp suất giảm. (Đúng)
c) Công mà chất khí sinh ra trong toàn bộ một chu trình (1-2-3-4-1) là A = 4.10⁵ J. (Sai)
d) Nhiệt độ của chất khí tại trạng thái (2) là cao nhất trong toàn bộ chu trình. (Đúng)

Câu 4: Xét một mẫu chất phóng xạ Coban ⁶⁰Co có chu kỳ bán rã T = 5.27 năm, phóng xạ β⁻ và phân rã thành Niken ⁶⁰Ni. Ban đầu tại t = 0 khối lượng Coban là m₀ = 100 g.
a) Sau thời gian t = 10.54 năm (2 chu kỳ bán rã), khối lượng ⁶⁰Co còn lại là 25 g. (Đúng)
b) Sau mỗi chu kỳ bán rã, một nửa số hạt nhân Coban bị phân rã biến thành Niken. (Đúng)
c) Hạt nhân con ⁶⁰Ni sinh ra có số khối bằng 59. (Sai)
d) Tỉ số giữa số hạt nhân Niken sinh ra và số hạt nhân Coban còn lại sau 5.27 năm là 1:1. (Đúng)

PHẦN III. Câu trắc nghiệm trả lời ngắn. Thí sinh trả lời từ câu 1 đến câu 6.

Câu 1: Một vật nhỏ khối lượng m = 200 g dao động điều hòa trên trục Ox. Biết cơ năng dao động của vật là W = 0.04 J và biên độ dao động A = 4 cm. Tính tần số góc ω của dao động (theo đơn vị rad/s).
Đáp án: 15.8

Câu 2: Đặt một điện áp xoay chiều u = 200√2cos(100πt) (V) vào hai đầu một đoạn mạch có điện trở R = 50 Ω. Công suất tiêu thụ của đoạn mạch bằng bao nhiêu oát (W)?
Đáp án: 800

Câu 3: Trong thí nghiệm Y-âng về giao thoa ánh sáng, khoảng cách giữa hai khe là a = 1 mm, khoảng cách từ mặt phẳng chứa hai khe đến màn quan sát là D = 2 m. Ánh sáng đơn sắc có bước sóng λ = 0.5 μm. Khoảng vân giao thoa i đo được trên màn bằng bao nhiêu milimét (mm)?
Đáp án: 1

Câu 4: Cho khối lượng của proton m_p = 1.007276 u, nơtron m_n = 1.008665 u, hạt nhân He (⁴₂He) m_He = 4.001505 u và 1 u = 931.5 MeV/c². Năng lượng liên kết của hạt nhân ⁴₂He là bao nhiêu MeV? (Lấy kết quả làm tròn đến 1 chữ số thập phân).
Đáp án: 28.3

Câu 5: Cho bảng số liệu diện tích và sản lượng lúa của vùng Đồng bằng sông Cửu Long năm 2023:
| Chỉ tiêu | Giá trị |
| :--- | :--- |
| Diện tích gieo trồng (nghìn ha) | 3800 |
| Sản lượng lúa thu hoạch (nghìn tấn) | 24320 |
Hãy tính năng suất lúa bình quân của vùng năm 2023 theo đơn vị tạ/ha.
Đáp án: 64

Câu 6: Một mạch dao động LC lí tưởng có độ tự cảm L = 2 mH và điện dung C = 8 nF. Chu kỳ dao động riêng của mạch bằng bao nhiêu micrôgiây (μs)? (Lấy π² = 10, kết quả làm tròn đến 2 chữ số thập phân).
Đáp án: 25.13
`;

export const SAMPLE_MATH_22Q_BGD_EXAM_TEXT = `BỘ GIÁO DỤC VÀ ĐÀO TẠO
KỲ THI TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG NĂM 2026
MÔN: TOÁN HỌC (CHUẨN CẤU TRÚC 3 PHẦN: 22 CÂU - 34 LỆNH HỎI)
Thời gian làm bài: 90 phút

PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn. Thí sinh trả lời từ câu 1 đến câu 12. Mỗi câu hỏi thí sinh chỉ chọn một phương án.

Câu 1: Cho hàm số y = f(x) có bảng biến thiên như sau:
| x  | -∞      -1       1      +∞ |
| :--- | :--- |
| y' |     +    0   -   0   +     |
| y  | -∞ ↗   2   ↘  -2   ↗  +∞ |
Hàm số đã cho đồng biến trên khoảng nào dưới đây?
A. (-∞; -1) và (1; +∞)
B. (-1; 1)
C. (-∞; 2)
D. (-2; +∞)

Câu 2: Trong không gian Oxyz, cho mặt cầu (S): (x - 1)² + (y + 2)² + (z - 3)² = 16. Tọa độ tâm I và bán kính R của (S) là:
A. I(1; -2; 3), R = 4
B. I(-1; 2; -3), R = 16
C. I(1; -2; 3), R = 16
D. I(-1; 2; -3), R = 4

Câu 3: Khối lăng trụ có diện tích đáy B = 6 cm² và chiều cao h = 4 cm có thể tích bằng:
A. 24 cm³
B. 8 cm³
C. 12 cm³
D. 72 cm³

Câu 4: Nghiệm của phương trình log₂(x - 1) = 3 là:
A. x = 9
B. x = 7
C. x = 8
D. x = 10

Câu 5: Cho hàm số f(x) liên tục trên ℝ. Khẳng định nào sau đây là đúng?
A. ∫ f'(x)dx = f(x) + C
B. ∫ f(x)dx = f'(x) + C
C. (∫ f(x)dx)' = f'(x)
D. ∫ [f(x) + g(x)]dx = ∫ f(x)dx . ∫ g(x)dx

Câu 6: Cho số phức z = 3 - 4i. Môđun của số phức w = (1 + i)z là:
A. 5√2
B. 10
C. 5
D. 25

Câu 7: Tập xác định của hàm số y = (x - 2)^(-3) là:
A. ℝ \\ {2}
B. (2; +∞)
C. [2; +∞)
D. ℝ

Câu 8: Giá trị lớn nhất của hàm số f(x) = x³ - 3x + 2 trên đoạn [0; 2] bằng:
A. 4
B. 2
C. 0
D. 1

Câu 9: Trong không gian Oxyz, vecto pháp tuyến của mặt phẳng 2x - 3y + z - 5 = 0 là:
A. n = (2; -3; 1)
B. n = (2; 3; 1)
C. n = (2; -3; -5)
D. n = (-3; 1; -5)

Câu 10: Cho cấp số cộng (u_n) có u₁ = 3 và công sai d = 2. Giá trị của u₅ bằng:
A. 11
B. 13
C. 10
D. 15

Câu 11: Cho hình lập phương ABCD.A'B'C'D' có cạnh bằng a. Góc giữa hai đường thẳng AB và B'C' bằng:
A. 90°
B. 45°
C. 60°
D. 30°

Câu 12: Đạo hàm của hàm số y = 3^x là:
A. y' = 3^x . ln 3
B. y' = x . 3^(x-1)
C. y' = 3^x / ln 3
D. y' = 3^x

PHẦN II. Câu trắc nghiệm đúng sai. Thí sinh trả lời từ câu 1 đến câu 4. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.

Câu 1: Cho hàm số f(x) = x³ - 3x² + 2.
a) Đạo hàm của hàm số là f'(x) = 3x² - 6x. (Đúng)
b) Hàm số đạt cực đại tại điểm x = 0 và giá trị cực đại y_CĐ = 2. (Đúng)
c) Điểm uốn của đồ thị hàm số có tọa độ I(1; 0). (Đúng)
d) Phương trình f(x) = 0 có đúng 1 nghiệm thực. (Sai)

Câu 2: Trong không gian Oxyz, cho điểm A(1; 2; 3), B(3; 0; 1) và mặt phẳng (P): x + 2y - 2z + 1 = 0.
a) Tọa độ trung điểm M của đoạn thẳng AB là M(2; 1; 2). (Đúng)
b) Vecto AB có tọa độ là (2; -2; -2). (Đúng)
c) Khoảng cách từ điểm A đến mặt phẳng (P) bằng 2. (Sai)
d) Mặt phẳng đi qua A và song song với (P) có phương trình là x + 2y - 2z + 1 = 0. (Sai)

Câu 3: Một hộp chứa 5 viên bi xanh và 4 viên bi đỏ có cùng kích thước. Lấy ngẫu nhiên đồng thời 3 viên bi từ hộp.
a) Số phần tử của không gian mẫu là C(9, 3) = 84. (Đúng)
b) Xác suất để lấy được 3 viên bi toàn màu xanh là 5/42. (Đúng)
c) Xác suất để lấy được ít nhất 1 viên bi màu đỏ là 37/42. (Đúng)
d) Xác suất để lấy được 2 viên bi xanh và 1 viên bi đỏ bằng 10/21. (Sai)

Câu 4: Cho hàm số y = (2x + 1) / (x - 1).
a) Đồ thị hàm số có đường tiệm cận đứng x = 1. (Đúng)
b) Đồ thị hàm số có đường tiệm cận ngang y = 2. (Đúng)
c) Hàm số đồng biến trên từng khoảng xác định. (Sai)
d) Tâm đối xứng của đồ thị là điểm I(1; 2). (Đúng)

PHẦN III. Câu trắc nghiệm trả lời ngắn. Thí sinh trả lời từ câu 1 đến câu 6.

Câu 1: Tìm giá trị nhỏ nhất của hàm số f(x) = x + 4/x trên khoảng (0; +∞).
Đáp án: 4

Câu 2: Biết tích phân ∫ từ 0 đến 1 của (2x + 3)e^x dx = a.e + b với a, b là các số nguyên. Tính giá trị của biểu thức S = a + b.
Đáp án: 2

Câu 3: Một cơ sở sản xuất cần làm các thùng chứa dạng hình trụ có thể tích V = 54π m³. Để tiết kiệm nguyên vật liệu nhất, diện tích toàn phần của thùng nhỏ nhất khi chiều cao h bằng bao nhiêu mét?
Đáp án: 6

Câu 4: Trong không gian Oxyz, cho đường thẳng d: (x - 1)/2 = (y + 1)/(-1) = z/1 và mặt phẳng (P): x + y + z - 3 = 0. Tìm tọa độ giao điểm M(x; y; z) của d và (P). Nhập tổng x + y + z.
Đáp án: 3

Câu 5: Có bao nhiêu giá trị nguyên của tham số m thuộc đoạn [-10; 10] để hàm số y = x⁴ - 2mx² + 1 có 3 điểm cực trị?
Đáp án: 10

Câu 6: Cho hình chóp S.ABC có đáy ABC là tam giác vuông tại B, AB = 3, BC = 4. Cạnh bên SA vuông góc với mặt phẳng đáy và SA = 5. Tính thể tích khối chóp S.ABC.
Đáp án: 10
`;

export const SAMPLE_HISTORY_28Q_BGD_TEXT = `BỘ GIÁO DỤC VÀ ĐÀO TẠO
KỲ THI TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG NĂM 2026
MÔN: LỊCH SỬ / GDKT & PL (CHUẨN 2 PHẦN: 28 CÂU - 40 LỆNH HỎI)
Thời gian làm bài: 50 phút

PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn. Thí sinh trả lời từ câu 1 đến câu 24. Mỗi câu hỏi thí sinh chỉ chọn một phương án.

Câu 1: Chiến thắng nào của quân dân ta đã buộc thực dân Pháp phải ký kết Hiệp định Giơ-ne-vơ năm 1954?
A. Chiến thắng Điện Biên Phủ
B. Chiến dịch Việt Bắc thu - đông 1947
C. Chiến dịch Biên giới thu - đông 1950
D. Chiến dịch Tây Bắc 1952

Câu 2: Cơ quan quyền lực cao nhất của Liên Hợp Quốc là:
A. Đại hội đồng
B. Hội đồng Bảo an
C. Ban Thư ký
D. Tòa án Quốc tế

Câu 3: Hội nghị Ban Chấp hành Trung ương Đảng Cộng sản Đông Dương tháng 5-1941 đã chủ trương thành lập mặt trận nào?
A. Mặt trận Việt Minh
B. Mặt trận Liên Việt
C. Mặt trận Dân chủ Đông Dương
D. Mặt trận Dân tộc Giải phóng miền Nam

Câu 4: Cuộc Tổng tiến công và nổi dậy Xuân Mậu Thân 1968 đã buộc Mĩ phải:
A. Tuyên bố phi Mĩ hóa chiến tranh xâm lược
B. Ký ngay Hiệp định Pari
C. Rút toàn bộ quân đồng minh về nước
D. Chấm dứt chiến tranh phá hoại miền Bắc vĩnh viễn

Câu 5: Trong nền kinh tế thị trường định hướng xã hội chủ nghĩa ở Việt Nam, thành phần kinh tế nào giữ vai trò chủ đạo?
A. Kinh tế nhà nước
B. Kinh tế tư nhân
C. Kinh tế tập thể
D. Kinh tế có vốn đầu tư nước ngoài

Câu 6: Pháp luật có tính quy phạm phổ biến vì:
A. Áp dụng nhiều lần với mọi đối tượng trong toàn xã hội
B. Do cơ quan quyền lực ban hành
C. Thể hiện ý chí của giai cấp thống trị
D. Mang tính bảo thủ và bất biến

PHẦN II. Câu trắc nghiệm đúng sai. Thí sinh trả lời từ câu 1 đến câu 4. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.

Câu 1: Đọc đoạn tư liệu sau về phong trào giải phóng dân tộc ở châu Phi thế kỷ XX:
"Năm 1960 được lịch sử ghi nhận là 'Năm châu Phi' với 17 quốc gia tuyên bố độc lập. Đến năm 1993, chế độ phân biệt chủng tộc Apacthai chính thức bị xóa bỏ tại Nam Phi."
a) Năm 1960 có 17 quốc gia châu Phi giành được độc lập. (Đúng)
b) Nelson Mandela là vị lãnh tụ vĩ đại lãnh đạo cuộc đấu tranh chống chế độ Apacthai ở Nam Phi. (Đúng)
c) Thắng lợi của phong trào giải phóng dân tộc ở châu Phi đã góp phần làm sụp đổ hoàn toàn hệ thống thuộc địa của chủ nghĩa thực dân cũ. (Đúng)
d) Châu Phi giành được độc lập hoàn toàn chỉ bằng phương pháp đấu tranh nghị trường hòa bình. (Sai)

Câu 2: Đọc đoạn văn sau về chính sách tài khóa và tiền tệ:
"Trong giai đoạn phục hồi kinh tế sau khủng hoảng, Ngân hàng Nhà nước quyết định giảm lãi suất điều hành, đồng thời Chính phủ tăng cường giải ngân vốn đầu tư công vào cơ sở hạ tầng giao thông."
a) Giảm lãi suất điều hành là công cụ thuộc chính sách tiền tệ nới lỏng nhằm kích thích vay vốn và đầu tư. (Đúng)
b) Tăng giải ngân vốn đầu tư công là biện pháp mở rộng chính sách tài khóa của Chính phủ. (Đúng)
c) Chính sách tiền tệ nới lỏng kéo dài liên tục mà không kiểm soát có thể dẫn đến nguy cơ lạm phát gia tăng. (Đúng)
d) Ngân hàng thương mại cổ phần có thẩm quyền tự ý in thêm tiền giấy để bơm vào lưu thông. (Sai)
`;

export const SAMPLE_ENGLISH_THPT_TEXT = `BỘ GIÁO DỤC VÀ ĐÀO TẠO
KỲ THI TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG NĂM 2026
MÔN: TIẾNG ANH (CHUẨN 40 CÂU TRẮC NGHIỆM KHÁCH QUAN)
Thời gian làm bài: 50 phút

PHẦN I. Mark the letter A, B, C, or D on your answer sheet to indicate the correct answer to each of the following questions.

Câu 1: The government has decided to ________ more money in renewable energy resources.
A. invest
B. spend
C. waste
D. take

Câu 2: If you study hard every day, you ________ pass the upcoming national examination with ease.
A. will
B. would
C. had
D. were

Câu 3: She is the most intelligent student ________ I have ever taught in this high school.
A. that
B. which
C. whose
D. whom

Câu 4: The heavy rain prevented us ________ playing football yesterday afternoon.
A. from
B. on
C. at
D. with

Câu 5: It is essential that every citizen ________ the traffic laws strictly.
A. obey
B. obeys
C. obeyed
D. obeying

Câu 6: By the time we arrived at the cinema, the movie ________.
A. had already started
B. has already started
C. will start
D. starts

Câu 7: Despite ________ very tired after a long trip, he still attended the meeting.
A. being
B. be
C. was
D. been

Câu 8: This old building was built ________ the 19th century by French architects.
A. in
B. at
C. on
D. for
`;

// Export standard alias for compatibility
export const SAMPLE_EXAM_TEXT = SAMPLE_28Q_BGD_EXAM_TEXT;

/**
 * Helper: Convert Markdown content (Tables, Diagrams, Images, Math) to rich Word/PDF HTML
 */

function formatExportMathAndInline(str: string): string {
  if (!str) return "";
  let res = str;
  // Convert basic LaTeX math inside cells / text
  res = res.replace(/\$([^\$]+)\$/g, (_, math) => {
    let m = math.trim();
    m = m.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)");
    m = m.replace(/\\sqrt\{([^}]+)\}/g, "√($1)");
    m = m.replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, "^{$1}√($2)");
    m = m.replace(/\\vec\{([^}]+)\}/g, "→$1");
    m = m.replace(/\\overrightarrow\{([^}]+)\}/g, "→$1");
    m = m.replace(/\\in\b/g, "∈");
    m = m.replace(/\\notin\b/g, "∉");
    m = m.replace(/\\Delta\b/g, "Δ");
    m = m.replace(/\\alpha\b/g, "α");
    m = m.replace(/\\beta\b/g, "β");
    m = m.replace(/\\pi\b/g, "π");
    m = m.replace(/\\infty\b/g, "∞");
    m = m.replace(/\\le\b/g, "≤");
    m = m.replace(/\\ge\b/g, "≥");
    m = m.replace(/\\ne\b/g, "≠");
    m = m.replace(/\\times\b/g, "×");
    m = m.replace(/\\div\b/g, "÷");
    m = m.replace(/\\pm\b/g, "±");
    m = m.replace(/\^{([^}]+)}/g, "<sup>$1</sup>");
    m = m.replace(/\^([0-9a-zA-Z+-]+)/g, "<sup>$1</sup>");
    m = m.replace(/_{([^}]+)}/g, "<sub>$1</sub>");
    m = m.replace(/_([0-9a-zA-Z+-]+)/g, "<sub>$1</sub>");
    return `<span style="font-family: 'Cambria Math', 'Times New Roman', serif; font-style: italic;">${m}</span>`;
  });

  // Superscript & Subscript without $
  res = res.replace(/\^{([^}]+)}/g, "<sup>$1</sup>");
  res = res.replace(/\^([0-9a-zA-Z+-]+)/g, "<sup>$1</sup>");
  res = res.replace(/_{([^}]+)}/g, "<sub>$1</sub>");
  res = res.replace(/_([0-9a-zA-Z+-]+)/g, "<sub>$1</sub>");

  // Bold & Italic
  res = res.replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>");
  res = res.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  res = res.replace(/\*(.*?)\*/g, "<em>$1</em>");

  return res;
}

function convertMarkdownToExportHtml(rawText: string, diagramUrl?: string): string {
  if (!rawText && !diagramUrl) return "";

  let text = (rawText || "").trim();

  // 1. Process Markdown / Tabular Tables
  const lines = text.split("\n");
  const parsedLines: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  const buildTableHtml = (rows: string[][]) => {
    if (rows.length === 0) return "";
    const header = rows[0];
    const body = rows.slice(1);
    let tableHtml = `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; margin: 12px auto; width: 95%; max-width: 600px; font-size: 11pt; border: 1.5px solid #334155; text-align: center;">`;
    if (header && header.length > 0) {
      tableHtml += `<thead style="background-color: #f1f5f9; font-weight: bold; border-bottom: 1.5px solid #334155;"><tr>`;
      header.forEach((c) => {
        tableHtml += `<th style="padding: 6px 10px; border: 1px solid #64748b; font-weight: bold; text-align: center;">${formatExportMathAndInline(c)}</th>`;
      });
      tableHtml += `</tr></thead>`;
    }
    tableHtml += `<tbody>`;
    body.forEach((r, rIdx) => {
      tableHtml += `<tr style="background-color: ${rIdx % 2 === 0 ? '#ffffff' : '#f8fafc'};">`;
      r.forEach((c) => {
        tableHtml += `<td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: center;">${formatExportMathAndInline(c)}</td>`;
      });
      tableHtml += `</tr>`;
    });
    tableHtml += `</tbody></table>`;
    return tableHtml;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    const isPipeTableLine =
      (line.startsWith("|") && line.endsWith("|")) ||
      (line.includes("|") && line.split("|").length >= 3);

    const isTabTableLine = line.includes("\t") && line.split("\t").filter((c) => c.trim().length > 0).length >= 2;

    if (isPipeTableLine) {
      if (!/^\|?[\s\-:]+(\|[\s\-:]+)+\|?$/.test(line)) {
        let cleanLine = line;
        if (cleanLine.startsWith("|")) cleanLine = cleanLine.slice(1);
        if (cleanLine.endsWith("|")) cleanLine = cleanLine.slice(0, -1);
        const cells = cleanLine.split("|").map((c) => c.trim());
        if (cells.length > 0 && cells.some((c) => c.length > 0)) {
          inTable = true;
          tableRows.push(cells);
          continue;
        }
      } else {
        // Divider row
        continue;
      }
    } else if (isTabTableLine) {
      const cells = line.split("\t").map((c) => c.trim()).filter((c) => c.length > 0);
      if (cells.length > 0) {
        inTable = true;
        tableRows.push(cells);
        continue;
      }
    }

    if (inTable) {
      if (tableRows.length > 0) {
        parsedLines.push(buildTableHtml(tableRows));
      }
      inTable = false;
      tableRows = [];
    }

    parsedLines.push(formatExportMathAndInline(rawLine));
  }

  if (inTable && tableRows.length > 0) {
    parsedLines.push(buildTableHtml(tableRows));
  }

  let formatted = parsedLines.join("<br/>");

  // 2. Process Markdown Images: ![alt](src)
  formatted = formatted.replace(
    /!\[(.*?)\]\(\s*(data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=\s\r\n]+|https?:\/\/[^\s)]+|\/[^\s)]+|[^\s)]+?)\s*\)/g,
    (_, alt, src) => {
      const cleanSrc = src.trim().startsWith("data:image") ? src.replace(/\s+/g, "") : src.trim();
      return `<div style="text-align: center; margin: 10px 0;"><img src="${cleanSrc}" alt="${alt || 'Hình vẽ'}" style="max-width: 450px; max-height: 300px; display: block; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 6px;" /><div style="font-size: 10pt; color: #64748b; font-style: italic; margin-top: 4px;">${alt || 'Hình vẽ minh họa'}</div></div>`;
    }
  );

  // 3. Process diagramUrl
  if (diagramUrl && !formatted.includes(diagramUrl)) {
    formatted += `<div style="text-align: center; margin: 10px 0;"><img src="${diagramUrl}" alt="Hình vẽ minh họa" style="max-width: 450px; max-height: 300px; display: block; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 6px;" /><div style="font-size: 10pt; color: #64748b; font-style: italic; margin-top: 4px;">Hình vẽ / Bảng số liệu đính kèm</div></div>`;
  }

  return formatted;
}

export function exportQuestionsToWordDoc(questions: Question[], title: string = "De_Thi_Chuyen_Doi_Tu_Anh", includeAnswers: boolean = false) {
  const answerTitle = includeAnswers ? `${title} (Kèm Đáp Án & Hướng Dẫn Giải Chi Tiết)` : title;

  let answerKeyTableHtml = "";
  if (includeAnswers) {
    answerKeyTableHtml = `
      <div style="margin-top: 24px; page-break-before: always;">
        <h3 style="text-align: center; color: #1e3a8a; font-weight: bold; border-bottom: 2px solid #1e3a8a; padding-bottom: 6px;">
          BẢNG ĐÁP ÁN VÀ MA TRẬN CHUẨN BỘ GIÁO DỤC & ĐÀO TẠO
        </h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11pt;" border="1">
          <thead>
            <tr style="background-color: #f1f5f9; font-weight: bold;">
              <th style="padding: 6px; text-align: center; width: 80px;">Câu</th>
              <th style="padding: 6px; text-align: center; width: 140px;">Phần / Dạng</th>
              <th style="padding: 6px; text-align: center;">Đáp Án Chuẩn</th>
            </tr>
          </thead>
          <tbody>
            ${questions.map((q, idx) => {
              const qNum = idx + 1;
              const isP2 = q.part === 2 || q.questionType === "true_false";
              const isP3 = q.part === 3 || q.questionType === "short_answer";
              const partLabel = isP2 ? "Phần II (Đúng/Sai)" : isP3 ? "Phần III (Điền số)" : "Phần I (Nhiều lựa chọn)";
              let ansDisplay = "";
              if (isP2) {
                ansDisplay = (q.statements || []).map((s) => `${s.label ? s.label.replace(")", "") : s.id}: ${s.correctValue ? "ĐÚNG" : "SAI"}`).join(" | ");
              } else if (isP3) {
                ansDisplay = q.shortAnswer || "-";
              } else {
                ansDisplay = LETTERS[q.correctIndex ?? 0] || "A";
              }
              return `<tr>
                <td style="padding: 5px; text-align: center; font-weight: bold;">Câu ${qNum}</td>
                <td style="padding: 5px; text-align: center;">${partLabel}</td>
                <td style="padding: 5px; text-align: center; font-weight: bold; color: #1e3a8a;">${ansDisplay}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  const htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>${answerTitle}</title>
      <style>
        body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.45; color: #000; }
        h1, h2, h3 { text-align: center; margin-bottom: 6px; }
        .header-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; border: none; }
        .header-table td { border: none; vertical-align: top; }
        .question-block { margin-bottom: 14px; page-break-inside: avoid; }
        .question-title { font-weight: bold; font-size: 13pt; margin-bottom: 4px; }
        .options-grid { margin-top: 5px; margin-left: 20px; }
        .option-item { margin-bottom: 4px; }
        .correct-badge { font-weight: bold; color: #047857; }
        .tf-true { font-weight: bold; color: #059669; }
        .tf-false { font-weight: bold; color: #dc2626; }
        .explanation-box { margin-top: 6px; padding: 6px 10px; background-color: #f8fafc; border-left: 3px solid #2563eb; font-size: 11.5pt; color: #1e293b; font-style: italic; }
        img { max-width: 450px; max-height: 300px; display: block; margin: 6px auto; }
      </style>
    </head>
    <body>
      <table class="header-table">
        <tr>
          <td style="width: 48%; text-align: center;">
            <strong>BỘ GIÁO DỤC VÀ ĐÀO TẠO</strong><br/>
            <strong>TRƯỜNG THPT</strong>
          </td>
          <td style="width: 52%; text-align: center;">
            <strong>KỲ THI TỐT NGHIỆP THPT</strong><br/>
            <strong>${answerTitle}</strong><br/>
            <em>(Đề thi gồm ${questions.length} câu hỏi)</em>
          </td>
        </tr>
      </table>
      <div style="border-bottom: 1.5px solid #000; margin-bottom: 16px;"></div>
      <div class="content">
        ${questions.map((q, idx) => {
          const isP2 = q.part === 2 || q.questionType === "true_false";
          const isP3 = q.part === 3 || q.questionType === "short_answer";
          const isP1 = !isP2 && !isP3;

          let optHtml = "";
          if (isP1) {
            optHtml = `<div class="options-grid">
              ${(q.options || []).map((opt, oIdx) => {
                const isCorrect = includeAnswers && oIdx === q.correctIndex;
                return `<div class="option-item ${isCorrect ? "correct-badge" : ""}">
                  <strong>${LETTERS[oIdx]}.</strong> ${convertMarkdownToExportHtml(opt)} ${isCorrect ? " ✓ <em>(Đáp án đúng)</em>" : ""}
                </div>`;
              }).join("")}
            </div>`;
          } else if (isP2) {
            const stmts = q.statements && q.statements.length > 0 ? q.statements : [
              { id: "a", label: "a)", text: "Ý a", correctValue: true },
              { id: "b", label: "b)", text: "Ý b", correctValue: false },
              { id: "c", label: "c)", text: "Ý c", correctValue: true },
              { id: "d", label: "d)", text: "Ý d", correctValue: false },
            ];

            optHtml = `<div class="options-grid">
              ${stmts.map((st) => {
                const ansTag = includeAnswers
                  ? ` <span class="${st.correctValue ? "tf-true" : "tf-false"}">[${st.correctValue ? "ĐÚNG" : "SAI"}]</span>`
                  : "";
                return `<div class="option-item">
                  <strong>${st.label || `${st.id})`}</strong> ${convertMarkdownToExportHtml(st.text)}${ansTag}
                </div>`;
              }).join("")}
            </div>`;
          } else if (isP3) {
            if (includeAnswers) {
              optHtml = `<div style="margin-top: 6px; margin-left: 20px; font-weight: bold; color: #059669;">
                Đáp số chuẩn: ${q.shortAnswer || "Chưa có đáp án"}
              </div>`;
            } else {
              optHtml = `<div style="margin-top: 6px; margin-left: 20px; font-style: italic;">Đáp số: ....................................................</div>`;
            }
          }

          const groupHtml = q.groupTitle
            ? `<div style="margin: 8px 0; padding: 6px 12px; background-color: #f1f5f9; border-left: 4px solid #4f46e5; font-size: 11pt;">
                <strong>📌 ${q.groupTitle}</strong>
                ${q.passageContent ? `<div style="margin-top: 4px;">${convertMarkdownToExportHtml(q.passageContent)}</div>` : ""}
              </div>`
            : "";

          const expHtml = (includeAnswers && q.explanation) ? `<div class="explanation-box"><strong>💡 Lời giải chi tiết:</strong> ${convertMarkdownToExportHtml(q.explanation)}</div>` : "";

          return `<div class="question-block">
            ${groupHtml}
            <div class="question-title">Câu ${idx + 1}: ${convertMarkdownToExportHtml(q.content, q.diagramUrl)}</div>
            ${optHtml}
            ${expHtml}
          </div>`;
        }).join("")}
      </div>
      ${answerKeyTableHtml}
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff' + htmlContent], {
    type: 'application/msword;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const fileSuffix = includeAnswers ? "_kem_dap_an" : "";
  link.download = `${title.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, "_")}${fileSuffix}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Tự động chuyển đổi và xuất danh sách câu hỏi đã số hóa từ Ảnh/File sang bản in PDF (.pdf)
 */
export function exportQuestionsToPrintablePdf(questions: Question[], title: string = "De_Thi_Chuyen_Doi_Tu_Anh", includeAnswers: boolean = false) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Vui lòng cho phép mở cửa sổ popup để in/lưu PDF.");
    return;
  }

  const answerTitle = includeAnswers ? `${title} (Kèm Đáp Án & Lời Giải Chi Tiết)` : title;

  let answerKeyTableHtml = "";
  if (includeAnswers) {
    answerKeyTableHtml = `
      <div style="margin-top: 24px; page-break-before: always;">
        <h3 style="text-align: center; color: #1e3a8a; font-weight: bold; border-bottom: 2px solid #1e3a8a; padding-bottom: 6px;">
          BẢNG ĐÁP ÁN VÀ MA TRẬN CHUẨN BỘ GIÁO DỤC & ĐÀO TẠO
        </h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11pt;" border="1">
          <thead>
            <tr style="background-color: #f1f5f9; font-weight: bold;">
              <th style="padding: 6px; text-align: center; width: 80px;">Câu</th>
              <th style="padding: 6px; text-align: center; width: 140px;">Phần / Dạng</th>
              <th style="padding: 6px; text-align: center;">Đáp Án Chuẩn</th>
            </tr>
          </thead>
          <tbody>
            ${questions.map((q, idx) => {
              const qNum = idx + 1;
              const isP2 = q.part === 2 || q.questionType === "true_false";
              const isP3 = q.part === 3 || q.questionType === "short_answer";
              const partLabel = isP2 ? "Phần II (Đúng/Sai)" : isP3 ? "Phần III (Điền số)" : "Phần I (Nhiều lựa chọn)";
              let ansDisplay = "";
              if (isP2) {
                ansDisplay = (q.statements || []).map((s) => `${s.label ? s.label.replace(")", "") : s.id}: ${s.correctValue ? "ĐÚNG" : "SAI"}`).join(" | ");
              } else if (isP3) {
                ansDisplay = q.shortAnswer || "-";
              } else {
                ansDisplay = LETTERS[q.correctIndex ?? 0] || "A";
              }
              return `<tr>
                <td style="padding: 5px; text-align: center; font-weight: bold;">Câu ${qNum}</td>
                <td style="padding: 5px; text-align: center;">${partLabel}</td>
                <td style="padding: 5px; text-align: center; font-weight: bold; color: #1e3a8a;">${ansDisplay}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${answerTitle}</title>
      <style>
        @page { size: A4; margin: 15mm 15mm; }
        body { font-family: 'Times New Roman', serif; font-size: 12.5pt; line-height: 1.4; color: #000; margin: 0; padding: 20px; }
        .header-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        .header-table td { border: none; vertical-align: top; }
        .question-block { margin-bottom: 12px; page-break-inside: avoid; }
        .question-title { font-weight: bold; }
        .options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 4px; margin-left: 15px; }
        .option-item { font-size: 12pt; }
        .correct-badge { font-weight: bold; color: #047857; }
        .tf-true { font-weight: bold; color: #059669; }
        .tf-false { font-weight: bold; color: #dc2626; }
        .explanation-box { margin-top: 4px; padding: 4px 8px; background-color: #f8fafc; border-left: 3px solid #2563eb; font-size: 11pt; color: #1e293b; font-style: italic; }
        img { max-width: 450px; max-height: 300px; display: block; margin: 8px auto; border: 1px solid #e2e8f0; }
        @media print {
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <table class="header-table">
        <tr>
          <td style="width: 48%; text-align: center;">
            <strong>BỘ GIÁO DỤC VÀ ĐÀO TẠO</strong><br/>
            <strong>TRƯỜNG THPT</strong>
          </td>
          <td style="width: 52%; text-align: center;">
            <strong>KỲ THI TỐT NGHIỆP THPT 2026</strong><br/>
            <strong>${answerTitle}</strong><br/>
            <em>(Thời gian làm bài: 50 phút - Đề gồm ${questions.length} câu)</em>
          </td>
        </tr>
      </table>
      <div style="border-bottom: 1.5px solid #000; margin-bottom: 16px;"></div>
      <div class="content">
        ${questions.map((q, idx) => {
          const isP2 = q.part === 2 || q.questionType === "true_false";
          const isP3 = q.part === 3 || q.questionType === "short_answer";
          const isP1 = !isP2 && !isP3;

          let optHtml = "";
          if (isP1) {
            optHtml = `<div class="options-grid">
              ${(q.options || []).map((opt, oIdx) => {
                const isCorrect = includeAnswers && oIdx === q.correctIndex;
                return `<div class="option-item ${isCorrect ? "correct-badge" : ""}">
                  <strong>${LETTERS[oIdx]}.</strong> ${convertMarkdownToExportHtml(opt)} ${isCorrect ? " ✓ <em>(Đáp án)</em>" : ""}
                </div>`;
              }).join("")}
            </div>`;
          } else if (isP2) {
            const stmts = q.statements && q.statements.length > 0 ? q.statements : [
              { id: "a", label: "a)", text: "Ý a", correctValue: true },
              { id: "b", label: "b)", text: "Ý b", correctValue: false },
              { id: "c", label: "c)", text: "Ý c", correctValue: true },
              { id: "d", label: "d)", text: "Ý d", correctValue: false },
            ];

            optHtml = `<div style="margin-left: 15px; margin-top: 4px;">
              ${stmts.map((st) => {
                const ansTag = includeAnswers
                  ? ` <span class="${st.correctValue ? "tf-true" : "tf-false"}">[${st.correctValue ? "ĐÚNG" : "SAI"}]</span>`
                  : "";
                return `<div class="option-item" style="margin-bottom: 3px;">
                  <strong>${st.label || `${st.id})`}</strong> ${convertMarkdownToExportHtml(st.text)}${ansTag}
                </div>`;
              }).join("")}
            </div>`;
          } else if (isP3) {
            if (includeAnswers) {
              optHtml = `<div style="margin-top: 6px; margin-left: 15px; font-weight: bold; color: #059669;">
                Đáp số chuẩn: ${q.shortAnswer || "Chưa có đáp án"}
              </div>`;
            } else {
              optHtml = `<div style="margin-top: 6px; margin-left: 15px; font-style: italic;">Đáp số: ....................................................</div>`;
            }
          }

          const groupHtml = q.groupTitle
            ? `<div style="margin: 8px 0; padding: 6px 12px; background-color: #f1f5f9; border-left: 4px solid #4f46e5; font-size: 11pt;">
                <strong>📌 ${q.groupTitle}</strong>
                ${q.passageContent ? `<div style="margin-top: 4px;">${convertMarkdownToExportHtml(q.passageContent)}</div>` : ""}
              </div>`
            : "";

          const expHtml = (includeAnswers && q.explanation) ? `<div class="explanation-box"><strong>💡 Lời giải chi tiết:</strong> ${convertMarkdownToExportHtml(q.explanation)}</div>` : "";

          return `<div class="question-block">
            ${groupHtml}
            <div class="question-title">Câu ${idx + 1}: ${convertMarkdownToExportHtml(q.content, q.diagramUrl)}</div>
            ${optHtml}
            ${expHtml}
          </div>`;
        }).join("")}
      </div>
      ${answerKeyTableHtml}
      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

/**
 * Xuất Bảng Điểm Chấm Tự Động bằng AI ra file Excel (.xlsx)
 * Bao gồm đầy đủ: Thông tin học sinh, Tổng điểm, và từng cột Câu trả lời HS + Đáp án GV + Điểm + Nhận xét
 */
export function exportGradedPapersToExcel(
  papers: GradedPaperResult[],
  examTitle: string = "Bang_Diem_Cham_Tu_Dong_AI"
) {
  if (!papers || papers.length === 0) return;

  // Lấy tất cả số câu hỏi xuất hiện
  const questionIndexSet = new Set<string | number>();
  papers.forEach((p) => {
    (p.details || []).forEach((d) => {
      questionIndexSet.add(d.questionIndex);
    });
  });
  const sortedQNums = Array.from(questionIndexSet).sort((a, b) => Number(a) - Number(b));

  const flatData = papers.map((p, idx) => {
    const row: Record<string, any> = {
      STT: idx + 1,
      "Mã Học Sinh": p.studentId || `HS${idx + 1}`,
      "Họ và Tên Học Sinh": p.studentName,
      Lớp: p.studentClass,
      "Tên Đề Thi": p.examTitle || examTitle,
      "Mã Đề": p.examCode || "101",
      "Tổng Điểm": p.totalScore,
      "Thang Điểm": p.maxScore,
      "Xếp Loại": p.gradeClassification,
      "Tên File Bài Làm": p.fileName,
      "Thời Gian Chấm": new Date(p.gradedAt).toLocaleString("vi-VN"),
      "Đánh Giá Tổng Quan AI": p.summaryEvaluation,
      "Ghi Chú Giáo Viên": p.teacherNotes || "",
    };

    // Bổ sung các cột câu hỏi: Câu trả lời HS, Đáp án GV, Điểm, Nhận xét
    sortedQNums.forEach((qNum) => {
      const detail = (p.details || []).find((d) => String(d.questionIndex) === String(qNum));
      row[`Câu ${qNum} (HS Trả Lời)`] = detail ? detail.studentAnswer : "-";
      row[`Câu ${qNum} (Đáp Án GV)`] = detail ? detail.teacherAnswer : "-";
      row[`Câu ${qNum} (Điểm)`] = detail ? `${detail.pointsAwarded}/${detail.maxPoints}` : "-";
      row[`Câu ${qNum} (Nhận Xét)`] = detail ? detail.feedback || "" : "-";
    });

    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(flatData);

  // Set column widths
  const colWidths = [
    { wch: 6 }, // STT
    { wch: 14 }, // Ma HS
    { wch: 25 }, // Ho Ten
    { wch: 10 }, // Lop
    { wch: 30 }, // Ten De
    { wch: 10 }, // Ma De
    { wch: 12 }, // Tong Diem
    { wch: 12 }, // Thang Diem
    { wch: 14 }, // Xep Loai
    { wch: 25 }, // Ten File
    { wch: 20 }, // Thoi Gian
    { wch: 45 }, // Danh Gia AI
    { wch: 30 }, // Ghi Chu GV
  ];

  sortedQNums.forEach(() => {
    colWidths.push({ wch: 24 }); // HS tra loi
    colWidths.push({ wch: 24 }); // Dap an GV
    colWidths.push({ wch: 12 }); // Diem
    colWidths.push({ wch: 35 }); // Nhan xet
  });

  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Bang_Diem_Chi_Tiet");

  const safeName = (examTitle || "Bang_Diem_AI").replace(/[/\\?%*:|"<>]/g, "_");
  XLSX.writeFile(workbook, `${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Tạo dữ liệu TSV (Tab-Separated Values) cho phép sao chép 1-click và dán trực tiếp vào Google Sheets
 */
export function generateGradedPapersTSV(papers: GradedPaperResult[]): string {
  if (!papers || papers.length === 0) return "";

  const questionIndexSet = new Set<string | number>();
  papers.forEach((p) => {
    (p.details || []).forEach((d) => {
      questionIndexSet.add(d.questionIndex);
    });
  });
  const sortedQNums = Array.from(questionIndexSet).sort((a, b) => Number(a) - Number(b));

  const headers = [
    "STT",
    "Mã Học Sinh",
    "Họ và Tên Học Sinh",
    "Lớp",
    "Tên Đề Thi",
    "Mã Đề",
    "Tổng Điểm",
    "Thang Điểm",
    "Xếp Loại",
    "Tên File Bài Làm",
    "Thời Gian Chấm",
    "Đánh Giá Tổng Quan AI",
    "Ghi Chú Giáo Viên",
  ];

  sortedQNums.forEach((qNum) => {
    headers.push(`Câu ${qNum} (HS Trả Lời)`);
    headers.push(`Câu ${qNum} (Đáp Án GV)`);
    headers.push(`Câu ${qNum} (Điểm)`);
    headers.push(`Câu ${qNum} (Nhận Xét)`);
  });

  const lines = [headers.join("\t")];

  papers.forEach((p, idx) => {
    const rowValues = [
      String(idx + 1),
      p.studentId || `HS${idx + 1}`,
      p.studentName,
      p.studentClass,
      p.examTitle || "",
      p.examCode || "101",
      String(p.totalScore),
      String(p.maxScore),
      p.gradeClassification,
      p.fileName,
      new Date(p.gradedAt).toLocaleString("vi-VN"),
      p.summaryEvaluation.replace(/[\t\n\r]/g, " "),
      (p.teacherNotes || "").replace(/[\t\n\r]/g, " "),
    ];

    sortedQNums.forEach((qNum) => {
      const detail = (p.details || []).find((d) => String(d.questionIndex) === String(qNum));
      rowValues.push(detail ? detail.studentAnswer.replace(/[\t\n\r]/g, " ") : "-");
      rowValues.push(detail ? detail.teacherAnswer.replace(/[\t\n\r]/g, " ") : "-");
      rowValues.push(detail ? `${detail.pointsAwarded}/${detail.maxPoints}` : "-");
      rowValues.push(detail ? (detail.feedback || "").replace(/[\t\n\r]/g, " ") : "-");
    });

    lines.push(rowValues.join("\t"));
  });

  return lines.join("\n");
}

