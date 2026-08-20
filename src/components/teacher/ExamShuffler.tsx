import React, { useState } from "react";
import {
  Shuffle,
  FileText,
  UploadCloud,
  CheckCircle2,
  Plus,
  Trash2,
  Printer,
  Sparkles,
  Send,
  Sliders,
  HelpCircle,
  Eye,
  FileSpreadsheet,
  AlertTriangle,
  Calendar,
  Clock,
  Layers,
  CheckCheck,
  Edit3,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Copy,
  Download,
  FileCode,
  FileCheck,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  ShieldAlert,
  Monitor,
  PenTool,
  Save,
  Image as ImageIcon,
  FileImage,
  Maximize2,
  Paperclip,
  Gamepad2,
  FileDown,
  FilePlus,
} from "lucide-react";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { Question, ExamConfig, ExamVariant, ExamPackage, ExamPart, CognitiveLevel, QuestionType, TrueFalseStatement } from "../../types";
import {
  generateVariantsFromQuestions,
  exportAnswerKeyMatrix,
  normalizeExamQuestions3Parts,
  exportQuestionsToWordDoc,
  exportQuestionsToPrintablePdf,
  SAMPLE_EXAM_TEXT,
  SAMPLE_ENGLISH_THPT_TEXT,
  LETTERS,
} from "../../utils/examHelpers";
import { convertDocxHtmlToMarkdown } from "../../utils/docxTableConverter";
import { extractDocxDeep } from "../../utils/docxDeepExtractor";
import { FormattedQuestionContent, MathTextRenderer } from "../FormattedQuestionContent";
import { getStoredApiKey, getStoredSelectedModel } from "../ModelSettingsModal";
import { clientParseExam, clientSolveExam, clientParseExamFile } from "../../utils/clientAI";
import { exportToMoodleXMLFile, exportToGIFTFile } from "../../utils/moodleGiftExporter";
import { openPresentationInNewTab, exportPresentationHTMLFile } from "../../utils/pptxPresentationExporter";
import { openPrintableOMRSheet } from "../../utils/omrSheetGenerator";
import { LiveQuizModal } from "../game/LiveQuizModal";

// Helper: Extract huge Base64 strings from Markdown text to prevent payload bloat or AI token truncation
function sanitizeMarkdownImages(
  text: string,
  existingMap?: Record<string, string>
): {
  cleanText: string;
  imageMap: Record<string, string>;
} {
  const imageMap: Record<string, string> = { ...(existingMap || {}) };
  let count = Object.keys(imageMap).length;

  // 1. Match Markdown images with data:image base64 (including linebreaks/spaces inside base64)
  let cleanText = text.replace(
    /!\[(.*?)\]\(\s*data:image\/([^;]+);base64,([\s\S]*?)\)/gi,
    (_, alt, mime, rawBase64) => {
      const cleanBase64 = `data:image/${mime};base64,${rawBase64.replace(/\s+/g, "")}`;
      const token = `__IMG_TOKEN_${count}__`;
      imageMap[token] = cleanBase64;
      count++;
      return `![${alt || "Hình vẽ"}](${token})`;
    }
  );

  // 2. Match standalone data:image/ base64 strings not in Markdown syntax
  cleanText = cleanText.replace(
    /data:image\/([a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=\s\r\n]{40,})/gi,
    (_, mime, rawBase64) => {
      const cleanBase64 = `data:image/${mime};base64,${rawBase64.replace(/\s+/g, "")}`;
      const token = `__IMG_TOKEN_${count}__`;
      imageMap[token] = cleanBase64;
      count++;
      return `![Hình vẽ](${token})`;
    }
  );

  return { cleanText, imageMap };
}

// Helper: Restore Base64 images into Questions
function restoreMarkdownImagesInQuestions(
  questions: Question[],
  imageMap: Record<string, string>
): Question[] {
  if (!imageMap || Object.keys(imageMap).length === 0) return questions;

  const imageEntries = Object.entries(imageMap);
  const imageValues = Object.values(imageMap);

  return questions.map((q) => {
    let content = q.content || "";
    let passage = q.passageContent || "";
    let diagramUrl = q.diagramUrl;
    let explanation = q.explanation || "";
    let hasTableOrDiagram = q.hasTableOrDiagram;

    // Helper to replace both explicit tokens and image index references
    const replaceTokensInString = (str: string): string => {
      if (!str) return "";
      let res = str;
      // 1. Direct token replacement e.g. __IMG_TOKEN_0__
      imageEntries.forEach(([token, base64]) => {
        if (res.includes(token)) {
          res = res.replaceAll(token, base64);
        }
      });

      // 2. Pattern ![Hình vẽ N](...) or ![Hình vẽ N] or ![Hình N] where URL was tokenized or lost
      res = res.replace(/!\[(Hình\s*(?:vẽ\s*)?(\d+)|.*?)\](?:\(([^\s)]*)\))?/gi, (fullMatch, alt, numStr, insideUrl) => {
        if (insideUrl && insideUrl.startsWith("data:image")) {
          return `![${alt}](${insideUrl.replace(/\s+/g, "")})`;
        }
        if (numStr) {
          const num = parseInt(numStr, 10);
          const targetToken = `__IMG_TOKEN_${num - 1}__`;
          const targetBase64 = imageMap[targetToken] || imageValues[num - 1];
          if (targetBase64) {
            return `![${alt}](${targetBase64})`;
          }
        }
        if (insideUrl && imageMap[insideUrl]) {
          return `![${alt}](${imageMap[insideUrl]})`;
        }
        return fullMatch;
      });

      return res;
    };

    content = replaceTokensInString(content);
    passage = replaceTokensInString(passage);
    explanation = replaceTokensInString(explanation);

    if (diagramUrl) {
      diagramUrl = replaceTokensInString(diagramUrl);
      if (imageMap[diagramUrl]) {
        diagramUrl = imageMap[diagramUrl];
      }
    }

    // Auto-detect diagramUrl from content if not set
    if (!diagramUrl) {
      const imgMatch = content.match(/!\[.*?\]\((data:image\/[^)]+)\)/);
      if (imgMatch && imgMatch[1]) {
        diagramUrl = imgMatch[1];
      }
    }

    // Options
    let options = q.options ? q.options.map((opt) => replaceTokensInString(opt)) : undefined;

    // Statements
    let statements = q.statements ? q.statements.map((st) => ({
      ...st,
      text: replaceTokensInString(st.text),
      explanation: st.explanation ? replaceTokensInString(st.explanation) : undefined,
    })) : undefined;

    return {
      ...q,
      content,
      options,
      statements,
      explanation: explanation || undefined,
      passageContent: passage || undefined,
      diagramUrl: diagramUrl || undefined,
      hasTableOrDiagram: Boolean(
        hasTableOrDiagram ||
        content.includes("![") ||
        content.includes("data:image") ||
        content.includes("|") ||
        diagramUrl
      ),
    };
  });
}

interface ExamShufflerProps {
  questionBank: Question[];
  onPublishExam: (exam: ExamPackage) => void;
  onOpenStudentExam: (examId: string, examCode: string) => void;
}

