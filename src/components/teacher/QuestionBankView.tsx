import React, { useState } from "react";
import {
  BookOpen,
  Plus,
  Trash2,
  Sparkles,
  Search,
  CheckCircle2,
  Layers,
  ArrowRight,
  HelpCircle,
  FolderOpen,
  Eye,
  Copy,
  Check,
  Share2,
  FileText,
  QrCode,
  Calendar,
  Clock,
  ShieldCheck,
  Download,
  UploadCloud,
  X,
  ExternalLink,
  GraduationCap,
  Users,
  Shuffle,
  FileSpreadsheet,
} from "lucide-react";
import { Question, CognitiveLevel, SubjectType, GradeType, ExamPackage, ExamVariant } from "../../types";
import { LETTERS, exportAnswerKeyMatrix, exportQuestionsToWordDoc, exportQuestionsToPrintablePdf } from "../../utils/examHelpers";
import { getStoredApiKey, getStoredSelectedModel } from "../ModelSettingsModal";
import { clientGenerateQuestions } from "../../utils/clientAI";
import { InstantShareModal } from "./InstantShareModal";

interface QuestionBankViewProps {
  questions: Question[];
  onAddQuestion: (q: Question) => void;
  onAddMultipleQuestions: (qList: Question[]) => void;
  onDeleteQuestion: (id: string) => void;
  onTransferToShuffler: (selectedQuestions: Question[]) => void;
  exams?: ExamPackage[];
  onDeleteExam?: (id: string) => void;
  onLoadExamToShuffler?: (exam: ExamPackage) => void;
  onAssignToClass?: (exam: ExamPackage) => void;
  onOpenShareModal?: (exam: ExamPackage) => void;
  onOpenStudentExam?: (examId: string, examCode: string) => void;
}

