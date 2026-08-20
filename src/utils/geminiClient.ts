import { GoogleGenAI } from "@google/genai";
import {
  FALLBACK_MODELS,
  DEFAULT_GEMINI_MODEL,
  isValidGoogleAiApiKey,
  GEMINI_ERROR_MESSAGES,
} from "./geminiConfig";
import { getStoredApiKey, getStoredSelectedModel } from "../components/ModelSettingsModal";

export interface GeminiCallOptions {
  apiKey?: string;
  model?: string;
  systemInstruction?: string;
  temperature?: number;
  responseMimeType?: string;
  responseSchema?: any;
}

export interface GeminiCallResult {
  text: string;
  modelUsed: string;
  fallbackCount: number;
}

/**
 * Standard fallback model sequence:
 * 1. gemini-3.5-flash (Default)
 * 2. gemini-3.1-flash-lite
 * 3. gemini-3.1-pro-preview
 * 4. gemini-2.5-flash-lite
 */
export const STANDARD_FALLBACK_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.1-pro-preview",
  "gemini-2.5-flash-lite",
] as const;

/**
 * Call Gemini AI with automatic fallback across models.
 * Priority: User's stored localStorage key > passed key.
 */
export async function callGeminiWithFallback(
  prompt: string | Array<any>,
  options: GeminiCallOptions = {}
): Promise<GeminiCallResult> {
  const apiKey = options.apiKey || getStoredApiKey();

  if (!apiKey || !apiKey.trim()) {
    throw new Error(
      "CHƯA CÓ API KEY: Vui lòng nhấn nút 'Lấy API key để sử dụng app' ở thanh trên cùng để nhập Google Gemini API Key."
    );
  }

  const selectedModel = options.model || getStoredSelectedModel() || "gemini-3-flash-preview";

  // Build model priority list starting with the selected model
  const modelList: string[] = [
    selectedModel,
    ...STANDARD_FALLBACK_MODELS.filter((m) => m !== selectedModel),
  ];

  let lastError: any = null;
  let fallbackCount = 0;

  for (let i = 0; i < modelList.length; i++) {
    const currentModel = modelList[i];
    try {
      const ai = new GoogleGenAI({
        apiKey: apiKey.trim(),
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const config: any = {};
      if (options.systemInstruction) {
        config.systemInstruction = options.systemInstruction;
      }
      if (options.temperature !== undefined) {
        config.temperature = options.temperature;
      }
      if (options.responseMimeType) {
        config.responseMimeType = options.responseMimeType;
      }
      if (options.responseSchema) {
        config.responseSchema = options.responseSchema;
      }

      const contents = Array.isArray(prompt) ? prompt : [prompt];
      const response = await ai.models.generateContent({
        model: currentModel,
        contents,
        config,
      });

      const text = response.text || "";
      if (!text && !response) {
        throw new Error("Phản hồi rỗng từ Gemini API.");
      }

      return {
        text,
        modelUsed: currentModel,
        fallbackCount,
      };
    } catch (err: any) {
      lastError = err;
      fallbackCount++;
      console.warn(`[EduTest AI] Model ${currentModel} gặp lỗi, tự động chuyển sang model kế tiếp...`, err);
    }
  }

  // If all models failed, throw raw error message formatted per AI_INSTRUCTIONS.md
  const rawMsg =
    lastError?.message ||
    (typeof lastError === "string" ? lastError : JSON.stringify(lastError));
  throw new Error(`[LỖI TẤT CẢ MODEL] Đã thử ${modelList.join(", ")} nhưng đều thất bại. Nguyên văn lỗi từ Google API: ${rawMsg}`);
}
