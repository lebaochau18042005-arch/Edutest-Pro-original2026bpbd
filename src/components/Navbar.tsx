import React from "react";
import {
  GraduationCap,
  Shuffle,
  ShieldAlert,
  BookOpen,
  UserCheck,
  Sparkles,
  Upload,
  CheckCircle2,
  History,
  Flame,
  FileSpreadsheet,
  ChevronRight,
} from "lucide-react";
import { AppRole, TeacherTab, StudentTab } from "../types";

interface SidebarNavbarProps {
  currentRole: AppRole;
  setCurrentRole: (role: AppRole) => void;
  teacherTab: TeacherTab;
  setTeacherTab: (tab: TeacherTab) => void;
  studentTab?: StudentTab;
  setStudentTab?: (tab: StudentTab) => void;
  activeExamCount: number;
  submissionCount: number;
  lockedViolationCount: number;
  onQuickLaunchStudentTest: () => void;
}

export const SidebarNav: React.FC<SidebarNavbarProps> = ({
  currentRole,
  setCurrentRole,
  teacherTab,
  setTeacherTab,
  studentTab = "online_test",
  setStudentTab,
  activeExamCount,
  submissionCount,
  lockedViolationCount,
  onQuickLaunchStudentTest,
}) => {
  return (
    <aside className="w-72 bg-slate-950 text-white flex flex-col p-5 shrink-0 border-r border-slate-800 min-h-screen">
      {/* Brand Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center font-black text-xl text-white shadow-lg shadow-blue-500/20 ring-2 ring-blue-400/20">
          ET
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
            <span>EduTest Pro</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-mono font-bold border border-blue-500/30">
              v3.1
            </span>
          </h1>
          <p className="text-[11px] text-slate-400 font-medium">Khảo thí & Chấm thi AI</p>
        </div>
      </div>

      {/* Role Quick Switcher Pills */}
      <div className="p-1 bg-slate-900 rounded-xl border border-slate-800 mb-6 grid grid-cols-2 gap-1">
        <button
          type="button"
          id="sidebar-role-teacher"
          onClick={() => setCurrentRole("teacher")}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
            currentRole === "teacher"
              ? "bg-blue-600 text-white shadow-md font-bold"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5" />
          <span>Giáo Viên</span>
          {currentRole === "teacher" && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          )}
        </button>

        <button
          type="button"
          id="sidebar-role-student"
          onClick={() => setCurrentRole("student")}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
            currentRole === "student"
              ? "bg-emerald-600 text-white shadow-md font-bold"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Học Sinh</span>
          {currentRole === "student" && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          )}
        </button>
      </div>

      {/* Dual Nav Menus Container */}
      <nav className="flex-1 space-y-6 overflow-y-auto pr-1">
        {/* THANH 1: ĐIỀU HƯỚNG GIÁO VIÊN */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-blue-400">
            <span className="flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Thanh Giáo Viên</span>
            </span>
            {currentRole === "teacher" && (
              <span className="px-1.5 py-0.2 text-[9px] bg-blue-500/20 text-blue-300 rounded font-mono">
                ĐANG CHỌN
              </span>
            )}
          </div>

          <div className="space-y-1">
            <button
              type="button"
              id="sidebar-tab-shuffler"
              onClick={() => {
                setCurrentRole("teacher");
                setTeacherTab("shuffler");
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left text-xs ${
                currentRole === "teacher" && teacherTab === "shuffler"
                  ? "bg-blue-600/25 text-blue-300 border border-blue-500/40 font-bold shadow-xs"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent"
              }`}
            >
              <Shuffle className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="flex-1">Trộn đề & Cấu hình</span>
              <span className="text-[10px] font-mono text-slate-500">4 mã</span>
            </button>

            <button
              type="button"
              id="sidebar-tab-bank"
              onClick={() => {
                setCurrentRole("teacher");
                setTeacherTab("bank");
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left text-xs ${
                currentRole === "teacher" && teacherTab === "bank"
                  ? "bg-blue-600/25 text-blue-300 border border-blue-500/40 font-bold shadow-xs"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent"
              }`}
            >
              <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="flex-1">Ngân hàng đề & AI</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] bg-indigo-500/20 text-indigo-300 font-bold">
                GDPT 2018
              </span>
            </button>

            <button
              type="button"
              id="sidebar-tab-monitoring"
              onClick={() => {
                setCurrentRole("teacher");
                setTeacherTab("monitoring");
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left text-xs relative ${
                currentRole === "teacher" && teacherTab === "monitoring"
                  ? "bg-blue-600/25 text-blue-300 border border-blue-500/40 font-bold shadow-xs"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent"
              }`}
            >
              <ShieldAlert
                className={`w-4 h-4 shrink-0 ${
                  lockedViolationCount > 0 ? "text-red-400 animate-pulse" : "text-amber-400"
                }`}
              />
              <span className="flex-1">Lịch sử & Giám sát</span>
              {submissionCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-900/60 text-blue-300 border border-blue-700/50">
                  {submissionCount}
                </span>
              )}
            </button>

            <button
              type="button"
              id="sidebar-tab-grader"
              onClick={() => {
                setCurrentRole("teacher");
                setTeacherTab("grader");
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left text-xs relative ${
                currentRole === "teacher" && teacherTab === "grader"
                  ? "bg-blue-600/25 text-blue-300 border border-blue-500/40 font-bold shadow-xs"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent"
              }`}
            >
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="flex-1 font-semibold text-slate-200">Chấm Bài AI (OMR)</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                MỚI
              </span>
            </button>
          </div>

          {lockedViolationCount > 0 && (
            <div className="p-2.5 bg-red-950/50 border border-red-800/60 rounded-xl text-red-300 text-xs flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
              <span className="font-semibold text-[11px]">{lockedViolationCount} bài thi bị khóa</span>
            </div>
          )}
        </div>

        {/* PHÂN CÁCH TRỰC QUAN */}
        <div className="border-t border-slate-800/80 pt-4">
          {/* THANH 2: ĐIỀU HƯỚNG HỌC SINH */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              <span className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" />
                <span>Thanh Học Sinh</span>
              </span>
              {currentRole === "student" && (
                <span className="px-1.5 py-0.2 text-[9px] bg-emerald-500/20 text-emerald-300 rounded font-mono">
                  ĐANG CHỌN
                </span>
              )}
            </div>

            <div className="space-y-1">
              <button
                type="button"
                id="sidebar-student-tab-online"
                onClick={() => {
                  setCurrentRole("student");
                  if (setStudentTab) setStudentTab("online_test");
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left text-xs ${
                  currentRole === "student" && studentTab === "online_test"
                    ? "bg-emerald-600/25 text-emerald-300 border border-emerald-500/40 font-bold shadow-xs"
                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent"
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="flex-1">Phòng thi trực tuyến</span>
                <span className="text-[10px] text-slate-500">Giám sát AI</span>
              </button>

              <button
                type="button"
                id="sidebar-student-tab-upload"
                onClick={() => {
                  setCurrentRole("student");
                  if (setStudentTab) setStudentTab("upload_paper");
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left text-xs ${
                  currentRole === "student" && studentTab === "upload_paper"
                    ? "bg-emerald-600/25 text-emerald-300 border border-emerald-500/40 font-bold shadow-xs"
                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent"
                }`}
              >
                <Upload className="w-4 h-4 text-teal-400 shrink-0" />
                <span className="flex-1">Nộp phiếu / Chấm AI</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-teal-500/20 text-teal-300 font-bold">
                  Ảnh/PDF
                </span>
              </button>

              <button
                type="button"
                id="sidebar-student-tab-history"
                onClick={() => {
                  setCurrentRole("student");
                  if (setStudentTab) setStudentTab("history_results");
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left text-xs ${
                  currentRole === "student" && studentTab === "history_results"
                    ? "bg-emerald-600/25 text-emerald-300 border border-emerald-500/40 font-bold shadow-xs"
                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent"
                }`}
              >
                <History className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="flex-1">Tra cứu điểm & bài thi</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Quick Launch CTA */}
      <div className="my-3 pt-2">
        <button
          type="button"
          id="btn-sidebar-quick-launch"
          onClick={onQuickLaunchStudentTest}
          className="w-full py-2.5 px-3 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl text-xs font-bold border border-blue-500/40 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30"
        >
          <Flame className="w-3.5 h-3.5 text-amber-300" />
          <span>Vào thi thử nhanh (Mã TOAN12)</span>
        </button>
      </div>

      {/* Teacher / User Card Footer with Author Info */}
      <div className="mt-auto p-3.5 bg-gradient-to-b from-slate-900 to-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
        <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider font-bold">
          <span>THÔNG TIN TÁC GIẢ</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
        </div>
        <p className="font-bold text-amber-300 text-xs">Cô LÊ THỊ THÁI</p>
        <p className="text-[11px] text-slate-300">GV Môn Địa Lý</p>
        <p className="text-[10px] text-slate-400">THPT Bình Phú - Bình Dương</p>
        <a
          href="https://zalo.me/0916791779"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center justify-center gap-1.5 w-full py-1.5 px-2 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-300 rounded-lg text-[11px] font-bold transition-colors"
        >
          <span>Zalo: 0916.791.779</span>
        </a>
      </div>
    </aside>
  );
};

export const Navbar = SidebarNav;
