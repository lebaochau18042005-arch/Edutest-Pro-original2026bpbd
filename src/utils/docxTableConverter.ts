/**
 * Utility to convert HTML produced by mammoth.convertToHtml into clean Markdown,
 * preserving table structures (| col1 | col2 |), headings, lists, images, and paragraphs.
 * Supports tokenizing embedded Base64 images to prevent payload bloat and UI lagging.
 * Preserves math formulas (sup, sub, mathml) and images inside tables.
 */

export interface DocxConversionResult {
  markdown: string;
  imageMap: Record<string, string>;
}

function escapeLatexScript(text: string): string {
  return text.replace(/\\/g, "\\backslash ").replace(/([{}_%&#])/g, "\\$1");
}

export function convertDocxHtmlToMarkdown(
  html: string,
  existingImageMap?: Record<string, string>
): DocxConversionResult {
  if (!html) return { markdown: "", imageMap: existingImageMap || {} };

  const imageMap: Record<string, string> = { ...(existingImageMap || {}) };
  let imageCount = Object.keys(imageMap).length;

  // Create a DOM parser in the browser
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  function processNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent || "").replace(/\u00A0/g, " ");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const el = node as HTMLElement;
    const tagName = el.tagName.toLowerCase();

    // Tables: preserve child images, formulas, and text inside cells
    if (tagName === "table") {
      const rows: string[][] = [];
      const trElements = Array.from(el.querySelectorAll("tr")).filter(
        (row) => row.closest("table") === el
      );

      trElements.forEach((tr) => {
        const targetCells = Array.from(tr.children).filter((cell) =>
          ["th", "td"].includes(cell.tagName.toLowerCase())
        );

        const rowData = targetCells.map((cell) => {
          const inner = Array.from(cell.childNodes).map(processNode).join("");
          return inner.replace(/\u00A0/g, " ").replace(/[\r\n\t]+/g, " ").trim();
        });
        if (rowData.length > 0 && rowData.some((c) => c.length > 0)) {
          rows.push(rowData);
        }
      });

      if (rows.length === 0) return "";

      const flatCells = rows.flat().filter(Boolean);
      const optionLetters = new Set<string>();
      const statementLetters = new Set<string>();

      flatCells.forEach((c) => {
        const optMatch = c.trim().match(/^\*{0,2}(?:\[?([A-D])\]?|\(([A-D])\)|([A-D]))[.)/:]/i);
        if (optMatch) optionLetters.add((optMatch[1] || optMatch[2] || optMatch[3]).toUpperCase());

        const stmtMatch = c.trim().match(/^\*{0,2}(?:(?:Ý|Mệnh đề|Khẳng định|Câu)\s*)?(?:\[?([a-d])\]?|\(([a-d])\)|([a-d]))[.)/:]/i);
        if (stmtMatch) statementLetters.add((stmtMatch[1] || stmtMatch[2] || stmtMatch[3]).toLowerCase());
      });

      // Detect if this table is a true DATA TABLE (Bảng số liệu):
      // - Contains statistical indicators, years, percentages, numbers with units
      // - Or has a clear header row with descriptive words (Năm, Tiêu chí, Chỉ số, Vùng, x, y, f(x)...)
      const dataKeywords = /(?:năm|tháng|quốc gia|tỉnh|thành phố|vùng|địa phương|sản lượng|diện tích|dân số|tốc độ|tỉ lệ|tỷ lệ|gdp|xuất khẩu|nhập khẩu|giá trị|doanh thu|khối lượng|thể tích|nhiệt độ|áp suất|nồng độ|thời gian|chỉ số|bảng biến thiên|tần số|tần suất|khoảng biến thiên|\b[xy]\b|f\(x\)|y'|y''|đơn vị|triệu|nghìn|tấn|ha|km|m\^?2|m\^?3|%|USD|VNĐ)/i;
      const hasDataKeywords = flatCells.some((c) => dataKeywords.test(c));
      const numericCellsCount = flatCells.filter((c) => /^\d+([.,]\d+)?\s*(%|triệu|tỉ|tấn|ha|km|m|kg|s|h|độ|lần)?$/i.test(c.trim())).length;
      const hasNumericData = numericCellsCount >= 2;

      // Only treat as layout table if it is STRICTLY options/statements AND NOT a data table
      const isPureOptionsLayout =
        !hasDataKeywords &&
        !hasNumericData &&
        (optionLetters.size >= 3 || statementLetters.size >= 3) &&
        rows.length <= 6 &&
        flatCells.length <= 16 &&
        flatCells.every((c) => {
          const t = c.trim();
          return (
            !t ||
            /^\*{0,2}(?:\[?[A-D]\]?|\([A-D]\)|[A-D])[.)/:]/i.test(t) ||
            /^\*{0,2}(?:(?:Ý|Mệnh đề|Khẳng định|Câu)\s*)?(?:\[?[a-d]\]?|\(([a-d]\)|[a-d]))[.)/:]/i.test(t)
          );
        });

      if (isPureOptionsLayout) {
        return "\n" + flatCells.join("\n") + "\n";
      }

      // Determine max columns
      const maxCols = Math.max(...rows.map((r) => r.length));
      if (maxCols === 0) return "";

      // Normalize row lengths
      const normalizedRows = rows.map((row) => {
        const copy = [...row];
        while (copy.length < maxCols) {
          copy.push("");
        }
        return copy;
      });

      const headerRow = normalizedRows[0];
      const dataRows = normalizedRows.slice(1);

      let tableMd = "\n\n| " + headerRow.map((c) => c || "-").join(" | ") + " |\n";
      tableMd += "| " + Array(maxCols).fill(":---").join(" | ") + " |\n";

      if (dataRows.length > 0) {
        dataRows.forEach((row) => {
          tableMd += "| " + row.map((c) => c || "").join(" | ") + " |\n";
        });
      }

      return tableMd + "\n";
    }

    // Don't process inside tables again if handled above
    if (tagName === "tbody" || tagName === "thead" || tagName === "tr" || tagName === "td" || tagName === "th") {
      return "";
    }

    // Superscripts (Math powers, e.g. x^2, x^{n+1})
    if (tagName === "sup") {
      const inner = Array.from(el.childNodes).map(processNode).join("").trim();
      if (!inner) return "";
      return "$" + "{}^{" + escapeLatexScript(inner) + "}$";
    }

    // Subscripts (Math indices, e.g. x_1, u_n, log_2)
    if (tagName === "sub") {
      const inner = Array.from(el.childNodes).map(processNode).join("").trim();
      if (!inner) return "";
      return "$" + "{}_{" + escapeLatexScript(inner) + "}$";
    }

    // MathML or math tags
    if (tagName === "math" || tagName === "m:omath" || tagName === "m:omathpara") {
      const inner = Array.from(el.childNodes).map(processNode).join("").trim();
      return inner ? ` $${inner}$ ` : "";
    }

    // Headings
    if (tagName.match(/^h[1-6]$/)) {
      const inner = Array.from(el.childNodes).map(processNode).join("").trim();
      return `\n\n### ${inner}\n\n`;
    }

    // Paragraphs & Divs
    if (tagName === "p" || tagName === "div") {
      const inner = Array.from(el.childNodes).map(processNode).join("").trim();
      return inner ? `\n${inner}\n` : "\n";
    }

    // Line breaks
    if (tagName === "br") {
      return "\n";
    }

    // Lists
    if (tagName === "li") {
      const inner = Array.from(el.childNodes).map(processNode).join("").trim();
      return `\n- ${inner}`;
    }

    // Bold / Italic / Strong
    if (tagName === "strong" || tagName === "b") {
      const inner = Array.from(el.childNodes).map(processNode).join("");
      return inner ? `**${inner}**` : "";
    }
    if (tagName === "em" || tagName === "i") {
      const inner = Array.from(el.childNodes).map(processNode).join("");
      return inner ? `*${inner}*` : "";
    }

    // Inline Code
    if (tagName === "code") {
      const inner = Array.from(el.childNodes).map(processNode).join("");
      return `\`${inner}\``;
    }

    // Images
    if (tagName === "img") {
      const rawSrc = el.getAttribute("src") || "";
      const alt = el.getAttribute("alt") || `Hình vẽ ${imageCount + 1}`;

      if (rawSrc.startsWith("data:image")) {
        const cleanBase64 = rawSrc.replace(/\s+/g, "");
        const token = `__IMG_TOKEN_${imageCount}__`;
        imageMap[token] = cleanBase64;
        imageCount++;
        return `\n![${alt}](${token})\n`;
      } else if (rawSrc.trim().length > 0) {
        return `\n![${alt}](${rawSrc})\n`;
      }
      return "";
    }

    // Default fallback: process children
    return Array.from(el.childNodes).map(processNode).join("");
  }

  const rawMd = Array.from(doc.body.childNodes).map(processNode).join("");

  const cleanMarkdown = rawMd
    .replace(/\u00A0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    markdown: cleanMarkdown,
    imageMap,
  };
}
