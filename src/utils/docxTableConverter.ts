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
      const trElements = Array.from(el.querySelectorAll("tr"));

      trElements.forEach((tr) => {
        const cells = Array.from(tr.querySelectorAll(":scope > th, :scope > td, tr > th, tr > td"));
        const targetCells = cells.length > 0 ? cells : Array.from(tr.children);

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
      const hasOptions = flatCells.some((c) => /^[A-D][.)/:]\s+/i.test(c));
      const hasStatements = flatCells.some((c) => /^[a-d][.)/:]\s+/i.test(c));

      if (hasOptions || hasStatements) {
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
      return inner.length === 1 ? `^${inner}` : `^{${inner}}`;
    }

    // Subscripts (Math indices, e.g. x_1, u_n, log_2)
    if (tagName === "sub") {
      const inner = Array.from(el.childNodes).map(processNode).join("").trim();
      if (!inner) return "";
      return inner.length === 1 ? `_${inner}` : `_{${inner}}`;
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
