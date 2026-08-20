import React, { useState } from "react";
import {
  FileSpreadsheet,
  Download,
  Copy,
  CheckCircle2,
  ShieldAlert,
  Search,
  Filter,
  Eye,
  Unlock,
  AlertTriangle,
  Clock,
  User,
  GraduationCap,
  ExternalLink,
  RefreshCw,
  X,
  Terminal,
  Zap,
  HelpCircle,
  TrendingUp,
} from "lucide-react";
import { StudentSubmission, ExamPackage, Question } from "../../types";
import {
  exportSubmissionsToExcel,
  generateGoogleSheetsTSV,
  LETTERS,
} from "../../utils/examHelpers";
import { ScoreAnalyticsChart } from "./ScoreAnalyticsChart";
import { ItemAnalysisView } from "./ItemAnalysisView";
import { AntiCheatLogModal } from "./AntiCheatLogModal";
import { calculateTrustScore } from "../../utils/cloudSyncManager";

interface MonitoringAndHistoryProps {
  submissions: StudentSubmission[];
  exams?: ExamPackage[];
  questionBank?: Question[];
  onUnlockStudent: (submissionId: string) => void;
  onRefreshData: () => void;
}

export const MonitoringAndHistory: React.FC<MonitoringAndHistoryProps> = ({
  submissions,
  exams = [],
  questionBank = [],
  onUnlockStudent,
  onRefreshData,
}) => {
  const [subView, setSubView] = useState<"monitoring" | "analytics" | "item_analysis">("monitoring");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>("all");
  const [selectedSubmission, setSelectedSubmission] = useState<StudentSubmission | null>(null);
  const [selectedAntiCheatSub, setSelectedAntiCheatSub] = useState<StudentSubmission | null>(null);

  const [copySuccess, setCopySuccess] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookStatus, setWebhookStatus] = useState<string>("");
  const [showWebhookGuide, setShowWebhookGuide] = useState(false);

  // Available classes for filter
  const classesList = Array.from(new Set(submissions.map((s) => s.studentClass).filter(Boolean)));

  // Filtered Submissions
  const filteredSubmissions = submissions.filter((s) => {
    const matchSearch =
      s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.studentClass.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.studentId && s.studentId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      s.examTitle.toLowerCase().includes(searchQuery.toLowerCase());

    const totalViolations =
      s.tabSwitchCount +
      (s.copyPasteCount || 0) +
      (s.devToolsCount || 0) +
      (s.suspiciousSpeedCount || 0);

    const matchStatus =
      selectedStatusFilter === "all" ||
      (selectedStatusFilter === "locked" && s.isLockedDueToCheating) ||
      (selectedStatusFilter === "tab_switch" && s.tabSwitchCount > 0) ||
      (selectedStatusFilter === "copy_paste" && (s.copyPasteCount || 0) > 0) ||
      (selectedStatusFilter === "devtools" && (s.devToolsCount || 0) > 0) ||
      (selectedStatusFilter === "speed" && (s.suspiciousSpeedCount || 0) > 0) ||
      (selectedStatusFilter === "warning" && totalViolations > 0 && !s.isLockedDueToCheating) ||
      (selectedStatusFilter === "clean" && totalViolations === 0);

    const matchClass =
      selectedClassFilter === "all" || s.studentClass === selectedClassFilter;

    return matchSearch && matchStatus && matchClass;
  });

  // Analytics
  const totalStudents = submissions.length;
  const lockedCount = submissions.filter((s) => s.isLockedDueToCheating).length;
  const tabViolationCount = submissions.filter((s) => s.tabSwitchCount > 0).length;
  const copyPasteTotal = submissions.reduce((acc, s) => acc + (s.copyPasteCount || 0), 0);
  const devToolsTotal = submissions.reduce((acc, s) => acc + (s.devToolsCount || 0), 0);
  const speedAnomalyTotal = submissions.reduce((acc, s) => acc + (s.suspiciousSpeedCount || 0), 0);

  const avgScore =
    totalStudents > 0
      ? (submissions.reduce((acc, curr) => acc + curr.score, 0) / totalStudents).toFixed(2)
      : "0.00";

  // Handle Copy to Clipboard for Google Sheets
  const handleCopyForGoogleSheets = async () => {
    const tsvData = generateGoogleSheetsTSV(filteredSubmissions);
    try {
      await navigator.clipboard.writeText(tsvData);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    } catch (err) {
      console.error("Clipboard copy failed", err);
    }
  };

  // Handle Export to Excel
  const handleExportExcel = () => {
    exportSubmissionsToExcel(filteredSubmissions, "Bang_Diem_EduExam");
  };

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tổng Thí Sinh</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-slate-800">{totalStudents}</span>
            <span className="text-xs text-slate-500 font-medium">lượt làm bài</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Điểm Trung Bình</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-blue-600">{avgScore}</span>
            <span className="text-xs text-slate-500 font-medium">/ 10.0</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rời Tab / Cửa Sổ</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-amber-600">{tabViolationCount}</span>
            <span className="text-xs text-slate-500 font-medium">thí sinh</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Copy-Paste / Tools</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-purple-600">{copyPasteTotal + devToolsTotal}</span>
            <span className="text-xs text-slate-500 font-medium">lần vi phạm</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Bị Khóa Do Gian Lận</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-rose-600">{lockedCount}</span>
            <span className="text-xs text-rose-500 font-medium">thí sinh</span>
          </div>
        </div>
      </div>

      {/* Sub-view Navigator */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 rounded-2xl">
        <button
          type="button"
          onClick={() => setSubView("monitoring")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            subView === "monitoring"
              ? "bg-white text-blue-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-blue-600" />
          <span>Danh Sách Thí Sinh & Nhật Ký Giám Sát ({submissions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubView("analytics")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            subView === "analytics"
              ? "bg-white text-blue-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <span>Phổ Điểm & Báo Cáo Chuyên Đề</span>
        </button>

        <button
          type="button"
          onClick={() => setSubView("item_analysis")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            subView === "item_analysis"
              ? "bg-white text-blue-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Zap className="w-4 h-4 text-purple-600" />
          <span>Phân Tích Khảo Thí Câu Hỏi (P-value & D-value)</span>
        </button>
      </div>

      {/* VIEW 1: Score Analytics View */}
      {subView === "analytics" && (
        <ScoreAnalyticsChart
          submissions={submissions}
          exams={exams}
          questionBank={questionBank}
        />
      )}

      {/* VIEW 2: Item Analysis (P-value & D-value) */}
      {subView === "item_analysis" && (
        <ItemAnalysisView
          submissions={submissions}
          exams={exams}
          questionBank={questionBank}
        />
      )}

      {/* VIEW 3: Main Monitoring & Student Table */}
      {subView === "monitoring" && (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col space-y-4">
        {/* Header & Realtime Pulse */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Giám sát học sinh làm bài & Nhật ký thi
            </h3>
            <span className="text-xs font-medium text-rose-500 flex items-center gap-1.5 bg-rose-50 px-3 py-1 rounded-full animate-pulse border border-rose-200">
              <span className="w-2 h-2 bg-rose-500 rounded-full" />
              <span>Real-time Anti-Cheating</span>
            </span>
          </div>

          {/* Action Buttons: Google Sheets Sync & Excel */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              id="btn-copy-google-sheet"
              onClick={handleCopyForGoogleSheets}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200 transition-colors shadow-xs"
              title="Copy bảng điểm dạng TSV để dán trực tiếp vào Google Sheets"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copySuccess ? "Đã copy vào Clipboard!" : "Đưa vào Google Sheets (Copy)"}</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Xuất Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={onRefreshData}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs transition-colors"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo tên học sinh, lớp, mã đề, ID..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="all">Tất cả tình trạng giám sát</option>
              <option value="clean">Hợp lệ (0 vi phạm)</option>
              <option value="warning">Có cảnh báo vi phạm</option>
              <option value="tab_switch">Vi phạm chuyển tab</option>
              <option value="copy_paste">Vi phạm Copy/Paste</option>
              <option value="devtools">Vi phạm DevTools/Phím tắt</option>
              <option value="speed">Nghi vấn trả lời siêu nhanh (&lt;3s)</option>
              <option value="locked">Bị khóa do gian lận</option>
            </select>

            {classesList.length > 0 && (
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="all">Tất cả lớp</option>
                {classesList.map((c) => (
                  <option key={c} value={c}>
                    Lớp {c}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Submissions Table */}
        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="py-3 px-4 font-semibold">Thí sinh</th>
                <th className="py-3 px-4 font-semibold">Lớp / Trường</th>
                <th className="py-3 px-4 font-semibold">Mã đề</th>
                <th className="py-3 px-4 font-semibold">Kết quả & Điểm</th>
                <th className="py-3 px-4 font-semibold">Thời gian & Tốc độ</th>
                <th className="py-3 px-4 font-semibold">Cảnh báo giám sát</th>
                <th className="py-3 px-4 font-semibold">Trạng thái</th>
                <th className="py-3 px-4 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Chưa có dữ liệu bài thi phù hợp với bộ lọc
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub) => {
                  const answeredCount = Object.keys(sub.answers || {}).length;
                  const totalQ = sub.totalQuestions || 5;
                  const progressPct = Math.min(100, Math.round((answeredCount / totalQ) * 100));
                  const totalViolations =
                    sub.tabSwitchCount +
                    (sub.copyPasteCount || 0) +
                    (sub.devToolsCount || 0) +
                    (sub.suspiciousSpeedCount || 0);

                  return (
                    <tr
                      key={sub.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{sub.studentName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {sub.studentId || "HS-2026"}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        <div className="font-medium">Lớp {sub.studentClass}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[130px]">
                          {sub.school}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded font-mono font-bold">
                          {sub.examCode}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">
                              Đúng {sub.correctCount}/{totalQ} ({sub.wrongCount} sai)
                            </span>
                            <span className="font-bold text-indigo-700 font-mono text-xs">{sub.score.toFixed(2)} đ</span>
                          </div>
                          {(sub.part1Score !== undefined || sub.part2Score !== undefined || sub.part3Score !== undefined) && (
                            <div className="flex items-center gap-1 text-[9px] font-mono text-slate-500">
                              <span className="bg-blue-50 text-blue-700 px-1 rounded">I: {Number(sub.part1Score ?? 0).toFixed(1)}</span>
                              <span className="bg-purple-50 text-purple-700 px-1 rounded">II: {Number(sub.part2Score ?? 0).toFixed(1)}</span>
                              <span className="bg-amber-50 text-amber-700 px-1 rounded">III: {Number(sub.part3Score ?? 0).toFixed(1)}</span>
                            </div>
                          )}
                          <div className="w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                sub.isLockedDueToCheating
                                  ? "bg-rose-500"
                                  : sub.score >= 8
                                  ? "bg-emerald-500"
                                  : "bg-indigo-500"
                              }`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-slate-700 font-medium">
                          {(sub.durationTakenSeconds / 60).toFixed(1)} phút
                        </div>
                        {(sub.suspiciousSpeedCount || 0) > 0 && (
                          <div className="text-[10px] text-amber-700 font-bold flex items-center space-x-0.5">
                            <Zap className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>{sub.suspiciousSpeedCount} câu &lt;3s</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {sub.isLockedDueToCheating ? (
                          <span className="px-2 py-0.5 bg-rose-600 text-white rounded text-[10px] font-bold inline-flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3 shrink-0" />
                            <span>ĐÃ KHÓA THI</span>
                          </span>
                        ) : totalViolations > 0 ? (
                          <div className="flex flex-col gap-1">
                            {sub.tabSwitchCount > 0 && (
                              <span className="px-1.5 py-0.5 bg-amber-50 text-amber-800 rounded text-[10px] font-semibold border border-amber-200">
                                Tab: {sub.tabSwitchCount} lần
                              </span>
                            )}
                            {(sub.copyPasteCount || 0) > 0 && (
                              <span className="px-1.5 py-0.5 bg-rose-50 text-rose-800 rounded text-[10px] font-semibold border border-rose-200">
                                Copy/Paste: {sub.copyPasteCount}
                              </span>
                            )}
                            {(sub.devToolsCount || 0) > 0 && (
                              <span className="px-1.5 py-0.5 bg-purple-50 text-purple-800 rounded text-[10px] font-semibold border border-purple-200">
                                Tools: {sub.devToolsCount}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-semibold border border-emerald-200 flex items-center space-x-1 w-fit">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Trung thực (0)</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {sub.isLockedDueToCheating ? (
                          <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded-md border border-rose-200">
                            Bị khóa
                          </span>
                        ) : sub.status === "in_progress" ? (
                          <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                            Đang làm
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                            Đã nộp bài
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {sub.isLockedDueToCheating && (
                            <button
                              type="button"
                              onClick={() => onUnlockStudent(sub.id)}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold border border-rose-200 transition-colors flex items-center gap-1"
                              title="Mở khóa cho học sinh tiếp tục làm bài"
                            >
                              <Unlock className="w-3 h-3" />
                              <span>Mở khóa</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedAntiCheatSub(sub)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border border-slate-200"
                            title="Xem Báo Cáo Giám Thị AI & Nhật Ký Vi Phạm Chi Tiết"
                          >
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                            <span>Giám thị AI ({calculateTrustScore(sub).trustScore}%)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedSubmission(sub)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Xem chi tiết biên bản & thời gian từng câu"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info bar */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 font-medium gap-2">
          <span>
            Hiển thị {filteredSubmissions.length} trên tổng số {submissions.length} thí sinh
          </span>
          <span className="text-emerald-700 font-semibold flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tự động thu nhận toàn bộ lượt chọn, câu đúng/sai, điểm số & nhật ký gian lận</span>
          </span>
        </div>
      </div>
      )}

      {/* Submission Detail Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">
                  Hồ Sơ Bài Thi: {selectedSubmission.studentName}
                </h3>
                <p className="text-xs text-slate-300">
                  Lớp {selectedSubmission.studentClass} • {selectedSubmission.school} • Mã đề{" "}
                  <strong>{selectedSubmission.examCode}</strong> • ID: {selectedSubmission.studentId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Summary Stats in modal */}
              <div className="grid grid-cols-4 gap-2.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                <div>
                  <div className="text-slate-500 font-medium">Điểm số</div>
                  <div className="text-lg font-bold text-indigo-700 font-mono">
                    {selectedSubmission.score.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 font-medium">Đúng / Tổng</div>
                  <div className="text-lg font-bold text-slate-800">
                    {selectedSubmission.correctCount} / {selectedSubmission.totalQuestions}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 font-medium">Thời gian</div>
                  <div className="text-lg font-bold text-slate-800">
                    {Math.round(selectedSubmission.durationTakenSeconds / 60)}p {selectedSubmission.durationTakenSeconds % 60}s
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 font-medium">Tổng vi phạm</div>
                  <div
                    className={`text-lg font-bold ${
                      selectedSubmission.isLockedDueToCheating
                        ? "text-rose-600"
                        : selectedSubmission.violationLogs.length > 0
                        ? "text-amber-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {selectedSubmission.violationLogs.length}
                  </div>
                </div>
              </div>

              {/* Per-Question Duration & Speed Breakdown (Ghi lại thời gian học sinh dành cho mỗi câu hỏi) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Phân bổ thời gian & Lựa chọn từng câu hỏi</span>
                  </h4>
                  <span className="text-[10px] text-slate-500">
                    * &lt;3s: Trả lời siêu nhanh • &gt;300s: Dừng lại lâu
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(selectedSubmission.answers).map(([qNumStr, ansVal]) => {
                    const qNum = Number(qNumStr);
                    const timeSpent = selectedSubmission.questionTimes?.[qNum] || 0;
                    const isSuspiciousFast = timeSpent < 3 && ansVal !== undefined && ansVal !== null;
                    const isAbnormallySlow = timeSpent > 300;

                    let displayAns = "";
                    if (typeof ansVal === "number") {
                      displayAns = LETTERS[ansVal] || "Chưa chọn";
                    } else if (typeof ansVal === "object" && ansVal !== null) {
                      displayAns = Object.entries(ansVal)
                        .map(([k, v]) => `${k}:${v ? "Đ" : "S"}`)
                        .join(" ");
                    } else if (typeof ansVal === "string") {
                      displayAns = ansVal || "Chưa nhập";
                    } else {
                      displayAns = "Chưa chọn";
                    }

                    return (
                      <div
                        key={qNum}
                        className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                          isSuspiciousFast
                            ? "bg-amber-50/80 border-amber-300"
                            : isAbnormallySlow
                            ? "bg-rose-50/80 border-rose-300"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-slate-800 shrink-0">Câu {qNum}</span>
                          <span className="font-mono font-bold px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded text-[10px] truncate max-w-[100px]" title={displayAns}>
                            {displayAns}
                          </span>
                        </div>

                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200/60 text-[10px]">
                          <span className="text-slate-500 font-mono">{timeSpent}s</span>
                          {isSuspiciousFast ? (
                            <span className="font-bold text-amber-700">Nhanh &lt;3s</span>
                          ) : isAbnormallySlow ? (
                            <span className="font-bold text-rose-700">Chậm &gt;5p</span>
                          ) : (
                            <span className="text-emerald-700 font-medium">Bình thường</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Anti-cheating violation timeline */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                  <span>Biên bản kiểm tra tính trung thực & Vi phạm</span>
                </h4>

                {selectedSubmission.violationLogs.length === 0 ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Thí sinh hoàn thành bài thi nghiêm túc, không có bất kỳ hành vi bất thường nào.</span>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {selectedSubmission.violationLogs.map((log, i) => (
                      <div
                        key={i}
                        className={`p-2.5 rounded-xl border flex items-start gap-2 ${
                          log.severity === "critical"
                            ? "bg-rose-50 border-rose-200 text-rose-900"
                            : log.severity === "high"
                            ? "bg-amber-50 border-amber-200 text-amber-900"
                            : "bg-slate-50 border-slate-200 text-slate-800"
                        }`}
                      >
                        <AlertTriangle
                          className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                            log.severity === "critical"
                              ? "text-rose-600"
                              : "text-amber-600"
                          }`}
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{log.message}</span>
                            <span className="text-[10px] opacity-70 font-mono">
                              {new Date(log.timestamp).toLocaleTimeString("vi-VN")}
                            </span>
                          </div>
                          {log.questionIndex && (
                            <span className="text-[10px] opacity-80 block">
                              Ghi nhận tại Câu hỏi {log.questionIndex}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              {selectedSubmission.isLockedDueToCheating && (
                <button
                  type="button"
                  onClick={() => {
                    onUnlockStudent(selectedSubmission.id);
                    setSelectedSubmission((prev) =>
                      prev
                        ? {
                            ...prev,
                            isLockedDueToCheating: false,
                            status: "submitted",
                            tabSwitchCount: 0,
                          }
                        : null
                    );
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Mở khóa bài thi cho học sinh này</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="ml-auto px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AntiCheat Log AI Inspector Modal */}
      <AntiCheatLogModal
        isOpen={Boolean(selectedAntiCheatSub)}
        onClose={() => setSelectedAntiCheatSub(null)}
        submission={selectedAntiCheatSub}
      />
    </div>
  );
};
