import React, { useState } from "react";
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  ArrowRight,
  TrendingUp,
  BrainCircuit,
  Lightbulb,
  Check,
  X,
  Target,
} from "lucide-react";
import { StudentSubmission, ExamVariant, Question } from "../../types";
import { getStoredApiKey, getStoredSelectedModel } from "../ModelSettingsModal";
import { clientDiagnosticRemediation } from "../../utils/clientAI";
import { FormattedQuestionContent } from "../FormattedQuestionContent";

interface AIDiagnosticCardProps {
  submission: StudentSubmission;
  variant: ExamVariant;
  onOpenTutorForQuestion?: (question: Question, studentAns: any, isCorrect: boolean) => void;
}

interface DiagnosticResult {
  overallFeedback: string;
  strengths: string[];
  weaknesses: Array<{
    topic: string;
    description: string;
    severity?: string;
  }>;
  studyAdvice: string[];
  remediationQuestions: Array<{
    id?: string;
    part?: number;
    questionType?: string;
    chapter?: string;
    level?: string;
    content: string;
    options?: string[];
    correctIndex?: number;
    shortAnswer?: string;
    explanation: string;
  }>;
}

export const AIDiagnosticCard: React.FC<AIDiagnosticCardProps> = ({
  submission,
  variant,
  onOpenTutorForQuestion,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState<DiagnosticResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [remediationAnswers, setRemediationAnswers] = useState<Record<number, number | string>>({});
  const [remediationChecked, setRemediationChecked] = useState<Record<number, boolean>>({});

  const handleRunDiagnostic = async () => {
    setIsLoading(true);
    setErrorMsg("");

    try {
      // Gather correct and wrong questions
      const correctQuestions: any[] = [];
      const wrongQuestions: any[] = [];

      (variant.questions || []).forEach((q) => {
        const studentAns = submission.answers[q.questionIndex];
        const detail = submission.detailedResults?.[q.questionIndex];

        let isCorrect = false;
        if (detail) {
          isCorrect = detail.isCorrect || (detail.scoreEarned || 0) > 0;
        } else {
          if (q.part === 2 || q.questionType === "true_false") {
            isCorrect = false;
          } else if (q.part === 3 || q.questionType === "short_answer") {
            isCorrect = String(studentAns).trim().toLowerCase() === String(q.shortAnswer || "").trim().toLowerCase();
          } else {
            isCorrect = studentAns === q.correctIndex;
          }
        }

        const qInfo = {
          questionIndex: q.questionIndex,
          part: q.part,
          questionType: q.questionType,
          chapter: q.chapter || "Chuyên đề trọng tâm",
          level: q.level || "Thông hiểu",
          content: q.content,
          options: q.options,
          correctIndex: q.correctIndex,
          correctAnswerDisplay: q.shortAnswer || (q.options && q.options[q.correctIndex ?? 0]) || "Đáp án chuẩn",
          studentAnswer: studentAns,
          studentAnswerDisplay: String(studentAns ?? "Chưa làm"),
          explanation: q.explanation || "",
        };

        if (isCorrect) {
          correctQuestions.push(qInfo);
        } else {
          wrongQuestions.push(qInfo);
        }
      });

      const apiKey = getStoredApiKey();
      const model = getStoredSelectedModel();

      const data = await clientDiagnosticRemediation({
        submission,
        wrongQuestions,
        correctQuestions,
        subject: submission.examTitle || "Tổng hợp",
        grade: submission.grade || "Khối 12",
        apiKey,
        model,
      });

      if (data.success && data.data) {
        setDiagnosticData(data.data);
      } else {
        setErrorMsg(data.error || "Không thể phân tích kết quả bài thi từ AI.");
      }
    } catch (err: any) {
      setErrorMsg("Lỗi kết nối AI: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-indigo-200 shadow-sm p-6 sm:p-8 space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <span>Trợ Lý AI Chẩn Đoán Lỗ Hổng &amp; Luyện Tập Bù Đắp</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                GDPT 2018
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Phân tích năng lực chuyên sâu, phát hiện phần kiến thức chưa vững và tự động tạo bài tập củng cố tức thì.
            </p>
          </div>
        </div>

        {!diagnosticData && (
          <button
            type="button"
            onClick={handleRunDiagnostic}
            disabled={isLoading}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>AI Đang Phân Tích...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Bắt Đầu Phân Tích Lỗ Hổng</span>
              </>
            )}
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Loading state skeleton */}
      {isLoading && (
        <div className="p-8 text-center space-y-3 bg-indigo-50/50 rounded-2xl border border-indigo-100 animate-pulse">
          <div className="w-10 h-10 mx-auto rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700">
            <RefreshCw className="w-5 h-5 animate-spin" />
          </div>
          <p className="text-sm font-bold text-slate-800">
            AI đang quét từng câu hỏi đúng/sai và đối chiếu ma trận kiến thức...
          </p>
          <p className="text-xs text-slate-500">
            Hệ thống đang cá nhân hóa nhận xét và biên soạn 3 bài tập luyện bù phù hợp nhất với năng lực của em.
          </p>
        </div>
      )}

      {/* Diagnostic Results Display */}
      {diagnosticData && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Overall Pedagogical Feedback */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-50 via-blue-50 to-white rounded-2xl border border-indigo-200 space-y-2">
            <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <span>Đánh Giá Năng Lực Tổng Thể &amp; Động Lực:</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
              {diagnosticData.overallFeedback}
            </p>
          </div>

          {/* 2 Columns: Strengths & Weaknesses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Strengths Card */}
            <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200 space-y-3">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs sm:text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Kiến Thức &amp; Kỹ Năng Đã Nắm Vững ({diagnosticData.strengths.length})</span>
              </div>
              <ul className="space-y-2">
                {diagnosticData.strengths.map((str, sIdx) => (
                  <li key={sIdx} className="text-xs text-emerald-950 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Weaknesses Card */}
            <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs sm:text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Lỗ Hổng Cần Khắc Phục ({diagnosticData.weaknesses.length})</span>
              </div>
              <div className="space-y-2.5">
                {diagnosticData.weaknesses.map((wk, wIdx) => (
                  <div key={wIdx} className="p-2.5 bg-white/80 rounded-xl border border-amber-200/80 text-xs">
                    <span className="font-bold text-amber-950 block mb-0.5">
                      📌 {wk.topic}
                    </span>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      {wk.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Study Advice */}
          {diagnosticData.studyAdvice && diagnosticData.studyAdvice.length > 0 && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-xs sm:text-sm">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <span>Chiến Lược &amp; Phương Pháp Ôn Tập Khuyên Dùng:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                {diagnosticData.studyAdvice.map((adv, aIdx) => (
                  <div key={aIdx} className="flex items-start gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="font-bold text-indigo-600">0{aIdx + 1}.</span>
                    <span>{adv}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Remediation Practice Quiz Section */}
          {diagnosticData.remediationQuestions && diagnosticData.remediationQuestions.length > 0 && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
                <div className="flex items-center gap-2 text-indigo-900 font-extrabold text-sm sm:text-base">
                  <Target className="w-5 h-5 text-indigo-600" />
                  <span>3 Câu Hỏi Luyện Tập Bù Đắp Tức Thì (Adaptive Remediation)</span>
                </div>
                <span className="text-xs text-slate-500">
                  Làm thử &amp; kiểm tra đáp án ngay
                </span>
              </div>

              <div className="space-y-4">
                {diagnosticData.remediationQuestions.map((rq, rIdx) => {
                  const selected = remediationAnswers[rIdx];
                  const isChecked = remediationChecked[rIdx];
                  const isCorrect = selected !== undefined && Number(selected) === rq.correctIndex;
                  const letters = ["A", "B", "C", "D"];

                  return (
                    <div
                      key={rIdx}
                      className={`p-5 rounded-2xl border transition-all ${
                        isChecked
                          ? isCorrect
                            ? "bg-emerald-50/40 border-emerald-300 shadow-2xs"
                            : "bg-rose-50/40 border-rose-300 shadow-2xs"
                          : "bg-slate-50/70 border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3 text-xs">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold">
                          Câu Luyện Bù {rIdx + 1}
                        </span>
                        <span className="text-slate-500 font-medium">
                          {rq.chapter || "Chuyên đề trọng tâm"}
                        </span>
                      </div>

                      <div className="text-xs sm:text-sm font-semibold text-slate-800 mb-4 leading-relaxed">
                        <FormattedQuestionContent content={rq.content} />
                      </div>

                      {/* Options */}
                      {rq.options && rq.options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
                          {rq.options.map((opt, oIdx) => {
                            const isThisSelected = selected === oIdx;
                            const isThisCorrect = rq.correctIndex === oIdx;

                            let optClass = "bg-white border-slate-200 text-slate-700 hover:border-indigo-400";
                            if (isChecked) {
                              if (isThisCorrect) {
                                optClass = "bg-emerald-100 border-emerald-500 text-emerald-950 font-bold ring-2 ring-emerald-300";
                              } else if (isThisSelected) {
                                optClass = "bg-rose-100 border-rose-500 text-rose-950 line-through";
                              }
                            } else if (isThisSelected) {
                              optClass = "bg-indigo-50 border-indigo-600 text-indigo-900 font-bold ring-2 ring-indigo-300";
                            }

                            return (
                              <button
                                key={oIdx}
                                type="button"
                                onClick={() => {
                                  if (!isChecked) {
                                    setRemediationAnswers({ ...remediationAnswers, [rIdx]: oIdx });
                                  }
                                }}
                                className={`p-3 rounded-xl border text-xs text-left flex items-start gap-2.5 transition-all ${optClass}`}
                              >
                                <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[11px] shrink-0">
                                  {letters[oIdx] || "A"}
                                </span>
                                <span className="flex-1">{opt}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Check Button & Detailed Explanation */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/80">
                        <div>
                          {!isChecked ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (selected !== undefined) {
                                  setRemediationChecked({ ...remediationChecked, [rIdx]: true });
                                } else {
                                  alert("Vui lòng chọn một phương án trước khi kiểm tra!");
                                }
                              }}
                              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                            >
                              Kiểm Tra Đáp Án
                            </button>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-lg ${
                                isCorrect
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {isCorrect ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                              <span>{isCorrect ? "Chính xác! Em đã hiểu dạng bài này." : "Chưa chính xác! Xem lời giải bên dưới."}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Explanation box */}
                      {isChecked && rq.explanation && (
                        <div className="mt-3 p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-950 space-y-1 animate-in fade-in">
                          <span className="font-bold text-blue-900 flex items-center gap-1.5">
                            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                            <span>Lời giải chi tiết:</span>
                          </span>
                          <FormattedQuestionContent content={rq.explanation} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
