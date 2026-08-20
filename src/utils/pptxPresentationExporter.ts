import { Question, ExamConfig } from "../types";
import { downloadFile } from "./moodleGiftExporter";

/**
 * Generate a standalone, beautifully styled HTML5 Slides Presentation
 * that opens immediately in fullscreen in any browser (Chrome, Edge, Safari)
 * with KaTeX math rendering, slide transitions, keyboard controls (Left/Right/Space/F),
 * and an interactive "Hiện Đáp Án & Lời Giải" toggle button for teaching on projector!
 */
export function generatePresentationHTML(questions: Question[], config?: ExamConfig, examCode: string = "101"): string {
  const school = config?.school || "TRƯỜNG THPT BÌNH PHÚ";
  const period = config?.examPeriod || "BÀI GIẢNG CHỮA ĐỀ THI TRẮC NGHIỆM";
  const subject = config?.subject || "ĐỊA LÝ & KHOA HỌC TỔNG HỢP";
  const grade = config?.grade || "Khối 12";

  const slidesData = JSON.stringify(
    questions.map((q, idx) => ({
      index: idx + 1,
      part: q.part || 1,
      questionType: q.questionType,
      chapter: q.chapter || "Chương trọng tâm",
      level: q.level || "Thông hiểu",
      content: q.content,
      options: q.options || [],
      correctIndex: q.correctIndex ?? 0,
      statements: q.statements || [],
      shortAnswer: q.shortAnswer || "",
      explanation: q.explanation || "Chưa có lời giải chi tiết.",
    }))
  );

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
      --primary: #1e40af;
      --primary-dark: #0f172a;
      --accent: #059669;
      --gold: #d97706;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #090d16;
      color: #f8fafc;
      overflow: hidden;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .slide-container {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      position: relative;
    }
    .slide-card {
      width: 100%;
      max-width: 1150px;
      height: 86vh;
      background: linear-gradient(145deg, #0f172a, #1e293b);
      border: 1px solid #334155;
      border-radius: 24px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      display: flex;
      flex-direction: column;
      padding: 32px 40px;
      position: relative;
      overflow-y: auto;
    }
    .slide-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #334155;
      padding-bottom: 16px;
      margin-bottom: 20px;
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
      font-size: 22px;
      font-weight: 800;
      color: #38bdf8;
    }
    .question-body {
      font-size: 20px;
      line-height: 1.6;
      color: #f1f5f9;
      margin-bottom: 24px;
      font-weight: 500;
    }
    .options-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    .option-box {
      background: #1e293b;
      border: 2px solid #334155;
      border-radius: 16px;
      padding: 16px 20px;
      font-size: 18px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      transition: all 0.3s;
    }
    .option-box.revealed-correct {
      background: rgba(5, 150, 105, 0.25) !important;
      border-color: #10b981 !important;
      color: #a7f3d0 !important;
      font-weight: 700;
      box-shadow: 0 0 20px rgba(16, 185, 129, 0.3);
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
    .tf-badge-true { background: #059669; color: white; padding: 4px 10px; border-radius: 8px; font-weight: bold; }
    .tf-badge-false { background: #dc2626; color: white; padding: 4px 10px; border-radius: 8px; font-weight: bold; }
    .explanation-panel {
      margin-top: auto;
      background: linear-gradient(135deg, rgba(30, 58, 138, 0.3), rgba(15, 23, 42, 0.8));
      border: 1px solid #3b82f6;
      border-radius: 16px;
      padding: 18px 24px;
      font-size: 16px;
      color: #bfdbfe;
      display: none;
      animation: fadeIn 0.3s ease-in-out forwards;
    }
    .explanation-panel.visible { display: block; }
    .controls-bar {
      height: 70px;
      background: #0f172a;
      border-top: 1px solid #1e293b;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 40px;
    }
    .btn {
      padding: 10px 20px;
      border-radius: 12px;
      border: none;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
    }
    .btn-primary { background: #2563eb; color: white; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-reveal { background: linear-gradient(135deg, #059669, #047857); color: white; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.4); }
    .btn-reveal:hover { background: #059669; transform: scale(1.03); }
    .btn-secondary { background: #334155; color: #f8fafc; }
    .btn-secondary:hover { background: #475569; }
    .nav-indicator { font-size: 14px; color: #94a3b8; font-weight: 600; font-family: monospace; }
    .author-credit { font-size: 12px; color: #64748b; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  </style>
</head>
<body>
  <div class="slide-container">
    <!-- Cover Slide (Slide 0) -->
    <div id="slide-cover" class="slide-card" style="align-items: center; justify-content: center; text-align: center;">
      <span class="badge badge-p1" style="font-size: 15px; margin-bottom: 24px;">HỆ THỐNG KHẢO THÍ CHUẨN GDPT 2018</span>
      <h1 style="font-size: 42px; font-weight: 900; color: #f8fafc; margin-bottom: 16px; line-height: 1.2;">
        ${period}
      </h1>
      <h2 style="font-size: 28px; font-weight: 700; color: #38bdf8; margin-bottom: 24px;">
        MÔN: ${subject} • ${grade} • MÃ ĐỀ: ${examCode}
      </h2>
      <p style="font-size: 18px; color: #94a3b8; margin-bottom: 40px; max-width: 700px;">
        ${school} • Tài liệu bài giảng số hóa và trình chiếu chữa đề thi trực tiếp trên lớp học.
      </p>
      <div style="padding: 16px 28px; background: rgba(30, 41, 59, 0.8); border: 1px solid #475569; border-radius: 16px; display: inline-flex; align-items: center; gap: 16px;">
        <span style="font-size: 15px; font-weight: bold; color: #f59e0b;">Tác giả: Cô Lê Thị Thái (GV Môn Địa Lý)</span>
        <span style="color: #64748b;">•</span>
        <span style="font-size: 14px; color: #94a3b8;">Zalo: 0916.791.779</span>
      </div>
      <p style="margin-top: 30px; font-size: 14px; color: #64748b;">
        Nhấn phím <b>[ → ]</b> hoặc nút <b>Tiếp theo</b> để bắt đầu bài giảng
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

      <div id="slide-body" class="question-body"></div>
      <div id="slide-options-container"></div>

      <div id="slide-explanation" class="explanation-panel">
        <h4 style="font-weight: 800; color: #60a5fa; margin-bottom: 6px; font-size: 16px; display: flex; align-items: center; gap: 6px;">
          <span>💡 Lời Giải Chi Tiết & Hướng Dẫn Tư Duy:</span>
        </h4>
        <div id="slide-explanation-text"></div>
      </div>
    </div>
  </div>

  <!-- Controls Footer Bar -->
  <div class="controls-bar">
    <div style="display: flex; align-items: center; gap: 12px;">
      <button class="btn btn-secondary" onclick="prevSlide()">← Trước [←]</button>
      <button class="btn btn-secondary" onclick="nextSlide()">Sau [→] →</button>
      <span id="slide-counter" class="nav-indicator">SLIDE 0 / 0</span>
    </div>

    <div style="display: flex; align-items: center; gap: 12px;">
      <button id="btn-toggle-answer" class="btn btn-reveal" onclick="toggleRevealAnswer()">
        <span>✨ Hiện Đáp Án & Lời Giải [Phím cách / A]</span>
      </button>
      <button class="btn btn-secondary" onclick="toggleFullScreen()">
        <span>⛶ Toàn màn hình [F]</span>
      </button>
    </div>

    <div class="author-credit">
      EduTest Pro • Cô Lê Thị Thái (GV Môn Địa Lý)
    </div>
  </div>

  <script>
    const questions = ${slidesData};
    let currentSlide = 0; // 0 is cover, 1..N are questions
    let isRevealed = false;

    function renderSlide() {
      const cover = document.getElementById('slide-cover');
      const content = document.getElementById('slide-content');
      const counter = document.getElementById('slide-counter');
      const btnReveal = document.getElementById('btn-toggle-answer');

      isRevealed = false;
      counter.textContent = 'SLIDE ' + currentSlide + ' / ' + questions.length;

      if (currentSlide === 0) {
        cover.style.display = 'flex';
        content.style.display = 'none';
        btnReveal.style.display = 'none';
        return;
      }

      cover.style.display = 'none';
      content.style.display = 'flex';
      btnReveal.style.display = 'inline-flex';

      const q = questions[currentSlide - 1];
      document.getElementById('slide-qnum').textContent = 'CÂU ' + q.index;
      document.getElementById('slide-chapter').textContent = q.chapter + ' (' + q.level + ')';
      document.getElementById('slide-body').innerHTML = q.content;

      // Badge
      const badge = document.getElementById('slide-badge');
      if (q.part === 2) {
        badge.className = 'badge badge-p2';
        badge.textContent = 'PHẦN II: ĐÚNG / SAI';
      } else if (q.part === 3) {
        badge.className = 'badge badge-p3';
        badge.textContent = 'PHẦN III: TRẢ LỜI NGẮN';
      } else {
        badge.className = 'badge badge-p1';
        badge.textContent = 'PHẦN I: 4 LỰA CHỌN';
      }

      // Container
      const optContainer = document.getElementById('slide-options-container');
      optContainer.innerHTML = '';

      if (q.part === 1 || q.questionType === 'multiple_choice') {
        const grid = document.createElement('div');
        grid.className = 'options-grid';
        const letters = ['A', 'B', 'C', 'D'];
        (q.options || []).forEach((opt, oIdx) => {
          const box = document.createElement('div');
          box.className = 'option-box';
          box.id = 'opt-box-' + oIdx;
          box.innerHTML = '<span class="opt-letter">' + (letters[oIdx] || 'A') + '</span><span>' + opt + '</span>';
          grid.appendChild(box);
        });
        optContainer.appendChild(grid);
      } else if (q.part === 2 || q.questionType === 'true_false') {
        let html = '<table class="tf-table"><thead><tr><th style="width: 80px;">Mệnh đề</th><th>Nội dung khẳng định</th><th style="width: 130px; text-align: center;">Đáp án</th></tr></thead><tbody>';
        (q.statements || []).forEach(st => {
          html += '<tr><td><b>' + (st.label || st.id + ')') + '</b></td><td>' + st.text + '</td><td style="text-align: center;"><span class="' + (st.correctValue ? 'tf-badge-true' : 'tf-badge-false') + '">' + (st.correctValue ? 'ĐÚNG' : 'SAI') + '</span></td></tr>';
        });
        html += '</tbody></table>';
        optContainer.innerHTML = html;
      } else {
        optContainer.innerHTML = '<div style="padding: 20px; background: #1e293b; border-radius: 16px; border: 1px solid #3b82f6; font-size: 20px;"><b>Đáp án điền số:</b> <span style="color: #34d399; font-weight: 800; font-size: 24px; font-family: monospace;">' + (q.shortAnswer || 'Đáp án chuẩn') + '</span></div>';
      }

      // Explanation
      document.getElementById('slide-explanation').className = 'explanation-panel';
      document.getElementById('slide-explanation-text').innerHTML = q.explanation;

      // Render math formulas
      if (window.renderMathInElement) {
        renderMathInElement(document.body, {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\(', right: '\\)', display: false},
            {left: '\\[', right: '\\]', display: true}
          ],
          throwOnError: false
        });
      }
    }

    function toggleRevealAnswer() {
      if (currentSlide === 0) return;
      isRevealed = !isRevealed;
      const q = questions[currentSlide - 1];

      if (q.part === 1 || q.questionType === 'multiple_choice') {
        const correctBox = document.getElementById('opt-box-' + q.correctIndex);
        if (correctBox) {
          if (isRevealed) {
            correctBox.classList.add('revealed-correct');
          } else {
            correctBox.classList.remove('revealed-correct');
          }
        }
      }

      const exp = document.getElementById('slide-explanation');
      if (isRevealed) {
        exp.classList.add('visible');
      } else {
        exp.classList.remove('visible');
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

    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') nextSlide();
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') prevSlide();
      else if (e.key === ' ' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        toggleRevealAnswer();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullScreen();
      }
    });

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
