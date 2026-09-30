/**
 * paperGrading.ts - Deterministic 2-Stage Vision OMR & Grading Engine
 * 
 * Stage 1: Pure Vision OCR - Scans student darkened bubbles from image without knowing teacher answers.
 * Stage 2: Code-based Deterministic Grading - Mathematically scores each question by comparing
 *          extracted answers against teacher's rubric with standard MOET 2025/2026 rules.
 */
import { rubricType, trueFalsePoints, validateRubricSettings } from "./rubricSettings";
import { Type } from "@google/genai";
import type { RubricItem, GradedPaperResult, GradedQuestionDetail } from "../types";

type Generate = (contents: any, config?: any) => Promise<string>;

const MOET_TF_SCORE = [0, 0.1, 0.25, 0.5, 1.0];
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Extract option letter A, B, C, D from teacher's answer string (e.g. "D: kết hợp...", "A.", "B")
 */
export function extractOptionLetter(answerStr: string): string {
  if (!answerStr) return "";
  const trimmed = answerStr.trim();
  const m = trimmed.match(/^([A-D])\b/i) || trimmed.match(/^[\[(]?([A-D])[\]):.\-]/i);
  if (m) return m[1].toUpperCase();
  if (/^[A-D]$/i.test(trimmed)) return trimmed.toUpperCase();
  return "";
}

/**
 * Parse true/false statement values into map of { a: boolean, b: boolean, c: boolean, d: boolean }
 */
export function parseTrueFalseMap(val: any, statements?: any[]): Record<string, boolean> {
  const result: Record<string, boolean> = {};

  if (statements && Array.isArray(statements) && statements.length > 0) {
    statements.forEach((stmt) => {
      const key = (stmt.label || stmt.id || "").replace(/[^a-d]/gi, "").toLowerCase();
      if (key) {
        result[key] = Boolean(stmt.correctValue);
      }
    });
    if (Object.keys(result).length >= 2) return result;
  }

  const str = String(val || "").trim();
  // Format like "ĐĐSS", "SDDS"
  if (/^[ĐDSđsTFtf]{4}$/i.test(str)) {
    const letters = [..."abcd"];
    [...str].forEach((ch, idx) => {
      if (idx < 4) {
        result[letters[idx]] = /[ĐDT]/i.test(ch);
      }
    });
    return result;
  }

  // Format like "a: Đúng | b: Sai | c: Đúng | d: Sai"
  const matches = str.matchAll(/([a-d])\s*[:=)\-.]\s*(Đúng|Sai|Đ|S|True|False)/gi);
  for (const match of matches) {
    const key = match[1].toLowerCase();
    const isTrue = /^(Đúng|Đ|True)$/i.test(match[2]);
    result[key] = isTrue;
  }

  return result;
}

/**
 * Check if two numeric/string answers are mathematically equivalent (e.g. "2.5" == "2,5" == "5/2")
 */
export function isEquivalentNumeric(studentVal: string, teacherVal: string): boolean {
  if (!studentVal || !teacherVal) return false;
  const s1 = studentVal.trim().toLowerCase().replace(/,/g, ".").replace(/\s+/g, "");
  const s2 = teacherVal.trim().toLowerCase().replace(/,/g, ".").replace(/\s+/g, "");
  if (s1 === s2) return true;

  const num1 = Number(s1);
  const num2 = Number(s2);
  if (!isNaN(num1) && !isNaN(num2)) {
    return Math.abs(num1 - num2) < 0.0001;
  }

  // Check simple fractions like 1/2 vs 0.5
  if (s2.includes("/")) {
    const parts = s2.split("/");
    if (parts.length === 2) {
      const fracVal = Number(parts[0]) / Number(parts[1]);
      if (!isNaN(num1) && !isNaN(fracVal)) {
        return Math.abs(num1 - fracVal) < 0.0001;
      }
    }
  }

  return false;
}

/**
 * Stage 1: PURE VISION OCR - Reads student markings without any teacher answer bias
 */
