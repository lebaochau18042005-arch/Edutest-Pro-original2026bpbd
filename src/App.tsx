import React, { useState, useEffect } from "react";
import { SidebarNav } from "./components/Navbar";
import { DualNavigationBar } from "./components/DualNavigationBar";
import { AuthorInfoCard } from "./components/AuthorInfoCard";
import { TeacherDashboard } from "./components/teacher/TeacherDashboard";
import { StudentPortal } from "./components/student/StudentPortal";
import { ModelSettingsModal, getStoredApiKey } from "./components/ModelSettingsModal";
import { LiveQuizModal } from "./components/game/LiveQuizModal";
import {
  AppRole,
  TeacherTab,
  StudentTab,
  Question,
  ExamConfig,
  ExamPackage,
  StudentSubmission,
} from "./types";
import { generateVariantsFromQuestions } from "./utils/examHelpers";
import { exportAppDataBackupFile, importAppDataBackupFile } from "./utils/cloudSyncManager";
import { Sparkles, Send, GraduationCap, UserCheck, Menu, X, ShieldAlert, Layers, Key, Settings2, Gamepad2, Cloud, Download, Upload } from "lucide-react";

// Initial seed bank
const DEFAULT_INITIAL_QUESTIONS: Question[] = [
  {
    id: "q1",
    subject: "Toán học",
    grade: "Khối 12",
    level: "Nhận biết",
    chapter: "Nguyên hàm - Tích phân",
    part: 1,
    questionType: "multiple_choice",
    content: "Cho hàm số f(x) liên tục trên ℝ. Khẳng định nào sau đây là đúng?",
    options: [
      "∫ f'(x)dx = f(x) + C",
      "∫ f(x)dx = f'(x) + C",
      "(∫ f(x)dx)' = f'(x)",
      "∫ [f(x) + g(x)]dx = ∫ f(x)dx . ∫ g(x)dx",
    ],
    correctIndex: 0,
    explanation: "Theo định nghĩa nguyên hàm, nguyên hàm của đạo hàm f'(x) chính là f(x) + C.",
  },
  {
    id: "q2",
    subject: "Toán học",
    grade: "Khối 12",
    level: "Thông hiểu",
    chapter: "Hình học không gian Oxyz",
    part: 1,
    questionType: "multiple_choice",
    content:
      "Trong không gian Oxyz, phương trình mặt phẳng đi qua điểm M(1; -2; 3) và có vectơ pháp tuyến n = (2; -1; 4) là:",
    options: [
      "2x - y + 4z - 16 = 0",
      "2x - y + 4z + 16 = 0",
      "x - 2y + 3z - 14 = 0",
      "2x + y - 4z + 16 = 0",
    ],
    correctIndex: 0,
    explanation:
      "Phương trình: 2(x - 1) - 1(y + 2) + 4(z - 3) = 0 <=> 2x - y + 4z - 16 = 0.",
  },
  {
    id: "q3",
    subject: "Toán học",
    grade: "Khối 12",
    level: "Vận dụng",
    chapter: "Khảo sát hàm số",
    part: 1,
    questionType: "multiple_choice",
    content:
      "Tìm tất cả các giá trị thực của tham số m để hàm số y = x³ - 3mx² + 3(m² - 1)x đồng biến trên khoảng (1; +∞).",
    options: ["m ≤ 0 hoặc m = 1", "m ≤ 0", "m ≥ 2", "m < 1"],
    correctIndex: 1,
    explanation:
      "y' = 3x² - 6mx + 3(m² - 1) = 3(x - (m - 1))(x - (m + 1)). Để đồng biến trên (1; +∞) thì nghiệm lớn m + 1 ≤ 1 => m ≤ 0.",
  },
  {
    id: "q4",
    subject: "Toán học",
    grade: "Khối 12",
    level: "Nhận biết",
    chapter: "Mũ - Logarit",
    part: 1,
    questionType: "multiple_choice",
    content: "Với a là số thực dương tùy ý, log₂(a³) bằng:",
    options: ["3 log₂ a", "1/3 log₂ a", "3 + log₂ a", "a³ log₂ a"],
    correctIndex: 0,
    explanation: "Theo tính chất lũy thừa của logarit: log_a(b^n) = n * log_a(b).",
  },
  {
    id: "q5",
    subject: "Vật lý",
    grade: "Khối 12",
    level: "Nhận biết",
    chapter: "Dao động cơ",
    part: 1,
    questionType: "multiple_choice",
    content:
      "Một vật dao động điều hòa với phương trình x = A cos(ωt + φ). Đại lượng ω được gọi là:",
    options: [
      "Tần số góc của dao động",
      "Chu kỳ của dao động",
      "Pha ban đầu của dao động",
      "Biên độ dao động",
    ],
    correctIndex: 0,
    explanation: "ω là tần số góc (đơn vị rad/s).",
  },
  {
    id: "q6",
    subject: "Tiếng Anh",
    grade: "Khối 12",
    level: "Thông hiểu",
    chapter: "Grammar & Vocabulary",
    part: 1,
    questionType: "multiple_choice",
    content:
      "If you ________ harder, you would pass the graduation examination with flying colors.",
    options: ["studied", "study", "had studied", "will study"],
    correctIndex: 0,
    explanation:
      "Câu điều kiện loại 2 (Conditional Type 2): If + S + V-ed/V2, S + would/could + V-inf.",
  },
];

