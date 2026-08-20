---
name: gemini-model-overload-fallback
description: Update codebases that call Google AI Studio, Gemini, or Generative Language APIs so transient model overload errors are handled correctly. Use when an app logs or displays 503, UNAVAILABLE, "This model is currently experiencing high demand", "model overloaded", "try again later", or when Gemini calls use a single selected model without fallback and incorrectly surface the issue as Invalid API Key, quota, or a hard failure.
---

# Gemini Model Overload Fallback

## Goal

Make Gemini-powered apps resilient to temporary Google model overloads. A `503 UNAVAILABLE` or "high demand" response is a model/service availability issue, not an API key format, auth, or quota problem.

## Workflow

1. Search the codebase for Gemini call sites and error handling:
   - `503`, `UNAVAILABLE`, `high demand`, `overloaded`, `try again later`
   - `generateContent`, `generateContentStream`, `sendMessageStream`
   - `parseApiError`, `getFriendlyErrorMessage`, `Invalid API Key`, `INVALID_API_KEY`
   - `FALLBACK_MODELS`, `selectedModel`, `model`, `apiKeyManager`, `markKeyError`
2. Run `scripts/scan_gemini_model_overload.py <project-root>` for a quick read-only scan.
3. Confirm the error category:
   - `401`, `API_KEY_INVALID`, `PERMISSION_DENIED` => auth/key issue.
   - `429`, `RESOURCE_EXHAUSTED`, quota text => quota/rate limit issue.
   - `503`, `UNAVAILABLE`, `high demand`, `overloaded` => model overload; do not blame the API key.
4. Add or reuse a model fallback list. Keep the user's selected model first, then try stable/cheaper fallbacks.
5. Add a dedicated error type such as `MODEL_OVERLOADED` before generic `UNKNOWN` handling.
6. Apply fallback loops to every Gemini path, especially one-off analysis helpers that call `ai.models.generateContent` directly.
7. Keep API key rotation separate. Do not mark keys invalid, error, or cooldown for `MODEL_OVERLOADED`.
8. Update user-facing copy so the app says the model is temporarily overloaded and suggests retrying or selecting a lighter model.
9. Build or run the narrowest validation command.

## TypeScript Pattern

Use the existing model constants if the app already has them. Otherwise define a conservative ordered list:

```ts
const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro'
];
```

Detect overload separately from auth and quota:

```ts
export const parseApiError = (error: any): string => {
  const message = error?.message || error?.toString() || '';
  const serialized = JSON.stringify(error) || '';

  if (
    serialized.includes('429') ||
    message.includes('RESOURCE_EXHAUSTED') ||
    message.toLowerCase().includes('quota')
  ) return 'QUOTA_EXCEEDED';

  if (
    serialized.includes('503') ||
    message.includes('UNAVAILABLE') ||
    message.toLowerCase().includes('high demand') ||
    message.toLowerCase().includes('overloaded')
  ) return 'MODEL_OVERLOADED';

  if (
    message.includes('API_KEY_INVALID') ||
    message.includes('401') ||
    message.includes('PERMISSION_DENIED')
  ) return 'INVALID_API_KEY';

  return 'UNKNOWN';
};
```

For non-streaming `generateContent` helpers:

```ts
const getOrderedModels = (selectedModel?: string): string[] => {
  if (!selectedModel || !FALLBACK_MODELS.includes(selectedModel)) return FALLBACK_MODELS;
  return [selectedModel, ...FALLBACK_MODELS.filter((model) => model !== selectedModel)];
};

const generateContentWithModelFallback = async ({
  apiKey,
  selectedModel,
  contents,
  config,
}: {
  apiKey: string;
  selectedModel?: string;
  contents: any;
  config?: any;
}) => {
  const ai = new GoogleGenAI({ apiKey });
  let lastError: any = null;

  for (const model of getOrderedModels(selectedModel)) {
    try {
      return await ai.models.generateContent({
        model,
        contents,
        ...(config ? { config } : {}),
      });
    } catch (error: any) {
      lastError = error;
      if (parseApiError(error) === 'INVALID_API_KEY') break;
    }
  }

  throw lastError || new Error('All Gemini models failed. Please try again later.');
};
```

For streaming calls, the same loop is appropriate, but preserve chat history only after a full successful response. If partial chunks already reached the UI before a stream fails, clear or annotate the partial output before retrying with another model.

## Key Rotation Guard

If the app has an API key manager, keep overload errors from poisoning key state:

```ts
if (errorType === 'MODEL_OVERLOADED') {
  keyInfo.lastError = errorType;
  saveToStorage();
  return {
    success: false,
    hasMoreKeys: hasAvailableKeys(),
    message: 'Model is temporarily overloaded; API key remains active.',
  };
}
```

Only rotate or cooldown keys for quota and rate limit errors. Only mark keys invalid for authentication errors.

## Validation

After edits:

1. Run the scan script again and inspect remaining direct `generateContent` call sites.
2. Run the project build, for example `npm run build`.
3. Confirm the app no longer shows "Invalid API Key" for a `503` overload.
4. Confirm logs show fallback attempts across models.

Build warnings about bundle size or third-party `eval` are not overload fixes unless they fail the build.