export async function scanPaperMarkings(
  paper: { data: string; mimeType: string },
  generate: Generate
): Promise<{
  studentName?: string;
  studentClass?: string;
  sbd?: string;
  examCode?: string;
  part1: Record<number, string>;
  part2: Record<number, Record<string, string>>;
  part3: Record<number, string>;
  essay?: string;
  bubbleCoordinates?: any[];
}> {
  const cleanBase64 = paper.data.replace(/^data:[^;]+;base64,/, "");

  const visionPrompt = `Bạn là hệ thống nhận diện quang học OMR chuyên dụng (Optical Mark Recognition Scanner) cho Phiếu Trả Lời Trắc Nghiệm chuẩn Bộ GD&ĐT Việt Nam (Khổ A4).
Nhiệm vụ duy nhất của bạn là QUAN SÁT ẢNH và ĐỌC CHÍNH XÁC các ô tròn thí sinh đã dùng bút chì / bút mực TÔ ĐEN (shaded bubble) trên phiếu.
BẠN TUYỆT ĐỐI KHÔNG BIẾT VÀ KHÔNG ĐƯỢC ĐOÁN ĐÁP ÁN ĐÚNG.

CẤU TRÚC PHIẾU TRẮC NGHIỆM TRÊN ẢNH:
1. KHUNG THÔNG TIN ĐẦU TRANG:
   - Họ và tên học sinh (chữ viết tay).
   - Lớp (chữ viết tay).
   - Khung 'SỐ BÁO DANH' (gồm 6 cột số 0 đến 9): Đọc 6 chữ số tương ứng với các ô tròn được tô đen ở mỗi cột từ trái sang phải.
   - Khung 'MÃ ĐỀ THI' (gồm 3 hoặc 4 cột số 0 đến 9): Đọc 3 hoặc 4 chữ số tương ứng với các ô tròn được tô đen ở mỗi cột từ trái sang phải (ví dụ: '9001', '101', '102'...).

2. PHẦN I. CÂU TRẮC NGHIỆM NHIỀU LỰA CHỌN (12 câu hoặc 40 câu):
   - Phiếu được chia thành các CỘT BẢNG rõ ràng:
     * Đọc SỐ CÂU IN trên mỗi hàng, không giả định thứ tự giữa các cột. Phiếu có thể xếp cột trái 1–4 rồi 9–12, cột phải 5–8 hoặc bố cục khác.
   - Mỗi câu có 4 ô tròn theo hàng ngang: [A] [B] [C] [D] từ trái sang phải.
   - QUY TẮC NHẬN DIỆN Ô TÔ ĐEN:
     * Ô nào có vết chì màu xám/đen đậm kín bên trong vòng tròn -> Thí sinh ĐÃ CHỌN chữ cái đó ('A', 'B', 'C', hoặc 'D').
     * Ô nào chỉ có viền in mỏng và nền trắng bên trong -> Thí sinh KHÔNG chọn ô đó.
     * Nếu câu bị bỏ trống (không tô ô nào) -> Trả về chuỗi rỗng "".
   - Hãy đọc cẩn thận từng hàng độc lập:
     * Câu 1: Thí sinh tô ô nào? (A/B/C/D)
     * Câu 2: Thí sinh tô ô nào? (A/B/C/D)
     * Câu 3: Thí sinh tô ô nào? (A/B/C/D)
     * Câu 4: Thí sinh tô ô nào? (A/B/C/D)
     * Câu 5: Thí sinh tô ô nào? (A/B/C/D)
     * Câu 6: Thí sinh tô ô nào? (A/B/C/D)
     * Câu 7: Thí sinh tô ô nào? (A/B/C/D)
     * Câu 8: Thí sinh tô ô nào? (A/B/C/D)
     * Câu 9: Thí sinh tô ô nào? (A/B/C/D)
     * Câu 10: Thí sinh tô ô nào? (A/B/C/D)
     * Câu 11: Thí sinh tô ô nào? (A/B/C/D)
     * Câu 12: Thí sinh tô ô nào? (A/B/C/D)

3. PHẦN II. CÂU TRẮC NGHIỆM ĐÚNG SAI (4 câu):
   - Gồm 4 khối: Câu 1, Câu 2, Câu 3, Câu 4.
   - Mỗi câu có 4 dòng a, b, c, d. Mỗi dòng có 2 ô: cột [Đ] (Đúng) bên trái và cột [S] (Sai) bên phải.
   - Đọc xem từng dòng thí sinh tô vào ô [Đ] hay [S]. Trả về a: "Đ"|"S", b: "Đ"|"S", c: "Đ"|"S", d: "Đ"|"S".

4. PHẦN III. CÂU TRẮC NGHIỆM TRẢ LỜI NGẮN (6 câu):
   - Gồm 6 khối: Câu 1, Câu 2, Câu 3, Câu 4, Câu 5, Câu 6.
   - Đọc giá trị số thí sinh viết ở ô trên và các cột số tô đen ở dưới (ví dụ: "40", "-2.5", "12", "0.75").

5. PHẦN TỰ LUẬN (Nếu có bài làm viết tay): Chép lại nguyên văn lời giải.

TRẢ VỀ KẾT QUẢ DƯỚI DẠNG JSON THEO SCHEMA ĐƯỢC ĐỊNH NGHĨA.`;

  const config = {
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        studentName: { type: Type.STRING },
        studentClass: { type: Type.STRING },
        sbd: { type: Type.STRING },
        examCode: { type: Type.STRING },
        part1: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.INTEGER },
              selected: { type: Type.STRING },
            },
            required: ["question", "selected"],
          },
        },
        part2: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.INTEGER },
              a: { type: Type.STRING },
              b: { type: Type.STRING },
              c: { type: Type.STRING },
              d: { type: Type.STRING },
            },
            required: ["question"],
          },
        },
        part3: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.INTEGER },
              value: { type: Type.STRING },
            },
            required: ["question", "value"],
          },
        },
        essay: { type: Type.STRING },
        bubbleCoordinates: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              xPercent: { type: Type.NUMBER },
              yPercent: { type: Type.NUMBER },
              part: { type: Type.STRING },
              questionIndex: { type: Type.STRING },
              option: { type: Type.STRING },
            },
            required: ["xPercent", "yPercent", "option"],
          },
        },
      },
      required: ["part1", "part2", "part3"],
    },
  };

  const responseText = await generate(
    [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: paper.mimeType || "image/jpeg", data: cleanBase64 } },
          { text: visionPrompt },
        ],
      },
    ],
    config
  );

  let rawJson: any = {};
  try {
    rawJson = JSON.parse(responseText);
  } catch (err) {
    throw new Error("AI trả dữ liệu không hợp lệ. Không thể xác nhận điểm; hãy chấm lại phiếu.");
  }

  for (const part of ["part1", "part2", "part3"]) {
    if (!Array.isArray(rawJson[part])) throw new Error("Thiếu dữ liệu nhận dạng phần thi.");
    const numbers = rawJson[part].map((row: any) => row.question);
    if (numbers.some((n: any) => !Number.isInteger(n) || n < 1) || new Set(numbers).size !== numbers.length) throw new Error("Dữ liệu nhận dạng bị trùng hoặc sai số câu; cần kiểm tra phiếu.");
  }
  // Format into lookup maps
  const part1Map: Record<number, string> = {};
  (rawJson.part1 || []).forEach((p: any) => {
    const qNum = Number(p.question);
    const sel = String(p.selected || "").trim().toUpperCase();
    if (qNum) part1Map[qNum] = sel;
  });

  const part2Map: Record<number, Record<string, string>> = {};
  (rawJson.part2 || []).forEach((p: any) => {
    const qNum = Number(p.question);
    if (qNum) {
      part2Map[qNum] = {
        a: String(p.a || "").trim().toUpperCase(),
        b: String(p.b || "").trim().toUpperCase(),
        c: String(p.c || "").trim().toUpperCase(),
        d: String(p.d || "").trim().toUpperCase(),
      };
    }
  });

  const part3Map: Record<number, string> = {};
  (rawJson.part3 || []).forEach((p: any) => {
    const qNum = Number(p.question);
    const val = String(p.value || "").trim();
    if (qNum) part3Map[qNum] = val;
  });

  return {
    studentName: rawJson.studentName,
    studentClass: rawJson.studentClass,
    sbd: rawJson.sbd,
    examCode: rawJson.examCode,
    part1: part1Map,
    part2: part2Map,
    part3: part3Map,
    essay: rawJson.essay,
    bubbleCoordinates: rawJson.bubbleCoordinates || [],
  };
}

