import JSZip from "jszip";
import { convertMetafileBufferToPng } from "./wmfHelper";

/**
 * Deep Word (.docx) Parser & Media Extractor:
 * - Reads all embedded images from `word/media/`
 * - Converts Office Math Markup Language (OMML: <m:oMath>, <m:f>, <m:rad>, <m:acc>, <m:sSup>, <m:sSub>, etc.) into LaTeX ($...$)
 * - Converts Word Symbol fonts (<w:sym>) into standard math symbols (\in, \Delta, \le, \ge, etc.)
 * - Preserves images in their exact paragraph, table, or question locations
 * - Converts table cells containing options or statements into clean, parseable text
 */

export interface DeepDocxExtractResult {
  markdown: string;
  imageMap: Record<string, string>;
  imageCount: number;
}

// Map Word Symbol font characters (hex code from w:char) to LaTeX or Unicode
const SYMBOL_FONT_MAP: Record<string, string> = {
  "F0CE": "\\in",
  "F0CF": "\\notin",
  "F0CC": "\\subset",
  "F0CD": "\\subseteq",
  "F0CB": "\\supset",
  "F0C8": "\\cap",
  "F0C7": "\\cup",
  "F0C6": "\\emptyset",
  "F0A3": "\\le",
  "F0B3": "\\ge",
  "F0B9": "\\ne",
  "F0B1": "\\pm",
  "F0B2": "\\mp",
  "F0A5": "\\infty",
  "F0AE": "\\rightarrow",
  "F0AC": "\\leftarrow",
  "F0DE": "\\Rightarrow",
  "F0DC": "\\Leftarrow",
  "F0DB": "\\Leftrightarrow",
  "F0D8": "\\times",
  "F0B8": "\\div",
  "F0D6": "\\sqrt",
  "F0F2": "\\int",
  "F0E5": "\\sum",
  "F0D5": "\\prod",
  "F044": "\\Delta",
  "F061": "\\alpha",
  "F062": "\\beta",
  "F067": "\\gamma",
  "F064": "\\delta",
  "F065": "\\varepsilon",
  "F071": "\\theta",
  "F06C": "\\lambda",
  "F06D": "\\mu",
  "F070": "\\pi",
  "F050": "\\Pi",
  "F072": "\\rho",
  "F073": "\\sigma",
  "F074": "\\tau",
  "F076": "\\phi",
  "F077": "\\omega",
  "F057": "\\Omega",
  "F0B0": "^{\\circ}", // Degree symbol
  "00B0": "^{\\circ}",
  "00D7": "\\times",
  "00F7": "\\div",
  "221E": "\\infty",
  "2208": "\\in",
  "2209": "\\notin",
  "2264": "\\le",
  "2265": "\\ge",
  "2260": "\\ne",
  "2229": "\\cap",
  "222A": "\\cup",
  "2192": "\\rightarrow",
  "21D2": "\\Rightarrow",
  "21D4": "\\Leftrightarrow",
};

/**
 * Helper to get clean tag name without XML namespace prefix
 */
function getNodeTag(node: Element): string {
  return (node.localName || node.nodeName || "").replace(/^[a-zA-Z0-9_-]+:/, "").toLowerCase();
}

/**
 * Find direct child element with specific tag name (ignoring namespace)
 */
function findChildByTag(node: Element, tagName: string): Element | null {
  const target = tagName.toLowerCase();
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    if (getNodeTag(child) === target) {
      return child;
    }
  }
  return null;
}

/**
 * Convert OMML (Office Math Markup Language) XML node to LaTeX
 */
