import React, { useState } from "react";
import {
  BarChart3,
  HelpCircle,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Download,
  Info,
  ChevronDown,
  ChevronUp,
  Award,
  Layers,
} from "lucide-react";
import { StudentSubmission, ExamPackage, Question } from "../../types";
import { LETTERS } from "../../utils/examHelpers";
import { FormattedQuestionContent } from "../FormattedQuestionContent";

interface ItemAnalysisViewProps {
  submissions: StudentSubmission[];
  exams?: ExamPackage[];
  questionBank?: Question[];
}

export interface QuestionAnalysisMetric {
  questionIndex: number;
  content: string;
  part: number;
  questionType: string;
  correctAnswerText: string;
  correctIndex?: number;
  totalAttempts: number;
  correctCount: number;
  pValue: number; // 0..1 (Difficulty)
  dValue: number; // -1..1 (Discrimination)
  distractorCounts: Record<string, number>; // "A": 10, "B": 2, ...
  qualityEvaluation: "excellent" | "good" | "marginal" | "poor";
  recommendation: string;
}

export const ItemAnalysisView: React.FC<ItemAnalysisViewProps> = ({
  submissions,
  exams = [],
  questionBank = [],
}) => {
  const [selectedExamId, setSelectedExamId] = useState<string>(
    exams[0]?.id || "all"
  );
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

  // Filter submissions by selected exam if specific
  const activeSubs =
    selectedExamId === "all"
      ? submissions
      : submissions.filter((s) => s.examId === selectedExamId);

  const totalN = activeSubs.length;

  // Selected Exam reference
  const currentExam = exams.find((e) => e.id === selectedExamId) || exams[0];
  const refVariant = currentExam?.variants?.[0];
  const refQuestions = refVariant?.questions || currentExam?.originalQuestions || [];

  // Sort submissions by total score to calculate Discrimination Index (Top 27% vs Bottom 27%)
  const sortedSubs = [...activeSubs].sort((a, b) => b.score - a.score);
  const groupSize = Math.max(1, Math.round(totalN * 0.27));
  const topGroup = sortedSubs.slice(0, groupSize);
  const bottomGroup = sortedSubs.slice(Math.max(0, totalN - groupSize));

  // Compute Metrics for each Question
  const questionMetrics: QuestionAnalysisMetric[] = refQuestions.map((q, idx) => {
    const qIndex = q.questionIndex || idx + 1;
    let correctCount = 0;
    let topCorrect = 0;
    let bottomCorrect = 0;

    const distractorCounts: Record<string, number> = {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      other: 0,
    };

    activeSubs.forEach((sub) => {
      const detailed = sub.detailedResults?.[qIndex];
      const isCorrect = detailed ? detailed.isCorrect : false;
      if (isCorrect) correctCount++;

      // Distractor tracking for Part 1 (Multiple Choice)
      const rawAns = sub.answers?.[qIndex];
      if (rawAns !== undefined && rawAns !== null) {
        if (typeof rawAns === "number" && rawAns >= 0 && rawAns < 4) {
          const letter = LETTERS[rawAns];
          distractorCounts[letter] = (distractorCounts[letter] || 0) + 1;
        } else {
          distractorCounts.other = (distractorCounts.other || 0) + 1;
        }
      }
    });

    topGroup.forEach((sub) => {
      if (sub.detailedResults?.[qIndex]?.isCorrect) topCorrect++;
    });

    bottomGroup.forEach((sub) => {
      if (sub.detailedResults?.[qIndex]?.isCorrect) bottomCorrect++;
    });

    // P-value (Độ khó: tỷ lệ làm đúng)
    const pValue = totalN > 0 ? correctCount / totalN : 0;

    // D-value (Độ phân biệt: Top 27% - Bottom 27%)
    const dValue =
      groupSize > 0 ? (topCorrect - bottomCorrect) / groupSize : 0;

    // Evaluate Quality
    let qualityEvaluation: "excellent" | "good" | "marginal" | "poor" = "good";
    let recommendation = "Câu hỏi phân hóa tốt, đạt chuẩn khảo thí.";

    if (dValue >= 0.4) {
      qualityEvaluation = "excellent";
      recommendation = "Độ phân biệt rất cao, phân loại xuất sắc học sinh giỏi/yếu.";
    } else if (dValue >= 0.3) {
      qualityEvaluation = "good";
      recommendation = "Độ phân biệt tốt, phù hợp chuẩn đề thi quốc gia.";
    } else if (dValue >= 0.2) {
      qualityEvaluation = "marginal";
      recommendation = "Độ phân biệt tạm chấp nhận, nên rà soát lại các phương án nhiễu.";
    } else {
      qualityEvaluation = "poor";
      recommendation =
        pValue > 0.9
          ? "Câu hỏi quá dễ (hầu hết làm đúng), độ phân biệt thấp."
          : pValue < 0.2
          ? "Câu hỏi quá khó hoặc có thể gây nhầm lẫn đáp án."
          : "Độ phân biệt kém, học sinh yếu đoán mò hoặc bẫy phương án chưa rõ ràng.";
    }

    return {
      questionIndex: qIndex,
      content: q.content,
      part: q.part || 1,
      questionType: q.questionType,
      correctAnswerText:
        q.questionType === "multiple_choice" && q.correctIndex !== undefined
          ? `${LETTERS[q.correctIndex]}. ${q.options?.[q.correctIndex] || ""}`
          : q.shortAnswer || "Xem biểu điểm",
      correctIndex: q.correctIndex,
      totalAttempts: totalN,
      correctCount,
      pValue,
      dValue,
      distractorCounts,
      qualityEvaluation,
      recommendation,
    };
  });

  // Summary aggregates
  const avgPValue =
    questionMetrics.length > 0
      ? questionMetrics.reduce((acc, m) => acc + m.pValue, 0) /
        questionMetrics.length
      : 0;

  const avgDValue =
    questionMetrics.length > 0
      ? questionMetrics.reduce((acc, m) => acc + m.dValue, 0) /
        questionMetrics.length
      : 0;

  const highQualityCount = questionMetrics.filter(
    (m) => m.qualityEvaluation === "excellent" || m.qualityEvaluation === "good"
  ).length;

  // Export CSV Analysis
  const handleExportCSV = () => {
    const headers = [
      "Câu số",
      "Phần thi",
      "Nội dung vắn tắt",
      "Số thí sinh làm",
      "Số câu đúng",
      "Độ khó P-value (%)",
      "Độ phân biệt D-value",
      "Đánh giá",
      "Khuyến nghị",
    ];

    const rows = questionMetrics.map((m) => [
      `Câu ${m.questionIndex}`,
      `Phần ${m.part}`,
      `"${m.content.replace(/"/g, '""').slice(0, 80)}"`,
      m.totalAttempts,
      m.correctCount,
      `${(m.pValue * 100).toFixed(1)}%`,
      m.dValue.toFixed(3),
      m.qualityEvaluation.toUpperCase(),
      `"${m.recommendation}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Phan_Tich_Khao_Thi_EduExam_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Exam Selector */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-800 text-xs font-bold border border-blue-200">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Phân Tích Lý Thuyết Khảo Thí Cổ Điển (CTT Item Analysis)</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Ma Trận & Chất Lượng Phân Hóa Từng Câu Hỏi
          </h2>
          <p className="text-xs text-slate-500">
            Đo lường độ khó (P-value), độ phân biệt (D-value Top/Bottom 27%) và phân tích bẫy phương án nhiễu.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {exams.length > 0 && (
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tất cả bài thi ({submissions.length} bài nộp)</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title} ({ex.accessCode})
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất Báo Cáo CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Độ khó trung bình (P-value)
          </span>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {(avgPValue * 100).toFixed(1)}%
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold block">
            {avgPValue >= 0.5 && avgPValue <= 0.75
              ? "✓ Mức độ vừa sức chuẩn BGD"
              : avgPValue > 0.75
              ? "Đề thi tương đối dễ"
              : "Đề thi có độ khó cao"}
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Độ phân biệt TB (D-value)
          </span>
          <div className="text-2xl font-black text-indigo-700 font-mono">
            {avgDValue.toFixed(3)}
          </div>
          <span className="text-[11px] text-indigo-600 font-semibold block">
            {avgDValue >= 0.35 ? "✓ Phân hóa rất tốt" : "Phân hóa trung bình"}
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Câu hỏi đạt chuẩn khảo thí
          </span>
          <div className="text-2xl font-black text-emerald-600 font-mono">
            {highQualityCount} / {questionMetrics.length}
          </div>
          <span className="text-[11px] text-slate-500 block">
            {Math.round((highQualityCount / Math.max(1, questionMetrics.length)) * 100)}% câu hỏi phân hóa tốt
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Cỡ mẫu thống kê (N)
          </span>
          <div className="text-2xl font-black text-slate-800 font-mono">
            {totalN} bài thi
          </div>
          <span className="text-[11px] text-slate-500 block">
            Nhóm Top 27%: {groupSize} thí sinh
          </span>
        </div>
      </div>

      {/* 3. Detailed Question Analysis Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">
            Bảng Chi Tiết Từng Câu Hỏi & Phương Án Nhiễu ({questionMetrics.length} câu)
          </h3>
          <span className="text-xs text-slate-400">Bấm vào câu hỏi để xem chi tiết bẫy đáp án</span>
        </div>

        <div className="divide-y divide-slate-100">
          {questionMetrics.map((m) => {
            const isExpanded = expandedQuestion === m.questionIndex;
            const pPct = Math.round(m.pValue * 100);

            return (
              <div key={m.questionIndex} className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors">
                <div
                  className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 cursor-pointer"
                  onClick={() =>
                    setExpandedQuestion(isExpanded ? null : m.questionIndex)
                  }
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-slate-900 text-white">
                        Câu {m.questionIndex}
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${
                          m.part === 1
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : m.part === 2
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-amber-50 text-amber-800 border-amber-200"
                        }`}
                      >
                        Phần {m.part}
                      </span>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          m.qualityEvaluation === "excellent"
                            ? "bg-emerald-100 text-emerald-800"
                            : m.qualityEvaluation === "good"
                            ? "bg-blue-100 text-blue-800"
                            : m.qualityEvaluation === "marginal"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {m.qualityEvaluation === "excellent"
                          ? "★ Xuất Sắc"
                          : m.qualityEvaluation === "good"
                          ? "✓ Đạt Chuẩn"
                          : m.qualityEvaluation === "marginal"
                          ? "⚠ Cần Lưu Ý"
                          : "✕ Cần Điều Chỉnh"}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-800 font-medium line-clamp-2">
                      <FormattedQuestionContent content={m.content} />
                    </p>
                  </div>

                  {/* Metrics Badges */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Độ khó (P)</span>
                      <div className="flex items-center gap-1.5 justify-end">
                        <span className="font-mono font-bold text-xs sm:text-sm text-slate-800">
                          {pPct}% đúng
                        </span>
                        <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              pPct >= 80
                                ? "bg-emerald-500"
                                : pPct >= 40
                                ? "bg-blue-500"
                                : "bg-amber-500"
                            }`}
                            style={{ width: `${pPct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Phân biệt (D)</span>
                      <span
                        className={`font-mono font-bold text-xs sm:text-sm ${
                          m.dValue >= 0.3
                            ? "text-emerald-700"
                            : m.dValue >= 0.2
                            ? "text-blue-700"
                            : "text-rose-600"
                        }`}
                      >
                        {m.dValue.toFixed(2)}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Details: Distractor Analysis & Recommendation */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 bg-slate-50/60 p-4 rounded-2xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left: Distractor analysis */}
                      {m.part === 1 && (
                        <div className="space-y-2">
                          <span className="text-xs font-bold text-slate-700 block">
                            Phân bố lựa chọn phương án của học sinh:
                          </span>
                          <div className="grid grid-cols-4 gap-2 text-center text-xs">
                            {["A", "B", "C", "D"].map((letter, optIdx) => {
                              const count = m.distractorCounts[letter] || 0;
                              const pct = totalN > 0 ? Math.round((count / totalN) * 100) : 0;
                              const isCorrectOpt = m.correctIndex === optIdx;

                              return (
                                <div
                                  key={letter}
                                  className={`p-2.5 rounded-xl border ${
                                    isCorrectOpt
                                      ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20"
                                      : "bg-white border-slate-200"
                                  }`}
                                >
                                  <div className="flex items-center justify-center gap-1 font-bold">
                                    <span className={isCorrectOpt ? "text-emerald-800" : "text-slate-700"}>
                                      {letter}
                                    </span>
                                    {isCorrectOpt && (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    )}
                                  </div>
                                  <span className="text-[11px] font-mono text-slate-500 block">
                                    {count} HS ({pct}%)
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Right: Expert Recommendation */}
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-slate-700 block">
                          Nhận xét & Khuyến nghị sư phạm:
                        </span>
                        <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
                          <p>
                            <strong>Đáp án đúng:</strong>{" "}
                            <span className="text-emerald-700 font-semibold">{m.correctAnswerText}</span>
                          </p>
                          <p className="text-slate-600 leading-relaxed">{m.recommendation}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
