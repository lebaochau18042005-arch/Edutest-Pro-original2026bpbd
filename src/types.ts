export type SubjectType =
  | "Toán học"
  | "Vật lý"
  | "Hóa học"
  | "Sinh học"
  | "Tiếng Anh"
  | "Lịch sử"
  | "Địa lý"
  | "GDCD"
  | "GDKT & PL"
  | "Tin học"
  | "Công nghệ Công nghiệp"
  | "Công nghệ Nông nghiệp"
  | "Ngữ văn"
  | "Tổng hợp";

export type GradeType = "Khối 10" | "Khối 11" | "Khối 12" | "Khối 9" | "Khối 8" | "Khối 7" | "Khối 6";

export type CognitiveLevel = "Nhận biết" | "Thông hiểu" | "Vận dụng" | "Vận dụng cao";

export type QuestionType = "multiple_choice" | "true_false" | "short_answer";

export type ExamPart = 1 | 2 | 3; // Phần I: Trắc nghiệm 4 lựa chọn, Phần II: Đúng/Sai, Phần III: Trả lời ngắn

export interface TrueFalseStatement {
  id: string; // "a", "b", "c", "d"
  label: string; // "a)", "b)", "c)", "d)"
  text: string;
  correctValue: boolean; // true = Đúng, false = Sai
  explanation?: string;
}

export interface Question {
  id: string;
  subject: SubjectType | string;
  grade: GradeType | string;
  level: CognitiveLevel | string;
  chapter?: string;
  part: ExamPart; // 1 = Nhiều lựa chọn, 2 = Đúng/Sai, 3 = Trả lời ngắn
  questionType: QuestionType;
  content: string; // Chứa văn bản, bảng Markdown |...|, biểu đồ/sơ đồ ASCII, công thức LaTeX
  options: string[]; // 4 options A, B, C, D (cho Dạng 1)
  correctIndex: number; // 0=A, 1=B, 2=C, 3=D (cho Dạng 1)
  statements?: TrueFalseStatement[]; // 4 ý a, b, c, d (cho Dạng 2 Đúng/Sai)
  shortAnswer?: string; // Đáp án ngắn (cho Dạng 3 Trả lời ngắn)
  acceptableAnswers?: string[]; // Các dạng đáp án chấp nhận được (VD: ["-2.5", "-2,5", "-5/2"])
  points?: number; // Điểm số quy định cho câu này
  explanation?: string;
  // Grouped questions (bài đọc hiểu môn Anh/Văn, bảng số liệu môn Địa/KHTN/Kinh tế)
  groupId?: string;
  groupTitle?: string;
  passageContent?: string;
  // Metadata
  needsReview?: boolean;
  isAiGenerated?: boolean;
  hasTableOrDiagram?: boolean;
  tableData?: string;
  diagramUrl?: string;
}

export type ExamStructureType = "3_parts" | "2_parts" | "1_part";

export interface ExamConfig {
  department: string; // "SỞ GIÁO DỤC VÀ ĐÀO TẠO TP. HỒ CHÍ MINH"
  school: string; // "TRƯỜNG THPT CHUYÊN LÊ HỒNG PHONG"
  examPeriod: string; // "Kiểm tra Giữa kỳ II", "Thi Tốt nghiệp THPT 2026", v.v.
  subject: string; // "TOÁN HỌC", "VẬT LÝ", "TIẾNG ANH", v.v.
  grade: string; // "Khối 12"
  duration: number; // minutes, e.g. 50, 45
  originalExamCode: string; // "101" hoặc "GỐC"
  examCodes: string[]; // ["101", "102", "103", "104"]
  isOriginalKept: boolean; // true = Giữ nguyên đề gốc, false = Trộn đề
  structureType?: ExamStructureType; // 3 phần (Toán/KHTN/Địa/Tin/CN), 2 phần (Sử/GDKTPL), 1 phần (Tiếng Anh)
  startTime?: string;
  endTime?: string;
  maxScore: number; // Thang điểm 10.0
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  allowReviewAfterSubmit: boolean;
  maxTabViolations: number; // default 3
  blockCopyPaste?: boolean;
  detectDevTools?: boolean;
  trackQuestionTime?: boolean;
}

export interface ExamQuestionVariant {
  originalId: string;
  questionIndex: number;
  partQuestionIndex?: number;
  partTitle?: string;
  part: ExamPart;
  questionType: QuestionType;
  content: string;
  options: string[];
  correctIndex: number;
  originalCorrectIndex: number;
  statements?: TrueFalseStatement[];
  shortAnswer?: string;
  acceptableAnswers?: string[];
  points?: number;
  level?: string;
  subject?: string;
  explanation?: string;
  groupId?: string;
  groupTitle?: string;
  passageContent?: string;
  hasTableOrDiagram?: boolean;
  diagramUrl?: string;
}

export interface ExamVariant {
  examCode: string;
  questions: ExamQuestionVariant[];
  answerKey: Record<number, string>; // { 1: "A", 2: "a:Đ,b:S,c:Đ,d:S", 3: "-2.5" }
  isOriginalVariant?: boolean;
}

export interface ExamPackage {
  id: string;
  title: string;
  config: ExamConfig;
  originalQuestions: Question[];
  variants: ExamVariant[];
  createdAt: string;
  status: "draft" | "published" | "closed";
  accessCode: string;
}

export type ViolationType =
  | "TAB_SWITCH"
  | "WINDOW_BLUR"
  | "FULLSCREEN_EXIT"
  | "DEVTOOLS_ATTEMPT"
  | "COPY_PASTE_ATTEMPT"
  | "SHORTCUT_VIOLATION"
  | "SUSPICIOUS_SPEED"
  | "TEACHER_UNLOCK";

