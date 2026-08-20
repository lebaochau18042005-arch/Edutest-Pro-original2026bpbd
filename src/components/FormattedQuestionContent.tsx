import React, { useState, useMemo, useEffect } from "react";
import { ZoomIn, X, Download, Maximize2, Image as ImageIcon, RotateCw } from "lucide-react";
import katex from "katex";
import { convertWmfDataUriToPng, convertWmfDataUriToPngAsync } from "../utils/wmfHelper";

interface FormattedQuestionContentProps {
  content: string;
  className?: string;
  diagramUrl?: string;
}

/**
 * Robust Image component that automatically renders PNG/JPEG/SVG or converts WMF/EMF data URIs on the fly
 */
export const SafeExamImage: React.FC<{
  src: string;
  alt?: string;
  className?: string;
  onClick?: () => void;
  inline?: boolean;
}> = ({ src, alt = "Hình vẽ", className, onClick, inline = false }) => {
  const cleanInitialSrc = useMemo(() => {
    if (!src) return "";
    const trimmed = src.trim();
    if (trimmed.startsWith("data:image")) {
      return trimmed.replace(/\s+/g, "");
    }
    return trimmed;
  }, [src]);

  const [currentSrc, setCurrentSrc] = useState<string>(() => convertWmfDataUriToPng(cleanInitialSrc));
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const initial = convertWmfDataUriToPng(cleanInitialSrc);
    setCurrentSrc(initial);
    setHasError(false);

    if (
      cleanInitialSrc &&
      (cleanInitialSrc.startsWith("data:image/wmf") ||
        cleanInitialSrc.startsWith("data:image/x-wmf") ||
        cleanInitialSrc.startsWith("data:image/emf") ||
        cleanInitialSrc.startsWith("data:image/x-emf"))
    ) {
      convertWmfDataUriToPngAsync(cleanInitialSrc)
        .then((converted) => {
          if (isMounted && converted) {
            setCurrentSrc(converted);
          }
        })
        .catch(() => {});
    }

    return () => {
      isMounted = false;
    };
  }, [cleanInitialSrc]);

  if (hasError || !currentSrc) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200">
        <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
        <span>{alt || "Hình vẽ"}</span>
      </span>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      onClick={onClick}
      onError={() => {
        if (!currentSrc.startsWith("data:image/png") && cleanInitialSrc) {
          convertWmfDataUriToPngAsync(cleanInitialSrc)
            .then((png) => {
              if (png && png !== currentSrc) {
                setCurrentSrc(png);
              } else {
                setHasError(true);
              }
            })
            .catch(() => setHasError(true));
        } else {
          setHasError(true);
        }
      }}
      loading="lazy"
    />
  );
};

/**
 * Component to safely render text with LaTeX formulas ($...$ or $$...$$) and inline images using KaTeX
 */
