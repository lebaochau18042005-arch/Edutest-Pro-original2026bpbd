---
name: google-ai-api-key-validation
description: Update codebases that validate Google AI Studio, Gemini, or Generative Language API keys so both legacy keys starting with AIzaSy and new keys starting with AQ are accepted. Use when an app rejects Gemini/Google AI API keys, shows "Invalid API Key", hard-codes startsWith("AIza") or startsWith("AIzaSy"), or needs a reusable regex/helper for API key format validation across frontend, backend, env parsing, settings modals, or key rotation managers.
---

# Google AI API Key Validation

## Goal

Update API key validation without changing actual Google API calls. The app should stop rejecting user-entered Google AI/Gemini keys that start with `AQ`, while still accepting legacy keys that start with `AIzaSy`.

## Workflow

1. Search the codebase for likely validators and user-facing copy:
   - `AIza`, `AIzaSy`, `AQ`
   - `Invalid API Key`, `API Key khong hop le`, `Key phai bat dau`
   - `startsWith`, regex literals, `apiKey`, `api_key`, `GEMINI_API_KEY`, `VITE_GEMINI_API_KEYS`
2. Inspect every validation path, not only the visible input modal:
   - settings or API key modal
   - localStorage/sessionStorage migration
   - env key parsing
   - key manager or key rotation logic
   - backend request validation, if present
   - bundled production output only if the project commits build artifacts
3. Replace prefix-only checks such as `key.startsWith("AIza")` with a shared helper where the project style allows it.
4. Update UI copy and placeholders so users see `AIzaSy... or AQ...`, not only `AIza...`.
5. Build or run the narrowest available validation command. If there are pre-existing unrelated type or lint failures, report them clearly.

## Recommended Regex

Prefer a permissive prefix validator:

```ts
const GOOGLE_AI_API_KEY_PATTERN = /^(?:AIzaSy|AQ)\S{8,}$/;
```

Use the same pattern in JavaScript, TypeScript, Python, or other languages:

- Accepts `AIzaSy...`
- Accepts `AQ...`
- Rejects empty strings, whitespace-containing keys, and unrelated prefixes
- Avoids overfitting the unknown tail of the newer `AQ` format

If an existing app intentionally validates a stricter character set and there is confirmed product documentation for the key body, keep the stricter body but still include both prefixes:

```ts
const GOOGLE_AI_API_KEY_PATTERN = /^(?:AIzaSy|AQ)[A-Za-z0-9_-]{8,}$/;
```

## Helper Pattern

For TypeScript/JavaScript projects, prefer a small shared helper instead of duplicating regexes:

```ts
export const GOOGLE_AI_API_KEY_PATTERN = /^(?:AIzaSy|AQ)\S{8,}$/;

export const isValidGoogleAiApiKey = (key: string): boolean => {
  return GOOGLE_AI_API_KEY_PATTERN.test(key.trim());
};
```

For Python:

```python
import re

GOOGLE_AI_API_KEY_PATTERN = re.compile(r"^(?:AIzaSy|AQ)\S{8,}$")

def is_valid_google_ai_api_key(key: str) -> bool:
    return bool(GOOGLE_AI_API_KEY_PATTERN.match(key.strip()))
```

## Guardrails

- Do not log full API keys. If display is needed, mask keys with prefix plus last four characters.
- Do not remove server-side authentication or actual API error handling.
- Do not treat a real 401/403 response from Google as a format-validation issue.
- Do not edit unrelated generated bundles unless the repository clearly commits and serves `dist` or equivalent build output.
- Do not run destructive git commands. Preserve user changes.

## Script

Use `scripts/scan_google_ai_key_validation.py <project-root>` to find likely files that still hard-code `AIza` validation or old API key copy. The script is read-only and prints file, line number, and matching pattern.
