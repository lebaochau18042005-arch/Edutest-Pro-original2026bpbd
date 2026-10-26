import { Question, ExamConfig } from "../types";
import { downloadFile } from "./moodleGiftExporter";

/**
 * Generate a standalone, beautifully styled HTML5 Slides Presentation
 * that opens immediately in fullscreen in any browser (Chrome, Edge, Safari)
 * with KaTeX math rendering, slide transitions, keyboard controls (Left/Right/Space/Enter/F),
 * interactive option selection, and an interactive "Hiện Đáp Án & Lời Giải" toggle button.
 */
export function generatePresentationHTML(questions: Question[], config?: ExamConfig, examCode: string = "101"): string {
  const school = config?.school || "TRƯỜNG THPT BÌNH PHÚ";
  const period = config?.examPeriod || "BÀI GIẢNG CHỮA ĐỀ THI TRẮC NGHIỆM";
  const subject = config?.subject || "ĐỊA LÝ & KHOA HỌC TỔNG HỢP";
  const grade = config?.grade || "Khối 12";

  // Sanitize and serialize 100% of questions safely without breaking HTML script tags
  const rawSlides = (questions || []).map((q, idx) => ({
    index: idx + 1,
    part: q.part || 1,
    partQuestionIndex: (q as any).partQuestionIndex || (idx + 1),
    questionType: q.questionType,
    chapter: q.chapter || "Chương trọng tâm",
    level: q.level || "Thông hiểu",
    content: q.content || "",
    options: (q.options || []).map(opt => (typeof opt === 'string' ? opt : (typeof opt === 'object' && opt !== null ? ((opt as any).text || (opt as any).content || JSON.stringify(opt)) : String(opt ?? '')))),
    correctIndex: q.correctIndex ?? 0,
    statements: (q.statements || []).map(st => ({
      id: st.id || "",
      label: st.label || (st.id ? `${st.id})` : ""),
      text: typeof st.text === 'string' ? st.text : String(st.text ?? ""),
      correctValue: Boolean(st.correctValue),
      explanation: st.explanation || ""
    })),
    shortAnswer: q.shortAnswer || "",
    explanation: q.explanation || "Chưa có lời giải chi tiết.",
    passageContent: q.passageContent || "",
    groupTitle: q.groupTitle || "",
    diagramUrl: q.diagramUrl || "",
  }));

  const safeJsonData = JSON.stringify(rawSlides)
    .replace(/<\//g, "\\u003c/")
    .replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bài Giảng Chữa Đề Thi - ${subject} (Mã ${examCode})</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>
  <style>
    :root {
      --primary: #2563eb;
      --primary-dark: #0f172a;
      --accent: #059669;
      --gold: #d97706;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    .slide-table {
      border-collapse: collapse;
      width: 92%;
      max-width: 800px;
      margin: 14px auto;
      font-size: 15px;
      border: 1.5px solid #475569;
      background: #1e293b;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    }
    .slide-table th {
      background: #334155;
      color: #38bdf8;
      font-weight: bold;
      padding: 8px 12px;
      border: 1px solid #475569;
      text-align: center;
    }
    .slide-table td {
      padding: 8px 12px;
      border: 1px solid #334155;
      text-align: center;
      color: #f1f5f9;
    }
    .slide-table tr:nth-child(even) td {
      background: #162032;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #0b0f19;
      color: #f8fafc;
      overflow: hidden;
      height: 100vh;
      width: 100vw;
      display: flex;
      flex-direction: column;
    }
    .slide-container {
      flex: 1;
      min-height: 0;
      height: calc(100vh - 64px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px 20px;
      position: relative;
      overflow: hidden;
    }
    .slide-card {
      width: 100%;
      max-width: 1240px;
      height: 100%;
      max-height: 100%;
      background: linear-gradient(145deg, #111827, #1e293b);
      border: 1.5px solid #334155;
      border-radius: 20px;
      box-shadow: 0 20px 45px -10px rgba(0, 0, 0, 0.85);
      display: flex;
      flex-direction: column;
      padding: 24px 32px;
      position: relative;
      overflow-y: auto;
    }
    .slide-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #334155;
      padding-bottom: 12px;
      margin-bottom: 16px;
      flex-shrink: 0;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-p1 { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); }
    .badge-p2 { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); }
    .badge-p3 { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); }
    .question-title {
      font-size: 24px;
      font-weight: 800;
      color: #38bdf8;
    }
    .passage-box {
      background: rgba(30, 58, 138, 0.25);
      border: 1px solid #3b82f6;
      border-radius: 14px;
      padding: 14px 18px;
      margin-bottom: 16px;
      font-size: 16px;
      color: #cbd5e1;
      line-height: 1.5;
    }
    .question-body {
      font-size: 20px;
      line-height: 1.6;
      color: #f8fafc;
      margin-bottom: 20px;
      font-weight: 500;
    }
    .question-body img, .slide-card img {
      max-height: 280px;
      max-width: 100%;
      border-radius: 12px;
      margin: 10px auto;
      display: block;
      background: #ffffff;
      padding: 4px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .options-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
      margin-bottom: 18px;
    }
    .option-box {
      background: #1e293b;
      border: 2px solid #334155;
      border-radius: 14px;
      padding: 14px 18px;
      font-size: 18px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      transition: all 0.2s ease;
      cursor: pointer;
      user-select: none;
    }
    .option-box:hover {
      border-color: #38bdf8;
      background: #24344d;
      transform: translateY(-1px);
    }
    .option-box.selected-user {
      border-color: #818cf8 !important;
      background: rgba(99, 102, 241, 0.25) !important;
      box-shadow: 0 0 16px rgba(99, 102, 241, 0.35);
    }
    .option-box.revealed-correct {
      background: rgba(5, 150, 105, 0.35) !important;
      border-color: #10b981 !important;
      color: #a7f3d0 !important;
      font-weight: 700;
      box-shadow: 0 0 24px rgba(16, 185, 129, 0.4);
    }
    .option-box.revealed-wrong {
      background: rgba(239, 68, 68, 0.25) !important;
      border-color: #ef4444 !important;
      color: #fca5a5 !important;
    }
    .opt-letter {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: #334155;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      flex-shrink: 0;
      transition: all 0.2s;
    }
    .option-box.selected-user .opt-letter {
      background: #6366f1;
      color: #fff;
    }
    .option-box.revealed-correct .opt-letter {
      background: #10b981;
      color: #000;
    }
    .tf-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    .tf-table th, .tf-table td {
      padding: 12px 16px;
      border: 1px solid #334155;
      text-align: left;
      font-size: 17px;
    }
    .tf-table th { background: #1e293b; color: #94a3b8; }
    .tf-table tr { cursor: pointer; transition: background 0.15s; }
    .tf-table tr:hover td { background: rgba(51, 65, 85, 0.4); }
    .tf-badge-true { background: #059669; color: white; padding: 4px 12px; border-radius: 8px; font-weight: bold; }
    .tf-badge-false { background: #dc2626; color: white; padding: 4px 12px; border-radius: 8px; font-weight: bold; }
    .tf-hidden-ans { display: none; }
    .tf-revealed .tf-hidden-ans, .tf-row-revealed .tf-hidden-ans { display: inline-block; animation: fadeIn 0.3s ease-in-out; }
    .short-ans-box {
      padding: 18px 24px;
      background: #1e293b;
      border-radius: 16px;
      border: 1.5px solid #3b82f6;
      font-size: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .short-ans-value {
      color: #34d399;
      font-weight: 900;
      font-size: 26px;
      font-family: monospace;
      display: none;
    }
    .short-ans-value.visible { display: inline; animation: fadeIn 0.3s ease-in-out; }
    .explanation-panel {
      margin-top: 14px;
      background: linear-gradient(135deg, rgba(30, 58, 138, 0.35), rgba(15, 23, 42, 0.9));
      border: 1.5px solid #3b82f6;
      border-radius: 16px;
      padding: 18px 24px;
      font-size: 16px;
      color: #bfdbfe;
      display: none;
      animation: fadeIn 0.3s ease-in-out forwards;
    }
    .explanation-panel.visible { display: block; }
    
    /* Navigation Floating Arrows on Left & Right */
    .nav-arrow-btn {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: rgba(30, 41, 59, 0.85);
      border: 1.5px solid #475569;
      color: #38bdf8;
      font-size: 26px;
      font-weight: 900;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 80;
      transition: all 0.2s ease;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
      backdrop-filter: blur(8px);
      user-select: none;
    }
    .nav-arrow-btn:hover {
      background: #2563eb;
      color: #ffffff;
      border-color: #60a5fa;
      transform: translateY(-50%) scale(1.1);
    }
    .nav-arrow-btn:active {
      transform: translateY(-50%) scale(0.95);
    }
    .nav-arrow-prev { left: 10px; }
    .nav-arrow-next { right: 10px; }

    .controls-bar {
      height: 64px;
      min-height: 64px;
      flex-shrink: 0;
      background: #0f172a;
      border-top: 1px solid #1e293b;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      z-index: 100;
    }
    .btn {
      padding: 10px 18px;
      border-radius: 12px;
      border: none;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
      user-select: none;
    }
    .btn-primary { background: #2563eb; color: white; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-reveal { background: linear-gradient(135deg, #059669, #047857); color: white; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.4); }
    .btn-reveal:hover { background: #059669; transform: scale(1.03); }
    .btn-secondary { background: #334155; color: #f8fafc; }
    .btn-secondary:hover { background: #475569; }
    .nav-indicator { font-size: 14px; color: #94a3b8; font-weight: 700; font-family: monospace; }
    .author-credit { font-size: 12px; color: #64748b; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  </style>
</head>
<body>
  <!-- Embedded JSON Data Block -->
  <script type="application/json" id="exam-slides-data">${safeJsonData}</script>

  <div class="slide-container">
    <!-- Floating Arrow Buttons -->
    <button id="float-prev" class="nav-arrow-btn nav-arrow-prev" onclick="prevSlide()" title="Câu trước [Phím ←]" aria-label="Câu trước">‹</button>
    <button id="float-next" class="nav-arrow-btn nav-arrow-next" onclick="nextSlide()" title="Câu tiếp theo [Phím →]" aria-label="Câu tiếp theo">›</button>

    <!-- Cover Slide (Slide 0) -->
    <div id="slide-cover" class="slide-card" style="align-items: center; justify-content: center; text-align: center;">
      <span class="badge badge-p1" style="font-size: 14px; margin-bottom: 16px;">HỆ THỐNG KHẢO THÍ CHUẨN GDPT 2018</span>
      <h1 style="font-size: 34px; font-weight: 900; color: #f8fafc; margin-bottom: 12px; line-height: 1.25;">
        ${period}
      </h1>
      <h2 style="font-size: 24px; font-weight: 700; color: #38bdf8; margin-bottom: 16px;">
        MÔN: ${subject} • ${grade} • MÃ ĐỀ: ${examCode}
      </h2>
      <p style="font-size: 16px; color: #94a3b8; margin-bottom: 24px; max-width: 760px; line-height: 1.5;">
        ${school} • Bài giảng số hóa trình chiếu chữa đề thi trực tiếp trên lớp học. Tổng số <b>${questions.length} câu hỏi</b> chuẩn 3 phần Bộ GD&ĐT.
      </p>
      <div style="padding: 12px 22px; background: rgba(30, 41, 59, 0.85); border: 1px solid #475569; border-radius: 14px; display: inline-flex; align-items: center; gap: 12px; margin-bottom: 26px;">
        <span style="font-size: 15px; font-weight: bold; color: #f59e0b;">Tác giả: Cô Lê Thị Thái (GV Môn Địa Lý)</span>
        <span style="color: #64748b;">•</span>
        <span style="font-size: 14px; color: #94a3b8;">Zalo: 0916.791.779</span>
      </div>

      <!-- Action Buttons on Cover Slide -->
      <div style="display: flex; align-items: center; gap: 14px; justify-content: center; flex-wrap: wrap;">
        <button id="btn-start-presentation" onclick="nextSlide()" class="btn btn-primary" style="font-size: 16px; padding: 13px 30px; border-radius: 14px; box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.5); font-weight: 800; cursor: pointer;">
          <span>🚀 Bắt đầu bài giảng (Tiếp theo [→])</span>
        </button>
        <button onclick="toggleFullScreen()" class="btn btn-secondary" style="font-size: 15px; padding: 13px 22px; border-radius: 14px; cursor: pointer;">
          <span>⛶ Toàn màn hình [F]</span>
        </button>
      </div>

      <p style="margin-top: 18px; font-size: 13px; color: #64748b;">
        Điều khiển: Nhấn nút <b>Bắt đầu</b> hoặc bấm phím <b>[→]</b> / <b>[Enter]</b> / <b>[Space]</b> trên bàn phím
      </p>
    </div>

    <!-- Question Slide -->
    <div id="slide-content" class="slide-card" style="display: none;">
      <div class="slide-header">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span id="slide-badge" class="badge badge-p1">PHẦN I: TRẮC NGHIỆM</span>
          <span id="slide-chapter" style="font-size: 14px; color: #94a3b8;"></span>
        </div>
        <span id="slide-qnum" class="question-title">CÂU 1</span>
      </div>

      <div id="slide-passage" class="passage-box" style="display: none;"></div>
      <div id="slide-body" class="question-body"></div>
      <div id="slide-options-container"></div>

      <div id="slide-explanation" class="explanation-panel">
        <h4 style="font-weight: 800; color: #60a5fa; margin-bottom: 8px; font-size: 16px; display: flex; align-items: center; gap: 6px;">
          <span>💡 Lời Giải Chi Tiết & Hướng Dẫn Tư Duy:</span>
        </h4>
        <div id="slide-explanation-text"></div>
      </div>
    </div>
  </div>

  <!-- Controls Footer Bar (Always fully visible) -->
  <div class="controls-bar">
    <div style="display: flex; align-items: center; gap: 10px;">
      <button class="btn btn-secondary" onclick="prevSlide()" title="Câu trước [Phím ←]">← Trước [←]</button>
      <button class="btn btn-secondary" onclick="nextSlide()" title="Câu sau [Phím → hoặc Enter]">Tiếp theo [→] →</button>
      <span id="slide-counter" class="nav-indicator">SLIDE 0 / ${questions.length}</span>
    </div>

    <div style="display: flex; align-items: center; gap: 10px;">
      <button id="btn-toggle-answer" class="btn btn-reveal" onclick="toggleRevealAnswer()" title="Hiện / Ẩn đáp án [Phím cách hoặc A]">
        <span>✨ Hiện Đáp Án & Lời Giải [Phím cách / A]</span>
      </button>
      <button class="btn btn-secondary" onclick="toggleFullScreen()" title="Toàn màn hình [Phím F]">
        <span>⛶ Toàn màn hình [F]</span>
      </button>
    </div>

    <div class="author-credit">
      EduTest Pro • Cô Lê Thị Thái (GV Môn Địa Lý)
    </div>
  </div>

  <script>
    let questions = [];
    try {
      questions = JSON.parse(document.getElementById('exam-slides-data').textContent) || [];
    } catch (e) {
      console.error("Failed to parse slides data:", e);
      questions = [];
    }

    let currentSlide = 0; // 0 is cover, 1..N are questions
    let isRevealed = false;
    let userSelectedOption = null;

    // Helper: Convert Markdown syntax (Tables, Images, Linebreaks, Bold) to HTML safely
    function formatMarkdown(text) {
      if (text === null || text === undefined) return '';
      let res = typeof text === 'string' ? text : (typeof text === 'object' ? (text.text || text.content || JSON.stringify(text)) : String(text));

      // 1. Markdown Images: ![alt](src) -> <img src="src" alt="alt"/>
      res = res.replace(/!\\[(.*?)\\]\\(\\s*(data:image\\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=\\s\\r\\n]+|https?:\\/\\/[^\\s)]+|\\/[^\\s)]+|[^\\s)]+?)\\s*\\)/gi, (m, alt, src) => {
        const cleanSrc = src.trim().startsWith('data:image') ? src.replace(/\\s+/g, '') : src.trim();
        return '<img src="' + cleanSrc + '" alt="' + (alt || 'Hình vẽ') + '" style="max-height:260px; max-width:100%; border-radius:10px; margin:10px auto; display:block; background:#fff; padding:4px;" />';
      });

      // 2. Bold: **text**
      res = res.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');

      // 3. Process Markdown Tables: only lines genuinely formatted as markdown table rows
      const rawLines = res.split('\\n');
      const outLines = [];
      let inTable = false;
      let tableRows = [];

      const buildHtmlTable = (rows) => {
        if (!rows || rows.length === 0) return '';
        const header = rows[0];
        const body = rows.slice(1);
        let html = '<table class="slide-table">';
        if (header && header.length > 0) {
          html += '<thead><tr>';
          header.forEach(c => { html += '<th>' + c + '</th>'; });
          html += '</tr></thead>';
        }
        html += '<tbody>';
        body.forEach(r => {
          html += '<tr>';
          r.forEach(c => { html += '<td>' + c + '</td>'; });
          html += '</tr>';
        });
        html += '</tbody></table>';
        return html;
      };

      for (let i = 0; i < rawLines.length; i++) {
        const l = rawLines[i].trim();
        const isPipe = l.startsWith('|') && l.endsWith('|') && l.length > 2;
        if (isPipe) {
          if (!/^\\|?[\\s\\-:]+(\\|[\\s\\-:]+)+\\|?$/.test(l)) {
            let clean = l;
            if (clean.startsWith('|')) clean = clean.slice(1);
            if (clean.endsWith('|')) clean = clean.slice(0, -1);
            const cells = clean.split('|').map(c => c.trim());
            if (cells.length > 0) {
              inTable = true;
              tableRows.push(cells);
              continue;
            }
          } else {
            // Divider row
            continue;
          }
        }
        if (inTable && tableRows.length > 0) {
          outLines.push(buildHtmlTable(tableRows));
          inTable = false;
          tableRows = [];
        }
        outLines.push(rawLines[i]);
      }
      if (inTable && tableRows.length > 0) {
        outLines.push(buildHtmlTable(tableRows));
      }

      return outLines.join('<br>');
    }

    function selectOption(oIdx) {
      userSelectedOption = oIdx;
      const q = questions[currentSlide - 1];
      if (!q || !q.options) return;
      q.options.forEach((_, idx) => {
        const box = document.getElementById('opt-box-' + idx);
        if (box) {
          if (idx === oIdx) {
            box.classList.add('selected-user');
          } else {
            box.classList.remove('selected-user');
          }
        }
      });
    }

    function toggleStatementRow(idx) {
      const row = document.getElementById('tf-row-' + idx);
      if (row) {
        row.classList.toggle('tf-row-revealed');
      }
    }

    function renderMath() {
      if (window.renderMathInElement) {
        try {
          const target = document.getElementById('slide-content');
          if (target) {
            renderMathInElement(target, {
              delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false},
                {left: '\\\\(', right: '\\\\)', display: false},
                {left: '\\\\[', right: '\\\\]', display: true}
              ],
              throwOnError: false
            });
          }
        } catch (err) {
          console.warn("KaTeX render error:", err);
        }
      }
    }

    function renderSlide() {
      const cover = document.getElementById('slide-cover');
      const content = document.getElementById('slide-content');
      const counter = document.getElementById('slide-counter');
      const btnReveal = document.getElementById('btn-toggle-answer');
      const floatPrev = document.getElementById('float-prev');
      const floatNext = document.getElementById('float-next');

      isRevealed = false;
      userSelectedOption = null;
      counter.textContent = 'SLIDE ' + currentSlide + ' / ' + questions.length;

      if (floatPrev) floatPrev.style.display = currentSlide === 0 ? 'none' : 'flex';
      if (floatNext) floatNext.style.display = (currentSlide >= questions.length && questions.length > 0) ? 'none' : 'flex';

      if (currentSlide === 0 || questions.length === 0) {
        cover.style.display = 'flex';
        content.style.display = 'none';
        btnReveal.style.display = 'none';
        return;
      }

      cover.style.display = 'none';
      content.style.display = 'flex';
      btnReveal.style.display = 'inline-flex';

      const q = questions[currentSlide - 1];
      if (!q) return;

      document.getElementById('slide-qnum').textContent = 'CÂU ' + q.index;
      document.getElementById('slide-chapter').textContent = (q.chapter || '') + (q.level ? ' (' + q.level + ')' : '');

      // Passage (Reading Group)
      const passageBox = document.getElementById('slide-passage');
      if (q.passageContent || q.groupTitle) {
        passageBox.style.display = 'block';
        passageBox.innerHTML = (q.groupTitle ? '<strong>' + q.groupTitle + '</strong><br>' : '') + formatMarkdown(q.passageContent);
      } else {
        passageBox.style.display = 'none';
      }

      // Content Body
      let bodyHtml = formatMarkdown(q.content);
      if (q.diagramUrl && !bodyHtml.includes(q.diagramUrl)) {
        bodyHtml += '<img src="' + q.diagramUrl + '" alt="Hình vẽ minh họa"/>';
      }
      document.getElementById('slide-body').innerHTML = bodyHtml;

      // Badge
      const badge = document.getElementById('slide-badge');
      if (q.part === 2 || q.questionType === 'true_false') {
        badge.className = 'badge badge-p2';
        badge.textContent = 'PHẦN II: ĐÚNG / SAI';
      } else if (q.part === 3 || q.questionType === 'short_answer') {
        badge.className = 'badge badge-p3';
        badge.textContent = 'PHẦN III: TRẢ LỜI NGẮN';
      } else {
        badge.className = 'badge badge-p1';
        badge.textContent = 'PHẦN I: 4 LỰA CHỌN';
      }

      // Options Container
      const optContainer = document.getElementById('slide-options-container');
      optContainer.innerHTML = '';

      if (q.part === 1 || q.questionType === 'multiple_choice' || (!q.part && (q.options || []).length > 0)) {
        const grid = document.createElement('div');
        grid.className = 'options-grid';
        const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
        (q.options || []).forEach((opt, oIdx) => {
          const box = document.createElement('div');
          box.className = 'option-box';
          box.id = 'opt-box-' + oIdx;
          box.title = 'Nhấp để chọn đáp án này';
          box.onclick = () => selectOption(oIdx);
          box.innerHTML = '<span class="opt-letter">' + (letters[oIdx] || 'A') + '</span><span>' + formatMarkdown(opt) + '</span>';
          grid.appendChild(box);
        });
        optContainer.appendChild(grid);
      } else if (q.part === 2 || q.questionType === 'true_false') {
        let html = '<table id="tf-table-view" class="tf-table"><thead><tr><th style="width: 80px;">Mệnh đề</th><th>Nội dung khẳng định</th><th style="width: 140px; text-align: center;">Đáp án</th></tr></thead><tbody>';
        (q.statements || []).forEach((st, sIdx) => {
          html += '<tr id="tf-row-' + sIdx + '" onclick="toggleStatementRow(' + sIdx + ')" title="Nhấp để hiện / ẩn đáp án mệnh đề này"><td><b>' + (st.label || (st.id ? st.id + ')' : '')) + '</b></td><td>' + formatMarkdown(st.text) + '</td><td style="text-align: center;"><span class="tf-hidden-ans ' + (st.correctValue ? 'tf-badge-true' : 'tf-badge-false') + '">' + (st.correctValue ? 'ĐÚNG' : 'SAI') + '</span></td></tr>';
        });
        html += '</tbody></table>';
        optContainer.innerHTML = html;
      } else {
        optContainer.innerHTML = '<div class="short-ans-box"><b>Đáp án điền số:</b> <span id="short-ans-val" class="short-ans-value">' + (q.shortAnswer || 'Chưa có đáp án') + '</span></div>';
      }

      // Explanation
      document.getElementById('slide-explanation').className = 'explanation-panel';
      document.getElementById('slide-explanation-text').innerHTML = formatMarkdown(q.explanation);

      // Render math formulas
      renderMath();
    }

    function toggleRevealAnswer() {
      if (currentSlide === 0) return;
      isRevealed = !isRevealed;
      const q = questions[currentSlide - 1];
      if (!q) return;

      // Part 1: Highlight Option
      if (q.part === 1 || q.questionType === 'multiple_choice' || (!q.part && (q.options || []).length > 0)) {
        const correctBox = document.getElementById('opt-box-' + q.correctIndex);
        if (correctBox) {
          if (isRevealed) {
            correctBox.classList.add('revealed-correct');
            if (userSelectedOption !== null && userSelectedOption !== q.correctIndex) {
              const wrongBox = document.getElementById('opt-box-' + userSelectedOption);
              if (wrongBox) wrongBox.classList.add('revealed-wrong');
            }
          } else {
            correctBox.classList.remove('revealed-correct');
            if (userSelectedOption !== null) {
              const wrongBox = document.getElementById('opt-box-' + userSelectedOption);
              if (wrongBox) wrongBox.classList.remove('revealed-wrong');
            }
          }
        }
      }

      // Part 2: Reveal True / False
      if (q.part === 2 || q.questionType === 'true_false') {
        const tfTable = document.getElementById('tf-table-view');
        if (tfTable) {
          if (isRevealed) {
            tfTable.classList.add('tf-revealed');
          } else {
            tfTable.classList.remove('tf-revealed');
          }
        }
      }

      // Part 3: Reveal Short Answer
      if (q.part === 3 || q.questionType === 'short_answer') {
        const shortVal = document.getElementById('short-ans-val');
        if (shortVal) {
          if (isRevealed) {
            shortVal.classList.add('visible');
          } else {
            shortVal.classList.remove('visible');
          }
        }
      }

      // Explanation Panel
      const exp = document.getElementById('slide-explanation');
      if (exp) {
        if (isRevealed) {
          exp.classList.add('visible');
        } else {
          exp.classList.remove('visible');
        }
      }
    }

    function nextSlide() {
      if (currentSlide < questions.length) {
        currentSlide++;
        renderSlide();
      }
    }

    function prevSlide() {
      if (currentSlide > 0) {
        currentSlide--;
        renderSlide();
      }
    }

    function toggleFullScreen() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
      }
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === 'Enter') {
        nextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        prevSlide();
      } else if (e.key === ' ' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        if (currentSlide === 0) {
          nextSlide();
        } else {
          toggleRevealAnswer();
        }
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullScreen();
      } else if (e.key === 'Home') {
        currentSlide = 0;
        renderSlide();
      } else if (e.key === 'End') {
        currentSlide = questions.length;
        renderSlide();
      }
    });

    // Touch swipe support for Smart TV & Touchscreens
    let touchStartX = 0;
    let touchStartY = 0;
    document.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].clientX;
      touchStartY = e.changedTouches[0].clientY;
    }, { passive: true });
    document.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        if (dx < 0) nextSlide();
        else prevSlide();
      }
    }, { passive: true });

    // Focus document on load so keyboard shortcuts work immediately
    window.addEventListener('load', () => {
      window.focus();
    });

    // Initial render
    renderSlide();
  </script>
</body>
</html>`;
}

export function exportPresentationHTMLFile(questions: Question[], config?: ExamConfig, examCode: string = "101") {
  const html = generatePresentationHTML(questions, config, examCode);
  const subjectSlug = (config?.subject || "de_thi").toLowerCase().replace(/[^a-z0-9]/g, "_");
  const fileName = `Bai_Giang_Slides_${subjectSlug}_ma_${examCode}.html`;
  downloadFile(html, fileName, "text/html");
}

export function openPresentationInNewTab(questions: Question[], config?: ExamConfig, examCode: string = "101") {
  const html = generatePresentationHTML(questions, config, examCode);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}
