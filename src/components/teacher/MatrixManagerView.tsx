import React, { useState } from "react";
import {
  FileText,
  Download,
  Layers,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  Printer,
  Table,
} from "lucide-react";
import { Question, ExamConfig } from "../../types";

interface MatrixManagerViewProps {
  questions: Question[];
  config?: Partial<ExamConfig>;
}

export const MatrixManagerView: React.FC<MatrixManagerViewProps> = ({
  questions = [],
  config,
}) => {
  const [subjectFilter, setSubjectFilter] = useState<string>("Tất cả");

  // Part 1, Part 2, Part 3 totals
  const part1List = questions.filter((q) => q.part === 1 || q.questionType === "multiple_choice");
  const part2List = questions.filter((q) => q.part === 2 || q.questionType === "true_false");
  const part3List = questions.filter((q) => q.part === 3 || q.questionType === "short_answer");

  // Cognitive Level Counts
  const levelCounts = {
    "Nhận biết": questions.filter((q) => q.level === "Nhận biết").length,
    "Thông hiểu": questions.filter((q) => q.level === "Thông hiểu").length,
    "Vận dụng": questions.filter((q) => q.level === "Vận dụng").length,
    "Vận dụng cao": questions.filter((q) => q.level === "Vận dụng cao").length,
  };

  const totalQuestions = questions.length || 1;

  // Level percentages
  const nHanBietPct = Math.round((levelCounts["Nhận biết"] / totalQuestions) * 100);
  const thongHieuPct = Math.round((levelCounts["Thông hiểu"] / totalQuestions) * 100);
  const vanDungPct = Math.round((levelCounts["Vận dụng"] / totalQuestions) * 100);
  const vanDungCaoPct = Math.round((levelCounts["Vận dụng cao"] / totalQuestions) * 100);

  // Group by chapters
  const chapterMap: Record<string, { nHanBiet: number; thongHieu: number; vanDung: number; vanDungCao: number }> = {};

  questions.forEach((q) => {
    const ch = q.chapter || "Chuyên đề tổng hợp";
    if (!chapterMap[ch]) {
      chapterMap[ch] = { nHanBiet: 0, thongHieu: 0, vanDung: 0, vanDungCao: 0 };
    }
    if (q.level === "Nhận biết") chapterMap[ch].nHanBiet++;
    else if (q.level === "Thông hiểu") chapterMap[ch].thongHieu++;
    else if (q.level === "Vận dụng") chapterMap[ch].vanDung++;
    else if (q.level === "Vận dụng cao") chapterMap[ch].vanDungCao++;
  });

  const exportMatrixHTML = () => {
    const htmlContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Ma Trận Đặc Tả Đề Thi GDPT 2018</title>
  <style>
    body { font-family: "Times New Roman", Times, serif; margin: 30px; font-size: 14pt; }
    h2, h3 { text-align: center; text-transform: uppercase; margin-bottom: 5px; }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .header-table td { text-align: center; font-weight: bold; }
    table.matrix { width: 100%; border-collapse: collapse; margin-top: 15px; }
    table.matrix th, table.matrix td { border: 1px solid #000; padding: 6px; text-align: center; }
    table.matrix th { background-color: #f0f0f0; }
    .text-left { text-align: left !important; }
  </style>
</head>
<body>
  <table class="header-table">
    <tr>
      <td>${config?.school || "TRƯỜNG THPT BÌNH PHÚ"}<br>TỔ CHUYÊN MÔN</td>
      <td>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br>Độc lập - Tự do - Hạnh phúc</td>
    </tr>
  </table>

  <h2>MA TRẬN ĐẶC TẢ ĐỀ THI GDPT 2018</h2>
  <h3>MÔN: ${config?.subject || "ĐỊA LÝ / TOÁN HỌC"} - ${config?.grade || "KHỐI 12"}</h3>
  <p style="text-align:center;"><em>(Thời gian làm bài: 50 phút • Định dạng 3 phần chuẩn Bộ GD&ĐT)</em></p>

  <table class="matrix">
    <thead>
      <tr>
        <th rowspan="2">STT</th>
        <th rowspan="2">Chuyên đề / Chủ đề kiến thức</th>
        <th colspan="4">Mức độ đánh giá năng lực</th>
        <th rowspan="2">Tổng số câu</th>
        <th rowspan="2">Tỉ lệ (%)</th>
      </tr>
      <tr>
        <th>Nhận biết</th>
        <th>Thông hiểu</th>
        <th>Vận dụng</th>
        <th>Vận dụng cao</th>
      </tr>
    </thead>
    <tbody>
      ${Object.entries(chapterMap)
        .map(
          ([ch, stat], idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td class="text-left">${ch}</td>
          <td>${stat.nHanBiet}</td>
          <td>${stat.thongHieu}</td>
          <td>${stat.vanDung}</td>
          <td>${stat.vanDungCao}</td>
          <td><strong>${stat.nHanBiet + stat.thongHieu + stat.vanDung + stat.vanDungCao}</strong></td>
          <td>${Math.round(((stat.nHanBiet + stat.thongHieu + stat.vanDung + stat.vanDungCao) / totalQuestions) * 100)}%</td>
        </tr>
      `
        )
        .join("")}
      <tr style="font-weight:bold; background-color:#f9f9f9;">
        <td colspan="2">TỔNG CỘNG HỆ THỐNG</td>
        <td>${levelCounts["Nhận biết"]}</td>
        <td>${levelCounts["Thông hiểu"]}</td>
        <td>${levelCounts["Vận dụng"]}</td>
        <td>${levelCounts["Vận dụng cao"]}</td>
        <td>${questions.length}</td>
        <td>100%</td>
      </tr>
    </tbody>
  </table>

  <br>
  <table style="width:100%;">
    <tr>
      <td style="text-align:center;"><strong>NGƯỜI LẬP MA TRẬN</strong><br><em>(Ký và ghi rõ họ tên)</em></td>
      <td style="text-align:center;"><strong>DUYỆT CỦA TỔ TRƯỞNG CHUYÊN MÔN</strong><br><em>(Ký và ghi rõ họ tên)</em></td>
    </tr>
  </table>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (w) w.focus();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-800 text-xs font-bold border border-purple-200">
            <Table className="w-3.5 h-3.5" />
            <span>Khung Đặc Tả & Ma Trận Đề Thi GDPT 2018</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Quản Lý Ma Trận Mức Độ Năng Lực & 3 Phần Cấu Trúc
          </h2>
          <p className="text-xs text-slate-500">
            Kiểm tra tỉ lệ Nhận biết - Thông hiểu - Vận dụng - Vận dụng cao theo công văn Bộ GD&ĐT.
          </p>
        </div>

        <button
          type="button"
          onClick={exportMatrixHTML}
          className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Xuất Bảng Ma Trận In Khổ A4</span>
        </button>
      </div>

      {/* Cognitive Level Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            1. Nhận biết (40% chuẩn)
          </span>
          <div className="text-2xl font-black text-blue-600 font-mono">
            {levelCounts["Nhận biết"]} câu ({nHanBietPct}%)
          </div>
          <span className="text-[11px] text-slate-500 block">
            Câu hỏi nhận biết kiến thức SGK
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            2. Thông hiểu (30% chuẩn)
          </span>
          <div className="text-2xl font-black text-emerald-600 font-mono">
            {levelCounts["Thông hiểu"]} câu ({thongHieuPct}%)
          </div>
          <span className="text-[11px] text-slate-500 block">
            Câu hỏi giải thích, so sánh
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            3. Vận dụng (20% chuẩn)
          </span>
          <div className="text-2xl font-black text-amber-600 font-mono">
            {levelCounts["Vận dụng"]} câu ({vanDungPct}%)
          </div>
          <span className="text-[11px] text-slate-500 block">
            Tính toán, xử lý số liệu
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            4. Vận dụng cao (10% chuẩn)
          </span>
          <div className="text-2xl font-black text-rose-600 font-mono">
            {levelCounts["Vận dụng cao"]} câu ({vanDungCaoPct}%)
          </div>
          <span className="text-[11px] text-slate-500 block">
            Phân hóa học sinh giỏi
          </span>
        </div>
      </div>

      {/* Chapter Breakdown Matrix Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">
            Ma Trận Phân Bổ Theo Chuyên Đề Kiến Thức
          </h3>
          <span className="text-xs text-slate-400">Tổng số {questions.length} câu hỏi trong hệ thống</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[11px]">
              <tr>
                <th className="p-3.5">STT</th>
                <th className="p-3.5">Chuyên đề</th>
                <th className="p-3.5 text-center text-blue-600">Nhận biết</th>
                <th className="p-3.5 text-center text-emerald-600">Thông hiểu</th>
                <th className="p-3.5 text-center text-amber-600">Vận dụng</th>
                <th className="p-3.5 text-center text-rose-600">Vận dụng cao</th>
                <th className="p-3.5 text-center">Tổng câu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
              {Object.entries(chapterMap).map(([ch, stat], idx) => {
                const totalCh = stat.nHanBiet + stat.thongHieu + stat.vanDung + stat.vanDungCao;
                return (
                  <tr key={ch} className="hover:bg-slate-50/80">
                    <td className="p-3.5 font-bold font-mono text-slate-500">{idx + 1}</td>
                    <td className="p-3.5 font-semibold text-slate-900">{ch}</td>
                    <td className="p-3.5 text-center font-mono font-bold text-blue-600">{stat.nHanBiet}</td>
                    <td className="p-3.5 text-center font-mono font-bold text-emerald-600">{stat.thongHieu}</td>
                    <td className="p-3.5 text-center font-mono font-bold text-amber-600">{stat.vanDung}</td>
                    <td className="p-3.5 text-center font-mono font-bold text-rose-600">{stat.vanDungCao}</td>
                    <td className="p-3.5 text-center font-mono font-bold text-slate-900 bg-slate-50/50">{totalCh}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