export const MathTextRenderer: React.FC<{ text: string }> = ({ text }) => {
  const [modalImage, setModalImage] = useState<{ src: string; alt: string } | null>(null);

  const renderedSegments = useMemo(() => {
    if (!text) return [];

    // Match either LaTeX math ($...$ or $$...$$) or Markdown images (![alt](src))
    const combinedRegex = /(!\[(.*?)\]\(\s*(data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=\s\r\n]+|https?:\/\/[^\s)]+|\/[^\s)]+|[^\s)]+?)\s*\)|\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g;

    const parts: Array<{
      type: "text" | "math" | "image";
      value: string;
      alt?: string;
      displayMode?: boolean;
    }> = [];
    let lastIdx = 0;
    let match;

    while ((match = combinedRegex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push({
          type: "text",
          value: text.slice(lastIdx, match.index),
        });
      }

      const rawMatch = match[0];

      // Check if it's a markdown image
      if (rawMatch.startsWith("![") && match[3]) {
        const alt = match[2] || "Hình vẽ";
        const cleanSrc = match[3].trim().startsWith("data:image") ? match[3].replace(/\s+/g, "") : match[3].trim();
        const src = convertWmfDataUriToPng(cleanSrc);
        parts.push({
          type: "image",
          value: src,
          alt,
        });
      } else {
        // It's math
        let formula = rawMatch;
        let displayMode = false;

        if (rawMatch.startsWith("$$") && rawMatch.endsWith("$$")) {
          formula = rawMatch.slice(2, -2).trim();
          displayMode = true;
        } else if (rawMatch.startsWith("\\[") && rawMatch.endsWith("\\]")) {
          formula = rawMatch.slice(2, -2).trim();
          displayMode = true;
        } else if (rawMatch.startsWith("\\(") && rawMatch.endsWith("\\)")) {
          formula = rawMatch.slice(2, -2).trim();
          displayMode = false;
        } else if (rawMatch.startsWith("$") && rawMatch.endsWith("$")) {
          formula = rawMatch.slice(1, -1).trim();
          displayMode = false;
        }

        parts.push({
          type: "math",
          value: formula,
          displayMode,
        });
      }

      lastIdx = combinedRegex.lastIndex;
    }

    if (lastIdx < text.length) {
      parts.push({
        type: "text",
        value: text.slice(lastIdx),
      });
    }

    return parts;
  }, [text]);

  if (!text) return null;

  return (
    <>
      <span className="whitespace-pre-line inline-flex flex-wrap items-center gap-1.5 align-middle">
        {renderedSegments.map((part, pIdx) => {
          if (part.type === "text") {
            return <span key={pIdx}>{part.value}</span>;
          }

          if (part.type === "image") {
            return (
              <span
                key={pIdx}
                className="inline-flex items-center my-0.5 max-w-full rounded bg-white p-0.5 border border-slate-200 shadow-2xs group relative cursor-zoom-in"
                onClick={(e) => {
                  e.stopPropagation();
                  setModalImage({ src: part.value, alt: part.alt || "Hình vẽ" });
                }}
              >
                <SafeExamImage
                  src={part.value}
                  alt={part.alt || "Hình vẽ"}
                  className="max-h-24 sm:max-h-32 max-w-full object-contain rounded inline-block"
                />
              </span>
            );
          }

          try {
            const html = katex.renderToString(part.value, {
              throwOnError: false,
              displayMode: part.displayMode,
            });
            return (
              <span
                key={pIdx}
                className={part.displayMode ? "block my-2 text-center overflow-x-auto py-1 w-full" : "inline-block px-0.5"}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          } catch {
            return <span key={pIdx} className="font-mono text-indigo-700 font-semibold">{`$${part.value}$`}</span>;
          }
        })}
      </span>

      {modalImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            e.stopPropagation();
            setModalImage(null);
          }}
        >
          <div
            className="relative max-w-3xl max-h-[85vh] bg-white rounded-2xl p-4 shadow-2xl overflow-hidden flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-slate-100 px-2">
              <span className="text-xs font-bold text-slate-800">{modalImage.alt}</span>
              <div className="flex items-center gap-2">
                <a
                  href={modalImage.src}
                  download="hinh_ve.png"
                  className="p-1.5 text-slate-500 hover:text-emerald-600 rounded-lg transition-colors flex items-center gap-1 text-xs"
                  title="Tải về máy"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải ảnh</span>
                </a>
                <button
                  type="button"
                  onClick={() => setModalImage(null)}
                  className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <SafeExamImage
              src={modalImage.src}
              alt={modalImage.alt}
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </>
  );
};

/**
 * Enhanced Content Renderer for Exam Questions:
 * - Renders Markdown images: ![Alt text](url_or_base64)
 * - Renders Markdown tables
 * - Renders KaTeX LaTeX formulas
 * - Supports Interactive Lightbox Modal for zooming diagrams & graphs
 */
