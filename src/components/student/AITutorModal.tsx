import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Send,
  X,
  Bot,
  User,
  RefreshCw,
  Lightbulb,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { Question } from "../../types";
import { getStoredApiKey, getStoredSelectedModel } from "../ModelSettingsModal";
import { clientQuestionTutor } from "../../utils/clientAI";
import { FormattedQuestionContent } from "../FormattedQuestionContent";

interface AITutorModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: Question | null;
  studentAnswer?: any;
  isCorrect?: boolean;
}

interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: string;
}

export const AITutorModal: React.FC<AITutorModalProps> = ({
  isOpen,
  onClose,
  question,
  studentAnswer,
  isCorrect,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && question) {
      setMessages([]);
      setInitialLoaded(false);
      // Auto-trigger initial explanation
      handleSendInitialExplanation();
    }
  }, [isOpen, question]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (!isOpen || !question) return null;

  const handleSendInitialExplanation = async () => {
    setIsLoading(true);
    const initialText = `Chào em! Thầy/Cô AI đã xem bài làm của em ở câu này. Em hãy đọc lời giải thích bên dưới hoặc có thể đặt bất kỳ câu hỏi nào để thầy/cô hướng dẫn chi tiết nhé!`;

    try {
      const apiKey = getStoredApiKey();
      const model = getStoredSelectedModel();
      const json = await clientQuestionTutor({
        question,
        studentAnswer,
        isCorrect,
        userMessage: "Hãy giải thích chi tiết phương pháp giải câu này, chỉ ra vì sao phương án đúng là chính xác và mẹo tránh bẫy.",
        chatHistory: [],
        apiKey,
        model,
      });
      if (json.success && json.text) {
        setMessages([
          {
            id: `msg-bot-1`,
            role: "model",
            text: json.text,
            timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      } else {
        setMessages([
          {
            id: `msg-bot-err`,
            role: "model",
            text: question.explanation || "Đáp án câu này dựa trên định nghĩa và tính chất cơ bản trong SGK.",
            timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }
    } catch (e: any) {
      setMessages([
        {
          id: `msg-bot-fallback`,
          role: "model",
          text: `Lời giải tham khảo: ${question.explanation || "Vui lòng xem lại kiến thức trong SGK."}`,
          timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsLoading(false);
      setInitialLoaded(true);
    }
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputMessage.trim();
    if (!textToSend || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputMessage("");
    setIsLoading(true);

    try {
      const apiKey = getStoredApiKey();
      const model = getStoredSelectedModel();
      const json = await clientQuestionTutor({
        question,
        studentAnswer,
        isCorrect,
        userMessage: textToSend,
        chatHistory: newHistory.map((m) => ({ role: m.role, text: m.text })),
        apiKey,
        model,
      });
      if (json.success && json.text) {
        setMessages([
          ...newHistory,
          {
            id: `model-${Date.now()}`,
            role: "model",
            text: json.text,
            timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      } else {
        setMessages([
          ...newHistory,
          {
            id: `model-err-${Date.now()}`,
            role: "model",
            text: json.error || "Gia sư AI tạm thời bận, em hãy thử lại sau ít giây nhé.",
            timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }
    } catch (err: any) {
      setMessages([
        ...newHistory,
        {
          id: `model-fail-${Date.now()}`,
          role: "model",
          text: "Lỗi kết nối đến Gia sư AI. Vui lòng kiểm tra lại kết nối mạng hoặc API Key.",
          timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickQuestions = [
    "Tại sao câu này em làm chưa đúng?",
    "Có mẹo bấm máy tính Casio câu này không?",
    "Cho em công thức tổng quát của dạng bài này.",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[85vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-amber-300">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <span>Gia Sư AI 24/7 • Hướng Dẫn Giải Câu {question.questionIndex || 1}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                  GDPT 2018
                </span>
              </h3>
              <p className="text-[11px] text-blue-100 font-medium">
                {question.chapter || "Chuyên đề trọng tâm"} ({question.level || "Thông hiểu"})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Compact Question Preview Card */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs text-slate-800 shrink-0 max-h-32 overflow-y-auto">
          <div className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
            <span className="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 font-bold">
              Câu {question.questionIndex || 1}
            </span>
            <span className="text-slate-600 truncate">{question.content}</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-600">
            <span>
              Đáp án đúng: <strong className="text-emerald-700">{question.shortAnswer || (question.options && question.options[question.correctIndex ?? 0]) || "Đáp án chuẩn"}</strong>
            </span>
            {studentAnswer !== undefined && (
              <span>
                Em đã chọn: <strong className={isCorrect ? "text-emerald-600" : "text-rose-600"}>{String(studentAnswer)}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Chat Stream Body */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-100/60 text-xs">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "model" && (
                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl p-3.5 leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-tr-none shadow-xs font-medium"
                    : "bg-white text-slate-800 border border-slate-200 rounded-tl-none shadow-2xs space-y-1.5"
                }`}
              >
                <div className="whitespace-pre-wrap">
                  <FormattedQuestionContent content={msg.text} />
                </div>
                <span
                  className={`text-[9px] block ${
                    msg.role === "user" ? "text-blue-200 text-right" : "text-slate-400"
                  }`}
                >
                  {msg.timestamp}
                </span>
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-full bg-slate-700 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-2.5 items-center text-slate-500 text-xs">
              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                <span>Gia sư AI đang phân tích và soạn câu trả lời...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Quick Suggestion Prompts */}
        <div className="px-4 py-2 bg-white border-t border-slate-200 flex items-center gap-1.5 overflow-x-auto shrink-0">
          <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0">Gợi ý hỏi:</span>
          {quickQuestions.map((qText, qIdx) => (
            <button
              key={qIdx}
              type="button"
              onClick={() => handleSendMessage(qText)}
              disabled={isLoading}
              className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap disabled:opacity-50"
            >
              {qText}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Nhập thắc mắc của em về câu hỏi này..."
            className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-slate-50 focus:bg-white transition-all"
          />
          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={isLoading || !inputMessage.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Gửi</span>
          </button>
        </div>
      </div>
    </div>
  );
};
