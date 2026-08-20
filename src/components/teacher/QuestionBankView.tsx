import React, { useState } from "react";
import {
  BookOpen,
  Plus,
  Trash2,
  Sparkles,
  Search,
  CheckCircle2,
  Layers,
  ArrowRight,
  HelpCircle,
  FolderOpen,
} from "lucide-react";
import { Question, CognitiveLevel, SubjectType, GradeType } from "../../types";
import { LETTERS } from "../../utils/examHelpers";
import { getStoredApiKey, getStoredSelectedModel } from "../ModelSettingsModal";

interface QuestionBankViewProps {
  questions: Question[];
  onAddQuestion: (q: Question) => void;
  onAddMultipleQuestions: (qList: Question[]) => void;
  onDeleteQuestion: (id: string) => void;
  onTransferToShuffler: (selectedQuestions: Question[]) => void;
}

export const QuestionBankView: React.FC<QuestionBankViewProps> = ({
  questions,
  onAddQuestion,
  onAddMultipleQuestions,
  onDeleteQuestion,
  onTransferToShuffler,
}) => {
  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<string>("Tất cả");
  const [selectedGrade, setSelectedGrade] = useState<string>("Tất cả");
  const [selectedLevel, setSelectedLevel] = useState<string>("Tất cả");

  // Selection for Transfer
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Manual Add Modal / Form
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSubject, setNewSubject] = useState<SubjectType>("Toán học");
  const [newGrade, setNewGrade] = useState<GradeType>("Khối 12");
  const [newLevel, setNewLevel] = useState<CognitiveLevel>("Thông hiểu");
  const [newChapter, setNewChapter] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newOptions, setNewOptions] = useState(["", "", "", ""]);
  const [newCorrectIndex, setNewCorrectIndex] = useState(0);
  const [newExplanation, setNewExplanation] = useState("");

  // AI Generator Modal
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiSubject, setAiSubject] = useState("Toán học");
  const [aiGrade, setAiGrade] = useState("Khối 12");
  const [aiTopic, setAiTopic] = useState("Khảo sát hàm số & Tích phân");
  const [aiCount, setAiCount] = useState(4);
  const [aiLevel, setAiLevel] = useState("Thông hiểu & Vận dụng");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiGeneratedResults, setAiGeneratedResults] = useState<Question[]>([]);
  const [aiError, setAiError] = useState("");

  // Filtered List
  const filteredQuestions = questions.filter((q) => {
    const matchSearch =
      q.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.chapter?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.options.some((opt) => opt.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchSubject = selectedSubject === "Tất cả" || q.subject === selectedSubject;
    const matchGrade = selectedGrade === "Tất cả" || q.grade === selectedGrade;
    const matchLevel = selectedLevel === "Tất cả" || q.level === selectedLevel;

    return matchSearch && matchSubject && matchGrade && matchLevel;
  });

  // Toggle single selection
  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Select all filtered
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredQuestions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredQuestions.map((q) => q.id));
    }
  };

  // Handle manual question submit
  const handleSaveManualQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim() || newOptions.some((opt) => !opt.trim())) {
      alert("Vui lòng điền đầy đủ câu hỏi và 4 phương án lựa chọn.");
      return;
    }

    const q: Question = {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      subject: newSubject,
      grade: newGrade,
      level: newLevel,
      chapter: newChapter.trim() || "Chương chung",
      part: 1,
      questionType: "multiple_choice",
      content: newContent.trim(),
      options: newOptions.map((o) => o.trim()),
      correctIndex: newCorrectIndex,
      explanation: newExplanation.trim(),
    };

    onAddQuestion(q);
    setShowAddModal(false);
    // Reset
    setNewContent("");
    setNewOptions(["", "", "", ""]);
    setNewExplanation("");
  };

  // Handle AI Question Generation
  const handleGenerateAiQuestions = async () => {
    setIsAiLoading(true);
    setAiError("");
    setAiGeneratedResults([]);

    try {
      const apiKey = getStoredApiKey();
      const model = getStoredSelectedModel();
      const res = await fetch("/api/ai/generate-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gemini-api-key": apiKey,
          "x-gemini-model": model,
        },
        body: JSON.stringify({
          subject: aiSubject,
          grade: aiGrade,
          topic: aiTopic,
          count: aiCount,
          level: aiLevel,
          apiKey,
          model,
        }),
      });

      const data = await res.json();
      if (data.success && data.data) {
        setAiGeneratedResults(data.data);
      } else {
        setAiError(data.error || "Không thể tạo câu hỏi từ AI.");
      }
    } catch (err: any) {
      setAiError("Lỗi kết nối AI: " + err.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Add AI generated questions to bank
  const handleImportAiQuestionsToBank = () => {
    if (aiGeneratedResults.length > 0) {
      onAddMultipleQuestions(aiGeneratedResults);
      setShowAiModal(false);
      setAiGeneratedResults([]);
      alert(`Đã thêm thành công ${aiGeneratedResults.length} câu hỏi vào ngân hàng!`);
    }
  };

  // Send selected to exam shuffler
  const handleSendToShuffler = () => {
    const selected = questions.filter((q) => selectedIds.includes(q.id));
    if (selected.length === 0) {
      alert("Vui lòng chọn ít nhất 1 câu hỏi.");
      return;
    }
    onTransferToShuffler(selected);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <h1 className="text-xl font-bold text-slate-900">Ngân Hàng Câu Hỏi & Đề Thi</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tổng số: <strong>{questions.length} câu hỏi</strong> • Chọn câu hỏi và chuyển sang giao
            diện Trộn Đề cho học sinh làm.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* AI Generator Button */}
          <button
            type="button"
            id="btn-open-ai-generator"
            onClick={() => setShowAiModal(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Soạn Câu Hỏi Tự Động</span>
          </button>

          {/* Add Manual Button */}
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Câu Hỏi Mới</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm nội dung, chuyên đề..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Subject Filter */}
          <div>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-medium text-slate-700"
            >
              <option value="Tất cả">Tất cả môn học</option>
              <option value="Toán học">Toán học</option>
              <option value="Vật lý">Vật lý</option>
              <option value="Hóa học">Hóa học</option>
              <option value="Sinh học">Sinh học</option>
              <option value="Tiếng Anh">Tiếng Anh</option>
              <option value="Lịch sử">Lịch sử</option>
              <option value="Địa lý">Địa lý</option>
              <option value="GDCD">GDCD</option>
              <option value="Tin học">Tin học</option>
            </select>
          </div>

          {/* Grade Filter */}
          <div>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-medium text-slate-700"
            >
              <option value="Tất cả">Tất cả khối lớp</option>
              <option value="Khối 12">Khối 12</option>
              <option value="Khối 11">Khối 11</option>
              <option value="Khối 10">Khối 10</option>
              <option value="Khối 9">Khối 9</option>
            </select>
          </div>

          {/* Level Filter */}
          <div>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-medium text-slate-700"
            >
              <option value="Tất cả">Tất cả mức độ</option>
              <option value="Nhận biết">Nhận biết</option>
              <option value="Thông hiểu">Thông hiểu</option>
              <option value="Vận dụng">Vận dụng</option>
              <option value="Vận dụng cao">Vận dụng cao</option>
            </select>
          </div>
        </div>

        {/* Action Bar for selected items */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs">
            <span className="font-bold text-indigo-900">
              Đã chọn {selectedIds.length} câu hỏi
            </span>

            <button
              type="button"
              id="btn-transfer-to-shuffler"
              onClick={handleSendToShuffler}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-bold shadow-xs transition-colors"
            >
              <span>Chuyển Sang Trộn Đề</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Question Table List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={
                filteredQuestions.length > 0 && selectedIds.length === filteredQuestions.length
              }
              onChange={toggleSelectAll}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span className="font-semibold text-slate-700">
              Hiển thị {filteredQuestions.length} câu hỏi
            </span>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {filteredQuestions.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <FolderOpen className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs">Không tìm thấy câu hỏi phù hợp với bộ lọc.</p>
            </div>
          ) : (
            filteredQuestions.map((q, idx) => {
              const isSelected = selectedIds.includes(q.id);
              return (
                <div
                  key={q.id}
                  className={`p-4 transition-colors ${
                    isSelected ? "bg-indigo-50/50" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(q.id)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 mt-1"
                    />

                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">Câu {idx + 1}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {q.subject}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                          {q.grade}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            q.level === "Nhận biết"
                              ? "bg-blue-100 text-blue-800"
                              : q.level === "Thông hiểu"
                              ? "bg-emerald-100 text-emerald-800"
                              : q.level === "Vận dụng"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {q.level}
                        </span>
                        {q.chapter && (
                          <span className="text-[11px] text-slate-500 italic">
                            Chương: {q.chapter}
                          </span>
                        )}
                      </div>

                      <p className="text-xs sm:text-sm font-medium text-slate-800">{q.content}</p>

                      {/* Options Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs pt-1">
                        {q.options.map((opt, optIdx) => (
                          <div
                            key={optIdx}
                            className={`p-2 rounded-lg border ${
                              optIdx === q.correctIndex
                                ? "bg-emerald-50 border-emerald-300 font-bold text-emerald-900"
                                : "bg-slate-50 border-slate-200 text-slate-700"
                            }`}
                          >
                            <span className="mr-1">{LETTERS[optIdx]}.</span>
                            <span>{opt}</span>
                          </div>
                        ))}
                      </div>

                      {q.explanation && (
                        <div className="text-[11px] text-slate-600 bg-slate-100/70 p-2 rounded-md">
                          <span className="font-semibold text-slate-700">Giải thích:</span>{" "}
                          {q.explanation}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteQuestion(q.id)}
                      className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Xóa câu hỏi"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal 1: AI Question Generator */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    AI Soạn Câu Hỏi Trắc Nghiệm Tự Động
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Ứng dụng mô hình Gemini tạo câu hỏi chuẩn ma trận khảo thí
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Môn học</label>
                <input
                  type="text"
                  value={aiSubject}
                  onChange={(e) => setAiSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Khối lớp</label>
                <select
                  value={aiGrade}
                  onChange={(e) => setAiGrade(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                >
                  <option value="Khối 12">Khối 12</option>
                  <option value="Khối 11">Khối 11</option>
                  <option value="Khối 10">Khối 10</option>
                  <option value="Khối 9">Khối 9</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Chủ đề / Bài học / Trọng tâm kiến thức
                </label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="Ví dụ: Đạo hàm, Tích phân và Ứng dụng thực tế"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Số lượng câu hỏi</label>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={aiCount}
                  onChange={(e) => setAiCount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mức độ nhận thức</label>
                <input
                  type="text"
                  value={aiLevel}
                  onChange={(e) => setAiLevel(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {aiError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                {aiError}
              </div>
            )}

            <button
              type="button"
              onClick={handleGenerateAiQuestions}
              disabled={isAiLoading}
              className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center space-x-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isAiLoading ? "Đang soạn câu hỏi theo chuẩn Bộ GD&ĐT..." : "Bắt Đầu Soạn Câu Hỏi Tự Động"}</span>
            </button>

            {/* AI Results Preview */}
            {aiGeneratedResults.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    Đã tạo thành công {aiGeneratedResults.length} câu hỏi
                  </span>
                  <button
                    type="button"
                    onClick={handleImportAiQuestionsToBank}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors"
                  >
                    + Thêm Tất Cả Vào Ngân Hàng
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {aiGeneratedResults.map((q, i) => (
                    <div
                      key={i}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5"
                    >
                      <p className="font-semibold text-slate-900">
                        {i + 1}. {q.content}
                      </p>
                      <div className="grid grid-cols-2 gap-1 text-[11px]">
                        {q.options.map((opt, idx) => (
                          <span
                            key={idx}
                            className={
                              idx === q.correctIndex ? "font-bold text-emerald-700" : "text-slate-600"
                            }
                          >
                            {LETTERS[idx]}. {opt}
                          </span>
                        ))}
                      </div>
                      {q.explanation && (
                        <p className="text-[10px] text-slate-500 italic">
                          Lời giải: {q.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal 2: Manual Add Question */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveManualQuestion}
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl border border-slate-200"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm uppercase">Thêm Câu Hỏi Thủ Công</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Môn học</label>
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Khối lớp</label>
                <select
                  value={newGrade}
                  onChange={(e) => setNewGrade(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="Khối 12">Khối 12</option>
                  <option value="Khối 11">Khối 11</option>
                  <option value="Khối 10">Khối 10</option>
                  <option value="Khối 9">Khối 9</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mức độ</label>
                <select
                  value={newLevel}
                  onChange={(e) => setNewLevel(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="Nhận biết">Nhận biết</option>
                  <option value="Thông hiểu">Thông hiểu</option>
                  <option value="Vận dụng">Vận dụng</option>
                  <option value="Vận dụng cao">Vận dụng cao</option>
                </select>
              </div>
            </div>

            <div className="text-xs">
              <label className="block font-semibold text-slate-700 mb-1">Chương / Chuyên đề</label>
              <input
                type="text"
                value={newChapter}
                onChange={(e) => setNewChapter(e.target.value)}
                placeholder="Ví dụ: Khối đa diện, Tích phân, Este..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="text-xs">
              <label className="block font-semibold text-slate-700 mb-1">Nội dung câu hỏi</label>
              <textarea
                rows={3}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Nhập nội dung đề bài..."
                className="w-full p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* 4 Options */}
            <div className="space-y-2 text-xs">
              <label className="block font-semibold text-slate-700">
                4 Phương án lựa chọn (Chọn nút tròn để đánh dấu đáp án đúng)
              </label>
              {newOptions.map((opt, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="correctOptionRadio"
                    checked={newCorrectIndex === idx}
                    onChange={() => setNewCorrectIndex(idx)}
                    className="text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="font-bold text-slate-800 w-6">{LETTERS[idx]}.</span>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const updated = [...newOptions];
                      updated[idx] = e.target.value;
                      setNewOptions(updated);
                    }}
                    placeholder={`Nội dung phương án ${LETTERS[idx]}...`}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ))}
            </div>

            <div className="text-xs">
              <label className="block font-semibold text-slate-700 mb-1">
                Lời giải thích / Hướng dẫn giải chi tiết (Tùy chọn)
              </label>
              <textarea
                rows={2}
                value={newExplanation}
                onChange={(e) => setNewExplanation(e.target.value)}
                placeholder="Giải thích vì sao đáp án đúng..."
                className="w-full p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs"
              >
                Lưu Câu Hỏi Vào Ngân Hàng
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