const DEFAULT_CONFIG: ExamConfig = {
  department: "SỞ GIÁO DỤC VÀ ĐÀO TẠO TỈNH BÌNH DƯƠNG",
  school: "TRƯỜNG THPT BÌNH PHÚ",
  examPeriod: "KIỂM TRA ĐỊNH KỲ HỌC KỲ II - NĂM HỌC 2025-2026",
  subject: "ĐỊA LÝ & KHOA HỌC TỔNG HỢP",
  grade: "Khối 12",
  duration: 45,
  originalExamCode: "101",
  isOriginalKept: false,
  maxScore: 10.0,
  examCodes: ["101", "102", "103", "104"],
  shuffleQuestions: true,
  shuffleOptions: true,
  allowReviewAfterSubmit: true,
  maxTabViolations: 3,
  trackQuestionTime: true,
};

const DEFAULT_INITIAL_EXAMS: ExamPackage[] = [
  {
    id: "exam-demo-01",
    title: "Đề kiểm tra giữa kỳ Toán 12 - Trực Tuyến Chống Gian Lận",
    config: DEFAULT_CONFIG,
    originalQuestions: DEFAULT_INITIAL_QUESTIONS,
    variants: generateVariantsFromQuestions(DEFAULT_INITIAL_QUESTIONS, DEFAULT_CONFIG),
    createdAt: new Date().toISOString(),
    status: "published",
    accessCode: "TOAN12",
  },
];

const DEFAULT_INITIAL_SUBMISSIONS: StudentSubmission[] = [
  {
    id: "sub-1",
    examId: "exam-demo-01",
    examTitle: "Đề kiểm tra giữa kỳ Toán 12 - Trực Tuyến Chống Gian Lận",
    examCode: "101",
    studentName: "Nguyễn Thành Nam",
    studentClass: "12A1",
    school: "THPT Chuyên Lê Hồng Phong",
    grade: "Khối 12",
    studentId: "HS202601",
    startedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    submittedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    durationTakenSeconds: 1800,
    answers: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 0, 6: 0 },
    correctCount: 6,
    wrongCount: 0,
    unansweredCount: 0,
    totalQuestions: 6,
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
    examTitle: "Đề kiểm tra giữa kỳ Toán 12 - Trực Tuyến Chống Gian Lận",
    examCode: "102",
    studentName: "Trần Thu Thủy",
    studentClass: "12A2",
    school: "THPT Chuyên Lê Hồng Phong",
    grade: "Khối 12",
    studentId: "HS202602",
    startedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    submittedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    durationTakenSeconds: 1380,
    answers: { 1: 0, 2: 1, 3: 1, 4: 0, 5: 2, 6: 0 },
    correctCount: 4,
    wrongCount: 2,
    unansweredCount: 0,
    totalQuestions: 6,
    score: 6.67,
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
    examTitle: "Đề kiểm tra giữa kỳ Toán 12 - Trực Tuyến Chống Gian Lận",
    examCode: "103",
    studentName: "Lê Minh Tâm",
    studentClass: "12A1",
    school: "THPT Chuyên Lê Hồng Phong",
    grade: "Khối 12",
    studentId: "HS202603",
    startedAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    submittedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    durationTakenSeconds: 480,
    answers: { 1: 0, 2: 0 },
    correctCount: 2,
    wrongCount: 0,
    unansweredCount: 4,
    totalQuestions: 6,
    score: 3.33,
    isLockedDueToCheating: true,
    tabSwitchCount: 3,
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
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        type: "TAB_SWITCH",
        message: "HỆ THỐNG ĐÃ KHÓA BÀI THI DO VI PHẠM QUÁ 3 LẦN (Lần 3)",
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
    answers: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    correctCount: 5,
    wrongCount: 1,
    unansweredCount: 0,
    totalQuestions: 6,
    score: 8.33,
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
    answers: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 1, 6: 0 },
    correctCount: 5,
    wrongCount: 1,
    unansweredCount: 0,
    totalQuestions: 6,
    score: 8.33,
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
    answers: { 1: 0, 2: 1, 3: 2, 4: 0, 5: 0, 6: 1 },
    correctCount: 3,
    wrongCount: 3,
    unansweredCount: 0,
    totalQuestions: 6,
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
    answers: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 0, 6: 0 },
    correctCount: 6,
    wrongCount: 0,
    unansweredCount: 0,
    totalQuestions: 6,
    score: 10.0,
    isLockedDueToCheating: false,
    tabSwitchCount: 0,
    violationLogs: [],
    syncedToGoogleSheet: true,
    status: "submitted",
  },
];

