#!/usr/bin/env python3
"""Find likely Google AI/Gemini API key validators that still assume AIzaSy-only keys."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


DEFAULT_SKIP_DIRS = {
    ".git",
    ".hg",
    ".svn",
    ".next",
    ".nuxt",
    ".svelte-kit",
    ".turbo",
    ".venv",
    "__pycache__",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "vendor",
}

TEXT_EXTENSIONS = {
    ".cjs",
    ".css",
    ".env",
    ".go",
    ".html",
    ".java",
    ".js",
    ".jsx",
    ".json",
    ".md",
    ".mjs",
    ".php",
    ".py",
    ".rb",
    ".rs",
    ".tsx",
    ".ts",
    ".txt",
    ".vue",
    ".yaml",
    ".yml",
}

PATTERNS = [
    ("legacy-prefix", re.compile(r"AIza(?:Sy)?")),
    ("starts-with-legacy", re.compile(r"startsWith\s*\(\s*['\"]AIza(?:Sy)?['\"]")),
    ("regex-legacy-anchor", re.compile(r"[/^][\^]?(?:AIzaSy|AIza)")),
    ("invalid-key-copy", re.compile(r"Invalid API Key|API Key kh[oô]ng h[oợ]p l[eệ]|Key ph[aả]i b[aắ]t", re.IGNORECASE)),
]


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def should_scan(path: Path) -> bool:
    if path.name.startswith(".env"):
        return True
    return path.suffix.lower() in TEXT_EXTENSIONS


def iter_files(root: Path, include_generated: bool) -> list[Path]:
    files: list[Path] = []
    for path in root.rglob("*"):
        if path.is_dir():
            continue
        if not include_generated and any(part in DEFAULT_SKIP_DIRS for part in path.parts):
            continue
        if should_scan(path):
            files.append(path)
    return files


def main() -> int:
    parser = argparse.ArgumentParser(description="Scan for Google AI API key validators that may reject AQ keys.")
    parser.add_argument("root", nargs="?", default=".", help="Project root to scan")
    parser.add_argument("--include-generated", action="store_true", help="Also scan dist/build/node_modules-like folders")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    if not root.exists():
        parser.error(f"root does not exist: {root}")

    matches = 0
    for path in iter_files(root, args.include_generated):
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue

        for line_no, line in enumerate(text.splitlines(), start=1):
            for label, pattern in PATTERNS:
                if pattern.search(line):
                    rel = path.relative_to(root)
                    print(f"{rel}:{line_no}: {label}: {line.strip()[:240]}")
                    matches += 1
                    break

    if matches == 0:
        print("No likely AIzaSy-only Google AI API key validators found.")
    else:
        print(f"\nFound {matches} likely place(s) to inspect.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
