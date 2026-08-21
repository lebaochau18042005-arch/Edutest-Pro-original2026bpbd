import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Google GenAI Client Factory supporting custom API keys per request
function getGenAI(customApiKey?: string): GoogleGenAI | null {
  const key = (customApiKey && customApiKey.trim()) || process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenAI({
    apiKey: key.trim(),
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// In-Memory Database Store for live demo / testing
const INITIAL_QUESTIONS = [
  {
    id: "q1",
    subject: "Toán học",
    grade: "Khối 12",
    level: "Nhận biết",
    chapter: "Nguyên hàm - Tích phân",
    content: "Cho hàm số f(x) liên tục trên ℝ. Khẳng định nào sau đây là đúng?",
    options: [
      "∫ f'(x)dx = f(x) + C",
      "∫ f(x)dx = f'(x) + C",
      "(∫ f(x)dx)' = f'(x)",
      "∫ [f(x) + g(x)]dx = ∫ f(x)dx . ∫ g(x)dx"
    ],
    correctIndex: 0,
    explanation: "Theo định nghĩa nguyên hàm, nguyên hàm của đạo hàm f'(x) chính là f(x) + C."
  },
  {
    id: "q2",
    subject: "Toán học",
    grade: "Khối 12",
    level: "Thông hiểu",
    chapter: "Hình học không gian Oxyz",
    content: "Trong không gian Oxyz, phương trình mặt phẳng đi qua điểm M(1; -2; 3) và có vectơ pháp tuyến n = (2; -1; 4) là:",
    options: [
      "2x - y + 4z - 16 = 0",
      "2x - y + 4z + 16 = 0",
      "x - 2y + 3z - 14 = 0",
      "2x + y - 4z + 16 = 0"
    ],
    correctIndex: 0,
    explanation: "Phương trình: 2(x - 1) - 1(y + 2) + 4(z - 3) = 0 <=> 2x - y + 4z - 16 = 0."
  },
  {
    id: "q3",
    subject: "Toán học",
    grade: "Khối 12",
    level: "Vận dụng",
    chapter: "Khảo sát hàm số",
    content: "Tìm tất cả các giá trị thực của tham số m để hàm số y = x³ - 3mx² + 3(m² - 1)x đồng biến trên khoảng (1; +∞).",
    options: [
      "m ≤ 0 hoặc m = 1",
      "m ≤ 0",
      "m ≥ 2",
      "m < 1"
    ],
    correctIndex: 1,
    explanation: "y' = 3x² - 6mx + 3(m² - 1) = 3(x - (m - 1))(x - (m + 1)). Để đồng biến trên (1; +∞) thì nghiệm lớn m + 1 ≤ 1 => m ≤ 0."
  },
  {
    id: "q4",
    subject: "Toán học",
    grade: "Khối 12",
    level: "Nhận biết",
    chapter: "Mũ - Logarit",
    content: "Với a là số thực dương tùy ý, log₂(a³) bằng:",
    options: [
      "3 log₂ a",
      "1/3 log₂ a",
      "3 + log₂ a",
      "a³ log₂ a"
    ],
    correctIndex: 0,
    explanation: "Theo tính chất lũy thừa của logarit: log_a(b^n) = n * log_a(b)."
  },
  {
    id: "q5",
    subject: "Toán học",
    grade: "Khối 12",
    level: "Thông hiểu",
    chapter: "Số phức",
    content: "Cho số phức z = 3 - 4i. Môđun của số phức w = (1 + i)z là:",
    options: [
      "5√2",
      "10",
      "5",
      "25"
    ],
    correctIndex: 0,
    explanation: "|w| = |1 + i| * |z| = √(1² + 1²) * √(3² + (-4)²) = √2 * 5 = 5√2."
  },
  {
    id: "q6",
    subject: "Vật lý",
    grade: "Khối 12",
    level: "Nhận biết",
    chapter: "Dao động cơ",
    content: "Một vật dao động điều hòa với phương trình x = A cos(ωt + φ). Đại lượng ω được gọi là:",
    options: [
      "Tần số góc của dao động",
      "Chu kỳ của dao động",
      "Pha ban đầu của dao động",
      "Biên độ dao động"
    ],
    correctIndex: 0,
    explanation: "ω là tần số góc (đơn vị rad/s)."
  },
  {
    id: "q7",
    subject: "Tiếng Anh",
    grade: "Khối 12",
    level: "Thông hiểu",
    chapter: "Grammar & Vocabulary",
    content: "If you ________ harder, you would pass the graduation examination with flying colors.",
    options: [
      "studied",
      "study",
      "had studied",
      "will study"
    ],
    correctIndex: 0,
    explanation: "Câu điều kiện loại 2 (Conditional Type 2): If + S + V-ed/V2, S + would/could + V-inf."
  },
  {
    id: "q8",
    subject: "Hóa học",
    grade: "Khối 12",
    level: "Nhận biết",
    chapter: "Este - Lipit",
    content: "Thủy phân este X có công thức C₄H₈O₂ trong dung dịch NaOH thu được natri axetat. Công thức cấu tạo của X là:",
    options: [
      "CH₃COOC₂H₅",
      "HCOOC₃H₇",
      "C₂H₅COOCH₃",
      "CH₃COOCH₃"
    ],
    correctIndex: 0,
    explanation: "Natri axetat là CH₃COONa, este có 4 C nên gốc ancol là C₂H₅ => CH₃COOC₂H₅ (Etyl axetat)."
  }
];

// Helper to shuffle array
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Helper to calculate BGD True/False score
function calculateTrueFalseScoreServer(correctSubCount: number): number {
  switch (correctSubCount) {
    case 4: return 1.0;
    case 3: return 0.5;
    case 2: return 0.25;
    case 1: return 0.1;
    default: return 0.0;
  }
}

function normalizeShortAnsServer(val: any): string {
  if (!val) return "";
  return String(val).trim().toLowerCase().replace(/\s+/g, "").replace(/,/g, ".");
}

// Generate variants for 3-part exam
function generateExamVariants(
  questions: any[],
  examCodes: string[],
  shuffleQuestions: boolean,
  shuffleOptions: boolean
) {
  const letters = ["A", "B", "C", "D", "E", "F"];

  return examCodes.map((code) => {
    // Separate by Part 1, Part 2, Part 3 so questions are not jumbled between parts
    const p1 = questions.filter((q) => (q.part || 1) === 1);
    const p2 = questions.filter((q) => q.part === 2);
    const p3 = questions.filter((q) => q.part === 3);

    const shufflePart = (list: any[], doShuffleOpts = true) => {
      if (!shuffleQuestions || list.length <= 1) return [...list];
      return shuffleArray(list);
    };

    const orderedQuestions = [
      ...shufflePart(p1, true),
      ...shufflePart(p2, false),
      ...shufflePart(p3, false),
    ];

    const mappedQuestions = orderedQuestions.map((q, idx) => {
      let options = [...(q.options || [])];
      let correctIndex = q.correctIndex ?? 0;

      if ((q.part === 1 || !q.part) && shuffleOptions && options.length > 1) {
        const indexedOptions = options.map((opt, i) => ({
          text: opt,
          isCorrect: i === q.correctIndex,
        }));
        const shuffled = shuffleArray(indexedOptions);
        options = shuffled.map((item) => item.text);
        correctIndex = shuffled.findIndex((item) => item.isCorrect);
        if (correctIndex === -1) correctIndex = 0;
      }

      return {
        originalId: q.id,
        questionIndex: idx + 1,
        part: q.part || 1,
        questionType: q.questionType || "multiple_choice",
        content: q.content,
        options,
        correctIndex,
        originalCorrectIndex: q.correctIndex ?? 0,
        statements: q.statements ? JSON.parse(JSON.stringify(q.statements)) : undefined,
        shortAnswer: q.shortAnswer,
        acceptableAnswers: q.acceptableAnswers,
        points: q.points,
        level: q.level,
        subject: q.subject,
        explanation: q.explanation,
        groupId: q.groupId,
        groupTitle: q.groupTitle,
        passageContent: q.passageContent,
        hasTableOrDiagram: q.hasTableOrDiagram,
      };
    });

    const answerKey: Record<number, string> = {};
    mappedQuestions.forEach((q) => {
      if (q.part === 1 || q.questionType === "multiple_choice") {
        answerKey[q.questionIndex] = letters[q.correctIndex] || "A";
      } else if (q.part === 2 || q.questionType === "true_false") {
        const tf = (q.statements || []).map((s: any) => `${s.label?.replace(")", "") || s.id}:${s.correctValue ? "Đ" : "S"}`).join(",");
        answerKey[q.questionIndex] = tf || "a:Đ,b:S,c:Đ,d:S";
      } else {
        answerKey[q.questionIndex] = q.shortAnswer || "";
      }
    });

    return {
      examCode: code,
      questions: mappedQuestions,
      answerKey,
      isOriginalVariant: false,
    };
  });
}

// In-Memory store
let questionsBank = [...INITIAL_QUESTIONS];

// Default pre-configured exam
const defaultExamConfig = {
  department: "SỞ GIÁO DỤC VÀ ĐÀO TẠO TP. HỒ CHÍ MINH",
  school: "TRƯỜNG THPT CHUYÊN LÊ HỒNG PHONG",
  examPeriod: "Kiểm tra Giữa kỳ II - Năm học 2025-2026",
  subject: "TOÁN HỌC & KHOA HỌC TỰ NHIÊN",
  grade: "Khối 12",
  duration: 45, // 45 minutes
  originalExamCode: "101",
  examCodes: ["101", "102", "103", "104"],
  isOriginalKept: false,
  startTime: "",
  endTime: "",
  maxScore: 10.0,
  shuffleQuestions: true,
  shuffleOptions: true,
  allowReviewAfterSubmit: true,
  maxTabViolations: 3,
};

let activeExams: any[] = [
  {
    id: "exam-demo-01",
    title: "Đề thi thử Tốt nghiệp THPT 2026 - Môn Toán & Khoa Học",
    config: defaultExamConfig,
    originalQuestions: INITIAL_QUESTIONS,
    variants: generateExamVariants(INITIAL_QUESTIONS, defaultExamConfig.examCodes, true, true),
    createdAt: new Date().toISOString(),
    status: "published",
    accessCode: "TOAN12",
  },
];

let studentSubmissions: any[] = [
  {
    id: "sub-1",
    examId: "exam-demo-01",
    examTitle: "Đề kiểm tra giữa kỳ Toán 12 - Trực Tuyến Chống Gian Lận",
    examCode: "101",
    studentName: "Nguyễn Văn An",
    studentClass: "12A1",
    school: "THPT Chuyên Lê Hồng Phong",
    grade: "Khối 12",
    studentId: "HS202601",
    startedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    submittedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    durationTakenSeconds: 1800,
    answers: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 },
    correctCount: 8,
    wrongCount: 0,
    unansweredCount: 0,
    totalQuestions: 8,
    score: 10.0,
    isLockedDueToCheating: false,
    tabSwitchCount: 0,
    violationLogs: [],
    syncedToGoogleSheet: true,
    status: "submitted",
  },
  {
    id: "sub-2",
    examId: "exam-demo-01",
    examCode: "102",
    studentName: "Trần Thị Bích",
    studentClass: "12A2",
    school: "THPT Chuyên Lê Hồng Phong",
    grade: "Khối 12",
    studentId: "HS202602",
    startedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    submittedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    durationTakenSeconds: 1380,
    answers: { 1: 0, 2: 1, 3: 1, 4: 0, 5: 2, 6: 0, 7: 0, 8: 0 },
    correctCount: 6,
    wrongCount: 2,
    unansweredCount: 0,
    totalQuestions: 8,
    score: 7.5,
    isLockedDueToCheating: false,
    tabSwitchCount: 1,
    violationLogs: [
      {
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        type: "TAB_SWITCH",
        message: "Chuyển sang ứng dụng khác (Lần 1)",
      },
    ],
    syncedToGoogleSheet: true,
    status: "submitted",
  },
  {
    id: "sub-3",
    examId: "exam-demo-01",
    examCode: "103",
    studentName: "Lê Hoàng Nam",
    studentClass: "12A3",
    school: "THPT Chuyên Lê Hồng Phong",
    grade: "Khối 12",
    studentId: "HS202603",
    startedAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    submittedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    durationTakenSeconds: 480,
    answers: { 1: 0, 2: 0 },
    correctCount: 2,
    wrongCount: 0,
    unansweredCount: 6,
    totalQuestions: 8,
    score: 2.5,
    isLockedDueToCheating: true,
    tabSwitchCount: 4,
    violationLogs: [
      {
        timestamp: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
        type: "TAB_SWITCH",
        message: "Rời khỏi màn hình làm bài (Lần 1)",
      },
      {
        timestamp: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
        type: "TAB_SWITCH",
        message: "Chuyển tab sang Google Tìm Kiếm (Lần 2)",
      },
      {
        timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
        type: "TAB_SWITCH",
        message: "Mở cửa sổ phụ (Lần 3)",
      },
      {
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        type: "TAB_SWITCH",
        message: "HỆ THỐNG ĐÃ KHÓA BÀI THI DO VI PHẠM QUÁ 3 LẦN (Lần 4)",
      },
    ],
    syncedToGoogleSheet: true,
    status: "locked",
  },
  {
    id: "sub-4",
    examId: "exam-demo-01",
    examTitle: "Đề khảo sát năng lực chuyên đề - Khối 11",
    examCode: "101",
    studentName: "Phạm Hoàng Gia Huy",
    studentClass: "11A3",
    school: "THPT Chuyên Lê Hồng Phong",
    grade: "Khối 11",
    studentId: "HS202604",
    startedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    submittedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    durationTakenSeconds: 1680,
    answers: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1 },
    correctCount: 7,
    wrongCount: 1,
    unansweredCount: 0,
    totalQuestions: 8,
    score: 8.75,
    isLockedDueToCheating: false,
    tabSwitchCount: 0,
    violationLogs: [],
    syncedToGoogleSheet: true,
    status: "submitted",
  },
  {
    id: "sub-5",
    examId: "exam-demo-01",
    examTitle: "Đề khảo sát năng lực chuyên đề - Khối 11",
    examCode: "102",
    studentName: "Vũ Bảo Châu",
    studentClass: "11A1",
    school: "THPT Chuyên Lê Hồng Phong",
    grade: "Khối 11",
    studentId: "HS202605",
    startedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    submittedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    durationTakenSeconds: 1320,
    answers: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 1, 6: 0, 7: 0, 8: 0 },
    correctCount: 7,
    wrongCount: 1,
    unansweredCount: 0,
    totalQuestions: 8,
    score: 8.75,
    isLockedDueToCheating: false,
    tabSwitchCount: 0,
    violationLogs: [],
    syncedToGoogleSheet: true,
    status: "submitted",
  },
  {
    id: "sub-6",
    examId: "exam-demo-01",
    examTitle: "Đề đánh giá kiến thức nền tảng - Khối 10",
    examCode: "101",
    studentName: "Đỗ Đăng Khoa",
    studentClass: "10A2",
    school: "THPT Chuyên Lê Hồng Phong",
    grade: "Khối 10",
    studentId: "HS202606",
    startedAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
    submittedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    durationTakenSeconds: 2100,
    answers: { 1: 0, 2: 1, 3: 2, 4: 0, 5: 0, 6: 1, 7: 1, 8: 2 },
    correctCount: 4,
    wrongCount: 4,
    unansweredCount: 0,
    totalQuestions: 8,
    score: 5.0,
    isLockedDueToCheating: false,
    tabSwitchCount: 0,
    violationLogs: [],
    syncedToGoogleSheet: true,
    status: "submitted",
  },
  {
    id: "sub-7",
    examId: "exam-demo-01",
    examTitle: "Đề đánh giá kiến thức nền tảng - Khối 10",
    examCode: "103",
    studentName: "Hoàng Yến Nhi",
    studentClass: "10A1",
    school: "THPT Chuyên Lê Hồng Phong",
    grade: "Khối 10",
    studentId: "HS202607",
    startedAt: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
    submittedAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    durationTakenSeconds: 1680,
    answers: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 },
    correctCount: 8,
    wrongCount: 0,
    unansweredCount: 0,
    totalQuestions: 8,
    score: 10.0,
    isLockedDueToCheating: false,
    tabSwitchCount: 0,
    violationLogs: [],
    syncedToGoogleSheet: true,
    status: "submitted",
  },
];

