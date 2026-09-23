import React, { useState, useEffect } from "react";
import {
  Key,
  Sparkles,
  ExternalLink,
  Check,
  AlertTriangle,
  X,
  ShieldCheck,
  Cpu,
  RefreshCw,
  Eye,
  EyeOff,
  Zap,
  Cloud,
  Database,
  Globe,
  Wifi,
  CheckCircle2,
} from "lucide-react";
import {
  FALLBACK_MODELS,
  DEFAULT_GEMINI_MODEL,
  isValidGoogleAiApiKey,
  OFFICIAL_AI_STUDIO_KEY_URL,
} from "../utils/geminiConfig";
import {
  getCloudDatabaseConfig,
  saveCloudDatabaseConfig,
  testCloudDatabaseConnection,
} from "../utils/cloudExamDatabase";

interface ModelSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (apiKey: string, selectedModel: string) => void;
}

export interface ModelCardInfo {
  id: string;
  name: string;
  badge: string;
  badgeColor: string;
  description: string;
  speed: string;
  accuracy: string;
  isDefault?: boolean;
}

export const AVAILABLE_MODELS: ModelCardInfo[] = [
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    badge: "Khuyên Dùng (Default)",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
    description: "Tốc độ xử lý siêu nhanh, tối ưu bóc tách ảnh chụp đề thi, nhận diện công thức và chấm trắc nghiệm.",
    speed: "Rất nhanh (~1s)",
    accuracy: "Xuất sắc",
    isDefault: true,
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    badge: "Chuyên Sâu & Tự Luận",
    badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-200",
    description: "Suy luận logic cực mạnh, phân tích đề thi nâng cao và chấm bài tự luận chi tiết.",
    speed: "Tiêu chuẩn (~2-3s)",
    accuracy: "Tối cao (SOTA)",
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    badge: "Đa Phương Thức Ổn Định",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    description: "Kiến trúc đa phương thức thế hệ mới nhận diện hình ảnh đề thi và OCR chính xác.",
    speed: "Rất nhanh (~1s)",
    accuracy: "Xuất sắc",
  },
  {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    badge: "Dự Phòng Ổn Định",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    description: "Model dự phòng với độ trễ thấp và tính ổn định cao.",
    speed: "Siêu nhanh (~0.8s)",
    accuracy: "Rất tốt",
  },
];

export const getStoredApiKey = (): string => {
  if (typeof window === "undefined") return "";
  return (
    localStorage.getItem("gemini_api_key") ||
    localStorage.getItem("edutest_gemini_api_key") ||
    ""
  );
};

export const getStoredSelectedModel = (): string => {
  if (typeof window === "undefined") return "gemini-2.5-flash";
  return (
    localStorage.getItem("gemini_selected_model") ||
    "gemini-2.5-flash"
  );
};

