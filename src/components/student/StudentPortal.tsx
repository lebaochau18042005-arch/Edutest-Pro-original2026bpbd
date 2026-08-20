import React, { useState, useRef, useEffect } from "react";
import {
  UserCheck,
  ShieldAlert,
  Sparkles,
  BookOpen,
  ArrowRight,
  Clock,
  School,
  CheckCircle2,
  FileText,
  Upload,
  Camera,
  Award,
  RefreshCw,
  Eye,
  History,
  Search,
  Check,
  X,
  AlertTriangle,
  ExternalLink,
  Wifi,
  WifiOff,
  User,
  Edit3,
  Download,
  Database,
  Smartphone,
  Laptop,
} from "lucide-react";
import { ExamPackage, StudentSubmission, GradedPaperResult, StudentTab } from "../../types";
import { StudentExamRoom } from "./StudentExamRoom";
import { StudentResultView } from "./StudentResultView";

interface StudentPortalProps {
  exams: ExamPackage[];
  onSubmissionComplete: (sub: StudentSubmission) => void;
  prefillExamId?: string;
  prefillExamCode?: string;
  currentStudentTab?: StudentTab;
  setCurrentStudentTab?: (tab: StudentTab) => void;
  submissions?: StudentSubmission[];
}

export const StudentPortal: React.FC<StudentPortalProps> = ({
  exams,
  onSubmissionComplete,
  prefillExamId,
  prefillExamCode,
  currentStudentTab = "online_test",
  setCurrentStudentTab,
  submissions = [],
}) => {
  // Student registration state with LocalStorage persistence
  const [studentName, setStudentName] = useState(() => {
    return localStorage.getItem("eduexam_student_name") || "Lê Bảo Châu";
  });
  const [studentClass, setStudentClass] = useState(() => {
    return localStorage.getItem("eduexam_student_class") || "12A1";
  });
  const [school, setSchool] = useState(() => {
    return localStorage.getItem("eduexam_student_school") || "THPT Chuyên Lê Hồng Phong";
  });
  const [grade, setGrade] = useState(() => {
    return localStorage.getItem("eduexam_student_grade") || "Khối 12";
  });
  const [studentId, setStudentId] = useState(() => {
    return localStorage.getItem("eduexam_student_id") || "SBD-12058";
  });

  // Modal to edit student profile
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);

  // Network connection state
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  // Offline pending submissions saved locally
  const [offlineQueue, setOfflineQueue] = useState<StudentSubmission[]>([]);
  const [isSyncingOfflineQueue, setIsSyncingOfflineQueue] = useState(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState("");

  const [accessCodeInput, setAccessCodeInput] = useState(
    prefillExamId || exams[0]?.accessCode || "TOAN12"
  );
  const [selectedVariantCode, setSelectedVariantCode] = useState(prefillExamCode || "101");

  // Portal submission mode: "online_test" | "upload_paper"
  const [submissionMode, setSubmissionMode] = useState<"online_test" | "upload_paper">(
    currentStudentTab === "upload_paper" ? "upload_paper" : "online_test"
  );

  // Sync submissionMode with currentStudentTab prop
  useEffect(() => {
    if (currentStudentTab === "upload_paper") {
      setSubmissionMode("upload_paper");
    } else if (currentStudentTab === "online_test") {
      setSubmissionMode("online_test");
    }
  }, [currentStudentTab]);

  // Network listener & LocalStorage auto-save for profile
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      autoSyncPendingSubmissions();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Read offline submissions from localStorage
    try {
      const q = JSON.parse(localStorage.getItem("eduexam_offline_submissions") || "[]");
      setOfflineQueue(q);
    } catch (e) {}

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Save profile to localStorage whenever changed
  useEffect(() => {
    try {
      localStorage.setItem("eduexam_student_name", studentName);
      localStorage.setItem("eduexam_student_class", studentClass);
      localStorage.setItem("eduexam_student_school", school);
      localStorage.setItem("eduexam_student_grade", grade);
      localStorage.setItem("eduexam_student_id", studentId);
    } catch (e) {}
  }, [studentName, studentClass, school, grade, studentId]);

  // Auto-sync pending submissions when reconnected to network
  const autoSyncPendingSubmissions = async () => {
    try {
      const q: StudentSubmission[] = JSON.parse(
        localStorage.getItem("eduexam_offline_submissions") || "[]"
      );
      if (q.length === 0) return;

      setIsSyncingOfflineQueue(true);
      for (const sub of q) {
        await fetch("/api/submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub),
        }).catch(() => {});
      }
      setSyncStatusMessage(`Đã đồng bộ thành công ${q.length} bài thi ngoại tuyến về máy chủ!`);
      setTimeout(() => setSyncStatusMessage(""), 5000);
      setIsSyncingOfflineQueue(false);
    } catch (e) {
      setIsSyncingOfflineQueue(false);
    }
  };

  // Portal view state: "entry" | "exam_room" | "result" | "paper_result" | "review_submission"
  const [portalState, setPortalState] = useState<
    "entry" | "exam_room" | "result" | "paper_result" | "review_submission"
  >("entry");
  const [activeExam, setActiveExam] = useState<ExamPackage | null>(null);
  const [currentSubmission, setCurrentSubmission] = useState<StudentSubmission | null>(null);
  const [gradedPaperResult, setGradedPaperResult] = useState<GradedPaperResult | null>(null);
  const [entryError, setEntryError] = useState("");

  // History search state
  const [historySearch, setHistorySearch] = useState("");

  // Student Paper upload states
  const [paperFile, setPaperFile] = useState<File | null>(null);
  const [paperPreviewUrl, setPaperPreviewUrl] = useState<string>("");
  const [isGradingPaper, setIsGradingPaper] = useState<boolean>(false);
  const studentFileInputRef = useRef<HTMLInputElement>(null);

  // Handle Join Exam / Submit Paper
  const handleJoinExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setEntryError("");

    if (!studentName.trim() || !studentClass.trim()) {
      setEntryError("Vui lòng nhập đầy đủ Họ và tên, Lớp của bạn.");
      return;
    }

    const code = accessCodeInput.trim().toUpperCase();
    const foundExam = exams.find(
      (ex) =>
        ex.id === accessCodeInput ||
        ex.accessCode?.toUpperCase() === code ||
        ex.title.toUpperCase().includes(code)
    );

    if (!foundExam) {
      setEntryError(
        `Không tìm thấy đề thi với mã "${accessCodeInput}". Vui lòng kiểm tra lại mã phòng thi do giáo viên cung cấp.`
      );
      return;
    }

    setActiveExam(foundExam);
    const variantExists = foundExam.variants.some((v) => v.examCode === selectedVariantCode);
    if (!variantExists && foundExam.variants.length > 0) {
      setSelectedVariantCode(foundExam.variants[0].examCode);
    }

    // If student chose paper upload mode
    if (submissionMode === "upload_paper") {
      if (!paperFile) {
        setEntryError("Vui lòng tải lên file ảnh hoặc file PDF bài làm của bạn.");
        return;
      }

      setIsGradingPaper(true);
      try {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result as string;
          const res = await fetch("/api/ai/grade-paper", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paperFile: {
                data: base64,
                mimeType: paperFile.type || "image/jpeg",
                fileName: paperFile.name,
              },
              examId: foundExam.id,
              examCode: selectedVariantCode,
              studentNameOverride: studentName,
              studentClassOverride: studentClass,
            }),
          });

          const json = await res.json();
          if (json.success && json.data) {
            setGradedPaperResult(json.data);
            setPortalState("paper_result");
          } else {
            setEntryError(json.error || "Không thể chấm bài làm này. Vui lòng thử lại.");
          }
          setIsGradingPaper(false);
        };
        reader.readAsDataURL(paperFile);
      } catch (err: any) {
        setEntryError(err.message || "Lỗi nộp bài làm.");
        setIsGradingPaper(false);
      }
      return;
    }

    // Default: Online Exam Room
    setPortalState("exam_room");
  };

  // Quick select an exam from list
  const handleSelectExamFromList = (ex: ExamPackage) => {
    setActiveExam(ex);
    setAccessCodeInput(ex.accessCode);
    if (ex.variants.length > 0) {
      setSelectedVariantCode(ex.variants[0].examCode);
    }
  };

  // When student finishes submission in online exam room
  const handleExamSubmitted = (sub: StudentSubmission) => {
    setCurrentSubmission(sub);
    onSubmissionComplete(sub);
    // Refresh offline queue
    try {
      const q = JSON.parse(localStorage.getItem("eduexam_offline_submissions") || "[]");
      setOfflineQueue(q);
    } catch (e) {}
    setPortalState("result");
  };

  // Export offline submissions as backup file
  const handleExportOfflineJson = () => {
    try {
      const dataStr =
        "data:text/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(offlineQueue, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute(
        "download",
        `Sao_Luu_Bai_Thi_${studentName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (e) {
      alert("Không thể xuất file sao lưu");
    }
  };

  // Filter student submissions
  const filteredSubmissions = submissions.filter((s) => {
    const q = historySearch.toLowerCase();
    return (
      s.studentName.toLowerCase().includes(q) ||
      s.studentClass.toLowerCase().includes(q) ||
      s.examTitle.toLowerCase().includes(q) ||
      s.examCode.toLowerCase().includes(q)
    );
  });

  return (
    <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
      {/* 1. STUDENT IDENTITY BANNER (Trường, Lớp, Họ và Tên, SBD) - ALWAYS VISIBLE */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white rounded-3xl p-4 sm:p-6 shadow-xl border border-emerald-700/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-emerald-300" />
                <span>CỔNG KHẢO THÍ HỌC SINH</span>
              </span>

              {isOnline ? (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5" />
                  <span>Trực Tuyến (Online)</span>
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/30 text-amber-300 border border-amber-400/40 flex items-center gap-1.5 animate-pulse">
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Ngoại Tuyến (Offline Sẵn Sàng)</span>
                </span>
              )}
            </div>

            {/* Student Profile Info Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="bg-white/10 backdrop-blur rounded-2xl p-3 border border-white/15">
                <span className="text-[11px] text-emerald-200 block font-medium">Trường THPT:</span>
                <strong className="text-white text-xs sm:text-sm font-bold truncate block">
                  {school}
                </strong>
              </div>

              <div className="bg-white/10 backdrop-blur rounded-2xl p-3 border border-white/15">
                <span className="text-[11px] text-emerald-200 block font-medium">Lớp:</span>
                <strong className="text-emerald-300 text-xs sm:text-sm font-bold block">
                  {studentClass} ({grade})
                </strong>
              </div>

              <div className="bg-white/10 backdrop-blur rounded-2xl p-3 border border-white/15">
                <span className="text-[11px] text-emerald-200 block font-medium">Họ và Tên Thí Sinh:</span>
                <strong className="text-white text-xs sm:text-sm font-bold truncate block">
                  {studentName}
                </strong>
              </div>

              <div className="bg-white/10 backdrop-blur rounded-2xl p-3 border border-white/15">
                <span className="text-[11px] text-emerald-200 block font-medium">Số Báo Danh (SBD):</span>
                <strong className="text-amber-300 text-xs sm:text-sm font-mono font-bold block">
                  {studentId}
                </strong>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 self-start lg:self-center">
            <button
              type="button"
              onClick={() => setShowEditProfileModal(true)}
              className="px-4 py-2.5 bg-white/15 hover:bg-white/25 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 border border-white/20"
            >
              <Edit3 className="w-4 h-4" />
              <span>Chỉnh Sửa Thông Tin Thí Sinh</span>
            </button>
          </div>
        </div>

        {/* Sync status alert if any */}
        {syncStatusMessage && (
          <div className="mt-3 p-2.5 bg-emerald-600/40 rounded-xl text-xs font-semibold border border-emerald-400 text-emerald-100 animate-fade-in">
            {syncStatusMessage}
          </div>
        )}
      </div>

      {/* 2. SUBMISSION HISTORY TAB */}
      {currentStudentTab === "history_results" && portalState === "entry" && (
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header Banner */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
                <History className="w-6 h-6 text-emerald-600" />
                <span>Bảng Điểm & Lịch Sử Bài Làm</span>
              </h1>
              <p className="text-slate-500 text-xs sm:text-sm">
                Tra cứu điểm số các bài kiểm tra đã nộp của thí sinh <strong>{studentName}</strong> ({studentClass})
              </p>
            </div>

            {offlineQueue.length > 0 && (
              <button
                type="button"
                onClick={handleExportOfflineJson}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Download className="w-4 h-4 text-slate-600" />
                <span>Xuất File Dự Phòng ({offlineQueue.length})</span>
              </button>
            )}
          </div>

          {/* Search bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center gap-3">
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Tìm theo mã đề, tên bài thi, họ tên học sinh..."
              className="flex-1 text-sm bg-transparent outline-hidden placeholder:text-slate-400"
            />
            {historySearch && (
              <button
                type="button"
                onClick={() => setHistorySearch("")}
                className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
              >
                Xóa
              </button>
            )}
          </div>

          {/* Submissions List */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-900 text-sm">
                Danh Sách Bài Đã Nộp ({filteredSubmissions.length})
              </h2>
              <span className="text-xs text-slate-500 font-medium">Tự động đồng bộ Google Sheets</span>
            </div>

            {filteredSubmissions.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <FileText className="w-12 h-12 mx-auto text-slate-300 stroke-1" />
                <p className="text-sm font-medium">Chưa có bài thi nào phù hợp</p>
                <button
                  type="button"
                  onClick={() => {
                    if (setCurrentStudentTab) setCurrentStudentTab("online_test");
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all"
                >
                  Vào Làm Bài Thi Ngay
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredSubmissions.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{sub.studentName}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                          Lớp {sub.studentClass}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          Mã đề: {sub.examCode}
                        </span>
                        {sub.isLockedDueToCheating && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Bị khóa do gian lận
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 font-medium">{sub.examTitle}</p>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                        <span>Nộp lúc: {new Date(sub.submittedAt).toLocaleTimeString("vi-VN")}</span>
                        <span>•</span>
                        <span>Thời gian làm: {Math.round(sub.durationTakenSeconds / 60)} phút</span>
                        <span>•</span>
                        <span className="text-emerald-600 font-semibold">
                          Đúng {sub.correctCount}/{sub.totalQuestions} câu
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-2xl font-black text-slate-900">
                          {sub.score.toFixed(2)}
                          <span className="text-xs font-normal text-slate-400">/10</span>
                        </p>
                        <p className="text-[10px] font-bold text-emerald-600">
                          {sub.score >= 8
                            ? "Giỏi / Xuất sắc"
                            : sub.score >= 6.5
                            ? "Khá"
                            : sub.score >= 5
                            ? "Trung bình"
                            : "Yêu cầu rèn luyện"}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const foundEx = exams.find((e) => e.id === sub.examId) || exams[0];
                          setActiveExam(foundEx);
                          setCurrentSubmission(sub);
                          setPortalState("result");
                        }}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Xem Lại Bài</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. ENTRY & MODE REGISTRATION SCREEN */}
      {currentStudentTab !== "history_results" && portalState === "entry" && (
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100 rounded-2xl">
            <button
              type="button"
              id="student-mode-online"
              onClick={() => {
                setSubmissionMode("online_test");
                if (setCurrentStudentTab) setCurrentStudentTab("online_test");
              }}
              className={`py-3.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 ${
                submissionMode === "online_test"
                  ? "bg-white text-emerald-800 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Thi Trực Tuyến (Online / Offline)</span>
            </button>

            <button
              type="button"
              id="student-mode-upload"
              onClick={() => {
                setSubmissionMode("upload_paper");
                if (setCurrentStudentTab) setCurrentStudentTab("upload_paper");
              }}
              className={`py-3.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 ${
                submissionMode === "upload_paper"
                  ? "bg-white text-emerald-800 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span>Nộp Ảnh/PDF Phiếu Làm (AI Chấm)</span>
            </button>
          </div>

          {/* Registration Form Card */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
            <form onSubmit={handleJoinExam} className="space-y-5">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <h2 className="font-bold text-slate-900 text-sm uppercase tracking-wide">
                  Thông Tin Thí Sinh & Nhận Đề Thi
                </h2>
                <span className="text-xs text-slate-500 font-medium">
                  {exams.length} đề thi sẵn sàng
                </span>
              </div>

              {entryError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold">
                  {entryError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Họ và tên học sinh <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="Ví dụ: Lê Bảo Châu"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-sm font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Lớp <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={studentClass}
                    onChange={(e) => setStudentClass(e.target.value)}
                    placeholder="Ví dụ: 12A1"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-sm font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Trường THPT <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    placeholder="Ví dụ: THPT Chuyên Lê Hồng Phong"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-sm font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Số Báo Danh (SBD) / Mã Thí Sinh
                  </label>
                  <input
                    type="text"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="Ví dụ: SBD-12058"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-sm font-mono font-bold text-amber-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mã phòng thi / Mã đề <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={accessCodeInput}
                    onChange={(e) => setAccessCodeInput(e.target.value.toUpperCase())}
                    placeholder="Ví dụ: TOAN12"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-sm font-mono font-bold uppercase tracking-wider text-emerald-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mã đề trắc nghiệm (101 - 104)
                  </label>
                  <select
                    value={selectedVariantCode}
                    onChange={(e) => setSelectedVariantCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-sm font-medium bg-white"
                  >
                    <option value="101">Mã đề 101</option>
                    <option value="102">Mã đề 102</option>
                    <option value="103">Mã đề 103</option>
                    <option value="104">Mã đề 104</option>
                  </select>
                </div>
              </div>

              {/* Upload section if mode is upload_paper */}
              {submissionMode === "upload_paper" && (
                <div className="space-y-3 pt-2">
                  <label className="block font-semibold text-slate-700 text-xs">
                    Tải lên file ảnh hoặc file PDF bài làm (Phiếu trắc nghiệm / Tự luận){" "}
                    <span className="text-rose-500">*</span>
                  </label>

                  <div className="border-2 border-dashed border-emerald-300 bg-emerald-50/50 rounded-2xl p-6 text-center space-y-3 hover:bg-emerald-50 transition-colors">
                    {paperPreviewUrl ? (
                      <div className="space-y-3">
                        <img
                          src={paperPreviewUrl}
                          alt="Bài làm thí sinh"
                          className="max-h-48 mx-auto rounded-lg shadow-md border border-emerald-200"
                        />
                        <p className="text-xs text-emerald-800 font-bold">{paperFile?.name}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setPaperFile(null);
                            setPaperPreviewUrl("");
                          }}
                          className="text-xs text-rose-600 hover:text-rose-800 font-bold"
                        >
                          Chọn file khác
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-10 h-10 mx-auto text-emerald-600 stroke-1" />
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            Kéo thả ảnh chụp hoặc file PDF bài làm vào đây
                          </p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Hỗ trợ JPG, PNG, WEBP, PDF (Dung lượng tối đa 15MB)
                          </p>
                        </div>

                        <div className="flex items-center justify-center gap-3 pt-2">
                          <input
                            type="file"
                            ref={studentFileInputRef}
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setPaperFile(file);
                                if (file.type.startsWith("image/")) {
                                  setPaperPreviewUrl(URL.createObjectURL(file));
                                } else {
                                  setPaperPreviewUrl("");
                                }
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => studentFileInputRef.current?.click()}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                          >
                            Chọn file từ máy
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                id="btn-student-submit-form"
                disabled={isGradingPaper}
                className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {isGradingPaper ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>AI Đang Phân Tích & Chấm Điểm Bài Làm...</span>
                  </>
                ) : submissionMode === "upload_paper" ? (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Nộp Bài & Nhận Điểm Ngay (AI Chấm)</span>
                  </>
                ) : (
                  <>
                    <span>Vào Phòng Thi Trực Tuyến & Ngoại Tuyến</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* List of active exams in system for quick selection */}
            {exams.length > 0 && (
              <div className="border-t border-slate-100 pt-5 space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Đề thi khả dụng trong hệ thống (Bấm để điền nhanh):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {exams.map((ex) => (
                    <div
                      key={ex.id}
                      onClick={() => handleSelectExamFromList(ex)}
                      className={`p-3.5 rounded-2xl border text-xs cursor-pointer transition-all ${
                        accessCodeInput === ex.accessCode
                          ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20"
                          : "bg-slate-50 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <p className="font-bold text-slate-900 line-clamp-1">{ex.title}</p>
                          <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                            <span className="font-mono font-bold text-emerald-700">
                              MÃ: {ex.accessCode}
                            </span>
                            <span>•</span>
                            <span className="flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>{ex.config.duration} phút</span>
                            </span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                          {ex.originalQuestions.length} câu
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. ACTIVE EXAM ROOM */}
      {portalState === "exam_room" && activeExam && (
        <StudentExamRoom
          exam={activeExam}
          selectedVariantCode={selectedVariantCode}
          studentInfo={{
            name: studentName,
            studentClass,
            school,
            grade,
            studentId,
          }}
          onSubmitExam={handleExamSubmitted}
          onExit={() => setPortalState("entry")}
        />
      )}

      {/* 5. FINISHED EXAM RESULT SCREEN */}
      {portalState === "result" && currentSubmission && activeExam && (
        <StudentResultView
          submission={currentSubmission}
          variant={
            activeExam.variants.find((v) => v.examCode === currentSubmission.examCode) ||
            activeExam.variants[0]
          }
          allowReview={activeExam.config.allowReviewAfterSubmit ?? true}
          onRetakeOrExit={() => {
            setPortalState("entry");
            setCurrentSubmission(null);
          }}
        />
      )}

      {/* 6. GRADED PAPER AI RESULT SCREEN */}
      {portalState === "paper_result" && gradedPaperResult && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-gradient-to-r from-teal-800 to-emerald-900 text-white rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-semibold">
                Kết Quả Chấm Điểm AI Tự Động
              </span>
              <button
                type="button"
                onClick={() => setPortalState("entry")}
                className="px-3.5 py-1.5 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-bold transition-all"
              >
                Quay lại
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">
                  {gradedPaperResult.studentName} - Lớp {gradedPaperResult.studentClass}
                </h1>
                <p className="text-teal-100 text-xs mt-1">
                  Đề: {gradedPaperResult.examTitle} (Mã đề {gradedPaperResult.examCode})
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur rounded-2xl p-4 text-center shrink-0 border border-white/20">
                <p className="text-[10px] uppercase font-bold text-teal-200">Tổng Điểm</p>
                <p className="text-3xl font-black text-white">
                  {gradedPaperResult.totalScore} / {gradedPaperResult.maxScore}
                </p>
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-white text-teal-900">
                  Xếp loại: {gradedPaperResult.gradeClassification}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-3">
            <div className="flex items-center space-x-2 text-sm font-bold text-teal-800">
              <Sparkles className="w-5 h-5 text-teal-600" />
              <span>Đánh Giá Chi Tiết Của AI Giám Khảo</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {gradedPaperResult.summaryEvaluation}
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
              Chi Tiết Từng Câu Hỏi ({gradedPaperResult.details.length} câu)
            </h3>

            <div className="space-y-3">
              {gradedPaperResult.details.map((d, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border ${
                    d.status === "correct"
                      ? "bg-emerald-50/50 border-emerald-200"
                      : d.status === "partial"
                      ? "bg-amber-50/50 border-amber-200"
                      : "bg-rose-50/50 border-rose-200"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-slate-900">
                      Câu {d.questionIndex}: {d.questionContent}
                    </span>
                    <span className="font-bold text-teal-800">
                      {d.pointsAwarded}/{d.maxPoints} điểm
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-white rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-500 font-bold block">Bạn đã làm:</span>
                      <span className="font-bold font-mono text-slate-800">{d.studentAnswer}</span>
                    </div>
                    <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200">
                      <span className="text-[10px] text-emerald-700 font-bold block">Đáp án giáo viên:</span>
                      <span className="font-bold font-mono text-emerald-900">{d.teacherAnswer}</span>
                    </div>
                  </div>

                  {d.feedback && (
                    <p className="text-[11px] text-slate-600 mt-2 bg-white/70 p-2 rounded-lg">
                      <strong>Nhận xét:</strong> {d.feedback}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: EDIT STUDENT PROFILE INFO */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">Chỉnh Sửa Thông Tin Thí Sinh</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEditProfileModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Trường THPT:</label>
                <input
                  type="text"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lớp:</label>
                  <input
                    type="text"
                    value={studentClass}
                    onChange={(e) => setStudentClass(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Khối:</label>
                  <input
                    type="text"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Họ và Tên:</label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Số Báo Danh (SBD):</label>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl font-mono font-bold text-amber-800"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowEditProfileModal(false)}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md"
            >
              Lưu Thông Tin
            </button>
          </div>
        </div>
      )}
    </main>
  );
};