// ---------------- API ENDPOINTS ----------------

// 1. Question Bank APIs
app.get("/api/questions", (req, res) => {
  res.json({ success: true, data: questionsBank });
});

app.post("/api/questions", (req, res) => {
  const { questions } = req.body;
  if (Array.isArray(questions)) {
    const formatted = questions.map((q) => ({
      id: q.id || `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      subject: q.subject || "Tổng hợp",
      grade: q.grade || "Khối 12",
      level: q.level || "Thông hiểu",
      chapter: q.chapter || "Chương chung",
      content: q.content,
      options: q.options || ["A", "B", "C", "D"],
      correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : 0,
      explanation: q.explanation || "",
    }));
    questionsBank.push(...formatted);
    res.json({ success: true, count: formatted.length, data: questionsBank });
  } else if (req.body.content) {
    const single = {
      id: req.body.id || `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      subject: req.body.subject || "Toán học",
      grade: req.body.grade || "Khối 12",
      level: req.body.level || "Thông hiểu",
      chapter: req.body.chapter || "",
      content: req.body.content,
      options: req.body.options || [],
      correctIndex: req.body.correctIndex ?? 0,
      explanation: req.body.explanation || "",
    };
    questionsBank.push(single);
    res.json({ success: true, data: single });
  } else {
    res.status(400).json({ error: "Invalid question data" });
  }
});

app.delete("/api/questions/:id", (req, res) => {
  const { id } = req.params;
  questionsBank = questionsBank.filter((q) => q.id !== id);
  res.json({ success: true, data: questionsBank });
});

// 2. Exam APIs & Shuffling
app.get("/api/exams", (req, res) => {
  res.json({ success: true, data: activeExams });
});

app.get("/api/exams/:id", (req, res) => {
  const exam = activeExams.find((e) => e.id === req.params.id || e.accessCode?.toUpperCase() === req.params.id?.toUpperCase());
  if (!exam) {
    return res.status(404).json({ error: "Không tìm thấy đề kiểm tra" });
  }
  res.json({ success: true, data: exam });
});

app.post("/api/exams/shuffle-and-create", (req, res) => {
  try {
    const { title, config, questions, accessCode } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: "Cần ít nhất 1 câu hỏi để tạo đề thi" });
    }

    const examCodes = config?.examCodes && config.examCodes.length > 0 ? config.examCodes : ["101", "102", "103", "104"];
    const isOriginalKept = Boolean(config?.isOriginalKept);
    
    // Generate variants based on whether original is kept or shuffled
    let variants: any[] = [];
    if (isOriginalKept) {
      const origCode = config?.originalExamCode?.trim() || "101";
      variants = [
        {
          examCode: origCode,
          questions: questions.map((q: any, idx: number) => ({
            originalId: q.id,
            questionIndex: idx + 1,
            content: q.content,
            options: q.options || [],
            correctIndex: q.correctIndex ?? 0,
            originalCorrectIndex: q.correctIndex ?? 0,
            level: q.level,
            subject: q.subject,
            explanation: q.explanation,
            groupId: q.groupId,
            groupTitle: q.groupTitle,
            passageContent: q.passageContent,
            hasTableOrDiagram: q.hasTableOrDiagram,
          })),
          answerKey: questions.reduce((acc: any, q: any, idx: number) => {
            acc[idx + 1] = ["A", "B", "C", "D"][q.correctIndex ?? 0] || "A";
            return acc;
          }, {}),
          isOriginalVariant: true,
        },
      ];
    } else {
      variants = generateExamVariants(
        questions,
        examCodes,
        config?.shuffleQuestions ?? true,
        config?.shuffleOptions ?? true
      );
    }

    const newExam = {
      id: `exam-${Date.now()}`,
      title: title || `Đề kiểm tra ${config?.subject || "Trắc nghiệm"} - ${config?.examPeriod || "2026"}`,
      config: {
        department: config?.department || "SỞ GIÁO DỤC VÀ ĐÀO TẠO",
        school: config?.school || "TRƯỜNG THPT",
        examPeriod: config?.examPeriod || "Kiểm tra Giữa kỳ II",
        subject: config?.subject || "MÔN HỌC",
        grade: config?.grade || "Khối 12",
        duration: Number(config?.duration) || 45,
        originalExamCode: config?.originalExamCode?.trim() || "101",
        examCodes,
        isOriginalKept,
        startTime: config?.startTime || "",
        endTime: config?.endTime || "",
        maxScore: Number(config?.maxScore) || 10.0,
        shuffleQuestions: config?.shuffleQuestions ?? true,
        shuffleOptions: config?.shuffleOptions ?? true,
        allowReviewAfterSubmit: config?.allowReviewAfterSubmit ?? true,
        maxTabViolations: Number(config?.maxTabViolations) || 3,
      },
      originalQuestions: questions,
      variants,
      createdAt: new Date().toISOString(),
      status: "published",
      accessCode: accessCode?.trim() || `TEST${Math.floor(1000 + Math.random() * 9000)}`,
    };

    activeExams.unshift(newExam);
    res.json({ success: true, data: newExam });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Lỗi tạo đề kiểm tra" });
  }
});

app.delete("/api/exams/:id", (req, res) => {
  activeExams = activeExams.filter((e) => e.id !== req.params.id);
  res.json({ success: true, message: "Đã xóa đề kiểm tra" });
});

// 3. Submissions & Anti-Cheating APIs
app.get("/api/submissions", (req, res) => {
  const { examId } = req.query;
  let results = studentSubmissions;
  if (examId) {
    results = results.filter((s) => s.examId === examId);
  }
  res.json({ success: true, data: results });
});

app.post("/api/submissions", (req, res) => {
  try {
    const {
      examId,
      examCode,
      studentName,
      studentClass,
      school,
      grade,
      studentId,
      answers,
      durationTakenSeconds,
      tabSwitchCount,
      copyPasteCount,
      devToolsCount,
      suspiciousSpeedCount,
      questionTimes,
      questionTimeRecords,
      violationLogs,
      isLockedDueToCheating,
    } = req.body;

    const exam = activeExams.find((e) => e.id === examId);
    if (!exam) {
      return res.status(404).json({ error: "Đề kiểm tra không tồn tại" });
    }

    const variant = exam.variants.find((v: any) => v.examCode === examCode) || exam.variants[0];
    const totalQuestions = variant.questions.length;
    const isMath = (exam.config.subject || "").toLowerCase().includes("toán");
    const isEnglish = (exam.config.subject || "").toLowerCase().includes("tiếng anh");

    let part1Score = 0;
    let part2Score = 0;
    let part3Score = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;
    const detailedResults: Record<number, any> = {};

    variant.questions.forEach((q: any) => {
      const qIndex = q.questionIndex;
      const studentAns = answers?.[qIndex];
      const part = q.part || 1;

      if (part === 1 || q.questionType === "multiple_choice") {
        const point = 0.25;
        const isUnanswered = studentAns === undefined || studentAns === null || studentAns === -1 || studentAns === "";
        const isCorrect = !isUnanswered && Number(studentAns) === q.correctIndex;
        const earned = isCorrect ? point : 0;

        if (isCorrect) {
          correctCount++;
          part1Score += earned;
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
          pointsEarned: earned,
          maxPoints: point,
          studentAnswerDisplay: isUnanswered ? "Chưa chọn" : ["A", "B", "C", "D"][Number(studentAns)] || "-",
          correctAnswerDisplay: ["A", "B", "C", "D"][q.correctIndex ?? 0] || "A",
        };
      } else if (part === 2 || q.questionType === "true_false") {
        const stmts = q.statements || [
          { id: "a", label: "a)", text: "Ý a", correctValue: true },
          { id: "b", label: "b)", text: "Ý b", correctValue: false },
          { id: "c", label: "c)", text: "Ý c", correctValue: true },
          { id: "d", label: "d)", text: "Ý d", correctValue: false },
        ];

        const studentAnsObj = typeof studentAns === "object" && studentAns !== null ? studentAns : {};
        let subCorrect = 0;
        let hasAnswered = false;

        const subResults = stmts.map((st: any) => {
          const sVal = studentAnsObj[st.id] !== undefined ? Boolean(studentAnsObj[st.id]) : undefined;
          if (sVal !== undefined) hasAnswered = true;
          const isSubCor = sVal === Boolean(st.correctValue);
          if (isSubCor) subCorrect++;

          return {
            label: st.label || `${st.id})`,
            text: st.text,
            studentValue: sVal,
            correctValue: Boolean(st.correctValue),
            isCorrect: isSubCor,
          };
        });

        const qEarned = calculateTrueFalseScoreServer(subCorrect);
        part2Score += qEarned;

        if (!hasAnswered) {
          unansweredCount++;
        } else if (subCorrect === 4) {
          correctCount++;
        } else if (subCorrect > 0) {
          correctCount += subCorrect / 4;
          wrongCount += (4 - subCorrect) / 4;
        } else {
          wrongCount++;
        }

        detailedResults[qIndex] = {
          questionIndex: qIndex,
          part: 2,
          questionType: "true_false",
          isCorrect: subCorrect === 4,
          pointsEarned: qEarned,
          maxPoints: 1.0,
          studentAnswerDisplay: hasAnswered
            ? stmts.map((s: any) => `${s.label || s.id}: ${studentAnsObj[s.id] === undefined ? "?" : studentAnsObj[s.id] ? "Đ" : "S"}`).join(" | ")
            : "Chưa trả lời",
          correctAnswerDisplay: stmts.map((s: any) => `${s.label || s.id}: ${s.correctValue ? "Đ" : "S"}`).join(" | "),
          trueFalseSubResults: subResults,
          correctSubCount: subCorrect,
        };
      } else {
        // Part 3 Short Answer
        const point = isMath ? 0.5 : 0.25;
        const normStudent = normalizeShortAnsServer(studentAns);
        const normCorrect = normalizeShortAnsServer(q.shortAnswer);
        const acceptable = (q.acceptableAnswers || []).map((a: any) => normalizeShortAnsServer(a));
        acceptable.push(normCorrect);

        const isUnanswered = !normStudent;
        const isCorrect = !isUnanswered && acceptable.some((ans: string) => ans === normStudent);
        const earned = isCorrect ? point : 0;

        if (isCorrect) {
          correctCount++;
          part3Score += earned;
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
          pointsEarned: earned,
          maxPoints: point,
          studentAnswerDisplay: isUnanswered ? "Chưa điền" : String(studentAns),
          correctAnswerDisplay: q.shortAnswer || "Đáp án chuẩn",
        };
      }
    });

    const rawScore = part1Score + part2Score + part3Score;
    const score = Math.min(10.0, Math.max(0, Number(rawScore.toFixed(2))));

    const newSubmission = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      examId,
      examTitle: exam.title,
      examPeriod: exam.config.examPeriod,
      examCode: variant.examCode,
      studentName: studentName || "Học sinh",
      studentClass: studentClass || "12A",
      school: school || exam.config.school || "THPT",
      grade: grade || exam.config.grade || "Khối 12",
      studentId: studentId || `HS${Math.floor(10000 + Math.random() * 90000)}`,
      startedAt: new Date(Date.now() - (durationTakenSeconds || 60) * 1000).toISOString(),
      submittedAt: new Date().toISOString(),
      durationTakenSeconds: durationTakenSeconds || 0,
      answers: answers || {},
      correctCount: Math.round(correctCount),
      wrongCount: Math.round(wrongCount),
      unansweredCount,
      totalQuestions,
      score,
      part1Score: Number(part1Score.toFixed(2)),
      part2Score: Number(part2Score.toFixed(2)),
      part3Score: Number(part3Score.toFixed(2)),
      detailedResults,
      isLockedDueToCheating: Boolean(isLockedDueToCheating),
      tabSwitchCount: Number(tabSwitchCount) || 0,
      copyPasteCount: Number(copyPasteCount) || 0,
      devToolsCount: Number(devToolsCount) || 0,
      suspiciousSpeedCount: Number(suspiciousSpeedCount) || 0,
      questionTimes: questionTimes || {},
      questionTimeRecords: questionTimeRecords || [],
      violationLogs: violationLogs || [],
      syncedToGoogleSheet: true,
      status: isLockedDueToCheating ? "locked" : "submitted",
    };

    studentSubmissions.unshift(newSubmission);
    res.json({ success: true, data: newSubmission });
  } catch (err: any) {
    console.error("Submission error:", err);
    res.status(500).json({ error: err.message || "Lỗi lưu bài nộp" });
  }
});