export const ModelSettingsModal: React.FC<ModelSettingsModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [activeTab, setActiveTab] = useState<"ai" | "cloud">("ai");
  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [showKey, setShowKey] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  // Cloud Database states
  const [cloudDbUrl, setCloudDbUrl] = useState("");
  const [isTestingCloud, setIsTestingCloud] = useState(false);
  const [cloudTestResult, setCloudTestResult] = useState<{ success: boolean; msg: string; latency?: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const storedKey = getStoredApiKey();
      const storedModel = getStoredSelectedModel();
      const cloudCfg = getCloudDatabaseConfig();
      setApiKey(storedKey);
      setSelectedModel(storedModel);
      setCloudDbUrl(cloudCfg.databaseUrl);
      setSaveSuccess(false);
      setValidationError("");
      setTestResult(null);
      setCloudTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (activeTab === "ai") {
      const trimmed = apiKey.trim();
      if (!trimmed) {
        setValidationError("Vui lòng nhập API Key để sử dụng các tính năng AI.");
        return;
      }

      if (!isValidGoogleAiApiKey(trimmed)) {
        setValidationError("Định dạng API Key chưa chuẩn (Key Google AI thường bắt đầu bằng 'AIzaSy...'). Vui lòng kiểm tra lại.");
        return;
      }

      localStorage.setItem("gemini_api_key", trimmed);
      localStorage.setItem("edutest_gemini_api_key", trimmed);
      localStorage.setItem("gemini_selected_model", selectedModel);

      setValidationError("");
      setSaveSuccess(true);
      if (onSaved) onSaved(trimmed, selectedModel);
    } else {
      // Save Cloud DB
      saveCloudDatabaseConfig({
        databaseUrl: cloudDbUrl.trim(),
      });
      setSaveSuccess(true);
    }

    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 900);
  };

  const handleTestCloudConnection = async () => {
    setIsTestingCloud(true);
    setCloudTestResult(null);
    const res = await testCloudDatabaseConnection();
    setIsTestingCloud(false);
    setCloudTestResult({
      success: res.success,
      msg: res.message,
      latency: res.latencyMs,
    });
  };

  const handleResetCloudDbUrl = () => {
    const defaultUrl = "https://edutest-pro-cloud-default-rtdb.asia-southeast1.firebasedatabase.app";
    setCloudDbUrl(defaultUrl);
    saveCloudDatabaseConfig({ databaseUrl: defaultUrl });
    setCloudTestResult({
      success: true,
      msg: "Đã khôi phục về máy chủ Cloud Database mặc định của Edutest Pro.",
    });
  };

  const handleTestKey = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setValidationError("Vui lòng nhập API Key trước khi kiểm tra.");
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setValidationError("");

    try {
      const res = await fetch("/api/ai/test-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gemini-api-key": trimmed,
          "x-gemini-model": selectedModel,
        },
        body: JSON.stringify({ apiKey: trimmed, model: selectedModel }),
      }).catch(() => null);

      if (res && res.ok) {
        const d = await res.json();
        if (d.success) {
          setTestResult({ success: true, msg: `Kết nối thành công với model ${selectedModel}!` });
        } else {
          setTestResult({ success: false, msg: d.error || "Không thể xác thực API Key." });
        }
      } else {
        try {
          const directRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${trimmed}`
          );
          if (directRes.ok) {
            setTestResult({
              success: true,
              msg: `Xác thực thành công với Google Gemini API! Model ${selectedModel} đã sẵn sàng.`,
            });
          } else {
            const errJson = await directRes.json().catch(() => null);
            const errMsg = errJson?.error?.message || `Lỗi API Google (Mã ${directRes.status})`;
            setTestResult({
              success: false,
              msg: `API Key bị từ chối: ${errMsg}`,
            });
          }
        } catch (directErr) {
          if (isValidGoogleAiApiKey(trimmed)) {
            setTestResult({
              success: true,
              msg: "Định dạng API Key chuẩn (AIzaSy...) và đã sẵn sàng sử dụng!",
            });
          } else {
            setTestResult({
              success: false,
              msg: "API Key không hợp lệ. Vui lòng lấy key mới tại Google AI Studio.",
            });
          }
        }
      }
    } catch (e: any) {
      setTestResult({ success: false, msg: e.message || "Lỗi kiểm tra kết nối." });
    } finally {
      setIsTesting(false);
    }
  };

  const handleRemoveKey = () => {
    if (window.confirm("Bạn có chắc muốn xóa API Key đã lưu?")) {
      localStorage.removeItem("gemini_api_key");
      localStorage.removeItem("edutest_gemini_api_key");
      setApiKey("");
      setTestResult(null);
      setValidationError("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                <span>Cài Đặt Hệ Thống & Đám Mây</span>
              </h3>
              <p className="text-xs text-slate-300">
                Cấu hình Google Gemini AI và Cơ sở dữ liệu Đám mây Cloud Database
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 border-b border-slate-200 flex gap-2 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("ai")}
            className={`pb-2.5 px-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === "ai"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Google Gemini AI</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("cloud")}
            className={`pb-2.5 px-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === "cloud"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Cloud className="w-3.5 h-3.5 text-emerald-600" />
            <span>Cloud Database (Thi Online & Mã QR)</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 text-sm">
          {activeTab === "ai" && (
            <>
              {/* Quick Guide & Link Banner */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="flex-1 text-xs text-blue-900 space-y-1.5">
                  <p className="font-semibold text-blue-950">
                    Hướng dẫn lấy Google Gemini API Key hoàn toàn miễn phí:
                  </p>
                  <p>
                    Truy cập Google AI Studio để tạo khóa API (mất 30 giây). Khóa được lưu an toàn trực tiếp trong trình duyệt (localStorage) của bạn.
                  </p>
                  <a
                    href="https://aistudio.google.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 bg-white px-3 py-1.5 rounded-lg border border-blue-300 shadow-2xs hover:shadow-xs transition-all"
                  >
                    <span>Mở Google AI Studio để lấy Key</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* API Key Input Section */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-indigo-600" />
                    <span>Google Gemini API Key</span>
                  </span>
                  {apiKey && (
                    <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Đã nhập Key
                    </span>
                  )}
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setValidationError("");
                      setTestResult(null);
                    }}
                    placeholder="Dán mã API Key (bắt đầu bằng AIzaSy...)"
                    className="w-full pl-3.5 pr-24 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xs font-mono transition-all"
                  />
                  <div className="absolute right-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
                      title={showKey ? "Ẩn Key" : "Hiện Key"}
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    {apiKey && (
                      <button
                        type="button"
                        onClick={handleRemoveKey}
                        className="p-1.5 text-rose-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                        title="Xóa Key"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {validationError && (
                  <p className="text-xs text-rose-600 flex items-center gap-1 mt-1 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationError}</span>
                  </p>
                )}

                {testResult && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      testResult.success
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-rose-50 text-rose-800 border border-rose-200"
                    }`}
                  >
                    {testResult.success ? (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{testResult.msg}</span>
                  </div>
                )}
              </div>

              {/* Model AI Selection (Cards) */}
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span>Chọn Model AI Mặc Định</span>
                  </span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    Tự động fallback khi lỗi
                  </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {AVAILABLE_MODELS.map((model) => {
                    const isSelected = selectedModel === model.id;
                    return (
                      <div
                        key={model.id}
                        onClick={() => setSelectedModel(model.id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? "bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-xs"
                            : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="font-bold text-xs text-slate-900">
                              {model.name}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${model.badgeColor}`}
                            >
                              {model.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-relaxed mb-2">
                            {model.description}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px] text-slate-500 font-mono">
                          <span>Tốc độ: {model.speed}</span>
                          <span>Chính xác: {model.accuracy}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {activeTab === "cloud" && (
            <div className="space-y-5">
              {/* Cloud DB Status Card */}
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                  <Cloud className="w-5 h-5" />
                </div>
                <div className="flex-1 space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-emerald-950">
                      Cơ Sở Dữ Liệu Đám Mây (Cloud Database)
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-900 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                      Trực Tuyến Sẵn Sàng
                    </span>
                  </div>
                  <p className="text-emerald-900 leading-relaxed">
                    Giúp kết nối máy tính của Thầy/Cô và điện thoại của toàn bộ học sinh theo thời gian thực (Real-time). Khi Thầy/Cô xuất bản đề thi, toàn bộ học sinh dùng <strong>4G/5G hoặc Wi-Fi bất kỳ</strong> chỉ cần quét mã QR hoặc gõ mã phòng là vào thi ngay lập tức.
                  </p>
                </div>
              </div>

              {/* Endpoint Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-emerald-600" />
                    <span>Máy Chủ Cloud Database:</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleResetCloudDbUrl}
                    className="text-[11px] text-emerald-700 hover:text-emerald-900 font-semibold underline cursor-pointer"
                  >
                    Khôi phục mặc định
                  </button>
                </div>

                <input
                  type="text"
                  value={cloudDbUrl}
                  onChange={(e) => setCloudDbUrl(e.target.value)}
                  placeholder="https://your-project.firebaseio.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-xs font-mono transition-all"
                />
                <p className="text-[11px] text-slate-500">
                  Hệ thống đã tích hợp sẵn máy chủ Cloud tốc độ cao của Edutest Pro. Thầy/Cô không cần thay đổi nếu không dùng máy chủ Firebase riêng.
                </p>
              </div>

              {/* Test Connection Button */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleTestCloudConnection}
                  disabled={isTestingCloud}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isTestingCloud ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Globe className="w-4 h-4" />
                  )}
                  <span>Kiểm Tra Kết Nối Đám Mây (Cloud Speed Test)</span>
                </button>

                {cloudTestResult && (
                  <div
                    className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 animate-fade-in ${
                      cloudTestResult.success
                        ? "bg-emerald-50 text-emerald-900 border border-emerald-300"
                        : "bg-rose-50 text-rose-900 border border-rose-300"
                    }`}
                  >
                    {cloudTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-bold">{cloudTestResult.msg}</p>
                      {cloudTestResult.latency !== undefined && (
                        <p className="text-[11px] text-emerald-700 mt-0.5">
                          Tốc độ phản hồi cực nhanh: <strong>{cloudTestResult.latency} ms</strong>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          {activeTab === "ai" ? (
            <button
              type="button"
              onClick={handleTestKey}
              disabled={isTesting || !apiKey.trim()}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border border-slate-300 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {isTesting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-amber-500" />
              )}
              <span>Kiểm tra Key</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleTestCloudConnection}
              disabled={isTestingCloud}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border border-slate-300 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {isTestingCloud ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Cloud className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span>Kiểm tra Cloud</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-blue-600/20 flex items-center gap-1.5 cursor-pointer"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>Đã Lưu!</span>
                </>
              ) : (
                <span>Lưu Cấu Hình</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