export const FormattedQuestionContent: React.FC<FormattedQuestionContentProps> = ({
  content,
  className = "",
  diagramUrl,
}) => {
  const [activeModalImage, setActiveModalImage] = useState<{ src: string; alt: string } | null>(null);

  // Parse markdown tables from text segment
  const parseTextAndTables = (
    textChunk: string,
    outputList: Array<{ type: "text" | "table" | "image" | "diagram"; data: any; alt?: string }>
  ) => {
    if (!textChunk) return;

    // Check if contains Markdown table (| ... | ... |)
    const lines = textChunk.split("\n");
    let currentTableRows: string[][] = [];
    let currentTextLines: string[] = [];

    const flushText = () => {
      if (currentTextLines.length > 0) {
        const textToPush = currentTextLines.join("\n");
        if (textToPush.trim()) {
          outputList.push({
            type: "text",
            data: textToPush,
          });
        }
        currentTextLines = [];
      }
    };

    const flushTable = () => {
      if (currentTableRows.length > 0) {
        outputList.push({
          type: "table",
          data: currentTableRows,
        });
        currentTableRows = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const isPipeTableLine = line.startsWith("|") && line.endsWith("|");

      if (isPipeTableLine) {
        flushText();
        // Ignore markdown divider line |---|---|
        if (!/^\|[\s-:]+\|$/.test(line)) {
          const cells = line
            .slice(1, -1)
            .split("|")
            .map((c) => c.trim());
          currentTableRows.push(cells);
        }
      } else {
        flushTable();
        currentTextLines.push(lines[i]);
      }
    }

    flushTable();
    flushText();
  };

  // Extract markdown images `![Alt](src)` and structure content
  const segments = useMemo(() => {
    const output: Array<{ type: "text" | "table" | "image" | "diagram"; data: any; alt?: string }> = [];
    // Match ![alt](dataUri/url) robustly even with whitespace or newlines inside base64
    const imageRegex = /!\[(.*?)\]\(\s*(data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=\s\r\n]+|https?:\/\/[^\s)]+|\/[^\s)]+|[^\s)]+?)\s*\)/g;

    let lastIndex = 0;
    let match;

    const rawContent = content || "";

    while ((match = imageRegex.exec(rawContent)) !== null) {
      const textBefore = rawContent.slice(lastIndex, match.index);
      if (textBefore.trim()) {
        parseTextAndTables(textBefore, output);
      }

      const altText = match[1] || "Hình vẽ / Biểu đồ câu hỏi";
      const cleanSrc = match[2].trim().startsWith("data:image") ? match[2].replace(/\s+/g, "") : match[2].trim();
      const src = convertWmfDataUriToPng(cleanSrc);
      output.push({
        type: "image",
        data: src,
        alt: altText,
      });

      lastIndex = imageRegex.lastIndex;
    }

    const remainingText = rawContent.slice(lastIndex);
    if (remainingText.trim() || output.length === 0) {
      parseTextAndTables(remainingText, output);
    }

    // If there's an explicit diagramUrl not already in content
    if (diagramUrl && !rawContent.includes(diagramUrl)) {
      output.push({
        type: "image",
        data: convertWmfDataUriToPng(diagramUrl),
        alt: "Hình vẽ minh họa câu hỏi",
      });
    }

    return output;
  }, [content, diagramUrl]);

  return (
    <div className={`space-y-3.5 leading-relaxed text-slate-800 ${className}`}>
      {segments.map((seg, idx) => {
        if (seg.type === "image") {
          return (
            <div
              key={idx}
              className="my-3 p-2.5 sm:p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs group relative max-w-2xl mx-auto"
            >
              <div className="relative overflow-hidden rounded-lg bg-slate-50/50 flex flex-col items-center">
                <SafeExamImage
                  src={seg.data}
                  alt={seg.alt || "Hình vẽ câu hỏi"}
                  className="max-h-80 sm:max-h-96 w-auto object-contain cursor-zoom-in transition-transform duration-200 hover:scale-[1.01]"
                  onClick={() => setActiveModalImage({ src: seg.data, alt: seg.alt || "Hình vẽ câu hỏi" })}
                />

                {/* Hover overlay actions */}
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/80 backdrop-blur-xs p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setActiveModalImage({ src: seg.data, alt: seg.alt || "Hình vẽ câu hỏi" })}
                    className="p-1 text-white hover:text-amber-300 transition-colors"
                    title="Phóng to hình ảnh"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                  <a
                    href={seg.data}
                    download="hinh_ve_de_thi.png"
                    className="p-1 text-white hover:text-emerald-300 transition-colors"
                    title="Tải hình ảnh về máy"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {seg.alt && (
                <div className="mt-2 text-center text-xs font-medium text-slate-500 flex items-center justify-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>{seg.alt}</span>
                </div>
              )}
            </div>
          );
        }

        if (seg.type === "table") {
          const rows = seg.data as string[][];
          if (rows.length === 0) return null;
          const header = rows[0];
          const bodyRows = rows.slice(1);

          return (
            <div
              key={idx}
              className="my-3 overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-2xs"
            >
              <table className="w-full text-xs text-left border-collapse">
                {header && header.length > 0 && (
                  <thead>
                    <tr className="bg-slate-100/90 border-b border-slate-300 text-slate-900 font-bold">
                      {header.map((cell, cIdx) => (
                        <th
                          key={cIdx}
                          className="px-3.5 py-2.5 border-r border-slate-200 last:border-r-0 text-center"
                        >
                          <MathTextRenderer text={cell} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody className="divide-y divide-slate-200">
                  {bodyRows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className={rIdx % 2 === 0 ? "bg-white" : "bg-slate-50/70"}
                    >
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className="px-3.5 py-2 border-r border-slate-200 last:border-r-0 text-center font-sans text-slate-800"
                        >
                          <MathTextRenderer text={cell} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (seg.type === "diagram") {
          return (
            <div
              key={idx}
              className="my-2.5 p-3.5 bg-slate-900 text-emerald-300 font-mono text-xs rounded-xl overflow-x-auto border border-slate-800 shadow-inner"
            >
              <div className="text-[10px] text-slate-400 font-sans font-bold uppercase mb-1.5 flex items-center gap-1">
                <span>📊 Bảng biến thiên / Sơ đồ biểu diễn:</span>
              </div>
              <pre className="leading-relaxed whitespace-pre font-mono select-all">
                {seg.data as string}
              </pre>
            </div>
          );
        }

        // Regular Text with Math KaTeX renderer
        return (
          <div key={idx} className="text-slate-800">
            <MathTextRenderer text={seg.data as string} />
          </div>
        );
      })}

      {/* Interactive Modal Lightbox for Full Zoom */}
      {activeModalImage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
          onClick={() => setActiveModalImage(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] bg-white rounded-2xl p-4 sm:p-6 shadow-2xl flex flex-col items-center overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header controls */}
            <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <span className="text-sm font-bold text-slate-800">{activeModalImage.alt}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={activeModalImage.src}
                  download="hinh_ve_de_thi.png"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải ảnh gốc</span>
                </a>
                <button
                  type="button"
                  onClick={() => setActiveModalImage(null)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Main high-res image view */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-2 bg-slate-50 rounded-xl border border-slate-100 max-h-[72vh] w-full">
              <SafeExamImage
                src={activeModalImage.src}
                alt={activeModalImage.alt}
                className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default FormattedQuestionContent;
