// Quy tắc & Cấu hình chuẩn Gemini API (v3.1 - 26/06/2026)

export const GOOGLE_AI_API_KEY_PATTERN = /^(?:AIzaSy|AQ)\S{8,}$/;

export const isValidGoogleAiApiKey = (key: string): boolean => {
  if (!key) return false;
  return GOOGLE_AI_API_KEY_PATTERN.test(key.trim());
};

export const OFFICIAL_AI_STUDIO_KEY_URL = "https://aistudio.google.com/apikey";

// 4 model mặc định hiện hành thế hệ 3.x theo thứ tự fallback ưu tiên
export const FALLBACK_MODELS = [
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-3.1-pro-preview",
  "gemini-3.1-flash-lite",
] as const;

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";

// Danh sách các model tùy chọn hợp lệ (Thế hệ 3.x)
export const OPTIONAL_MODELS = [
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-3.1-pro-preview",
  "gemini-3.1-flash-lite",
] as const;

// Danh sách model cũ / đã bị loại bỏ (dưới 3.0 bao gồm 1.5, 2.0, 2.5)
export const DEPRECATED_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
] as const;

export const GEMINI_ERROR_MESSAGES = {
  MISSING_KEY: "Vui lòng cấu hình Google Gemini API Key trước khi sử dụng tính năng này.",
  INVALID_KEY: "API Key không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại trong phần Cài đặt.",
  PERMISSION_DENIED: "API key không có quyền truy cập Gemini API. Hãy tạo key mới tại Google AI Studio.",
  QUOTA_EXCEEDED: "Đã hết quota hoặc vượt giới hạn tốc độ API. Vui lòng đợi một lát rồi thử lại.",
  MODEL_OVERLOADED: "Model Google đang quá tải. Hệ thống đang tự động thử model dự phòng.",
} as const;
