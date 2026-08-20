import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Upload,
  FileText,
  FileSpreadsheet,
  Download,
  Copy,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  Trash2,
  Edit3,
  RefreshCw,
  Search,
  Filter,
  Check,
  X,
  Plus,
  Layers,
  Award,
  ChevronRight,
  BookOpen,
  Camera,
  ZoomIn,
  RotateCw,
  ExternalLink,
  ShieldCheck,
  HelpCircle,
  Settings2,
  TrendingUp,
} from "lucide-react";
import {
  GradedPaperResult,
  GradedQuestionDetail,
  ExamRubric,
  RubricItem,
  ExamPackage,
  Question,
} from "../../types";
import {
  exportGradedPapersToExcel,
  generateGradedPapersTSV,
} from "../../utils/examHelpers";
import { getStoredApiKey, getStoredSelectedModel } from "../ModelSettingsModal";
import { clientExtractRubric, clientGradePaper } from "../../utils/clientAI";

interface AIGraderViewProps {
  exams: ExamPackage[];
  questionBank: Question[];
  onOpenStudentExam?: (examId: string, examCode: string) => void;
}

export const AIGraderView: React.FC<AIGraderViewProps> = ({
  exams = [],
  questionBank = [],
}) => {
  // Active step / sub-tab in Grader
  const [activeStep, setActiveStep] = useState<"upload_grade" | "rubric_setup" | "results_table" | "export_sheets">("upload_grade");

  // Rubric state
  const [rubrics, setRubrics] = useState<ExamRubric[]>([]);
  const [selectedRubricId, setSelectedRubricId] = useState<string>("default-math12");
  const [activeRubric, setActiveRubric] = useState<ExamRubric | null>(null);

  // Rubric creation mode: "from_exam" | "upload_file" | "manual_text"
  const [rubricCreateMode, setRubricCreateMode] = useState<"from_exam" | "upload_file" | "manual_text">("from_exam");
  const [selectedExamIdForRubric, setSelectedExamIdForRubric] = useState<string>(exams[0]?.id || "");
  const [manualRubricText, setManualRubricText] = useState<string>(
    "Câu 1: A (1.0đ) - Khẳng định về nguyên hàm f'(x)\nCâu 2: A (1.0đ) - Mặt phẳng Oxyz 2x - y + 4z - 16 = 0\nCâu 3: m <= 0 (1.0đ) - Hàm số đồng biến trên (1; +inf)\nCâu 4: 3 log2 a (1.0đ) - Logarit cơ số 2 của a^3\nCâu 5: Tự luận (2.0đ) - Tích phân từng phần I = 2e - 1\nCâu 6: Tự luận (4.0đ) - Tọa độ hình chiếu H(2; 0; 1)"
  );
  const [rubricSubject, setRubricSubject] = useState<string>("Toán học");
  const [rubricGrade, setRubricGrade] = useState<string>("Khối 12");
  const [isExtractingRubric, setIsExtractingRubric] = useState<boolean>(false);
  const [rubricExtractError, setRubricExtractError] = useState<string>("");

  // Graded Papers state
  const [gradedPapers, setGradedPapers] = useState<GradedPaperResult[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState<boolean>(false);
  const [selectedPaperForModal, setSelectedPaperForModal] = useState<GradedPaperResult | null>(null);

  // Batch Upload queue state
  interface UploadQueueItem {
    id: string;
    file: File;
    previewUrl: string;
    fileData: string; // base64
    mimeType: string;
    studentName: string;
    studentClass: string;
    status: "pending" | "grading" | "success" | "error";
    errorMsg?: string;
    result?: GradedPaperResult;
  }
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [isGradingBatch, setIsGradingBatch] = useState<boolean>(false);
  const [gradingProgress, setGradingProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [gradingStrictness, setGradingStrictness] = useState<"standard" | "strict" | "lenient">("standard");

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");

  // Export state
  const [copySuccess, setCopySuccess] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookStatus, setWebhookStatus] = useState<string>("");
  const [isSendingWebhook, setIsSendingWebhook] = useState(false);

  // Paper Zoom/Rotate state in modal
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotationAngle, setRotationAngle] = useState<number>(0);

  // File input refs
  const paperFileInputRef = useRef<HTMLInputElement>(null);
  const rubricFileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Initialize Default Rubric and Fetch Results on mount
  useEffect(() => {
    // Built-in Default Demo Rubric
    const defaultRubric: ExamRubric = {
      id: "default-math12",
      title: "Đề Kiểm Tra 1 Tiết Toán 12 - Chuẩn BGD 2026",
      subject: "Toán học",
      grade: "Khối 12",
      maxScore: 10.0,
      examCode: "101",
      sourceType: "manual_text",
      createdAt: new Date().toISOString(),
      items: [
        {
          questionIndex: 1,
          content: "Cho hàm số f(x) liên tục trên ℝ. Khẳng định nào sau đây là đúng?",
          correctAnswer: "A (∫ f'(x)dx = f(x) + C)",
          points: 1.0,
          criteria: "Chọn phương án A",
          questionType: "multiple_choice",
        },
        {
          questionIndex: 2,
          content: "Trong không gian Oxyz, phương trình mặt phẳng đi qua M(1; -2; 3) và n = (2; -1; 4)...",
          correctAnswer: "A (2x - y + 4z - 16 = 0)",
          points: 1.0,
          criteria: "Chọn phương án A",
          questionType: "multiple_choice",
        },
        {
          questionIndex: 3,
          content: "Tìm m để hàm số y = x³ - 3mx² + 3(m² - 1)x đồng biến trên (1; +∞)",
          correctAnswer: "m ≤ 0",
          points: 1.0,
          criteria: "Điều kiện y' ≥ 0 với mọi x > 1 => m ≤ 0",
          questionType: "short_answer",
        },
        {
          questionIndex: 4,
          content: "Với a > 0, log₂(a³) bằng:",
          correctAnswer: "3 log₂ a",
          points: 1.0,
          criteria: "Áp dụng đúng công thức hạ bậc logarit",
          questionType: "multiple_choice",
        },
        {
          questionIndex: 5,
          content: "Tự luận: Tính tích phân I = ∫[0->1] (2x + 1)e^x dx",
          correctAnswer: "I = 2e - 1",
          points: 2.0,
          criteria: "Đặt u = 2x+1, dv = e^x dx (1đ); Tính I = (2x+1)e^x - 2e^x = 2e - 1 (1đ)",
          questionType: "essay",
        },
        {
          questionIndex: 6,
          content: "Tự luận: Tìm tọa độ hình chiếu vuông góc của điểm A(1, 2, 3) lên mặt phẳng (P)",
          correctAnswer: "H(2, 0, 1)",
          points: 4.0,
          criteria: "Lập phương trình đường thẳng AH qua A vuông góc (P) (2đ); Tọa độ giao điểm H = AH ∩ (P) là (2, 0, 1) (2đ)",
          questionType: "essay",
        },
      ],
    };

    setRubrics([defaultRubric]);
    setActiveRubric(defaultRubric);
    fetchGradedResults();
  }, []);

  // Fetch Graded Papers from Server
  const fetchGradedResults = async () => {
    setIsLoadingResults(true);
    try {
      const res = await fetch("/api/grader/results").catch(() => null);
      if (res && res.ok && res.headers.get("content-type")?.includes("application/json")) {
        const json = await res.json().catch(() => null);
        if (json && json.success && Array.isArray(json.data)) {
          setGradedPapers(json.data);
        }
      }
    } catch (err) {
      console.warn("Could not fetch graded papers from server:", err);
    } finally {
      setIsLoadingResults(false);
    }
  };

  // Convert an exam from system into Rubric
  const handleSelectExamAsRubric = (examId: string) => {
    const exam = exams.find((e) => e.id === examId);
    if (!exam) return;

    const variant = exam.variants[0];
    const isMath = (exam.config.subject || "").toLowerCase().includes("toán");
    const items: RubricItem[] = variant.questions.map((q) => {
      let points = 0.25;
      if (q.part === 2) points = 1.0;
      else if (q.part === 3) points = isMath ? 0.5 : 0.25;

      let corAns = "";
      if (q.part === 1 || q.questionType === "multiple_choice") {
        const letter = ["A", "B", "C", "D"][q.correctIndex ?? 0] || "A";
        const optVal = q.options && q.options[q.correctIndex ?? 0] ? `: ${q.options[q.correctIndex ?? 0]}` : "";
        corAns = `${letter}${optVal}`;
      } else if (q.part === 2 || q.questionType === "true_false") {
        corAns = (q.statements || []).map((s) => `${s.label || s.id}: ${s.correctValue ? "Đúng" : "Sai"}`).join(" | ");
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

    const newRubric: ExamRubric = {
      id: `rubric-exam-${exam.id}`,
      title: `Biểu điểm: ${exam.title}`,
      subject: exam.config.subject,
      grade: exam.config.grade,
      maxScore: exam.config.maxScore || 10.0,
      examCode: variant.examCode,
      sourceType: "system_exam",
      items,
      createdAt: new Date().toISOString(),
    };

    setRubrics((prev) => [newRubric, ...prev.filter((r) => r.id !== newRubric.id)]);
    setSelectedRubricId(newRubric.id);
    setActiveRubric(newRubric);
  };

  // Extract rubric from uploaded doc/image/PDF
  const handleUploadRubricFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtractingRubric(true);
    setRubricExtractError("");

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const apiKey = getStoredApiKey();
        const model = getStoredSelectedModel();
        const json = await clientExtractRubric({
          fileData: base64,
          mimeType: file.type || "application/pdf",
          fileName: file.name,
          subject: rubricSubject,
          grade: rubricGrade,
          apiKey,
          model,
        });

        if (json.success && json.data) {
          const newRubric: ExamRubric = {
            ...json.data,
            sourceType: "uploaded_doc",
          };
          setRubrics((prev) => [newRubric, ...prev]);
          setSelectedRubricId(newRubric.id);
          setActiveRubric(newRubric);
          setActiveStep("upload_grade");
        } else {
          setRubricExtractError(json.error || "Không thể trích xuất biểu điểm.");
        }
        setIsExtractingRubric(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setRubricExtractError(err.message || "Lỗi đọc file biểu điểm.");
      setIsExtractingRubric(false);
    }
  };

  // Parse manual text rubric with AI
  const handleParseManualTextRubric = async () => {
    if (!manualRubricText.trim()) return;
    setIsExtractingRubric(true);
    setRubricExtractError("");

    try {
      const apiKey = getStoredApiKey();
      const model = getStoredSelectedModel();
      const json = await clientExtractRubric({
        rawText: manualRubricText,
        subject: rubricSubject,
        grade: rubricGrade,
        apiKey,
        model,
      });

      if (json.success && json.data) {
        const newRubric: ExamRubric = {
          ...json.data,
          sourceType: "manual_text",
        };
        setRubrics((prev) => [newRubric, ...prev]);
        setSelectedRubricId(newRubric.id);
        setActiveRubric(newRubric);
        setActiveStep("upload_grade");
      } else {
        setRubricExtractError(json.error || "Không thể phân tích biểu điểm.");
      }
    } catch (err: any) {
      setRubricExtractError("Lỗi kết nối AI: " + err.message);
    } finally {
      setIsExtractingRubric(false);
    }
  };

  // Handle files selected for student papers (Batch upload)
  const handlePaperFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newItems: UploadQueueItem[] = [];
    Array.from(files).forEach((file) => {
      const previewUrl = URL.createObjectURL(file);
      const isImg = file.type.startsWith("image/");
      const isPdf = file.type.includes("pdf");

      if (isImg || isPdf) {
        // Guess student name from file name if possible (e.g. Nguyen_Van_A_12A1.jpg)
        const nameGuess = file.name
          .replace(/\.[^/.]+$/, "")
          .replace(/[_-]/g, " ")
          .replace(/\b(bai|lam|kiem|tra|toan|de|thi)\b/gi, "")
          .trim();

        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          setUploadQueue((prev) =>
            prev.map((item) => (item.id === file.name + file.size ? { ...item, fileData: base64 } : item))
          );
        };
        reader.readAsDataURL(file);

        newItems.push({
          id: file.name + file.size,
          file,
          previewUrl,
          fileData: "",
          mimeType: file.type || "image/jpeg",
          studentName: nameGuess.length > 2 ? nameGuess : "Học sinh",
          studentClass: "12A1",
          status: "pending",
        });
      }
    });

    setUploadQueue((prev) => [...prev, ...newItems]);
  };

  // Remove item from queue
  const handleRemoveQueueItem = (id: string) => {
    setUploadQueue((prev) => prev.filter((item) => item.id !== id));
  };

  // Trigger AI batch grading process
  const handleStartBatchGrading = async () => {
    if (!activeRubric) {
      alert("Vui lòng chọn hoặc thiết lập Biểu điểm / Đáp án đề thi trước khi chấm bài!");
      setActiveStep("rubric_setup");
      return;
    }

    if (uploadQueue.length === 0) {
      alert("Vui lòng tải lên ít nhất một file ảnh hoặc PDF bài làm của học sinh.");
      return;
    }

    setIsGradingBatch(true);
    setGradingProgress({ current: 0, total: uploadQueue.length });

    const updatedQueue = [...uploadQueue];

    for (let i = 0; i < updatedQueue.length; i++) {
      const item = updatedQueue[i];
      if (item.status === "success") continue; // skip already graded

      // Set grading status
      item.status = "grading";
      setUploadQueue([...updatedQueue]);
      setGradingProgress({ current: i + 1, total: updatedQueue.length });

      try {
        let base64Data = item.fileData;
        if (!base64Data) {
          // Read base64 synchronously promise
          base64Data = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.onerror = reject;
            r.readAsDataURL(item.file);
          });
        }

        const apiKey = getStoredApiKey();
        const model = getStoredSelectedModel();
        const json = await clientGradePaper({
          paperFile: {
            data: base64Data,
            mimeType: item.mimeType,
            fileName: item.file.name,
          },
          rubric: activeRubric,
          studentNameOverride: item.studentName !== "Học sinh" ? item.studentName : undefined,
          studentClassOverride: item.studentClass,
          gradingStrictness,
          apiKey,
          model,
        });

        if (json.success && json.data) {
          item.status = "success";
          item.result = json.data;
          // Add to overall graded papers list immediately
          setGradedPapers((prev) => [json.data, ...prev.filter((p) => p.id !== json.data.id)]);
        } else {
          item.status = "error";
          item.errorMsg = json.error || "Không thể chấm bài này";
          // Mark any subsequent pending items as "Đã dừng do lỗi" per AI_INSTRUCTIONS.md
          for (let j = i + 1; j < updatedQueue.length; j++) {
            if (updatedQueue[j].status === "pending") {
              updatedQueue[j].status = "error";
              updatedQueue[j].errorMsg = "Đã dừng do lỗi quy trình trước đó";
            }
          }
          setUploadQueue([...updatedQueue]);
          break; // Halt batch on critical API error
        }
      } catch (err: any) {
        item.status = "error";
        item.errorMsg = err.message || "Lỗi kết nối khi chấm bài";
        for (let j = i + 1; j < updatedQueue.length; j++) {
          if (updatedQueue[j].status === "pending") {
            updatedQueue[j].status = "error";
            updatedQueue[j].errorMsg = "Đã dừng do lỗi";
          }
        }
        setUploadQueue([...updatedQueue]);
        break;
      }

      setUploadQueue([...updatedQueue]);
    }

    setIsGradingBatch(false);
    // Switch to results tab when completed
    setActiveStep("results_table");
  };

  // Delete a graded paper
  const handleDeleteGradedPaper = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa kết quả chấm của bài này?")) return;
    try {
      await fetch(`/api/grader/results/${id}`, { method: "DELETE" });
      setGradedPapers((prev) => prev.filter((p) => p.id !== id));
      if (selectedPaperForModal?.id === id) {
        setSelectedPaperForModal(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Update a question score or note in detailed review (Human-in-the-loop)
  const handleUpdateDetailScore = async (
    questionIdx: number | string,
    newPoints: number,
    newFeedback?: string
  ) => {
    if (!selectedPaperForModal) return;

    const updatedDetails = selectedPaperForModal.details.map((d) => {
      if (String(d.questionIndex) === String(questionIdx)) {
        return {
          ...d,
          pointsAwarded: newPoints,
          feedback: newFeedback !== undefined ? newFeedback : d.feedback,
          status: (newPoints === d.maxPoints ? "correct" : newPoints > 0 ? "partial" : "incorrect") as any,
        };
      }
      return d;
    });

    const newTotal = Number(
      updatedDetails.reduce((sum, d) => sum + Number(d.pointsAwarded || 0), 0).toFixed(2)
    );

    let classification: any = selectedPaperForModal.gradeClassification;
    if (newTotal >= 9.0) classification = "Xuất sắc";
    else if (newTotal >= 8.0) classification = "Giỏi";
    else if (newTotal >= 6.5) classification = "Khá";
    else if (newTotal >= 5.0) classification = "Trung bình";
    else classification = "Yếu";

    const updatedPaper: GradedPaperResult = {
      ...selectedPaperForModal,
      totalScore: newTotal,
      gradeClassification: classification,
      details: updatedDetails,
      isReviewedByTeacher: true,
    };

    setSelectedPaperForModal(updatedPaper);
    setGradedPapers((prev) => prev.map((p) => (p.id === updatedPaper.id ? updatedPaper : p)));

    // Save to server
    try {
      await fetch(`/api/grader/results/${updatedPaper.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedPaper),
      });
    } catch (err) {
      console.error("Save updated paper error:", err);
    }
  };

  // Save teacher summary notes
  const handleSaveTeacherNotes = async (notes: string) => {
    if (!selectedPaperForModal) return;
    const updatedPaper = { ...selectedPaperForModal, teacherNotes: notes, isReviewedByTeacher: true };
    setSelectedPaperForModal(updatedPaper);
    setGradedPapers((prev) => prev.map((p) => (p.id === updatedPaper.id ? updatedPaper : p)));

    try {
      await fetch(`/api/grader/results/${updatedPaper.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedPaper),
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Copy TSV for 1-click Google Sheets Paste
  const handleCopyGoogleSheetsTSV = () => {
    const tsv = generateGradedPapersTSV(filteredPapers);
    if (!tsv) {
      alert("Không có dữ liệu bài chấm để sao chép!");
      return;
    }
    navigator.clipboard.writeText(tsv);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 3000);
  };

  // Send data to Google Sheets Webhook
  const handleSendToWebhook = async () => {
    if (!webhookUrl.trim()) {
      alert("Vui lòng nhập đường dẫn Webhook Google Apps Script của bạn.");
      return;
    }

    setIsSendingWebhook(true);
    setWebhookStatus("");

    try {
      const targetPapers = classFilter === "all" ? gradedPapers : gradedPapers.filter((p) => p.studentClass === classFilter);
      const rows = targetPapers.map((p, i) => ({
        stt: i + 1,
        studentName: p.studentName,
        studentClass: p.studentClass,
        studentId: p.studentId,
        examCode: p.examCode,
        totalScore: p.totalScore,
        maxScore: p.maxScore,
        gradeClassification: p.gradeClassification,
        gradedAt: p.gradedAt,
        summaryEvaluation: p.summaryEvaluation,
      }));

      // Send payload to user webhook
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "AI_EXAM_GRADING_EXPORT",
          timestamp: new Date().toISOString(),
          examTitle: activeRubric?.title || "Bài kiểm tra",
          totalGraded: rows.length,
          rows,
        }),
        mode: "no-cors", // Google App Script typically requires no-cors from browser
      });

      setWebhookStatus(`Đã gửi thành công ${rows.length} kết quả bài chấm sang Google Sheets!`);
    } catch (err: any) {
      setWebhookStatus(`Lỗi khi gửi webhook: ${err.message || err}`);
    } finally {
      setIsSendingWebhook(false);
    }
  };

  // Filtered Papers
  const filteredPapers = gradedPapers.filter((p) => {
    const matchSearch =
      p.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.studentClass.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.studentId && p.studentId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      p.fileName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchClass = classFilter === "all" || p.studentClass === classFilter;
    const matchGrade = gradeFilter === "all" || p.gradeClassification === gradeFilter;

    return matchSearch && matchClass && matchGrade;
  });

  // Analytics
  const totalGradedCount = gradedPapers.length;
  const avgScore = totalGradedCount > 0
    ? (gradedPapers.reduce((sum, p) => sum + p.totalScore, 0) / totalGradedCount).toFixed(2)
    : "0.00";
  const maxScoreAchieved = totalGradedCount > 0
    ? Math.max(...gradedPapers.map((p) => p.totalScore)).toFixed(1)
    : "0.0";
  const excellentCount = gradedPapers.filter((p) => p.totalScore >= 8.0).length;

  const availableClasses = Array.from(new Set(gradedPapers.map((p) => p.studentClass).filter(Boolean)));

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -bottom-10 w-56 h-56 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-500/30">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Hệ Thống Khảo Thí & Chấm Điểm AI Đa Phương Thức</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Chấm Điểm Bài Kiểm Tra Bằng AI
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Tải file ảnh bài viết tay, phiếu trắc nghiệm hoặc file PDF bài làm của học sinh.
              Hệ thống AI tự động đối chiếu với Đề & Biểu điểm đáp án, chấm chi tiết từng câu và xuất điểm Google Sheets.
            </p>
          </div>

          {/* Quick Stats Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/60 backdrop-blur shrink-0">
            <div className="text-center px-2">
              <p className="text-[10px] uppercase font-bold text-slate-400">Đã Chấm</p>
              <p className="text-lg sm:text-xl font-black text-white">{totalGradedCount}</p>
            </div>
            <div className="text-center px-2 border-l border-slate-700">
              <p className="text-[10px] uppercase font-bold text-slate-400">Điểm TB</p>
              <p className="text-lg sm:text-xl font-black text-blue-400">{avgScore}</p>
            </div>
            <div className="text-center px-2 border-l border-slate-700">
              <p className="text-[10px] uppercase font-bold text-slate-400">Cao Nhất</p>
              <p className="text-lg sm:text-xl font-black text-emerald-400">{maxScoreAchieved}</p>
            </div>
            <div className="text-center px-2 border-l border-slate-700">
              <p className="text-[10px] uppercase font-bold text-slate-400">Giỏi / Xuất Sắc</p>
              <p className="text-lg sm:text-xl font-black text-amber-400">{excellentCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveStep("upload_grade")}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
            activeStep === "upload_grade"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>1. Tải Bài Làm & Chấm Điểm</span>
          {uploadQueue.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-800 text-white">
              {uploadQueue.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveStep("rubric_setup")}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
            activeStep === "rubric_setup"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>2. Đề Thi & Biểu Điểm (Rubric)</span>
          {activeRubric && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-semibold">
              {activeRubric.items.length} câu
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveStep("results_table")}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
            activeStep === "results_table"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Award className="w-4 h-4" />
          <span>3. Bảng Điểm & Đối Chiếu Chi Tiết</span>
          {gradedPapers.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-800 font-bold">
              {gradedPapers.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveStep("export_sheets")}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
            activeStep === "export_sheets"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>4. Xuất Google Sheets / Excel</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* STEP 1: UPLOAD & BATCH GRADING                                            */}
      {/* ========================================================================= */}
      {activeStep === "upload_grade" && (
        <div className="space-y-6">
          {/* Active Rubric Banner Indicator */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-blue-700 font-semibold uppercase tracking-wider">
                  Đề & Biểu Điểm Đang Áp Dụng:
                </p>
                <p className="font-bold text-slate-900 text-sm">
                  {activeRubric?.title || "Chưa chọn biểu điểm"}
                </p>
                <p className="text-xs text-slate-500">
                  {activeRubric?.subject} • Thang điểm: {activeRubric?.maxScore}đ • {activeRubric?.items.length || 0} câu hỏi
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setActiveStep("rubric_setup")}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold transition-all flex items-center space-x-1.5 shadow-xs"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Đổi Đề / Chỉnh Biểu Điểm</span>
              </button>
            </div>
          </div>

          {/* Upload Area Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Drag & Drop Dropzone */}
            <div className="lg:col-span-2 space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handlePaperFilesSelected(e.dataTransfer.files);
                }}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/60 hover:bg-blue-50/20 rounded-3xl p-8 text-center transition-all cursor-pointer space-y-4 group"
                onClick={() => paperFileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={paperFileInputRef}
                  multiple
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={(e) => handlePaperFilesSelected(e.target.files)}
                />
                <input
                  type="file"
                  ref={cameraInputRef}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handlePaperFilesSelected(e.target.files)}
                />

                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform shadow-xs">
                  <Upload className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <p className="font-bold text-slate-900 text-base">
                    Kéo thả hoặc Bấm vào đây để tải file bài làm học sinh
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Hỗ trợ file ảnh JPG, PNG, ảnh chụp bài viết tay, phiếu tô trắc nghiệm, và file tài liệu PDF.
                    Có thể tải cùng lúc <strong>nhiều bài làm (Batch Upload)</strong> để chấm tự động liên tục.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      paperFileInputRef.current?.click();
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                  >
                    Chọn file từ máy tính
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      cameraInputRef.current?.click();
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Chụp ảnh bài thi trực tiếp</span>
                  </button>
                </div>
              </div>

              {/* Upload Queue List */}
              {uploadQueue.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 text-sm">
                        Danh sách bài làm chờ chấm ({uploadQueue.length})
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setUploadQueue([])}
                      className="text-xs text-rose-600 hover:underline font-semibold"
                    >
                      Xóa tất cả hàng chờ
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                    {uploadQueue.map((item, idx) => (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
                          item.status === "grading"
                            ? "bg-blue-50/70 border-blue-300 animate-pulse"
                            : item.status === "success"
                            ? "bg-emerald-50/70 border-emerald-300"
                            : item.status === "error"
                            ? "bg-rose-50 border-rose-300"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          {item.mimeType.startsWith("image/") ? (
                            <img
                              src={item.previewUrl}
                              alt="thumb"
                              className="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center shrink-0 font-bold">
                              PDF
                            </div>
                          )}

                          <div className="space-y-1 min-w-0">
                            <p className="font-bold text-slate-900 truncate">{item.file.name}</p>
                            <div className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={item.studentName}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setUploadQueue((prev) =>
                                    prev.map((it) => (it.id === item.id ? { ...it, studentName: val } : it))
                                  );
                                }}
                                placeholder="Họ tên HS"
                                className="px-2 py-1 bg-white border border-slate-200 rounded-md text-[11px] font-semibold w-28 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <input
                                type="text"
                                value={item.studentClass}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setUploadQueue((prev) =>
                                    prev.map((it) => (it.id === item.id ? { ...it, studentClass: val } : it))
                                  );
                                }}
                                placeholder="Lớp"
                                className="px-2 py-1 bg-white border border-slate-200 rounded-md text-[11px] font-semibold w-16 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          {item.status === "pending" && (
                            <span className="px-2 py-1 bg-slate-200 text-slate-700 rounded-md font-semibold text-[10px]">
                              Sẵn sàng
                            </span>
                          )}

                          {item.status === "grading" && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md font-semibold text-[10px] flex items-center space-x-1">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>Đang chấm AI...</span>
                            </span>
                          )}

                          {item.status === "success" && (
                            <div className="flex items-center space-x-1.5">
                              <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-md font-bold text-xs">
                                {item.result?.totalScore}đ
                              </span>
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            </div>
                          )}

                          {item.status === "error" && (
                            <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-md font-semibold text-[10px]">
                              Lỗi chấm bài
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleRemoveQueueItem(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Grading Settings & Launch Action */}
            <div className="space-y-4">
              <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-sm">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                    <Settings2 className="w-4 h-4 text-blue-600" />
                    <span>Cấu Hình Giám Khảo AI</span>
                  </h3>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Mức độ chấm điểm:
                    </label>
                    <select
                      value={gradingStrictness}
                      onChange={(e) => setGradingStrictness(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white font-medium"
                    >
                      <option value="standard">Tiêu chuẩn Bộ GD&ĐT (Chấm theo ý đúng)</option>
                      <option value="strict">Nghiêm ngặt (Trừ điểm khi thiếu bước/đơn vị)</option>
                      <option value="lenient">Linh hoạt (Khuyến khích tư duy mở)</option>
                    </select>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-[11px] text-slate-600">
                    <p className="font-bold text-slate-800">Quy trình xử lý của AI:</p>
                    <p>1. Nhận diện Họ tên, Lớp, Số báo danh trên đầu bài.</p>
                    <p>2. Đọc OCR câu trả lời trắc nghiệm, điền khuyết và bài giải tự luận.</p>
                    <p>3. Đối chiếu đáp án chuẩn, tính điểm từng phần và sinh nhận xét góp ý.</p>
                  </div>
                </div>

                {/* Batch Action Button */}
                <button
                  type="button"
                  id="btn-start-batch-grading"
                  disabled={isGradingBatch || uploadQueue.length === 0}
                  onClick={handleStartBatchGrading}
                  className={`w-full py-3.5 rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center space-x-2 ${
                    isGradingBatch || uploadQueue.length === 0
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-200"
                  }`}
                >
                  {isGradingBatch ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Đang chấm bài ({gradingProgress.current}/{gradingProgress.total})...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Tiến Hành Chấm Điểm Bằng AI</span>
                    </>
                  )}
                </button>
              </div>

              {/* Tips & Guidance Card */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 space-y-2 text-xs text-emerald-900">
                <div className="flex items-center space-x-2 font-bold text-sm text-emerald-800">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Mẹo Chụp Ảnh & Quét Bài Thi Chuẩn Xác</span>
                </div>
                <ul className="list-disc pl-4 space-y-1 text-slate-700 text-[11px] leading-relaxed">
                  <li>Chụp đủ ánh sáng, góc chụp thẳng đứng với tờ giấy thi.</li>
                  <li>Phần thông tin Họ tên và Lớp nên được ghi rõ ràng ở góc trên.</li>
                  <li>Với bài trắc nghiệm, các vòng tròn tô bút chì hoặc khoanh tròn cần liền nét.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: RUBRIC SETUP & ANSWER KEY MANAGEMENT                              */}
      {/* ========================================================================= */}
      {activeStep === "rubric_setup" && (
        <div className="space-y-6">
          {/* Rubric Source Mode Selector */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              onClick={() => setRubricCreateMode("from_exam")}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                rubricCreateMode === "from_exam"
                  ? "bg-blue-50 border-blue-500 shadow-sm ring-1 ring-blue-500"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  1
                </div>
                <p className="font-bold text-slate-900 text-sm">Từ Đề Thi Có Sẵn</p>
              </div>
              <p className="text-xs text-slate-500">
                Lấy bộ câu hỏi & đáp án chuẩn từ các đề thi đã tạo trong hệ thống EduExam.
              </p>
            </div>

            <div
              onClick={() => setRubricCreateMode("upload_file")}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                rubricCreateMode === "upload_file"
                  ? "bg-blue-50 border-blue-500 shadow-sm ring-1 ring-blue-500"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                  2
                </div>
                <p className="font-bold text-slate-900 text-sm">Tải File Đề & Đáp Án</p>
              </div>
              <p className="text-xs text-slate-500">
                Tải file Ảnh, PDF, Word biểu điểm giáo viên. AI tự động đọc và trích xuất barem điểm.
              </p>
            </div>

            <div
              onClick={() => setRubricCreateMode("manual_text")}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                rubricCreateMode === "manual_text"
                  ? "bg-blue-50 border-blue-500 shadow-sm ring-1 ring-blue-500"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                  3
                </div>
                <p className="font-bold text-slate-900 text-sm">Nhập Đáp Án / Barem Văn Bản</p>
              </div>
              <p className="text-xs text-slate-500">
                Dán nhanh văn bản đáp án trắc nghiệm hoặc barem chấm điểm tự luận.
              </p>
            </div>
          </div>

          {/* Mode 1: Select From System Exams */}
          {rubricCreateMode === "from_exam" && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-sm">
              <h3 className="font-bold text-slate-900 text-base">
                Chọn Đề Thi Trong Hệ Thống Để Làm Biểu Điểm Chấm
              </h3>

              {exams.length === 0 ? (
                <div className="p-6 bg-slate-50 rounded-2xl text-center text-xs text-slate-500 space-y-2">
                  <p>Chưa có đề thi nào trong hệ thống.</p>
                  <p>Vui lòng chuyển qua tab "Trộn đề & Cấu hình" để tạo đề hoặc chọn tab "Tải File Đề & Đáp Án".</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {exams.map((ex) => (
                    <div
                      key={ex.id}
                      onClick={() => {
                        setSelectedExamIdForRubric(ex.id);
                        handleSelectExamAsRubric(ex.id);
                      }}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                        selectedExamIdForRubric === ex.id
                          ? "bg-blue-50 border-blue-400 shadow-xs"
                          : "bg-slate-50 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{ex.title}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            Môn: {ex.config.subject} • {ex.config.grade} • {ex.originalQuestions.length} câu
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                          {ex.variants.length} mã đề
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Mode 2: Upload File Rubric */}
          {rubricCreateMode === "upload_file" && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-sm">
              <h3 className="font-bold text-slate-900 text-base">
                Tải File Đề & Đáp Án / Biểu Điểm Chấm Của Giáo Viên
              </h3>

              {rubricExtractError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold">
                  {rubricExtractError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Môn học</label>
                  <input
                    type="text"
                    value={rubricSubject}
                    onChange={(e) => setRubricSubject(e.target.value)}
                    placeholder="Toán học, Vật lý, Ngữ văn..."
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Khối lớp</label>
                  <select
                    value={rubricGrade}
                    onChange={(e) => setRubricGrade(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="Khối 12">Khối 12</option>
                    <option value="Khối 11">Khối 11</option>
                    <option value="Khối 10">Khối 10</option>
                    <option value="Khối 9">Khối 9</option>
                  </select>
                </div>
              </div>

              <div
                onClick={() => rubricFileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 rounded-2xl p-6 text-center cursor-pointer space-y-2"
              >
                <input
                  type="file"
                  ref={rubricFileInputRef}
                  accept="image/*,application/pdf,.docx"
                  className="hidden"
                  onChange={handleUploadRubricFile}
                />
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mx-auto">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="font-bold text-slate-800 text-sm">
                  Chọn file Ảnh / PDF / Word Đề & Đáp án
                </p>
                <p className="text-xs text-slate-500">
                  AI sẽ tự động phân tích và trích xuất từng câu hỏi, đáp án đúng và điểm tối đa.
                </p>
              </div>

              {isExtractingRubric && (
                <div className="p-4 bg-blue-50 rounded-2xl text-blue-700 text-xs flex items-center justify-center space-x-2 font-semibold animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>AI đang đọc và số hóa biểu điểm từ tài liệu...</span>
                </div>
              )}
            </div>
          )}

          {/* Mode 3: Manual Text Rubric */}
          {rubricCreateMode === "manual_text" && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-sm">
              <h3 className="font-bold text-slate-900 text-base">
                Nhập Văn Bản Đáp Án & Biểu Điểm Chấm
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Môn học</label>
                  <input
                    type="text"
                    value={rubricSubject}
                    onChange={(e) => setRubricSubject(e.target.value)}
                    placeholder="Toán học"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Khối lớp</label>
                  <select
                    value={rubricGrade}
                    onChange={(e) => setRubricGrade(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="Khối 12">Khối 12</option>
                    <option value="Khối 11">Khối 11</option>
                    <option value="Khối 10">Khối 10</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-xs">
                  Nội dung Đáp án / Biểu điểm:
                </label>
                <textarea
                  rows={8}
                  value={manualRubricText}
                  onChange={(e) => setManualRubricText(e.target.value)}
                  placeholder="Ví dụ:
Câu 1: A (0.25đ)
Câu 2: B (0.25đ)
Câu 3: a-Đ, b-S, c-Đ, d-S (1.0đ)
Câu 4: Tự luận tính tích phân I = 2e - 1 (2.0đ)"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <button
                type="button"
                disabled={isExtractingRubric || !manualRubricText.trim()}
                onClick={handleParseManualTextRubric}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center space-x-2 transition-all"
              >
                {isExtractingRubric ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>AI đang phân tích biểu điểm...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Tạo Biểu Điểm Từ Văn Bản</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Active Rubric Inspection & Edit Table */}
          {activeRubric && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Biểu Điểm Đang Áp Dụng: {activeRubric.title}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tổng điểm tối đa: <strong className="text-blue-600">{activeRubric.maxScore}đ</strong> • {activeRubric.items.length} câu hỏi
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setActiveStep("upload_grade")}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5"
                  >
                    <span>Dùng Biểu Điểm Này Để Chấm Bài</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
                      <th className="py-3 px-3 font-bold w-16">Câu</th>
                      <th className="py-3 px-4 font-bold">Nội dung câu hỏi / Tóm tắt</th>
                      <th className="py-3 px-4 font-bold">Đáp án chuẩn GV</th>
                      <th className="py-3 px-3 font-bold w-24">Điểm Tối Đa</th>
                      <th className="py-3 px-4 font-bold">Tiêu chí chấm / Barem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeRubric.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="py-3 px-3 font-bold text-blue-700">
                          Câu {item.questionIndex}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900 max-w-xs truncate">
                          {item.content || `Nội dung câu hỏi ${item.questionIndex}`}
                        </td>
                        <td className="py-3 px-4 font-bold font-mono text-emerald-700">
                          {item.correctAnswer}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-800">
                          {item.points}đ
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-[11px]">
                          {item.criteria || "Theo barem chuẩn"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: RESULTS TABLE & DETAILED SIDE-BY-SIDE REVIEW                      */}
      {/* ========================================================================= */}
      {activeStep === "results_table" && (
        <div className="space-y-6">
          {/* Action & Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo tên học sinh, lớp, mã đề..."
                  className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Class Filter */}
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
              >
                <option value="all">Tất cả lớp ({availableClasses.length})</option>
                {availableClasses.map((c) => (
                  <option key={c} value={c}>
                    Lớp {c}
                  </option>
                ))}
              </select>

              {/* Grade classification Filter */}
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
              >
                <option value="all">Tất cả xếp loại</option>
                <option value="Xuất sắc">Xuất sắc</option>
                <option value="Giỏi">Giỏi</option>
                <option value="Khá">Khá</option>
                <option value="Trung bình">Trung bình</option>
                <option value="Yếu">Yếu</option>
              </select>
            </div>

            {/* Quick Export CTA */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => exportGradedPapersToExcel(filteredPapers, activeRubric?.title)}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải File Excel</span>
              </button>

              <button
                type="button"
                onClick={handleCopyGoogleSheetsTSV}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs"
              >
                {copySuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Đã sao chép!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao Chép Dán Google Sheets</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Graded Papers List Table */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white border-b border-slate-800">
                    <th className="py-3.5 px-4 font-bold w-12 text-center">STT</th>
                    <th className="py-3.5 px-4 font-bold">Thí Sinh</th>
                    <th className="py-3.5 px-3 font-bold">Lớp</th>
                    <th className="py-3.5 px-3 font-bold">Mã Đề</th>
                    <th className="py-3.5 px-4 font-bold">File Bài Làm</th>
                    <th className="py-3.5 px-4 font-bold text-center">Tổng Điểm</th>
                    <th className="py-3.5 px-3 font-bold text-center">Xếp Loại</th>
                    <th className="py-3.5 px-4 font-bold">Thời Gian Chấm</th>
                    <th className="py-3.5 px-4 font-bold text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPapers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                        Chưa có kết quả bài chấm nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredPapers.map((paper, idx) => (
                      <tr
                        key={paper.id}
                        className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                        onClick={() => setSelectedPaperForModal(paper)}
                      >
                        <td className="py-3 px-4 font-bold text-slate-400 text-center">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                            <span>{paper.studentName}</span>
                            {paper.isReviewedByTeacher && (
                              <span className="px-1.5 py-0.2 text-[9px] bg-blue-100 text-blue-700 font-semibold rounded">
                                GV đã duyệt
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {paper.studentId || "HS"}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-700">
                          {paper.studentClass}
                        </td>
                        <td className="py-3 px-3 font-bold font-mono text-blue-700">
                          {paper.examCode || "101"}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-medium max-w-xs truncate">
                          {paper.fileName}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-xl font-black text-sm ${
                              paper.totalScore >= 8.0
                                ? "bg-emerald-100 text-emerald-800"
                                : paper.totalScore >= 5.0
                                ? "bg-blue-100 text-blue-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {paper.totalScore} / {paper.maxScore}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              paper.gradeClassification === "Xuất sắc" || paper.gradeClassification === "Giỏi"
                                ? "bg-emerald-100 text-emerald-800"
                                : paper.gradeClassification === "Khá"
                                ? "bg-blue-100 text-blue-800"
                                : paper.gradeClassification === "Trung bình"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {paper.gradeClassification}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {new Date(paper.gradedAt).toLocaleString("vi-VN")}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPaperForModal(paper);
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                              title="Xem đối chiếu chi tiết"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteGradedPaper(paper.id);
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Xóa bài chấm"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 4: GOOGLE SHEETS & EXCEL EXPORT WORKFLOW                             */}
      {/* ========================================================================= */}
      {activeStep === "export_sheets" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Option A: Direct Excel File Download */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  1. Tải Bảng Điểm File Excel (.xlsx)
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Xuất file bảng điểm chuẩn Bộ GD&ĐT bao gồm đầy đủ Họ tên, Lớp, Mã đề, Tổng điểm,
                  và <strong>từng cột chi tiết: Câu trả lời của học sinh, Đáp án của giáo viên, Điểm từng câu và Lời nhận xét</strong>.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5">
                <p className="font-bold text-slate-800">Cấu trúc các cột xuất ra:</p>
                <p className="text-slate-600 text-[11px]">
                  • Cột thông tin: STT | Mã HS | Họ và Tên | Lớp | Tên Đề | Mã Đề | Tổng Điểm | Xếp Loại
                </p>
                <p className="text-slate-600 text-[11px]">
                  • Cột từng câu: Câu 1 (HS Trả lời) | Câu 1 (Đáp án GV) | Câu 1 (Điểm) | Câu 1 (Nhận xét)...
                </p>
              </div>

              <button
                type="button"
                onClick={() => exportGradedPapersToExcel(filteredPapers, activeRubric?.title)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-2 shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Tải Bảng Điểm Excel Ngay ({filteredPapers.length} bài)</span>
              </button>
            </div>

            {/* Option B: 1-Click Copy Paste to Google Sheets */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <Copy className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  2. Sao Chép 1-Click Dán Vào Google Sheets
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Dữ liệu được chuẩn hóa định dạng Tab-Separated Values (TSV). Bạn chỉ cần bấm nút sao chép,
                  mở trang tính Google Sheets và nhấn <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-[10px]">Ctrl + V</kbd> là bảng điểm sẽ tự động dàn đều vào các ô ngay lập tức.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopyGoogleSheetsTSV}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-2 shadow-xs"
              >
                {copySuccess ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Đã sao chép thành công! Mở Google Sheets và dán (Ctrl+V)</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Sao Chép Toàn Bộ Dữ Liệu ({filteredPapers.length} bài)</span>
                  </>
                )}
              </button>

              <a
                href="https://sheets.new"
                target="_blank"
                rel="noreferrer"
                className="block text-center text-xs text-blue-600 hover:underline font-semibold"
              >
                Mở Google Sheets Mới (sheets.new) trong tab khác →
              </a>
            </div>
          </div>

          {/* Option C: Google Apps Script Webhook Sync */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                <ExternalLink className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  3. Đồng Bộ Tự Động Qua Google Apps Script Webhook
                </h3>
                <p className="text-xs text-slate-500">
                  Gửi dữ liệu trực tiếp vào Google Spreadsheet của trường thông qua Webhook URL.
                </p>
              </div>
            </div>

            {webhookStatus && (
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 font-semibold">
                {webhookStatus}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                disabled={isSendingWebhook || !webhookUrl}
                onClick={handleSendToWebhook}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-2 shrink-0 disabled:opacity-50"
              >
                {isSendingWebhook ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang đồng bộ...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Gửi Sang Google Sheet</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DETAILED SIDE-BY-SIDE MODAL REVIEW                                       */}
      {/* ========================================================================= */}
      {selectedPaperForModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/30 text-blue-300 border border-blue-500/40">
                    Đối Chiếu & Giám Khảo Chấm Điểm
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Mã đề: {selectedPaperForModal.examCode || "101"}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white flex items-center space-x-3">
                  <span>{selectedPaperForModal.studentName}</span>
                  <span className="text-slate-400 font-normal text-sm">
                    (Lớp {selectedPaperForModal.studentClass})
                  </span>
                </h2>
              </div>

              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Tổng Điểm</p>
                  <p className="text-xl font-black text-emerald-400">
                    {selectedPaperForModal.totalScore} / {selectedPaperForModal.maxScore}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPaperForModal(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Modal Body: Split Screen */}
            <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-y-auto divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
              {/* Left Column: Student Paper View (Zoom & Rotation) */}
              <div className="lg:col-span-5 p-4 bg-slate-950 flex flex-col space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
                  <span className="font-bold text-slate-300">File bài làm gốc: {selectedPaperForModal.fileName}</span>
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
                      className="p-1 hover:bg-slate-800 text-slate-300 rounded"
                      title="Phóng to"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRotationAngle((r) => (r + 90) % 360)}
                      className="p-1 hover:bg-slate-800 text-slate-300 rounded"
                      title="Xoay ảnh"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 bg-slate-900 rounded-2xl flex items-center justify-center p-2 overflow-hidden min-h-[300px]">
                  {selectedPaperForModal.fileData ? (
                    <img
                      src={selectedPaperForModal.fileData}
                      alt="Student Paper"
                      style={{
                        transform: `scale(${zoomLevel}) rotate(${rotationAngle}deg)`,
                        transition: "transform 0.2s ease",
                      }}
                      className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg"
                    />
                  ) : (
                    <div className="text-center p-6 space-y-2 text-slate-400 text-xs">
                      <FileText className="w-10 h-10 text-slate-600 mx-auto" />
                      <p className="font-bold text-slate-300">{selectedPaperForModal.fileName}</p>
                      <p className="text-[11px] text-slate-500">
                        File tài liệu đã được AI OCR trích xuất thành công toàn bộ câu trả lời.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Side-by-Side Question Comparison & Scoring */}
              <div className="lg:col-span-7 p-4 sm:p-6 space-y-6 overflow-y-auto bg-slate-50">
                {/* AI Summary Card */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center space-x-2 text-xs font-bold text-blue-700">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span>Nhận Xét Tổng Thể Của AI Giám Khảo</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {selectedPaperForModal.summaryEvaluation}
                  </p>
                </div>

                {/* Per-Question Side-by-Side Table */}
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    Đối Chiếu Chi Tiết Từng Câu Hỏi ({selectedPaperForModal.details.length} câu)
                  </h4>

                  <div className="space-y-3">
                    {selectedPaperForModal.details.map((detail, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-2xl border transition-all ${
                          detail.status === "correct"
                            ? "bg-white border-emerald-200 shadow-xs"
                            : detail.status === "partial"
                            ? "bg-white border-amber-200 shadow-xs"
                            : "bg-white border-rose-200 shadow-xs"
                        }`}
                      >
                        {/* Question Header & Score Controller */}
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5 mb-2.5">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900 text-xs">
                              Câu {detail.questionIndex}:
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                detail.status === "correct"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : detail.status === "partial"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {detail.status === "correct"
                                ? "Đúng"
                                : detail.status === "partial"
                                ? "Đúng 1 phần"
                                : "Sai / Chưa đúng"}
                            </span>
                          </div>

                          {/* Editable Score Input */}
                          <div className="flex items-center space-x-1.5 text-xs">
                            <span className="text-slate-500 text-[11px]">Điểm đạt:</span>
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              max={detail.maxPoints}
                              value={detail.pointsAwarded}
                              onChange={(e) =>
                                handleUpdateDetailScore(
                                  detail.questionIndex,
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-14 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold text-xs text-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="text-slate-400 font-semibold">
                              / {detail.maxPoints}đ
                            </span>
                          </div>
                        </div>

                        {/* Side-by-Side Comparison Box */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          {/* Student Answer */}
                          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                            <p className="text-[10px] font-bold uppercase text-slate-500">
                              Câu trả lời của học sinh:
                            </p>
                            <p className="font-bold text-slate-900 break-words font-mono">
                              {detail.studentAnswer || "(Trống)"}
                            </p>
                          </div>

                          {/* Teacher Correct Answer */}
                          <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-1">
                            <p className="text-[10px] font-bold uppercase text-emerald-700">
                              Đáp án chuẩn của giáo viên:
                            </p>
                            <p className="font-bold text-emerald-900 break-words font-mono">
                              {detail.teacherAnswer || "-"}
                            </p>
                          </div>
                        </div>

                        {/* Detailed Feedback & Explanation */}
                        {detail.feedback && (
                          <div className="mt-2.5 p-2 bg-blue-50/50 rounded-xl text-[11px] text-slate-700 space-y-1">
                            <span className="font-bold text-blue-700">Nhận xét & Lỗi sai: </span>
                            <span>{detail.feedback}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Teacher Custom Notes Field */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
                  <label className="block font-bold text-slate-900 text-xs">
                    Ghi Chú & Lời Dặn Riêng Của Giáo Viên:
                  </label>
                  <textarea
                    rows={3}
                    defaultValue={selectedPaperForModal.teacherNotes || ""}
                    onBlur={(e) => handleSaveTeacherNotes(e.target.value)}
                    placeholder="Nhập ghi chú hoặc nhắc nhở cho học sinh này (tự động lưu khi bấm ra ngoài)..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500">
                Thầy cô có thể điều chỉnh điểm từng câu trực tiếp trên bảng.
              </span>
              <button
                type="button"
                onClick={() => setSelectedPaperForModal(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-all"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