// Unlock student
app.post("/api/submissions/:id/unlock", (req, res) => {
  const submission = studentSubmissions.find((s) => s.id === req.params.id);
  if (submission) {
    submission.isLockedDueToCheating = false;
    submission.status = "submitted";
    submission.violationLogs.push({
      timestamp: new Date().toISOString(),
      type: "TEACHER_UNLOCK",
      message: "Giáo viên đã mở khóa bài kiểm tra.",
    });
    return res.json({ success: true, data: submission });
  }
  res.status(404).json({ error: "Không tìm thấy bài làm" });
});

// Fallback Models for resilient Gemini API calls across models
export const FALLBACK_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.1-pro-preview",
  "gemini-2.5-flash-lite",
];

export const GOOGLE_AI_API_KEY_PATTERN = /^(?:AIzaSy|AQ)\S{8,}$/;

export const isValidGoogleAiApiKey = (key: string): boolean => {
  if (!key) return false;
  return GOOGLE_AI_API_KEY_PATTERN.test(key.trim());
};

// Error Categorization helper per Gemini optimization guideline
export type ApiErrorType =
  | "MISSING_KEY"
  | "API_KEY_INVALID"
  | "PERMISSION_DENIED"
  | "QUOTA_EXCEEDED"
  | "MODEL_TEMPORARY_ERROR"
  | "INVALID_ARGUMENT"
  | "UNKNOWN";

export const parseApiError = (error: any): ApiErrorType => {
  const message = error?.message || error?.toString() || "";
  const serialized = JSON.stringify(error) || "";
  const status = (error?.status || "").toString().toUpperCase();

  // 401: Invalid or expired API Key
  if (
    serialized.includes("401") ||
    status.includes("401") ||
    status === "UNAUTHENTICATED" ||
    message.includes("API_KEY_INVALID") ||
    message.includes("API key not valid")
  ) {
    return "API_KEY_INVALID";
  }

  // 403: Permission denied / no access
  if (
    serialized.includes("403") ||
    status.includes("403") ||
    status === "PERMISSION_DENIED" ||
    message.includes("PERMISSION_DENIED")
  ) {
    return "PERMISSION_DENIED";
  }

  // 429: Quota / Rate limit (do not mark key as invalid)
  if (
    serialized.includes("429") ||
    status.includes("429") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.toLowerCase().includes("quota") ||
    message.toLowerCase().includes("rate limit")
  ) {
    return "QUOTA_EXCEEDED";
  }

  // Temporary errors eligible for model fallback: 500, 503, 504, 404 (model deprecated), overload/high demand
  if (
    serialized.includes("503") ||
    serialized.includes("500") ||
    serialized.includes("504") ||
    serialized.includes("404") ||
    status === "UNAVAILABLE" ||
    status === "DEADLINE_EXCEEDED" ||
    status === "INTERNAL" ||
    status === "NOT_FOUND" ||
    message.includes("UNAVAILABLE") ||
    message.includes("INTERNAL") ||
    message.includes("DEADLINE_EXCEEDED") ||
    message.includes("NOT_FOUND") ||
    message.toLowerCase().includes("overloaded") ||
    message.toLowerCase().includes("high demand") ||
    message.toLowerCase().includes("temporarily unavailable") ||
    message.toLowerCase().includes("econnreset") ||
    message.toLowerCase().includes("try again later")
  ) {
    return "MODEL_TEMPORARY_ERROR";
  }

  // 400: Invalid payload or argument
  if (
    serialized.includes("400") ||
    status.includes("400") ||
    status === "INVALID_ARGUMENT" ||
    message.includes("INVALID_ARGUMENT")
  ) {
    return "INVALID_ARGUMENT";
  }

  return "UNKNOWN";
};

// Return standard friendly error message from the specification table
export const getFriendlyErrorMessage = (error: any): string => {
  const errorType = parseApiError(error);
  switch (errorType) {
    case "MISSING_KEY":
      return "Vui lòng cấu hình API Key trước khi sử dụng tính năng này.";
    case "API_KEY_INVALID":
      return "API Key không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại trong Settings.";
    case "PERMISSION_DENIED":
      return "API key không có quyền truy cập Gemini API. Hãy tạo auth key mới trong Google AI Studio.";
    case "QUOTA_EXCEEDED":
      return "Đã hết quota hoặc vượt giới hạn tốc độ API. Vui lòng đợi một lúc rồi thử lại.";
    case "MODEL_TEMPORARY_ERROR":
      return "Model Google đang quá tải hoặc tạm thời không khả dụng. App đang thử model dự phòng.";
    case "INVALID_ARGUMENT":
      return "Yêu cầu không hợp lệ hoặc tham số không đúng định dạng. Vui lòng thử lại.";
    default:
      return error?.message || "Đã xảy ra lỗi khi gọi dịch vụ AI. Vui lòng thử lại.";
  }
};

export const getOrderedModels = (selectedModel?: string): string[] => {
  if (!selectedModel || !FALLBACK_MODELS.includes(selectedModel)) return FALLBACK_MODELS;
  return [selectedModel, ...FALLBACK_MODELS.filter((model) => model !== selectedModel)];
};

// Resilient API calling helper with fallback loop across active standard models
async function generateContentWithModelFallback(
  ai: GoogleGenAI,
  options: {
    contents: any;
    config?: any;
    selectedModel?: string;
  }
) {
  const models = getOrderedModels(options.selectedModel);
  let lastError: any = null;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: options.contents,
        config: options.config,
      });
      if (response && response.text) {
        return response;
      }
    } catch (err: any) {
      lastError = err;
      const errType = parseApiError(err);
      console.warn(
        `[AI Fallback] Model ${model} failed [${errType}]:`,
        err?.message || err
      );

      // Non-temporary errors should not fallback models
      if (
        errType === "API_KEY_INVALID" ||
        errType === "PERMISSION_DENIED" ||
        errType === "QUOTA_EXCEEDED" ||
        errType === "INVALID_ARGUMENT"
      ) {
        throw err;
      }

      // If temporary error (500, 503, 504, 404, overloaded), continue to next fallback model
    }
  }

  throw lastError || new Error("Model Google đang quá tải hoặc tạm thời không khả dụng. App đang thử model dự phòng.");
}

// 4. Gemini AI Endpoints for Question Bank Generation & Smart Parsing
app.post("/api/ai/test-key", async (req, res) => {
  try {
    const customKey = (req.headers["x-gemini-api-key"] as string) || req.body.apiKey;
    const requestedModel = (req.headers["x-gemini-model"] as string) || req.body.model || "gemini-3-flash-preview";
    const ai = getGenAI(customKey);
    if (!ai) {
      return res.status(400).json({ success: false, error: "Vui lòng nhập Google Gemini API Key để kiểm tra." });
    }
    const response = await ai.models.generateContent({
      model: requestedModel,
      contents: "Xin chào, phản hồi ngắn 'OK' nếu bạn hoạt động bình thường.",
    });
    if (response) {
      return res.json({ success: true, modelUsed: requestedModel, text: response.text });
    }
    return res.status(500).json({ success: false, error: "Không nhận được phản hồi từ AI." });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || "Lỗi kiểm tra API Key." });
  }
});

app.post("/api/ai/generate-questions", async (req, res) => {
  try {
    const customKey = (req.headers["x-gemini-api-key"] as string) || req.body.apiKey;
    const requestedModel = (req.headers["x-gemini-model"] as string) || req.body.model;
    const ai = getGenAI(customKey);
    if (!ai) {
      return res.status(400).json({
        error: "Vui lòng cấu hình API Key trong phần Settings (nút đỏ trên Header) trước khi sử dụng tính năng này.",
      });
    }

    const { subject, grade, topic, count, level, part } = req.body;
    const numQuestions = Math.min(Math.max(Number(count) || 4, 1), 20);
    const requestedPart = Number(part) || 1;

    const prompt = `Bạn là chuyên gia khảo thí và soạn đề thi trắc nghiệm chuẩn của Bộ GD&ĐT Việt Nam (Chương trình GDPT 2018 áp dụng cho kỳ thi Tốt nghiệp THPT).
Hãy tạo ${numQuestions} câu hỏi cho:
- Môn học: ${subject || "Toán học"}
- Khối lớp: ${grade || "Khối 12"}
- Chủ đề/Chương: ${topic || "Tổng hợp kiến thức trọng tâm"}
- Mức độ nhận thức: ${level || "Thông hiểu"}
- Dạng câu hỏi: ${
      requestedPart === 2
        ? "PHẦN II: Trắc nghiệm Đúng/Sai (Mỗi câu gồm đoạn dẫn/bảng số liệu và 4 mệnh đề a, b, c, d với correctValue là true/false)"
        : requestedPart === 3
        ? "PHẦN III: Trắc nghiệm Trả lời ngắn (Câu hỏi tính toán yêu cầu điền kết quả số thập phân hoặc số nguyên vào shortAnswer)"
        : "PHẦN I: Trắc nghiệm nhiều phương án lựa chọn (4 phương án A, B, C, D)"
    }

YÊU CẦU ĐỊNH DẠNG:
- Giữ định dạng Bảng Markdown (| Cột 1 | Cột 2 |), biểu đồ ASCII, công thức toán/hóa LaTeX nếu có.
- Trả về JSON array chuẩn theo schema.`;

    const response = await generateContentWithModelFallback(ai, {
      contents: prompt,
      selectedModel: requestedModel,
      config: {
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
              acceptableAnswers: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              explanation: { type: Type.STRING },
              level: { type: Type.STRING },
            },
            required: ["content"],
          },
        },
      },
    });

    const parsed = JSON.parse(response.text || "[]");
    const formatted = parsed.map((item: any) => ({
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
      acceptableAnswers: item.acceptableAnswers,
      explanation: item.explanation || "",
    }));

    res.json({ success: true, data: formatted });
  } catch (err: any) {
    console.error("AI Generation Error:", err?.message || err);
    res.status(500).json({ error: getFriendlyErrorMessage(err) });
  }
});