function ommlNodeToLatex(node: Element): string {
  const tag = getNodeTag(node);

  // Text run inside math
  if (tag === "t") {
    return node.textContent || "";
  }

  // Fraction: <m:f> <m:num>...</m:num> <m:den>...</m:den> </m:f>
  if (tag === "f") {
    const num = findChildByTag(node, "num");
    const den = findChildByTag(node, "den");
    const numStr = num ? ommlChildrenToLatex(num).trim() : "";
    const denStr = den ? ommlChildrenToLatex(den).trim() : "";
    return `\\frac{${numStr || "1"}}{${denStr || "1"}}`;
  }

  // Radical / Square root: <m:rad> <m:deg>...</m:deg> <m:e>...</m:e> </m:rad>
  if (tag === "rad") {
    const deg = findChildByTag(node, "deg");
    const e = findChildByTag(node, "e");
    const degStr = deg ? ommlChildrenToLatex(deg).trim() : "";
    const eStr = e ? ommlChildrenToLatex(e).trim() : "";
    if (degStr && degStr !== "2") {
      return `\\sqrt[${degStr}]{${eStr}}`;
    }
    return `\\sqrt{${eStr}}`;
  }

  // Superscript: <m:sSup> <m:e>...</m:e> <m:sup>...</m:sup> </m:sSup>
  if (tag === "ssup") {
    const e = findChildByTag(node, "e");
    const sup = findChildByTag(node, "sup");
    const eStr = e ? ommlChildrenToLatex(e).trim() : "";
    const supStr = sup ? ommlChildrenToLatex(sup).trim() : "";
    return `{${eStr}}^{${supStr}}`;
  }

  // Subscript: <m:sSub> <m:e>...</m:e> <m:sub>...</m:sub> </m:sSub>
  if (tag === "ssub") {
    const e = findChildByTag(node, "e");
    const sub = findChildByTag(node, "sub");
    const eStr = e ? ommlChildrenToLatex(e).trim() : "";
    const subStr = sub ? ommlChildrenToLatex(sub).trim() : "";
    return `{${eStr}}_{${subStr}}`;
  }

  // Sub-Superscript: <m:sSubSup> <m:e>... <m:sub>... <m:sup>...
  if (tag === "ssubsup") {
    const e = findChildByTag(node, "e");
    const sub = findChildByTag(node, "sub");
    const sup = findChildByTag(node, "sup");
    const eStr = e ? ommlChildrenToLatex(e).trim() : "";
    const subStr = sub ? ommlChildrenToLatex(sub).trim() : "";
    const supStr = sup ? ommlChildrenToLatex(sup).trim() : "";
    return `{${eStr}}_{${subStr}}^{${supStr}}`;
  }

  // Pre-sub-superscript: <m:sPre>
  if (tag === "spre") {
    const e = findChildByTag(node, "e");
    const sub = findChildByTag(node, "sub");
    const sup = findChildByTag(node, "sup");
    const eStr = e ? ommlChildrenToLatex(e).trim() : "";
    const subStr = sub ? ommlChildrenToLatex(sub).trim() : "";
    const supStr = sup ? ommlChildrenToLatex(sup).trim() : "";
    return `{}_{${subStr}}^{${supStr}}{${eStr}}`;
  }

  // Accent / Vector / Hat / Bar: <m:acc> <m:accPr><m:chr m:val="⃗"/></m:accPr> <m:e>...</m:e>
  if (tag === "acc") {
    const accPr = findChildByTag(node, "accPr");
    const chrEl = accPr ? findChildByTag(accPr, "chr") : null;
    const chrVal = chrEl?.getAttribute("m:val") || chrEl?.getAttribute("w:val") || chrEl?.getAttribute("val") || "⃗";
    const e = findChildByTag(node, "e");
    const eStr = e ? ommlChildrenToLatex(e).trim() : "";

    if (chrVal === "⃗" || chrVal === "→" || chrVal.charCodeAt(0) === 8407 || chrVal.charCodeAt(0) === 8594) {
      if (eStr.length > 1 && /^[A-Z]{2,3}$/.test(eStr)) {
        return `\\overrightarrow{${eStr}}`;
      }
      return `\\vec{${eStr}}`;
    }
    if (chrVal === "̂" || chrVal === "^") return `\\hat{${eStr}}`;
    if (chrVal === "̄" || chrVal === "_" || chrVal === "-") return `\\bar{${eStr}}`;
    if (chrVal === "̃" || chrVal === "~") return `\\tilde{${eStr}}`;
    if (chrVal === "̇" || chrVal === ".") return `\\dot{${eStr}}`;
    if (chrVal === "̈") return `\\ddot{${eStr}}`;
    return `\\vec{${eStr}}`;
  }

  // Bar: <m:bar> <m:e>
  if (tag === "bar") {
    const barPr = findChildByTag(node, "barPr");
    const posEl = barPr ? findChildByTag(barPr, "pos") : null;
    const pos = posEl?.getAttribute("m:val") || posEl?.getAttribute("w:val") || "top";
    const e = findChildByTag(node, "e");
    const eStr = e ? ommlChildrenToLatex(e).trim() : "";
    return pos === "bot" ? `\\underline{${eStr}}` : `\\overline{${eStr}}`;
  }

  // Group Character: <m:groupChr> <m:e>
  if (tag === "groupchr") {
    const groupChrPr = findChildByTag(node, "groupChrPr");
    const chrEl = groupChrPr ? findChildByTag(groupChrPr, "chr") : null;
    const posEl = groupChrPr ? findChildByTag(groupChrPr, "pos") : null;
    const chrVal = chrEl?.getAttribute("m:val") || "⏞";
    const pos = posEl?.getAttribute("m:val") || "top";
    const e = findChildByTag(node, "e");
    const eStr = e ? ommlChildrenToLatex(e).trim() : "";
    if (chrVal === "→" || chrVal === "⃗") return `\\overrightarrow{${eStr}}`;
    if (chrVal === "⏞" || pos === "top") return `\\overbrace{${eStr}}`;
    return `\\underbrace{${eStr}}`;
  }

  // N-Ary operator (Integrals, Summations, Products): <m:nary>
  if (tag === "nary") {
    const naryPr = findChildByTag(node, "naryPr");
    const chrEl = naryPr ? findChildByTag(naryPr, "chr") : null;
    const opChar = chrEl?.getAttribute("m:val") || chrEl?.getAttribute("w:val") || "∫";

    let opLatex = "\\int";
    if (opChar === "∑" || opChar.toLowerCase() === "sum") opLatex = "\\sum";
    else if (opChar === "∏" || opChar.toLowerCase() === "prod") opLatex = "\\prod";
    else if (opChar === "∬") opLatex = "\\iint";
    else if (opChar === "∭") opLatex = "\\iiint";
    else if (opChar === "∮") opLatex = "\\oint";

    const sub = findChildByTag(node, "sub");
    const sup = findChildByTag(node, "sup");
    const e = findChildByTag(node, "e");

    const subStr = sub ? ommlChildrenToLatex(sub).trim() : "";
    const supStr = sup ? ommlChildrenToLatex(sup).trim() : "";
    const eStr = e ? ommlChildrenToLatex(e).trim() : "";

    let res = opLatex;
    if (subStr) res += `_{${subStr}}`;
    if (supStr) res += `^{${supStr}}`;
    return `${res} ${eStr}`;
  }

  // Delimiter (Parentheses, Brackets, Bars): <m:d>
  if (tag === "d") {
    const dPr = findChildByTag(node, "dPr");
    const begEl = dPr ? findChildByTag(dPr, "begChr") : null;
    const endEl = dPr ? findChildByTag(dPr, "endChr") : null;
    const sepEl = dPr ? findChildByTag(dPr, "sepChr") : null;

    const begChr = begEl?.getAttribute("m:val") || begEl?.getAttribute("w:val") || "(";
    const endChr = endEl?.getAttribute("m:val") || endEl?.getAttribute("w:val") || ")";
    const sepChr = sepEl?.getAttribute("m:val") || sepEl?.getAttribute("w:val") || "|";

    // Delimiters can have multiple <m:e> elements separated by sepChr
    const eChildren = Array.from(node.children).filter((c) => getNodeTag(c) === "e");
    const eStrs = eChildren.map((e) => ommlChildrenToLatex(e).trim());
    const innerContent = eStrs.join(` ${sepChr} `);

    if (begChr === "{" || begChr === "\\{") return `\\left\\{ ${innerContent} \\right\\}`;
    if (begChr === "[" && endChr === "]") return `\\left[ ${innerContent} \\right]`;
    if (begChr === "(" && endChr === ")") return `\\left( ${innerContent} \\right)`;
    if (begChr === "|" && endChr === "|") return `\\left| ${innerContent} \\right|`;

    return `${begChr}${innerContent}${endChr}`;
  }

  // Mathematical Function (sin, cos, tan, log, ln, lim): <m:func>
  if (tag === "func") {
    const fName = findChildByTag(node, "fName");
    const e = findChildByTag(node, "e");
    const nameStr = fName ? ommlChildrenToLatex(fName).trim() : "";
    const eStr = e ? ommlChildrenToLatex(e).trim() : "";

    const standardFuncs = ["sin", "cos", "tan", "cot", "ln", "log", "exp", "lim", "max", "min", "arcsin", "arccos", "arctan"];
    if (standardFuncs.includes(nameStr.toLowerCase())) {
      return `\\${nameStr.toLowerCase()}(${eStr})`;
    }
    return `${nameStr}(${eStr})`;
  }

  // Limit Lower / Limit Upper: <m:limLow>, <m:limUpp>
  if (tag === "limlow" || tag === "limupp") {
    const e = findChildByTag(node, "e");
    const lim = findChildByTag(node, "lim");
    const eStr = e ? ommlChildrenToLatex(e).trim() : "";
    const limStr = lim ? ommlChildrenToLatex(lim).trim() : "";
    return `\\lim_{${limStr}} ${eStr}`;
  }

  // Equation Array / System of Equations: <m:eqArr>
  if (tag === "eqarr") {
    const eChildren = Array.from(node.children).filter((c) => getNodeTag(c) === "e");
    const equations = eChildren.map((e) => ommlChildrenToLatex(e).trim()).filter(Boolean);
    if (equations.length > 0) {
      return `\\begin{cases} ${equations.join(" \\\\ ")} \\end{cases}`;
    }
    return "";
  }

  // Matrix: <m:m> or <m:matrix>
  if (tag === "m" || tag === "matrix") {
    const rows = Array.from(node.children).filter((c) => getNodeTag(c) === "mr");
    const matrixData = rows.map((r) => {
      const eChildren = Array.from(r.children).filter((c) => getNodeTag(c) === "e");
      return eChildren.map((e) => ommlChildrenToLatex(e).trim()).join(" & ");
    });
    if (matrixData.length > 0) {
      return `\\begin{pmatrix} ${matrixData.join(" \\\\ ")} \\end{pmatrix}`;
    }
    return "";
  }

  // Box / BorderBox: <m:box>, <m:borderBox>
  if (tag === "box" || tag === "borderbox") {
    const e = findChildByTag(node, "e");
    const eStr = e ? ommlChildrenToLatex(e).trim() : "";
    return `\\boxed{${eStr}}`;
  }

  // Default: process all children
  return ommlChildrenToLatex(node);
}

