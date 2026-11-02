import { Question, ExamConfig } from "../types";

/**
 * Clean text for GIFT format (escapes special characters ~, =, #, {, }, :, \)
 */
function escapeGIFT(text: string): string {
  if (!text) return "";
  return text
    .replace(/\\/g, "\\\\")
    .replace(/~/g, "\\~")
    .replace(/=/g, "\\=")
    .replace(/#/g, "\\#")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/:/g, "\\:");
}

/**
 * Clean text for XML (escapes &, <, >, ", ') or wraps in CDATA
 */
function escapeXML(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapCDATA(text: string): string {
  if (!text) return "<![CDATA[]]>";

  // Process Markdown tables into clean HTML tables for Moodle/LMS
  const lines = text.split("\n");
  const outLines: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  const buildHtmlTable = (rows: string[][]) => {
    if (!rows || rows.length === 0) return "";
    const header = rows[0];
    const body = rows.slice(1);
    let html = `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; margin:10px auto; width:95%; max-width:600px; text-align:center;">`;
    if (header && header.length > 0) {
      html += `<thead style="background:#f1f5f9; font-weight:bold;"><tr>`;
      header.forEach((c) => { html += `<th>${c}</th>`; });
      html += `</tr></thead>`;
    }
    html += `<tbody>`;
    body.forEach((r, idx) => {
      html += `<tr style="background:${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">`;
      r.forEach((c) => { html += `<td>${c}</td>`; });
      html += `</tr>`;
    });
    html += `</tbody></table>`;
    return html;
  };

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    const isPipe = (l.startsWith("|") && l.endsWith("|")) || (l.includes("|") && l.split("|").length >= 3);
    if (isPipe) {
      if (!/^\|?[\s\-:]+(\|[\s\-:]+)+\|?$/.test(l)) {
        let clean = l;
        if (clean.startsWith("|")) clean = clean.slice(1);
        if (clean.endsWith("|")) clean = clean.slice(0, -1);
        const cells = clean.split("|").map((c) => c.trim());
        if (cells.length > 0) {
          inTable = true;
          tableRows.push(cells);
          continue;
        }
      } else {
        continue;
      }
    }
    if (inTable && tableRows.length > 0) {
      outLines.push(buildHtmlTable(tableRows));
      inTable = false;
      tableRows = [];
    }
    outLines.push(lines[i]);
  }
  if (inTable && tableRows.length > 0) {
    outLines.push(buildHtmlTable(tableRows));
  }

  const formattedHtml = `<p>${outLines.join("<br/>")}</p>`;
  return `<![CDATA[${formattedHtml}]]>`;
}

/**
 * Generate Moodle XML Format from list of questions
 * Compatible with Moodle 3.x, 4.x, Canvas, and standard LMS
 */
export function generateMoodleXML(questions: Question[], config?: ExamConfig): string {
  const categoryName = config?.subject || "EduTest Exam";
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
  <!-- Category Info -->
  <question type="category">
    <category>
      <text>$course$/${escapeXML(categoryName)}</text>
    </category>
  </question>
`;

  questions.forEach((q, idx) => {
    const qNum = idx + 1;
    const qName = `Câu ${qNum}: ${q.chapter || "Chương chung"}`;
    const part = q.part || 1;

    if (part === 1 || q.questionType === "multiple_choice") {
      // Part 1: Multiple Choice
      const options = q.options && q.options.length > 0 ? q.options : ["A", "B", "C", "D"];
      const correctIdx = typeof q.correctIndex === "number" ? q.correctIndex : 0;

      xml += `
  <question type="multichoice">
    <name>
      <text>${escapeXML(qName)}</text>
    </name>
    <questiontext format="html">
      <text>${wrapCDATA(q.content)}</text>
    </questiontext>
    <generalfeedback format="html">
      <text>${wrapCDATA(q.explanation || "Giải thích đáp án")}</text>
    </generalfeedback>
    <defaultgrade>1.0</defaultgrade>
    <penalty>0.3333333</penalty>
    <hidden>0</hidden>
    <single>true</single>
    <shuffleanswers>true</shuffleanswers>
    <answernumbering>abc</answernumbering>
`;

      options.forEach((opt, optIdx) => {
        const isCorrect = optIdx === correctIdx;
        const fraction = isCorrect ? "100" : "0";
        xml += `    <answer fraction="${fraction}" format="html">
      <text>${wrapCDATA(opt)}</text>
      <feedback format="html">
        <text>${wrapCDATA(isCorrect ? "Chính xác!" : "Chưa chính xác")}</text>
      </feedback>
    </answer>
`;
      });

      xml += `  </question>
`;
    } else if (part === 2 || q.questionType === "true_false") {
      // Part 2: True/False Sub-statements (Moodle Matching or Multichoice Multi-select)
      const statements = q.statements || [];
      xml += `
  <question type="matching">
    <name>
      <text>${escapeXML(qName + " (Đúng/Sai)")}</text>
    </name>
    <questiontext format="html">
      <text>${wrapCDATA(`${q.content}<br/><b>Đánh giá tính Đúng/Sai của từng mệnh đề sau:</b>`)}</text>
    </questiontext>
    <generalfeedback format="html">
      <text>${wrapCDATA(q.explanation || "Đáp án chuẩn Bộ GD&ĐT")}</text>
    </generalfeedback>
    <defaultgrade>1.0</defaultgrade>
    <penalty>0.25</penalty>
    <hidden>0</hidden>
    <shuffleanswers>false</shuffleanswers>
`;

      statements.forEach((st) => {
        const correctStr = st.correctValue ? "Đúng" : "Sai";
        xml += `    <subquestion format="html">
      <text>${wrapCDATA(`${st.label || st.id}) ${st.text}`)}</text>
      <answer>
        <text>${correctStr}</text>
      </answer>
    </subquestion>
`;
      });

      xml += `  </question>
`;
    } else {
      // Part 3: Short Answer (Điền số / Trả lời ngắn)
      const correctAns = q.shortAnswer || "0";
      const acceptable = [correctAns, ...(q.acceptableAnswers || [])];

      xml += `
  <question type="shortanswer">
    <name>
      <text>${escapeXML(qName + " (Trả lời ngắn)")}</text>
    </name>
    <questiontext format="html">
      <text>${wrapCDATA(q.content)}</text>
    </questiontext>
    <generalfeedback format="html">
      <text>${wrapCDATA(q.explanation || `Đáp án đúng là: ${correctAns}`)}</text>
    </generalfeedback>
    <defaultgrade>0.5</defaultgrade>
    <penalty>0.0</penalty>
    <hidden>0</hidden>
    <usecase>0</usecase>
`;

      acceptable.forEach((ans) => {
        if (ans && ans.trim()) {
          xml += `    <answer fraction="100" format="moodle_auto_format">
      <text>${escapeXML(ans.trim())}</text>
      <feedback format="html">
        <text>${wrapCDATA("Chính xác!")}</text>
      </feedback>
    </answer>
`;
        }
      });

      xml += `  </question>
`;
    }
  });

  xml += `</quiz>`;
  return xml;
}

/**
 * Generate GIFT Format from list of questions
 * Extremely lightweight and universally accepted by Moodle, Canvas, Blackboard, Kahoot
 */
export function generateGIFT(questions: Question[], config?: ExamConfig): string {
  let gift = `// ========================================================\n`;
  gift += `// Đề thi xuất bởi EduTest Pro (Chuẩn BGD GDPT 2018)\n`;
  gift += `// Môn: ${config?.subject || "Tổng hợp"} - ${config?.examPeriod || ""}\n`;
  gift += `// Tác giả: Cô Lê Thị Thái (GV Môn Địa Lý, THPT Bình Phú - Bình Dương)\n`;
  gift += `// ========================================================\n\n`;

  questions.forEach((q, idx) => {
    const qNum = idx + 1;
    const title = `Câu_${qNum}_${(q.chapter || "Chương").replace(/\s+/g, "_")}`;
    const part = q.part || 1;

    if (part === 1 || q.questionType === "multiple_choice") {
      const options = q.options || ["A", "B", "C", "D"];
      const correctIdx = typeof q.correctIndex === "number" ? q.correctIndex : 0;

      gift += `::${title}::[html]${q.content.replace(/\n/g, "<br/>")} {\n`;
      options.forEach((opt, oIdx) => {
        const isCorrect = oIdx === correctIdx;
        const prefix = isCorrect ? "=" : "~";
        const feedback = isCorrect ? "#Chính xác!" : "#Sai";
        gift += `  ${prefix}${escapeGIFT(opt)} ${feedback}\n`;
      });
      gift += `}\n\n`;
    } else if (part === 2 || q.questionType === "true_false") {
      const stmts = q.statements || [];
      gift += `::${title}_Dung_Sai::[html]${q.content.replace(/\n/g, "<br/>")}<br/><b>Chọn Đúng hoặc Sai cho từng ý:</b> {\n`;
      stmts.forEach((st) => {
        const isCor = st.correctValue ? "Đúng" : "Sai";
        gift += `  =${escapeGIFT(st.label || st.id + ") " + st.text)} -> ${isCor}\n`;
      });
      gift += `}\n\n`;
    } else {
      const ans = q.shortAnswer || "0";
      gift += `::${title}_Tra_Loi_Ngan::[html]${q.content.replace(/\n/g, "<br/>")} {=${escapeGIFT(ans)}}\n\n`;
    }
  });

  return gift;
}

/**
 * Trigger file download helper
 */
export function downloadFile(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportToMoodleXMLFile(questions: Question[], config?: ExamConfig, examCode: string = "101") {
  const xml = generateMoodleXML(questions, config);
  const subjectSlug = (config?.subject || "de_thi").toLowerCase().replace(/[^a-z0-9]/g, "_");
  const fileName = `Moodle_XML_${subjectSlug}_ma_${examCode}.xml`;
  downloadFile(xml, fileName, "application/xml");
}

export function exportToGIFTFile(questions: Question[], config?: ExamConfig, examCode: string = "101") {
  const gift = generateGIFT(questions, config);
  const subjectSlug = (config?.subject || "de_thi").toLowerCase().replace(/[^a-z0-9]/g, "_");
  const fileName = `GIFT_LMS_${subjectSlug}_ma_${examCode}.gift.txt`;
  downloadFile(gift, fileName, "text/plain");
}
