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
  // If text contains LaTeX or Markdown, format as HTML with MathJax
  const formattedHtml = `<p>${text.replace(/\n/g, "<br/>")}</p>`;
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