function ommlChildrenToLatex(element: Element): string {
  let result = "";
  for (let i = 0; i < element.childNodes.length; i++) {
    const child = element.childNodes[i];
    if (child.nodeType === Node.ELEMENT_NODE) {
      result += ommlNodeToLatex(child as Element);
    } else if (child.nodeType === Node.TEXT_NODE) {
      result += child.textContent || "";
    }
  }
  return result;
}

/**
 * Deep recursive search for any image embed relationship ID inside drawing / pict / object / imagedata nodes
 */
function findImageEmbedId(element: Element): string | null {
  const tag = getNodeTag(element);

  // Check attributes directly on this node
  if (tag === "blip" || tag === "imagedata" || tag === "shape" || tag === "object" || tag === "graphicdata") {
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      const attrName = (attr.localName || attr.nodeName || "").toLowerCase();
      if (attrName === "embed" || attrName === "id" || attrName === "link" || attrName === "href" || attrName === "relid" || attrName === "rid") {
        if (attr.value && attr.value.startsWith("rId")) {
          return attr.value;
        }
      }
    }
  }

  // Check attributes of all tags
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    if (attr.value && typeof attr.value === "string" && attr.value.startsWith("rId")) {
      return attr.value;
    }
  }

  // Recurse into child elements
  for (let i = 0; i < element.children.length; i++) {
    const found = findImageEmbedId(element.children[i]);
    if (found) return found;
  }

  return null;
}

