export const FALLBACK_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
] as const;

export const DEFAULT_GEMINI_MODEL = FALLBACK_MODELS[0];
export const OFFICIAL_AI_STUDIO_KEY_URL = "https://aistudio.google.com/api-keys";

export function isValidGoogleAiApiKey(value: string): boolean {
  const key = String(value || "").trim();
  return /^AIzaSy[A-Za-z0-9_-]{20,}$/.test(key);
}