export const ExamShuffler: React.FC<ExamShufflerProps> = ({
  questionBank,
  onPublishExam,
  onOpenStudentExam,
}) => {
  // General Configurations
  const [config, setConfig] = useState<ExamConfig>({
    department: "SỞ GIÁO DỤC VÀ ĐÀO TẠO TP. HỒ CHÍ MINH",
    school: "TRƯỜNG THPT CHUYÊN LÊ HỒNG PHONG",
    examPeriod: "Thi thử Tốt nghiệp THPT 2026",
    subject: "Toán học",
    grade: "Khối 12",
    duration: 50,
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
  });

  const [examTitle, setExamTitle] = useState("Đề thi thử Tốt nghiệp THPT 2026 - Chuẩn cấu trúc Bộ GD&ĐT");
  const [accessCode, setAccessCode] = useState("THPT2026");
  const [newExamCodeInput, setNewExamCodeInput] = useState("");

  // Input source mode: "paste" | "bank" | "upload"
  const [inputMode, setInputMode] = useState<"paste" | "bank" | "upload">("paste");
  const [rawText, setRawText] = useState(SAMPLE_EXAM_TEXT);
  const [uploadedImageMap, setUploadedImageMap] = useState<Record<string, string>>({});
  const [isParsing, setIsParsing] = useState(false);
  const [isSolvingAI, setIsSolvingAI] = useState(false);

  // Selected questions list
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);
  const [generatedVariants, setGeneratedVariants] = useState<ExamVariant[]>([]);
  const [activeVariantTab, setActiveVariantTab] = useState<string>("student");
  const [publishedExam, setPublishedExam] = useState<ExamPackage | null>(null);
  const [parseSuccessMsg, setParseSuccessMsg] = useState("");

  // Answer Moderation Modal / State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showMissingAnswersPrompt, setShowMissingAnswersPrompt] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isLiveQuizModalOpen, setIsLiveQuizModalOpen] = useState(false);

  // View modes: list or student simulation
  const [extractedViewMode, setExtractedViewMode] = useState<"list" | "student">("list");
  const [extractedPartFilter, setExtractedPartFilter] = useState<"all" | 1 | 2 | 3>("all");
  const [previewStudentQIndex, setPreviewStudentQIndex] = useState<number>(1);
  const [generatedViewMode, setGeneratedViewMode] = useState<"student" | "paper" | "matrix">("student");
  const [isPaperAnswersVisible, setIsPaperAnswersVisible] = useState<boolean>(false);
  const [simAnswers, setSimAnswers] = useState<Record<number, any>>({});
  const [showSolutionExplanation, setShowSolutionExplanation] = useState<boolean>(true);

  // Quick Exam Period Presets
  const examPeriodPresets = [
    "Kiểm tra Thường xuyên (15 phút)",
    "Kiểm tra Định kỳ Giữa kỳ I",
    "Kiểm tra Định kỳ Cuối kỳ I",
    "Kiểm tra Định kỳ Giữa kỳ II",
    "Kiểm tra Định kỳ Cuối kỳ II",
    "Thi thử Tốt nghiệp THPT 2026",
    "Khảo sát chất lượng đầu năm",
    "Ôn tập chuyên đề học kỳ",
  ];

  // Quick Subject Presets
  const subjectPresets = [
    "Toán học",
    "Tiếng Anh",
    "Vật lý",
    "Hóa học",
    "Sinh học",
    "Lịch sử",
    "Địa lý",
    "GDCD / GD Kinh tế & Pháp luật",
    "Tin học",
    "Ngữ văn",
  ];

  // Add exam code
  const handleAddExamCode = () => {
    const trimmed = newExamCodeInput.trim();
    if (trimmed && !config.examCodes.includes(trimmed)) {
      setConfig({
        ...config,
        examCodes: [...config.examCodes, trimmed],
      });
      setNewExamCodeInput("");
    }
  };

  // Remove exam code
  const handleRemoveExamCode = (codeToRemove: string) => {
    if (config.examCodes.length <= 1) return;
    setConfig({
      ...config,
      examCodes: config.examCodes.filter((c) => c !== codeToRemove),
    });
  };

  // Parse raw text via AI or fallback
  const handleParseRawText = async (customText?: string, customImageMap?: Record<string, string>) => {
    const textToParse = customText !== undefined ? customText : rawText;
    if (!textToParse.trim()) return;
    setIsParsing(true);
    setParseSuccessMsg("");

    try {
      const mapToUse = customImageMap || uploadedImageMap;
      if (customImageMap) {
        setUploadedImageMap(customImageMap);
      }

      // Sanitize large base64 images into compact tokens so payload is fast & AI preserves tokens
      const { cleanText, imageMap } = sanitizeMarkdownImages(textToParse, mapToUse);
      // Keep uploadedImageMap updated with any newly discovered tokens
      setUploadedImageMap((prev) => ({ ...prev, ...imageMap }));

      // If user had pasted raw base64 into the textarea, clean up the displayed rawText so it remains human-readable
      if (cleanText !== textToParse && customText === undefined) {
        setRawText(cleanText);
      }

      const apiKey = getStoredApiKey();
      const model = getStoredSelectedModel();
      const data = await clientParseExam({
        rawText: cleanText,
        subject: config.subject,
        grade: config.grade,
        apiKey,
        model,
      });

      if (data.success && data.data && data.data.length > 0) {
        // Restore full base64 images back into questions & enforce strict 3-part format
        const restoredQuestions = restoreMarkdownImagesInQuestions(data.data, imageMap);
        const normalizedQuestions = normalizeExamQuestions3Parts(restoredQuestions);
        setSelectedQuestions(normalizedQuestions);

        // Auto-generate variants so all preview modes (List, Student Mode, Paper, Answer Key Matrix) are immediately active
        const variants = generateVariantsFromQuestions(normalizedQuestions, config);
        setGeneratedVariants(variants);
        if (variants.length > 0) {
          setActiveVariantTab(variants[0].examCode);
        }
        setExtractedViewMode("list");
        setExtractedPartFilter("all");
        setShowMissingAnswersPrompt(false);

        const hasUnreviewed = normalizedQuestions.some((q: Question) => q.needsReview);
        const groupCount = new Set(normalizedQuestions.filter((q: Question) => q.groupId).map((q: Question) => q.groupId)).size;
        const imageCount = normalizedQuestions.filter((q: Question) => q.hasTableOrDiagram || q.content?.includes("![") || q.diagramUrl).length;

        let msg = data.warning
          ? `${data.warning} (Đã trích xuất ${normalizedQuestions.length} câu)`
          : `Đã trích xuất thành công toàn bộ ${normalizedQuestions.length} câu hỏi chuẩn 3 phần!`;
        if (imageCount > 0) {
          msg += ` (Bảo toàn ${imageCount} câu có hình vẽ/biểu đồ/sơ đồ).`;
        }
        if (groupCount > 0) {
          msg += ` (Phát hiện ${groupCount} nhóm câu hỏi gộp/bài đọc).`;
        }
        if (hasUnreviewed) {
          msg += ` ⚡ AI đã tự động giải đáp án cho các câu chưa có đáp án, bạn có thể kiểm duyệt trực tiếp bên dưới.`;
        }
        setParseSuccessMsg(msg);

        setTimeout(() => {
          document.getElementById("extracted-questions-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 150);
      } else {
        alert(data.error || "Không thể phân tích đề thi. Hãy kiểm tra lại định dạng câu hỏi hoặc nhập nội dung đề.");
      }
    } catch (err: any) {
      alert("Lỗi khi phân tích đề thi: " + err.message);
    } finally {
      setIsParsing(false);
    }
  };

  // AI solve all questions on demand
  const handleSolveWithAI = async () => {
    if (selectedQuestions.length === 0) {
      alert("Chưa có câu hỏi nào để giải!");
      return;
    }

    setIsSolvingAI(true);
    try {
      const apiKey = getStoredApiKey();
      const model = getStoredSelectedModel();
      const data = await clientSolveExam({
        questions: selectedQuestions,
        subject: config.subject,
        grade: config.grade,
        apiKey,
        model,
      });

      if (data.success && data.data) {
        setSelectedQuestions(data.data);
        setParseSuccessMsg(`AI đã giải xong toàn bộ ${data.data.length} câu hỏi kèm lời giải chi tiết! Vui lòng kiểm duyệt.`);
        setShowReviewModal(true);
      } else {
        alert(data.error || "Lỗi khi AI giải đề thi.");
      }
    } catch (err: any) {
      alert("Lỗi kết nối AI: " + err.message);
    } finally {
      setIsSolvingAI(false);
    }
  };

  // Upload file state & Multi-File Drag-and-drop
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [uploadedFileSize, setUploadedFileSize] = useState<string>("");
  const [uploadedFilesList, setUploadedFilesList] = useState<Array<{ name: string; size: string; count: number }>>([]);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; currentFileName: string } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isReadingFile, setIsReadingFile] = useState<boolean>(false);
  const [isImageUploaded, setIsImageUploaded] = useState<boolean>(false);
  const [hasSavedDraft, setHasSavedDraft] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem("edutest_saved_draft_exam"));
    } catch {
      return false;
    }
  });

  // Quick Change Part for any question (Phần I <-> Phần II <-> Phần III)
  const handleQuickChangeQuestionPart = (questionId: string, targetPart: 1 | 2 | 3) => {
    setSelectedQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId) return q;

        if (targetPart === 1) {
          // Convert to Part I (Multiple Choice 4 Options)
          let opts: string[] = [];
          if (q.options && q.options.length >= 2) {
            opts = [...q.options];
          } else if (q.statements && q.statements.length > 0) {
            opts = q.statements.map((s) => s.text);
          }
          while (opts.length < 4) {
            opts.push(`Phương án ${LETTERS[opts.length] || "A"}`);
          }
          return {
            ...q,
            part: 1,
            questionType: "multiple_choice" as QuestionType,
            options: opts.slice(0, 4),
            statements: undefined,
            shortAnswer: undefined,
            correctIndex: q.correctIndex ?? 0,
            needsReview: false,
          };
        } else if (targetPart === 2) {
          // Convert to Part II (True / False 4 Sub-statements)
          let stmts: TrueFalseStatement[] = [];
          if (q.statements && q.statements.length >= 2) {
            stmts = [...q.statements];
          } else if (q.options && q.options.length > 0) {
            stmts = q.options.map((opt, oIdx) => ({
              id: ["a", "b", "c", "d"][oIdx] || "a",
              label: `${["a", "b", "c", "d"][oIdx] || "a"})`,
              text: opt,
              correctValue: oIdx === (q.correctIndex || 0),
            }));
          }
          const required = ["a", "b", "c", "d"];
          while (stmts.length < 4) {
            const l = required[stmts.length];
            stmts.push({ id: l, label: `${l})`, text: `Khẳng định ý ${l}`, correctValue: true });
          }
          return {
            ...q,
            part: 2,
            questionType: "true_false" as QuestionType,
            statements: stmts.slice(0, 4),
            options: [],
            shortAnswer: undefined,
            needsReview: false,
          };
        } else {
          // Convert to Part III (Short Answer)
          return {
            ...q,
            part: 3,
            questionType: "short_answer" as QuestionType,
            shortAnswer: q.shortAnswer || (q.options && q.options[q.correctIndex || 0]) || "0",
            options: [],
            statements: undefined,
            needsReview: false,
          };
        }
      })
    );
  };

  // Restore Draft from LocalStorage
  const handleRestoreDraft = () => {
    try {
      const saved = localStorage.getItem("edutest_saved_draft_exam");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.questions && parsed.questions.length > 0) {
          setSelectedQuestions(parsed.questions);
          if (parsed.config) setConfig(parsed.config);
          if (parsed.examTitle) setExamTitle(parsed.examTitle);
          if (parsed.filesList) setUploadedFilesList(parsed.filesList);
          if (parsed.imageMap) setUploadedImageMap(parsed.imageMap);
          const variants = generateVariantsFromQuestions(parsed.questions, parsed.config || config);
          setGeneratedVariants(variants);
          if (variants.length > 0) {
            setActiveVariantTab(variants[0].examCode);
          }
          setParseSuccessMsg(`✅ Đã khôi phục thành công bản nháp gồm ${parsed.questions.length} câu hỏi!`);
          setShowMissingAnswersPrompt(false);
          return;
        }
      }
      alert("Không tìm thấy bản nháp đề thi nào trước đó.");
    } catch (e) {
      alert("Không thể khôi phục bản nháp đề thi.");
    }
  };

  // Process multiple files in sequence (Batch OCR & continuous question merging)
  const processFilesBatch = async (files: File[], append: boolean = false) => {
    if (!files || files.length === 0) return;
    setIsReadingFile(true);
    setIsParsing(true);

    let currentQuestionsList: Question[] = append ? [...selectedQuestions] : [];
    let updatedFilesList = append ? [...uploadedFilesList] : [];
    let combinedImageMap: Record<string, string> = append ? { ...uploadedImageMap } : {};

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress({ current: i + 1, total: files.length, currentFileName: file.name });
        setUploadedFileName(file.name);
        setUploadedFileSize((file.size / 1024).toFixed(1) + " KB");

        const fileNameLower = file.name.toLowerCase();
        const isImage = fileNameLower.match(/\.(png|jpe?g|webp|gif|bmp)$/) !== null;
        if (isImage) setIsImageUploaded(true);

        if (fileNameLower.endsWith(".pdf") || isImage) {
          const base64Data: string = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          const mimeType = file.type || (fileNameLower.endsWith(".pdf") ? "application/pdf" : "image/png");
          const apiKey = getStoredApiKey();
          const model = getStoredSelectedModel();

          const data = await clientParseExamFile({
            fileBase64: base64Data,
            mimeType,
            fileName: file.name,
            subject: config.subject,
            grade: config.grade,
            apiKey,
            model,
          });

          if (data.success && data.data && data.data.length > 0) {
            const startIndex = currentQuestionsList.length;
            const newQuestions = data.data.map((q, qIdx) => ({
              ...q,
              id: `file_q_${Date.now()}_${startIndex + qIdx + 1}`,
              originalOrderIndex: startIndex + qIdx + 1,
            }));
            currentQuestionsList = [...currentQuestionsList, ...newQuestions];
            updatedFilesList.push({
              name: file.name,
              size: (file.size / 1024).toFixed(1) + " KB",
              count: newQuestions.length,
            });
          } else {
            throw new Error(
              data.error ||
                `Không thể nhận diện câu hỏi từ file "${file.name}". Vui lòng kiểm tra lại Google Gemini API Key trong Cài Đặt (hoặc tạo API Key miễn phí tại Google AI Studio).`
            );
          }
        } else if (fileNameLower.endsWith(".docx")) {
          const arrayBuffer = await file.arrayBuffer();
          let deepResult: any = null;
          try {
            deepResult = await extractDocxDeep(arrayBuffer);
          } catch (e) {}

          const mammothOptions: any = {};
          if ((mammoth as any).images?.inline) {
            mammothOptions.convertImage = (mammoth as any).images.inline((element: any) => {
              return element.read("base64").then((buf: string) => ({
                src: `data:${element.contentType || "image/png"};base64,${buf}`,
              }));
            });
          }

          let htmlResult: any = null;
          try {
            htmlResult = await mammoth.convertToHtml({ arrayBuffer }, mammothOptions);
          } catch (e) {}

          const docxHtmlResult = htmlResult ? convertDocxHtmlToMarkdown(htmlResult.value) : { markdown: "", imageMap: {} };
          const finalImageMap = {
            ...(docxHtmlResult.imageMap || {}),
            ...(deepResult?.imageMap || {}),
          };
          combinedImageMap = { ...combinedImageMap, ...finalImageMap };

          let textToUse = "";
          if (deepResult && deepResult.markdown && deepResult.markdown.trim().length > 30) {
            textToUse = deepResult.markdown;
          } else if (docxHtmlResult.markdown && docxHtmlResult.markdown.trim().length > 0) {
            textToUse = docxHtmlResult.markdown;
          } else {
            const raw = await mammoth.extractRawText({ arrayBuffer });
            textToUse = raw.value;
          }

          const parsed = await clientParseExam({
            rawText: textToUse,
            subject: config.subject,
            grade: config.grade,
          });

          if (parsed.success && parsed.data && parsed.data.length > 0) {
            const restored = restoreMarkdownImagesInQuestions(parsed.data, finalImageMap);
            const startIndex = currentQuestionsList.length;
            const newQuestions = restored.map((q, qIdx) => ({
              ...q,
              id: `docx_q_${Date.now()}_${startIndex + qIdx + 1}`,
              originalOrderIndex: startIndex + qIdx + 1,
            }));
            currentQuestionsList = [...currentQuestionsList, ...newQuestions];
            updatedFilesList.push({
              name: file.name,
              size: (file.size / 1024).toFixed(1) + " KB",
              count: newQuestions.length,
            });
          }
        } else if (fileNameLower.endsWith(".xlsx") || fileNameLower.endsWith(".xls")) {
          const arrayBuffer = await file.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const html = XLSX.utils.sheet_to_html(worksheet);
          const docxResult = convertDocxHtmlToMarkdown(html);
          const finalData = docxResult.markdown && docxResult.markdown.trim() ? docxResult.markdown : XLSX.utils.sheet_to_csv(worksheet);

          const parsed = await clientParseExam({
            rawText: finalData,
            subject: config.subject,
            grade: config.grade,
          });

          if (parsed.success && parsed.data && parsed.data.length > 0) {
            const startIndex = currentQuestionsList.length;
            const newQuestions = parsed.data.map((q, qIdx) => ({
              ...q,
              id: `excel_q_${Date.now()}_${startIndex + qIdx + 1}`,
              originalOrderIndex: startIndex + qIdx + 1,
            }));
            currentQuestionsList = [...currentQuestionsList, ...newQuestions];
            updatedFilesList.push({
              name: file.name,
              size: (file.size / 1024).toFixed(1) + " KB",
              count: newQuestions.length,
            });
          }
        } else {
          // Plain text file (.txt, .md, .csv)
          const content: string = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = reject;
            reader.readAsText(file);
          });

          const parsed = await clientParseExam({
            rawText: content,
            subject: config.subject,
            grade: config.grade,
          });

          if (parsed.success && parsed.data && parsed.data.length > 0) {
            const startIndex = currentQuestionsList.length;
            const newQuestions = parsed.data.map((q, qIdx) => ({
              ...q,
              id: `txt_q_${Date.now()}_${startIndex + qIdx + 1}`,
              originalOrderIndex: startIndex + qIdx + 1,
            }));
            currentQuestionsList = [...currentQuestionsList, ...newQuestions];
            updatedFilesList.push({
              name: file.name,
              size: (file.size / 1024).toFixed(1) + " KB",
              count: newQuestions.length,
            });
          }
        }
      }

      if (currentQuestionsList.length > 0) {
        setSelectedQuestions(currentQuestionsList);
        setUploadedFilesList(updatedFilesList);
        setUploadedImageMap(combinedImageMap);
        const variants = generateVariantsFromQuestions(currentQuestionsList, config);
        setGeneratedVariants(variants);
        if (variants.length > 0) {
          setActiveVariantTab(variants[0].examCode);
        }
        setExtractedViewMode("list");
        setShowMissingAnswersPrompt(false);

        // Auto Save to localStorage
        try {
          localStorage.setItem(
            "edutest_saved_draft_exam",
            JSON.stringify({
              questions: currentQuestionsList,
              config,
              examTitle,
              filesList: updatedFilesList,
              imageMap: combinedImageMap,
              savedAt: new Date().toISOString(),
            })
          );
          setHasSavedDraft(true);
        } catch (e) {}

        setParseSuccessMsg(`✅ Đã nạp và ghép liên tục ${files.length} file (${currentQuestionsList.length} câu hỏi)!`);
        setTimeout(() => {
          document.getElementById("extracted-questions-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 150);
      } else {
        alert("Không thể trích xuất câu hỏi nào từ các file đã tải lên.");
      }
    } catch (err: any) {
      alert("Lỗi xử lý file: " + (err.message || "Định dạng file không hỗ trợ"));
    } finally {
      setIsReadingFile(false);
      setIsParsing(false);
      setUploadProgress(null);
    }
  };

  // Upload file handler (supports multiple files)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, append: boolean = false) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFilesBatch(Array.from(files), append);
    }
  };

  // Download sample .txt file for user to test file upload immediately
  const handleDownloadSampleFile = (type: "math" | "english") => {
    const content = type === "math" ? SAMPLE_EXAM_TEXT : SAMPLE_ENGLISH_THPT_TEXT;
    const fileName = type === "math" ? "de_thi_mau_toan_thpt.txt" : "de_thi_mau_tieng_anh_thpt.txt";
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Load sample THPT English with Group Passage
  const handleLoadEnglishTHPTSample = () => {
    setRawText(SAMPLE_ENGLISH_THPT_TEXT);
    setUploadedFileName("de_thi_mau_tieng_anh_thpt.txt");
    setUploadedFileSize("3.8 KB");
    setConfig({
      ...config,
      subject: "Tiếng Anh",
      examPeriod: "Thi thử Tốt nghiệp THPT 2026",
      duration: 50,
      originalExamCode: "401",
      examCodes: ["401", "402", "403", "404"],
    });
    setExamTitle("Đề thi thử Tốt nghiệp THPT 2026 - Môn Tiếng Anh (Có Nhóm Bài Đọc Hiểu Gộp)");
    handleParseRawText(SAMPLE_ENGLISH_THPT_TEXT);
  };

  // Load sample THPT Math
  const handleLoadMathTHPTSample = () => {
    setRawText(SAMPLE_EXAM_TEXT);
    setUploadedFileName("de_thi_mau_toan_thpt.txt");
    setUploadedFileSize("4.2 KB");
    setConfig({
      ...config,
      subject: "Toán học",
      examPeriod: "Thi thử Tốt nghiệp THPT 2026",
      duration: 50,
      originalExamCode: "101",
      examCodes: ["101", "102", "103", "104"],
    });
    setExamTitle("Đề thi thử Tốt nghiệp THPT 2026 - Môn Toán học (Có Bảng Biến Thiên)");
    handleParseRawText(SAMPLE_EXAM_TEXT);
  };

  // Toggle selection from Question Bank
  const handleToggleBankQuestion = (q: Question) => {
    const exists = selectedQuestions.some((item) => item.id === q.id);
    if (exists) {
      setSelectedQuestions(selectedQuestions.filter((item) => item.id !== q.id));
    } else {
      setSelectedQuestions([...selectedQuestions, q]);
    }
  };

  // Select all from bank
  const handleSelectAllBank = () => {
    setSelectedQuestions([...questionBank]);
  };

  // Change question correct index in review (Part I)
  const handleUpdateQuestionAnswer = (questionId: string, newCorrectIndex: number) => {
    setSelectedQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, correctIndex: newCorrectIndex, needsReview: false } : q))
    );
  };

  // Toggle True/False sub-statement for Part II
  const handleToggleTrueFalseStatement = (questionId: string, stmtId: string, currentVal: boolean) => {
    setSelectedQuestions((prev) =>
      prev.map((q) => {
        if (q.id === questionId && q.statements) {
          return {
            ...q,
            needsReview: false,
            statements: q.statements.map((st) =>
              st.id === stmtId ? { ...st, correctValue: !currentVal } : st
            ),
          };
        }
        return q;
      })
    );
  };

  // Set Short Answer text for Part III
  const handleUpdateShortAnswer = (questionId: string, newAns: string) => {
    setSelectedQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, shortAnswer: newAns, needsReview: false } : q))
    );
  };

  // Mark all questions as reviewed & approved
  const handleApproveAllAnswers = () => {
    setSelectedQuestions((prev) =>
      prev.map((q) => ({ ...q, needsReview: false }))
    );
    setShowReviewModal(false);
    setParseSuccessMsg("✅ Toàn bộ đáp án đã được kiểm duyệt và sẵn sàng tạo đề!");
  };

  // Save edited question from QuestionEditorModal
  const handleSaveEditedQuestion = (updated: Question) => {
    setSelectedQuestions((prev) =>
      prev.map((q) => (q.id === updated.id ? { ...updated, needsReview: false } : q))
    );

    // If variants were already generated, update the variant questions as well
    if (generatedVariants.length > 0) {
      setGeneratedVariants((prev) =>
        prev.map((variant) => ({
          ...variant,
          questions: variant.questions.map((vq) => {
            if (vq.originalId === updated.id) {
              return {
                ...vq,
                content: updated.content,
                part: updated.part,
                questionType: updated.questionType,
                level: updated.level,
                explanation: updated.explanation,
                groupTitle: updated.groupTitle,
                passageContent: updated.passageContent,
                statements: updated.statements,
                shortAnswer: updated.shortAnswer,
              };
            }
            return vq;
          }),
        }))
      );
    }

    setEditingQuestion(null);
    setParseSuccessMsg(`✅ Đã cập nhật và lưu thay đổi cho câu hỏi!`);
  };

  // Execute Shuffling or Keep Original
  const handleExecuteShuffle = () => {
    if (selectedQuestions.length === 0) {
      alert("Vui lòng tải hoặc chọn ít nhất 1 câu hỏi để tạo đề thi!");
      return;
    }

    // Check if any question still strictly needs review
    const unreviewedCount = selectedQuestions.filter((q) => q.needsReview).length;
    if (unreviewedCount > 0) {
      const confirmReview = window.confirm(
        `Còn ${unreviewedCount} câu hỏi có đáp án AI tự động giải chưa được kiểm duyệt. Bạn có muốn mở bảng kiểm duyệt trước không?`
      );
      if (confirmReview) {
        setShowReviewModal(true);
        return;
      }
    }

    const variants = generateVariantsFromQuestions(selectedQuestions, config);
    setGeneratedVariants(variants);
    setActiveVariantTab(variants[0]?.examCode || "101");
    setGeneratedViewMode("student");
    setPreviewStudentQIndex(1);

    // Create and publish package
    const pkg: ExamPackage = {
      id: `exam-${Date.now()}`,
      title: examTitle || `${config.subject} - ${config.examPeriod}`,
      config,
      originalQuestions: selectedQuestions,
      variants,
      createdAt: new Date().toISOString(),
      status: "published",
      accessCode: accessCode.trim().toUpperCase() || "THPT2026",
    };

    setPublishedExam(pkg);
    onPublishExam(pkg);
  };

  // Print single exam variant
  const handlePrintCurrentVariant = () => {
    window.print();
  };

  const hasUnreviewedQuestions = selectedQuestions.some((q) => q.needsReview);
  const groupedQuestionsCount = selectedQuestions.filter((q) => q.groupId).length;

  return (
    <div className="space-y-6">
      {/* Top Banner with Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Chuẩn Bộ Giáo Dục & Đào Tạo
              </span>
              {config.isOriginalKept ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  📄 Chế độ: Giữ nguyên đề gốc ({config.originalExamCode})
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  🎲 Chế độ: Trộn đề ({config.examCodes.length} mã đề)
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-800 mt-1">
              Cấu hình Thông tin & Trộn Đề Trắc Nghiệm THPT
            </h2>
            <p className="text-sm text-slate-500">
              Tải file đề, giữ nguyên hình vẽ bảng biểu, AI giải & kiểm duyệt đáp án, xáo trộn câu hỏi gộp theo nhóm và phân phối cho học sinh.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleLoadMathTHPTSample}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              Mẫu Toán THPT
            </button>
            <button
              onClick={handleLoadEnglishTHPTSample}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              Mẫu Tiếng Anh (Nhóm Bài Đọc)
            </button>
            <button
              onClick={handleExecuteShuffle}
              className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-2"
            >
              {config.isOriginalKept ? <FileText className="w-4 h-4" /> : <Shuffle className="w-4 h-4" />}
              {config.isOriginalKept ? "Tạo Đề Gốc Cho Học Sinh" : "Trộn Đề & Xuất Bản Ngay"}
            </button>
          </div>
        </div>
      </div>

      {/* Grid Layout: Config Form (Left) & Question Input / Shuffler (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: EXAM CONFIGURATIONS */}
        <div className="lg:col-span-5 space-y-6">
          {/* 1. General Info Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
              <Sliders className="w-4 h-4 text-indigo-600" />
              1. Thông Tin Chung & Tiêu Đề Đề Thi
            </h3>

            {/* Department & School */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sở Giáo Dục & Đào Tạo
                </label>
                <input
                  type="text"
                  value={config.department}
                  onChange={(e) => setConfig({ ...config, department: e.target.value })}
                  placeholder="VD: SỞ GIÁO DỤC VÀ ĐÀO TẠO TP. HỒ CHÍ MINH"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Trường / Đơn vị tổ chức
                </label>
                <input
                  type="text"
                  value={config.school}
                  onChange={(e) => setConfig({ ...config, school: e.target.value })}
                  placeholder="VD: TRƯỜNG THPT CHUYÊN LÊ HỒNG PHONG"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Exam Period & Subject */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kì Kiểm Tra / Kì Thi <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={config.examPeriod}
                    onChange={(e) => setConfig({ ...config, examPeriod: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                  >
                    {examPeriodPresets.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  type="text"
                  value={config.examPeriod}
                  onChange={(e) => setConfig({ ...config, examPeriod: e.target.value })}
                  placeholder="Hoặc tự nhập tên kì kiểm tra..."
                  className="mt-1.5 w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Môn Kiểm Tra <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={config.subject}
                    onChange={(e) => setConfig({ ...config, subject: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                  >
                    {subjectPresets.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Khối Lớp
                  </label>
                  <select
                    value={config.grade}
                    onChange={(e) => setConfig({ ...config, grade: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Khối 12">Khối 12 (Tốt nghiệp THPT)</option>
                    <option value="Khối 11">Khối 11</option>
                    <option value="Khối 10">Khối 10</option>
                    <option value="Khối 9">Khối 9</option>
                  </select>
                </div>
              </div>

              {/* Exam Title & Access Code */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên Đề Thi (Hiển thị cho học sinh)
                </label>
                <input
                  type="text"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mã Phòng Thi / Mã Vào Thi (Access Code)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                    className="w-full text-xs uppercase tracking-wider font-mono font-bold px-3 py-2 border border-indigo-300 bg-indigo-50/50 rounded-lg text-indigo-800"
                  />
                  <button
                    type="button"
                    onClick={() => setAccessCode(`THPT${Math.floor(1000 + Math.random() * 9000)}`)}
                    className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded-lg"
                  >
                    Sinh mã
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Timing, Scoring & Schedule Parameters */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
              <Clock className="w-4 h-4 text-amber-600" />
              2. Cài Đặt Thời Gian & Thang Điểm
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Thời Gian Làm Bài (phút)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={config.duration}
                    onChange={(e) => setConfig({ ...config, duration: Number(e.target.value) || 45 })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800 pl-8 focus:ring-2 focus:ring-indigo-500"
                  />
                  <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Thang Điểm Tối Đa
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={1}
                  max={100}
                  value={config.maxScore || 10.0}
                  onChange={(e) => setConfig({ ...config, maxScore: Number(e.target.value) || 10.0 })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Start and End Window */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  Khung Giờ Mở & Đóng Đề Thi (Tùy chọn)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] text-slate-500 block mb-0.5">Thời gian bắt đầu:</span>
                  <input
                    type="datetime-local"
                    value={config.startTime || ""}
                    onChange={(e) => setConfig({ ...config, startTime: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block mb-0.5">Thời gian kết thúc:</span>
                  <input
                    type="datetime-local"
                    value={config.endTime || ""}
                    onChange={(e) => setConfig({ ...config, endTime: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3. Shuffle Mode & Exam Codes Configuration */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
              <Shuffle className="w-4 h-4 text-indigo-600" />
              3. Chế Độ Trộn Đề & Mã Đề Thi
            </h3>

            {/* Custom Mode Toggle: Keep Original vs Shuffle */}
            <div className="p-3 rounded-lg border border-indigo-100 bg-indigo-50/40 space-y-2.5">
              <span className="text-xs font-bold text-indigo-900 block">
                Tùy chọn hình thức phát đề cho học sinh:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, isOriginalKept: false })}
                  className={`p-2.5 rounded-lg text-xs font-semibold border text-left transition-all ${
                    !config.isOriginalKept
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>Trộn Đề Tạo Mã Mới</span>
                  </div>
                  <p className={`text-[11px] font-normal ${!config.isOriginalKept ? "text-indigo-100" : "text-slate-500"}`}>
                    Đảo câu hỏi, đảo đáp án, sinh nhiều mã đề chống nhìn bài
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setConfig({ ...config, isOriginalKept: true })}
                  className={`p-2.5 rounded-lg text-xs font-semibold border text-left transition-all ${
                    config.isOriginalKept
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Giữ Nguyên Đề Gốc</span>
                  </div>
                  <p className={`text-[11px] font-normal ${config.isOriginalKept ? "text-emerald-100" : "text-slate-500"}`}>
                    Không xáo trộn, giữ nguyên thứ tự câu và đáp án của đề
                  </p>
                </button>
              </div>
            </div>

            {config.isOriginalKept ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mã Đề Gốc
                </label>
                <input
                  type="text"
                  value={config.originalExamCode || "101"}
                  onChange={(e) => setConfig({ ...config, originalExamCode: e.target.value })}
                  placeholder="VD: 101, GỐC, ĐỀ-A"
                  className="w-full text-xs font-mono font-bold px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Danh Sách Các Mã Đề Cần Sinh ({config.examCodes.length} mã đề)
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {config.examCodes.map((code) => (
                      <span
                        key={code}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200"
                      >
                        Mã {code}
                        {config.examCodes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveExamCode(code)}
                            className="text-slate-400 hover:text-red-600 ml-1"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newExamCodeInput}
                      onChange={(e) => setNewExamCodeInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddExamCode())}
                      placeholder="Thêm mã đề (VD: 105)..."
                      className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={handleAddExamCode}
                      className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100"
                    >
                      Thêm
                    </button>
                  </div>
                </div>

                {/* Shuffling checkboxes */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.shuffleQuestions}
                      onChange={(e) => setConfig({ ...config, shuffleQuestions: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-slate-700">
                      Đảo thứ tự câu hỏi (Giữ nguyên vị trí nhóm gộp/bài đọc)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.shuffleOptions}
                      onChange={(e) => setConfig({ ...config, shuffleOptions: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-slate-700">
                      Đảo thứ tự các phương án A, B, C, D
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Review & Anti-Cheating toggles */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.allowReviewAfterSubmit}
                  onChange={(e) => setConfig({ ...config, allowReviewAfterSubmit: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-medium text-slate-700">
                  Cho phép học sinh xem lại bài làm & lời giải sau khi nộp
                </span>
              </label>

              <div className="flex items-center justify-between text-xs text-slate-700 pt-1">
                <span>Số lần chuyển tab tối đa trước khi khóa:</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={config.maxTabViolations}
                  onChange={(e) => setConfig({ ...config, maxTabViolations: Number(e.target.value) || 3 })}
                  className="w-16 text-xs px-2 py-1 border border-slate-300 rounded font-bold text-center"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: QUESTION INPUT, AI PARSER & ANSWER REVIEW */}
        <div className="lg:col-span-7 space-y-6">
          {/* Input Source Selector */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                Nhập Đề Thi & Trích Xuất Câu Hỏi
              </h3>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setInputMode("paste")}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    inputMode === "paste" ? "bg-white text-indigo-700 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Dán nội dung đề
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode("upload")}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    inputMode === "upload" ? "bg-white text-indigo-700 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Tải file đề
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode("bank")}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    inputMode === "bank" ? "bg-white text-indigo-700 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Chọn từ Ngân hàng ({questionBank.length})
                </button>
              </div>
            </div>

            {/* Mode 1: Paste Text */}
            {inputMode === "paste" && (
              <div className="space-y-3">
                <div className="relative">
                  <textarea
                    rows={9}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="Dán nội dung đề thi ở đây (Hỗ trợ cấu trúc Câu 1: A. B. C. D., đoạn văn nhóm, bảng biểu Markdown, công thức...)"
                    className="w-full text-xs font-mono p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                  />
                  <div className="absolute right-3 bottom-3 text-[11px] text-slate-400 bg-white/90 px-2 py-0.5 rounded border border-slate-200">
                    Bảo toàn bảng biểu Markdown & Nhóm câu hỏi
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleParseRawText()}
                      disabled={isParsing || !rawText.trim()}
                      className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      {isParsing ? <Sparkles className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      {isParsing ? "AI đang đọc và giải đề..." : "AI Đọc Đề & Tự Động Trích Xuất"}
                    </button>
                    {selectedQuestions.length > 0 && (
                      <button
                        type="button"
                        onClick={handleSolveWithAI}
                        disabled={isSolvingAI}
                        className="px-3 py-2 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg flex items-center gap-1.5 transition-all"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                        {isSolvingAI ? "Đang giải..." : "AI Giải & Điền Đáp Án"}
                      </button>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">
                    Đã tải: <strong className="text-indigo-600">{selectedQuestions.length}</strong> câu hỏi
                  </span>
                </div>
              </div>
            )}

            {/* Mode 2: Upload File */}
            {inputMode === "upload" && (
              <div className="space-y-4">
                {/* Drag and Drop Zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const files = e.dataTransfer.files;
                    if (files && files.length > 0) {
                      processFilesBatch(Array.from(files), false);
                    }
                  }}
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                    isDragging
                      ? "border-indigo-600 bg-indigo-50/80 scale-[1.01]"
                      : "border-slate-300 hover:border-indigo-400 bg-slate-50/70"
                  }`}
                >
                  <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                    {isReadingFile || isParsing ? (
                      <RefreshCw className="w-6 h-6 animate-spin" />
                    ) : (
                      <UploadCloud className="w-6 h-6" />
                    )}
                  </div>

                  <p className="text-sm font-bold text-slate-800 mb-1">
                    {uploadProgress
                      ? `Đang số hóa file ${uploadProgress.current}/${uploadProgress.total}: "${uploadProgress.currentFileName}"...`
                      : isReadingFile
                      ? "Đang đọc nội dung file..."
                      : isParsing
                      ? "AI đang bóc tách câu hỏi và lời giải..."
                      : "Kéo thả một hoặc NHIỀU file đề thi (Ảnh / PDF / Word) vào đây"}
                  </p>

                  {/* Progress Bar for Multi-File Processing */}
                  {uploadProgress && (
                    <div className="w-full max-w-md mx-auto my-3">
                      <div className="flex justify-between text-[11px] font-bold text-indigo-700 mb-1">
                        <span>Tiến trình nhận diện đa trang</span>
                        <span>{uploadProgress.current} / {uploadProgress.total} file</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
                          style={{ width: `${Math.round((uploadProgress.current / uploadProgress.total) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-slate-600 mb-4 max-w-lg mx-auto leading-relaxed">
                    Hỗ trợ chọn <strong>CÙNG LÚC NHIỀU ẢNH (Trang 1, Trang 2, Trang 3...)</strong>, <strong>PDF (.pdf)</strong>, <strong>Word (.docx)</strong>, <strong>Excel (.xlsx)</strong>.
                    <span className="block mt-1 text-indigo-700 font-semibold">
                      ✨ Tự động số hóa, ghép câu hỏi liên tục và tự lưu bản nháp an toàn!
                    </span>
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-3">
                    {/* Primary Multi-File Button */}
                    <label className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-lg cursor-pointer shadow-sm transition-all">
                      <FileText className="w-4 h-4" />
                      <span>Chọn 1 hoặc Nhiều File (Ảnh / PDF / Word / Excel)</span>
                      <input
                        type="file"
                        multiple
                        accept=".txt,.docx,.doc,.pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.tsv"
                        onChange={(e) => handleFileUpload(e, false)}
                        className="hidden"
                      />
                    </label>

                    {/* Append More Pages Button */}
                    {selectedQuestions.length > 0 && (
                      <label className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 active:scale-95 rounded-lg cursor-pointer border border-emerald-300 transition-all">
                        <FilePlus className="w-4 h-4 text-emerald-700" />
                        <span>➕ Tải Thêm Trang Ảnh Tiếp Theo (Nối Tiếp)</span>
                        <input
                          type="file"
                          multiple
                          accept=".txt,.docx,.doc,.pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.tsv"
                          onChange={(e) => handleFileUpload(e, true)}
                          className="hidden"
                        />
                      </label>
                    )}

                    {/* Restore Draft Button */}
                    {hasSavedDraft && selectedQuestions.length === 0 && (
                      <button
                        type="button"
                        onClick={handleRestoreDraft}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 active:scale-95 rounded-lg border border-amber-300 transition-all"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-amber-700" />
                        <span>🔄 Khôi Phục Bản Nháp Gần Nhất</span>
                      </button>
                    )}
                  </div>

                  {/* Uploaded Files Gallery & Automatic Word/PDF Conversion */}
                  {(uploadedFilesList.length > 0 || uploadedFileName) && (
                    <div className="mt-4 p-4 bg-white rounded-xl border border-emerald-200 text-left shadow-2xs space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <FileCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-slate-800 flex items-center gap-2">
                              {uploadedFilesList.length > 1
                                ? `Đã nạp ${uploadedFilesList.length} file tài liệu/trang ảnh`
                                : uploadedFileName}
                              {isImageUploaded && (
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800">
                                  Ảnh Đề Thi
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Tổng cộng: {selectedQuestions.length} câu hỏi đã số hóa • Đã tự động lưu nháp
                            </p>
                          </div>
                        </div>
                        <span className="px-2 py-1 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">
                          ✓ Đã sẵn sàng
                        </span>
                      </div>

                      {/* Multi-Page File Badges */}
                      {uploadedFilesList.length > 1 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {uploadedFilesList.map((f, fIdx) => (
                            <span
                              key={fIdx}
                              className="px-2 py-1 rounded bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-700 flex items-center gap-1"
                            >
                              <span className="font-bold text-indigo-700">Trang {fIdx + 1}:</span> {f.name} ({f.count} câu)
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Instant Export to Word & PDF for Image and other uploads */}
                      {selectedQuestions.length > 0 && (
                        <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2">
                          <span className="text-[11px] text-slate-600 font-semibold">
                            Chuyển đổi tức thì từ đề đã nhận diện:
                          </span>
                          <button
                            type="button"
                            onClick={() => exportQuestionsToWordDoc(selectedQuestions, uploadedFileName.replace(/\.[^/.]+$/, "") || "De_Thi_Chuyen_Doi")}
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Tải Bản Word (.docx)
                          </button>
                          <button
                            type="button"
                            onClick={() => exportQuestionsToPrintablePdf(selectedQuestions, uploadedFileName.replace(/\.[^/.]+$/, "") || "De_Thi_Chuyen_Doi")}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Bản In PDF (.pdf)
                          </button>
                          <button
                            type="button"
                            onClick={() => openPresentationInNewTab(selectedQuestions, config, config.originalExamCode || "101")}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            Bài Giảng Slides (.html)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const p1 = selectedQuestions.filter((q) => q.part === 1 || q.questionType === "multiple_choice").length || 18;
                              const p2 = selectedQuestions.filter((q) => q.part === 2 || q.questionType === "true_false").length || 4;
                              const p3 = selectedQuestions.filter((q) => q.part === 3 || q.questionType === "short_answer").length || 6;
                              openPrintableOMRSheet({
                                school: config.school,
                                department: config.department,
                                examPeriod: config.examPeriod,
                                subject: config.subject,
                                grade: config.grade,
                                examCode: config.originalExamCode || "101",
                                totalPart1: p1,
                                totalPart2: p2,
                                totalPart3: p3,
                              });
                            }}
                            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                          >
                            <FileCheck className="w-3.5 h-3.5 text-amber-600" />
                            Phiếu OMR Chuẩn Bộ
                          </button>
                          <button
                            type="button"
                            onClick={() => exportToMoodleXMLFile(selectedQuestions, config, config.originalExamCode || "101")}
                            className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                          >
                            <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                            Moodle XML
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Instant Sample Download & Test Helpers */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Download className="w-3.5 h-3.5 text-indigo-600" />
                      Chưa có sẵn file đề? Tải file mẫu hoặc nạp trực tiếp để trải nghiệm:
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Math Sample Card */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between space-y-2">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">Đề Toán THPT (8 câu)</span>
                          <span className="px-1.5 py-0.5 text-[10px] rounded bg-blue-50 text-blue-700 font-semibold border border-blue-100">
                            Có Bảng Biến Thiên
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Đầy đủ câu hỏi Hàm số, Tích phân, Oxyz, bảng Markdown.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleDownloadSampleFile("math")}
                          className="flex-1 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors flex items-center justify-center gap-1"
                        >
                          <Download className="w-3 h-3 text-slate-600" />
                          Tải .txt về máy
                        </button>
                        <button
                          type="button"
                          onClick={handleLoadMathTHPTSample}
                          className="flex-1 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors flex items-center justify-center gap-1"
                        >
                          <Sparkles className="w-3 h-3 text-indigo-600" />
                          Nạp thử ngay
                        </button>
                      </div>
                    </div>

                    {/* English Sample Card */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between space-y-2">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">Đề Tiếng Anh (6 câu)</span>
                          <span className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100">
                            Nhóm Bài Đọc Hiểu
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Câu hỏi đơn lẻ + 1 đoạn văn đọc hiểu dùng chung cho 3 câu.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleDownloadSampleFile("english")}
                          className="flex-1 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors flex items-center justify-center gap-1"
                        >
                          <Download className="w-3 h-3 text-slate-600" />
                          Tải .txt về máy
                        </button>
                        <button
                          type="button"
                          onClick={handleLoadEnglishTHPTSample}
                          className="flex-1 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors flex items-center justify-center gap-1"
                        >
                          <Sparkles className="w-3 h-3 text-emerald-600" />
                          Nạp thử ngay
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Mode 3: Question Bank */}
            {inputMode === "bank" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-600 pb-2 border-b border-slate-100">
                  <span>Ngân hàng đề hiện có: <strong>{questionBank.length}</strong> câu</span>
                  <button
                    type="button"
                    onClick={handleSelectAllBank}
                    className="text-xs text-indigo-600 font-semibold hover:underline"
                  >
                    Chọn tất cả
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {questionBank.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400">
                      Ngân hàng đề đang trống. Hãy qua tab "Ngân Hàng Đề" để tạo câu hỏi bằng AI.
                    </div>
                  ) : (
                    questionBank.map((q, idx) => {
                      const isSelected = selectedQuestions.some((item) => item.id === q.id);
                      return (
                        <div
                          key={q.id}
                          onClick={() => handleToggleBankQuestion(q)}
                          className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                            isSelected
                              ? "border-indigo-500 bg-indigo-50/50 shadow-xs"
                              : "border-slate-200 hover:border-slate-300 bg-white"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800">Câu {idx + 1}:</span>
                                <span className="px-1.5 py-0.5 text-[10px] rounded bg-slate-100 text-slate-600">
                                  {q.level}
                                </span>
                              </div>
                              <p className="text-slate-700 line-clamp-2">{q.content}</p>
                            </div>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              readOnly
                              className="w-4 h-4 rounded text-indigo-600 mt-1"
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Notification / Status message */}
            {parseSuccessMsg && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p>{parseSuccessMsg}</p>
                </div>
              </div>
            )}
          </div>

          {/* Selected Questions Preview & Moderation (Pre-Shuffle) */}
          {selectedQuestions.length > 0 && (
            <div id="extracted-questions-section" className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-indigo-600" />
                      Danh Sách Câu Hỏi Đã Trích Xuất ({selectedQuestions.length} câu)
                    </h4>
                    {groupedQuestionsCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {groupedQuestionsCount} câu theo nhóm
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Kiểm tra trực tiếp các câu hỏi và hình vẽ trước khi tạo mã đề xáo trộn
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* View Mode Switcher */}
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setExtractedViewMode("list")}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                        extractedViewMode === "list"
                          ? "bg-white text-indigo-700 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Danh Sách</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExtractedViewMode("student");
                        setPreviewStudentQIndex(1);
                      }}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                        extractedViewMode === "student"
                          ? "bg-white text-indigo-700 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      <span>Xem Như Học Sinh</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => exportQuestionsToWordDoc(selectedQuestions, uploadedFileName.replace(/\.[^/.]+$/, "") || "De_Thi_Trich_Xuat")}
                    className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1 transition-all"
                    title="Xuất file Word (.docx)"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Xuất Word</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => exportQuestionsToPrintablePdf(selectedQuestions, uploadedFileName.replace(/\.[^/.]+$/, "") || "De_Thi_Trich_Xuat")}
                    className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1 transition-all"
                    title="Xuất bản in / PDF"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Xuất PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowReviewModal(true)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition-all"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Duyệt Đáp Án</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedQuestions([])}
                    className="px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                    title="Xóa danh sách câu hỏi này"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Inline Smart Review Action Banner */}
              {hasUnreviewedQuestions && (
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-50 to-indigo-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Đề thi có {selectedQuestions.filter(q => q.needsReview).length} câu cần kiểm duyệt hoặc bổ sung đáp án
                      </p>
                      <p className="text-[11px] text-slate-600">
                        Bạn có thể yêu cầu AI tự động giải & điền đáp án, hoặc tự kiểm tra trực tiếp từng câu bên dưới.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleSolveWithAI}
                      disabled={isSolvingAI}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs flex items-center gap-1.5 transition-all"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>{isSolvingAI ? "Đang giải..." : "AI Giải & Điền Đáp Án"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleApproveAllAnswers}
                      className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg transition-all"
                    >
                      ✓ Duyệt Tất Cả
                    </button>
                  </div>
                </div>
              )}

              {/* 3-PART STRUCTURE STATS BANNER */}
              {(() => {
                const p1 = selectedQuestions.filter((q) => (q.part || 1) === 1);
                const p2 = selectedQuestions.filter((q) => q.part === 2);
                const p3 = selectedQuestions.filter((q) => q.part === 3);
                const p2Commands = p2.reduce((acc, q) => acc + (q.statements?.length || 4), 0);
                const totalCmds = p1.length + p2Commands + p3.length;

                return (
                  <div className="space-y-2.5 pt-1">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-2xs">
                        <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Tổng Đề Gốc</div>
                        <div className="text-base font-black text-slate-900 mt-0.5">
                          {selectedQuestions.length} câu <span className="text-xs font-bold text-indigo-600">({totalCmds} lệnh)</span>
                        </div>
                      </div>
                      <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200 shadow-2xs">
                        <div className="text-[11px] text-blue-700 font-semibold uppercase tracking-wider">Phần I (Trắc nghiệm)</div>
                        <div className="text-base font-black text-blue-950 mt-0.5">
                          {p1.length} câu <span className="text-xs font-bold text-blue-700">({p1.length} lệnh)</span>
                        </div>
                      </div>
                      <div className="bg-purple-50/70 p-3 rounded-xl border border-purple-200 shadow-2xs">
                        <div className="text-[11px] text-purple-700 font-semibold uppercase tracking-wider">Phần II (Đúng / Sai)</div>
                        <div className="text-base font-black text-purple-950 mt-0.5">
                          {p2.length} câu <span className="text-xs font-bold text-purple-700">({p2Commands} lệnh - 4 ý/câu)</span>
                        </div>
                      </div>
                      <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 shadow-2xs">
                        <div className="text-[11px] text-amber-800 font-semibold uppercase tracking-wider">Phần III (Điền số)</div>
                        <div className="text-base font-black text-amber-950 mt-0.5">
                          {p3.length} câu <span className="text-xs font-bold text-amber-700">({p3.length} lệnh)</span>
                        </div>
                      </div>
                    </div>

                    {/* Part Filter Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                      <span className="text-[11px] font-bold text-slate-500 shrink-0">Lọc xem:</span>
                      <button
                        type="button"
                        onClick={() => setExtractedPartFilter("all")}
                        className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 ${
                          extractedPartFilter === "all"
                            ? "bg-slate-900 text-white shadow-xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        Tất cả ({selectedQuestions.length} câu - {totalCmds} lệnh)
                      </button>
                      <button
                        type="button"
                        onClick={() => setExtractedPartFilter(1)}
                        className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 ${
                          extractedPartFilter === 1
                            ? "bg-blue-600 text-white shadow-xs"
                            : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                        }`}
                      >
                        Phần I ({p1.length} câu)
                      </button>
                      <button
                        type="button"
                        onClick={() => setExtractedPartFilter(2)}
                        className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 ${
                          extractedPartFilter === 2
                            ? "bg-purple-600 text-white shadow-xs"
                            : "bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
                        }`}
                      >
                        Phần II ({p2.length} câu - {p2Commands} ý a,b,c,d)
                      </button>
                      <button
                        type="button"
                        onClick={() => setExtractedPartFilter(3)}
                        className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 ${
                          extractedPartFilter === 3
                            ? "bg-amber-600 text-white shadow-xs"
                            : "bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200"
                        }`}
                      >
                        Phần III ({p3.length} câu)
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* MODE 1: STUDENT VIEW SIMULATION (Pre-shuffle preview) */}
              {extractedViewMode === "student" ? (
                (() => {
                  const currentQ = selectedQuestions[previewStudentQIndex - 1] || selectedQuestions[0];
                  if (!currentQ) return null;
                  const isPart2 = currentQ.part === 2 || (currentQ.part !== 1 && currentQ.part !== 3 && (currentQ.questionType === "true_false" || (currentQ.statements && currentQ.statements.length > 0 && (!currentQ.options || currentQ.options.length === 0))));
                  const isPart3 = currentQ.part === 3 || (currentQ.part !== 1 && (currentQ.questionType === "short_answer" || (!isPart2 && currentQ.options.length === 0)));
                  const isPart1 = !isPart2 && !isPart3;

                  return (
                    <div className="space-y-4">
                      {/* Top Header Simulation */}
                      <div className="bg-slate-900 text-white rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-indigo-600 text-white font-bold rounded">
                            {config.subject}
                          </span>
                          <span className="text-slate-300">
                            {config.examPeriod} • {config.duration} phút
                          </span>
                        </div>
                        <div className="flex items-center gap-3 font-mono">
                          <span className="flex items-center gap-1 text-emerald-400 font-bold">
                            <Clock className="w-3.5 h-3.5" />
                            {config.duration}:00 (Giả Lập)
                          </span>
                          <span className="px-2 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300 text-[11px]">
                            Mã Gốc {config.originalExamCode}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                        {/* Question Box (8 cols) */}
                        <div className="lg:col-span-8 bg-slate-50/50 rounded-xl border border-slate-200 p-5 space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-extrabold text-indigo-700 text-sm">
                                CÂU HỎI {previewStudentQIndex} / {selectedQuestions.length}
                              </span>
                              
                              {/* 1-Click Part Switcher Dropdown */}
                              <select
                                value={currentQ.part || 1}
                                onChange={(e) => handleQuickChangeQuestionPart(currentQ.id, Number(e.target.value) as 1 | 2 | 3)}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border cursor-pointer transition-all ${
                                  isPart2
                                    ? "bg-purple-100 text-purple-800 border-purple-300"
                                    : isPart3
                                    ? "bg-amber-100 text-amber-900 border-amber-300"
                                    : "bg-blue-100 text-blue-800 border-blue-300"
                                }`}
                                title="Bấm để đổi loại câu hỏi: Phần I (4 lựa chọn) / Phần II (Đúng/Sai) / Phần III (Điền số)"
                              >
                                <option value={1}>PHẦN I: Trắc nghiệm 4 lựa chọn (A-D)</option>
                                <option value={2}>PHẦN II: Đúng / Sai (4 ý a,b,c,d)</option>
                                <option value={3}>PHẦN III: Trả lời ngắn / Điền số</option>
                              </select>

                              {currentQ.level && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-slate-700 border border-slate-200">
                                  {currentQ.level}
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => setEditingQuestion(currentQ)}
                              className="px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg flex items-center gap-1 transition-all"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Sửa Câu Này</span>
                            </button>
                          </div>

                          {/* Passage / Group Reading Content */}
                          {currentQ.groupTitle && (
                            <div className="p-3 bg-indigo-50/80 rounded-lg border border-indigo-200 text-xs text-indigo-950 space-y-1.5">
                              <div className="font-bold text-indigo-900">📌 {currentQ.groupTitle}</div>
                              {currentQ.passageContent && (
                                <div className="text-slate-800">
                                  <FormattedQuestionContent content={currentQ.passageContent} />
                                </div>
                              )}
                            </div>
                          )}

                          {/* Question Prompt */}
                          <div className="text-sm font-medium text-slate-800">
                            <FormattedQuestionContent
                              content={currentQ.content}
                              diagramUrl={currentQ.diagramUrl}
                            />
                          </div>

                          {/* PART I: Option Cards */}
                          {isPart1 && currentQ.options.length > 0 && (
                            <div className="space-y-2 pt-2">
                              {currentQ.options.map((opt, optIdx) => {
                                const isCorrect = optIdx === currentQ.correctIndex;
                                return (
                                  <div
                                    key={optIdx}
                                    onClick={() => handleUpdateQuestionAnswer(currentQ.id, optIdx)}
                                    className={`p-3 rounded-xl border text-xs cursor-pointer flex items-center justify-between gap-3 transition-all ${
                                      isCorrect
                                        ? "bg-emerald-50 border-emerald-400 text-emerald-950 font-bold shadow-xs"
                                        : "bg-white border-slate-200 text-slate-700 hover:border-indigo-300"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <span
                                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                          isCorrect
                                            ? "bg-emerald-600 text-white"
                                            : "bg-slate-100 text-slate-700"
                                        }`}
                                      >
                                        {LETTERS[optIdx]}
                                      </span>
                                      <span className="font-sans text-slate-800"><MathTextRenderer text={opt} /></span>
                                    </div>
                                    {isCorrect && (
                                      <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded text-[10px] font-bold shrink-0">
                                        ✓ Đáp án chuẩn
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* PART II: True / False Statement Matrix */}
                          {isPart2 && (
                            <div className="space-y-2 pt-2">
                              <div className="text-xs font-bold text-purple-900">
                                Xác định tính Đúng / Sai của 4 ý sau:
                              </div>
                              {(currentQ.statements && currentQ.statements.length > 0
                                ? currentQ.statements
                                : [
                                    { id: "a", label: "a)", text: "Ý a", correctValue: true },
                                    { id: "b", label: "b)", text: "Ý b", correctValue: false },
                                    { id: "c", label: "c)", text: "Ý c", correctValue: true },
                                    { id: "d", label: "d)", text: "Ý d", correctValue: false },
                                  ]
                              ).map((st) => (
                                <div
                                  key={st.id}
                                  className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                                >
                                  <div className="flex items-start gap-2">
                                    <span className="font-bold text-purple-700 shrink-0">
                                      {st.label || `${st.id})`}
                                    </span>
                                    <span className="text-slate-800"><MathTextRenderer text={st.text} /></span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleTrueFalseStatement(currentQ.id, st.id, false)}
                                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                        st.correctValue
                                          ? "bg-emerald-600 text-white shadow-xs"
                                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                      }`}
                                    >
                                      Đúng
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleTrueFalseStatement(currentQ.id, st.id, true)}
                                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                        !st.correctValue
                                          ? "bg-rose-600 text-white shadow-xs"
                                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                      }`}
                                    >
                                      Sai
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* PART III: Short Answer Numeric Input */}
                          {isPart3 && (
                            <div className="space-y-2 pt-2 bg-amber-50/70 p-4 rounded-xl border border-amber-200 text-xs">
                              <div className="font-bold text-amber-950">Nhập kết quả số (Dạng Phần III):</div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={currentQ.shortAnswer || ""}
                                  onChange={(e) => handleUpdateShortAnswer(currentQ.id, e.target.value)}
                                  placeholder="Nhập số đúng (VD: 15.8, 800, 64)..."
                                  className="flex-1 px-3 py-2 bg-white border border-amber-300 rounded-lg font-mono font-bold text-sm text-amber-950 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                                />
                                <span className="text-[11px] text-amber-800 font-medium">
                                  ✓ Đã lưu tự động
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Explanation Box */}
                          {currentQ.explanation && (
                            <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-slate-700 space-y-1">
                              <strong className="text-indigo-900 block">💡 Lời giải chi tiết:</strong>
                              <div className="leading-relaxed"><FormattedQuestionContent content={currentQ.explanation} /></div>
                            </div>
                          )}

                          {/* Navigation Buttons */}
                          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                            <button
                              type="button"
                              onClick={() => setPreviewStudentQIndex((prev) => Math.max(1, prev - 1))}
                              disabled={previewStudentQIndex <= 1}
                              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg disabled:opacity-30 flex items-center gap-1"
                            >
                              <ChevronLeft className="w-4 h-4" />
                              <span>Câu Trước</span>
                            </button>

                            <span className="text-xs font-bold text-slate-500">
                              {previewStudentQIndex} / {selectedQuestions.length}
                            </span>

                            <button
                              type="button"
                              onClick={() => setPreviewStudentQIndex((prev) => Math.min(selectedQuestions.length, prev + 1))}
                              disabled={previewStudentQIndex >= selectedQuestions.length}
                              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg disabled:opacity-30 flex items-center gap-1"
                            >
                              <span>Câu Sau</span>
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Palette Sidebar (4 cols) */}
                        <div className="lg:col-span-4 bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                          <div className="font-bold text-xs text-slate-800 flex items-center justify-between">
                            <span>Bảng Chọn Câu Hỏi</span>
                            <span className="text-[11px] text-slate-500 font-normal">
                              {selectedQuestions.length} câu
                            </span>
                          </div>

                          <div className="grid grid-cols-5 gap-1.5 max-h-72 overflow-y-auto pr-1">
                            {selectedQuestions.map((q, idx) => {
                              const qNum = idx + 1;
                              const isActive = qNum === previewStudentQIndex;
                              const isP2 = q.part === 2 || q.questionType === "true_false" || (q.statements && q.statements.length > 0);
                              const isP3 = q.part === 3 || q.questionType === "short_answer" || (!isP2 && q.options.length === 0);

                              return (
                                <button
                                  key={q.id}
                                  type="button"
                                  onClick={() => setPreviewStudentQIndex(qNum)}
                                  className={`h-9 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center ${
                                    isActive
                                      ? "bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-300"
                                      : isP2
                                      ? "bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100"
                                      : isP3
                                      ? "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                                      : "bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100"
                                  }`}
                                >
                                  <span>{qNum}</span>
                                </button>
                              );
                            })}
                          </div>

                          <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"></span>
                              <span>Phần I: Trắc nghiệm</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0"></span>
                              <span>Phần II: Đúng / Sai</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
                              <span>Phần III: Điền số</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                /* MODE 2: SCROLLING LIST VIEW (Traditional List with In-place Controls) */
                <div className="max-h-[720px] overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-slate-200">
                  {(() => {
                    const filteredQuestions = selectedQuestions
                      .map((q, idx) => ({ ...q, originalOrderIndex: idx + 1 }))
                      .filter((q) => extractedPartFilter === "all" || q.part === extractedPartFilter);

                    return filteredQuestions.map((q, qIdx) => {
                      const isPart2 = q.part === 2 || (q.part !== 1 && q.part !== 3 && (q.questionType === "true_false" || (q.statements && q.statements.length > 0 && (!q.options || q.options.length === 0))));
                      const isPart3 = q.part === 3 || (q.part !== 1 && (q.questionType === "short_answer" || (!isPart2 && q.options.length === 0)));
                      const isPart1 = !isPart2 && !isPart3;
                      const isFirstInPart = qIdx === 0 || q.part !== filteredQuestions[qIdx - 1]?.part;

                      return (
                        <React.Fragment key={q.id}>
                          {isFirstInPart && (
                            <div className={`p-3 rounded-xl border font-bold text-xs flex flex-wrap items-center justify-between gap-2 shadow-2xs ${
                              q.part === 1
                                ? "bg-blue-50/90 text-blue-900 border-blue-200"
                                : q.part === 2
                                ? "bg-purple-50/90 text-purple-900 border-purple-200"
                                : "bg-amber-50/90 text-amber-950 border-amber-200"
                            }`}>
                              <span className="uppercase tracking-wide">
                                {q.part === 1
                                  ? "PHẦN I: TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN (1 lệnh hỏi/câu)"
                                  : q.part === 2
                                  ? "PHẦN II: TRẮC NGHIỆM ĐÚNG / SAI (4 lệnh hỏi/câu - Ý a, b, c, d)"
                                  : "PHẦN III: TRẮC NGHIỆM TRẢ LỜI NGẮN (1 lệnh hỏi/câu - Điền số)"}
                              </span>
                              <span className="text-[11px] font-normal px-2 py-0.5 rounded bg-white/80 border border-current/20">
                                {q.part === 1
                                  ? "18 câu chuẩn (hoặc 12 câu Toán)"
                                  : q.part === 2
                                  ? "4 câu (16 ý a, b, c, d)"
                                  : "6 câu trả lời ngắn"}
                              </span>
                            </div>
                          )}

                          <div
                            className={`p-3.5 rounded-xl border text-xs space-y-2.5 ${
                              q.needsReview
                                ? "border-amber-300 bg-amber-50/30"
                                : "border-slate-200 bg-white"
                            }`}
                          >
                            {/* Group Title & Passage */}
                            {q.groupTitle && (
                              <div className="p-2 rounded-lg bg-indigo-50/70 border border-indigo-100 text-indigo-900 font-medium text-[11px]">
                                <strong>📌 {q.groupTitle}</strong>
                                {q.passageContent && (
                                  <div className="mt-1 text-slate-700 font-normal">
                                    <FormattedQuestionContent content={q.passageContent} />
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="flex items-start justify-between gap-2">
                              <div className="font-semibold text-slate-800 flex flex-wrap items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                                  Câu {q.originalOrderIndex || qIdx + 1}
                                </span>
                                
                                {/* 1-Click Part Switcher Dropdown */}
                                <select
                                  value={q.part || 1}
                                  onChange={(e) => handleQuickChangeQuestionPart(q.id, Number(e.target.value) as 1 | 2 | 3)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-all ${
                                    isPart2
                                      ? "bg-purple-100 text-purple-800 border-purple-300"
                                      : isPart3
                                      ? "bg-amber-100 text-amber-800 border-amber-300"
                                      : "bg-blue-100 text-blue-800 border-blue-300"
                                  }`}
                                  title="Bấm để đổi loại câu hỏi: Phần I (4 lựa chọn) / Phần II (Đúng/Sai) / Phần III (Điền số)"
                                >
                                  <option value={1}>PHẦN I: Trắc nghiệm 4 lựa chọn (A-D)</option>
                                  <option value={2}>PHẦN II: Đúng / Sai (4 ý a,b,c,d)</option>
                                  <option value={3}>PHẦN III: Trả lời ngắn / Điền số</option>
                                </select>

                                {(q.hasTableOrDiagram || q.content?.includes("![") || q.diagramUrl) && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold flex items-center gap-0.5">
                                    <ImageIcon className="w-3 h-3" />
                                    <span>Hình/Bảng</span>
                                  </span>
                                )}
                                {q.needsReview ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-bold">
                                    ⚡ Cần duyệt
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-bold">
                                    ✓ Đã duyệt
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setEditingQuestion(q)}
                                  className="px-2 py-0.5 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded flex items-center gap-1"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>Sửa</span>
                                </button>
                                {isPart1 && (
                                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                    Đáp án: {LETTERS[q.correctIndex] || "A"}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Question Content */}
                            <div className="text-slate-800 font-medium">
                              <FormattedQuestionContent
                                content={q.content}
                                diagramUrl={q.diagramUrl}
                              />
                            </div>

                            {/* PART 1: Options Grid */}
                            {isPart1 && q.options.length > 0 && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                                {q.options.map((opt, optIdx) => (
                                  <div
                                    key={optIdx}
                                    onClick={() => handleUpdateQuestionAnswer(q.id, optIdx)}
                                    className={`p-2 rounded-lg border text-[11px] cursor-pointer flex items-center gap-2 transition-all ${
                                      optIdx === q.correctIndex
                                        ? "border-emerald-500 bg-emerald-50 text-emerald-900 font-bold shadow-xs"
                                        : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                                    }`}
                                  >
                                    <span
                                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 font-bold ${
                                        optIdx === q.correctIndex
                                          ? "bg-emerald-600 text-white"
                                          : "bg-slate-200 text-slate-700"
                                      }`}
                                    >
                                      {LETTERS[optIdx]}
                                    </span>
                                    <span className="break-words flex-1 text-slate-800"><MathTextRenderer text={opt} /></span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* PART 2: True/False Statements */}
                            {isPart2 && (
                              <div className="space-y-1.5 pt-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                <div className="text-[11px] font-bold text-purple-900 mb-1">
                                  Chọn Đúng hoặc Sai cho cả 4 ý a), b), c), d):
                                </div>
                                {(q.statements && q.statements.length > 0
                                  ? q.statements
                                  : [
                                      { id: "a", label: "a)", text: "Ý a", correctValue: true },
                                      { id: "b", label: "b)", text: "Ý b", correctValue: false },
                                      { id: "c", label: "c)", text: "Ý c", correctValue: true },
                                      { id: "d", label: "d)", text: "Ý d", correctValue: false },
                                    ]
                                ).map((st) => (
                                  <div
                                    key={st.id}
                                    className="flex items-center justify-between gap-2 p-1.5 bg-white rounded border border-slate-200 text-xs"
                                  >
                                    <div className="flex items-start gap-1.5 flex-1">
                                      <span className="font-bold text-purple-700 shrink-0">{st.label || `${st.id})`}</span>
                                      <span className="text-slate-800"><MathTextRenderer text={st.text} /></span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleTrueFalseStatement(q.id, st.id, false)}
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                                          st.correctValue
                                            ? "bg-emerald-600 text-white shadow-xs"
                                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                        }`}
                                      >
                                        Đúng
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleTrueFalseStatement(q.id, st.id, true)}
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                                          !st.correctValue
                                            ? "bg-rose-600 text-white shadow-xs"
                                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                        }`}
                                      >
                                        Sai
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* PART 3: Short Answer */}
                            {isPart3 && (
                              <div className="flex items-center gap-2 pt-1 bg-amber-50/60 p-2.5 rounded-lg border border-amber-200 text-xs">
                                <span className="font-bold text-amber-900 shrink-0">Đáp án số / kết quả:</span>
                                <input
                                  type="text"
                                  value={q.shortAnswer || ""}
                                  onChange={(e) => handleUpdateShortAnswer(q.id, e.target.value)}
                                  placeholder="Nhập số thập phân hoặc nguyên (VD: 15.8, 800, 64)..."
                                  className="flex-1 px-2.5 py-1 bg-white border border-amber-300 rounded font-mono font-bold text-amber-950 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                                />
                              </div>
                            )}

                            {/* Explanation */}
                            {q.explanation && (
                              <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                                <strong>Lời giải:</strong> {q.explanation}
                              </div>
                            )}
                          </div>
                        </React.Fragment>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Generated Variants & Student Room Live View (After Creation) */}
          {generatedVariants.length > 0 && (
            <div className="bg-white rounded-2xl border border-indigo-200 p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    Đã Tạo Thành Công {generatedVariants.length} Mã Đề Chuẩn Bộ GD&ĐT
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Học sinh có thể vào thi trực tiếp với mã phòng:{" "}
                    <strong className="text-indigo-600 font-mono font-bold">{accessCode}</strong>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  {/* Live Quiz Arena */}
                  <button
                    type="button"
                    onClick={() => setIsLiveQuizModalOpen(true)}
                    className="px-3 py-1.5 text-xs font-black text-slate-950 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 hover:from-amber-500 hover:to-orange-600 rounded-lg flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer"
                    title="Khởi tạo Đấu trường Live Quiz tương tác trên lớp"
                  >
                    <Gamepad2 className="w-3.5 h-3.5 fill-current" />
                    <span>Đấu Trường Quiz</span>
                  </button>

                  {/* Presentation Slides PPTX / HTML */}
                  <button
                    type="button"
                    onClick={() => {
                      const currentVariant = generatedVariants.find((v) => v.examCode === activeVariantTab) || generatedVariants[0];
                      if (currentVariant) {
                        openPresentationInNewTab(currentVariant.questions, config, activeVariantTab);
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1.5 transition-all shadow-2xs"
                    title="Mở bài giảng trình chiếu chữa đề thi trực tiếp trên máy chiếu/màn hình"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Bài Giảng Slides</span>
                  </button>

                  {/* Printable Standard OMR Sheet */}
                  <button
                    type="button"
                    onClick={() => {
                      const currentVariant = generatedVariants.find((v) => v.examCode === activeVariantTab) || generatedVariants[0];
                      const qList = currentVariant ? currentVariant.questions : selectedQuestions;
                      const p1 = qList.filter((q) => q.part === 1 || q.questionType === "multiple_choice").length || 18;
                      const p2 = qList.filter((q) => q.part === 2 || q.questionType === "true_false").length || 4;
                      const p3 = qList.filter((q) => q.part === 3 || q.questionType === "short_answer").length || 6;
                      openPrintableOMRSheet({
                        school: config.school,
                        department: config.department,
                        examPeriod: config.examPeriod,
                        subject: config.subject,
                        grade: config.grade,
                        examCode: activeVariantTab,
                        totalPart1: p1,
                        totalPart2: p2,
                        totalPart3: p3,
                      });
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg flex items-center gap-1.5 transition-all shadow-2xs"
                    title="In Phiếu Trả Lời Trắc Nghiệm Chuẩn Bộ GD&ĐT (Khổ A4)"
                  >
                    <FileCheck className="w-3.5 h-3.5 text-amber-600" />
                    <span>In Phiếu OMR Chuẩn</span>
                  </button>

                  {/* Moodle XML Export */}
                  <button
                    type="button"
                    onClick={() => {
                      const currentVariant = generatedVariants.find((v) => v.examCode === activeVariantTab) || generatedVariants[0];
                      if (currentVariant) {
                        exportToMoodleXMLFile(currentVariant.questions, config, activeVariantTab);
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg flex items-center gap-1.5 transition-all"
                    title="Xuất định dạng Moodle XML chuẩn nhập vào Moodle / Canvas LMS"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                    <span>Moodle XML</span>
                  </button>

                  {/* GIFT Format Export */}
                  <button
                    type="button"
                    onClick={() => {
                      const currentVariant = generatedVariants.find((v) => v.examCode === activeVariantTab) || generatedVariants[0];
                      if (currentVariant) {
                        exportToGIFTFile(currentVariant.questions, config, activeVariantTab);
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-1.5 transition-all"
                    title="Xuất định dạng GIFT Format cho LMS"
                  >
                    <FileCode className="w-3.5 h-3.5 text-slate-600" />
                    <span>GIFT LMS</span>
                  </button>

                  {/* Answer Matrix Excel */}
                  <button
                    type="button"
                    onClick={() => exportAnswerKeyMatrix(generatedVariants, `Dap_An_${config.subject}_${config.examPeriod}`)}
                    className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 transition-all"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Excel Đáp Án</span>
                  </button>

                  {/* Print Exam */}
                  <button
                    type="button"
                    onClick={handlePrintCurrentVariant}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-all"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>In Đề</span>
                  </button>
                </div>
              </div>

              {/* 3 Main View Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setGeneratedViewMode("student")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                      generatedViewMode === "student"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Giao Diện Phòng Thi Học Sinh</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGeneratedViewMode("paper")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                      generatedViewMode === "paper"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Bản In Đề Thi Giấy</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGeneratedViewMode("matrix")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                      generatedViewMode === "matrix"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Ma Trận Đáp Án</span>
                  </button>
                </div>

                {/* Variant Code Pills */}
                {generatedViewMode !== "matrix" && (
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-slate-500 font-medium">Mã đề:</span>
                    {generatedVariants.map((v) => (
                      <button
                        key={v.examCode}
                        type="button"
                        onClick={() => {
                          setActiveVariantTab(v.examCode);
                          setPreviewStudentQIndex(1);
                        }}
                        className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg transition-all ${
                          activeVariantTab === v.examCode
                            ? "bg-slate-900 text-white shadow-xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {v.examCode}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* TAB 1: STUDENT EXAM ROOM SIMULATION */}
              {generatedViewMode === "student" && (() => {
                const currentVariant = generatedVariants.find((v) => v.examCode === activeVariantTab) || generatedVariants[0];
                if (!currentVariant) return null;

                const qCount = currentVariant.questions.length;
                const currentQ = currentVariant.questions[previewStudentQIndex - 1] || currentVariant.questions[0];
                if (!currentQ) return null;

                const isPart2 = currentQ.part === 2 || currentQ.questionType === "true_false" || (currentQ.statements && currentQ.statements.length > 0);
                const isPart3 = currentQ.part === 3 || currentQ.questionType === "short_answer" || (!isPart2 && currentQ.options.length === 0);
                const isPart1 = !isPart2 && !isPart3;

                return (
                  <div className="space-y-4">
                    {/* Simulated Student Room Top Banner */}
                    <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-sm">{config.subject}</span>
                          <span className="px-2 py-0.5 rounded font-mono font-bold bg-indigo-500/30 text-indigo-300 text-xs border border-indigo-400/40">
                            MÃ ĐỀ: {currentVariant.examCode}
                          </span>
                          <span className="text-xs text-slate-300">
                            Thời gian: {config.duration} phút
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {config.department} • {config.examPeriod}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <div className="px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-950/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Chống gian lận Bật</span>
                        </div>
                        <div className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-amber-300 font-mono text-sm font-bold border border-slate-700 flex items-center gap-1.5 shadow-xs">
                          <Clock className="w-4 h-4 text-amber-400" />
                          <span>{config.duration}:00</span>
                        </div>
                        {publishedExam && (
                          <button
                            type="button"
                            onClick={() => onOpenStudentExam(publishedExam.id, currentVariant.examCode)}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                          >
                            <span>Mở Phòng Thi Thực Tế</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Main Layout Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* Left: Active Question Card */}
                      <div className="lg:col-span-8 space-y-4">
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
                          {/* Question Meta Header */}
                          <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 text-xs gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-extrabold text-sm text-indigo-700">
                                CÂU HỎI {previewStudentQIndex} / {qCount}
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                  isPart2
                                    ? "bg-purple-50 text-purple-700 border-purple-200"
                                    : isPart3
                                    ? "bg-amber-50 text-amber-800 border-amber-200"
                                    : "bg-blue-50 text-blue-700 border-blue-200"
                                }`}
                              >
                                {isPart2
                                  ? "PHẦN II: Đúng / Sai (4 ý)"
                                  : isPart3
                                  ? "PHẦN III: Trả lời ngắn"
                                  : "PHẦN I: Trắc nghiệm 4 lựa chọn"}
                              </span>
                              {currentQ.level && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                  {currentQ.level}
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const origQ = selectedQuestions.find((sq) => sq.id === currentQ.originalId) || selectedQuestions[previewStudentQIndex - 1];
                                if (origQ) setEditingQuestion(origQ);
                              }}
                              className="px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg flex items-center gap-1 transition-all"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Sửa Câu Này</span>
                            </button>
                          </div>

                          {/* Group / Reading Passage Container */}
                          {currentQ.groupTitle && (
                            <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 text-indigo-950 space-y-2">
                              <div className="font-bold text-xs text-indigo-900">
                                📌 {currentQ.groupTitle}
                              </div>
                              {currentQ.passageContent && (
                                <div className="text-slate-800 text-xs">
                                  <FormattedQuestionContent content={currentQ.passageContent} />
                                </div>
                              )}
                            </div>
                          )}

                          {/* Question Prompt */}
                          <div className="text-sm font-medium text-slate-900">
                            <FormattedQuestionContent content={currentQ.content} />
                          </div>

                          {/* Part I Options with Test Clicker */}
                          {isPart1 && currentQ.options.length > 0 && (
                            <div className="space-y-2 pt-2">
                              {currentQ.options.map((opt, optIdx) => {
                                const isSimSelected = simAnswers[previewStudentQIndex] === optIdx;
                                const isKey = optIdx === currentQ.correctIndex;

                                return (
                                  <div
                                    key={optIdx}
                                    onClick={() =>
                                      setSimAnswers((prev) => ({ ...prev, [previewStudentQIndex]: optIdx }))
                                    }
                                    className={`p-3.5 rounded-xl border text-xs cursor-pointer flex items-center justify-between gap-3 transition-all ${
                                      isSimSelected
                                        ? "bg-indigo-50 border-indigo-500 text-indigo-950 font-bold shadow-xs"
                                        : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <span
                                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                          isSimSelected
                                            ? "bg-indigo-600 text-white"
                                            : "bg-slate-100 text-slate-700"
                                        }`}
                                      >
                                        {LETTERS[optIdx]}
                                      </span>
                                      <span className="leading-relaxed flex-1 text-slate-800"><MathTextRenderer text={opt} /></span>
                                    </div>
                                    {isKey && (
                                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold border border-emerald-300 shrink-0">
                                        ✓ Đáp án đề {currentVariant.examCode}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Part II True/False Matrix with Test Toggles */}
                          {isPart2 && (
                            <div className="space-y-2 pt-2">
                              <div className="text-xs font-bold text-purple-900">
                                Chọn Đúng hoặc Sai cho từng mệnh đề sau:
                              </div>
                              {(currentQ.statements && currentQ.statements.length > 0
                                ? currentQ.statements
                                : [
                                    { id: "a", label: "a)", text: "Ý a", correctValue: true },
                                    { id: "b", label: "b)", text: "Ý b", correctValue: false },
                                    { id: "c", label: "c)", text: "Ý c", correctValue: true },
                                    { id: "d", label: "d)", text: "Ý d", correctValue: false },
                                  ]
                              ).map((st) => {
                                const currentSimVal = simAnswers[previewStudentQIndex]?.[st.id];

                                return (
                                  <div
                                    key={st.id}
                                    className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                                  >
                                    <div className="flex items-start gap-2 flex-1">
                                      <span className="font-bold text-purple-700 shrink-0">
                                        {st.label || `${st.id})`}
                                      </span>
                                      <span className="text-slate-800 leading-relaxed"><MathTextRenderer text={st.text} /></span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setSimAnswers((prev) => ({
                                            ...prev,
                                            [previewStudentQIndex]: {
                                              ...(prev[previewStudentQIndex] || {}),
                                              [st.id]: true,
                                            },
                                          }))
                                        }
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                          currentSimVal === true
                                            ? "bg-emerald-600 text-white shadow-xs"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                        }`}
                                      >
                                        Đúng
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setSimAnswers((prev) => ({
                                            ...prev,
                                            [previewStudentQIndex]: {
                                              ...(prev[previewStudentQIndex] || {}),
                                              [st.id]: false,
                                            },
                                          }))
                                        }
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                          currentSimVal === false
                                            ? "bg-rose-600 text-white shadow-xs"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                        }`}
                                      >
                                        Sai
                                      </button>
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        st.correctValue ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50"
                                      }`}>
                                        (Key: {st.correctValue ? "Đ" : "S"})
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Part III Short Answer Input */}
                          {isPart3 && (
                            <div className="space-y-2 pt-2 bg-amber-50/70 p-4 rounded-xl border border-amber-200 text-xs">
                              <div className="font-bold text-amber-950">
                                Nhập câu trả lời (Dạng số thập phân hoặc nguyên):
                              </div>
                              <div className="flex items-center gap-3">
                                <input
                                  type="text"
                                  value={simAnswers[previewStudentQIndex] || ""}
                                  onChange={(e) =>
                                    setSimAnswers((prev) => ({
                                      ...prev,
                                      [previewStudentQIndex]: e.target.value,
                                    }))
                                  }
                                  placeholder="Nhập số..."
                                  className="flex-1 px-3 py-2 bg-white border border-amber-300 rounded-lg font-mono font-bold text-amber-950 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                                />
                                <span className="px-2.5 py-1 bg-amber-100 text-amber-900 rounded font-mono font-bold text-xs border border-amber-300">
                                  Đáp án chuẩn: {currentQ.shortAnswer || "(Chưa có)"}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Explanation Box */}
                          {currentQ.explanation && (
                            <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-slate-700 space-y-1">
                              <strong className="text-indigo-900 block">💡 Lời giải chi tiết:</strong>
                              <p className="leading-relaxed">{currentQ.explanation}</p>
                            </div>
                          )}

                          {/* Bottom Navigation */}
                          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => setPreviewStudentQIndex((prev) => Math.max(1, prev - 1))}
                              disabled={previewStudentQIndex <= 1}
                              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl disabled:opacity-30 flex items-center gap-1.5 transition-all"
                            >
                              <ChevronLeft className="w-4 h-4" />
                              <span>Câu Trước</span>
                            </button>

                            <span className="text-xs font-bold text-slate-500">
                              Câu {previewStudentQIndex} / {qCount}
                            </span>

                            <button
                              type="button"
                              onClick={() => setPreviewStudentQIndex((prev) => Math.min(qCount, prev + 1))}
                              disabled={previewStudentQIndex >= qCount}
                              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl disabled:opacity-30 flex items-center gap-1.5 transition-all"
                            >
                              <span>Câu Sau</span>
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Right: Question Navigation Palette */}
                      <div className="lg:col-span-4 space-y-4">
                        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 sticky top-20">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <span className="font-bold text-xs text-slate-800">
                              Bảng Điều Hướng ({qCount} câu)
                            </span>
                            <span className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                              Mã {currentVariant.examCode}
                            </span>
                          </div>

                          <div className="grid grid-cols-5 gap-2 max-h-72 overflow-y-auto pr-1">
                            {currentVariant.questions.map((q) => {
                              const qIdx = q.questionIndex;
                              const isActive = qIdx === previewStudentQIndex;
                              const isP2 = q.part === 2 || q.questionType === "true_false" || (q.statements && q.statements.length > 0);
                              const isP3 = q.part === 3 || q.questionType === "short_answer" || (!isP2 && q.options.length === 0);

                              return (
                                <button
                                  key={qIdx}
                                  type="button"
                                  onClick={() => setPreviewStudentQIndex(qIdx)}
                                  className={`h-10 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center ${
                                    isActive
                                      ? "bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-300"
                                      : isP2
                                      ? "bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100"
                                      : isP3
                                      ? "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                                      : "bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100"
                                  }`}
                                >
                                  <span>{qIdx}</span>
                                </button>
                              );
                            })}
                          </div>

                          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"></span>
                              <span>Phần I: Trắc nghiệm 4 lựa chọn</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0"></span>
                              <span>Phần II: Đúng / Sai (4 ý)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
                              <span>Phần III: Điền số</span>
                            </div>
                          </div>

                          {publishedExam && (
                            <button
                              type="button"
                              onClick={() => onOpenStudentExam(publishedExam.id, currentVariant.examCode)}
                              className="w-full py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all"
                            >
                              <span>Bắt Đầu Làm Thử Phòng Thi</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* TAB 2: PAPER PRINT PREVIEW */}
              {generatedViewMode === "paper" && (() => {
                const currentVariant = generatedVariants.find((v) => v.examCode === activeVariantTab) || generatedVariants[0];
                if (!currentVariant) return null;

                return (
                  <div className="space-y-4">
                    {/* Paper Action Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-indigo-50/80 rounded-xl border border-indigo-200 text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsPaperAnswersVisible(!isPaperAnswersVisible)}
                          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 shadow-2xs ${
                            isPaperAnswersVisible
                              ? "bg-emerald-600 text-white"
                              : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-100"
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isPaperAnswersVisible ? "💡 Đang Hiện Đáp Án & Lời Giải" : "📄 Đang Ẩn Đáp Án (Bản Cho Học Sinh)"}</span>
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* Word Exam */}
                        <button
                          type="button"
                          onClick={() => exportQuestionsToWordDoc(currentVariant.questions, `De_Thi_${config.subject}_ma_${activeVariantTab}`, false)}
                          className="px-2.5 py-1.5 rounded-lg font-semibold bg-white text-blue-700 border border-blue-200 hover:bg-blue-50 flex items-center gap-1"
                          title="Xuất file Word đề thi không có đáp án cho học sinh"
                        >
                          <FileDown className="w-3.5 h-3.5 text-blue-600" />
                          <span>Word (Đề Thi)</span>
                        </button>

                        {/* Word with Answers */}
                        <button
                          type="button"
                          onClick={() => exportQuestionsToWordDoc(currentVariant.questions, `De_Thi_${config.subject}_ma_${activeVariantTab}`, true)}
                          className="px-2.5 py-1.5 rounded-lg font-semibold bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 flex items-center gap-1"
                          title="Xuất file Word đề thi có sẵn đáp án chi tiết và ma trận"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Word (Kèm Đáp Án)</span>
                        </button>

                        {/* Printable PDF */}
                        <button
                          type="button"
                          onClick={() => exportQuestionsToPrintablePdf(currentVariant.questions, `De_Thi_${config.subject}_ma_${activeVariantTab}`, isPaperAnswersVisible)}
                          className="px-2.5 py-1.5 rounded-lg font-semibold bg-slate-800 text-white hover:bg-slate-900 flex items-center gap-1"
                          title="In hoặc lưu file PDF trực tiếp"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>In / PDF {isPaperAnswersVisible ? "(Có Đ/A)" : "(Đề Gốc)"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Paper Document Preview */}
                    <div className="space-y-4 max-h-[600px] overflow-y-auto p-6 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                      {/* Ministry Standard Header */}
                      <div className="border-b-2 border-slate-800 pb-3 text-center space-y-1">
                        <div className="flex justify-between text-[11px] font-bold text-slate-800 uppercase">
                          <div>
                            <p>{config.department}</p>
                            <p>{config.school}</p>
                          </div>
                          <div>
                            <p>{config.examPeriod}</p>
                            <p>MÔN: {config.subject?.toUpperCase()}</p>
                          </div>
                        </div>
                        <div className="pt-2 font-bold text-sm text-slate-900 uppercase">
                          {examTitle} {isPaperAnswersVisible ? "(HƯỚNG DẪN GIẢI & ĐÁP ÁN)" : ""}
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-600 italic pt-1">
                          <span>Thời gian: {config.duration} phút (Không kể phát đề)</span>
                          <span className="font-mono font-bold text-slate-900">
                            MÃ ĐỀ THI: {activeVariantTab}
                          </span>
                        </div>
                      </div>

                      {/* Question Items */}
                      {currentVariant.questions.map((q, qIdx) => {
                        const isPart2 = q.part === 2 || q.questionType === "true_false" || (q.statements && q.statements.length > 0);
                        const isPart3 = q.part === 3 || q.questionType === "short_answer" || (!isPart2 && q.options.length === 0);
                        const isPart1 = !isPart2 && !isPart3;
                        const isFirstInPart = qIdx === 0 || q.part !== currentVariant.questions[qIdx - 1]?.part;

                        return (
                          <React.Fragment key={q.questionIndex}>
                            {isFirstInPart && (
                              <div className="pt-3 pb-1 border-b border-slate-300">
                                <p className="font-bold text-slate-900 uppercase">
                                  {q.part === 1
                                    ? "PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn."
                                    : q.part === 2
                                    ? "PHẦN II. Câu trắc nghiệm đúng sai."
                                    : "PHẦN III. Câu trắc nghiệm trả lời ngắn."}
                                </p>
                                <p className="italic text-slate-600 text-[11px]">
                                  {q.part === 1
                                    ? "Thí sinh trả lời từ câu 1 đến câu 18. Mỗi câu hỏi thí sinh chỉ chọn một phương án."
                                    : q.part === 2
                                    ? "Thí sinh trả lời từ câu 1 đến câu 4. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai."
                                    : "Thí sinh trả lời từ câu 1 đến câu 6."}
                                </p>
                              </div>
                            )}

                            <div className="space-y-1.5 pt-2.5 border-t border-slate-200">
                              {q.groupTitle && (
                                <div className="p-2 rounded bg-indigo-50 text-indigo-950 font-semibold text-[11px]">
                                  {q.groupTitle}
                                  {q.passageContent && (
                                    <div className="font-normal mt-1">
                                      <FormattedQuestionContent content={q.passageContent} />
                                    </div>
                                  )}
                                </div>
                              )}
                              <div className="font-bold text-slate-800">
                                <span>
                                  Câu {q.questionIndex}
                                  {q.partQuestionIndex ? ` (Phần ${q.part === 1 ? 'I' : q.part === 2 ? 'II' : 'III'} - Câu ${q.partQuestionIndex})` : ""}:{" "}
                                </span>
                                <FormattedQuestionContent content={q.content} />
                              </div>

                              {isPart1 && q.options.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700 pt-1">
                                  {q.options.map((opt, optIdx) => {
                                    const isCorrect = isPaperAnswersVisible && optIdx === q.correctIndex;
                                    return (
                                      <div
                                        key={optIdx}
                                        className={`flex items-start gap-1 p-1 rounded transition-colors ${
                                          isCorrect
                                            ? "bg-emerald-100 text-emerald-950 font-bold border border-emerald-300"
                                            : ""
                                        }`}
                                      >
                                        <strong>{LETTERS[optIdx]}.</strong> <MathTextRenderer text={opt} />
                                        {isCorrect && <span className="text-emerald-700 text-[10px]">✓</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {isPart2 && (
                                <div className="space-y-1 pl-3 text-slate-700 pt-1">
                                  {(q.statements && q.statements.length > 0
                                    ? q.statements
                                    : [
                                        { id: "a", label: "a)", text: "Ý a", correctValue: true },
                                        { id: "b", label: "b)", text: "Ý b", correctValue: false },
                                        { id: "c", label: "c)", text: "Ý c", correctValue: true },
                                        { id: "d", label: "d)", text: "Ý d", correctValue: false },
                                      ]
                                  ).map((st) => (
                                    <div key={st.id} className="flex items-start gap-1.5">
                                      <span className="font-bold">{st.label || `${st.id})`}</span>
                                      <span className="flex-1"><MathTextRenderer text={st.text} /></span>
                                      {isPaperAnswersVisible && (
                                        <span
                                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                            st.correctValue
                                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                              : "bg-red-100 text-red-800 border border-red-300"
                                          }`}
                                        >
                                          {st.correctValue ? "ĐÚNG" : "SAI"}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {isPart3 && (
                                <div className="pl-3 pt-1">
                                  {isPaperAnswersVisible ? (
                                    <div className="inline-flex items-center gap-2 p-1.5 px-3 rounded bg-amber-50 border border-amber-300 text-amber-950 font-bold">
                                      <span>Đáp án số chuẩn:</span>
                                      <span className="font-mono text-emerald-700 text-sm">{q.shortAnswer || "Chưa có đáp án"}</span>
                                    </div>
                                  ) : (
                                    <div className="text-slate-600 italic">
                                      Đáp án: ................................................................
                                    </div>
                                  )}
                                </div>
                              )}

                              {isPaperAnswersVisible && q.explanation && (
                                <div className="mt-1.5 p-2 rounded-lg bg-blue-50/80 border border-blue-200 text-blue-950 text-[11px] leading-relaxed">
                                  <strong>💡 Lời giải chi tiết:</strong>{" "}
                                  <FormattedQuestionContent content={q.explanation} />
                                </div>
                              )}
                            </div>
                          </React.Fragment>
                        );
                      })}

                      {/* Bottom Answer Matrix if isPaperAnswersVisible */}
                      {isPaperAnswersVisible && (
                        <div className="pt-4 border-t-2 border-slate-800 mt-6 space-y-2">
                          <h4 className="font-bold text-center text-slate-900 uppercase">
                            BẢNG ĐÁP ÁN TỔNG HỢP (MÃ ĐỀ {activeVariantTab})
                          </h4>
                          <div className="grid grid-cols-5 sm:grid-cols-7 gap-1.5 text-center">
                            {currentVariant.questions.map((q) => {
                              const isP2 = q.part === 2 || q.questionType === "true_false";
                              const isP3 = q.part === 3 || q.questionType === "short_answer";
                              let ans = "";
                              if (isP2) {
                                ans = (q.statements || []).map((s) => `${s.label ? s.label.replace(")", "") : s.id}:${s.correctValue ? "Đ" : "S"}`).join(",");
                              } else if (isP3) {
                                ans = q.shortAnswer || "-";
                              } else {
                                ans = LETTERS[q.correctIndex ?? 0] || "A";
                              }

                              return (
                                <div key={q.questionIndex} className="p-1 rounded bg-slate-100 border border-slate-200 text-[10px]">
                                  <div className="font-bold text-slate-600">Câu {q.questionIndex}</div>
                                  <div className="font-bold text-indigo-700 font-mono">{ans}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* TAB 3: ANSWER KEY MATRIX */}
              {generatedViewMode === "matrix" && (
                <div className="overflow-x-auto max-h-72 border rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                      <tr>
                        <th className="p-3 border-b">Câu</th>
                        {generatedVariants.map((v) => (
                          <th key={v.examCode} className="p-3 border-b text-center font-mono">
                            Mã {v.examCode}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {Array.from({ length: selectedQuestions.length }).map((_, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-slate-700">Câu {i + 1}</td>
                          {generatedVariants.map((v) => (
                            <td key={v.examCode} className="p-2.5 text-center font-mono font-bold text-indigo-700">
                              {v.answerKey[i + 1] || "-"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: MISSING ANSWERS DETECTION & AI SOLVE PROMPT */}
      {showMissingAnswersPrompt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-amber-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Phát Hiện Đề Thi Chưa Có Đáp Án Chính Thức!
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Hệ thống AI nhận thấy một số câu hỏi vừa nạp chưa có đáp án hoặc cần kiểm duyệt.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-indigo-50 rounded-xl border border-indigo-200 text-xs text-indigo-950 leading-relaxed">
              Thầy/Cô có muốn <strong>AI tự động giải chi tiết và tạo đáp án chuẩn</strong> (cả Phần I Trắc nghiệm, Phần II Đúng/Sai 4 ý, và Phần III Điền số) không?
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowMissingAnswersPrompt(false)}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                Để sau / Tự làm
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMissingAnswersPrompt(false);
                  setShowReviewModal(true);
                }}
                className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all"
              >
                Tự Nhập & Duyệt
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMissingAnswersPrompt(false);
                  handleSolveWithAI();
                }}
                disabled={isSolvingAI}
                className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Có, AI Giải & Tạo Đáp Án Ngay</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: QUESTION LIVE EDITOR (Chỉnh sửa chi tiết câu hỏi) */}
      {editingQuestion && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <PenTool className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Chỉnh Sửa Chi Tiết Câu Hỏi
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingQuestion(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
              {/* Part & Cognitive Level Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Dạng Cấu Trúc Bộ GD&ĐT:</label>
                  <select
                    value={editingQuestion.part}
                    onChange={(e) => {
                      const newPart = Number(e.target.value) as ExamPart;
                      setEditingQuestion({
                        ...editingQuestion,
                        part: newPart,
                        questionType:
                          newPart === 1
                            ? "multiple_choice"
                            : newPart === 2
                            ? "true_false"
                            : "short_answer",
                      });
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-semibold text-slate-800 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value={1}>PHẦN I: Trắc nghiệm 4 lựa chọn</option>
                    <option value={2}>PHẦN II: Đúng / Sai (4 ý a, b, c, d)</option>
                    <option value={3}>PHẦN III: Trả lời ngắn / Điền số</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mức Độ Nhận Thức:</label>
                  <select
                    value={editingQuestion.level || "Thông hiểu"}
                    onChange={(e) =>
                      setEditingQuestion({
                        ...editingQuestion,
                        level: e.target.value as CognitiveLevel,
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-semibold text-slate-800 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Nhận biết">Nhận biết</option>
                    <option value="Thông hiểu">Thông hiểu</option>
                    <option value="Vận dụng">Vận dụng</option>
                    <option value="Vận dụng cao">Vận dụng cao</option>
                  </select>
                </div>
              </div>

              {/* Group Title & Passage */}
              <div className="space-y-2 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                <div>
                  <label className="block font-bold text-indigo-900 mb-1">Tiêu Đề Nhóm / Bài Đọc (Tùy chọn):</label>
                  <input
                    type="text"
                    value={editingQuestion.groupTitle || ""}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, groupTitle: e.target.value })
                    }
                    placeholder="VD: Read the following passage and mark the letter A, B, C, or D..."
                    className="w-full px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-indigo-900 mb-1">Nội Dung Đoạn Văn / Bảng Số Liệu:</label>
                  <textarea
                    rows={2}
                    value={editingQuestion.passageContent || ""}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, passageContent: e.target.value })
                    }
                    placeholder="Nhập nội dung bài đọc hoặc bảng Markdown |...|..."
                    className="w-full px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {/* Question Content Prompt */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700">
                    Nội Dung Câu Hỏi (Hỗ trợ Markdown Bảng, Công Thức & Hình Vẽ):
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const tableTemplate = `\n\n| Đại lượng | Giá trị 1 | Giá trị 2 |\n| :--- | :--- | :--- |\n| Thông số A | 10.5 | 24.8 |\n| Thông số B | 30.2 | 45.0 |\n\n`;
                        setEditingQuestion({
                          ...editingQuestion,
                          content: (editingQuestion.content || "") + tableTemplate,
                          hasTableOrDiagram: true,
                        });
                      }}
                      className="px-2 py-0.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 transition-colors"
                    >
                      + Bảng Markdown
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const graphTemplate = `\n\n\`\`\`\n  y ▲\n    │       ╭───╮\n    │      ╭╯   ╰╮\n────┼─────╭╯─────╰─────► x\n  O │    ╭╯       ╰╮\n\`\`\`\n\n`;
                        setEditingQuestion({
                          ...editingQuestion,
                          content: (editingQuestion.content || "") + graphTemplate,
                          hasTableOrDiagram: true,
                        });
                      }}
                      className="px-2 py-0.5 text-[10px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition-colors"
                    >
                      + Sơ đồ ASCII
                    </button>
                  </div>
                </div>
                <textarea
                  rows={4}
                  value={editingQuestion.content}
                  onChange={(e) =>
                    setEditingQuestion({ ...editingQuestion, content: e.target.value })
                  }
                  placeholder="Nhập nội dung câu hỏi hoặc dán hình ảnh..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* IMAGE / DIAGRAM / CHART ATTACHMENT BOX */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <ImageIcon className="w-4 h-4 text-indigo-600" />
                    <span>Hình Vẽ, Biểu Đồ & Đồ Thị Đính Kèm</span>
                  </div>
                  <label className="cursor-pointer px-2.5 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs flex items-center gap-1 transition-all">
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>Tải Ảnh / Hình Vẽ Lên</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            const base64 = evt.target?.result as string;
                            if (base64) {
                              const imgMd = `\n\n![Hình vẽ minh họa](${base64})\n\n`;
                              setEditingQuestion({
                                ...editingQuestion,
                                content: (editingQuestion.content || "").replace(/!\[(.*?)\]\((data:image\/[^;]+;base64,[^\s)]+)\)/g, "").trim() + imgMd,
                                diagramUrl: base64,
                                hasTableOrDiagram: true,
                              });
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>

                {/* Direct Image URL input */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Hoặc dán liên kết URL hình ảnh (https://...)..."
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const url = (e.target as HTMLInputElement).value.trim();
                        if (url) {
                          const imgMd = `\n\n![Hình vẽ câu hỏi](${url})\n\n`;
                          setEditingQuestion({
                            ...editingQuestion,
                            content: (editingQuestion.content || "") + imgMd,
                            diagramUrl: url,
                            hasTableOrDiagram: true,
                          });
                          (e.target as HTMLInputElement).value = "";
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                      const url = input.value.trim();
                      if (url) {
                        const imgMd = `\n\n![Hình vẽ câu hỏi](${url})\n\n`;
                        setEditingQuestion({
                          ...editingQuestion,
                          content: (editingQuestion.content || "") + imgMd,
                          diagramUrl: url,
                          hasTableOrDiagram: true,
                        });
                        input.value = "";
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg"
                  >
                    Chèn URL
                  </button>
                </div>
              </div>

              {/* Live Markdown & Image Preview */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="font-bold text-[11px] text-slate-500 uppercase tracking-wider block">
                  Xem Trước Trực Tiếp (Bao gồm Bảng, Sơ Đồ & Hình Vẽ):
                </span>
                <div className="text-slate-800 bg-white p-3 rounded-lg border border-slate-200/80">
                  <FormattedQuestionContent
                    content={editingQuestion.content}
                    diagramUrl={editingQuestion.diagramUrl}
                  />
                </div>
              </div>

              {/* Part 1: Options Editor */}
              {editingQuestion.part === 1 && (
                <div className="space-y-2">
                  <label className="block font-bold text-slate-700">
                    4 Lựa Chọn (Tích chọn đáp án đúng):
                  </label>
                  <div className="space-y-1.5">
                    {["A", "B", "C", "D"].map((letter, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingQuestion({ ...editingQuestion, correctIndex: idx })
                          }
                          className={`w-7 h-7 rounded-lg font-bold text-xs shrink-0 transition-all ${
                            editingQuestion.correctIndex === idx
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {letter}
                        </button>
                        <input
                          type="text"
                          value={editingQuestion.options[idx] || ""}
                          onChange={(e) => {
                            const newOpts = [...editingQuestion.options];
                            newOpts[idx] = e.target.value;
                            setEditingQuestion({ ...editingQuestion, options: newOpts });
                          }}
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                          placeholder={`Lựa chọn ${letter}...`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Part 2: Statements Editor */}
              {editingQuestion.part === 2 && (
                <div className="space-y-2">
                  <label className="block font-bold text-slate-700">
                    4 Mệnh Đề Đúng / Sai (a, b, c, d):
                  </label>
                  {(editingQuestion.statements && editingQuestion.statements.length > 0
                    ? editingQuestion.statements
                    : [
                        { id: "a", label: "a)", text: "Mệnh đề a", correctValue: true },
                        { id: "b", label: "b)", text: "Mệnh đề b", correctValue: false },
                        { id: "c", label: "c)", text: "Mệnh đề c", correctValue: true },
                        { id: "d", label: "d)", text: "Mệnh đề d", correctValue: false },
                      ]
                  ).map((st, sIdx) => (
                    <div key={st.id} className="flex items-center gap-2">
                      <span className="font-bold text-purple-700 w-5">{st.label || `${st.id})`}</span>
                      <input
                        type="text"
                        value={st.text}
                        onChange={(e) => {
                          const newStmts = [...(editingQuestion.statements || [])];
                          newStmts[sIdx] = { ...st, text: e.target.value };
                          setEditingQuestion({ ...editingQuestion, statements: newStmts });
                        }}
                        className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newStmts = [...(editingQuestion.statements || [])];
                          newStmts[sIdx] = { ...st, correctValue: true };
                          setEditingQuestion({ ...editingQuestion, statements: newStmts });
                        }}
                        className={`px-3 py-1 text-xs font-bold rounded-lg ${
                          st.correctValue ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        Đúng
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newStmts = [...(editingQuestion.statements || [])];
                          newStmts[sIdx] = { ...st, correctValue: false };
                          setEditingQuestion({ ...editingQuestion, statements: newStmts });
                        }}
                        className={`px-3 py-1 text-xs font-bold rounded-lg ${
                          !st.correctValue ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        Sai
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Part 3: Short Answer Editor */}
              {editingQuestion.part === 3 && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Đáp Án Số Chuẩn (Phần III):
                  </label>
                  <input
                    type="text"
                    value={editingQuestion.shortAnswer || ""}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, shortAnswer: e.target.value })
                    }
                    placeholder="VD: 15.8, -4, 2026..."
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg font-mono font-bold text-sm text-amber-950"
                  />
                </div>
              )}

              {/* Explanation */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Lời Giải / Hướng Dẫn Chi Tiết:
                </label>
                <textarea
                  rows={2}
                  value={editingQuestion.explanation || ""}
                  onChange={(e) =>
                    setEditingQuestion({ ...editingQuestion, explanation: e.target.value })
                  }
                  placeholder="Nhập hướng dẫn giải từng bước..."
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setEditingQuestion(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={() => handleSaveEditedQuestion(editingQuestion)}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>Lưu Thay Đổi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ANSWER REVIEW & MODERATION (Kiểm duyệt đáp án nhanh) */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  Bảng Kiểm Duyệt & Chỉnh Sửa Đáp Án Đề Thi
                </h3>
                <p className="text-xs text-slate-500">
                  Kiểm tra lại đáp án của từng câu hỏi trước khi tạo đề và giao cho học sinh.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200 text-xs text-indigo-900 flex flex-wrap items-center justify-between gap-2">
                <span>
                  Kiểm duyệt đáp án theo đúng 3 phần Bộ GD&ĐT: <strong>Phần I (Trắc nghiệm A-D)</strong>, <strong>Phần II (Đúng/Sai cả 4 ý a,b,c,d)</strong>, <strong>Phần III (Điền số)</strong>.
                </span>
                <span className="font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                  Tổng số: {selectedQuestions.length} câu
                </span>
              </div>

              <div className="space-y-3">
                {selectedQuestions.map((q, idx) => {
                  const isPart2 = q.part === 2 || q.questionType === "true_false" || (q.statements && q.statements.length > 0);
                  const isPart3 = q.part === 3 || q.questionType === "short_answer" || (!isPart2 && q.options.length === 0);
                  const isPart1 = !isPart2 && !isPart3;

                  return (
                    <div
                      key={q.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 transition-all space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-slate-800 text-xs px-2 py-0.5 bg-slate-100 rounded">
                            Câu {idx + 1}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                              isPart2
                                ? "bg-purple-100 text-purple-800"
                                : isPart3
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {isPart2 ? "Phần II: Đúng / Sai" : isPart3 ? "Phần III: Điền số" : "Phần I: Trắc nghiệm"}
                          </span>
                          {q.groupTitle && (
                            <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-medium">
                              {q.groupTitle}
                            </span>
                          )}
                          {q.needsReview && (
                            <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-bold">
                              Cần duyệt
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowReviewModal(false);
                              setEditingQuestion(q);
                            }}
                            className="px-2 py-0.5 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Sửa Chi Tiết</span>
                          </button>

                          {/* Part 1 Quick Selector */}
                          {isPart1 && (
                            <div className="flex items-center gap-1">
                              {q.options.map((_, optIdx) => (
                                <button
                                  key={optIdx}
                                  type="button"
                                  onClick={() => handleUpdateQuestionAnswer(q.id, optIdx)}
                                  className={`w-7 h-7 rounded-md text-xs font-bold transition-all ${
                                    optIdx === q.correctIndex
                                      ? "bg-emerald-600 text-white shadow-xs"
                                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                  }`}
                                >
                                  {LETTERS[optIdx]}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-xs text-slate-800 font-medium">
                        <FormattedQuestionContent content={q.content} />
                      </div>

                      {/* Part 1: Options List */}
                      {isPart1 && q.options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                          {q.options.map((opt, optIdx) => (
                            <div
                              key={optIdx}
                              onClick={() => handleUpdateQuestionAnswer(q.id, optIdx)}
                              className={`p-1.5 px-2.5 rounded text-[11px] cursor-pointer flex items-center gap-1.5 ${
                                optIdx === q.correctIndex
                                  ? "bg-emerald-50 text-emerald-900 font-bold border border-emerald-300"
                                  : "text-slate-600 hover:bg-slate-50 border border-slate-100"
                              }`}
                            >
                              <span className="font-bold">{LETTERS[optIdx]}.</span>
                              <span>{opt}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Part 2: True/False 4 Statements Moderation */}
                      {isPart2 && (
                        <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                          <div className="text-[11px] font-bold text-purple-900 mb-1">
                            Duyệt Đúng / Sai cho cả 4 ý:
                          </div>
                          {(q.statements && q.statements.length > 0
                            ? q.statements
                            : [
                                { id: "a", label: "a)", text: "Ý a", correctValue: true },
                                { id: "b", label: "b)", text: "Ý b", correctValue: false },
                                { id: "c", label: "c)", text: "Ý c", correctValue: true },
                                { id: "d", label: "d)", text: "Ý d", correctValue: false },
                              ]
                          ).map((st) => (
                            <div
                              key={st.id}
                              className="flex items-center justify-between gap-2 p-2 bg-white rounded border border-slate-200"
                            >
                              <div className="flex items-start gap-1.5 flex-1">
                                <span className="font-bold text-purple-700">{st.label || `${st.id})`}</span>
                                <span className="text-slate-800">{st.text}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleToggleTrueFalseStatement(q.id, st.id, false)}
                                  className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                                    st.correctValue
                                      ? "bg-emerald-600 text-white shadow-xs"
                                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                  }`}
                                >
                                  Đúng
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleTrueFalseStatement(q.id, st.id, true)}
                                  className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                                    !st.correctValue
                                      ? "bg-rose-600 text-white shadow-xs"
                                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                  }`}
                                >
                                  Sai
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Part 3: Short Answer Input Moderation */}
                      {isPart3 && (
                        <div className="flex items-center gap-2 bg-amber-50/70 p-2.5 rounded-lg border border-amber-200 text-xs">
                          <span className="font-bold text-amber-900 shrink-0">Đáp án số chuẩn:</span>
                          <input
                            type="text"
                            value={q.shortAnswer || ""}
                            onChange={(e) => handleUpdateShortAnswer(q.id, e.target.value)}
                            placeholder="Nhập số đúng (VD: 15.8, 800, 64)..."
                            className="flex-1 px-3 py-1.5 bg-white border border-amber-300 rounded font-mono font-bold text-amber-950 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      )}

                      {q.explanation && (
                        <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded">
                          <strong>Giải thích:</strong> {q.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg"
              >
                Đóng
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleApproveAllAnswers}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
                >
                  <CheckCheck className="w-4 h-4" />
                  Xác Nhận & Hoàn Tất Kiểm Duyệt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Quiz Game Arena Modal */}
      <LiveQuizModal
        isOpen={isLiveQuizModalOpen}
        onClose={() => setIsLiveQuizModalOpen(false)}
        questions={selectedQuestions.length > 0 ? selectedQuestions : []}
        config={config}
      />
    </div>
  );
};