export default function App() {
  const [currentRole, setCurrentRole] = useState<AppRole>("teacher");
  const [teacherTab, setTeacherTab] = useState<TeacherTab>("shuffler");
  const [studentTab, setStudentTab] = useState<StudentTab>("online_test");

  const [questionBank, setQuestionBank] = useState<Question[]>(DEFAULT_INITIAL_QUESTIONS);
  const [activeExams, setActiveExams] = useState<ExamPackage[]>(DEFAULT_INITIAL_EXAMS);
  const [submissions, setSubmissions] =
    useState<StudentSubmission[]>(DEFAULT_INITIAL_SUBMISSIONS);

  const [prefillExamId, setPrefillExamId] = useState<string>("TOAN12");
  const [prefillExamCode, setPrefillExamCode] = useState<string>("101");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(Boolean(getStoredApiKey()));
  const [isLiveQuizOpen, setIsLiveQuizOpen] = useState(false);

  // Check API key on load
  useEffect(() => {
    setHasApiKey(Boolean(getStoredApiKey()));
  }, []);

  // Load from backend on start
  const refreshData = async () => {
    try {
      const [resQ, resExams, resSubs] = await Promise.all([
        fetch("/api/questions").catch(() => null),
        fetch("/api/exams").catch(() => null),
        fetch("/api/submissions").catch(() => null),
      ]);

      if (resQ && resQ.ok) {
        const d = await resQ.json();
        if (d.data) setQuestionBank(d.data);
      }
      if (resExams && resExams.ok) {
        const d = await resExams.json();
        if (d.data) setActiveExams(d.data);
      }
      if (resSubs && resSubs.ok) {
        const d = await resSubs.json();
        if (d.data) setSubmissions(d.data);
      }
    } catch (e) {
      console.warn("Backend not active, using local state", e);
    }
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 5000);
    const handleFocus = () => refreshData();
    window.addEventListener("focus", handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  // Add Question
  const handleAddQuestion = async (q: Question) => {
    setQuestionBank((prev) => [q, ...prev]);
    try {
      await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(q),
      });
    } catch (e) {}
  };

  // Add Multiple Questions (from AI / Bulk)
  const handleAddMultipleQuestions = async (qList: Question[]) => {
    setQuestionBank((prev) => [...qList, ...prev]);
    try {
      await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: qList }),
      });
    } catch (e) {}
  };

  // Delete Question
  const handleDeleteQuestion = async (id: string) => {
    setQuestionBank((prev) => prev.filter((q) => q.id !== id));
    try {
      await fetch(`/api/questions/${id}`, { method: "DELETE" });
    } catch (e) {}
  };

  // Publish Exam
  const handlePublishExam = async (pkg: ExamPackage) => {
    setActiveExams((prev) => [pkg, ...prev]);
    setPrefillExamId(pkg.accessCode);
    if (pkg.variants.length > 0) {
      setPrefillExamCode(pkg.variants[0].examCode);
    }
    try {
      await fetch("/api/exams/shuffle-and-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pkg.title,
          config: pkg.config,
          questions: pkg.originalQuestions,
          accessCode: pkg.accessCode,
        }),
      });
    } catch (e) {}
  };

  // Student Submits Exam
  const handleSubmissionComplete = async (sub: StudentSubmission) => {
    setSubmissions((prev) => [sub, ...prev]);
    try {
      await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
    } catch (e) {}
  };

  // Unlock Student
  const handleUnlockStudent = async (submissionId: string) => {
    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === submissionId
          ? {
              ...s,
              isLockedDueToCheating: false,
              status: "submitted",
              violationLogs: [
                ...s.violationLogs,
                {
                  timestamp: new Date().toISOString(),
                  type: "TEACHER_UNLOCK",
                  message: "Giáo viên đã mở khóa bài kiểm tra.",
                },
              ],
            }
          : s
      )
    );
    try {
      await fetch(`/api/submissions/${submissionId}/unlock`, { method: "POST" });
    } catch (e) {}
  };

  // Quick Launch Student Test
  const handleQuickLaunchStudentTest = () => {
    const latestExam = activeExams[0];
    if (latestExam) {
      setPrefillExamId(latestExam.accessCode);
      if (latestExam.variants.length > 0) {
        setPrefillExamCode(latestExam.variants[0].examCode);
      }
    }
    setCurrentRole("student");
    setStudentTab("online_test");
    setMobileMenuOpen(false);
  };

  const lockedCount = submissions.filter((s) => s.isLockedDueToCheating).length;

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden">
      {/* Sleek Dark Sidebar (Desktop) with Dual Navigation Sections */}
      <div className="hidden lg:block shrink-0">
        <SidebarNav
          currentRole={currentRole}
          setCurrentRole={setCurrentRole}
          teacherTab={teacherTab}
          setTeacherTab={setTeacherTab}
          studentTab={studentTab}
          setStudentTab={setStudentTab}
          activeExamCount={activeExams.length}
          submissionCount={submissions.length}
          lockedViolationCount={lockedCount}
          onQuickLaunchStudentTest={handleQuickLaunchStudentTest}
        />
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-900/60" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative z-10 w-72 bg-slate-950 text-white flex flex-col p-5 h-full">
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarNav
              currentRole={currentRole}
              setCurrentRole={(role) => {
                setCurrentRole(role);
                setMobileMenuOpen(false);
              }}
              teacherTab={teacherTab}
              setTeacherTab={(tab) => {
                setTeacherTab(tab);
                setMobileMenuOpen(false);
              }}
              studentTab={studentTab}
              setStudentTab={(tab) => {
                setStudentTab(tab);
                setMobileMenuOpen(false);
              }}
              activeExamCount={activeExams.length}
              submissionCount={submissions.length}
              lockedViolationCount={lockedCount}
              onQuickLaunchStudentTest={handleQuickLaunchStudentTest}
            />
          </div>
        </div>
      )}

      {/* Main App Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-18 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                    currentRole === "teacher"
                      ? "bg-blue-100 text-blue-800 border border-blue-200"
                      : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  }`}
                >
                  {currentRole === "teacher" ? "Không Gian Giáo Viên" : "Không Gian Học Sinh"}
                </span>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  {currentRole === "teacher"
                    ? teacherTab === "shuffler"
                      ? "Cấu hình & Trộn đề thi"
                      : teacherTab === "bank"
                      ? "Ngân hàng đề & Trợ lý AI"
                      : teacherTab === "grader"
                      ? "Chấm bài kiểm tra AI (OMR & Tự luận)"
                      : "Giám sát Kỳ thi & Lịch sử"
                    : studentTab === "online_test"
                    ? "Phòng thi trực tuyến chống gian lận"
                    : studentTab === "upload_paper"
                    ? "Nộp phiếu bài làm & AI Chấm điểm tức thì"
                    : "Tra cứu kết quả & Lịch sử thi"}
                </h2>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                {DEFAULT_CONFIG.examPeriod} • {DEFAULT_CONFIG.school}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Google Sheet Status Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold border border-emerald-200">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span>Google Sheets: Tự động đồng bộ</span>
            </div>

            {/* Prominent Settings & API Key Button with Red CTA per AI_INSTRUCTIONS.md */}
            <button
              type="button"
              id="btn-header-gemini-settings"
              onClick={() => setIsSettingsModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-xs bg-rose-50 hover:bg-rose-100/80 text-rose-700 border-rose-300 ring-2 ring-rose-500/15"
              title="Cấu hình Model AI & Google Gemini API Key"
            >
              <Key className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
              <span className="text-rose-700 font-extrabold">Lấy API key để sử dụng app</span>
              {hasApiKey && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Đã lưu API Key" />
              )}
            </button>

            {/* Live Quiz Arena Button */}
            <button
              type="button"
              id="btn-header-live-quiz"
              onClick={() => setIsLiveQuizOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 rounded-xl text-xs font-black transition-all shadow-md shadow-amber-500/25 active:scale-95 cursor-pointer"
              title="Khởi tạo Đấu trường Live Quiz tương tác trên lớp"
            >
              <Gamepad2 className="w-3.5 h-3.5 fill-current" />
              <span>Đấu Trường Quiz</span>
            </button>

            {/* Cloud Backup Button */}
            <button
              type="button"
              id="btn-header-cloud-backup"
              onClick={() => exportAppDataBackupFile(questionBank, activeExams, submissions)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
              title="Sao lưu 1-Click toàn bộ Ngân hàng Đề & Lịch sử Bài thi (.edutest)"
            >
              <Cloud className="w-3.5 h-3.5 text-indigo-600" />
              <span>Sao Lưu Đám Mây</span>
            </button>

            {/* Quick Switch Role CTA */}
            {currentRole === "teacher" ? (
              <button
                type="button"
                id="btn-header-publish-test"
                onClick={handleQuickLaunchStudentTest}
                className="bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Xem giao diện học sinh</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCurrentRole("teacher")}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-md shadow-blue-600/20"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Về trang Giáo viên</span>
              </button>
            )}
          </div>
        </header>

        {/* PROMINENT DUAL NAVIGATION BAR (2 THANH ĐIỀU HƯỚNG GIÁO VIÊN & HỌC SINH) */}
        <DualNavigationBar
          currentRole={currentRole}
          setCurrentRole={setCurrentRole}
          teacherTab={teacherTab}
          setTeacherTab={setTeacherTab}
          studentTab={studentTab}
          setStudentTab={setStudentTab}
          activeExamCount={activeExams.length}
          submissionCount={submissions.length}
          lockedViolationCount={lockedCount}
          onQuickLaunchStudentTest={handleQuickLaunchStudentTest}
        />

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-6 bg-slate-50 overflow-y-auto flex flex-col justify-between">
          <div className="w-full max-w-7xl mx-auto">
            {/* Prominent WebApp & Author Banner on Main Screen */}
            <AuthorInfoCard />

            {currentRole === "teacher" ? (
              <TeacherDashboard
                currentTab={teacherTab}
                setTeacherTab={setTeacherTab}
                questionBank={questionBank}
                submissions={submissions}
                exams={activeExams}
                onAddQuestion={handleAddQuestion}
                onAddMultipleQuestions={handleAddMultipleQuestions}
                onDeleteQuestion={handleDeleteQuestion}
                onPublishExam={handlePublishExam}
                onUnlockStudent={handleUnlockStudent}
                onOpenStudentExam={(examId, code) => {
                  setPrefillExamId(examId);
                  setPrefillExamCode(code);
                  setCurrentRole("student");
                  setStudentTab("online_test");
                }}
                onRefreshData={refreshData}
              />
            ) : (
              <StudentPortal
                exams={activeExams}
                onSubmissionComplete={(handleExamSubmitted) => {
                  handleSubmissionComplete(handleExamSubmitted);
                }}
                prefillExamId={prefillExamId}
                prefillExamCode={prefillExamCode}
                currentStudentTab={studentTab}
                setCurrentStudentTab={setStudentTab}
                submissions={submissions}
              />
            )}
          </div>

          {/* Persistent Footer with Author & WebApp Metadata */}
          <footer className="mt-8 pt-6 border-t border-slate-200 text-center text-xs text-slate-500 max-w-7xl mx-auto w-full pb-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">EduTest Pro</span>
                <span>•</span>
                <span className="text-slate-600">Hệ thống Khảo thí & Chống gian lận GDPT 2018</span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <span className="text-slate-700 font-semibold">Tác giả: Cô Lê Thị Thái (GV Môn Địa Lý)</span>
                <span>•</span>
                <span className="text-slate-600">THPT Bình Phú - Bình Dương</span>
                <span>•</span>
                <a
                  href="https://zalo.me/0916791779"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 underline underline-offset-2"
                >
                  Zalo: 0916.791.779
                </a>
              </div>
            </div>
          </footer>
        </main>
      </div>

      {/* Google Gemini Model & API Key Settings Modal */}
      <ModelSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onSaved={() => setHasApiKey(Boolean(getStoredApiKey()))}
      />

      {/* Gamification Live Quiz Arena Modal */}
      <LiveQuizModal
        isOpen={isLiveQuizOpen}
        onClose={() => setIsLiveQuizOpen(false)}
        questions={questionBank}
      />
    </div>
  );
}