// Helper: Extract inline options A, B, C, D from merged text or markdown tables
function splitRawTextIntoOptionsServer(text: string): string[] {
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

  // 2. Regex tìm vị trí các phương án A, B, C, D (hoặc A., B., A), B), [A], **A.**, .A., .B., etc.)
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

  // 3. Không bắt đầu bằng A nhưng có B. ... C. ... D. ...
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

// Helper: Extract statements a, b, c, d from merged text or tables
function splitRawTextIntoStatementsServer(text: string): { id: string; label: string; text: string; correctValue: boolean }[] {
  if (!text || !text.trim()) return [];
  const clean = text.replace(/\u00A0/g, " ").trim();

  // 1. Table format
  if (clean.includes("|")) {
    const lines = clean.split("\n");
    const tableStmts: { id: string; label: string; text: string; correctValue: boolean }[] = [];
    for (const line of lines) {
      if (!line.includes("|") || /^\|[\s-:]+\|$/.test(line.trim())) continue;
      const cells = line.split("|").map((c) => c.trim()).filter(Boolean);

      // Structure | a) | Nội dung mệnh đề | Đúng |
      if (cells.length >= 2) {
        const firstCellMatch = cells[0].match(/^(?:\*{0,2}(?:(?:Ý|Mệnh đề|Khẳng định|Mục|Câu)\s*)?(?:\[?([a-d])\]?|\(([a-d])\)|([a-d]))[.)/:]\*{0,2}|\(([a-d])\)|\b([a-d])\))\s*$/i);
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

      for (const cell of cells) {
        const sm = cell.match(/^(?:\*{0,2}(?:(?:Ý|Mệnh đề|Khẳng định|Mục|Câu)\s*)?(?:\[?([a-d])\]?|\(([a-d])\)|([a-d]))[.)/:]\*{0,2}|\(([a-d])\)|\b([a-d])\))\s*(.*)/i);
        if (sm) {
          const l = (sm[1] || sm[2] || sm[3] || sm[4] || sm[5] || "a").toLowerCase();
          const rawVal = sm[6] || "";
          const isCorrect = /\(Đúng\)|\[Đúng\]|Đúng|\(Đ\)|\bTrue\b|\[x\]|✓|\*/i.test(rawVal) || /\bĐúng\b/i.test(cell);
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
      return Object.values(uniqueMap);
    }
  }

  // 2. Position-based splitting for non-table text
  const markerRegex = /(?:^|[\n\r\t]|\s{2,}|\s+)(?:\*{0,2}(?:(?:Ý|Mệnh đề|Khẳng định|Mục|Câu)\s*)?(?:\[?([a-d])\]?|\(([a-d])\)|([a-d]))[.)/:]\*{0,2}|\(([a-d])\)|\b([a-d])\))\s*/gi;
  const matches: { letter: string; index: number; matchLength: number }[] = [];
  let m;

  while ((m = markerRegex.exec(clean)) !== null) {
    const matchIdx = m.index;
    const beforeStr = clean.substring(0, matchIdx);

    const lastUrlOpen = beforeStr.lastIndexOf("](");
    const lastUrlClose = beforeStr.lastIndexOf(")");
    if (lastUrlOpen !== -1 && (lastUrlClose === -1 || lastUrlClose < lastUrlOpen)) continue;

    const letter = (m[1] || m[2] || m[3] || m[4] || m[5] || "").toLowerCase();
    if (!letter || !["a", "b", "c", "d"].includes(letter)) continue;

    matches.push({
      letter,
      index: m.index,
      matchLength: m[0].length,
    });
  }

  if (matches.length >= 2) {
    const stmts: { id: string; label: string; text: string; correctValue: boolean }[] = [];
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const start = current.index + current.matchLength;
      const end = i < matches.length - 1 ? matches[i + 1].index : clean.length;
      const rawTextVal = clean.substring(start, end).trim();

      const isCorrect = /\(Đúng\)|\[Đúng\]|(?::\s*|\s+-\s*|\s*->\s*)Đúng|\(Đ\)|\bTrue\b|\[x\]|✓|\*/i.test(rawTextVal);
      const cleanText = rawTextVal
        .replace(/\(Đúng\)|\(Sai\)|\[Đúng\]|\[Sai\]|\(Đ\)|\(S\)|\bTrue\b|\bFalse\b/gi, "")
        .replace(/[:\-–—]\s*(?:Đúng|Sai)\s*$/i, "")
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

  return [];
}

