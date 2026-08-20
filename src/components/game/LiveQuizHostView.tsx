import React, { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import {
  Trophy,
  Users,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Sparkles,
  Award,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Flame,
  Zap,
  ChevronRight,
  BarChart2,
  Maximize2,
  Minimize2,
  Share2,
} from "lucide-react";
import { Question, ExamConfig } from "../../types";
import { LETTERS } from "../../utils/examHelpers";
import { FormattedQuestionContent } from "../FormattedQuestionContent";

interface Player {
  id: string;
  name: string;
  avatar: string;
  score: number;
  streak: number;
  lastAnswer?: number | string;
  lastAnswerTime?: number;
  isCorrect?: boolean;
}

interface LiveQuizHostViewProps {
  questions: Question[];
  config?: Partial<ExamConfig>;
  onClose: () => void;
}

const SHAPES = [
  { name: "Tam giác Đỏ", bg: "bg-red-600 hover:bg-red-700", border: "border-red-700", symbol: "▲", color: "#dc2626" },
  { name: "Hình thoi Xanh dương", bg: "bg-blue-600 hover:bg-blue-700", border: "border-blue-700", symbol: "◆", color: "#2563eb" },
  { name: "Hình tròn Vàng", bg: "bg-amber-500 hover:bg-amber-600", border: "border-amber-600", symbol: "●", color: "#d97706" },
  { name: "Hình vuông Xanh lá", bg: "bg-emerald-600 hover:bg-emerald-700", border: "border-emerald-700", symbol: "■", color: "#059669" },
];

const SAMPLE_NAMES = [
  "Nguyễn Văn An", "Trần Minh Châu", "Lê Hoàng Dũng", "Phạm Quỳnh Anh",
  "Hoàng Gia Bảo", "Vũ Mai Linh", "Đỗ Tuấn Kiệt", "Bùi Thu Trang",
  "Đặng Quốc Huy", "Ngô Phương Thảo", "Dương Nhật Minh", "Lý Khánh Vân"
];

export const LiveQuizHostView: React.FC<LiveQuizHostViewProps> = ({
  questions,
  config,
  onClose,
}) => {
  const [gameState, setGameState] = useState<"lobby" | "question" | "result" | "leaderboard" | "podium">("lobby");
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [pinCode] = useState(() => Math.floor(100000 + Math.random() * 900000).toString());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Simulated live players in the room
  const [players, setPlayers] = useState<Player[]>(() =>
    SAMPLE_NAMES.slice(0, 8).map((name, i) => ({
      id: `p-${i}`,
      name,
      avatar: ["🐯", "🐼", "🦊", "🦁", "🐰", "🐸", "🦄", "🐨"][i % 8],
      score: 0,
      streak: 0,
    }))
  );

  const [answeredCount, setAnsweredCount] = useState(0);
  const [statCounts, setStatCounts] = useState<number[]>([0, 0, 0, 0]);

  const currentQ = questions[currentQIndex] || questions[0];

  // Lobby player join simulation
  useEffect(() => {
    if (gameState === "lobby" && players.length < 12) {
      const timer = setTimeout(() => {
        const remaining = SAMPLE_NAMES.filter((n) => !players.some((p) => p.name === n));
        if (remaining.length > 0) {
          const nextName = remaining[0];
          setPlayers((prev) => [
            ...prev,
            {
              id: `p-${prev.length}`,
              name: nextName,
              avatar: ["🚀", "⭐", "⚡", "🌟"][prev.length % 4],
              score: 0,
              streak: 0,
            },
          ]);
        }
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [gameState, players]);

  // Question countdown timer
  useEffect(() => {
    let interval: any = null;
    if (gameState === "question" && isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (gameState === "question" && timeLeft === 0) {
      handleTimeUp();
    }
    return () => clearInterval(interval);
  }, [gameState, isTimerRunning, timeLeft]);

  const handleStartGame = () => {
    setCurrentQIndex(0);
    startQuestion(0);
  };

  const startQuestion = (qIdx: number) => {
    setCurrentQIndex(qIdx);
    setTimeLeft(20);
    setIsTimerRunning(true);
    setGameState("question");
    setAnsweredCount(0);
    setStatCounts([0, 0, 0, 0]);

    // Simulate players answering over time
    const q = questions[qIdx];
    const correctIdx = q.correctIndex ?? 0;

    players.forEach((p, pIdx) => {
      const answerDelay = Math.floor(2000 + Math.random() * 12000);
      setTimeout(() => {
        // 75% chance player picks correct answer
        const isRight = Math.random() < 0.75;
        const chosen = isRight ? correctIdx : Math.floor(Math.random() * 4);

        setStatCounts((prev) => {
          const next = [...prev];
          next[chosen] = (next[chosen] || 0) + 1;
          return next;
        });

        setAnsweredCount((c) => Math.min(players.length, c + 1));

        setPlayers((prev) =>
          prev.map((pl) => {
            if (pl.id === p.id) {
              const speedBonus = Math.max(100, Math.floor((20 - answerDelay / 1000) * 45));
              const pts = isRight ? 1000 + speedBonus : 0;
              const newStreak = isRight ? pl.streak + 1 : 0;
              return {
                ...pl,
                score: pl.score + pts,
                streak: newStreak,
                lastAnswer: chosen,
                isCorrect: isRight,
              };
            }
            return pl;
          })
        );
      }, answerDelay);
    });
  };

  const handleTimeUp = () => {
    setIsTimerRunning(false);
    setGameState("result");
  };

  const handleShowLeaderboard = () => {
    setGameState("leaderboard");
  };

  const handleNextQuestion = () => {
    if (currentQIndex + 1 < questions.length) {
      startQuestion(currentQIndex + 1);
    } else {
      // Final Podium
      setGameState("podium");
      confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.5 },
      });
    }
  };

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="fixed inset-0 z-50 bg-[#090d16] text-white flex flex-col overflow-hidden font-sans select-none">
      {/* Top Header Bar */}
      <div className="h-16 bg-slate-900/90 border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-red-500 flex items-center justify-center shadow-lg shadow-amber-500/20 text-white font-extrabold text-lg">
            🎮
          </div>
          <div>
            <h1 className="text-base font-extrabold text-white flex items-center gap-2">
              <span>ĐẤU TRƯỜNG LIVE QUIZ • EDUTEST PRO</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs border border-amber-500/30">
                {config?.subject || "Khảo Thí Trực Tiếp"}
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Mã PIN Phòng Đấu: <strong className="font-mono text-amber-400 text-sm tracking-widest">{pinCode}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5 text-rose-400" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all"
          >
            Thoát Đấu Trường
          </button>
        </div>
      </div>

      {/* Main Game Stage */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden relative">
        {/* ================= STATE 1: LOBBY ================= */}
        {gameState === "lobby" && (
          <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full text-center space-y-8 animate-in fade-in">
            <div className="space-y-3">
              <span className="px-4 py-1.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold text-xs border border-indigo-400/30 uppercase tracking-wider">
                Phòng Chờ Thi Đấu Trực Tiếp
              </span>
              <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                Tham gia tại <span className="text-amber-400 underline">edutest.pro/live</span>
              </h2>
              <div className="p-5 bg-gradient-to-r from-indigo-900/60 to-purple-900/60 border-2 border-amber-400/60 rounded-3xl inline-flex flex-col items-center shadow-2xl shadow-indigo-950">
                <span className="text-xs font-bold text-amber-200 uppercase tracking-widest">MÃ PIN THAM GIA</span>
                <span className="text-5xl sm:text-6xl font-black text-amber-300 font-mono tracking-widest mt-1">
                  {pinCode}
                </span>
              </div>
            </div>

            {/* Players in room counter & grid */}
            <div className="w-full bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-3">
                <span className="font-bold text-white flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-indigo-400" />
                  Đã có {players.length} thí sinh sẵn sàng:
                </span>
                <span className="animate-pulse text-emerald-400 font-semibold">
                  ● Đang đợi thêm người chơi...
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 max-h-48 overflow-y-auto pr-1">
                {players.map((pl) => (
                  <div
                    key={pl.id}
                    className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/80 text-xs flex items-center gap-2 shadow-xs animate-in zoom-in-95"
                  >
                    <span className="text-lg">{pl.avatar}</span>
                    <span className="font-bold text-slate-200 truncate">{pl.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Start Button */}
            <button
              type="button"
              onClick={handleStartGame}
              disabled={players.length === 0}
              className="px-10 py-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:scale-105 active:scale-95 text-slate-950 font-black text-lg rounded-2xl shadow-xl shadow-emerald-500/30 flex items-center gap-3 transition-all cursor-pointer"
            >
              <Play className="w-6 h-6 fill-current" />
              <span>BẮT ĐẦU TRẬN ĐẤU ({questions.length} CÂU)</span>
            </button>
          </div>
        )}

        {/* ================= STATE 2: QUESTION RUNNING ================= */}
        {gameState === "question" && (
          <div className="flex-1 flex flex-col justify-between max-w-5xl mx-auto w-full space-y-6 animate-in fade-in">
            {/* Question Header */}
            <div className="flex items-center justify-between">
              <span className="px-3.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-indigo-300 font-bold text-sm">
                CÂU HỎI {currentQIndex + 1} / {questions.length}
              </span>

              {/* Countdown Timer Circle */}
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center font-mono font-black text-2xl shadow-xl border-2 transition-all ${
                  timeLeft <= 5
                    ? "bg-rose-600 border-rose-400 text-white animate-bounce"
                    : "bg-indigo-600 border-indigo-400 text-white"
                }`}
              >
                {timeLeft}
              </div>

              {/* Live Answered Count */}
              <div className="px-3.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-emerald-300 font-bold text-sm flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>{answeredCount} / {players.length} đã trả lời</span>
              </div>
            </div>

            {/* Question Text Card */}
            <div className="p-8 bg-slate-900/90 border border-slate-700 rounded-3xl shadow-2xl text-center flex items-center justify-center min-h-[160px]">
              <div className="text-xl sm:text-2xl font-bold text-white leading-relaxed">
                <FormattedQuestionContent content={currentQ.content} />
              </div>
            </div>

            {/* 4 Colored Options Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(currentQ.options || ["A", "B", "C", "D"]).slice(0, 4).map((opt, idx) => {
                const shape = SHAPES[idx % 4];
                return (
                  <div
                    key={idx}
                    className={`p-5 rounded-2xl border-2 ${shape.border} ${shape.bg} text-white font-bold text-base sm:text-lg flex items-center gap-4 shadow-lg transition-all`}
                  >
                    <span className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center text-xl shrink-0 font-mono">
                      {shape.symbol}
                    </span>
                    <span className="flex-1">{opt}</span>
                  </div>
                );
              })}
            </div>

            {/* Skip to Result immediately */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleTimeUp}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-colors"
              >
                Kết Thúc Thời Gian Sớm →
              </button>
            </div>
          </div>
        )}

        {/* ================= STATE 3: RESULT & DISTRIBUTION ================= */}
        {gameState === "result" && (
          <div className="flex-1 flex flex-col justify-between max-w-5xl mx-auto w-full space-y-6 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="px-3.5 py-1 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs">
                KẾT QUẢ CÂU {currentQIndex + 1}
              </span>
              <span className="px-3.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-xs">
                Đáp án đúng: {LETTERS[currentQ.correctIndex ?? 0]}
              </span>
            </div>

            {/* Question Text */}
            <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-2xl text-center">
              <div className="text-lg font-bold text-slate-200">
                <FormattedQuestionContent content={currentQ.content} />
              </div>
            </div>

            {/* Bar Chart Statistics Grid */}
            <div className="grid grid-cols-4 gap-4 h-56 items-end p-6 bg-slate-900/60 rounded-3xl border border-slate-800">
              {SHAPES.map((shape, idx) => {
                const count = statCounts[idx] || 0;
                const isCorrect = idx === (currentQ.correctIndex ?? 0);
                const maxCount = Math.max(1, ...statCounts);
                const heightPercent = Math.max(15, Math.round((count / maxCount) * 100));

                return (
                  <div key={idx} className="flex flex-col items-center h-full justify-end gap-2">
                    <span className="text-sm font-black text-white">{count} bạn</span>
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-2xl transition-all duration-700 flex items-center justify-center font-black text-xl shadow-lg ${
                        isCorrect
                          ? "bg-emerald-500 ring-4 ring-emerald-300/50"
                          : `${shape.bg} opacity-50`
                      }`}
                    >
                      {isCorrect ? "✓" : "✕"}
                    </div>
                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                      <span>{shape.symbol}</span>
                      <span>{LETTERS[idx]}</span>
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Explanation box */}
            {currentQ.explanation && (
              <div className="p-4 bg-indigo-950/40 border border-indigo-800/60 rounded-2xl text-xs text-indigo-200">
                <strong>💡 Lời giải chi tiết:</strong> {currentQ.explanation}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleShowLeaderboard}
                className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-extrabold rounded-2xl shadow-lg flex items-center gap-2 transition-all hover:scale-105"
              >
                <span>Xem Bảng Xếp Hạng</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ================= STATE 4: LEADERBOARD ================= */}
        {gameState === "leaderboard" && (
          <div className="flex-1 flex flex-col justify-between max-w-3xl mx-auto w-full space-y-6 animate-in fade-in">
            <div className="text-center space-y-1">
              <h2 className="text-2xl sm:text-3xl font-black text-amber-300 flex items-center justify-center gap-2">
                <Trophy className="w-7 h-7 text-amber-400" />
                <span>BẢNG XẾP HẠNG TOP ĐẦU</span>
              </h2>
              <p className="text-xs text-slate-400">Sau câu hỏi số {currentQIndex + 1}</p>
            </div>

            {/* Leaderboard Rows */}
            <div className="space-y-3">
              {sortedPlayers.slice(0, 5).map((pl, rank) => {
                const isTop1 = rank === 0;
                return (
                  <div
                    key={pl.id}
                    className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                      isTop1
                        ? "bg-gradient-to-r from-amber-500/20 via-amber-600/10 to-slate-900 border-amber-400/50 shadow-lg shadow-amber-500/10 scale-[1.02]"
                        : "bg-slate-900/80 border-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${
                          rank === 0
                            ? "bg-amber-400 text-slate-950"
                            : rank === 1
                            ? "bg-slate-300 text-slate-950"
                            : rank === 2
                            ? "bg-amber-700 text-white"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        #{rank + 1}
                      </span>
                      <span className="text-2xl">{pl.avatar}</span>
                      <div>
                        <span className="font-extrabold text-base text-white block">{pl.name}</span>
                        {pl.streak > 1 && (
                          <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                            <Flame className="w-3.5 h-3.5 fill-current" />
                            <span>{pl.streak} câu liên tiếp!</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-black text-xl text-emerald-400">
                        {pl.score.toLocaleString("vi-VN")} pts
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={handleNextQuestion}
                className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-slate-950 font-black rounded-2xl shadow-lg flex items-center gap-2 transition-all hover:scale-105"
              >
                <span>{currentQIndex + 1 < questions.length ? "Câu Hỏi Tiếp Theo" : "Xem Lễ Vinh Danh Podium"}</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ================= STATE 5: FINAL PODIUM ================= */}
        {gameState === "podium" && (
          <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full text-center space-y-8 animate-in zoom-in-95">
            <div className="space-y-2">
              <span className="px-4 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs border border-amber-400/30 uppercase tracking-widest">
                LỄ VINH DANH NHÀ VÔ ĐỊCH
              </span>
              <h2 className="text-3xl sm:text-5xl font-black text-white">
                CHÚC MỪNG CHIẾN THẮNG! 🏆
              </h2>
            </div>

            {/* 3 Podium Pillars */}
            <div className="flex items-end justify-center gap-4 w-full pt-8">
              {/* 2nd Place */}
              {sortedPlayers[1] && (
                <div className="flex-1 flex flex-col items-center space-y-2">
                  <span className="text-3xl">{sortedPlayers[1].avatar}</span>
                  <span className="font-bold text-sm text-slate-200 truncate max-w-[120px]">
                    {sortedPlayers[1].name}
                  </span>
                  <span className="font-mono text-xs text-slate-400 font-bold">
                    {sortedPlayers[1].score.toLocaleString("vi-VN")} pts
                  </span>
                  <div className="w-full h-36 bg-gradient-to-t from-slate-700 to-slate-500 rounded-t-3xl flex items-center justify-center font-black text-3xl text-slate-900 shadow-xl border-t-4 border-slate-300">
                    🥈 2
                  </div>
                </div>
              )}

              {/* 1st Place (Winner) */}
              {sortedPlayers[0] && (
                <div className="flex-1 flex flex-col items-center space-y-2 -mt-8">
                  <div className="relative">
                    <span className="text-5xl">{sortedPlayers[0].avatar}</span>
                    <span className="absolute -top-4 -right-2 text-2xl">👑</span>
                  </div>
                  <span className="font-extrabold text-base text-amber-300 truncate max-w-[140px]">
                    {sortedPlayers[0].name}
                  </span>
                  <span className="font-mono text-sm text-amber-400 font-extrabold">
                    {sortedPlayers[0].score.toLocaleString("vi-VN")} pts
                  </span>
                  <div className="w-full h-48 bg-gradient-to-t from-amber-600 via-amber-500 to-yellow-400 rounded-t-3xl flex items-center justify-center font-black text-4xl text-slate-950 shadow-2xl shadow-amber-500/30 border-t-4 border-yellow-200">
                    🥇 1
                  </div>
                </div>
              )}

              {/* 3rd Place */}
              {sortedPlayers[2] && (
                <div className="flex-1 flex flex-col items-center space-y-2">
                  <span className="text-3xl">{sortedPlayers[2].avatar}</span>
                  <span className="font-bold text-sm text-slate-200 truncate max-w-[120px]">
                    {sortedPlayers[2].name}
                  </span>
                  <span className="font-mono text-xs text-slate-400 font-bold">
                    {sortedPlayers[2].score.toLocaleString("vi-VN")} pts
                  </span>
                  <div className="w-full h-28 bg-gradient-to-t from-amber-900 to-amber-700 rounded-t-3xl flex items-center justify-center font-black text-3xl text-white shadow-xl border-t-4 border-amber-500">
                    🥉 3
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-6">
              <button
                type="button"
                onClick={() => setGameState("lobby")}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Chơi Lại Trận Mới</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-lg"
              >
                Đóng &amp; Trở Về Bảng Quản Lý
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
