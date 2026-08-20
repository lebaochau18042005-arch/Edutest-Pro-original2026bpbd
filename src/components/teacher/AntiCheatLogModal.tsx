import React from "react";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Clock,
  User,
  X,
  FileText,
  AlertCircle,
  Copy,
  Terminal,
  ExternalLink,
} from "lucide-react";
import { StudentSubmission } from "../../types";
import { calculateTrustScore } from "../../utils/cloudSyncManager";

interface AntiCheatLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: StudentSubmission | null;
}

export const AntiCheatLogModal: React.FC<AntiCheatLogModalProps> = ({
  isOpen,
  onClose,
  submission,
}) => {
  if (!isOpen || !submission) return null;

  const { trustScore, riskLevel, trustLabel, violationsCount } =
    calculateTrustScore(submission);

  const logs = submission.violationLogs || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-md ${
                riskLevel === "safe"
                  ? "bg-emerald-100 text-emerald-700"
                  : riskLevel === "warning"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-rose-100 text-rose-700 animate-pulse"
              }`}
            >
              {riskLevel === "safe" ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <ShieldAlert className="w-6 h-6" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Báo Cáo Giám Thị AI & Nhật Ký Vi Phạm
              </h3>
              <p className="text-xs text-slate-500">
                Thí sinh: <strong>{submission.studentName}</strong> ({submission.studentClass}) • Lớp: {submission.grade}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Trust Score Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
          {/* Trust Score */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Chỉ số tin cậy (Trust Score)
            </span>
            <div
              className={`text-3xl font-black font-mono ${
                trustScore >= 85
                  ? "text-emerald-600"
                  : trustScore >= 60
                  ? "text-amber-600"
                  : "text-rose-600"
              }`}
            >
              {trustScore}%
            </div>
            <span className="text-[11px] font-bold text-slate-700 block">
              {trustLabel}
            </span>
          </div>

          {/* Tab Switches */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Số lần rời màn hình
            </span>
            <div className="text-3xl font-black font-mono text-slate-800">
              {submission.tabSwitchCount || 0}
            </div>
            <span className="text-[11px] text-slate-500 block">
              Vi phạm giới hạn quy chế
            </span>
          </div>

          {/* Copy / DevTools */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Cảnh báo dán/F12
            </span>
            <div className="text-3xl font-black font-mono text-slate-800">
              {(submission.copyPasteCount || 0) + (submission.devToolsCount || 0)}
            </div>
            <span className="text-[11px] text-slate-500 block">
              Thao tác dán hoặc mở DevTools
            </span>
          </div>
        </div>

        {/* Detailed Timeline Log */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Mốc thời gian vi phạm chi tiết ({logs.length} sự kiện)</span>
          </h4>

          {logs.length === 0 ? (
            <div className="p-6 text-center bg-emerald-50/50 rounded-2xl border border-emerald-100 text-emerald-800 text-xs font-semibold space-y-1">
              <ShieldCheck className="w-8 h-8 text-emerald-600 mx-auto" />
              <p>Không ghi nhận bất kỳ hành vi vi phạm nào trong suốt ca thi!</p>
              <p className="text-[11px] text-emerald-600 font-normal">
                Thí sinh hoàn thành bài làm nghiêm túc và tuân thủ quy chế thi trực tuyến.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="p-1.5 rounded-lg bg-rose-100 text-rose-700 shrink-0 mt-0.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </span>
                    <div>
                      <span className="font-bold text-slate-900 block">
                        {log.details || log.message || "Vi phạm quy chế phòng thi"}
                      </span>
                      <span className="text-[11px] text-slate-500 mt-0.5 block">
                        Hành động: <code className="font-mono bg-slate-200 px-1 py-0.5 rounded text-slate-800">{log.type || log.action || "tab_switch"}</code>
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 shrink-0">
                    {log.timestamp ? new Date(log.timestamp).toLocaleTimeString("vi-VN") : `Mốc ${idx + 1}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            Đóng Báo Cáo
          </button>
        </div>
      </div>
    </div>
  );
};