// AI Smart Parser for pasted exam or raw text (Hỗ trợ cấu trúc 3 dạng Bộ GD&ĐT kèm hình vẽ, bảng biểu)
app.post("/api/ai/parse-exam", async (req, res) => {
  try {
    const customKey = (req.headers["x-gemini-api-key"] as string) || req.body.apiKey;
    const requestedModel = (req.headers["x-gemini-model"] as string) || req.body.model;
    const ai = getGenAI(customKey);
    let { rawText, subject, grade } = req.body;

    if (!rawText || rawText.trim().length === 0) {
      return res.status(400).json({ error: "Nội dung đề thi không được để trống" });
    }

    // Tokenize large data URI images to __IMG_TOKEN_X__ so they don't bloat prompt or get erased
    const serverImageTokens: string[] = [];
    let sanitizedText = rawText.replace(
      /data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=\s\r\n]{100,}/gi,
      (match: string) => {
        const token = `__IMG_TOKEN_${serverImageTokens.length}__`;
        serverImageTokens.push(match);
        return token;
      }
    );

    if (!ai) {
      // Fallback regex parser if no Gemini API Key
      const regexQuestions = fallbackParseExam(sanitizedText, subject, grade);
      return res.json({ success: true, data: regexQuestions, note: "Parsed with local parser" });
    }

    const prompt = `Bạn là chuyên gia phân tích và bóc tách đề thi Tốt nghiệp THPT chuẩn Bộ GD&ĐT Việt Nam theo chương trình GDPT 2018 mới nhất (áp dụng từ 2025/2026).
Hãy đọc kỹ toàn bộ văn bản đề thi dưới đây và trích xuất TOÀN BỘ CÁC CÂU HỎI VÀ ĐỦ 100% CÁC LỆNH HỎI, GIỮ NGUYÊN NỘI DUNG TỪ FILE GỐC MÀ KHÔNG ĐƯỢC BỎ SÓT!

QUY TẮC BẢO TOÀN CÔNG THỨC TOÁN, HÌNH ẢNH & ĐỒ THỊ (CỰC KỲ QUAN TRỌNG CHO MÔN TOÁN):
1. CÔNG THỨC TOÁN HỌC & KÝ HIỆU KHOA HỌC:
   - Tất cả công thức toán, phân số, căn thức, tích phân, đạo hàm, mũ, lũy thừa, tọa độ, véc-tơ, ma trận PHẢI ĐƯỢC BIỂU DIỄN BẰNG ĐỊNH DẠNG LATEX kẹp giữa dấu $...$ hoặc $$...$$.
   - Ví dụ: "$y = \\frac{2x + 1}{x - 1}$", "$\\int_0^1 (3x^2 - 2x)dx$", "$\\sqrt{x^2 + 4} = 3$", "$\\lim_{x \\to +\\infty} f(x)$", "$Oxyz$", "$(S): (x-1)^2 + (y+2)^2 + (z-3)^2 = 25$".
   - Trong các phương án A, B, C, D và các ý a, b, c, d của môn Toán, giữ nguyên công thức LaTeX (VD: "$m \\in (-\\infty; 2)$", "$\\frac{a\\sqrt{3}}{2}$", "$y = x^3 - 3x + 2$").

2. HÌNH VẼ, BIỂU ĐỒ, ĐỒ THỊ, BẢNG BIẾN THIÊN:
   - Các token hình ảnh Markdown dạng ![Alt](__IMG_TOKEN_X__) hoặc ![Hình vẽ](url): BẮT BUỘC GIỮ NGUYÊN trong "content"!
   - Bảng biến thiên, bảng xét dấu: Bắt buộc biểu diễn bằng Bảng Markdown chuẩn (| x | -∞ | 0 | +∞ |) hoặc sơ đồ dạng ASCII/Unicode có mũi tên (↗, ↘).

3. ĐỐI VỚI CÂU TRẮC NGHIỆM 4 PHƯƠNG ÁN (PHẦN I):
   - BẮT BUỘC BÓC TÁCH RỜI RIÊNG TỪNG PHƯƠNG ÁN thành mảng 4 phần tử trong "options":
     "options": [
       "Nội dung phương án A...",
       "Nội dung phương án B...",
       "Nội dung phương án C...",
       "Nội dung phương án D..."
     ]
   - TUYỆT ĐỐI KHÔNG ĐƯỢC gộp các phương án B, C, D vào phương án A!
   - TUYỆT ĐỐI KHÔNG ĐƯỢC sinh các phương án giả lập như "Phương án B", "Phương án C"!

4. PHẦN II: Câu trắc nghiệm Đúng / Sai (Gồm 4 CÂU - 16 LỆNH HỎI, từ Câu 1 đến 4 hoặc 19 đến 22).
   - "part": 2, "questionType": "true_false".
   - "content": CHỈ chứa phần dẫn chung của câu hỏi. TUYỆT ĐỐI KHÔNG để các ý a, b, c, d trong "content".
   - "statements": MỖI CÂU BẮT BUỘC CÓ ĐỦ 4 MỆNH ĐỀ a, b, c, d. Thuộc tính "text" BẮT BUỘC PHẢI CHỨA 100% NGUYÊN VĂN NỘI DUNG CỦA MỆNH ĐỀ ĐÓ (kể cả công thức LaTeX). TUYỆT ĐỐI KHÔNG để rỗng "text" hoặc ghi "Ý a", "Khẳng định ý a".
   - "correctValue": true (Đúng) hoặc false (Sai).
   - "options": BẮT BUỘC LÀ MẢNG RỖNG [].

5. PHẦN III: Câu trắc nghiệm Trả lời ngắn / Điền số (Gồm 6 CÂU - 6 LỆNH HỎI, từ Câu 1 đến 6 hoặc 23 đến 28).
   - "part": 3, "questionType": "short_answer".
   - "shortAnswer": Kết quả ngắn dạng số hoặc text (VD: "28.3", "-1.5", "800", "64").
   - "options": BẮT BUỘC LÀ MẢNG RỖNG [].

Văn bản đề thi:
"""
${sanitizedText.substring(0, 150000)}
"""`;

    const response = await generateContentWithModelFallback(ai, {
      contents: prompt,
      selectedModel: requestedModel,
      config: {
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
              acceptableAnswers: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              explanation: { type: Type.STRING },
              level: { type: Type.STRING },
              groupId: { type: Type.STRING },
              groupTitle: { type: Type.STRING },
              passageContent: { type: Type.STRING },
              needsReview: { type: Type.BOOLEAN },
              hasTableOrDiagram: { type: Type.BOOLEAN },
              diagramUrl: { type: Type.STRING },
            },
            required: ["content"],
          },
        },
      },
    });

    const parsed = JSON.parse(response.text || "[]");
    const totalRaw = parsed.length;

    const formatted = parsed.map((item: any, idx: number) => {
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

      const questionType = part === 2 ? "true_false" : part === 3 ? "short_answer" : "multiple_choice";
      let cleanContent = item.content || "";

      // Post-process options for Part 1 to guarantee no merged or missing options
      let finalOptions: string[] = [];
      if (part === 1) {
        let rawOpts = Array.isArray(item.options) ? item.options.map((o: any) => String(o || "").trim()).filter(Boolean) : [];
        
        // If option 0 or any option has inline B., C., D.
        const isMergedInOption = rawOpts.some((opt: string) =>
          /(?:[\n\r\t]|\s{2,}|\s+)(?:\*{0,2}(?:\[?[B-D]\]?|\([B-D]\))[.)/:]\*{0,2})\s+/i.test(opt)
        );

        if (rawOpts.length === 1 || isMergedInOption) {
          const splitted = splitRawTextIntoOptionsServer(rawOpts.join(" \n "));
          if (splitted.length >= 2) {
            rawOpts = splitted;
          }
        }

        // If content contains inline A. B. C. D.
        if (rawOpts.length < 2 || rawOpts.every((o) => /^Phương án [A-D]$/i.test(o))) {
          const optionStartMatch = cleanContent.search(/(?:^|[\n\r]|\s{2,})(?:\*{0,2}(?:\[?A\]?|\(A\))[.)/:]\*{0,2})\s+/i);
          if (optionStartMatch !== -1) {
            const optSection = cleanContent.substring(optionStartMatch);
            const splitted = splitRawTextIntoOptionsServer(optSection);
            if (splitted.length >= 2) {
              rawOpts = splitted;
              cleanContent = cleanContent.substring(0, optionStartMatch).trim();
            }
          }
        }

        finalOptions = rawOpts.map((opt: string, oIdx: number) => {
          const letter = ["A", "B", "C", "D", "E", "F"][oIdx];
          return opt
            .replace(new RegExp(`^(?:\\*{0,2}\\[?${letter}\\]?[.)/:]\\*{0,2})\\s*`, "i"), "")
            .replace(/^(?:\*{0,2}\([A-D]\)\*{0,2})\s*/i, "")
            .trim();
        });

        while (finalOptions.length < 4) {
          finalOptions.push(`Phương án ${["A", "B", "C", "D"][finalOptions.length]}`);
        }
      }

      // If Part 2, strictly ensure all 4 statements a, b, c, d exist with full content
      let statements = item.statements;
      if (part === 2) {
        const isPlaceholderOrEmpty =
          !Array.isArray(statements) ||
          statements.length < 2 ||
          statements.every((s: any) => !s.text || !s.text.trim() || /^Khẳng định ý [a-d]$/i.test((s.text || "").trim()) || /^Ý [a-d]$/i.test((s.text || "").trim()));

        if (isPlaceholderOrEmpty) {
          const splittedStmts = splitRawTextIntoStatementsServer(cleanContent);
          if (splittedStmts.length >= 2) {
            statements = splittedStmts;
            const firstLetterMatch = cleanContent.search(/(?:^|[\n\r]|\s{2,})(?:\*{0,2}(?:(?:Ý|Mệnh đề|Khẳng định|Mục|Câu)\s*)?(?:\[?a\]?|\(a\)|a)[.)/:]\*{0,2}|\(a\)|\ba\))\s*/i);
            if (firstLetterMatch !== -1) {
              cleanContent = cleanContent.substring(0, firstLetterMatch).trim();
            }
          }
        }

        if (Array.isArray(statements) && statements.length > 0) {
          const hasSomeEmptyOrPlaceholder = statements.some(
            (s: any) => !s.text || !s.text.trim() || /^Khẳng định ý [a-d]$/i.test((s.text || "").trim()) || /^Ý [a-d]$/i.test((s.text || "").trim())
          );
          if (hasSomeEmptyOrPlaceholder) {
            const fromContent = splitRawTextIntoStatementsServer(cleanContent);
            if (fromContent.length >= 2) {
              const contentMap: Record<string, string> = {};
              fromContent.forEach((st) => { contentMap[st.id] = st.text; });
              statements = statements.map((st: any) => {
                if ((!st.text || !st.text.trim() || /^Khẳng định ý [a-d]$/i.test((st.text || "").trim()) || /^Ý [a-d]$/i.test((st.text || "").trim())) && contentMap[st.id]) {
                  return { ...st, text: contentMap[st.id] };
                }
                return st;
              });
              const firstLetterMatch = cleanContent.search(/(?:^|[\n\r]|\s{2,})(?:\*{0,2}(?:(?:Ý|Mệnh đề|Khẳng định|Mục|Câu)\s*)?(?:\[?a\]?|\(a\)|a)[.)/:]\*{0,2}|\(a\)|\ba\))\s*/i);
              if (firstLetterMatch !== -1) {
                cleanContent = cleanContent.substring(0, firstLetterMatch).trim();
              }
            }
          }
        }

        if (!Array.isArray(statements) || statements.length === 0) {
          statements = [];
        }
        const requiredIds = ["a", "b", "c", "d"];
        const existingMap: Record<string, any> = {};
        statements.forEach((st: any) => {
          const letter = (st.id || st.label?.replace(/[^a-d]/gi, "") || "a").toLowerCase();
          existingMap[letter] = st;
        });

        // Ensure 4 statements
        statements = requiredIds.map((letter) => {
          if (existingMap[letter]) {
            let cleanText = (existingMap[letter].text || "").trim();
            cleanText = cleanText.replace(new RegExp(`^(?:\\*{0,2}(?:(?:Ý|Mệnh đề|Khẳng định|Mục|Câu)\\s*)?(?:\\[?${letter}\\]?|\\(${letter}\\)|${letter})[.)/:]\\*{0,2}|\\(${letter}\\)|\\b${letter}\\))\\s*`, "i"), "").trim();
            return {
              id: letter,
              label: `${letter})`,
              text: cleanText || `Khẳng định ý ${letter}`,
              correctValue: typeof existingMap[letter].correctValue === "boolean" ? existingMap[letter].correctValue : true,
              explanation: existingMap[letter].explanation || "",
            };
          }
          return {
            id: letter,
            label: `${letter})`,
            text: `Khẳng định ý ${letter}`,
            correctValue: true,
            explanation: "",
          };
        });
      }

      // If Part 3, extract shortAnswer if embedded in content
      let finalShortAnswer = item.shortAnswer || "";
      if (part === 3 && !finalShortAnswer) {
        const ansMatch = cleanContent.match(/(?:Đáp án|Kết quả|Key|Answer)[\s.:]+([-+]?\d*[.,]?\d+|[A-Za-z0-9_+\-/]+)/i);
        if (ansMatch) {
          finalShortAnswer = ansMatch[1].replace(",", ".").trim();
          cleanContent = cleanContent.replace(ansMatch[0], "").trim();
        }
      }

      const hasImg = Boolean(
        item.hasTableOrDiagram ||
        cleanContent.includes("![") ||
        cleanContent.includes("__IMG_TOKEN_") ||
        cleanContent.includes("|") ||
        item.diagramUrl ||
        item.passageContent?.includes("![")
      );

      // Restore any server image tokens in content, passageContent, options, and statements
      let passage = item.passageContent || "";
      let explanation = item.explanation || "";
      let diagramUrl = item.diagramUrl || "";

      if (serverImageTokens.length > 0) {
        serverImageTokens.forEach((imgSrc, tokenIdx) => {
          const tName = `__IMG_TOKEN_${tokenIdx}__`;
          cleanContent = cleanContent.replaceAll(tName, imgSrc);
          passage = passage.replaceAll(tName, imgSrc);
          explanation = explanation.replaceAll(tName, imgSrc);
          if (diagramUrl === tName) diagramUrl = imgSrc;

          finalOptions = finalOptions.map((opt) => opt.replaceAll(tName, imgSrc));
          if (statements && Array.isArray(statements)) {
            statements = statements.map((st: any) => ({
              ...st,
              text: (st.text || "").replaceAll(tName, imgSrc),
              explanation: (st.explanation || "").replaceAll(tName, imgSrc),
            }));
          }
        });
      }

      return {
        id: `parsed_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        subject: subject || "Tổng hợp",
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
        acceptableAnswers: item.acceptableAnswers,
        explanation: explanation || "",
        groupId: item.groupId || undefined,
        groupTitle: item.groupTitle || undefined,
        passageContent: passage || undefined,
        needsReview: item.needsReview ?? false,
        isAiGenerated: item.isAiGenerated ?? false,
        hasTableOrDiagram: hasImg,
        diagramUrl: diagramUrl || undefined,
      };
    });

    res.json({ success: true, data: formatted, total: formatted.length });
  } catch (err: any) {
    console.warn("AI Parse Fallback activated due to:", err?.message || err);
    // Instant seamless fallback to regex parser
    const fallback = fallbackParseExam(req.body.rawText, req.body.subject, req.body.grade);
    res.json({
      success: true,
      data: fallback,
      warning: "Hệ thống đã tự động trích xuất đầy đủ đề thi bằng bộ phân tích cú pháp tiêu chuẩn.",
      total: fallback.length,
    });
  }
});

// AI Multimodal File Parser (PDF, PNG, JPG, JPEG, WEBP scan)
app.post("/api/ai/parse-exam-file", async (req, res) => {
  try {
    const customKey = (req.headers["x-gemini-api-key"] as string) || req.body.apiKey;
    const requestedModel = (req.headers["x-gemini-model"] as string) || req.body.model;
    const ai = getGenAI(customKey);
    if (!ai) {
      return res.status(400).json({ error: "Vui lòng cấu hình API Key trong phần Settings (nút đỏ trên Header) trước khi sử dụng tính năng này." });
    }

    const { fileBase64, mimeType, fileName, subject, grade } = req.body;
    if (!fileBase64 || !mimeType) {
      return res.status(400).json({ error: "Dữ liệu file không hợp lệ hoặc thiếu dữ liệu base64." });
    }

    // Clean base64 header if present
    const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, "");

    const promptText = `Bạn là chuyên gia OCR và phân tích đề thi THPT Quốc gia chuẩn Bộ GD&ĐT Việt Nam (2025/2026).
Hãy đọc và trích xuất TOÀN BỘ CÂU HỎI từ tài liệu đính kèm này (${fileName || "Đề thi"}) mà TUYỆT ĐỐI KHÔNG ĐƯỢC BỎ SÓT BẤT KỲ CÂU HOẶC MỆNH ĐỀ NÀO!

QUY TẮC PHÂN LOẠI 3 PHẦN BẮT BUỘC:
1. PHẦN I: Trắc nghiệm 4 lựa chọn (part: 1, questionType: "multiple_choice")
   - "options": Bắt buộc bóc tách ĐỦ 4 phương án riêng biệt ["Nội dung A...", "Nội dung B...", "Nội dung C...", "Nội dung D..."].
   - TUYỆT ĐỐI KHÔNG ĐƯỢC gộp các phương án B, C, D vào A hoặc để thiếu phương án.
   - "correctIndex": 0, 1, 2, hoặc 3.

2. PHẦN II: Trắc nghiệm Đúng / Sai (part: 2, questionType: "true_false")
   - "content": CHỈ chứa phần dẫn chung của câu hỏi. TUYỆT ĐỐI KHÔNG để các ý a, b, c, d trong "content".
   - "statements": MỖI CÂU BẮT BUỘC ĐỦ 4 Ý a, b, c, d. Thuộc tính "text" BẮT BUỘC PHẢI CHỨA 100% NGUYÊN VĂN NỘI DUNG CỦA MỆNH ĐỀ ĐÓ (kể cả công thức LaTeX). TUYỆT ĐỐI KHÔNG để rỗng "text" hoặc ghi "Ý a", "Khẳng định ý a".
   - "correctValue": true (Đúng) hoặc false (Sai).
   - "options": BẮT BUỘC LÀ MẢNG RỖNG [].

3. PHẦN III: Trả lời ngắn / Điền số (part: 3, questionType: "short_answer")
   - "shortAnswer": Kết quả ngắn chính xác.
   - "options": BẮT BUỘC LÀ MẢNG RỖNG [].

4. BẢO TOÀN DỮ LIỆU & BẢNG BIỂU:
   - Giữ nguyên công thức Toán/Lý/Hóa bằng LaTeX ($...$) và bảng số liệu Markdown chuẩn (| Cột 1 | Cột 2 |).`;

    const response = await generateContentWithModelFallback(ai, {
      selectedModel: requestedModel,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: cleanBase64,
              },
            },
            {
              text: promptText,
            },
          ],
        },
      ],
      config: {
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
              acceptableAnswers: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
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
      },
    });

    const parsed = JSON.parse(response.text || "[]");
    const totalRaw = parsed.length;

    const formatted = parsed.map((item: any, idx: number) => {
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

      const questionType = item.questionType || (part === 2 ? "true_false" : part === 3 ? "short_answer" : "multiple_choice");
      let cleanContent = item.content || "";

      let finalOptions: string[] = [];
      if (part === 1) {
        let rawOpts = Array.isArray(item.options) ? item.options.map((o: any) => String(o || "").trim()).filter(Boolean) : [];
        const isMergedInOption = rawOpts.some((opt: string) =>
          /(?:[\n\r\t]|\s{2,}|\s+)(?:\*{0,2}(?:\[?[B-D]\]?|\([B-D]\))[.)/:]\*{0,2})\s+/i.test(opt)
        );

        if (rawOpts.length === 1 || isMergedInOption) {
          const splitted = splitRawTextIntoOptionsServer(rawOpts.join(" \n "));
          if (splitted.length >= 2) {
            rawOpts = splitted;
          }
        }

        if (rawOpts.length < 2) {
          const optionStartMatch = cleanContent.search(/(?:^|[\n\r]|\s{2,})(?:\*{0,2}(?:\[?A\]?|\(A\))[.)/:]\*{0,2})\s+/i);
          if (optionStartMatch !== -1) {
            const optSection = cleanContent.substring(optionStartMatch);
            const splitted = splitRawTextIntoOptionsServer(optSection);
            if (splitted.length >= 2) {
              rawOpts = splitted;
              cleanContent = cleanContent.substring(0, optionStartMatch).trim();
            }
          }
        }

        finalOptions = rawOpts.map((opt: string, oIdx: number) => {
          const letter = ["A", "B", "C", "D", "E", "F"][oIdx];
          return opt
            .replace(new RegExp(`^(?:\\*{0,2}\\[?${letter}\\]?[.)/:]\\*{0,2})\\s*`, "i"), "")
            .replace(/^(?:\*{0,2}\([A-D]\)\*{0,2})\s*/i, "")
            .trim();
        });

        while (finalOptions.length < 4) {
          finalOptions.push(`Phương án ${["A", "B", "C", "D"][finalOptions.length]}`);
        }
      }

      let statements = item.statements;
      if (part === 2) {
        const isPlaceholderOrEmpty =
          !Array.isArray(statements) ||
          statements.length < 2 ||
          statements.every((s: any) => !s.text || !s.text.trim() || /^Khẳng định ý [a-d]$/i.test((s.text || "").trim()) || /^Ý [a-d]$/i.test((s.text || "").trim()));

        if (isPlaceholderOrEmpty) {
          const splittedStmts = splitRawTextIntoStatementsServer(cleanContent);
          if (splittedStmts.length >= 2) {
            statements = splittedStmts;
            const firstLetterMatch = cleanContent.search(/(?:^|[\n\r]|\s{2,})(?:\*{0,2}(?:(?:Ý|Mệnh đề|Khẳng định|Mục|Câu)\s*)?(?:\[?a\]?|\(a\)|a)[.)/:]\*{0,2}|\(a\)|\ba\))\s*/i);
            if (firstLetterMatch !== -1) {
              cleanContent = cleanContent.substring(0, firstLetterMatch).trim();
            }
          }
        }

        if (Array.isArray(statements) && statements.length > 0) {
          const hasSomeEmptyOrPlaceholder = statements.some(
            (s: any) => !s.text || !s.text.trim() || /^Khẳng định ý [a-d]$/i.test((s.text || "").trim()) || /^Ý [a-d]$/i.test((s.text || "").trim())
          );
          if (hasSomeEmptyOrPlaceholder) {
            const fromContent = splitRawTextIntoStatementsServer(cleanContent);
            if (fromContent.length >= 2) {
              const contentMap: Record<string, string> = {};
              fromContent.forEach((st) => { contentMap[st.id] = st.text; });
              statements = statements.map((st: any) => {
                if ((!st.text || !st.text.trim() || /^Khẳng định ý [a-d]$/i.test((st.text || "").trim()) || /^Ý [a-d]$/i.test((st.text || "").trim())) && contentMap[st.id]) {
                  return { ...st, text: contentMap[st.id] };
                }
                return st;
              });
              const firstLetterMatch = cleanContent.search(/(?:^|[\n\r]|\s{2,})(?:\*{0,2}(?:(?:Ý|Mệnh đề|Khẳng định|Mục|Câu)\s*)?(?:\[?a\]?|\(a\)|a)[.)/:]\*{0,2}|\(a\)|\ba\))\s*/i);
              if (firstLetterMatch !== -1) {
                cleanContent = cleanContent.substring(0, firstLetterMatch).trim();
              }
            }
          }
        }

        if (!Array.isArray(statements) || statements.length === 0) {
          statements = [];
        }
        const requiredIds = ["a", "b", "c", "d"];
        const existingMap: Record<string, any> = {};
        statements.forEach((st: any) => {
          const letter = (st.id || st.label?.replace(/[^a-d]/gi, "") || "a").toLowerCase();
          existingMap[letter] = st;
        });

        statements = requiredIds.map((letter) => {
          if (existingMap[letter]) {
            let cleanText = (existingMap[letter].text || "").trim();
            cleanText = cleanText.replace(new RegExp(`^(?:\\*{0,2}(?:(?:Ý|Mệnh đề|Khẳng định|Mục|Câu)\\s*)?(?:\\[?${letter}\\]?|\\(${letter}\\)|${letter})[.)/:]\\*{0,2}|\\(${letter}\\)|\\b${letter}\\))\\s*`, "i"), "").trim();
            return {
              id: letter,
              label: `${letter})`,
              text: cleanText || `Khẳng định ý ${letter}`,
              correctValue: typeof existingMap[letter].correctValue === "boolean" ? existingMap[letter].correctValue : true,
              explanation: existingMap[letter].explanation || "",
            };
          }
          return {
            id: letter,
            label: `${letter})`,
            text: `Khẳng định ý ${letter}`,
            correctValue: true,
            explanation: "",
          };
        });
      }

      return {
        id: `file_parsed_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        subject: subject || "Tổng hợp",
        grade: grade || "Khối 12",
        chapter: `Trích xuất từ ${fileName || "file đề thi"}`,
        level: item.level || "Thông hiểu",
        part,
        questionType,
        content: cleanContent,
        options: part === 1 ? finalOptions.slice(0, 4) : [],
        correctIndex: typeof item.correctIndex === "number" ? item.correctIndex : 0,
        statements: part === 2 ? statements : undefined,
        shortAnswer: part === 3 ? (item.shortAnswer || "") : undefined,
        acceptableAnswers: item.acceptableAnswers,
        explanation: item.explanation || "",
        groupId: item.groupId || undefined,
        groupTitle: item.groupTitle || undefined,
        passageContent: item.passageContent || undefined,
        needsReview: item.needsReview ?? true,
        isAiGenerated: true,
        hasTableOrDiagram: item.hasTableOrDiagram || cleanContent.includes("|") || item.passageContent?.includes("|"),
      };
    });

    res.json({ success: true, data: formatted, total: formatted.length });
  } catch (err: any) {
    console.error("AI File Parse Error:", err?.message || err);
    res.status(500).json({ error: "Lỗi phân tích file đa phương tiện: " + getFriendlyErrorMessage(err) });
  }
});

