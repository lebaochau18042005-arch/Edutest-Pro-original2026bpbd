import React from "react";
import {
  GraduationCap,
  UserCheck,
  Shuffle,
  BookOpen,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  Upload,
  History,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  Flame,
  Table,
} from "lucide-react";
import { AppRole, TeacherTab, StudentTab } from "../types";

interface DualNavigationBarProps {
  currentRole: AppRole;
  setCurrentRole: (role: AppRole) => void;
  teacherTab: TeacherTab;
  setTeacherTab: (tab: TeacherTab) => void;
  studentTab: StudentTab;
  setStudentTab: (tab: StudentTab) => void;
  activeExamCount: number;
  submissionCount: number;
  lockedViolationCount: number;
  onQuickLaunchStudentTest?: () => void;
}

export const DualNavigationBar: React.FC<DualNavigationBarProps> = ({
  currentRole,
  setCurrentRole,
  teacherTab,
  setTeacherTab,
  studentTab,
  setStudentTab,
  activeExamCount,
  submissionCount,
  lockedViolationCount,
  onQuickLaunchStudentTest,
}) => {
  return (
    <div className="w-full bg-white border-b border-slate-200 shadow-xs px-4 sm:px-8 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        {/* THANH 1: ĐIỀU HƯỚNG GIÁO VIÊN */}
        <div
          className={`flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-1.5 rounded-2xl border transition-all ${
            currentRole === "teacher"
              ? "bg-blue-50/70 border-blue-200 ring-2 ring-blue-500/20 shadow-xs"
              : "bg-slate-50/80 border-slate-200 hover:border-slate-300"
          }`}
        >
          {/* Header Label Tag for Teacher */}
          <button
            type="button"
            id="dualnav-teacher-badge"
            onClick={() => setCurrentRole("teacher")}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              currentRole === "teacher"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span className="uppercase tracking-wider">Thanh Giáo Viên</span>
            {currentRole === "teacher" && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          {/* Teacher Navigation Items */}
          <div className="flex-1 grid grid-cols-2 sm:flex items-center gap-1 sm:gap-1.5 overflow-x-auto">
            <button
              type="button"
              id="dualnav-teacher-shuffler"
              onClick={() => {
                setCurrentRole("teacher");
                setTeacherTab("shuffler");
              }}
              className={`flex items-center justify-center sm:justify-start gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                currentRole === "teacher" && teacherTab === "shuffler"
                  ? "bg-white text-blue-700 shadow-xs border border-blue-200 font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <Shuffle className="w-3.5 h-3.5 text-blue-500" />
              <span>Trộn Đề & Cấu Hình</span>
            </button>

            <button
              type="button"
              id="dualnav-teacher-bank"
              onClick={() => {
                setCurrentRole("teacher");
                setTeacherTab("bank");
              }}
              className={`flex items-center justify-center sm:justify-start gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                currentRole === "teacher" && teacherTab === "bank"
                  ? "bg-white text-blue-700 shadow-xs border border-blue-200 font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
              <span>Ngân Hàng Đề & AI</span>
            </button>

            <button
              type="button"
              id="dualnav-teacher-monitoring"
              onClick={() => {
                setCurrentRole("teacher");
                setTeacherTab("monitoring");
              }}
              className={`flex items-center justify-center sm:justify-start gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap relative ${
                currentRole === "teacher" && teacherTab === "monitoring"
                  ? "bg-white text-blue-700 shadow-xs border border-blue-200 font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <ShieldAlert
                className={`w-3.5 h-3.5 ${
                  lockedViolationCount > 0 ? "text-rose-500 animate-bounce" : "text-amber-500"
                }`}
              />
              <span>Giám Sát & Lịch Sử</span>
              {submissionCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                  {submissionCount}
                </span>
              )}
            </button>

            <button
              type="button"
              id="dualnav-teacher-grader"
              onClick={() => {
                setCurrentRole("teacher");
                setTeacherTab("grader");
              }}
              className={`flex items-center justify-center sm:justify-start gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                currentRole === "teacher" && teacherTab === "grader"
                  ? "bg-white text-blue-700 shadow-xs border border-blue-200 font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              <span className="px-1 py-0.2 rounded-sm text-[9px] font-bold bg-emerald-100 text-emerald-800">
                OMR
              </span>
            </button>

            <button
              type="button"
              id="dualnav-teacher-matrix"
              onClick={() => {
                setCurrentRole("teacher");
                setTeacherTab("matrix");
              }}
              className={`flex items-center justify-center sm:justify-start gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                currentRole === "teacher" && teacherTab === "matrix"
                  ? "bg-white text-purple-700 shadow-xs border border-purple-200 font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <Table className="w-3.5 h-3.5 text-purple-500" />
              <span>Ma Trận Đề GDPT 2018</span>
            </button>
          </div>
        </div>

        {/* THANH 2: ĐIỀU HƯỚNG HỌC SINH */}
        <div
          className={`flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-1.5 rounded-2xl border transition-all ${
            currentRole === "student"
              ? "bg-emerald-50/70 border-emerald-200 ring-2 ring-emerald-500/20 shadow-xs"
              : "bg-slate-50/80 border-slate-200 hover:border-slate-300"
          }`}
        >
          {/* Header Label Tag for Student */}
          <button
            type="button"
            id="dualnav-student-badge"
            onClick={() => setCurrentRole("student")}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              currentRole === "student"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span className="uppercase tracking-wider">Thanh Học Sinh</span>
            {currentRole === "student" && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>

          {/* Student Navigation Items */}
          <div className="flex-1 grid grid-cols-2 sm:flex items-center gap-1 sm:gap-1.5 overflow-x-auto">
            <button
              type="button"
              id="dualnav-student-online"
              onClick={() => {
                setCurrentRole("student");
                setStudentTab("online_test");
              }}
              className={`flex items-center justify-center sm:justify-start gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                currentRole === "student" && studentTab === "online_test"
                  ? "bg-white text-emerald-800 shadow-xs border border-emerald-200 font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Phòng Thi Trực Tuyến</span>
            </button>

            <button
              type="button"
              id="dualnav-student-upload"
              onClick={() => {
                setCurrentRole("student");
                setStudentTab("upload_paper");
              }}
              className={`flex items-center justify-center sm:justify-start gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                currentRole === "student" && studentTab === "upload_paper"
                  ? "bg-white text-emerald-800 shadow-xs border border-emerald-200 font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <Upload className="w-3.5 h-3.5 text-teal-600" />
              <span>Nộp Phiếu Chấm AI</span>
            </button>

            <button
              type="button"
              id="dualnav-student-history"
              onClick={() => {
                setCurrentRole("student");
                setStudentTab("history_results");
              }}
              className={`flex items-center justify-center sm:justify-start gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                currentRole === "student" && studentTab === "history_results"
                  ? "bg-white text-emerald-800 shadow-xs border border-emerald-200 font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <History className="w-3.5 h-3.5 text-cyan-600" />
              <span>Tra Cứu Điểm & Bài Thi</span>
            </button>

            {onQuickLaunchStudentTest && (
              <button
                type="button"
                id="dualnav-student-quick-launch"
                onClick={onQuickLaunchStudentTest}
                className="hidden md:flex items-center gap-1 px-2.5 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-xs font-bold transition-all ml-auto shrink-0"
              >
                <Flame className="w-3.5 h-3.5 text-emerald-600" />
                <span>Thi Ngay</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
