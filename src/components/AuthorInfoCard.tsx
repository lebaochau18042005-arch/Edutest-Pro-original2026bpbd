import React, { useState } from "react";
import { User, Phone, School, BookOpen, Award, Check, Copy, ExternalLink, ShieldCheck, Sparkles, MessageCircle } from "lucide-react";

export const AuthorInfoCard: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const handleCopyZalo = () => {
    navigator.clipboard.writeText("0916791779");
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="w-full bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-xl border border-blue-700/40 relative overflow-hidden mb-6">
      {/* Background ambient decorations */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        {/* Left column: App and Author Info */}
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-blue-500 to-teal-400 p-0.5 shadow-lg shadow-blue-500/30 shrink-0">
            <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center font-black text-2xl text-transparent bg-clip-text bg-gradient-to-tr from-blue-400 to-teal-300">
              ET
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-blue-500/25 text-blue-300 border border-blue-400/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-300" />
                Hệ thống Khảo thí & Chấm thi AI
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                GDPT 2018
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              EduTest Pro
              <span className="text-xs px-2 py-0.5 rounded bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black">
                PRO 2026
              </span>
            </h1>

            {/* Author Profile Details */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm text-slate-200 pt-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <User className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Tác giả: Cô LÊ THỊ THÁI</span>
              </div>

              <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                <BookOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>GV Môn Địa Lý</span>
              </div>

              <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                <School className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Trường THPT Bình Phú - Bình Dương</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Action & Zalo Contact buttons */}
        <div className="w-full lg:w-auto flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
          {/* Zalo Direct Button */}
          <a
            href="https://zalo.me/0916791779"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-blue-600/30 transition-all transform hover:-translate-y-0.5 border border-blue-400/40"
          >
            <MessageCircle className="w-4 h-4 text-white shrink-0 fill-white/20" />
            <span>Zalo: 0916.791.779</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </a>

          {/* Copy Phone Button */}
          <button
            type="button"
            onClick={handleCopyZalo}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all border ${
              copied
                ? "bg-emerald-600/30 border-emerald-400 text-emerald-300"
                : "bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-200"
            }`}
            title="Sao chép số điện thoại Zalo"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Đã sao chép!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-400" />
                <span>Sao chép SĐT</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
