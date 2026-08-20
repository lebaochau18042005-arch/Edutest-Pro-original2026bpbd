import { ExamConfig } from "../types";

export interface OMRSheetOptions {
  school?: string;
  department?: string;
  examPeriod?: string;
  subject?: string;
  grade?: string;
  examCode?: string;
  totalPart1?: number; // 12 or 18 or 24 or 40
  totalPart2?: number; // 4
  totalPart3?: number; // 6
}

/**
 * Generates an ultra-crisp, high-definition printable OMR Answer Sheet
 * conforming to Ministry of Education & Training (Bộ GD&ĐT) GDPT 2018 standards (A4 single-page).
 */
export function generatePrintableOMRHtml(options: OMRSheetOptions = {}): string {
  const department = options.department || "SỞ GIÁO DỤC VÀ ĐÀO TẠO";
  const school = options.school || "TRƯỜNG THPT BÌNH PHÚ";
  const examPeriod = options.examPeriod || "BÀI KIỂM TRA ĐỊNH KỲ - NĂM HỌC 2025-2026";
  const subject = options.subject || "ĐỊA LÝ & KHOA HỌC TỔNG HỢP";
  const grade = options.grade || "Khối 12";
  const examCode = options.examCode || "101";

  const numPart1 = options.totalPart1 || 18;
  const numPart2 = options.totalPart2 || 4;
  const numPart3 = options.totalPart3 || 6;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Phiếu Trả Lời Trắc Nghiệm - ${subject}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 10mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, "Helvetica Neue", sans-serif;
      color: #000;
      background: #fff;
      font-size: 11px;
      line-height: 1.25;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet-wrapper {
      width: 100%;
      max-width: 190mm;
      margin: 0 auto;
      border: 2px solid #000;
      padding: 6mm 8mm;
      background: #fff;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 6px;
    }
    .header-table td {
      vertical-align: top;
    }
    .inst-box {
      border: 1.5px solid #000;
      padding: 4px 6px;
      font-size: 9.5px;
      margin-bottom: 8px;
      background: #fafafa;
    }
    .bubble {
      width: 13px;
      height: 13px;
      border: 1.2px solid #000;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 8px;
      font-weight: bold;
      color: #000;
      background: #fff;
      margin: 0 1.5px;
    }
    .sbd-grid, .code-grid {
      border-collapse: collapse;
      margin-top: 4px;
    }
    .sbd-grid td, .code-grid td {
      border: 1px solid #666;
      text-align: center;
      padding: 1px;
      font-size: 8px;
    }
    .sbd-digit-box {
      width: 16px;
      height: 18px;
      border: 1.5px solid #000;
      text-align: center;
      font-size: 11px;
      font-weight: bold;
      margin: 0 1px;
      display: inline-block;
      line-height: 18px;
    }
    .part-title {
      font-size: 11.5px;
      font-weight: bold;
      text-transform: uppercase;
      background: #000;
      color: #fff;
      padding: 2px 6px;
      margin-top: 6px;
      margin-bottom: 4px;
      display: flex;
      justify-content: space-between;
    }
    .p1-col {
      display: inline-block;
      vertical-align: top;
      width: 32%;
      margin-right: 1.5%;
    }
    .p1-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 2px;
      padding: 1px 2px;
      border-bottom: 1px dotted #ccc;
    }
    .p1-qnum {
      font-weight: bold;
      width: 42px;
      font-size: 10px;
    }
    .tf-box {
      border: 1px solid #000;
      margin-bottom: 4px;
      padding: 3px 6px;
    }
    .tf-subrow {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 1.5px 0;
    }
    .short-col {
      display: inline-block;
      vertical-align: top;
      width: 16%;
      border: 1px solid #000;
      margin-right: 0.6%;
      padding: 3px;
      text-align: center;
    }
    .short-box {
      width: 100%;
      height: 18px;
      border: 1.5px solid #000;
      margin-bottom: 4px;
    }
    .footer-line {
      margin-top: 6px;
      border-top: 1px solid #000;
      padding-top: 3px;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #444;
    }
    @media print {
      body { background: #fff; }
      .no-print { display: none !important; }
      .sheet-wrapper { border: 2px solid #000; box-shadow: none; }
    }
  </style>
</head>
<body>
  <!-- Print Tool Bar -->
  <div class="no-print" style="background: #1e293b; color: white; padding: 10px 20px; text-align: center; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; gap: 16px;">
    <span style="font-weight: bold;">Phiếu Trả Lời Trắc Nghiệm Chuẩn Bộ GD&ĐT (Khổ A4)</span>
    <button onclick="window.print()" style="background: #059669; color: white; border: none; padding: 6px 16px; border-radius: 8px; font-weight: bold; cursor: pointer;">
      🖨️ In Phiếu (Ctrl + P)
    </button>
  </div>

  <div class="sheet-wrapper">
    <!-- Header -->
    <table class="header-table">
      <tr>
        <td style="width: 45%;">
          <div style="font-size: 10px; font-weight: bold; text-transform: uppercase;">${department}</div>
          <div style="font-size: 11px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px;">${school}</div>
          <div style="font-size: 9.5px;">Họ tên: .....................................................................</div>
          <div style="font-size: 9.5px; margin-top: 2px;">Lớp: ......................... Phòng thi: ............................</div>
        </td>
        <td style="width: 55%; text-align: center;">
          <div style="font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">
            PHIẾU TRẢ LỜI TRẮC NGHIỆM
          </div>
          <div style="font-size: 10.5px; font-weight: bold; margin-top: 2px;">
            MÔN: ${subject} • ${grade}
          </div>
          <div style="font-size: 9px; color: #333;">${examPeriod}</div>
        </td>
      </tr>
    </table>

    <!-- Student ID (SBD) & Exam Code (Mã đề) Tables -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px;">
      <tr>
        <td style="width: 48%; vertical-align: top; border: 1px solid #000; padding: 4px;">
          <div style="font-weight: bold; font-size: 10px; margin-bottom: 3px; display: flex; justify-content: space-between;">
            <span>SỐ BÁO DANH (6 chữ số)</span>
            <div>
              <span class="sbd-digit-box"></span><span class="sbd-digit-box"></span><span class="sbd-digit-box"></span><span class="sbd-digit-box"></span><span class="sbd-digit-box"></span><span class="sbd-digit-box"></span>
            </div>
          </div>
          <table class="sbd-grid" style="width: 100%;">
            ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
              .map(
                (digit) => `
              <tr>
                ${[0, 1, 2, 3, 4, 5]
                  .map(
                    () =>
                      `<td><span class="bubble">${digit}</span></td>`
                  )
                  .join("")}
              </tr>`
              )
              .join("")}
          </table>
        </td>

        <td style="width: 4%;"></td>

        <td style="width: 48%; vertical-align: top; border: 1px solid #000; padding: 4px;">
          <div style="font-weight: bold; font-size: 10px; margin-bottom: 3px; display: flex; justify-content: space-between;">
            <span>MÃ ĐỀ THI (3 chữ số)</span>
            <div>
              <span class="sbd-digit-box">${examCode[0] || ""}</span><span class="sbd-digit-box">${examCode[1] || ""}</span><span class="sbd-digit-box">${examCode[2] || ""}</span>
            </div>
          </div>
          <table class="code-grid" style="width: 100%;">
            ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
              .map(
                (digit) => `
              <tr>
                ${[0, 1, 2]
                  .map(
                    () =>
                      `<td><span class="bubble">${digit}</span></td>`
                  )
                  .join("")}
              </tr>`
              )
              .join("")}
          </table>
        </td>
      </tr>
    </table>

    <!-- Instructions -->
    <div class="inst-box">
      <b>HƯỚNG DẪN TÔ PHIẾU:</b> Dùng bút chì đen (2B) tô kín ô tròn: <span class="bubble" style="background:#000; color:#fff;">A</span>. Không gạch chéo <span class="bubble">✕</span>, không đánh dấu tích <span class="bubble">✓</span>.
    </div>

    <!-- PART I: MULTIPLE CHOICE -->
    <div class="part-title">
      <span>PHẦN I: Trắc nghiệm 4 lựa chọn (Tô 1 ô tròn đúng nhất)</span>
      <span>${numPart1} CÂU</span>
    </div>
    <div style="margin-bottom: 6px;">
      ${(() => {
        let colsHtml = "";
        const perCol = Math.ceil(numPart1 / 3);
        for (let c = 0; c < 3; c++) {
          const startQ = c * perCol + 1;
          const endQ = Math.min((c + 1) * perCol, numPart1);
          if (startQ <= numPart1) {
            colsHtml += `<div class="p1-col">`;
            for (let q = startQ; q <= endQ; q++) {
              colsHtml += `
                <div class="p1-row">
                  <span class="p1-qnum">Câu ${q}:</span>
                  <div>
                    <span class="bubble">A</span>
                    <span class="bubble">B</span>
                    <span class="bubble">C</span>
                    <span class="bubble">D</span>
                  </div>
                </div>`;
            }
            colsHtml += `</div>`;
          }
        }
        return colsHtml;
      })()}
    </div>

    <!-- PART II: TRUE / FALSE -->
    <div class="part-title">
      <span>PHẦN II: Trắc nghiệm Đúng / Sai (Mỗi câu tô [Đ] hoặc [S] cho 4 ý a, b, c, d)</span>
      <span>${numPart2} CÂU (16 Ý)</span>
    </div>
    <div style="display: flex; gap: 8px; margin-bottom: 6px;">
      ${Array.from({ length: numPart2 }).map((_, idx) => {
        const qNum = idx + 1;
        return `
        <div style="flex: 1;" class="tf-box">
          <div style="font-weight: 900; font-size: 10.5px; border-bottom: 1px solid #999; margin-bottom: 2px; padding-bottom: 1px; text-align: center;">
            CÂU ${qNum}
          </div>
          ${["a", "b", "c", "d"].map((st) => `
            <div class="tf-subrow">
              <span style="font-weight: bold; font-size: 10px;">${st})</span>
              <div>
                <span class="bubble">Đ</span>
                <span class="bubble">S</span>
              </div>
            </div>
          `).join("")}
        </div>`;
      }).join("")}
    </div>

    <!-- PART III: SHORT ANSWER -->
    <div class="part-title">
      <span>PHẦN III: Trắc nghiệm Trả lời ngắn / Điền số (Tô số âm [-] và các chữ số tương ứng)</span>
      <span>${numPart3} CÂU</span>
    </div>
    <div style="display: flex; margin-bottom: 4px;">
      ${Array.from({ length: numPart3 }).map((_, idx) => {
        const qNum = idx + 1;
        return `
        <div class="short-col">
          <div style="font-weight: 900; font-size: 10px; margin-bottom: 2px;">CÂU ${qNum}</div>
          <div class="short-box"></div>
          <div style="margin-bottom: 2px;"><span class="bubble">-</span><span class="bubble">,</span></div>
          ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `
            <div style="margin: 1px 0;"><span class="bubble">${d}</span></div>
          `).join("")}
        </div>`;
      }).join("")}
    </div>

    <!-- Footer Credit -->
    <div class="footer-line">
      <span>EduTest Pro - Hệ thống Khảo thí & Chống gian lận GDPT 2018</span>
      <span>Tác giả: Cô Lê Thị Thái (GV Môn Địa Lý) • Zalo: 0916.791.779</span>
    </div>
  </div>
</body>
</html>`;
}

export function openPrintableOMRSheet(options: OMRSheetOptions = {}) {
  const html = generatePrintableOMRHtml(options);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}
