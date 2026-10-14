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
  Layers,
  Save,
  Check,
} from "lucide-react";
import { StudentSubmission, ExamPackage, Question } from "../../types";
import {
  exportSubmissionsToExcel,
  generateGoogleSheetsTSV,
  LETTERS,
} from "../../utils/examHelpers";
import {
  exportSubmissionsMultiSheetExcel,
  generateGoogleSheetsTSVByClass,
  syncSubmissionToGoogleSheetsWebhook,
  GOOGLE_APPS_SCRIPT_SAMPLE_CODE,
} from "../../utils/googleSheetsSync";
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
  const [showGoogleSheetsModal, setShowGoogleSheetsModal] = useState(false);
  const [sheetsModalTab, setSheetsModalTab] = useState<"webhook" | "multisheet_excel" | "tsv_copy">("webhook");
  const [webhookUrl, setWebhookUrl] = useState(() => {
    try {
      return localStorage.getItem("edutest_google_sheets_webhook") || "";
    } catch {
      return "";
    }
  });
  const [targetClassForTSV, setTargetClassForTSV] = useState<string>("all");
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [scriptCopied, setScriptCopied] = useState(false);
  const [tsvClassCopied, setTsvClassCopied] = useState(false);

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
      ? (submissions.reduce((acc, curr) => acc + (typeof curr.score === "number" ? curr.score : 0), 0) / totalStudents).toFixed(2)
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

  // Handle Export to Excel (Single Sheet - Existing)
  const handleExportExcel = () => {
    exportSubmissionsToExcel(filteredSubmissions, "Bang_Diem_EduExam");
  };

  // Handle Export to Multi-Sheet Excel by Class
  const handleExportMultiSheetExcel = () => {
    exportSubmissionsMultiSheetExcel(submissions, "Bang_Diem_EduTest_Phan_Lop");
  };

  // Handle Save Webhook URL
  const handleSaveWebhookUrl = () => {
    try {
      localStorage.setItem("edutest_google_sheets_webhook", webhookUrl.trim());
      setSyncStatusMsg("✓ Đã lưu cấu hình Google Sheets Webhook! Bài thi nộp mới sẽ tự động đồng bộ theo lớp.");
      setTimeout(() => setSyncStatusMsg(null), 5000);
    } catch (e) {
      console.error(e);
    }
  };

  // Handle Sync All Existing Submissions
  const handleSyncAllSubmissions = async () => {
    if (!webhookUrl.trim()) {
      alert("Vui lòng nhập URL Google Apps Script Webhook trước khi đồng bộ!");
      return;
    }
    setIsSyncingAll(true);
    setSyncStatusMsg(`Đang đồng bộ ${submissions.length} bài thi lên Google Sheets...`);
    let successCount = 0;
    let failCount = 0;
    for (const s of submissions) {
      const res = await syncSubmissionToGoogleSheetsWebhook(s, webhookUrl.trim());
      if (res.success) successCount++;
      else failCount++;
    }
    setIsSyncingAll(false);
    setSyncStatusMsg(`✓ Đã hoàn tất: ${successCount} bài thi đã đồng bộ thành công sang Google Sheets (tự động phân theo từng tab lớp).${failCount > 0 ? ` (${failCount} lỗi)` : ""}`);
  };

  // Handle Copy Google Apps Script Code
  const handleCopyAppsScript = async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_SAMPLE_CODE);
      setScriptCopied(true);
      setTimeout(() => setScriptCopied(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Copy TSV by selected Class
  const handleCopyTSVByClass = async () => {
    const tsvData = generateGoogleSheetsTSVByClass(submissions, targetClassForTSV);
    try {
      await navigator.clipboard.writeText(tsvData);
      setTsvClassCopied(true);
      setTimeout(() => setTsvClassCopied(false), 3000);
    } catch (err) {
      console.error(err);
    }
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
              id="btn-open-google-sheets-modal"
              onClick={() => setShowGoogleSheetsModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow active:scale-95"
              title="Đồng bộ Google Sheets tự động phân theo lớp & lưu đầy đủ đáp án, nhật ký"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
              <span>📊 Đồng Bộ Google Sheets (Tự Động Theo Lớp)</span>
            </button>

            <button
              type="button"
              onClick={handleExportMultiSheetExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
              title="Xuất file Excel gồm nhiều sheet tự động phân chia theo từng lớp học"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Xuất Excel Đa Lớp (.xlsx)</span>
            </button>

            <button
              type="button"
              id="btn-copy-google-sheet"
              onClick={handleCopyForGoogleSheets}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200 transition-colors shadow-xs"
              title="Copy nhanh bảng điểm vào Clipboard để dán"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copySuccess ? "Đã copy!" : "Copy Nhanh TSV"}</span>
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
                            <span className="font-bold text-indigo-700 font-mono text-xs">{typeof sub.score === "number" ? sub.score.toFixed(2) : "--"} đ</span>
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
                                  : (sub.score || 0) >= 8
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
                          {((sub.durationTakenSeconds || 0) / 60).toFixed(1)} phút
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
                    {typeof selectedSubmission.score === "number" ? selectedSubmission.score.toFixed(2) : "--"}
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

      {/* Google Sheets Class-Based Sync Modal */}
      {showGoogleSheetsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
                  <FileSpreadsheet className="w-6 h-6 text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Đồng Bộ Điểm & Đáp Án Sang Google Sheets</h3>
                  <p className="text-xs text-emerald-100 font-medium">
                    Tự động phân tách dữ liệu theo từng lớp học, kèm đầy đủ đáp án & biên bản vi phạm
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGoogleSheetsModal(false)}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-6 shrink-0 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSheetsModalTab("webhook")}
                className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
                  sheetsModalTab === "webhook"
                    ? "border-emerald-600 text-emerald-800 bg-white rounded-t-xl"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Zap className="w-4 h-4 text-emerald-600" />
                <span>⚡ Tự Động Real-time (Webhook)</span>
              </button>

              <button
                type="button"
                onClick={() => setSheetsModalTab("multisheet_excel")}
                className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
                  sheetsModalTab === "multisheet_excel"
                    ? "border-emerald-600 text-emerald-800 bg-white rounded-t-xl"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>📑 File Excel Đa Sheet Theo Lớp</span>
              </button>

              <button
                type="button"
                onClick={() => setSheetsModalTab("tsv_copy")}
                className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
                  sheetsModalTab === "tsv_copy"
                    ? "border-emerald-600 text-emerald-800 bg-white rounded-t-xl"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Copy className="w-4 h-4 text-emerald-600" />
                <span>📋 Sao Chép TSV Dán Thủ Công</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700">
              {/* TAB 1: WEBHOOK REAL-TIME SYNC */}
              {sheetsModalTab === "webhook" && (
                <div className="space-y-6">
                  {/* Explanatory Banner */}
                  <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-emerald-950 space-y-1">
                      <p className="font-bold">Cơ chế đồng bộ tự động theo từng lớp:</p>
                      <p>
                        Khi học sinh bấm nộp bài (hoặc bị loại do gian lận), hệ thống sẽ gửi dữ liệu trực tiếp về Google Sheets của thầy cô. Script sẽ <strong>tự động tìm hoặc tạo mới một Tab (Sheet) mang tên lớp của học sinh đó</strong> (ví dụ: <code className="bg-emerald-100 px-1 py-0.5 rounded text-emerald-900 font-mono font-bold">12A1</code>, <code className="bg-emerald-100 px-1 py-0.5 rounded text-emerald-900 font-mono font-bold">12A2</code>), đồng thời ghi nhận vào Sheet tổng hợp. Thí sinh vi phạm sẽ được tự động tô nền đỏ cảnh báo!
                      </p>
                    </div>
                  </div>

                  {/* Webhook URL Input Form */}
                  <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      URL Webhook Google Apps Script (Web App URL)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                        className="flex-1 px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleSaveWebhookUrl}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shrink-0 shadow-xs"
                      >
                        <Save className="w-4 h-4" />
                        <span>Lưu cấu hình</span>
                      </button>
                    </div>
                    {webhookUrl && webhookUrl.trim().startsWith("http") && (
                      <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 mt-1">
                        <Check className="w-3.5 h-3.5" />
                        Đang kích hoạt: Bài nộp mới sẽ tự động đồng bộ ngay lập tức!
                      </p>
                    )}
                  </div>

                  {/* Manual Sync All Button */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Đồng bộ toàn bộ bài thi hiện có</h4>
                      <p className="text-xs text-slate-500">
                        Đang có <strong>{submissions.length}</strong> bài thi đã thu thập trong hệ thống.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isSyncingAll || submissions.length === 0 || !webhookUrl.trim()}
                      onClick={handleSyncAllSubmissions}
                      className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-2 shrink-0 shadow-xs"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncingAll ? "animate-spin" : ""}`} />
                      <span>{isSyncingAll ? "Đang đồng bộ..." : `Đẩy toàn bộ (${submissions.length}) bài lên Sheet`}</span>
                    </button>
                  </div>

                  {syncStatusMsg && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 font-medium">
                      {syncStatusMsg}
                    </div>
                  )}

                  {/* Code Box & Instructions */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Terminal className="w-4 h-4 text-emerald-600" />
                        <span>Mã nguồn Google Apps Script (Tự Động Phân Sheet Theo Lớp)</span>
                      </h4>
                      <button
                        type="button"
                        onClick={handleCopyAppsScript}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                      >
                        {scriptCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{scriptCopied ? "Đã sao chép mã!" : "Sao chép mã Apps Script"}</span>
                      </button>
                    </div>

                    <pre className="p-4 bg-slate-900 text-emerald-300 font-mono text-[11px] rounded-2xl overflow-x-auto max-h-56 leading-relaxed border border-slate-800 select-all">
                      {GOOGLE_APPS_SCRIPT_SAMPLE_CODE}
                    </pre>

                    {/* Step-by-step Setup Guide */}
                    <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2 text-xs text-amber-950">
                      <p className="font-bold flex items-center gap-1.5 text-amber-900">
                        <HelpCircle className="w-4 h-4 text-amber-700" />
                        <span>Hướng dẫn thiết lập 2 phút trên Google Sheets:</span>
                      </p>
                      <ol className="list-decimal list-inside space-y-1 pl-1 text-[11px] leading-relaxed">
                        <li>
                          Mở file Google Sheets của thầy cô &rarr; Vào menu <strong>Tiện ích mở rộng (Extensions)</strong> &rarr; Chọn <strong>Apps Script</strong>.
                        </li>
                        <li>
                          Xóa mã mặc định, <strong>Dán mã ở trên</strong> vào và nhấn biểu tượng <strong>Lưu (Ctrl + S)</strong>.
                        </li>
                        <li>
                          Nhấn nút xanh <strong>Triển khai (Deploy)</strong> ở góc phải &rarr; Chọn <strong>Tùy chọn triển khai mới (New deployment)</strong>.
                        </li>
                        <li>
                          Nhấp bánh răng (Chọn loại) &rarr; Chọn <strong>Ứng dụng web (Web app)</strong>:
                          <div className="pl-4 py-1 text-slate-700 font-medium">
                            • Mô tả: <span className="font-mono text-emerald-800">EduTest Sync</span><br />
                            • Người thực thi: <strong>Tôi (email của bạn)</strong><br />
                            • Ai có quyền truy cập: <strong className="text-rose-700">Bất kỳ ai (Anyone)</strong> *(Bắt buộc để gửi bài thi)*
                          </div>
                        </li>
                        <li>
                          Nhấn <strong>Triển khai</strong> &rarr; Nhấn <strong>Ủy quyền truy cập</strong> &rarr; Sao chép <strong>URL ứng dụng web</strong> (đuôi <code className="font-mono bg-amber-100 px-1 rounded">/exec</code>) dán vào ô Webhook ở trên rồi bấm <strong>Lưu cấu hình</strong>.
                        </li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: MULTI-SHEET EXCEL EXPORT */}
              {sheetsModalTab === "multisheet_excel" && (
                <div className="space-y-6">
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start gap-3">
                    <Layers className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-emerald-950 space-y-1">
                      <p className="font-bold">Xuất file Excel thông minh tự động chia Sheet theo lớp:</p>
                      <p>
                        Mỗi lớp học sẽ được tự động tách thành 1 Sheet (Tab) riêng biệt trong file Excel (ví dụ: <code className="bg-white px-1 py-0.5 rounded font-mono font-bold">Lớp 12A1</code>, <code className="bg-white px-1 py-0.5 rounded font-mono font-bold">Lớp 12A2</code>...), đồng thời có 1 Tab <code className="bg-white px-1 py-0.5 rounded font-mono font-bold">Tất Cả Các Lớp</code> để xem toàn cục.
                      </p>
                      <p>
                        Thầy cô có thể mở trực tiếp bằng Microsoft Excel hoặc tải lên Google Drive / Google Sheets (chọn <em>Tệp &rarr; Nhập &rarr; Tải lên</em>) để có đầy đủ các tab lớp ngay tức thì.
                      </p>
                    </div>
                  </div>

                  {/* Class Summary Breakdown */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Danh sách các lớp nhận diện được ({classesList.length} lớp):
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {classesList.map((cls) => {
                        const count = submissions.filter((s) => s.studentClass === cls).length;
                        const locked = submissions.filter((s) => s.studentClass === cls && s.isLockedDueToCheating).length;
                        return (
                          <div key={cls} className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                            <div className="font-bold text-slate-800 text-sm">Lớp {cls}</div>
                            <div className="text-xs text-slate-500 mt-1">{count} thí sinh</div>
                            {locked > 0 && (
                              <div className="text-[10px] text-rose-600 font-bold mt-0.5 flex items-center gap-1">
                                <ShieldAlert className="w-3 h-3" />
                                <span>{locked} bị loại gian lận</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {classesList.length === 0 && (
                        <div className="col-span-4 p-4 text-center text-xs text-slate-400">
                          Chưa có thí sinh nộp bài để thống kê lớp.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Included Columns Description */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                    <p className="font-bold text-slate-700">Các thông tin đầy đủ có trong mỗi Sheet của lớp:</p>
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      {[
                        "STT",
                        "Mã HS",
                        "Họ và Tên",
                        "Lớp",
                        "Mã Đề",
                        "Điểm Số",
                        "Số Câu Đúng / Tổng",
                        "Thời Gian Làm",
                        "Đáp Án Chi Tiết (Phần I, II, III)",
                        "Số Lần Chuyển Tab",
                        "Cảnh Báo Gian Lận",
                        "Biên Bản Vi Phạm Thời Gian Thực",
                        "Thời Điểm Nộp",
                      ].map((col) => (
                        <span key={col} className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium">
                          ✓ {col}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Export Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleExportMultiSheetExcel}
                      className="w-full sm:w-auto px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span>Tải File Excel Đa Sheet Phân Theo Lớp Ngay (.xlsx)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: CLASS TSV COPY FOR GOOGLE SHEETS */}
              {sheetsModalTab === "tsv_copy" && (
                <div className="space-y-6">
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start gap-3">
                    <Copy className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-emerald-950 space-y-1">
                      <p className="font-bold">Sao chép nhanh dán vào Google Sheets theo lớp:</p>
                      <p>
                        Nếu thầy cô đã có sẵn file Google Sheets và muốn dán trực tiếp kết quả của một lớp cụ thể vào Sheet của lớp đó: Thầy cô chỉ cần chọn lớp, bấm <strong>Sao chép</strong>, sau đó mở tab lớp đó trên Google Sheets và nhấn <strong>Ctrl + V</strong> (ô A1).
                      </p>
                    </div>
                  </div>

                  {/* Class Filter Selection */}
                  <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Chọn lớp cần sao chép dữ liệu:
                    </label>
                    <select
                      value={targetClassForTSV}
                      onChange={(e) => setTargetClassForTSV(e.target.value)}
                      className="w-full sm:w-80 px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="all">Tất cả các lớp ({submissions.length} bài thi)</option>
                      {classesList.map((c) => {
                        const count = submissions.filter((s) => s.studentClass === c).length;
                        return (
                          <option key={c} value={c}>
                            Lớp {c} ({count} bài thi)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Copy Button */}
                  <div>
                    <button
                      type="button"
                      onClick={handleCopyTSVByClass}
                      className="w-full sm:w-auto px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      {tsvClassCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      <span>
                        {tsvClassCopied
                          ? "✓ Đã sao chép vào Clipboard! Hãy sang Google Sheets bấm Ctrl + V"
                          : `Sao chép dữ liệu ${targetClassForTSV === "all" ? "tất cả các lớp" : `Lớp ${targetClassForTSV}`} để dán vào Sheet`}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowGoogleSheetsModal(false)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors"
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
