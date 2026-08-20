import React, { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import {
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  RotateCcw,
  BookOpen,
  ArrowRight,
  HelpCircle,
  Lightbulb,
  Lock,
  Filter,
  AlertTriangle,
  Copy,
  Terminal,
  Zap,
  Check,
  X,
  Sparkles,
} from "lucide-react";
import { StudentSubmission, ExamVariant } from "../../types";
import { LETTERS } from "../../utils/examHelpers";
import { FormattedQuestionContent } from "../FormattedQuestionContent";
import { AIDiagnosticCard } from "./AIDiagnosticCard";
import { AITutorModal } from "./AITutorModal";

interface StudentResultViewProps {
  submission: StudentSubmission;
  variant: ExamVariant;
  allowReview: boolean;
  onRetakeOrExit: () => void;
}

export const StudentResultView: React.FC<StudentResultViewProps> = ({
  submission,
  variant,
  allowReview,
  onRetakeOrExit,
}) => {
  const [filterMode, setFilterMode] = useState<"all" | "wrong" | "correct" | "unanswered">("all");
  const [showIntegrityReport, setShowIntegrityReport] = useState(false);
  const [tutorModalOpen, setTutorModalOpen] = useState(false);
  const [activeTutorQuestion, setActiveTutorQuestion] = useState<{
    question: any;
    studentAnswer: any;
    isCorrect: boolean;
  } | null>(null);

  useEffect(() => {
    if (submission.score >= 7 && !submission.isLockedDueToCheating) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [submission]);

  const totalViolations =
    submission.tabSwitchCount +
    (submission.copyPasteCount || 0) +
    (submission.devToolsCount || 0) +
    (submission.suspiciousSpeedCount || 0);

  // Filter questions
  const filteredQuestions = variant
    ? variant.questions.filter((q) => {
        const studentAns = submission.answers[q.questionIndex];
        const detail = submission.detailedResults?.[q.questionIndex];

        let isCorrect = false;
        let isUnanswered = false;

        if (detail) {
          isCorrect = detail.isCorrect || (detail.scoreEarned || 0) > 0;
          isUnanswered = detail.unanswered || false;
        } else {
          if (q.part === 2 || q.questionType === "true_false") {
            isUnanswered = !studentAns || Object.keys(studentAns).length === 0;
            isCorrect = false;
          } else if (q.part === 3 || q.questionType === "short_answer") {
            isUnanswered = !studentAns || String(studentAns).trim() === "";
            isCorrect = String(studentAns).trim().toLowerCase() === String(q.shortAnswer || "").trim().toLowerCase();
          } else {
            isUnanswered = studentAns === undefined || studentAns === null || studentAns === -1;
            isCorrect = studentAns === q.correctIndex;
          }
        }

        if (filterMode === "wrong") return !isCorrect && !isUnanswered;
        if (filterMode === "correct") return isCorrect;
        if (filterMode === "unanswered") return isUnanswered;
        return true;
      })
    : [];

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-6 px-4">
      {/* Result Summary Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-8 text-center space-y-6">
        <div className="space-y-2">
          <div
            className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center shadow-lg ${
              submission.isLockedDueToCheating
                ? "bg-rose-100 text-rose-700 shadow-rose-100"
                : submission.score >= 8
                ? "bg-emerald-100 text-emerald-700 shadow-emerald-100"
                : "bg-indigo-100 text-indigo-700 shadow-indigo-100"
            }`}
          >
            {submission.isLockedDueToCheating ? (
              <ShieldAlert className="w-8 h-8" />
            ) : (
              <Award className="w-8 h-8" />
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            {submission.isLockedDueToCheating
              ? "Bài Thi Bị Khóa Do Vi Phạm Quy Chế"
              : "Kết Quả Làm Bài Thi Chuẩn BGD"}
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm text-slate-600 font-medium pt-1">
            <span className="bg-slate-100 px-2.5 py-1 rounded-xl">
              Trường: <strong>{submission.school || "THPT Chuyên Lê Hồng Phong"}</strong>
            </span>
            <span className="bg-slate-100 px-2.5 py-1 rounded-xl">
              Lớp: <strong>{submission.studentClass}</strong>
            </span>
            <span className="bg-slate-100 px-2.5 py-1 rounded-xl">
              Thí sinh: <strong>{submission.studentName}</strong>
            </span>
            <span className="bg-amber-100 text-amber-900 px-2.5 py-1 rounded-xl font-mono font-bold">
              SBD: {submission.studentId || "SBD-12058"}
            </span>
            <span className="bg-blue-100 text-blue-900 px-2.5 py-1 rounded-xl font-mono font-bold">
              Mã đề: {submission.examCode}
            </span>
          </div>
        </div>

        {/* Big Score Display */}
        <div className="inline-flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border border-slate-200">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Tổng Điểm (Thang điểm 10.0)
          </span>
          <div className="text-5xl font-extrabold text-indigo-700 my-1 font-mono">
            {submission.score.toFixed(2)}
          </div>
          <span className="text-xs text-slate-600 font-medium">
            Đúng <strong>{submission.correctCount}</strong> / {submission.totalQuestions} câu hỏi & lệnh hỏi
          </span>
        </div>

        {/* BGD Multi-Part Score Breakdown Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 bg-blue-50 rounded-2xl border border-blue-200 text-blue-950 space-y-1">
            <div className="font-bold text-blue-900 flex items-center justify-center space-x-1">
              <span>PHẦN I: Trắc nghiệm</span>
            </div>
            <div className="text-xl font-extrabold font-mono text-blue-700">
              {Number(submission.part1Score ?? (submission.score || 0)).toFixed(2)} đ
            </div>
            <span className="text-[10px] text-blue-600 block">4 phương án lựa chọn</span>
          </div>

          <div className="p-3.5 bg-purple-50 rounded-2xl border border-purple-200 text-purple-950 space-y-1">
            <div className="font-bold text-purple-900 flex items-center justify-center space-x-1">
              <span>PHẦN II: Đúng / Sai</span>
            </div>
            <div className="text-xl font-extrabold font-mono text-purple-700">
              {Number(submission.part2Score ?? 0).toFixed(2)} đ
            </div>
            <span className="text-[10px] text-purple-600 block">Quy chuẩn 0.1 - 0.25 - 0.5 - 1.0</span>
          </div>

          <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-amber-950 space-y-1">
            <div className="font-bold text-amber-900 flex items-center justify-center space-x-1">
              <span>PHẦN III: Trả lời ngắn</span>
            </div>
            <div className="text-xl font-extrabold font-mono text-amber-700">
              {Number(submission.part3Score ?? 0).toFixed(2)} đ
            </div>
            <span className="text-[10px] text-amber-600 block">Điền số hoặc đáp án ngắn</span>
          </div>
        </div>

        {/* Anti-Cheating & Integrity Report Alert */}
        {totalViolations > 0 ? (
          <div
            className={`p-4 rounded-2xl text-left text-xs space-y-2 ${
              submission.isLockedDueToCheating
                ? "bg-rose-50 border border-rose-200 text-rose-900"
                : "bg-amber-50 border border-amber-200 text-amber-900"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 font-bold">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  {submission.isLockedDueToCheating
                    ? "BÀI THI BỊ KHÓA DO VI PHẠM QUY CHẾ"
                    : `Hệ thống ghi nhận ${totalViolations} cảnh báo trong quá trình thi`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowIntegrityReport(!showIntegrityReport)}
                className="text-[11px] font-bold text-indigo-700 underline hover:text-indigo-900"
              >
                {showIntegrityReport ? "Thu gọn biên bản" : "Xem chi tiết biên bản"}
              </button>
            </div>

            {/* Violation badges breakdown */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {submission.tabSwitchCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-white border border-amber-300 text-amber-900 text-[10px] font-semibold flex items-center space-x-1">
                  <ShieldAlert className="w-3 h-3 text-amber-600" />
                  <span>Rời màn hình: {submission.tabSwitchCount} lần</span>
                </span>
              )}
              {(submission.copyPasteCount || 0) > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-white border border-rose-300 text-rose-900 text-[10px] font-semibold flex items-center space-x-1">
                  <Copy className="w-3 h-3 text-rose-600" />
                  <span>Copy/Paste: {submission.copyPasteCount} lần</span>
                </span>
              )}
              {(submission.devToolsCount || 0) > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-white border border-purple-300 text-purple-900 text-[10px] font-semibold flex items-center space-x-1">
                  <Terminal className="w-3 h-3 text-purple-600" />
                  <span>DevTools/Phím tắt: {submission.devToolsCount} lần</span>
                </span>
              )}
              {(submission.suspiciousSpeedCount || 0) > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-white border border-amber-300 text-amber-900 text-[10px] font-semibold flex items-center space-x-1">
                  <Zap className="w-3 h-3 text-amber-600" />
                  <span>Trả lời siêu nhanh (&lt;3s): {submission.suspiciousSpeedCount} câu</span>
                </span>
              )}
            </div>

            {/* Expandable detailed violation log */}
            {showIntegrityReport && submission.violationLogs && submission.violationLogs.length > 0 && (
              <div className="mt-3 p-3 bg-white rounded-xl border border-slate-200 space-y-1.5 max-h-48 overflow-y-auto">
                <h4 className="text-[11px] font-bold text-slate-800 border-b pb-1">
                  Nhật ký vi phạm chi tiết:
                </h4>
                {submission.violationLogs.map((v, i) => (
                  <div key={i} className="flex items-start space-x-2 text-[10px] text-slate-700 py-0.5 border-b border-slate-50 last:border-0">
                    <span className="font-mono text-slate-400 shrink-0">
                      {new Date(v.timestamp).toLocaleTimeString("vi-VN")}
                    </span>
                    <span
                      className={`px-1 rounded text-[9px] font-bold uppercase ${
                        v.severity === "critical"
                          ? "bg-rose-100 text-rose-700"
                          : v.severity === "high"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {v.type}
                    </span>
                    <span className="flex-1">{v.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold">Quá trình làm bài nghiêm túc, không phát hiện vi phạm quy chế.</span>
          </div>
        )}

        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            id="btn-exit-exam"
            onClick={onRetakeOrExit}
            className="inline-flex items-center space-x-1.5 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors min-h-[44px]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Thoát Phòng Thi / Về Trang Chủ</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (window.confirm("Bạn có chắc muốn xóa phiên làm bài này và chuẩn bị máy cho lượt thi tiếp theo?")) {
                try {
                  // Clear exam caches
                  Object.keys(localStorage).forEach((k) => {
                    if (k.startsWith("eduexam_exam_cache_")) {
                      localStorage.removeItem(k);
                    }
                  });
                } catch (e) {}
                onRetakeOrExit();
              }
            }}
            className="inline-flex items-center space-x-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors min-h-[44px]"
            title="Dành cho phòng máy vi tính: Xóa dữ liệu tạm để thí sinh sau làm bài"
          >
            <span>Dọn Dẹp Máy Cho Thí Sinh Kế Tiếp</span>
          </button>
        </div>
      </div>

      {/* Phase 2: AI Diagnostic & Adaptive Remediation Card */}
      {!submission.isLockedDueToCheating && (
        <AIDiagnosticCard
          submission={submission}
          variant={variant}
          onOpenTutorForQuestion={(q, sAns, isCor) => {
            setActiveTutorQuestion({ question: q, studentAnswer: sAns, isCorrect: isCor });
            setTutorModalOpen(true);
          }}
        />
      )}

      {/* Post-Submission Review Section */}
      {allowReview ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              <div>
                <h2 className="font-bold text-slate-900 text-sm uppercase tracking-wide">
                  Xem Lại Bài Làm & Đáp Án Chi Tiết
                </h2>
                <p className="text-[11px] text-slate-500">
                  Đối chiếu câu trả lời của bạn với đáp án chuẩn và lời giải của giáo viên.
                </p>
              </div>
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setFilterMode("all")}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  filterMode === "all" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Tất cả ({variant.questions.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("wrong")}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  filterMode === "wrong" ? "bg-white text-rose-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Chưa đạt ({submission.wrongCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("correct")}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  filterMode === "correct" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Đạt điểm ({submission.correctCount})
              </button>
              {submission.unansweredCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterMode("unanswered")}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    filterMode === "unanswered" ? "bg-white text-amber-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Chưa làm ({submission.unansweredCount})
                </button>
              )}
            </div>
          </div>

          {/* List of Filtered Questions */}
          <div className="space-y-4">
            {filteredQuestions.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Không có câu hỏi nào thỏa mãn bộ lọc hiện tại.
              </div>
            ) : (
              filteredQuestions.map((q) => {
                const studentAns = submission.answers[q.questionIndex];
                const detail = submission.detailedResults?.[q.questionIndex];
                const timeSpent = submission.questionTimes?.[q.questionIndex] || 0;

                const isPart2 = q.part === 2 || q.questionType === "true_false";
                const isPart3 = q.part === 3 || q.questionType === "short_answer";
                const isPart1 = !isPart2 && !isPart3;

                return (
                  <div
                    key={q.questionIndex}
                    className={`p-5 rounded-2xl border text-xs space-y-4 transition-all ${
                      detail?.isCorrect || (detail?.scoreEarned || 0) > 0
                        ? "bg-emerald-50/20 border-emerald-200"
                        : detail?.unanswered
                        ? "bg-slate-50 border-slate-200"
                        : "bg-rose-50/20 border-rose-200"
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 w-full">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-sm text-indigo-900">
                            Câu {q.questionIndex}
                          </span>

                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isPart2
                              ? "bg-purple-100 text-purple-800"
                              : isPart3
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-800"
                          }`}>
                            {isPart2 ? "PHẦN II: Đúng / Sai" : isPart3 ? "PHẦN III: Trả lời ngắn" : "PHẦN I: Trắc nghiệm"}
                          </span>

                          {q.level && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                              {q.level}
                            </span>
                          )}

                          {timeSpent > 0 && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-600 flex items-center space-x-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{timeSpent}s</span>
                            </span>
                          )}
                        </div>

                        {/* Passage container */}
                        {q.groupTitle && (
                          <div className="p-3 rounded-lg bg-indigo-50/70 border border-indigo-200 text-indigo-950 text-xs space-y-1 mt-1">
                            <strong className="block font-semibold">📌 {q.groupTitle}</strong>
                            {q.passageContent && (
                              <div className="bg-white/80 p-2 rounded border border-indigo-100 text-slate-800">
                                <FormattedQuestionContent content={q.passageContent} />
                              </div>
                            )}
                          </div>
                        )}

                        <div className="font-medium text-slate-900 text-sm leading-relaxed pt-1">
                          <FormattedQuestionContent content={q.content} />
                        </div>
                      </div>

                      {/* Score earned badge */}
                      {detail && (
                        <div className="shrink-0 text-right">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono inline-block ${
                            detail.scoreEarned > 0
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : "bg-rose-100 text-rose-800 border border-rose-300"
                          }`}>
                            +{detail.scoreEarned.toFixed(2)} đ
                          </span>
                        </div>
                      )}
                    </div>

                    {/* ----------------- RENDER DẠNG 1: TRẮC NGHIỆM 4 LỰA CHỌN ----------------- */}
                    {isPart1 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {(q.options || []).map((opt, optIdx) => {
                          const isSelected = studentAns === optIdx;
                          const isAnswerKey = q.correctIndex === optIdx;

                          return (
                            <div
                              key={optIdx}
                              className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-colors ${
                                isAnswerKey
                                  ? "bg-emerald-100/90 border-emerald-400 font-bold text-emerald-950 shadow-xs"
                                  : isSelected
                                  ? "bg-rose-100/90 border-rose-400 font-semibold text-rose-950 shadow-xs"
                                  : "bg-white border-slate-200 text-slate-700"
                              }`}
                            >
                              <div className="flex items-center space-x-2">
                                <span
                                  className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${
                                    isAnswerKey
                                      ? "bg-emerald-600 text-white"
                                      : isSelected
                                      ? "bg-rose-600 text-white"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {LETTERS[optIdx]}
                                </span>
                                <span>{opt}</span>
                              </div>

                              {isAnswerKey && (
                                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-200/80 px-2 py-0.5 rounded">
                                  Đáp án đúng ✓
                                </span>
                              )}
                              {isSelected && !isAnswerKey && (
                                <span className="text-[10px] font-bold text-rose-800 bg-rose-200/80 px-2 py-0.5 rounded">
                                  Lựa chọn của bạn ✗
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* ----------------- RENDER DẠNG 2: ĐÚNG / SAI 4 Ý ----------------- */}
                    {isPart2 && (
                      <div className="space-y-2 border border-slate-200 rounded-xl overflow-hidden bg-white">
                        {(q.statements || []).map((stmt: any) => {
                          const studentVal = studentAns?.[stmt.id];
                          const keyVal = stmt.isCorrect;
                          const isMatch = studentVal !== undefined && studentVal === keyVal;

                          return (
                            <div key={stmt.id} className="p-3 border-b border-slate-100 last:border-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-start space-x-2 flex-1">
                                <span className="font-bold text-indigo-700">{stmt.label || `${stmt.id})`}</span>
                                <span className="text-slate-800">{stmt.text}</span>
                              </div>

                              <div className="flex items-center space-x-3 shrink-0 self-end sm:self-center text-xs">
                                <span className="text-slate-500">
                                  Bạn chọn:{" "}
                                  <strong className={isMatch ? "text-emerald-700" : "text-rose-700"}>
                                    {studentVal === true ? "ĐÚNG" : studentVal === false ? "SAI" : "Chưa chọn"}
                                  </strong>
                                </span>
                                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                                  Chuẩn: {keyVal ? "ĐÚNG" : "SAI"}
                                </span>
                                {isMatch ? (
                                  <Check className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <X className="w-4 h-4 text-rose-600" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* ----------------- RENDER DẠNG 3: TRẢ LỜI NGẮN ----------------- */}
                    {isPart3 && (
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">
                            Câu trả lời của bạn:{" "}
                            <strong className="font-mono text-indigo-900 text-sm">
                              {studentAns || "(Chưa nhập)"}
                            </strong>
                          </span>
                          <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded font-mono font-bold">
                            Đáp án chuẩn: {q.shortAnswer || (q.acceptableAnswers || []).join(" | ")}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Explanation Box & AI Tutor Action Button */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-100">
                      <div className="text-[11px] text-slate-500 font-medium">
                        {q.chapter || "Chương trọng tâm"}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTutorQuestion({
                            question: q,
                            studentAnswer: studentAns,
                            isCorrect: detail?.isCorrect || false,
                          });
                          setTutorModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-[11px] font-bold transition-all shadow-2xs self-start sm:self-auto"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Hỏi Gia Sư AI 24/7 (Giải Thích &amp; Mẹo Làm Bài)</span>
                      </button>
                    </div>

                    {q.explanation && (
                      <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200 text-xs text-slate-800 space-y-1">
                        <div className="flex items-center space-x-1.5 font-bold text-amber-900">
                          <Lightbulb className="w-4 h-4 text-amber-600" />
                          <span>Hướng dẫn giải chi tiết:</span>
                        </div>
                        <div className="text-[11px] leading-relaxed text-slate-700 pl-5">
                          <FormattedQuestionContent content={q.explanation} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            Chế Độ Xem Lại Đáp Án Đang Bị Khóa
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Giáo viên phụ trách đã cấu hình bài kiểm tra này không cho phép học sinh xem lại chi tiết
            câu hỏi và đáp án sau khi nộp bài theo quy chế bảo mật đề thi.
          </p>
        </div>
      )}

      {/* Interactive AI Tutor Chat Modal */}
      <AITutorModal
        isOpen={tutorModalOpen}
        onClose={() => setTutorModalOpen(false)}
        question={activeTutorQuestion?.question || null}
        studentAnswer={activeTutorQuestion?.studentAnswer}
        isCorrect={activeTutorQuestion?.isCorrect}
      />
    </div>
  );
};
