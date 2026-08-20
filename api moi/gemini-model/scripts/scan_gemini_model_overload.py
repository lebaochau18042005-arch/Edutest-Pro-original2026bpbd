#!/usr/bin/env python3
"""Find Gemini call sites and error handlers that may mishandle 503 overloads."""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path


SKIP_DIRS = {
    ".git",
    ".hg",
    ".svn",
    "node_modules",
    "dist",
    "build",
    ".next",
    ".vercel",
    ".agent",
    "__pycache__",
}

SKIP_FILES = {
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
}

TEXT_EXTENSIONS = {
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".mjs",
    ".cjs",
    ".py",
    ".go",
    ".java",
    ".kt",
    ".cs",
    ".php",
    ".rb",
    ".md",
}

PATTERNS = [
    ("gemini-generate-content", re.compile(r"\.models\.generateContent\s*\(")),
    ("gemini-generate-content-stream", re.compile(r"\.models\.generateContentStream\s*\(")),
    ("chat-send-message-stream", re.compile(r"\.sendMessageStream\s*\(")),
    ("overload-signal", re.compile(r"503|UNAVAILABLE|high demand|overloaded|try again later", re.IGNORECASE)),
    ("model-overload-error-type", re.compile(r"MODEL_OVERLOADED")),
    ("api-error-parser", re.compile(r"parseApiError|getFriendlyErrorMessage")),
    ("fallback-models", re.compile(r"FALLBACK_MODELS|getOrderedModels|selectedModel")),
    ("key-rotation", re.compile(r"markKeyError|rotateToNextKey|cooldown|INVALID_API_KEY")),
]


def iter_files(root: Path):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        current = Path(dirpath)
        for filename in filenames:
            path = current / filename
            if filename in SKIP_FILES:
                continue
            if path.suffix.lower() not in TEXT_EXTENSIONS:
                continue
            yield path


def read_text(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        try:
            return path.read_text(encoding="utf-8-sig")
        except UnicodeDecodeError:
            return None


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(description="Scan for Gemini 503 overload handling gaps.")
    parser.add_argument("project_root", nargs="?", default=".", help="Project root to scan")
    args = parser.parse_args()

    root = Path(args.project_root).resolve()
    if not root.exists():
        parser.error(f"Project root does not exist: {root}")

    counts = {name: 0 for name, _ in PATTERNS}
    findings: list[tuple[str, int, str, str]] = []

    for path in iter_files(root):
        text = read_text(path)
        if text is None:
            continue

        for line_no, line in enumerate(text.splitlines(), start=1):
            for name, pattern in PATTERNS:
                if pattern.search(line):
                    counts[name] += 1
                    rel = path.relative_to(root)
                    snippet = line.strip()
                    if len(snippet) > 180:
                        snippet = snippet[:177] + "..."
                    findings.append((str(rel), line_no, name, snippet))

    for rel, line_no, name, snippet in findings:
        print(f"{rel}:{line_no}: {name}: {snippet}")

    print("\nSummary:")
    for name, count in counts.items():
        print(f"  {name}: {count}")

    direct_calls = counts["gemini-generate-content"] + counts["gemini-generate-content-stream"]
    has_overload_type = counts["model-overload-error-type"] > 0
    has_fallback = counts["fallback-models"] > 0

    print("\nRecommendations:")
    if direct_calls:
        print("  - Inspect direct generateContent call sites; one-off helpers often need model fallback loops.")
    if not has_overload_type:
        print("  - Add a MODEL_OVERLOADED error type for 503/UNAVAILABLE/high demand responses.")
    if not has_fallback:
        print("  - Add or reuse a FALLBACK_MODELS list and keep the selected model first.")
    if counts["key-rotation"]:
        print("  - Ensure MODEL_OVERLOADED does not mark API keys invalid or put them into cooldown.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