export interface ViolationLog {
  timestamp: string;
  type: ViolationType;
  message: string;
  questionIndex?: number;
  severity?: "low" | "medium" | "high" | "critical";
  detail?: string;
}

export interface QuestionTimeRecord {
  questionIndex: number;
  secondsSpent: number;
  isSuspiciouslyFast?: boolean;
  isAbnormallySlow?: boolean;
  answeredAt?: string;
}

export interface QuestionResultDetail {
  questionIndex: number;
  part: ExamPart;
  questionType: QuestionType;
  isCorrect: boolean;
  pointsEarned: number;
  maxPoints: number;
  studentAnswerDisplay: string;
  correctAnswerDisplay: string;
  trueFalseSubResults?: {
    label: string;
    text: string;
    studentValue?: boolean;
    correctValue: boolean;
    isCorrect: boolean;
  }[];
  correctSubCount?: number;
}

export interface StudentSubmission {
  id: string;
  examId: string;
  examTitle: string;
  examPeriod?: string;
  examCode: string;
  studentName: string;
  studentClass: string;
  school: string;
  grade: string;
  studentId?: string;
  startedAt: string;
  submittedAt: string;
  durationTakenSeconds: number;
  // Hỗ trợ cả 3 dạng đáp án:
  // - Multiple Choice: number (0..3)
  // - True/False: Record<string, boolean> (e.g. { a: true, b: false, c: true, d: false })
  // - Short Answer: string (e.g. "-2.5")
  answers: Record<number, any>;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  totalQuestions: number;
  score: number; // 0 to maxScore (chuẩn quy chế BGD)
  part1Score?: number;
  part2Score?: number;
  part3Score?: number;
  maxScore?: number;
  detailedResults?: Record<number, QuestionResultDetail>;
  isLockedDueToCheating: boolean;
  tabSwitchCount: number;
  copyPasteCount?: number;
  devToolsCount?: number;
  suspiciousSpeedCount?: number;
  questionTimes?: Record<number, number>;
  questionTimeRecords?: QuestionTimeRecord[];
  violationLogs: ViolationLog[];
  syncedToGoogleSheet: boolean;
  status: "in_progress" | "submitted" | "locked";
}

export type AppRole = "teacher" | "student";
export type TeacherTab = "shuffler" | "bank" | "monitoring" | "grader" | "matrix" | "quick-guide";
export type StudentTab = "online_test" | "upload_paper" | "history_results";

export interface StudentProfile {
  name: string;
  studentClass: string;
  school: string;
  grade: string;
  studentId: string; // Số Báo Danh
}

export interface OMRBubbleCoordinate {
  id?: string;
  xPercent: number; // percentage of sheet width (0 - 100)
  yPercent: number; // percentage of sheet height (0 - 100)
  radiusPercent?: number;
  part: "sbd" | "code" | "part1" | "part2" | "part3";
  questionIndex: number | string;
  subItem?: string; // e.g. "a", "b", "c", "d" or column index
  option: string; // "A", "B", "C", "D", "Đ", "S", "1", "2", ...
  state: "correct" | "incorrect" | "missed_correct" | "warning" | "unfilled";
  isStudentChoice?: boolean;
  isCorrectAnswer?: boolean;
}

export interface OMRSheetTemplate {
  id: string;
  name: string;
  description: string;
  sbdDigits: number;
  examCodeDigits: number;
  part1Count: number; // 4-choice questions (A, B, C, D)
  part2Count: number; // True/False questions (a, b, c, d)
  part3Count: number; // Short answer / numerical fill-in
  gridCalibration: {
    offsetX: number;
    offsetY: number;
    scaleX: number;
    scaleY: number;
    rowCount: number;
    colCount: number;
  };
}

export interface GradedQuestionDetail {
  questionIndex: number | string;
  part?: "part1" | "part2" | "part3" | "essay" | "other";
  questionContent?: string;
  studentAnswer: string;
  teacherAnswer: string;
  pointsAwarded: number;
  maxPoints: number;
  status: "correct" | "partial" | "incorrect" | "ungraded";
  feedback?: string;
  confidence?: number;
  bubbleCoords?: OMRBubbleCoordinate[];
}

export interface GradedPaperResult {
  id: string;
  studentName: string;
  studentClass: string;
  studentId?: string;
  sbd?: string; // Số báo danh tô trên phiếu
  examCode?: string;
  detectedExamCode?: string;
  examTitle?: string;
  fileName: string;
  fileData?: string; // base64 preview
  fileType: "image" | "pdf";
  gradedAt: string;
  totalScore: number;
  maxScore: number;
  gradeClassification: "Xuất sắc" | "Giỏi" | "Khá" | "Trung bình" | "Yếu" | "Chưa đạt";
  summaryEvaluation: string;
  details: GradedQuestionDetail[];
  bubbleCoordinates?: OMRBubbleCoordinate[];
  cornerMarkers?: {
    topLeft: [number, number];
    topRight: [number, number];
    bottomLeft: [number, number];
    bottomRight: [number, number];
  };
  teacherNotes?: string;
  isReviewedByTeacher?: boolean;
}


export interface RubricItem {
  questionIndex: number | string;
  content?: string;
  correctAnswer: string;
  points: number;
  criteria?: string;
  questionType?: QuestionType | "essay" | "fill_in";
}

export interface ExamRubric {
  id: string;
  title: string;
  subject: string;
  grade: string;
  maxScore: number;
  examCode?: string;
  sourceType: "system_exam" | "uploaded_doc" | "manual_text";
  rawContent?: string;
  items: RubricItem[];
  createdAt: string;
}