/**
 * Stage 2: DETERMINISTIC CODE-BASED GRADING ENGINE
 * Scores the student's OCR markings against the teacher's rubric with 100% mathematical consistency.
 */
export function gradeScannedPaper(
  rubric: any,
  scan: Awaited<ReturnType<typeof scanPaperMarkings>>,
  paperFile: { fileName: string; data?: string; mimeType?: string },
  overrides?: { studentName?: string; studentClass?: string }
): GradedPaperResult {
  const errors = validateRubricSettings(rubric);
  if (errors.length) throw new Error(errors.join(" "));
  if (scan.examCode && rubric.examCode && scan.examCode !== rubric.examCode) throw new Error("Mã đề trên phiếu khác mã đề đáp án.");
  const items: RubricItem[] = rubric?.items || [];
  if (!items.length) {
    throw new Error("Không có danh sách câu hỏi / đáp án chuẩn để chấm điểm.");
  }

  let part1QuestionCount = 0;
  let part2QuestionCount = 0;
  let part3QuestionCount = 0;

  let p1Correct = 0;
  let p2PointsTotal = 0;
  let p3Correct = 0;

  const details: GradedQuestionDetail[] = items.map((item, idx) => {
    const rawQNum = item.questionIndex ?? idx + 1;
    const qNum = typeof rawQNum === "number" ? rawQNum : parseInt(String(rawQNum).replace(/\D/g, ""), 10) || idx + 1;

    const type = rubricType(item);
    const partNum = type === "multiple_choice" ? 1 : type === "true_false" ? 2 : type === "short_answer" ? 3 : 4;
    const partTag = partNum === 1 ? "part1" : partNum === 2 ? "part2" : partNum === 3 ? "part3" : "essay";

    const maxPts = Number(item.points) || (partNum === 2 ? 1.0 : partNum === 3 ? 0.5 : 0.25);

    // ──────────────────────────────────────────
    // 1. PHẦN I: TRẮC NGHIỆM 4 LỰA CHỌN (A, B, C, D)
    // ──────────────────────────────────────────
    if (partNum === 1 || item.questionType === "multiple_choice") {
      part1QuestionCount++;
      // Find what student bubbled for this question
      // Try qNum or local part index (1..12)
      const studentChoice = (scan.part1[item.printedNumber ?? part1QuestionCount] || "").toUpperCase();
      const teacherLetter = extractOptionLetter(item.correctAnswer);

      const isCorrect = Boolean(studentChoice && teacherLetter && studentChoice === teacherLetter);
      const pointsAwarded = isCorrect ? maxPts : 0;
      if (isCorrect) p1Correct++;

      let status: "correct" | "incorrect" | "ungraded" = "incorrect";
      let feedback = "";

      if (!studentChoice) {
        status = "ungraded";
        feedback = `Học sinh chưa tô đáp án / Bỏ trống. Đáp án đúng là: ${teacherLetter}.`;
      } else if (isCorrect) {
        status = "correct";
        feedback = "Chính xác.";
      } else {
        status = "incorrect";
        feedback = `Học sinh chọn phương án ${studentChoice} (Sai). Đáp án đúng là ${teacherLetter}.`;
      }

      return {
        questionIndex: rawQNum,
        part: "part1",
        questionContent: item.content || `Câu ${rawQNum}`,
        studentAnswer: studentChoice || "Chưa làm / Bỏ trống",
        teacherAnswer: item.correctAnswer,
        pointsAwarded: round2(pointsAwarded),
        maxPoints: maxPts,
        status,
        feedback,
      };
    }

    // ──────────────────────────────────────────
    // 2. PHẦN II: TRẮC NGHIỆM ĐÚNG / SAI (a, b, c, d)
    // ──────────────────────────────────────────
    if (partNum === 2 || item.questionType === "true_false") {
      part2QuestionCount++;
      // Find student's true/false markings for this question
      const studentSubMap = scan.part2[item.printedNumber ?? part2QuestionCount] || {};
      const expectedSubMap = parseTrueFalseMap(item.correctAnswer, item.statements);

      let subMatchCount = 0;
      const subResults: string[] = [];

      ["a", "b", "c", "d"].forEach((subKey) => {
        const studentMark = (studentSubMap[subKey] || "").toUpperCase();
        const studentBool = studentMark === "Đ" || studentMark === "TRUE" || studentMark === "T" ? true : (studentMark === "S" || studentMark === "FALSE" || studentMark === "F" ? false : null);
        const expectedBool = expectedSubMap[subKey] !== undefined ? expectedSubMap[subKey] : null;

        if (studentBool !== null && expectedBool !== null) {
          if (studentBool === expectedBool) {
            subMatchCount++;
            subResults.push(`ý ${subKey}: Đúng`);
          } else {
            subResults.push(`ý ${subKey}: Sai`);
          }
        } else {
          subResults.push(`ý ${subKey}: Chưa tô`);
        }
      });

      // Apply standard MOET 2025/2026 score table: 1 -> 0.1, 2 -> 0.25, 3 -> 0.5, 4 -> 1.0
      const basePoints = MOET_TF_SCORE[Math.min(4, Math.max(0, subMatchCount))] || 0;
      const pointsAwarded = trueFalsePoints(subMatchCount, item);
      p2PointsTotal += pointsAwarded;

      const status: "correct" | "partial" | "incorrect" = subMatchCount === 4 ? "correct" : (subMatchCount > 0 ? "partial" : "incorrect");

      const studentAnsStr = `a: ${studentSubMap.a || "—"}, b: ${studentSubMap.b || "—"}, c: ${studentSubMap.c || "—"}, d: ${studentSubMap.d || "—"}`;
      const feedback = `Đúng ${subMatchCount}/4 ý (${round2(pointsAwarded)} điểm). [${subResults.join(", ")}]`;

      return {
        questionIndex: rawQNum,
        part: "part2",
        questionContent: item.content || `Câu ${rawQNum}`,
        studentAnswer: studentAnsStr,
        teacherAnswer: item.correctAnswer,
        pointsAwarded: round2(pointsAwarded),
        maxPoints: maxPts,
        status,
        feedback,
      };
    }

    // ──────────────────────────────────────────
    // 3. PHẦN III: TRẢ LỜI NGẮN / ĐIỀN SỐ
    // ──────────────────────────────────────────
    if (partNum === 3 || item.questionType === "short_answer") {
      part3QuestionCount++;
      const studentVal = scan.part3[item.printedNumber ?? part3QuestionCount] || "";
      const isMatch = isEquivalentNumeric(studentVal, item.correctAnswer);
      const pointsAwarded = isMatch ? maxPts : 0;
      if (isMatch) p3Correct++;

      const status: "correct" | "incorrect" | "ungraded" = !studentVal ? "ungraded" : (isMatch ? "correct" : "incorrect");
      const feedback = !studentVal
        ? `Học sinh chưa điền kết quả / Bỏ trống. Đáp án đúng là: ${item.correctAnswer}.`
        : isMatch
        ? "Chính xác."
        : `Học sinh điền "${studentVal}" (Sai). Đáp án đúng là "${item.correctAnswer}".`;

      return {
        questionIndex: rawQNum,
        part: "part3",
        questionContent: item.content || `Câu ${rawQNum}`,
        studentAnswer: studentVal || "Chưa làm / Bỏ trống",
        teacherAnswer: item.correctAnswer,
        pointsAwarded: round2(pointsAwarded),
        maxPoints: maxPts,
        status,
        feedback,
      };
    }

    // ──────────────────────────────────────────
    // 4. PHẦN TỰ LUẬN / KHÁC (Essay)
    // ──────────────────────────────────────────
    const studentEssay = scan.essay || "";
    return {
      questionIndex: rawQNum,
      part: "essay",
      questionContent: item.content || `Câu ${rawQNum}`,
      studentAnswer: studentEssay || "Bài làm tự luận trên phiếu",
      teacherAnswer: item.correctAnswer,
      pointsAwarded: 0,
      maxPoints: maxPts,
      status: "ungraded",
      feedback: "Bài tự luận cần giáo viên xem xét và cho điểm theo tiêu chí.",
    };
  });

  // Calculate final total score
  const totalCalculated = details.reduce((sum, d) => sum + (Number(d.pointsAwarded) || 0), 0);
  const maxScore = Number(rubric?.maxScore) || round2(details.reduce((sum, d) => sum + d.maxPoints, 0)) || 10.0;
  const finalTotalScore = Math.min(maxScore, Math.max(0, round2(totalCalculated)));

  let classification: "Xuất sắc" | "Giỏi" | "Khá" | "Trung bình" | "Yếu" = "Khá";
  const scaledScore = finalTotalScore / maxScore * 10;
  if (scaledScore >= 9.0) classification = "Xuất sắc";
  else if (scaledScore >= 8.0) classification = "Giỏi";
  else if (scaledScore >= 6.5) classification = "Khá";
  else if (scaledScore >= 5.0) classification = "Trung bình";
  else classification = "Yếu";

  const summary = `Tổng điểm: ${finalTotalScore}/${maxScore} (${classification}). Phần I: đúng ${p1Correct}/${part1QuestionCount || 12} câu; Phần II: đạt ${round2(p2PointsTotal)}đ; Phần III: đúng ${p3Correct}/${part3QuestionCount || 6} câu.`;

  return {
    assessmentType: rubric.assessmentType,
    gradeWeight: rubric.gradeWeight ?? 1,
    id: `graded_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    studentName: overrides?.studentName || scan.studentName || "Học sinh",
    studentClass: overrides?.studentClass || scan.studentClass || "12A",
    studentId: scan.sbd || "",
    sbd: scan.sbd || "",
    examCode: scan.examCode || "",
    detectedExamCode: scan.examCode || "",
    examTitle: rubric?.title || "Bài kiểm tra",
    fileName: paperFile.fileName,
    fileData: paperFile.data ? (paperFile.data.length < 2000000 ? paperFile.data : undefined) : undefined,
    fileType: paperFile.mimeType?.includes("pdf") ? "pdf" : "image",
    gradedAt: new Date().toISOString(),
    totalScore: finalTotalScore,
    maxScore,
    gradeClassification: classification,
    summaryEvaluation: summary,
    teacherNotes: `Mã đề nhận diện: ${scan.examCode || "Chưa đọc rõ"} | SBD: ${scan.sbd || ""}.`,
    details,
    bubbleCoordinates: scan.bubbleCoordinates || [],
    isReviewedByTeacher: false,
  };
}

/**
 * Main Entry Point: Pure Vision OCR -> Deterministic Code-based Grading
 */
export async function recognizeAndGradePaper(
  paper: { data: string; mimeType: string; fileName?: string },
  rubric: any,
  generate: Generate,
  strictness = "standard"
): Promise<GradedPaperResult> {
  const errors = validateRubricSettings(rubric);
  if (errors.length) throw new Error(errors.join(" "));
  // Step 1: Scan student markings from image (Pure OCR, zero teacher answer bias)
  const scanned = await scanPaperMarkings(paper, generate);

  // Step 2: Grade deterministically in code
  const result = gradeScannedPaper(
    rubric,
    scanned,
    { fileName: paper.fileName || "bai_lam.jpg", data: paper.data, mimeType: paper.mimeType }
  );

  return result;
}
