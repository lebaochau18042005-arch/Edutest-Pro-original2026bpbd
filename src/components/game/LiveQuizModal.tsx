import React, { useState } from "react";
import { LiveQuizHostView } from "./LiveQuizHostView";
import { LiveQuizPlayerView } from "./LiveQuizPlayerView";
import { Question, ExamConfig } from "../../types";
import { Gamepad2, ScreenShare, Smartphone, X } from "lucide-react";

interface LiveQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: Question[];
  config?: Partial<ExamConfig>;
}

export const LiveQuizModal: React.FC<LiveQuizModalProps> = ({
  isOpen,
  onClose,
  questions,
  config,
}) => {
  const [mode, setMode] = useState<"select" | "host" | "player">("select");

  if (!isOpen) return null;

  if (mode === "host") {
    return (
      <LiveQuizHostView
        questions={questions}
        config={config}
        onClose={() => {
          setMode("select");
          onClose();
        }}
      />
    );
  }

  if (mode === "player") {
    return (
      <LiveQuizPlayerView
        onClose={() => {
          setMode("select");
          onClose();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 text-center space-y-6 text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-red-500 flex items-center justify-center text-xl shadow-lg">
              🎮
            </div>
            <div className="text-left">
              <h3 className="text-base font-extrabold text-white">Đấu Trường Live Quiz</h3>
              <p className="text-xs text-slate-400">Chọn vai trò để bắt đầu trải nghiệm</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Host Mode */}
          <button
            type="button"
            onClick={() => setMode("host")}
            className="p-5 rounded-2xl bg-gradient-to-b from-indigo-900/50 to-slate-800 border-2 border-indigo-500/50 hover:border-indigo-400 hover:scale-[1.02] flex flex-col items-center justify-center space-y-3 transition-all text-center group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <ScreenShare className="w-6 h-6" />
            </div>
            <div>
              <span className="font-extrabold text-sm text-white block">Màn Hình Giáo Viên (Host)</span>
              <span className="text-[11px] text-slate-400 mt-1 block leading-relaxed">
                Chiếu máy chiếu cho cả lớp: Mã PIN, đồng hồ đếm ngược, xếp hạng Top 5 và Podium.
              </span>
            </div>
          </button>

          {/* Player Mode */}
          <button
            type="button"
            onClick={() => setMode("player")}
            className="p-5 rounded-2xl bg-gradient-to-b from-amber-950/40 to-slate-800 border-2 border-amber-500/50 hover:border-amber-400 hover:scale-[1.02] flex flex-col items-center justify-center space-y-3 transition-all text-center group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <span className="font-extrabold text-sm text-white block">Màn Hình Thí Sinh (Player)</span>
              <span className="text-[11px] text-slate-400 mt-1 block leading-relaxed">
                Giao diện điện thoại 4 nút màu cảm ứng, phản hồi đúng/sai tức thì và tính điểm tốc độ.
              </span>
            </div>
          </button>
        </div>

        <p className="text-[11px] text-slate-400">
          Hiện có <strong>{questions.length} câu hỏi</strong> sẵn sàng cho vòng thi đấu!
        </p>
      </div>
    </div>
  );
};