/**
 * Extracts all media files and document structure directly from a .docx ArrayBuffer
 */
export async function extractDocxDeep(
  arrayBuffer: ArrayBuffer,
  existingImageMap?: Record<string, string>
): Promise<DeepDocxExtractResult> {
  const imageMap: Record<string, string> = { ...(existingImageMap || {}) };
  let imageCount = Object.keys(imageMap).length;

  try {
    const zip = await JSZip.loadAsync(arrayBuffer);

    // 1. Map relationships: rId -> target media path
    const relsMap: Record<string, string> = {};
    const relsFile = zip.file("word/_rels/document.xml.rels");
    if (relsFile) {
      const relsXml = await relsFile.async("text");
      const parser = new DOMParser();
      const relsDoc = parser.parseFromString(relsXml, "text/xml");
      const relElements = Array.from(relsDoc.getElementsByTagName("Relationship"));
      relElements.forEach((rel) => {
        const id = rel.getAttribute("Id");
        const target = rel.getAttribute("Target");
        if (id && target) {
          // Normalize paths e.g. "media/image1.png", "../media/image1.png" -> "word/media/image1.png"
          let normalized = target.replace(/^\.\.\//, "").replace(/^\//, "");
          if (!normalized.toLowerCase().startsWith("word/")) {
            normalized = `word/${normalized}`;
          }
          relsMap[id] = normalized;
        }
      });
    }

    // 2. Pre-extract all media files from zip to base64 (with WMF -> PNG canvas conversion)
    const mediaBase64Map: Record<string, string> = {};
    const mediaFiles = Object.keys(zip.files).filter((p) => p.toLowerCase().includes("media/"));

    for (const path of mediaFiles) {
      const file = zip.file(path);
      if (file) {
        const ext = path.split(".").pop()?.toLowerCase() || "png";
        let dataUri: string | null = null;

        // If WMF/EMF, attempt high-resolution Canvas conversion to PNG
        if (ext === "wmf" || ext === "emf") {
          try {
            const rawBytes = await file.async("uint8array");
            dataUri = await convertMetafileBufferToPng(rawBytes);
          } catch (e) {
            console.warn("WMF conversion warning for:", path, e);
          }
        }

        if (!dataUri) {
          let mime = "image/png";
          if (ext === "jpg" || ext === "jpeg") mime = "image/jpeg";
          else if (ext === "webp") mime = "image/webp";
          else if (ext === "gif") mime = "image/gif";
          else if (ext === "svg") mime = "image/svg+xml";
          else if (ext === "bmp") mime = "image/bmp";
          else if (ext === "wmf") mime = "image/wmf";
          else if (ext === "emf") mime = "image/emf";

          const base64Data = await file.async("base64");
          dataUri = `data:${mime};base64,${base64Data}`;
        }

        mediaBase64Map[path] = dataUri;
        // Also map lowercase path and relative path
        mediaBase64Map[path.toLowerCase()] = dataUri;
        const shortPath = path.replace(/^word\//i, "");
        mediaBase64Map[shortPath] = dataUri;
        mediaBase64Map[shortPath.toLowerCase()] = dataUri;
      }
    }

    // 3. Parse word/document.xml
    const docFile = zip.file("word/document.xml");
    if (!docFile) {
      return { markdown: "", imageMap, imageCount };
    }

    const docXml = await docFile.async("text");
    const parser = new DOMParser();
    const doc = parser.parseFromString(docXml, "text/xml");

    const body = doc.getElementsByTagName("w:body")[0] || doc.getElementsByTagName("body")[0];
    if (!body) {
      return { markdown: "", imageMap, imageCount };
    }

    function processDocxElement(el: Element): string {
      const tag = getNodeTag(el);

      // OMML Math block (<m:oMathPara> or <m:oMath>)
      if (tag === "omathpara" || tag === "omath") {
        const latex = ommlNodeToLatex(el).trim();
        if (latex) {
          // Normalize double spaces inside math
          const cleanLatex = latex.replace(/\s{2,}/g, " ");
          return ` $${cleanLatex}$ `;
        }
        return "";
      }

      // Drawing / Image / Shape / Object elements
      if (
        tag === "drawing" ||
        tag === "pict" ||
        tag === "object" ||
        tag === "shape" ||
        tag === "imagedata" ||
        tag === "alternatecontent"
      ) {
        const rId = findImageEmbedId(el);
        if (rId && relsMap[rId]) {
          const targetPath = relsMap[rId];
          const base64 =
            mediaBase64Map[targetPath] ||
            mediaBase64Map[targetPath.toLowerCase()] ||
            mediaBase64Map[targetPath.replace(/^word\//i, "")];

          if (base64) {
            const token = `__IMG_TOKEN_${imageCount}__`;
            imageMap[token] = base64;
            imageCount++;
            return ` ![Hình vẽ ${imageCount}](${token}) `;
          }
        }
        return "";
      }

      // Symbol run: <w:sym w:font="Symbol" w:char="F0CE"/>
      if (tag === "sym") {
        const charCode = (el.getAttribute("w:char") || el.getAttribute("char") || "").toUpperCase();
        if (charCode && SYMBOL_FONT_MAP[charCode]) {
          return ` $${SYMBOL_FONT_MAP[charCode]}$ `;
        }
        return "";
      }

      // Run element <w:r>
      if (tag === "r") {
        const isBold = Boolean(findChildByTag(el, "b") || el.getElementsByTagName("w:b").length > 0);
        const isItalic = Boolean(findChildByTag(el, "i") || el.getElementsByTagName("w:i").length > 0);
        const vertAlignEl = findChildByTag(el, "vertAlign") || el.getElementsByTagName("w:vertAlign")[0];
        const vertAlign = vertAlignEl?.getAttribute("w:val") || vertAlignEl?.getAttribute("val");

        let text = "";
        for (let i = 0; i < el.childNodes.length; i++) {
          const child = el.childNodes[i];
          if (child.nodeType === Node.ELEMENT_NODE) {
            const childEl = child as Element;
            const cTag = getNodeTag(childEl);
            if (cTag === "t") {
              text += childEl.textContent || "";
            } else if (cTag === "br") {
              text += "\n";
            } else if (cTag === "sym") {
              text += processDocxElement(childEl);
            } else if (
              cTag === "drawing" ||
              cTag === "pict" ||
              cTag === "object" ||
              cTag === "omath" ||
              cTag === "omathpara"
            ) {
              text += processDocxElement(childEl);
            }
          }
        }

        if (!text) return "";

        // Handle superscripts and subscripts
        if (vertAlign === "superscript") {
          return text.length === 1 ? `^${text}` : `^{${text}}`;
        }
        if (vertAlign === "subscript") {
          return text.length === 1 ? `_${text}` : `_{${text}}`;
        }
        if (isBold && isItalic) return `***${text}***`;
        if (isBold) return `**${text}**`;
        if (isItalic) return `*${text}*`;

        return text;
      }

      // Paragraph element <w:p>
      if (tag === "p") {
        let pText = "";
        for (let i = 0; i < el.childNodes.length; i++) {
          const child = el.childNodes[i];
          if (child.nodeType === Node.ELEMENT_NODE) {
            pText += processDocxElement(child as Element);
          }
        }
        const cleaned = pText.replace(/\u00A0/g, " ").trim();
        return cleaned ? `\n${cleaned}\n` : "\n";
      }

      // Table element <w:tbl>
      if (tag === "tbl") {
        const rows: string[][] = [];
        const trElements = Array.from(el.getElementsByTagName("w:tr"));
        const actualTrs = trElements.length > 0 ? trElements : Array.from(el.children).filter((c) => getNodeTag(c) === "tr");

        actualTrs.forEach((tr) => {
          const tcElements = Array.from(tr.getElementsByTagName("w:tc"));
          const actualTcs = tcElements.length > 0 ? tcElements : Array.from(tr.children).filter((c) => getNodeTag(c) === "tc");

          const rowData = actualTcs.map((cell) => {
            let cellText = "";
            for (let i = 0; i < cell.childNodes.length; i++) {
              const child = cell.childNodes[i];
              if (child.nodeType === Node.ELEMENT_NODE) {
                cellText += processDocxElement(child as Element);
              }
            }
            return cellText.replace(/\u00A0/g, " ").replace(/[\r\n\t]+/g, " ").trim();
          });

          if (rowData.length > 0 && rowData.some((c) => c.length > 0)) {
            rows.push(rowData);
          }
        });

        if (rows.length === 0) return "";

        // Check if this table is an option table (e.g. cells like A. ..., B. ..., C. ..., D. ...)
        const flatCells = rows.flat().filter(Boolean);
        const hasOptionsInTable = flatCells.some((c) => /^\*{0,2}(?:\[?[A-D]\]?|\([A-D]\))[.)/:]/i.test(c.trim()));
        const hasStatementsInTable = flatCells.some((c) => /^\*{0,2}(?:(?:Ý|Mệnh đề|Khẳng định|Câu)\s*)?(?:\[?[a-d]\]?|\([a-d]\)|[a-d])[.)/:]/i.test(c.trim()) || /^\([a-d]\)\s+/i.test(c.trim()));

        if (hasOptionsInTable || hasStatementsInTable) {
          // Output each cell on a new line so options/statements are cleanly parsed
          return "\n" + flatCells.join("\n") + "\n";
        }

        const maxCols = Math.max(...rows.map((r) => r.length));
        if (maxCols === 0) return "";

        const normalizedRows = rows.map((row) => {
          const copy = [...row];
          while (copy.length < maxCols) copy.push("");
          return copy;
        });

        const headerRow = normalizedRows[0];
        const dataRows = normalizedRows.slice(1);

        let tableMd = "\n\n| " + headerRow.map((c) => c || "-").join(" | ") + " |\n";
        tableMd += "| " + Array(maxCols).fill(":---").join(" | ") + " |\n";
        dataRows.forEach((row) => {
          tableMd += "| " + row.map((c) => c || "").join(" | ") + " |\n";
        });
        return tableMd + "\n";
      }

      // Generic node iteration
      let innerText = "";
      for (let i = 0; i < el.childNodes.length; i++) {
        const child = el.childNodes[i];
        if (child.nodeType === Node.ELEMENT_NODE) {
          innerText += processDocxElement(child as Element);
        } else if (child.nodeType === Node.TEXT_NODE) {
          innerText += child.textContent || "";
        }
      }
      return innerText;
    }

    const fullMarkdown = processDocxElement(body as Element)
      .replace(/\u00A0/g, " ")
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return {
      markdown: fullMarkdown,
      imageMap,
      imageCount,
    };
  } catch (err) {
    console.error("Deep docx extraction error:", err);
    return { markdown: "", imageMap, imageCount };
  }
}