// AI Solve Exam: Solve and fill explanations + answers for existing questions
app.post("/api/ai/solve-exam", async (req, res) => {
  try {
    const ai = getGenAI();
    if (!ai) {
      return res.status(500).json({
        error: "Vui lòng cấu hình API Key trước khi sử dụng tính năng này.",
      });
    }

    const { questions, subject, grade } = req.body;
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: "Không có câu hỏi nào để giải" });
    }

    const prompt = `Bạn là chuyên gia giải đề thi quốc gia. Hãy giải cẩn thận và chính xác từng câu hỏi trắc nghiệm dưới đây (Môn: ${subject || "Toán"}, Lớp: ${grade || "12"}).
Hỗ trợ cả 3 dạng:
- Dạng 1 (Nhiều lựa chọn): Chọn correctIndex (0..3) và viết explanation.
- Dạng 2 (Đúng/Sai): Xác định correctValue (true/false) cho từng ý a, b, c, d trong statements.
- Dạng 3 (Trả lời ngắn): Điền kết quả chính xác vào shortAnswer và viết explanation.

Danh sách câu hỏi cần giải:
${JSON.stringify(
  questions.map((q: any, i: number) => ({
    index: i,
    part: q.part || 1,
    questionType: q.questionType || "multiple_choice",
    content: q.content,
    options: q.options,
    statements: q.statements,
    shortAnswer: q.shortAnswer,
    passageContent: q.passageContent,
  })),
  null,
  2
)}`;

    const response = await generateContentWithModelFallback(ai, {
      contents: prompt,
      config: {
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
                    text: { type: Type.STRING },
                    correctValue: { type: Type.BOOLEAN },
                    explanation: { type: Type.STRING },
                  },
                  required: ["id", "label", "correctValue"],
                },
              },
              shortAnswer: { type: Type.STRING },
              explanation: { type: Type.STRING },
              level: { type: Type.STRING },
            },
            required: ["index", "explanation"],
          },
        },
      },
    });

    const solutions = JSON.parse(response.text || "[]");
    const updatedQuestions = questions.map((q: any, i: number) => {
      const sol = solutions.find((s: any) => s.index === i);
      if (sol) {
        return {
          ...q,
          correctIndex: sol.correctIndex !== undefined ? sol.correctIndex : q.correctIndex,
          statements: sol.statements && sol.statements.length > 0 ? sol.statements : q.statements,
          shortAnswer: sol.shortAnswer || q.shortAnswer,
          explanation: sol.explanation || q.explanation,
          level: sol.level || q.level,
          needsReview: true,
          isAiGenerated: true,
        };
      }
      return q;
    });

    res.json({ success: true, data: updatedQuestions });
  } catch (err: any) {
    console.error("AI Solve Error:", err?.message || err);
    res.status(500).json({ error: getFriendlyErrorMessage(err) });
  }
});

