import React, { useState, useEffect, useRef } from "react";
import {
  Clock,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Flag,
  ChevronLeft,
  ChevronRight,
  Send,
  Lock,
  RotateCcw,
  BookOpen,
  Copy,
  Terminal,
  Zap,
  Eye,
  Info,
  Check,
  X,
  Wifi,
  WifiOff,
  Save,
  Grid,
  Laptop,
  Smartphone,
  School,
  User,
  GraduationCap,
  Download,
  FileCheck,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Calculator,
} from "lucide-react";
import {
  ExamPackage,
  ExamVariant,
  StudentSubmission,
  ViolationLog,
  QuestionTimeRecord,
} from "../../types";
import { LETTERS, gradeSubmission } from "../../utils/examHelpers";
import { FormattedQuestionContent, MathTextRenderer } from "../FormattedQuestionContent";

interface StudentExamRoomProps {
  exam: ExamPackage;
  selectedVariantCode: string;
  studentInfo: {
    name: string;
    studentClass: string;
    school: string;
    grade: string;
    studentId?: string;
  };
  onSubmitExam: (submission: StudentSubmission) => void;
  onExit: () => void;
}

export const StudentExamRoom: React.FC<StudentExamRoomProps> = ({
  exam,
  selectedVariantCode,
  studentInfo,
  onSubmitExam,
  onExit,
}) => {
  // Find Variant
  const variant: ExamVariant =
    exam.variants.find((v) => v.examCode === selectedVariantCode) || exam.variants[0];

  const totalQuestions = variant.questions.length;

  // Active question index (1-based)
  const [currentQIndex, setCurrentQIndex] = useState(1);

  // Student Answers state: { [questionIndex]: number | { [statementId: string]: boolean } | string }
  const [answers, setAnswers] = useState<Record<number, any>>({});

  // Flagged questions for review
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});

  // Time remaining in seconds
  const totalDurationSeconds = (exam.config.duration || 45) * 60;
  const [timeLeft, setTimeLeft] = useState(totalDurationSeconds);

  // --- Per-Question Time Tracking State ---
  const [questionTimes, setQuestionTimes] = useState<Record<number, number>>({});
  const [currentQuestionActiveSeconds, setCurrentQuestionActiveSeconds] = useState(0);

  // --- Anti-Cheating Tracking State ---
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [copyPasteCount, setCopyPasteCount] = useState(0);
  const [devToolsCount, setDevToolsCount] = useState(0);
  const [suspiciousSpeedCount, setSuspiciousSpeedCount] = useState(0);

  const [isLocked, setIsLocked] = useState(false);
  const [violationLogs, setViolationLogs] = useState<ViolationLog[]>([]);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [warningType, setWarningType] = useState<"tab" | "clipboard" | "devtools" | "speed">("tab");

  // Mobile Question Sheet modal
  const [showMobileQuestionSheet, setShowMobileQuestionSheet] = useState(false);

  // Submit confirmation dialog
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

  // Offline Engine State
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<string>("");
  const [savedSuccessFlash, setSavedSuccessFlash] = useState(false);

  // --- Accessibility & Tooling Upgrades ---
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMathKeypad, setShowMathKeypad] = useState(false);

  const startTimeRef = useRef(Date.now());
  const maxViolations = exam.config.maxTabViolations || 3;
  const isWindowActiveRef = useRef(true);

  const storageKey = `eduexam_exam_cache_${exam.id}_${selectedVariantCode}_${studentInfo.name || "guest"}`;

  // Helper: Dịch công thức LaTeX thành lời đọc tiếng Việt tự nhiên
  const cleanLatexForSpeech = (text: string): string => {
    if (!text) return "";
    return text
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, " phân số $1 trên $2 ")
      .replace(/\\sqrt\{([^}]+)\}/g, " căn bậc hai của $1 ")
      .replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, " căn bậc $1 của $2 ")
      .replace(/\\pm/g, " cộng trừ ")
      .replace(/\\times/g, " nhân ")
      .replace(/\\div/g, " chia ")
      .replace(/\\int/g, " tích phân ")
      .replace(/\\pi/g, " pi ")
      .replace(/\\infty/g, " vô cùng ")
      .replace(/\\le|\\leq/g, " nhỏ hơn hoặc bằng ")
      .replace(/\\ge|\\geq/g, " lớn hơn hoặc bằng ")
      .replace(/\\neq/g, " khác ")
      .replace(/\\in/g, " thuộc ")
      .replace(/\\notin/g, " không thuộc ")
      .replace(/\\subset/g, " tập con của ")
      .replace(/\\cup/g, " hợp ")
      .replace(/\\cap/g, " giao ")
      .replace(/\\vec\{([^}]+)\}/g, " vectơ $1 ")
      .replace(/\\alpha/g, " alpha ")
      .replace(/\\beta/g, " bêta ")
      .replace(/\\gamma/g, " gamma ")
      .replace(/\\Delta/g, " delta ")
      .replace(/\\omega/g, " omega ")
      .replace(/\\phi/g, " phi ")
      .replace(/\\theta/g, " têta ")
      .replace(/[$_^{}\\]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  // Text-to-Speech Handler
  const handleToggleSpeech = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Trình duyệt không hỗ trợ Web Speech API.");
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();

    const currQ = variant.questions[currentQIndex - 1];
    if (!currQ) return;

    let textToRead = `Câu ${currentQIndex}: ${cleanLatexForSpeech(currQ.content)}. `;

    if (currQ.part === 1 || currQ.questionType === "multiple_choice") {
      textToRead += "Các phương án lựa chọn: ";
      (currQ.options || []).forEach((opt, idx) => {
        textToRead += `Phương án ${LETTERS[idx]}: ${cleanLatexForSpeech(opt)}. `;
      });
    } else if (currQ.part === 2 || currQ.questionType === "true_false") {
      textToRead += "Các mệnh đề: ";
      (currQ.statements || []).forEach((st: any) => {
        textToRead += `Mệnh đề ${st.label || st.id}: ${cleanLatexForSpeech(st.text)}. `;
      });
    } else if (currQ.part === 3 || currQ.questionType === "short_answer") {
      textToRead += "Yêu cầu: Điền kết quả số học.";
    }

    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.lang = "vi-VN";
    utterance.rate = 0.95;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Fullscreen Handler
  const handleToggleFullscreen = () => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
    };

    document.addEventListener("fullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Stop speech on question change
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [currentQIndex]);

  // Keypad insertion handler for Part III
  const handleInsertMathKeypad = (char: string) => {
    const currentVal = String(answers[currentQIndex] || "");
    if (char === "CLEAR") {
      handleInputShortAnswer(currentQIndex, "");
    } else if (char === "BACKSPACE") {
      handleInputShortAnswer(currentQIndex, currentVal.slice(0, -1));
    } else {
      handleInputShortAnswer(currentQIndex, currentVal + char);
    }
  };

  // 0. Listen to network online / offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // 1. Restore local cache on mount if available
  useEffect(() => {
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.answers) setAnswers(parsed.answers);
        if (parsed.flagged) setFlagged(parsed.flagged);
        if (parsed.timeLeft && parsed.timeLeft > 10) setTimeLeft(parsed.timeLeft);
        if (parsed.questionTimes) setQuestionTimes(parsed.questionTimes);
        if (parsed.currentQIndex) setCurrentQIndex(parsed.currentQIndex);
        if (parsed.tabSwitchCount) setTabSwitchCount(parsed.tabSwitchCount);
        if (parsed.violationLogs) setViolationLogs(parsed.violationLogs);
        if (parsed.lastSaved) setLastSavedTimestamp(parsed.lastSaved);
      }
    } catch (e) {
      console.warn("Could not read local exam cache", e);
    }
  }, [storageKey]);

  // 2. Auto-save to LocalStorage on changes (Works 100% Offline & Online)
  useEffect(() => {
    if (isLocked) return;
    try {
      const nowStr = new Date().toLocaleTimeString("vi-VN");
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          examId: exam.id,
          variantCode: selectedVariantCode,
          studentInfo,
          answers,
          flagged,
          timeLeft,
          questionTimes,
          currentQIndex,
          tabSwitchCount,
          violationLogs,
          lastSaved: nowStr,
        })
      );
      setLastSavedTimestamp(nowStr);
      setSavedSuccessFlash(true);
      const flashTimer = setTimeout(() => setSavedSuccessFlash(false), 1500);
      return () => clearTimeout(flashTimer);
    } catch (e) {}
  }, [answers, flagged, timeLeft, questionTimes, currentQIndex, tabSwitchCount, violationLogs, isLocked, storageKey, studentInfo]);

  // 3. Desktop / Laptop / MacBook Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }

      if (e.key === "ArrowLeft") {
        setCurrentQIndex((prev) => Math.max(1, prev - 1));
      } else if (e.key === "ArrowRight") {
        setCurrentQIndex((prev) => Math.min(totalQuestions, prev + 1));
      } else if (e.key.toLowerCase() === "f") {
        handleToggleFlag(currentQIndex);
      } else if (["1", "2", "3", "4"].includes(e.key)) {
        const optIdx = parseInt(e.key, 10) - 1;
        const currentQ = variant.questions[currentQIndex - 1];
        if (currentQ && (!currentQ.part || currentQ.part === 1)) {
          handleSelectOption(currentQIndex, optIdx);
        }
      } else if (["a", "b", "c", "d"].includes(e.key.toLowerCase())) {
        const map: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };
        const optIdx = map[e.key.toLowerCase()];
        const currentQ = variant.questions[currentQIndex - 1];
        if (currentQ && (!currentQ.part || currentQ.part === 1)) {
          handleSelectOption(currentQIndex, optIdx);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentQIndex, totalQuestions, variant.questions]);

  // 4. Timer Countdown & Question Time Tracker
  useEffect(() => {
    if (isLocked) return;

    const timer = setInterval(() => {
      // Countdown overall exam time
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinalSubmit(true, "Hết thời gian làm bài");
          return 0;
        }
        return prev - 1;
      });

      // Increment active time spent on the current question if tab is in focus
      if (isWindowActiveRef.current) {
        setQuestionTimes((prev) => ({
          ...prev,
          [currentQIndex]: (prev[currentQIndex] || 0) + 1,
        }));
        setCurrentQuestionActiveSeconds((prev) => prev + 1);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isLocked, currentQIndex]);

  // Reset active second counter when jumping between questions
  useEffect(() => {
    setCurrentQuestionActiveSeconds(questionTimes[currentQIndex] || 0);
  }, [currentQIndex]);

  // Helper to add violation log
  const logViolation = (
    type: ViolationLog["type"],
    message: string,
    severity: ViolationLog["severity"] = "medium",
    questionIdx = currentQIndex
  ) => {
    const newLog: ViolationLog = {
      timestamp: new Date().toISOString(),
      type,
      message,
      questionIndex: questionIdx,
      severity,
    };
    setViolationLogs((prev) => [...prev, newLog]);
    return newLog;
  };

  // 5. Anti-Cheating Detector: Tab Switch & Window Blur
  useEffect(() => {
    if (isLocked) return;

    const handleTabViolation = (type: "TAB_SWITCH" | "WINDOW_BLUR") => {
      isWindowActiveRef.current = false;
      setTabSwitchCount((prevCount) => {
        const newCount = prevCount + 1;
        const msg =
          newCount >= maxViolations
            ? `HỆ THỐNG ĐÃ KHÓA BÀI THI DO RỜI KHỎI MÀN HÌNH ${newCount} LẦN`
            : `Rời khỏi màn hình bài thi (Lần ${newCount}/${maxViolations}) tại Câu ${currentQIndex}`;

        const logItem = logViolation(
          type,
          msg,
          newCount >= maxViolations ? "critical" : "high",
          currentQIndex
        );

        if (newCount >= maxViolations) {
          setIsLocked(true);
          setShowWarningModal(false);
          setTimeout(() => {
            handleFinalSubmit(
              true,
              "Bài thi bị khóa do rời màn hình quá số lần quy định",
              newCount,
              copyPasteCount,
              devToolsCount,
              suspiciousSpeedCount,
              [...violationLogs, logItem]
            );
          }, 1500);
        } else {
          setWarningType("tab");
          setWarningMessage(
            `CẢNH BÁO RỜI PHÒNG THI: Bạn vừa chuyển tab/thu nhỏ màn hình! Đây là lần vi phạm thứ ${newCount}/${maxViolations}. Nếu vượt quá ${maxViolations} lần, bài thi sẽ bị TỰ ĐỘNG KHÓA VÀ NỘP VỀ GIÁO VIÊN!`
          );
          setShowWarningModal(true);
        }

        return newCount;
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handleTabViolation("TAB_SWITCH");
      } else {
        isWindowActiveRef.current = true;
      }
    };

    const onBlur = () => {
      isWindowActiveRef.current = false;
      handleTabViolation("WINDOW_BLUR");
    };

    const onFocus = () => {
      isWindowActiveRef.current = true;
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [isLocked, maxViolations, currentQIndex, violationLogs, copyPasteCount, devToolsCount, suspiciousSpeedCount]);

  // Simulation controls for testing
  const triggerTabViolation = () => {
    if (isLocked) return;
    setTabSwitchCount((prevCount) => {
      const newCount = prevCount + 1;
      const msg =
        newCount >= maxViolations
          ? `HỆ THỐNG ĐÃ KHÓA BÀI THI DO RỜI KHỎI MÀN HÌNH ${newCount} LẦN`
          : `Rời khỏi màn hình bài thi (Lần ${newCount}/${maxViolations}) tại Câu ${currentQIndex}`;

      const logItem = logViolation(
        "TAB_SWITCH",
        msg,
        newCount >= maxViolations ? "critical" : "high",
        currentQIndex
      );

      if (newCount >= maxViolations) {
        setIsLocked(true);
        setShowWarningModal(false);
        setTimeout(() => {
          handleFinalSubmit(
            true,
            "Bài thi bị khóa do rời màn hình quá số lần quy định",
            newCount,
            copyPasteCount,
            devToolsCount,
            suspiciousSpeedCount,
            [...violationLogs, logItem]
          );
        }, 1500);
      } else {
        setWarningType("tab");
        setWarningMessage(
          `CẢNH BÁO RỜI PHÒNG THI: Bạn vừa chuyển tab/thu nhỏ màn hình! Đây là lần vi phạm thứ ${newCount}/${maxViolations}. Nếu vượt quá ${maxViolations} lần, bài thi sẽ bị TỰ ĐỘNG KHÓA VÀ NỘP VỀ GIÁO VIÊN!`
        );
        setShowWarningModal(true);
      }

      return newCount;
    });
  };

  const triggerCopyPasteViolation = () => {
    if (isLocked) return;
    setCopyPasteCount((prev) => {
      const newCount = prev + 1;
      logViolation(
        "COPY_PASTE_ATTEMPT",
        `Phát hiện cố tình sao chép câu hỏi tại Câu ${currentQIndex} (Lần ${newCount})`,
        "medium",
        currentQIndex
      );
      setWarningType("clipboard");
      setWarningMessage(
        `CẢNH BÁO SAO CHÉP: Hành vi sao chép / dán nội dung đề thi đã bị ghi lại vào nhật ký giám sát!`
      );
      setShowWarningModal(true);
      return newCount;
    });
  };

  const triggerDevToolsViolation = () => {
    if (isLocked) return;
    setDevToolsCount((prev) => {
      const newCount = prev + 1;
      logViolation(
        "DEVTOOLS_ATTEMPT",
        `Phát hiện cố tình mở công cụ lập trình F12 / DevTools (Lần ${newCount})`,
        "high",
        currentQIndex
      );
      setWarningType("devtools");
      setWarningMessage(
        `CẢNH BÁO CÔNG CỤ F12: Thí sinh cố tình mở công cụ nhà phát triển để xem mã nguồn hoặc can thiệp bài thi!`
      );
      setShowWarningModal(true);
      return newCount;
    });
  };

  const triggerFastAnswerViolation = () => {
    if (isLocked) return;
    setSuspiciousSpeedCount((prev) => {
      const newCount = prev + 1;
      logViolation(
        "SUSPICIOUS_SPEED",
        `Trả lời quá nhanh (< 3 giây) tại Câu ${currentQIndex}`,
        "low",
        currentQIndex
      );
      handleSelectOption(currentQIndex, 0);
      return newCount;
    });
  };

  // Option select handler
  const handleSelectOption = (qIndex: number, optionIndex: number) => {
    if (isLocked) return;
    const spentOnThisQ = questionTimes[qIndex] || 0;
    if (spentOnThisQ < 3 && answers[qIndex] === undefined) {
      setSuspiciousSpeedCount((prev) => {
        const nc = prev + 1;
        logViolation(
          "SUSPICIOUS_SPEED",
          `Trả lời câu hỏi ${qIndex} trong ${spentOnThisQ}s (dưới 3s)`,
          "low",
          qIndex
        );
        return nc;
      });
    }

    setAnswers((prev) => ({
      ...prev,
      [qIndex]: optionIndex,
    }));
  };

  // True/False select handler
  const handleSelectTrueFalse = (qIndex: number, statementId: string, value: boolean) => {
    if (isLocked) return;
    setAnswers((prev) => {
      const existing = typeof prev[qIndex] === "object" && prev[qIndex] !== null ? prev[qIndex] : {};
      return {
        ...prev,
        [qIndex]: {
          ...existing,
          [statementId]: value,
        },
      };
    });
  };

  // Short Answer input handler
  const handleInputShortAnswer = (qIndex: number, text: string) => {
    if (isLocked) return;
    setAnswers((prev) => ({
      ...prev,
      [qIndex]: text,
    }));
  };

  // Clear Answer
  const handleClearAnswer = (qIndex: number) => {
    if (isLocked) return;
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[qIndex];
      return next;
    });
  };

  // Toggle Flag
  const handleToggleFlag = (qIndex: number) => {
    setFlagged((prev) => ({
      ...prev,
      [qIndex]: !prev[qIndex],
    }));
  };

  // Final Submit Handler (supports online and offline storage)
  const handleFinalSubmit = (
    locked = false,
    reason?: string,
    overrideTabCount?: number,
    overrideCopyCount?: number,
    overrideDevToolsCount?: number,
    overrideSpeedCount?: number,
    overrideLogs?: ViolationLog[]
  ) => {
    const finalTabCount = overrideTabCount ?? tabSwitchCount;
    const finalCopyCount = overrideCopyCount ?? copyPasteCount;
    const finalDevCount = overrideDevToolsCount ?? devToolsCount;
    const finalSpeedCount = overrideSpeedCount ?? suspiciousSpeedCount;
    const finalLogs = overrideLogs ?? violationLogs;

    // Grade submission using standard BGD regulations
    const graded = gradeSubmission(answers, variant, exam.config.subject || "Toán học");
    const durationTakenSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);

    const questionTimeRecords: QuestionTimeRecord[] = variant.questions.map((q) => {
      const spent = questionTimes[q.questionIndex] || 0;
      return {
        questionIndex: q.questionIndex,
        secondsSpent: spent,
        isSuspiciouslyFast: spent < 3 && answers[q.questionIndex] !== undefined,
        isAbnormallySlow: spent > 300,
        answeredAt: new Date().toISOString(),
      };
    });

    const submission: StudentSubmission = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      examId: exam.id,
      examTitle: exam.title,
      examPeriod: exam.config.examPeriod,
      examCode: variant.examCode,
      studentName: studentInfo.name,
      studentClass: studentInfo.studentClass,
      school: studentInfo.school || exam.config.school,
      grade: studentInfo.grade || exam.config.grade,
      studentId: studentInfo.studentId || `SBD-${Math.floor(1000 + Math.random() * 9000)}`,
      startedAt: new Date(startTimeRef.current).toISOString(),
      submittedAt: new Date().toISOString(),
      durationTakenSeconds,
      answers,
      correctCount: graded.correctCount,
      wrongCount: graded.wrongCount,
      unansweredCount: graded.unansweredCount,
      totalQuestions,
      score: graded.score,
      maxScore: 10.0,
      part1Score: graded.part1Score,
      part2Score: graded.part2Score,
      part3Score: graded.part3Score,
      detailedResults: graded.detailedResults,
      isLockedDueToCheating: locked || finalTabCount >= maxViolations,
      tabSwitchCount: finalTabCount,
      copyPasteCount: finalCopyCount,
      devToolsCount: finalDevCount,
      suspiciousSpeedCount: finalSpeedCount,
      questionTimes,
      questionTimeRecords,
      violationLogs: finalLogs,
      syncedToGoogleSheet: isOnline,
      status: locked || finalTabCount >= maxViolations ? "locked" : "submitted",
    };

    // Save submission to local backup queue
    try {
      const existingQueue = JSON.parse(localStorage.getItem("eduexam_offline_submissions") || "[]");
      existingQueue.unshift(submission);
      localStorage.setItem("eduexam_offline_submissions", JSON.stringify(existingQueue.slice(0, 50)));
      localStorage.removeItem(storageKey); // Clear progress cache once submitted
    } catch (e) {}

    onSubmitExam(submission);
  };

  // Check if question is answered
  const isQuestionAnswered = (q: any, qIdx: number) => {
    const ans = answers[qIdx];
    if (ans === undefined || ans === null || ans === "") return false;
    if (q.part === 2 || q.questionType === "true_false") {
      return typeof ans === "object" && Object.keys(ans).length > 0;
    }
    return true;
  };

  // Progress metrics
  const answeredCount = variant.questions.filter((q) => isQuestionAnswered(q, q.questionIndex)).length;
  const currentQuestion = variant.questions[currentQIndex - 1];

  // Format Time
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isTimeRunningLow = timeLeft < 300;
  const currentQSeconds = questionTimes[currentQIndex] || 0;

  return (
    <div
      className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-3 space-y-4 select-none pb-24 lg:pb-6"
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onPaste={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 1. TOP STUDENT IDENTITY & STATUS BANNER (Trường, Lớp, Họ và tên, SBD) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-4 sm:p-5 shadow-lg border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Student Profile Info */}
        <div className="space-y-1.5 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <User className="w-3 h-3" />
              <span>HỌC SINH THI CHÍNH THỨC</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              MÃ ĐỀ: {variant.examCode}
            </span>
            {isOnline ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Wifi className="w-3 h-3" />
                <span>Trực Tuyến</span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 animate-pulse">
                <WifiOff className="w-3 h-3" />
                <span>Ngoại Tuyến (Offline Auto-Saved)</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
            <div className="bg-white/10 backdrop-blur rounded-xl p-2 border border-white/10">
              <span className="text-[10px] text-slate-300 block">Họ và Tên:</span>
              <strong className="text-white font-bold text-xs sm:text-sm truncate block">
                {studentInfo.name || "Thí sinh"}
              </strong>
            </div>

            <div className="bg-white/10 backdrop-blur rounded-xl p-2 border border-white/10">
              <span className="text-[10px] text-slate-300 block">Lớp:</span>
              <strong className="text-emerald-300 font-bold text-xs sm:text-sm truncate block">
                {studentInfo.studentClass || "12A1"}
              </strong>
            </div>

            <div className="bg-white/10 backdrop-blur rounded-xl p-2 border border-white/10">
              <span className="text-[10px] text-slate-300 block">Trường:</span>
              <strong className="text-indigo-200 font-bold text-xs truncate block" title={studentInfo.school}>
                {studentInfo.school || exam.config.school || "THPT Chuyên"}
              </strong>
            </div>

            <div className="bg-white/10 backdrop-blur rounded-xl p-2 border border-white/10">
              <span className="text-[10px] text-slate-300 block">Số Báo Danh (SBD):</span>
              <strong className="text-amber-300 font-mono font-bold text-xs sm:text-sm truncate block">
                {studentInfo.studentId || "SBD-12058"}
              </strong>
            </div>
          </div>
        </div>

        {/* Action / Countdown Clock & Submit Button */}
        <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-700">
          {/* Fullscreen Proctoring Button */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-slate-200 border border-white/15 transition-all text-xs font-bold flex items-center gap-1.5 min-h-[44px]"
            title={isFullscreen ? "Thu nhỏ cửa sổ" : "Bật toàn màn hình (Phòng thi nghiêm ngặt)"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-amber-300" />
            ) : (
              <Maximize2 className="w-4 h-4 text-emerald-400" />
            )}
            <span className="hidden sm:inline">
              {isFullscreen ? "Thu nhỏ" : "Toàn Màn Hình"}
            </span>
          </button>

          {/* Time Remaining Clock */}
          <div
            className={`px-4 py-2 rounded-2xl border flex items-center space-x-2 font-mono text-sm font-bold shadow-sm ${
              isTimeRunningLow
                ? "bg-rose-500/20 border-rose-400 text-rose-300 animate-pulse"
                : "bg-black/40 text-amber-300 border-amber-400/30"
            }`}
          >
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-base sm:text-lg">
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </span>
          </div>

          {/* Submit Exam Button */}
          <button
            type="button"
            id="btn-submit-exam"
            onClick={() => setShowConfirmSubmit(true)}
            disabled={isLocked}
            className="px-4 sm:px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-40 text-white text-xs sm:text-sm font-bold rounded-2xl shadow-lg shadow-emerald-600/30 transition-all flex items-center space-x-1.5 min-h-[44px]"
          >
            <Send className="w-4 h-4" />
            <span>Nộp Bài</span>
          </button>
        </div>
      </div>

      {/* 2. Device Helper & Auto-Save Status Bar */}
      <div className="flex flex-wrap items-center justify-between text-xs px-2 text-slate-500 gap-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 font-medium">
            <Save className={`w-3.5 h-3.5 ${savedSuccessFlash ? "text-emerald-600" : "text-slate-400"}`} />
            <span>Tự động lưu: {lastSavedTimestamp ? `lúc ${lastSavedTimestamp}` : "Liên tục trên thiết bị"}</span>
          </span>
          <span>•</span>
          <span className="hidden sm:inline text-indigo-600 font-semibold flex items-center gap-1">
            <Laptop className="w-3.5 h-3.5" />
            <span>Phím tắt: A/B/C/D chọn đáp án, Mũi tên Trái/Phải chuyển câu, F đặt cờ</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile open question matrix sheet button */}
          <button
            type="button"
            onClick={() => setShowMobileQuestionSheet(true)}
            className="lg:hidden px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 border border-indigo-200"
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Ma trận câu ({answeredCount}/{totalQuestions})</span>
          </button>

          <span className="font-bold text-slate-700">
            Tiến độ: {answeredCount}/{totalQuestions} câu ({Math.round((answeredCount / totalQuestions) * 100)}%)
          </span>
        </div>
      </div>

      {/* 3. Anti-Cheat Monitoring Status */}
      <div className="bg-slate-900 text-white rounded-2xl p-3.5 sm:p-4 border border-indigo-500/30 shadow-md space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-bold text-xs text-emerald-300">
              Giám Sát Chống Gian Lận (Tối đa {maxViolations} lần rời tab):
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`px-2 py-0.5 rounded-lg font-mono font-bold border ${
              tabSwitchCount > 0 ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-slate-800 text-slate-300 border-slate-700"
            }`}>
              Rời tab: {tabSwitchCount}/{maxViolations}
            </span>
            <span className={`px-2 py-0.5 rounded-lg font-mono font-bold border ${
              copyPasteCount > 0 ? "bg-rose-500/20 text-rose-300 border-rose-500/40" : "bg-slate-800 text-slate-300 border-slate-700"
            }`}>
              Copy/Paste: {copyPasteCount}
            </span>
            <span className={`px-2 py-0.5 rounded-lg font-mono font-bold border ${
              devToolsCount > 0 ? "bg-purple-500/20 text-purple-300 border-purple-500/40" : "bg-slate-800 text-slate-300 border-slate-700"
            }`}>
              DevTools: {devToolsCount}
            </span>
          </div>
        </div>

        {/* Quick Testing buttons for simulation */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
          <span className="text-slate-400">Thử nghiệm phản hồi chống gian lận:</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={triggerTabViolation}
              className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded border border-amber-500/40 font-bold"
            >
              Thử Chuyển Tab
            </button>
            <button
              type="button"
              onClick={triggerCopyPasteViolation}
              className="px-2 py-0.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded border border-rose-500/40 font-bold"
            >
              Thử Copy
            </button>
            <button
              type="button"
              onClick={triggerDevToolsViolation}
              className="px-2 py-0.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded border border-purple-500/40 font-bold"
            >
              Thử F12
            </button>
          </div>
        </div>
      </div>

      {/* 4. Locked Overlay if Cheating Threshold Exceeded */}
      {isLocked && (
        <div className="bg-rose-600 text-white p-6 rounded-2xl shadow-xl text-center space-y-3 animate-fade-in">
          <Lock className="w-12 h-12 mx-auto text-rose-200" />
          <h2 className="text-xl font-extrabold uppercase tracking-wide">
            BÀI THI ĐÃ BỊ KHÓA DO VI PHẠM QUY CHẾ THI!
          </h2>
          <p className="text-xs text-rose-100 max-w-lg mx-auto leading-relaxed">
            Bạn đã rời khỏi màn hình làm bài / chuyển tab quá {maxViolations} lần hoặc vi phạm quy chế
            chống gian lận. Toàn bộ nhật ký vi phạm đã được chuyển về giáo viên để xử lý.
          </p>
        </div>
      )}

      {/* 5. Main Exam Grid (Responsive for all device screens) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Current Question Display */}
        <div className="lg:col-span-8 space-y-4">
          {currentQuestion && (
            <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-xs space-y-6">
              {/* Question Header & Part Badge */}
              <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 text-xs gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold text-sm sm:text-base text-indigo-700">
                    CÂU HỎI {currentQIndex} / {totalQuestions}
                  </span>

                  {/* Part Badge */}
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    currentQuestion.part === 2
                      ? "bg-purple-50 text-purple-700 border-purple-200"
                      : currentQuestion.part === 3
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : "bg-blue-50 text-blue-700 border-blue-200"
                  }`}>
                    {currentQuestion.part === 2
                      ? "PHẦN II: Đúng / Sai (4 ý)"
                      : currentQuestion.part === 3
                      ? "PHẦN III: Trả lời ngắn"
                      : "PHẦN I: Trắc nghiệm 4 lựa chọn"}
                  </span>

                  {currentQuestion.level && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                      {currentQuestion.level}
                    </span>
                  )}

                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-100 text-slate-600">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{currentQSeconds}s</span>
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  {/* TTS Voice Reader Button */}
                  <button
                    type="button"
                    onClick={handleToggleSpeech}
                    className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isSpeaking
                        ? "bg-rose-600 text-white animate-pulse shadow-xs"
                        : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200"
                    }`}
                    title="Đọc câu hỏi và đáp án bằng giọng nói trợ năng"
                  >
                    {isSpeaking ? (
                      <VolumeX className="w-3.5 h-3.5" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                    <span>{isSpeaking ? "Dừng Đọc" : "Đọc Đề (TTS)"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleFlag(currentQIndex)}
                    className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      flagged[currentQIndex]
                        ? "bg-amber-500 text-white font-bold shadow-xs"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>{flagged[currentQIndex] ? "Đã Đặt Cờ (F)" : "Đặt Cờ (F)"}</span>
                  </button>
                </div>
              </div>

              {/* Question Content (With KaTeX Formula Renderer) */}
              <div className="text-slate-900 text-sm sm:text-base leading-relaxed font-medium">
                <FormattedQuestionContent content={currentQuestion.content} />
              </div>

              {/* ----------------- DẠNG 1: TRẮC NGHIỆM 4 LỰA CHỌN (PHẦN I) ----------------- */}
              {(!currentQuestion.part || currentQuestion.part === 1 || currentQuestion.questionType === "multiple_choice") && (
                <div className="space-y-3 pt-2">
                  {currentQuestion.options?.map((opt, optIdx) => {
                    const isSelected = answers[currentQIndex] === optIdx;
                    return (
                      <div
                        key={optIdx}
                        onClick={() => handleSelectOption(currentQIndex, optIdx)}
                        className={`p-3.5 sm:p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center space-x-3 text-xs sm:text-sm select-none min-h-[48px] ${
                          isSelected
                            ? "bg-indigo-50/90 border-indigo-600 text-indigo-950 font-semibold shadow-xs"
                            : "bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-800 hover:bg-white"
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 transition-colors ${
                            isSelected
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {LETTERS[optIdx]}
                        </div>
                        <span className="flex-1 text-slate-800 leading-relaxed">
                          <MathTextRenderer text={opt} />
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ----------------- DẠNG 2: TRẮC NGHIỆM ĐÚNG / SAI 4 Ý (PHẦN II) ----------------- */}
              {(currentQuestion.part === 2 || currentQuestion.questionType === "true_false") && (
                <div className="space-y-3 pt-2">
                  <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl text-xs text-purple-900 flex items-center justify-between">
                    <span className="font-semibold">Quy định chấm điểm Bộ GD&ĐT:</span>
                    <span className="text-[11px] text-purple-700 font-mono">1 ý: 0.1đ | 2 ý: 0.25đ | 3 ý: 0.5đ | 4 ý: 1.0đ</span>
                  </div>

                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                    {(currentQuestion.statements || [
                      { id: "a", label: "a)", text: "Mệnh đề a" },
                      { id: "b", label: "b)", text: "Mệnh đề b" },
                      { id: "c", label: "c)", text: "Mệnh đề c" },
                      { id: "d", label: "d)", text: "Mệnh đề d" },
                    ]).map((stmt: any) => {
                      const stmtAns = answers[currentQIndex]?.[stmt.id];
                      return (
                        <div key={stmt.id} className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white transition-colors">
                          <div className="flex items-start space-x-2 flex-1">
                            <span className="font-bold text-indigo-700 shrink-0 text-sm">{stmt.label || `${stmt.id})`}</span>
                            <span className="text-xs sm:text-sm text-slate-800 leading-relaxed"><MathTextRenderer text={stmt.text} /></span>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                            {/* Button ĐÚNG */}
                            <button
                              type="button"
                              onClick={() => handleSelectTrueFalse(currentQIndex, stmt.id, true)}
                              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all min-h-[40px] ${
                                stmtAns === true
                                  ? "bg-emerald-600 text-white shadow-xs"
                                  : "bg-white border border-slate-300 text-slate-700 hover:bg-emerald-50 hover:border-emerald-400"
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>ĐÚNG</span>
                            </button>

                            {/* Button SAI */}
                            <button
                              type="button"
                              onClick={() => handleSelectTrueFalse(currentQIndex, stmt.id, false)}
                              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all min-h-[40px] ${
                                stmtAns === false
                                  ? "bg-rose-600 text-white shadow-xs"
                                  : "bg-white border border-slate-300 text-slate-700 hover:bg-rose-50 hover:border-rose-400"
                              }`}
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>SAI</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ----------------- DẠNG 3: TRẮC NGHIỆM TRẢ LỜI NGẮN (PHẦN III) ----------------- */}
              {(currentQuestion.part === 3 || currentQuestion.questionType === "short_answer") && (() => {
                const currentVal = (answers[currentQIndex] || "").trim();
                const chars = [currentVal[0] || "", currentVal[1] || "", currentVal[2] || "", currentVal[3] || ""];

                const handleSetColChar = (colIdx: number, char: string) => {
                  const newChars = [...chars];
                  if (newChars[colIdx] === char) {
                    newChars[colIdx] = "";
                  } else {
                    newChars[colIdx] = char;
                  }
                  const joined = newChars.join("").trim();
                  handleInputShortAnswer(currentQIndex, joined);
                };

                return (
                  <div className="space-y-4 pt-2">
                    <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-1.5 text-xs text-amber-900">
                      <p className="font-bold flex items-center gap-1.5 text-amber-950">
                        <span>📝 Quy định tô phiếu Trả lời ngắn (Phần III - Chuẩn Bộ GD&ĐT):</span>
                      </p>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        Thí sinh điền kết quả vào <strong>4 ô vuông</strong> từ trái sang phải, sau đó tô ô tròn tương ứng ở cột phía dưới (Gồm các chữ số <code>0–9</code>, dấu âm <code>-</code> ở cột 1 và dấu phẩy <code>,</code> ở các cột 2, 3, 4).
                      </p>
                    </div>

                    <div className="flex flex-col lg:flex-row items-start gap-6">
                      {/* Left: Interactive 4-Box Write-in and 4-Column OMR Matrix */}
                      <div className="p-4 bg-white rounded-2xl border-2 border-indigo-200 shadow-sm max-w-sm w-full mx-auto space-y-3">
                        <div className="text-center font-bold text-xs text-indigo-950 uppercase tracking-wide border-b border-slate-100 pb-2">
                          Mô Phỏng Phiếu Tô Bộ GD&ĐT (Câu {currentQIndex + 1})
                        </div>

                        {/* 4 Write-in Boxes */}
                        <div className="grid grid-cols-4 gap-2 text-center">
                          {[0, 1, 2, 3].map((colIdx) => (
                            <div
                              key={colIdx}
                              className={`h-11 rounded-xl border-2 font-mono text-xl font-black flex items-center justify-center transition-all ${
                                chars[colIdx]
                                  ? "border-indigo-600 bg-indigo-50/60 text-indigo-950 shadow-xs"
                                  : "border-slate-300 bg-slate-50 text-slate-400"
                              }`}
                            >
                              {chars[colIdx] || ""}
                            </div>
                          ))}
                        </div>

                        {/* OMR Column Bubbles */}
                        <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-100">
                          {/* Row for Signs: Col 1 has '-', Col 2,3,4 have ',' */}
                          {[0, 1, 2, 3].map((colIdx) => {
                            const sign = colIdx === 0 ? "-" : ",";
                            const isSelected = chars[colIdx] === sign;
                            return (
                              <div key={`sign-${colIdx}`} className="text-center py-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleSetColChar(colIdx, sign)}
                                  className={`w-7 h-7 rounded-full font-bold text-xs border transition-all mx-auto flex items-center justify-center ${
                                    isSelected
                                      ? "bg-slate-900 text-white border-slate-900 shadow-xs scale-105"
                                      : "border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 text-slate-700 bg-white"
                                  }`}
                                  title={`Tô dấu ${sign} ở ô ${colIdx + 1}`}
                                >
                                  {sign}
                                </button>
                              </div>
                            );
                          })}

                          {/* Rows for digits 0 to 9 */}
                          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                            <React.Fragment key={`digit-row-${digit}`}>
                              {[0, 1, 2, 3].map((colIdx) => {
                                const isSelected = chars[colIdx] === String(digit);
                                return (
                                  <div key={`digit-${digit}-${colIdx}`} className="text-center py-0.5">
                                    <button
                                      type="button"
                                      onClick={() => handleSetColChar(colIdx, String(digit))}
                                      className={`w-7 h-7 rounded-full font-bold text-xs border transition-all mx-auto flex items-center justify-center ${
                                        isSelected
                                          ? "bg-slate-900 text-white border-slate-900 shadow-xs scale-105"
                                          : "border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 text-slate-700 bg-white"
                                      }`}
                                      title={`Tô số ${digit} ở ô ${colIdx + 1}`}
                                    >
                                      {digit}
                                    </button>
                                  </div>
                                );
                              })}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>

                      {/* Right: Quick keyboard & Direct input */}
                      <div className="flex-1 w-full space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">
                            Hoặc Nhập trực tiếp từ bàn phím:
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              maxLength={4}
                              value={answers[currentQIndex] || ""}
                              onChange={(e) => handleInputShortAnswer(currentQIndex, e.target.value.slice(0, 4))}
                              placeholder="VD: -1.5, 2.75, 800..."
                              className="w-full px-4 py-3 bg-white border-2 border-indigo-300 rounded-2xl font-mono text-lg font-bold text-indigo-950 focus:outline-hidden focus:border-indigo-600 shadow-xs"
                            />
                            {answers[currentQIndex] && (
                              <button
                                type="button"
                                onClick={() => handleClearAnswer(currentQIndex)}
                                className="px-3 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-xs font-semibold whitespace-nowrap min-h-[48px]"
                              >
                                Xóa Trắng
                              </button>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowMathKeypad((prev) => !prev)}
                          className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            showMathKeypad
                              ? "bg-indigo-600 text-white shadow-xs"
                              : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200"
                          }`}
                        >
                          <Calculator className="w-4 h-4" />
                          <span>{showMathKeypad ? "Ẩn Bàn Phím Số Ảo" : "Hiện Bàn Phím Số Ảo (Tùy chọn)"}</span>
                        </button>

                        {/* Virtual Math Keypad */}
                        {showMathKeypad && (
                          <div className="p-3 bg-slate-900 text-white rounded-2xl border border-indigo-500/40 shadow-xl space-y-2 animate-scale-in">
                            <div className="grid grid-cols-4 gap-1.5">
                              {["7", "8", "9", "-"].map((k) => (
                                <button
                                  key={k}
                                  type="button"
                                  onClick={() => handleInsertMathKeypad(k)}
                                  className="py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 text-white rounded-lg font-mono text-sm font-bold transition-colors"
                                >
                                  {k}
                                </button>
                              ))}
                              {["4", "5", "6", ","].map((k) => (
                                <button
                                  key={k}
                                  type="button"
                                  onClick={() => handleInsertMathKeypad(k)}
                                  className="py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 text-white rounded-lg font-mono text-sm font-bold transition-colors"
                                >
                                  {k}
                                </button>
                              ))}
                              {["1", "2", "3", "."].map((k) => (
                                <button
                                  key={k}
                                  type="button"
                                  onClick={() => handleInsertMathKeypad(k)}
                                  className="py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 text-white rounded-lg font-mono text-sm font-bold transition-colors"
                                >
                                  {k}
                                </button>
                              ))}
                              {["0", "BACKSPACE", "CLEAR"].map((k) => (
                                <button
                                  key={k}
                                  type="button"
                                  onClick={() => handleInsertMathKeypad(k)}
                                  className={`py-2.5 rounded-lg font-mono font-bold transition-colors ${
                                    k === "0"
                                      ? "col-span-2 bg-slate-800 hover:bg-slate-700 text-white text-sm"
                                      : k === "BACKSPACE"
                                      ? "bg-amber-600 hover:bg-amber-700 text-white text-xs"
                                      : "bg-rose-600 hover:bg-rose-700 text-white text-xs"
                                  }`}
                                >
                                  {k === "0" ? "0" : k === "BACKSPACE" ? "⌫ Xóa" : "AC Hết"}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Navigation Prev / Next Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCurrentQIndex((prev) => Math.max(1, prev - 1))}
                  disabled={currentQIndex === 1}
                  className="inline-flex items-center space-x-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-2xl text-xs sm:text-sm font-bold transition-colors min-h-[44px]"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Câu Trước</span>
                </button>

                <div className="text-xs text-slate-500 font-medium hidden sm:block">
                  {isQuestionAnswered(currentQuestion, currentQIndex) ? (
                    <span className="text-emerald-700 font-bold flex items-center space-x-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Đã làm câu này</span>
                    </span>
                  ) : (
                    <span className="text-slate-400">Chưa làm câu này</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentQIndex((prev) => Math.min(totalQuestions, prev + 1))}
                  disabled={currentQIndex === totalQuestions}
                  className="inline-flex items-center space-x-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-2xl text-xs sm:text-sm font-bold transition-colors shadow-xs min-h-[44px]"
                >
                  <span>Câu Sau</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Question Navigator (Desktop & Tablet) */}
        <div className="hidden lg:block lg:col-span-4 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4 sticky top-20">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                Bảng Điều Hướng Câu Hỏi
              </h3>
              <span className="text-xs font-bold text-indigo-700">
                Đã làm: {answeredCount} / {totalQuestions}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Còn lại: {totalQuestions - answeredCount} câu</span>
                <span>{Math.round((answeredCount / totalQuestions) * 100)}% hoàn thành</span>
              </div>
            </div>

            {/* Question Quick Jump Grid */}
            <div className="space-y-3 pt-2 max-h-[60vh] overflow-y-auto pr-1">
              {[1, 2, 3].map((partNum) => {
                const partQuestions = variant.questions.filter((q) => (q.part || 1) === partNum);
                if (partQuestions.length === 0) return null;

                const partLabel =
                  partNum === 1
                    ? `PHẦN I: Trắc nghiệm (${partQuestions.length} câu)`
                    : partNum === 2
                    ? `PHẦN II: Đúng / Sai (${partQuestions.length} câu)`
                    : `PHẦN III: Trả lời ngắn (${partQuestions.length} câu)`;

                return (
                  <div key={partNum} className="space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {partLabel}
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {partQuestions.map((q) => {
                        const qIdx = q.questionIndex;
                        const isAns = isQuestionAnswered(q, qIdx);
                        const isCurrent = currentQIndex === qIdx;
                        const isFlg = flagged[qIdx];
                        const qTime = questionTimes[qIdx] || 0;

                        return (
                          <button
                            key={qIdx}
                            type="button"
                            onClick={() => setCurrentQIndex(qIdx)}
                            className={`h-11 rounded-2xl font-bold text-xs relative flex flex-col items-center justify-center transition-all ${
                              isCurrent
                                ? "ring-2 ring-indigo-600 ring-offset-2 bg-indigo-600 text-white font-extrabold shadow-md"
                                : isAns
                                ? "bg-indigo-50 text-indigo-800 border border-indigo-300 font-bold"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            <span>{qIdx}</span>
                            <span className="text-[9px] opacity-70 font-mono leading-none mt-0.5">
                              {qTime}s
                            </span>
                            {isFlg && (
                              <span className="w-2 h-2 rounded-full bg-amber-500 absolute top-1.5 right-1.5" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
              <div className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 rounded-lg bg-indigo-600" />
                <span>Đang làm</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 rounded-lg bg-indigo-100 border border-indigo-300" />
                <span>Đã trả lời</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 rounded-lg bg-slate-100" />
                <span>Chưa làm</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <span>Đặt cờ</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Mobile Floating Bottom Bar (For iPhone/Android/Smartphones) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 shadow-2xl flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setCurrentQIndex((prev) => Math.max(1, prev - 1))}
          disabled={currentQIndex === 1}
          className="p-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 rounded-xl text-slate-700 text-xs font-bold"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => setShowMobileQuestionSheet(true)}
          className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
        >
          <Grid className="w-4 h-4 text-emerald-400" />
          <span>
            Câu {currentQIndex}/{totalQuestions} ({answeredCount} đã làm)
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleToggleFlag(currentQIndex)}
          className={`p-2.5 rounded-xl text-xs font-bold ${
            flagged[currentQIndex] ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-700"
          }`}
        >
          <Flag className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => setCurrentQIndex((prev) => Math.min(totalQuestions, prev + 1))}
          disabled={currentQIndex === totalQuestions}
          className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 text-white rounded-xl text-xs font-bold"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* 7. Mobile Question Navigator Drawer / Modal */}
      {showMobileQuestionSheet && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-5 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Danh Sách Câu Hỏi</h3>
                <p className="text-xs text-slate-500">Đã trả lời {answeredCount}/{totalQuestions} câu</p>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileQuestionSheet(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {variant.questions.map((q) => {
                const qIdx = q.questionIndex;
                const isAns = isQuestionAnswered(q, qIdx);
                const isCurrent = currentQIndex === qIdx;
                const isFlg = flagged[qIdx];

                return (
                  <button
                    key={qIdx}
                    type="button"
                    onClick={() => {
                      setCurrentQIndex(qIdx);
                      setShowMobileQuestionSheet(false);
                    }}
                    className={`h-12 rounded-2xl font-bold text-xs relative flex flex-col items-center justify-center ${
                      isCurrent
                        ? "bg-indigo-600 text-white font-extrabold shadow-md"
                        : isAns
                        ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    <span>{qIdx}</span>
                    {isFlg && (
                      <span className="w-2 h-2 rounded-full bg-amber-500 absolute top-1.5 right-1.5" />
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowMobileQuestionSheet(false)}
              className="w-full py-3 bg-slate-900 text-white rounded-2xl font-bold text-xs"
            >
              Đóng & Tiếp Tục Làm Bài
            </button>
          </div>
        </div>
      )}

      {/* 8. Warning Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl border border-rose-200 animate-scale-in">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shadow-lg shadow-rose-100">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900 uppercase">
                {warningType === "tab"
                  ? "CẢNH BÁO RỜI MÀN HÌNH THI!"
                  : warningType === "clipboard"
                  ? "CẢNH BÁO SAO CHÉP / DÁN!"
                  : warningType === "devtools"
                  ? "CẢNH BÁO PHÍM TẮT / DEVTOOLS!"
                  : "CẢNH BÁO GIAN LẬN!"}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">{warningMessage}</p>
            </div>

            {warningType === "tab" && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 font-medium">
                Số lần rời màn hình: <strong>{tabSwitchCount} / {maxViolations}</strong>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowWarningModal(false)}
              className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold shadow-md transition-colors"
            >
              Tôi Đã Hiểu & Quay Lại Làm Bài Ngay
            </button>
          </div>
        </div>
      )}

      {/* 9. Submit Confirmation Dialog */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Send className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-slate-900">Xác Nhận Nộp Bài Thi?</h3>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-left space-y-1">
                <p>Thí sinh: <strong>{studentInfo.name}</strong> ({studentInfo.studentClass})</p>
                <p>Trường: <strong>{studentInfo.school}</strong></p>
                <p>Số Báo Danh: <strong>{studentInfo.studentId || "SBD-12058"}</strong></p>
                <p className="text-indigo-700 font-bold">
                  Đã làm: {answeredCount} / {totalQuestions} câu hỏi
                </p>
              </div>

              {totalQuestions - answeredCount > 0 && (
                <p className="text-xs text-rose-600 font-semibold">
                  Chú ý: Bạn còn {totalQuestions - answeredCount} câu chưa trả lời!
                </p>
              )}

              {!isOnline && (
                <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded-xl font-medium">
                  Thiết bị đang Ngoại tuyến (Offline). Kết quả sẽ được lưu và chấm an toàn ngay trên máy của bạn.
                </p>
              )}
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmSubmit(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-semibold"
              >
                Tiếp Tục Làm Bài
              </button>
              <button
                type="button"
                id="btn-confirm-final-submit"
                onClick={() => {
                  setShowConfirmSubmit(false);
                  handleFinalSubmit(false);
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-md shadow-emerald-600/30"
              >
                Nộp Bài Ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