export const QuestionBankView: React.FC<QuestionBankViewProps> = ({
  questions,
  onAddQuestion,
  onAddMultipleQuestions,
  onDeleteQuestion,
  onTransferToShuffler,
  exams = [],
  onDeleteExam,
  onLoadExamToShuffler,
  onAssignToClass,
  onOpenShareModal,
  onOpenStudentExam,
}) => {
  // Main Tab Switcher: "exams" (Ngân hàng đề thi) vs "questions" (Ngân hàng câu hỏi)
  const [bankTab, setBankTab] = useState<"exams" | "questions">("exams");

  // ==================== EXAM BANK STATE ====================
  const [examSearchQuery, setExamSearchQuery] = useState("");
  const [selectedExamSubject, setSelectedExamSubject] = useState<string>("Tất cả");
  const [selectedExamGrade, setSelectedExamGrade] = useState<string>("Tất cả");
  const [viewingExamDetails, setViewingExamDetails] = useState<ExamPackage | null>(null);
  const [activeDetailVariantCode, setActiveDetailVariantCode] = useState<string>("");
  const [shareModalExam, setShareModalExam] = useState<ExamPackage | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Filtered Exams
  const filteredExams = exams.filter((ex) => {
    const matchSearch =
      ex.title.toLowerCase().includes(examSearchQuery.toLowerCase()) ||
      ex.accessCode.toLowerCase().includes(examSearchQuery.toLowerCase()) ||
      ex.config.school?.toLowerCase().includes(examSearchQuery.toLowerCase()) ||
      ex.config.subject?.toLowerCase().includes(examSearchQuery.toLowerCase());

    const matchSubject = selectedExamSubject === "Tất cả" || ex.config.subject === selectedExamSubject;
    const matchGrade = selectedExamGrade === "Tất cả" || ex.config.grade === selectedExamGrade;

    return matchSearch && matchSubject && matchGrade;
  });

  const handleCopyAccessCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  // ==================== QUESTION BANK STATE ====================
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<string>("Tất cả");
  const [selectedGrade, setSelectedGrade] = useState<string>("Tất cả");
  const [selectedLevel, setSelectedLevel] = useState<string>("Tất cả");

  // Selection for Transfer
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Manual Add Modal / Form
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSubject, setNewSubject] = useState<SubjectType>("Toán học");
  const [newGrade, setNewGrade] = useState<GradeType>("Khối 12");
  const [newLevel, setNewLevel] = useState<CognitiveLevel>("Thông hiểu");
  const [newChapter, setNewChapter] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newOptions, setNewOptions] = useState(["", "", "", ""]);
  const [newCorrectIndex, setNewCorrectIndex] = useState(0);
  const [newExplanation, setNewExplanation] = useState("");

  // AI Generator Modal
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiSubject, setAiSubject] = useState("Toán học");
  const [aiGrade, setAiGrade] = useState("Khối 12");
  const [aiTopic, setAiTopic] = useState("Khảo sát hàm số & Tích phân");
  const [aiCount, setAiCount] = useState(4);
  const [aiLevel, setAiLevel] = useState("Thông hiểu & Vận dụng");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiGeneratedResults, setAiGeneratedResults] = useState<Question[]>([]);
  const [aiError, setAiError] = useState("");

  // Filtered Questions List
  const filteredQuestions = questions.filter((q) => {
    const matchSearch =
      q.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.chapter?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.options.some((opt) => opt.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchSubject = selectedSubject === "Tất cả" || q.subject === selectedSubject;
    const matchGrade = selectedGrade === "Tất cả" || q.grade === selectedGrade;
    const matchLevel = selectedLevel === "Tất cả" || q.level === selectedLevel;

    return matchSearch && matchSubject && matchGrade && matchLevel;
  });

  // Toggle single selection
  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Select all filtered
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredQuestions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredQuestions.map((q) => q.id));
    }
  };

  // Handle manual question submit
  const handleSaveManualQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim() || newOptions.some((opt) => !opt.trim())) {
      alert("Vui lòng điền đầy đủ câu hỏi và 4 phương án lựa chọn.");
      return;
    }

    const q: Question = {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      subject: newSubject,
      grade: newGrade,
      level: newLevel,
      chapter: newChapter.trim() || "Chương chung",
      part: 1,
      questionType: "multiple_choice",
      content: newContent.trim(),
      options: newOptions.map((o) => o.trim()),
      correctIndex: newCorrectIndex,
      explanation: newExplanation.trim(),
    };

    onAddQuestion(q);
    setShowAddModal(false);
    // Reset
    setNewContent("");
    setNewOptions(["", "", "", ""]);
    setNewExplanation("");
  };

  // Handle AI Question Generation
  const handleGenerateAiQuestions = async () => {
    setIsAiLoading(true);
    setAiError("");
    setAiGeneratedResults([]);

    try {
      const apiKey = getStoredApiKey();
      const model = getStoredSelectedModel();
      const data = await clientGenerateQuestions({
        subject: aiSubject,
        grade: aiGrade,
        topic: aiTopic,
        count: aiCount,
        level: aiLevel,
        apiKey,
        model,
      });

      if (data.success && data.data) {
        setAiGeneratedResults(data.data);
      } else {
        setAiError(data.error || "Không thể tạo câu hỏi từ AI.");
      }
    } catch (err: any) {
      setAiError("Lỗi kết nối AI: " + err.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Add AI generated questions to bank
  const handleImportAiQuestionsToBank = () => {
    if (aiGeneratedResults.length > 0) {
      onAddMultipleQuestions(aiGeneratedResults);
      setShowAiModal(false);
      setAiGeneratedResults([]);
      alert(`Đã thêm thành công ${aiGeneratedResults.length} câu hỏi vào ngân hàng!`);
    }
  };

  // Send selected to exam shuffler
  const handleSendToShuffler = () => {
    const selected = questions.filter((q) => selectedIds.includes(q.id));
    if (selected.length === 0) {
      alert("Vui lòng chọn ít nhất 1 câu hỏi.");
      return;
    }
    onTransferToShuffler(selected);
  };

  return (
    <div className="space-y-6">
      {/* Top Main Tab Navigation Bar: Ngân Hàng Đề Thi vs Ngân Hàng Câu Hỏi */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex p-1 bg-slate-100 rounded-xl w-full sm:w-auto">
          <button
            type="button"
            id="tab-btn-exam-bank"
            onClick={() => setBankTab("exams")}
            className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              bankTab === "exams"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>📚 Ngân Hàng Đề Thi ({exams.length})</span>
          </button>

          <button
            type="button"
            id="tab-btn-question-bank"
            onClick={() => setBankTab("questions")}
            className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              bankTab === "questions"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>📝 Ngân Hàng Câu Hỏi ({questions.length})</span>
          </button>
        </div>

        {/* Quick Action Badges */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Lưu trữ vĩnh viễn & Tự động sao lưu</span>
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. NGÂN HÀNG ĐỀ THI (FULL EXAM PACKAGES)                                   */}
      {/* ========================================================================= */}
      {bankTab === "exams" && (
        <div className="space-y-5 animate-fade-in">
          {/* Top Banner & Stats */}
          <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white p-6 rounded-3xl shadow-md border border-blue-900/30 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-bold">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Kho Đề Thi Đã Đóng Gói & Hoán Vị Mã Đề</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Ngân Hàng Đề Thi Khảo Thí Chuẩn GDPT 2018
              </h1>
              <p className="text-xs sm:text-sm text-blue-200/80 max-w-2xl">
                Mỗi khi bạn tải đề lên và trộn đề, hệ thống sẽ tự động lưu trữ nguyên vẹn cấu hình, bộ câu hỏi và 4 mã đề hoán vị (101 - 104) vào Ngân hàng đề thi để sử dụng mọi lúc.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  onTransferToShuffler([]);
                }}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Trộn & Xuất Bản Đề Mới</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={examSearchQuery}
                onChange={(e) => setExamSearchQuery(e.target.value)}
                placeholder="Tìm tên đề thi, mã phòng thi, môn..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <select
                value={selectedExamSubject}
                onChange={(e) => setSelectedExamSubject(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium text-slate-700"
              >
                <option value="Tất cả">Tất cả môn học</option>
                <option value="Toán học">Toán học</option>
                <option value="Vật lý">Vật lý</option>
                <option value="Hóa học">Hóa học</option>
                <option value="Sinh học">Sinh học</option>
                <option value="Tiếng Anh">Tiếng Anh</option>
                <option value="Lịch sử">Lịch sử</option>
                <option value="Địa lý">Địa lý</option>
                <option value="GDCD">GDCD</option>
                <option value="Tin học">Tin học</option>
              </select>
            </div>

            <div>
              <select
                value={selectedExamGrade}
                onChange={(e) => setSelectedExamGrade(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium text-slate-700"
              >
                <option value="Tất cả">Tất cả khối lớp</option>
                <option value="Khối 12">Khối 12</option>
                <option value="Khối 11">Khối 11</option>
                <option value="Khối 10">Khối 10</option>
                <option value="Khối 9">Khối 9</option>
              </select>
            </div>
          </div>

          {/* Exam Cards Grid */}
          {filteredExams.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 space-y-3 shadow-xs">
              <BookOpen className="w-12 h-12 mx-auto text-slate-300 stroke-1" />
              <h3 className="text-base font-bold text-slate-700">Chưa có đề thi nào phù hợp</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Hãy chuyển sang tab "Trộn Đề Thi" để tải lên file đề thi Word / PDF / Excel hoặc soạn đề mới. Đề sẽ được tự động lưu vào đây.
              </p>
              <button
                type="button"
                onClick={() => onTransferToShuffler([])}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Tải Lên Đề Thi Mới Ngay</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredExams.map((exam) => {
                const totalQ = exam.originalQuestions?.length || 0;
                const variantsCount = exam.variants?.length || 0;
                const isCopied = copiedCodeId === exam.id;

                return (
                  <div
                    key={exam.id}
                    className="bg-white rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4 group"
                  >
                    <div className="space-y-3">
                      {/* Tags Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            {exam.config.subject}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
                            {exam.config.grade}
                          </span>
                        </div>

                        <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{exam.config.duration} phút</span>
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug">
                        {exam.title}
                      </h3>

                      {/* Info lines */}
                      <div className="space-y-1 text-xs text-slate-500">
                        <p className="line-clamp-1">
                          🏫 {exam.config.school || "Trường THPT"} • {exam.config.examPeriod || "Định kỳ"}
                        </p>
                        <div className="flex items-center justify-between pt-1 text-[11px]">
                          <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {totalQ} câu hỏi chuẩn
                          </span>
                          <span className="text-slate-500">
                            {variantsCount} mã đề: {exam.variants?.map((v) => v.examCode).join(", ")}
                          </span>
                        </div>
                      </div>

                      {/* Access Code Pill with Copy */}
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold block">MÃ PHÒNG THI:</span>
                          <span className="font-mono text-sm font-black text-blue-700 tracking-wider">
                            {exam.accessCode}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCopyAccessCode(exam.accessCode, exam.id)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 flex items-center gap-1 shadow-2xs transition-all"
                          title="Sao chép mã phòng thi"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-600">Đã chép</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-500" />
                              <span>Chép mã</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Action Buttons Toolbar */}
                    <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        {/* Nạp vào Trộn Đề */}
                        <button
                          type="button"
                          onClick={() => {
                            if (onLoadExamToShuffler) {
                              onLoadExamToShuffler(exam);
                            } else {
                              onTransferToShuffler(exam.originalQuestions);
                            }
                          }}
                          className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 border border-blue-200 cursor-pointer"
                          title="Mở đề này vào Trình Trộn Đề để chỉnh sửa hoặc xuất đề"
                        >
                          <Shuffle className="w-3.5 h-3.5 text-blue-600" />
                          <span>Mở Trộn Đề</span>
                        </button>

                        {/* Giao cho Lớp */}
                        <button
                          type="button"
                          onClick={() => {
                            if (onAssignToClass) {
                              onAssignToClass(exam);
                            }
                          }}
                          className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 border border-emerald-200 cursor-pointer"
                          title="Giao bài kiểm tra này cho các lớp học"
                        >
                          <Users className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Giao Cho Lớp</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        {/* Xem Chi Tiết & Đáp Án */}
                        <button
                          type="button"
                          onClick={() => {
                            setViewingExamDetails(exam);
                            if (exam.variants && exam.variants.length > 0) {
                              setActiveDetailVariantCode(exam.variants[0].examCode);
                            }
                          }}
                          className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Xem Đáp Án</span>
                        </button>

                        {/* Lấy Link & QR */}
                        <button
                          type="button"
                          onClick={() => setShareModalExam(exam)}
                          className="p-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg text-xs font-semibold border border-slate-200 transition-colors"
                          title="Lấy mã QR & Link làm bài cho học sinh"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>

                        {/* Xóa */}
                        {onDeleteExam && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Bạn có chắc chắn muốn xóa đề thi "${exam.title}" khỏi Ngân hàng đề thi không?`)) {
                                onDeleteExam(exam.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Xóa đề thi khỏi ngân hàng"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. NGÂN HÀNG CÂU HỎI (INDIVIDUAL QUESTION REPOSITORY)                      */}
      {/* ========================================================================= */}
      {bankTab === "questions" && (
        <div className="space-y-6 animate-fade-in">
          {/* Top Banner & Action Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <div className="flex items-center space-x-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                <h2 className="text-xl font-bold text-slate-900">Ngân Hàng Câu Hỏi Từng Câu</h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Tổng số: <strong>{questions.length} câu hỏi</strong> • Chọn câu hỏi và chuyển sang giao
                diện Trộn Đề cho học sinh làm.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* AI Generator Button */}
              <button
                type="button"
                id="btn-open-ai-generator"
                onClick={() => setShowAiModal(true)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>AI Soạn Câu Hỏi Tự Động</span>
              </button>

              {/* Add Manual Button */}
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Câu Hỏi Mới</span>
              </button>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {/* Search Input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm nội dung, chuyên đề..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Subject Filter */}
              <div>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-medium text-slate-700"
                >
                  <option value="Tất cả">Tất cả môn học</option>
                  <option value="Toán học">Toán học</option>
                  <option value="Vật lý">Vật lý</option>
                  <option value="Hóa học">Hóa học</option>
                  <option value="Sinh học">Sinh học</option>
                  <option value="Tiếng Anh">Tiếng Anh</option>
                  <option value="Lịch sử">Lịch sử</option>
                  <option value="Địa lý">Địa lý</option>
                  <option value="GDCD">GDCD</option>
                  <option value="Tin học">Tin học</option>
                </select>
              </div>

              {/* Grade Filter */}
              <div>
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-medium text-slate-700"
                >
                  <option value="Tất cả">Tất cả khối lớp</option>
                  <option value="Khối 12">Khối 12</option>
                  <option value="Khối 11">Khối 11</option>
                  <option value="Khối 10">Khối 10</option>
                  <option value="Khối 9">Khối 9</option>
                </select>
              </div>

              {/* Level Filter */}
              <div>
                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-medium text-slate-700"
                >
                  <option value="Tất cả">Tất cả mức độ</option>
                  <option value="Nhận biết">Nhận biết</option>
                  <option value="Thông hiểu">Thông hiểu</option>
                  <option value="Vận dụng">Vận dụng</option>
                  <option value="Vận dụng cao">Vận dụng cao</option>
                </select>
              </div>
            </div>

            {/* Action Bar for selected items */}
            {selectedIds.length > 0 && (
              <div className="flex items-center justify-between p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs">
                <span className="font-bold text-indigo-900">
                  Đã chọn {selectedIds.length} câu hỏi
                </span>

                <button
                  type="button"
                  id="btn-transfer-to-shuffler"
                  onClick={handleSendToShuffler}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <span>Chuyển Sang Trộn Đề</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Question Table List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={
                    filteredQuestions.length > 0 && selectedIds.length === filteredQuestions.length
                  }
                  onChange={toggleSelectAll}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="font-semibold text-slate-700">
                  Hiển thị {filteredQuestions.length} câu hỏi
                </span>
              </div>
            </div>

            <div className="divide-y divide-slate-200">
              {filteredQuestions.length === 0 ? (
                <div className="p-12 text-center text-slate-400 space-y-2">
                  <FolderOpen className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs">Không tìm thấy câu hỏi phù hợp với bộ lọc.</p>
                </div>
              ) : (
                filteredQuestions.map((q, idx) => {
                  const isSelected = selectedIds.includes(q.id);
                  return (
                    <div
                      key={q.id}
                      className={`p-4 transition-colors ${
                        isSelected ? "bg-indigo-50/50" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(q.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 mt-1"
                        />

                        <div className="flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-xs text-slate-900">Câu {idx + 1}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              {q.subject}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                              {q.grade}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                q.level === "Nhận biết"
                                  ? "bg-blue-100 text-blue-800"
                                  : q.level === "Thông hiểu"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : q.level === "Vận dụng"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {q.level}
                            </span>
                            {q.chapter && (
                              <span className="text-[11px] text-slate-500 italic">
                                Chương: {q.chapter}
                              </span>
                            )}
                          </div>

                          <p className="text-xs sm:text-sm font-medium text-slate-800">{q.content}</p>

                          {/* Options Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs pt-1">
                            {q.options.map((opt, optIdx) => (
                              <div
                                key={optIdx}
                                className={`p-2 rounded-lg border ${
                                  optIdx === q.correctIndex
                                    ? "bg-emerald-50 border-emerald-300 font-bold text-emerald-900"
                                    : "bg-slate-50 border-slate-200 text-slate-700"
                                }`}
                              >
                                <span className="mr-1">{LETTERS[optIdx]}.</span>
                                <span>{opt}</span>
                              </div>
                            ))}
                          </div>

                          {q.explanation && (
                            <div className="text-[11px] text-slate-600 bg-slate-100/70 p-2 rounded-md">
                              <span className="font-semibold text-slate-700">Giải thích:</span>{" "}
                              {q.explanation}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => onDeleteQuestion(q.id)}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                          title="Xóa câu hỏi"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VIEW FULL EXAM DETAILS & 4-VARIANT ANSWER MATRIX                   */}
      {/* ========================================================================= */}
      {viewingExamDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 animate-scale-up">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800">
                    {viewingExamDetails.config.subject} • {viewingExamDetails.config.grade}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                    Mã phòng: {viewingExamDetails.accessCode}
                  </span>
                </div>
                <h3 className="font-bold text-base sm:text-lg text-slate-900">
                  {viewingExamDetails.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setViewingExamDetails(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Variant Switcher Tabs */}
            <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-3 overflow-x-auto">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Mã đề:</span>
                {viewingExamDetails.variants?.map((v) => (
                  <button
                    key={v.examCode}
                    type="button"
                    onClick={() => setActiveDetailVariantCode(v.examCode)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeDetailVariantCode === v.examCode
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    Mã {v.examCode}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const targetVar = viewingExamDetails.variants?.find((v) => v.examCode === activeDetailVariantCode) || viewingExamDetails.variants?.[0];
                    if (targetVar) {
                      exportQuestionsToWordDoc(targetVar.questions, {
                        ...viewingExamDetails.config,
                        originalExamCode: targetVar.examCode,
                      });
                    }
                  }}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border border-blue-200"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Xuất Word</span>
                </button>
              </div>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {(() => {
                const targetVariant = viewingExamDetails.variants?.find((v) => v.examCode === activeDetailVariantCode) || viewingExamDetails.variants?.[0];
                if (!targetVariant) {
                  return (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      Không tìm thấy câu hỏi của mã đề này.
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {/* Answer Key Matrix */}
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                      <h4 className="font-bold text-xs text-emerald-900 mb-2 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Bảng Đáp Án Mã Đề {targetVariant.examCode}</span>
                      </h4>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {targetVariant.questions.map((q, qIdx) => {
                          let ansText = "";
                          if (q.part === 1 || q.questionType === "multiple_choice") {
                            ansText = LETTERS[q.correctIndex ?? 0] || "A";
                          } else if (q.part === 2 || q.questionType === "true_false") {
                            ansText = (q.statements || []).map((s) => s.correctValue ? "Đ" : "S").join("");
                          } else {
                            ansText = q.shortAnswer || "--";
                          }
                          return (
                            <span
                              key={q.id}
                              className="px-2 py-1 bg-white rounded-lg border border-emerald-300 font-mono text-emerald-950 font-bold"
                            >
                              C{qIdx + 1}: <span className="text-emerald-700">{ansText}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Question list */}
                    <div className="divide-y divide-slate-100">
                      {targetVariant.questions.map((q, qIdx) => (
                        <div key={q.id} className="py-3 space-y-2">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-bold text-slate-900">Câu {qIdx + 1}:</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              Phần {q.part || 1}
                            </span>
                          </div>

                          <p className="text-xs sm:text-sm font-medium text-slate-800">{q.content}</p>

                          {q.options && q.options.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              {q.options.map((opt, oIdx) => (
                                <div
                                  key={oIdx}
                                  className={`p-2 rounded-lg border ${
                                    oIdx === q.correctIndex
                                      ? "bg-emerald-50 border-emerald-300 font-bold text-emerald-900"
                                      : "bg-slate-50 border-slate-200 text-slate-700"
                                  }`}
                                >
                                  {LETTERS[oIdx]}. {opt}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setViewingExamDetails(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SHARE EXAM (QR CODE & 1-CLICK LINK)                                */}
      {/* ========================================================================= */}
      {shareModalExam && (
        <InstantShareModal
          isOpen={Boolean(shareModalExam)}
          onClose={() => setShareModalExam(null)}
          examPackage={shareModalExam}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: MANUAL ADD QUESTION                                                */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Thêm Câu Hỏi Mới</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveManualQuestion} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Môn học</label>
                  <select
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value as SubjectType)}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-lg"
                  >
                    <option value="Toán học">Toán học</option>
                    <option value="Vật lý">Vật lý</option>
                    <option value="Hóa học">Hóa học</option>
                    <option value="Sinh học">Sinh học</option>
                    <option value="Tiếng Anh">Tiếng Anh</option>
                    <option value="Lịch sử">Lịch sử</option>
                    <option value="Địa lý">Địa lý</option>
                    <option value="GDCD">GDCD</option>
                    <option value="Tin học">Tin học</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Khối lớp</label>
                  <select
                    value={newGrade}
                    onChange={(e) => setNewGrade(e.target.value as GradeType)}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-lg"
                  >
                    <option value="Khối 12">Khối 12</option>
                    <option value="Khối 11">Khối 11</option>
                    <option value="Khối 10">Khối 10</option>
                    <option value="Khối 9">Khối 9</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mức độ</label>
                  <select
                    value={newLevel}
                    onChange={(e) => setNewLevel(e.target.value as CognitiveLevel)}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-lg"
                  >
                    <option value="Nhận biết">Nhận biết</option>
                    <option value="Thông hiểu">Thông hiểu</option>
                    <option value="Vận dụng">Vận dụng</option>
                    <option value="Vận dụng cao">Vận dụng cao</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Chương / Chuyên đề</label>
                <input
                  type="text"
                  value={newChapter}
                  onChange={(e) => setNewChapter(e.target.value)}
                  placeholder="VD: Khảo sát hàm số..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nội dung câu hỏi <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Nhập nội dung câu hỏi..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* Options */}
              <div className="space-y-2">
                <label className="block font-semibold text-slate-700">
                  4 Phương án lựa chọn (Chọn nút tròn để đặt đáp án đúng):
                </label>
                {newOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="correctOption"
                      checked={newCorrectIndex === idx}
                      onChange={() => setNewCorrectIndex(idx)}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="font-bold w-4">{LETTERS[idx]}.</span>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const updated = [...newOptions];
                        updated[idx] = e.target.value;
                        setNewOptions(updated);
                      }}
                      placeholder={`Nội dung đáp án ${LETTERS[idx]}`}
                      className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg"
                      required
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lời giải chi tiết</label>
                <textarea
                  value={newExplanation}
                  onChange={(e) => setNewExplanation(e.target.value)}
                  placeholder="Hướng dẫn giải chi tiết cho học sinh..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs"
                >
                  Lưu Câu Hỏi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: AI QUESTION GENERATOR                                              */}
      {/* ========================================================================= */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    AI Soạn Câu Hỏi Trắc Nghiệm Tự Động
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Ứng dụng mô hình Gemini tạo câu hỏi chuẩn ma trận khảo thí
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Môn học</label>
                <input
                  type="text"
                  value={aiSubject}
                  onChange={(e) => setAiSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Khối lớp</label>
                <input
                  type="text"
                  value={aiGrade}
                  onChange={(e) => setAiGrade(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Chủ đề / Chuyên đề kiến thức
                </label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="VD: Khảo sát sự biến thiên của hàm số, Este - Lipit..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Số lượng câu</label>
                <select
                  value={aiCount}
                  onChange={(e) => setAiCount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value={2}>2 câu</option>
                  <option value={4}>4 câu</option>
                  <option value={6}>6 câu</option>
                  <option value={10}>10 câu</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mức độ phân hóa</label>
                <select
                  value={aiLevel}
                  onChange={(e) => setAiLevel(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="Nhận biết & Thông hiểu">Nhận biết & Thông hiểu</option>
                  <option value="Thông hiểu & Vận dụng">Thông hiểu & Vận dụng</option>
                  <option value="Vận dụng & Vận dụng cao">Vận dụng & Vận dụng cao</option>
                </select>
              </div>
            </div>

            {aiError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {aiError}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleGenerateAiQuestions}
                disabled={isAiLoading}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isAiLoading ? "AI Đang Soạn Câu Hỏi..." : "Bắt Đầu Tạo Câu Hỏi"}</span>
              </button>

              {aiGeneratedResults.length > 0 && (
                <button
                  type="button"
                  onClick={handleImportAiQuestionsToBank}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  Lưu Tất Cả Vào Ngân Hàng ({aiGeneratedResults.length})
                </button>
              )}
            </div>

            {/* AI Results Preview */}
            {aiGeneratedResults.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h4 className="font-bold text-xs text-slate-800">
                  Kết quả do AI tạo ({aiGeneratedResults.length} câu):
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {aiGeneratedResults.map((q, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
                      <p className="font-bold text-slate-900">
                        Câu {idx + 1}: {q.content}
                      </p>
                      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                        {q.options.map((opt, oIdx) => (
                          <div
                            key={oIdx}
                            className={`p-1.5 rounded border ${
                              oIdx === q.correctIndex
                                ? "bg-emerald-50 border-emerald-300 font-bold text-emerald-800"
                                : "bg-white border-slate-200"
                            }`}
                          >
                            {LETTERS[oIdx]}. {opt}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