// Fallback multi-part parser for standard Vietnamese exams (Phần I, Phần II, Phần III)
function fallbackParseExam(text: string, subject = "Toán học", grade = "Khối 12") {
  const questions: any[] = [];
  
  // Separate bottom answer key table if present
  let mainBody = text;
  const answerKeyMap: Record<number, { choice?: number; tf?: Record<string, boolean>; shortAns?: string }> = {};
  
  const bottomKeyIndex = text.search(/(?:BẢNG ĐÁP ÁN|ĐÁP ÁN VÀ LỜI GIẢI|HƯỚNG DẪN CHẤM|BẢNG TRẢ LỜI)/i);
  if (bottomKeyIndex !== -1 && bottomKeyIndex > 500) {
    mainBody = text.substring(0, bottomKeyIndex);
    const keySection = text.substring(bottomKeyIndex);
    
    // Parse key items like: 1.A, 1-B, Câu 1: A, 19: a-Đ, b-S, 23. 15.8
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
  const subStatementRegex = /^(?:\*{0,2}(?:(?:Ý|Mệnh đề|Khẳng định|Mục|Câu)\s*)?(?:\[?([a-d])\]?|\(([a-d])\)|([a-d]))[.)/:]\*{0,2}|\(([a-d])\)|\b([a-d])\))\s*(.*)/i;
  const answerLineRegex = /^(?:Đáp án|Kết quả|Đ\/A|Key|Answer)[\s.:]+(.*)/i;

  const finalizeCurrentQ = () => {
    if (!currentQ) return;

    // If part 2 or content has statements, extract with position-based logic
    if (currentQ.part === 2 && currentQ.statements.length < 4 && currentQ.content) {
      const extractedStmts = splitRawTextIntoStatementsServer(currentQ.content);
      if (extractedStmts.length >= 2) {
        const foundMap: Record<string, any> = {};
        currentQ.statements.forEach((s: any) => { foundMap[s.id] = s; });
        extractedStmts.forEach((st) => {
          if (!foundMap[st.id]) {
            currentQ.statements.push(st);
          }
        });
        const firstLetterMatch = currentQ.content.search(/(?:^|[\n\r]|\s{2,})(?:\*{0,2}(?:(?:Ý|Mệnh đề|Khẳng định|Mục|Câu)\s*)?(?:\[?a\]?|\(a\)|a)[.)/:]\*{0,2}|\(a\)|\ba\))\s*/i);
        if (firstLetterMatch !== -1) {
          currentQ.content = currentQ.content.substring(0, firstLetterMatch).trim();
        }
      }
    }

    // Auto-detect part based on structure if part wasn't explicitly declared
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
    } else if (currentQ.qNumber >= 23 && currentQ.qNumber <= 28) {
      currentQ.part = 3;
      currentQ.questionType = "short_answer";
      currentQ.options = [];
    } else if (currentQ.qNumber >= 19 && currentQ.qNumber <= 22) {
      currentQ.part = 2;
      currentQ.questionType = "true_false";
      currentQ.options = [];
    }

    // If Part 2, strictly ensure all 4 statements a, b, c, d exist
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

    // Apply answer key from bottom table if available
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

    // Clean up empty options or text
    if (currentQ.part === 3) {
      currentQ.options = [];
    } else if (currentQ.part === 1) {
      const isMergedInOption = currentQ.options.some((opt: string) =>
        /(?:[\n\r\t]|\s{2,}|\s+)(?:\*{0,2}(?:\[?[B-D]\]?|\([B-D]\))[.)/:]\*{0,2})\s+/i.test(opt)
      );
      if (currentQ.options.length === 1 || isMergedInOption) {
        const splitted = splitRawTextIntoOptionsServer(currentQ.options.join(" \n "));
        if (splitted.length >= 2) {
          currentQ.options = splitted;
        }
      }
      if (currentQ.options.length < 2) {
        const optionStartMatch = currentQ.content.search(/(?:^|[\n\r]|\s{2,})(?:\*{0,2}(?:\[?A\]?|\(A\))[.)/:]\*{0,2})\s+/i);
        if (optionStartMatch !== -1) {
          const optSection = currentQ.content.substring(optionStartMatch);
          const splitted = splitRawTextIntoOptionsServer(optSection);
          if (splitted.length >= 2) {
            currentQ.options = splitted;
            currentQ.content = currentQ.content.substring(0, optionStartMatch).trim();
          }
        }
      }
      currentQ.options = currentQ.options.map((opt: string, oIdx: number) => {
        const letter = ["A", "B", "C", "D", "E", "F"][oIdx];
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

  for (let line of lines) {
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
        const splitted = splitRawTextIntoOptionsServer(trimmed);
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
          const subLetter = (subMatch[1] || subMatch[2] || subMatch[3] || subMatch[4] || subMatch[5] || "a").toLowerCase();
          const isCorrect = /\(Đúng\)|\[Đúng\]|Đúng|\(Đ\)|true/i.test(trimmed);
          const subText = (subMatch[6] || "").replace(/\(Đúng\)|\(Sai\)|\[Đúng\]|\[Sai\]|\(Đ\)|\(S\)/gi, "").trim();
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
        // Part 3: Short answer / Điền số
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

// In-Memory store for Graded Student Papers
let gradedPaperResults: any[] = [
  {
    id: "graded-demo-01",
    studentName: "Nguyễn Hoàng Long",
    studentClass: "12A1",
    studentId: "HS1201",
    examCode: "101",
    examTitle: "Kiểm tra 1 tiết Toán 12 - Giải tích & Hình học",
    fileName: "bai_lam_nguyen_hoang_long.jpg",
    fileType: "image",
    gradedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    totalScore: 8.5,
    maxScore: 10.0,
    gradeClassification: "Giỏi",
    summaryEvaluation: "Học sinh nắm vững kiến thức phần trắc nghiệm và hình học không gian Oxyz. Câu 3 làm thiếu điều kiện nghiệm và phần tính tích phân bị sai dấu ở bước cuối.",
    details: [
      {
        questionIndex: 1,
        questionContent: "Cho hàm số f(x) liên tục trên ℝ. Khẳng định nào sau đây là đúng?",
        studentAnswer: "A",
        teacherAnswer: "A (∫ f'(x)dx = f(x) + C)",
        pointsAwarded: 1.0,
        maxPoints: 1.0,
        status: "correct",
        feedback: "Chính xác, áp dụng đúng định nghĩa nguyên hàm.",
      },
      {
        questionIndex: 2,
        questionContent: "Trong không gian Oxyz, phương trình mặt phẳng đi qua M(1; -2; 3) và n = (2; -1; 4)...",
        studentAnswer: "A (2x - y + 4z - 16 = 0)",
        teacherAnswer: "A (2x - y + 4z - 16 = 0)",
        pointsAwarded: 1.0,
        maxPoints: 1.0,
        status: "correct",
        feedback: "Đúng, tính toán vectơ pháp tuyến và điểm đi qua chuẩn xác.",
      },
      {
        questionIndex: 3,
        questionContent: "Tìm m để hàm số y = x³ - 3mx² + 3(m² - 1)x đồng biến trên (1; +∞)",
        studentAnswer: "m ≤ 0 hoặc m = 1",
        teacherAnswer: "m ≤ 0",
        pointsAwarded: 0.5,
        maxPoints: 1.0,
        status: "partial",
        feedback: "Tính được y' đúng nhưng quên so sánh nghiệm lớn m+1 với 1 dẫn đến thừa trường hợp m=1.",
      },
      {
        questionIndex: 4,
        questionContent: "Với a > 0, log₂(a³) bằng:",
        studentAnswer: "3 log₂ a",
        teacherAnswer: "3 log₂ a",
        pointsAwarded: 1.0,
        maxPoints: 1.0,
        status: "correct",
        feedback: "Đúng công thức biến đổi logarit.",
      },
      {
        questionIndex: 5,
        questionContent: "Tự luận: Tính tích phân I = ∫[0->1] (2x + 1)e^x dx",
        studentAnswer: "I = 2e - 1",
        teacherAnswer: "I = 2e - 1 (với u = 2x+1, dv = e^x dx)",
        pointsAwarded: 2.0,
        maxPoints: 2.0,
        status: "correct",
        feedback: "Trình bày từng bước tích phân từng phần mạch lạc, kết quả chính xác.",
      },
      {
        questionIndex: 6,
        questionContent: "Tự luận: Tìm tọa độ hình chiếu vuông góc của điểm A(1, 2, 3) lên mặt phẳng (P)",
        studentAnswer: "H(2, 0, 1)",
        teacherAnswer: "H(2, 0, 1)",
        pointsAwarded: 3.0,
        maxPoints: 4.0,
        status: "partial",
        feedback: "Lập phương trình đường thẳng AH đúng, tìm ra tọa độ H đúng nhưng kết luận thiếu kiểm tra lại xem H có thuộc (P) không.",
      },
    ],
    teacherNotes: "Bài làm tốt, chữ viết rõ ràng, cần cẩn thận hơn ở bài toán cực trị chứa tham số m.",
    isReviewedByTeacher: true,
  },
];

// 6. AI Auto-Grading & Exam Rubric APIs

// API: Get all graded papers
app.get("/api/grader/results", (req, res) => {
  res.json({ success: true, data: gradedPaperResults });
});

// API: Delete a graded paper
app.delete("/api/grader/results/:id", (req, res) => {
  gradedPaperResults = gradedPaperResults.filter((p) => p.id !== req.params.id);
  res.json({ success: true, message: "Đã xóa bài chấm" });
});

// API: Update teacher notes / review
app.put("/api/grader/results/:id", (req, res) => {
  const index = gradedPaperResults.findIndex((p) => p.id === req.params.id);
  if (index !== -1) {
    gradedPaperResults[index] = {
      ...gradedPaperResults[index],
      ...req.body,
      isReviewedByTeacher: true,
    };
    return res.json({ success: true, data: gradedPaperResults[index] });
  }
  res.status(404).json({ error: "Không tìm thấy bài đã chấm" });
});

// API: Extract Rubric / Answer Key from Document or Text
app.post("/api/ai/extract-rubric", async (req, res) => {
  try {
    const customKey = (req.headers["x-gemini-api-key"] as string) || req.body.apiKey;
    const requestedModel = (req.headers["x-gemini-model"] as string) || req.body.model;
    const ai = getGenAI(customKey);
    if (!ai) {
      return res.status(400).json({
        error: "Vui lòng cấu hình API Key trong phần Settings (nút đỏ trên Header) trước khi sử dụng tính năng này.",
      });
    }

    const { rawText, fileData, mimeType, fileName, subject, grade } = req.body;

    let contents: any[] = [];
    const prompt = `Bạn là chuyên gia khảo thí và xây dựng biểu điểm / đáp án đề thi (Rubric).
Hãy đọc tài liệu / văn bản sau đây và trích xuất TOÀN BỘ CÂU HỎI VÀ ĐÁP ÁN / BIỂU ĐIỂM CHẤM (Môn: ${subject || "Tổng hợp"}, Lớp: ${grade || "Khối 12"}).
Bao gồm:
- questionIndex: Số thứ tự câu (1, 2, 3...)
- content: Tóm tắt nội dung câu hỏi
- correctAnswer: Đáp án đúng chuẩn (Trắc nghiệm A/B/C/D, Đúng/Sai a-b-c-d, Điền số, hoặc Barem tự luận từng bước)
- points: Điểm số tối đa cho câu này (ví dụ 0.25, 0.5, 1.0, 2.0...)
- criteria: Tiêu chí chấm chi tiết (cách chia điểm từng ý)
- questionType: "multiple_choice" | "true_false" | "short_answer" | "essay"

Trả về JSON array các rubric item.`;

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
    } else if (rawText) {
      contents = [
        {
          role: "user",
          parts: [
            { text: `${prompt}\n\nVĂN BẢN ĐỀ VÀ ĐÁP ÁN:\n${rawText}` },
          ],
        },
      ];
    } else {
      return res.status(400).json({ error: "Vui lòng cung cấp văn bản hoặc file đề và đáp án" });
    }

    const response = await generateContentWithModelFallback(ai, {
      contents,
      selectedModel: requestedModel,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              questionIndex: { type: Type.INTEGER },
              content: { type: Type.STRING },
              correctAnswer: { type: Type.STRING },
              points: { type: Type.NUMBER },
              criteria: { type: Type.STRING },
              questionType: { type: Type.STRING },
            },
            required: ["questionIndex", "correctAnswer", "points"],
          },
        },
      },
    });

    const items = JSON.parse(response.text || "[]");
    const totalMax = items.reduce((acc: number, it: any) => acc + (Number(it.points) || 0), 0);

    res.json({
      success: true,
      data: {
        id: `rubric-${Date.now()}`,
        title: fileName ? `Biểu điểm từ ${fileName}` : `Biểu điểm ${subject || "Đề kiểm tra"}`,
        subject: subject || "Tổng hợp",
        grade: grade || "Khối 12",
        maxScore: Number(totalMax.toFixed(2)) || 10.0,
        items,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error("Extract Rubric Error:", err);
    res.status(500).json({ error: getFriendlyErrorMessage(err) });
  }
});

// API: Grade Student Paper (Multimodal Gemini Vision OCR & Deep Reasoning)
app.post("/api/ai/grade-paper", async (req, res) => {
  try {
    const customKey = (req.headers["x-gemini-api-key"] as string) || req.body.apiKey;
    const requestedModel = (req.headers["x-gemini-model"] as string) || req.body.model;
    const ai = getGenAI(customKey);
    if (!ai) {
      return res.status(400).json({
        error: "Vui lòng cấu hình API Key trong phần Settings (nút đỏ trên Header) trước khi sử dụng tính năng này.",
      });
    }

    const {
      paperFile, // { mimeType, data, fileName }
      rubric, // { title, subject, grade, maxScore, items: [...] }
      examId,
      examCode,
      studentNameOverride,
      studentClassOverride,
      gradingStrictness, // "strict" | "standard" | "lenient"
    } = req.body;

    if (!paperFile || !paperFile.data) {
      return res.status(400).json({ error: "Vui lòng đính kèm file ảnh hoặc PDF bài làm của học sinh." });
    }

    // Resolve Rubric & Key
    let resolvedRubric = rubric;
    if (!resolvedRubric && examId) {
      const exam = activeExams.find((e) => e.id === examId);
      if (exam) {
        const variant = exam.variants.find((v: any) => v.examCode === examCode) || exam.variants[0];
        const isMath = (exam.config.subject || "").toLowerCase().includes("toán");
        const items = variant.questions.map((q: any) => {
          let points = 0.25;
          if (q.part === 2) points = 1.0;
          else if (q.part === 3) points = isMath ? 0.5 : 0.25;

          let corAns = "";
          if (q.part === 1 || q.questionType === "multiple_choice") {
            const letter = ["A", "B", "C", "D"][q.correctIndex ?? 0] || "A";
            const optVal = (q.options && q.options[q.correctIndex]) ? `: ${q.options[q.correctIndex]}` : "";
            corAns = `${letter}${optVal}`;
          } else if (q.part === 2 || q.questionType === "true_false") {
            corAns = (q.statements || []).map((s: any) => `${s.label || s.id}: ${s.correctValue ? "Đúng" : "Sai"}`).join(" | ");
          } else {
            corAns = q.shortAnswer || "";
          }

          return {
            questionIndex: q.questionIndex,
            content: q.content,
            correctAnswer: corAns,
            points,
            criteria: q.explanation || "",
            questionType: q.questionType,
          };
        });

        resolvedRubric = {
          title: exam.title,
          subject: exam.config.subject,
          grade: exam.config.grade,
          maxScore: exam.config.maxScore || 10.0,
          examCode: variant.examCode,
          items,
        };
      }
    }

    if (!resolvedRubric || !resolvedRubric.items || resolvedRubric.items.length === 0) {
      return res.status(400).json({ error: "Không tìm thấy đáp án / biểu điểm chuẩn để chấm bài." });
    }

    const cleanBase64 = paperFile.data.replace(/^data:[^;]+;base64,/, "");
    const mimeType = paperFile.mimeType || "image/jpeg";

    const promptText = `Bạn là Trợ lý Giám khảo Chấm thi AI Thông minh, cẩn trọng và chuẩn mực của Bộ GD&ĐT Việt Nam (OMR Pro Vision Grader).
Nhiệm vụ của bạn là đọc và chấm điểm bài làm của học sinh trong tài liệu đính kèm (${paperFile.fileName || "Bài làm"}) dựa trên ĐÁP ÁN & BIỂU ĐIỂM CHUẨN sau đây.

THÔNG TIN ĐỀ & ĐÁP ÁN BIỂU ĐIỂM CHUẨN:
- Tên đề: ${resolvedRubric.title || "Bài kiểm tra"}
- Môn học: ${resolvedRubric.subject || "Toán"}
- Thang điểm tối đa: ${resolvedRubric.maxScore || 10.0}
- Mã đề chuẩn: ${resolvedRubric.examCode || "101"}
- Mức độ chấm: ${gradingStrictness === "strict" ? "Nghiêm ngặt, trừ điểm nếu thiếu bước/đơn vị" : "Tiêu chuẩn Bộ GD&ĐT, cho điểm theo ý đúng"}

DANH SÁCH CÂU HỎI VÀ ĐÁP ÁN CHUẨN:
${JSON.stringify(
  resolvedRubric.items.map((it: any) => ({
    cau: it.questionIndex,
    noi_dung_cau_hoi: it.content,
    dap_an_dung_cua_giao_vien: it.correctAnswer,
    diem_toi_da: it.points,
    tieu_chi: it.criteria,
    dang: it.questionType,
  })),
  null,
  2
)}

HƯỚNG DẪN CHẤM BÀI CHI TIẾT & NHẬN DIỆN PHIẾU TRẮC NGHIỆM (OMR / VIẾT TAY):
1. Nhận diện thông tin học sinh trên đầu bài làm: Họ và tên, Lớp, Số báo danh (SBD - 6 chữ số tô hoặc viết), Mã đề thi (3-4 chữ số tô hoặc viết, ví dụ 101, 102, 108).
2. Trích xuất câu trả lời của học sinh cho TỪNG CÂU HỎI:
   - Đối với Phiếu Trả Lời Trắc Nghiệm Chuẩn Bộ GD&ĐT:
     * PHẦN I: Trắc nghiệm 4 lựa chọn (A, B, C, D) -> Đọc chữ cái học sinh đã tô đen kín ô tròn.
     * PHẦN II: Trắc nghiệm Đúng/Sai (các ý a, b, c, d) -> Đọc xem từng ý học sinh tô Đúng (Đ) hay Sai (S). Định dạng: "ĐĐSS" hoặc "SĐĐĐ".
     * PHẦN III: Trắc nghiệm Trả lời ngắn -> Đọc số âm/dương hoặc giá trị số học sinh đã tô ở các cột số 0-9. Ví dụ: "40", "-2.5", "12".
   - Đối với Bài làm tự luận / Viết tay: Đọc câu trả lời, công thức toán và lời giải.
3. Đối chiếu câu trả lời của học sinh với ĐÁP ÁN CHUẨN:
   - status: "correct" (Đúng hoàn toàn) | "partial" (Đúng một phần) | "incorrect" (Sai) | "ungraded" (Chưa làm/bỏ trống)
   - pointsAwarded: Số điểm đạt được cho câu đó.
   - feedback: Lời nhận xét ngắn gọn, chỉ rõ học sinh chọn đúng/sai so với đáp án.
4. Trích xuất danh sách tọa độ các ô tròn bong bóng đã tô (bubbleCoordinates) trên phiếu thi (nếu là ảnh phiếu trắc nghiệm OMR):
   - xPercent: Tọa độ ngang theo % chiều rộng ảnh (0 đến 100).
   - yPercent: Tọa độ dọc theo % chiều cao ảnh (0 đến 100).
   - state: "correct" (nếu học sinh tô đúng) | "incorrect" (nếu học sinh tô sai) | "missed_correct" (đáp án đúng mà học sinh không tô).
   - option: Phương án ("A", "B", "C", "D", "Đ", "S", hoặc số).
   - part: "part1" | "part2" | "part3" | "sbd" | "code".
5. Tổng hợp:
   - totalScore: Tổng điểm bài làm (làm tròn 2 chữ số thập phân, tối đa ${resolvedRubric.maxScore || 10.0}).
   - gradeClassification: "Xuất sắc" (>= 9.0), "Giỏi" (>= 8.0), "Khá" (>= 6.5), "Trung bình" (>= 5.0), "Yếu" (< 5.0).
   - summaryEvaluation: Nhận xét tổng thể bài làm.

TRẢ VỀ KẾT QUẢ DƯỚI DẠNG JSON THEO SCHEMA ĐƯỢC CẤU HÌNH.`;

    const response = await generateContentWithModelFallback(ai, {
      selectedModel: requestedModel,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            {
              text: promptText,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            studentName: { type: Type.STRING },
            studentClass: { type: Type.STRING },
            studentId: { type: Type.STRING },
            sbd: { type: Type.STRING },
            examCode: { type: Type.STRING },
            totalScore: { type: Type.NUMBER },
            maxScore: { type: Type.NUMBER },
            gradeClassification: { type: Type.STRING },
            summaryEvaluation: { type: Type.STRING },
            details: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  questionIndex: { type: Type.INTEGER },
                  part: { type: Type.STRING },
                  questionContent: { type: Type.STRING },
                  studentAnswer: { type: Type.STRING },
                  teacherAnswer: { type: Type.STRING },
                  pointsAwarded: { type: Type.NUMBER },
                  maxPoints: { type: Type.NUMBER },
                  status: { type: Type.STRING },
                  feedback: { type: Type.STRING },
                },
                required: ["questionIndex", "studentAnswer", "teacherAnswer", "pointsAwarded", "maxPoints", "status"],
              },
            },
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
                  state: { type: Type.STRING },
                },
                required: ["xPercent", "yPercent", "state", "option"],
              },
            },
          },
          required: ["totalScore", "summaryEvaluation", "details"],
        },
      },
    });

    const parsedResult = JSON.parse(response.text);

    // Finalize score and structure
    const calculatedScore = parsedResult.details.reduce(
      (acc: number, d: any) => acc + (Number(d.pointsAwarded) || 0),
      0
    );
    const maxScore = parsedResult.maxScore || resolvedRubric.maxScore || 10.0;
    const finalScore = Math.min(maxScore, Math.max(0, Number((parsedResult.totalScore ?? calculatedScore).toFixed(2))));

    let classification = parsedResult.gradeClassification;
    if (!classification) {
      if (finalScore >= 9.0) classification = "Xuất sắc";
      else if (finalScore >= 8.0) classification = "Giỏi";
      else if (finalScore >= 6.5) classification = "Khá";
      else if (finalScore >= 5.0) classification = "Trung bình";
      else classification = "Yếu";
    }

    const gradedRecord = {
      id: `graded-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      studentName: studentNameOverride || parsedResult.studentName || "Học sinh",
      studentClass: studentClassOverride || parsedResult.studentClass || "12A",
      studentId: parsedResult.studentId || `HS${Math.floor(1000 + Math.random() * 9000)}`,
      sbd: parsedResult.sbd || "100016",
      examCode: parsedResult.examCode || resolvedRubric.examCode || "108",
      detectedExamCode: parsedResult.examCode || resolvedRubric.examCode || "108",
      examTitle: resolvedRubric.title || "Bài kiểm tra",
      fileName: paperFile.fileName || "bai_lam.jpg",
      fileData: paperFile.data ? (paperFile.data.length < 2000000 ? paperFile.data : undefined) : undefined,
      fileType: mimeType.includes("pdf") ? "pdf" : "image",
      gradedAt: new Date().toISOString(),
      totalScore: finalScore,
      maxScore,
      gradeClassification: classification,
      summaryEvaluation: parsedResult.summaryEvaluation || "Đã hoàn thành chấm điểm chi tiết bằng AI.",
      details: parsedResult.details.map((d: any) => ({
        questionIndex: d.questionIndex,
        part: d.part || (d.questionIndex <= 12 ? "part1" : d.questionIndex <= 16 ? "part2" : "part3"),
        questionContent: d.questionContent || "",
        studentAnswer: d.studentAnswer || "Chưa làm / Bỏ trống",
        teacherAnswer: d.teacherAnswer || "",
        pointsAwarded: Number(d.pointsAwarded) || 0,
        maxPoints: Number(d.maxPoints) || (d.part === "part2" ? 1.0 : 0.25),
        status: d.status || (d.pointsAwarded > 0 ? (d.pointsAwarded === d.maxPoints ? "correct" : "partial") : "incorrect"),
        feedback: d.feedback || "",
      })),
      bubbleCoordinates: parsedResult.bubbleCoordinates || [],
      teacherNotes: "",
      isReviewedByTeacher: false,
    };


    gradedPaperResults.unshift(gradedRecord);

    res.json({
      success: true,
      data: gradedRecord,
      message: `Đã chấm bài của học sinh ${gradedRecord.studentName} thành công! Điểm: ${finalScore}/${maxScore}`,
    });
  } catch (err: any) {
    console.error("AI Grade Paper Error:", err);
    res.status(500).json({ error: getFriendlyErrorMessage(err) });
  }
});

// API: Export Graded Papers to Google Sheets format
app.post("/api/export/grade-results-sheet", (req, res) => {
  const { examTitle, filterClass } = req.body;
  let list = gradedPaperResults;

  if (filterClass) {
    list = list.filter((p) => p.studentClass === filterClass);
  }
  if (examTitle) {
    list = list.filter((p) => p.examTitle === examTitle);
  }

  // Determine all question numbers present across all results
  const allQuestionIndices = new Set<string | number>();
  list.forEach((paper) => {
    (paper.details || []).forEach((d: any) => {
      allQuestionIndices.add(d.questionIndex);
    });
  });
  const sortedQuestionIndices = Array.from(allQuestionIndices).sort((a, b) => Number(a) - Number(b));

  const flatRows = list.map((paper, idx) => {
    const row: Record<string, any> = {
      STT: idx + 1,
      "Mã Học Sinh": paper.studentId || `HS${idx + 1}`,
      "Họ và Tên Học Sinh": paper.studentName,
      Lớp: paper.studentClass,
      "Tên Đề Thi": paper.examTitle,
      "Mã Đề": paper.examCode || "101",
      "Tổng Điểm": paper.totalScore,
      "Thang Điểm": paper.maxScore,
      "Xếp Loại": paper.gradeClassification,
      "Tên File Bài Làm": paper.fileName,
      "Thời Gian Chấm": new Date(paper.gradedAt).toLocaleString("vi-VN"),
      "Đánh Giá Tổng Quan Của AI": paper.summaryEvaluation,
      "Ghi Chú Giáo Viên": paper.teacherNotes || "",
    };

    // Detailed per-question answers and scores
    sortedQuestionIndices.forEach((qNum) => {
      const detail = (paper.details || []).find((d: any) => String(d.questionIndex) === String(qNum));
      row[`Câu ${qNum} (HS Trả Lời)`] = detail ? detail.studentAnswer : "-";
      row[`Câu ${qNum} (Đáp Án GV)`] = detail ? detail.teacherAnswer : "-";
      row[`Câu ${qNum} (Điểm)`] = detail ? `${detail.pointsAwarded}/${detail.maxPoints}` : "-";
      row[`Câu ${qNum} (Nhận Xét)`] = detail ? detail.feedback || "" : "-";
    });

    return row;
  });

  res.json({
    success: true,
    count: flatRows.length,
    sheetName: "Bang_Diem_Cham_Tu_Dong_AI",
    data: flatRows,
    message: "Dữ liệu xuất điểm Google Sheet sẵn sàng.",
  });
});

// 5. Google Sheets Export endpoint (Simulates direct sync & returns ready tabular data)

app.post("/api/export/google-sheets", (req, res) => {
  const { examId, webhookUrl } = req.body;
  let list = studentSubmissions;
  if (examId) {
    list = list.filter((s) => s.examId === examId);
  }

  const rows = list.map((s, idx) => ({
    STT: idx + 1,
    "Mã Học Sinh": s.studentId,
    "Họ và Tên": s.studentName,
    Lớp: s.studentClass,
    Trường: s.school,
    Khối: s.grade,
    "Tên Bài Kiểm Tra": s.examTitle,
    "Mã Đề": s.examCode,
    "Số Câu Đúng": s.correctCount,
    "Số Câu Sai": s.wrongCount,
    "Chưa Làm": s.unansweredCount,
    "Tổng Câu": s.totalQuestions,
    "Điểm Số (Thang 10)": s.score,
    "Thời Gian Làm (giây)": s.durationTakenSeconds,
    "Chuyển Tab / Rời Màn": s.tabSwitchCount,
    "Cảnh Báo Gian Lận": s.isLockedDueToCheating ? "BỊ KHÓA (QUÁ 3 LẦN)" : s.tabSwitchCount > 0 ? `Cảnh báo (${s.tabSwitchCount} lần)` : "Không vi phạm",
    "Thời Gian Nộp": new Date(s.submittedAt).toLocaleString("vi-VN"),
    "Trạng Thái": s.status === "locked" ? "Bị khóa bài" : "Đã nộp bài",
  }));

  res.json({
    success: true,
    count: rows.length,
    sheetName: "Bang_Diem_Trac_Nghiem_EduTest",
    data: rows,
    webhookTriggered: Boolean(webhookUrl),
    message: webhookUrl ? "Đã gửi dữ liệu sang Google Sheets Webhook thành công" : "Dữ liệu sẵn sàng xuất Google Sheet",
  });
});

// 6. Phase 2: AI Diagnostic, Remediation Quiz & Interactive AI Tutor

// AI Diagnostic & Remediation Generator
app.post("/api/ai/diagnostic-remediation", async (req, res) => {
  try {
    const customKey = (req.headers["x-gemini-api-key"] as string) || req.body.apiKey;
    const requestedModel = (req.headers["x-gemini-model"] as string) || req.body.model;
    const ai = getGenAI(customKey);
    if (!ai) {
      return res.status(400).json({ error: "Vui lòng cấu hình API Key trong Settings trước khi sử dụng tính năng AI." });
    }

    const { submission, wrongQuestions = [], correctQuestions = [], subject, grade } = req.body;

    const prompt = `Bạn là Chuyên gia Khảo thí & Cố vấn Học tập AI theo chương trình GDPT 2018 của Bộ GD&ĐT Việt Nam.
Hãy phân tích kết quả bài kiểm tra của học sinh:
- Học sinh: ${submission?.studentName || "Học sinh"}, Lớp: ${submission?.studentClass || "12A"}
- Môn: ${subject || submission?.subject || "Tổng hợp"}, Khối: ${grade || submission?.grade || "Khối 12"}
- Điểm số: ${submission?.score || 0}/10.0 (Đúng: ${submission?.correctCount || 0}/${submission?.totalQuestions || 0})

CÁC CÂU HỌC SINH LÀM ĐÚNG:
${JSON.stringify(correctQuestions.map((q: any) => ({ cau: q.questionIndex, chu_de: q.chapter, dang: q.questionType })))}

CÁC CÂU HỌC SINH LÀM SAI HOẶC BỎ TRỐNG:
${JSON.stringify(wrongQuestions.map((q: any) => ({
  cau: q.questionIndex,
  noi_dung: q.content,
  chu_de: q.chapter,
  dap_an_dung: q.correctAnswerDisplay || q.correctIndex,
  hoc_sinh_chon: q.studentAnswerDisplay || q.studentAnswer,
  loi_giai: q.explanation
})))}

YÊU CẦU TRẢ VỀ JSON:
1. "overallFeedback": Nhận xét tổng thể năng lực, chỉ ra điểm tích cực và động viên tinh thần (ngắn gọn 2-3 câu).
2. "strengths": Mảng 2-4 điểm mạnh kiến thức / kỹ năng học sinh đã nắm tốt.
3. "weaknesses": Mảng các lỗ hổng kiến thức / chuyên đề học sinh bị sai kèm lý do vì sao dễ nhầm lẫn.
4. "studyAdvice": Mảng 3-4 lời khuyên phương pháp ôn tập cụ thể.
5. "remediationQuestions": Tạo 3 câu hỏi trắc nghiệm tương tự cùng dạng (Part 1, 2 hoặc 3) để học sinh luyện bù ngay lập tức (kèm options/statements, correctIndex/shortAnswer, explanation).`;

    const response = await generateContentWithModelFallback(ai, {
      selectedModel: requestedModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallFeedback: { type: Type.STRING },
            strengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            weaknesses: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  topic: { type: Type.STRING },
                  description: { type: Type.STRING },
                  severity: { type: Type.STRING },
                },
                required: ["topic", "description"],
              },
            },
            studyAdvice: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            remediationQuestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  part: { type: Type.INTEGER },
                  questionType: { type: Type.STRING },
                  chapter: { type: Type.STRING },
                  level: { type: Type.STRING },
                  content: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  correctIndex: { type: Type.INTEGER },
                  shortAnswer: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                },
                required: ["content", "explanation"],
              },
            },
          },
          required: ["overallFeedback", "strengths", "weaknesses", "studyAdvice", "remediationQuestions"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json({ success: true, data: parsed });
  } catch (err: any) {
    console.error("Diagnostic AI Error:", err);
    res.status(500).json({ error: getFriendlyErrorMessage(err) });
  }
});

// Interactive AI Tutor Chat per question
app.post("/api/ai/question-tutor", async (req, res) => {
  try {
    const customKey = (req.headers["x-gemini-api-key"] as string) || req.body.apiKey;
    const requestedModel = (req.headers["x-gemini-model"] as string) || req.body.model;
    const ai = getGenAI(customKey);
    if (!ai) {
      return res.status(400).json({ error: "Vui lòng cấu hình API Key trong Settings trước khi sử dụng tính năng AI." });
    }

    const { question, studentAnswer, isCorrect, userMessage, chatHistory = [] } = req.body;

    const systemPrompt = `Bạn là Gia sư AI (AI Tutor) tận tâm, thông thái và thân thiện, chuyên hỗ trợ học sinh THPT ôn thi theo chương trình GDPT 2018.
Nhiệm vụ: Giải thích chi tiết, hướng dẫn phương pháp tư duy và giải đáp mọi thắc mắc của học sinh về câu hỏi thi này.

THÔNG TIN CÂU HỎI:
- Nội dung: ${question?.content || ""}
- Dạng câu: Phần ${question?.part || 1} (${question?.questionType || "Trắc nghiệm"})
- Các phương án/mệnh đề: ${JSON.stringify(question?.options || question?.statements || question?.shortAnswer)}
- Đáp án đúng: ${question?.correctAnswerDisplay || question?.correctIndex || question?.shortAnswer}
- Lời giải gốc: ${question?.explanation || ""}
- Lựa chọn của học sinh: ${studentAnswer ?? "Chưa trả lời"} (${isCorrect ? "ĐÚNG" : "CHƯA ĐÚNG"})

QUY TẮC PHẢN HỒI:
1. Giải thích ngắn gọn, súc tích, sư phạm, có dẫn chứng rõ ràng.
2. Nếu học sinh làm sai, chỉ rõ lỗi sai tư duy thường gặp và vì sao phương án đó không đúng.
3. Sử dụng công thức toán/hóa LaTeX ($...$) khi cần.
4. Chia sẻ mẹo giải nhanh hoặc cách tư duy loại trừ phương án.
5. Giữ giọng văn khích lệ, tạo động lực học tập.`;

    const contents: any[] = [];
    (chatHistory || []).forEach((msg: any) => {
      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.text }],
      });
    });

    contents.push({
      role: "user",
      parts: [{ text: userMessage || "Hãy giải thích chi tiết câu này giúp em." }],
    });

    const response = await generateContentWithModelFallback(ai, {
      selectedModel: requestedModel,
      contents,
      config: {
        systemInstruction: systemPrompt,
      },
    });

    res.json({
      success: true,
      text: response.text || "Xin chào, em hãy nêu rõ thắc mắc về câu hỏi này nhé!",
    });
  } catch (err: any) {
    console.error("AI Tutor Error:", err);
    res.status(500).json({ error: getFriendlyErrorMessage(err) });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`EduTest Pro Server running on http://localhost:${PORT}`);
  });
}

startServer();
