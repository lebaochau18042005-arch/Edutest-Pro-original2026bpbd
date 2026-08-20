import React, { useState, useEffect } from "react";
import {
  Gamepad2,
  Check,
  X,
  Flame,
  Zap,
  Award,
  RotateCcw,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { LETTERS } from "../../utils/examHelpers";

interface LiveQuizPlayerViewProps {
  pinCode?: string;
  onClose?: () => void;
}

const SHAPES = [
  { name: "A", bg: "bg-red-600 active:bg-red-800", border: "border-red-700", symbol: "▲", color: "#dc2626" },
  { name: "B", bg: "bg-blue-600 active:bg-blue-800", border: "border-blue-700", symbol: "◆", color: "#2563eb" },
  { name: "C", bg: "bg-amber-500 active:bg-amber-700", border: "border-amber-600", symbol: "●", color: "#d97706" },
  { name: "D", bg: "bg-emerald-600 active:bg-emerald-800", border: "border-emerald-700", symbol: "■", color: "#059669" },
];

export const LiveQuizPlayerView: React.FC<LiveQuizPlayerViewProps> = ({
  pinCode = "892415",
  onClose,
}) => {
  const [stage, setStage] = useState<"enter-name" | "waiting" | "answering" | "feedback">("enter-name");
  const [playerName, setPlayerName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("🚀");
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isLastCorrect, setIsLastCorrect] = useState(true);
  const [earnedPoints, setEarnedPoints] = useState(0);

  const avatars = ["🚀", "⭐", "⚡", "🐯", "🦁", "🦊", "🐼", "🦄"];

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    setStage("waiting");
    setTimeout(() => {
      setStage("answering");
    }, 2000);
  };

  const handleSelectOption = (idx: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(idx);

    // Simulated check
    const isRight = Math.random() < 0.8;
    const pts = isRight ? 1000 + Math.floor(Math.random() * 400) : 0;

    setTimeout(() => {
      setIsLastCorrect(isRight);
      setEarnedPoints(pts);
      if (isRight) {
        setScore((s) => s + pts);
        setStreak((st) => st + 1);
      } else {
        setStreak(0);
      }
      setStage("feedback");
    }, 1500);
  };

  const handleNextTurn = () => {
    setSelectedAnswer(null);
    setStage("answering");
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0c101c] text-white flex flex-col font-sans select-none overflow-hidden">
      {/* Mobile Top Bar */}
      <div className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">{selectedAvatar}</span>
          <span className="font-extrabold text-sm text-slate-100 truncate max-w-[120px]">
            {playerName || "Thí sinh"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-mono font-bold">
            {score.toLocaleString()} pts
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded-lg"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col p-4 max-w-md mx-auto w-full justify-center">
        {/* ============ STAGE 1: ENTER NAME & AVATAR ============ */}
        {stage === "enter-name" && (
          <form onSubmit={handleJoin} className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-6 text-center shadow-2xl">
            <div className="space-y-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500 to-red-500 flex items-center justify-center text-2xl shadow-lg">
                🎮
              </div>
              <h2 className="text-2xl font-black text-white">Tham Gia Đấu Trường</h2>
              <p className="text-xs text-slate-400">PIN: <strong className="font-mono text-amber-400">{pinCode}</strong></p>
            </div>

            {/* Avatar picker */}
            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-semibold block">Chọn biểu tượng may mắn:</label>
              <div className="flex justify-center gap-2">
                {avatars.map((av) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setSelectedAvatar(av)}
                    className={`w-10 h-10 rounded-xl text-lg flex items-center justify-center transition-all ${
                      selectedAvatar === av ? "bg-amber-500 ring-2 ring-amber-300 scale-110 shadow-md" : "bg-slate-800 hover:bg-slate-700"
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            {/* Nickname Input */}
            <div>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Nhập biệt danh của em..."
                maxLength={20}
                required
                className="w-full px-4 py-3.5 bg-slate-800 border border-slate-700 rounded-2xl text-sm font-bold text-center text-white focus:outline-hidden focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all placeholder:text-slate-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black text-base rounded-2xl shadow-xl shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
            >
              VÀO PHÒNG ĐẤU 🚀
            </button>
          </form>
        )}

        {/* ============ STAGE 2: WAITING HOST ============ */}
        {stage === "waiting" && (
          <div className="text-center space-y-4 animate-pulse">
            <span className="text-6xl block">{selectedAvatar}</span>
            <h3 className="text-xl font-bold text-white">Em đã ở trong phòng đấu!</h3>
            <p className="text-xs text-slate-400">
              Hãy nhìn lên màn hình máy chiếu của giáo viên để xem câu hỏi...
            </p>
          </div>
        )}

        {/* ============ STAGE 3: ANSWERING 4 BIG BUTTONS ============ */}
        {stage === "answering" && (
          <div className="flex-1 flex flex-col justify-center space-y-3">
            {streak > 1 && (
              <div className="text-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-black text-xs border border-amber-500/30 animate-bounce">
                  <Flame className="w-4 h-4 fill-current text-amber-400" />
                  <span>CHUỖI ĐÚNG {streak} CÂU LIÊN TIẾP!</span>
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3.5 flex-1 max-h-[500px]">
              {SHAPES.map((shape, idx) => {
                const isChosen = selectedAnswer === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={selectedAnswer !== null}
                    onClick={() => handleSelectOption(idx)}
                    className={`${shape.bg} rounded-3xl border-4 ${shape.border} flex flex-col items-center justify-center p-4 text-white shadow-2xl active:scale-95 transition-transform disabled:opacity-60 cursor-pointer ${
                      isChosen ? "ring-4 ring-white scale-95" : ""
                    }`}
                  >
                    <span className="text-4xl sm:text-5xl font-black mb-2">{shape.symbol}</span>
                    <span className="font-extrabold text-sm sm:text-base tracking-widest uppercase">
                      Lựa chọn {LETTERS[idx]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ============ STAGE 4: INSTANT FEEDBACK ============ */}
        {stage === "feedback" && (
          <div className="text-center space-y-6 animate-in zoom-in-95">
            <div
              className={`w-24 h-24 mx-auto rounded-3xl flex items-center justify-center text-4xl shadow-2xl ${
                isLastCorrect
                  ? "bg-emerald-500 text-slate-950 shadow-emerald-500/30"
                  : "bg-rose-600 text-white shadow-rose-600/30"
              }`}
            >
              {isLastCorrect ? <Check className="w-14 h-14 stroke-[3]" /> : <X className="w-14 h-14 stroke-[3]" />}
            </div>

            <div className="space-y-1">
              <h3 className="text-2xl sm:text-3xl font-black text-white">
                {isLastCorrect ? "CHÍNH XÁC! 🎉" : "CHƯA ĐÚNG RỒI! 😢"}
              </h3>
              <p className="text-sm font-bold text-slate-300">
                {isLastCorrect
                  ? `+${earnedPoints} điểm tốc độ!`
                  : "Đừng nản lòng, câu sau cố gắng nhé!"}
              </p>
            </div>

            <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 inline-flex items-center gap-4">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Tổng Điểm Hiện Tại</span>
                <span className="font-mono font-black text-2xl text-amber-400">
                  {score.toLocaleString()}
                </span>
              </div>
              <div className="border-l border-slate-800 pl-4">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Chuỗi Đúng</span>
                <span className="font-mono font-black text-2xl text-emerald-400 flex items-center gap-1">
                  <Flame className="w-5 h-5 fill-current" />
                  {streak}
                </span>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={handleNextTurn}
                className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-2xl shadow-lg active:scale-95 transition-all cursor-pointer"
              >
                Sẵn Sàng Câu Kế Tiếp →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
