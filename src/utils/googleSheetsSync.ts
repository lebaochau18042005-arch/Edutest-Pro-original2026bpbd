import * as XLSX from "xlsx";
import { StudentSubmission } from "../types";

/**
 * Format student answers into readable string for Google Sheets / Excel
 */
export function formatStudentAnswersText(submission: StudentSubmission): string {
  if (!submission.answers) return "";

  const qIndices = Object.keys(submission.answers)
    .map(Number)
    .sort((a, b) => a - b);

  if (qIndices.length === 0) return "Chưa trả lời câu nào";

  return qIndices
    .map((qIdx) => {
      const ans = submission.answers[qIdx];
      const detail = submission.detailedResults?.[qIdx];

      let ansStr = "";
      if (typeof ans === "number") {
        ansStr = ["A", "B", "C", "D"][ans] || `Opt ${ans}`;
      } else if (typeof ans === "object" && ans !== null) {
        // True/False
        ansStr = Object.entries(ans)
          .map(([k, v]) => `${k}:${v ? "Đ" : "S"}`)
          .join(",");
      } else {
        ansStr = String(ans ?? "");
      }

      let statusStr = "";
      if (detail) {
        if (detail.isCorrect) {
          statusStr = " (Đúng)";
        } else if (!detail.studentAnswerDisplay || detail.studentAnswerDisplay === "Chưa trả lời") {
          statusStr = " (Chưa làm)";
        } else {
          statusStr = ` (Sai - ĐA: ${detail.correctAnswerDisplay || ""})`;
        }
      }

      return `C${qIdx}: ${ansStr}${statusStr}`;
    })
    .join(" | ");
}

/**
 * Format violation logs into concise timeline string
 */
export function formatViolationSummary(submission: StudentSubmission): string {
  if (!submission.violationLogs || submission.violationLogs.length === 0) {
    return "Không có vi phạm";
  }

  return submission.violationLogs
    .map((log) => {
      const time = new Date(log.timestamp).toLocaleTimeString("vi-VN");
      return `[${time}] ${log.message}`;
    })
    .join(" | ");
}

/**
 * Convert a single submission to a standard table row object
 */
export function submissionToRowObject(s: StudentSubmission, idx: number) {
  const isCheating = s.isLockedDueToCheating || s.status === "locked";
  const totalViolations =
    s.tabSwitchCount +
    (s.copyPasteCount || 0) +
    (s.devToolsCount || 0) +
    (s.suspiciousSpeedCount || 0);

  return {
    "STT": idx + 1,
    "Mã Học Sinh (SBD)": s.studentId || `HS${idx + 1}`,
    "Họ và Tên": s.studentName,
    "Lớp": s.studentClass,
    "Trường": s.school,
    "Khối": s.grade,
    "Tên Bài Thi": s.examTitle,
    "Mã Đề": s.examCode,
    "Điểm Tổng (10.0)": Number(s.score.toFixed(2)),
    "Điểm Phần I": s.part1Score !== undefined ? Number(s.part1Score.toFixed(2)) : "-",
    "Điểm Phần II": s.part2Score !== undefined ? Number(s.part2Score.toFixed(2)) : "-",
    "Điểm Phần III": s.part3Score !== undefined ? Number(s.part3Score.toFixed(2)) : "-",
    "Số Câu Đúng": s.correctCount,
    "Số Câu Sai": s.wrongCount,
    "Chưa Làm": s.unansweredCount,
    "Tổng Số Câu": s.totalQuestions,
    "Thời Gian Làm (phút)": Number((s.durationTakenSeconds / 60).toFixed(1)),
    "Số Lần Rời Tab": s.tabSwitchCount,
    "Tổng Vi Phạm": totalViolations,
    "Tình Trạng Gian Lận": isCheating
      ? "⛔ BỊ ĐÌNH CHỈ & LOẠI KHỎI PHÒNG THI"
      : totalViolations > 0
      ? `Cảnh báo (${totalViolations} lần)`
      : "Hợp lệ (0 vi phạm)",
    "Thời Gian Nộp": new Date(s.submittedAt).toLocaleString("vi-VN"),
    "Trạng Thái Bài": isCheating ? "Bị khóa do gian lận" : "Đã nộp thành công",
    "Chi Tiết Đáp Án Từng Câu": formatStudentAnswersText(s),
    "Nhật Ký Vi Phạm Chi Tiết": formatViolationSummary(s),
  };
}

/**
 * Export submissions to multi-sheet Excel (.xlsx) file, automatically partitioned by class
 */
export function exportSubmissionsMultiSheetExcel(
  submissions: StudentSubmission[],
  examTitle: string = "Bang_Diem_EduTest_Theo_Lop"
) {
  const workbook = XLSX.utils.book_new();

  // 1. Master Sheet: All Classes
  const masterRows = submissions.map((s, i) => submissionToRowObject(s, i));
  const masterSheet = XLSX.utils.json_to_sheet(masterRows);
  XLSX.utils.book_append_sheet(workbook, masterSheet, "Tất Cả Các Lớp");

  // 2. Separate Sheet per Class
  const classMap: Record<string, StudentSubmission[]> = {};
  submissions.forEach((s) => {
    const className = (s.studentClass || "Chưa phân lớp").trim();
    if (!classMap[className]) {
      classMap[className] = [];
    }
    classMap[className].push(s);
  });

  // Sort class names alphabetically
  const classNames = Object.keys(classMap).sort();

  classNames.forEach((cName) => {
    const classSubs = classMap[cName];
    const classRows = classSubs.map((s, i) => submissionToRowObject(s, i));
    const classSheet = XLSX.utils.json_to_sheet(classRows);
    // Excel sheet name max length is 31 characters
    const safeSheetName = `Lớp ${cName}`.slice(0, 31);
    XLSX.utils.book_append_sheet(workbook, classSheet, safeSheetName);
  });

  const safeFileName = `${examTitle.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF-]/g, "_")}.xlsx`;
  XLSX.writeFile(workbook, safeFileName);
}

/**
 * Generate TSV data for Google Sheets copy-paste, optionally filtered by class
 */
export function generateGoogleSheetsTSVByClass(
  submissions: StudentSubmission[],
  targetClass?: string
): string {
  const filtered = targetClass && targetClass !== "all"
    ? submissions.filter((s) => s.studentClass === targetClass)
    : submissions;

  const headers = [
    "STT",
    "Mã Học Sinh (SBD)",
    "Họ và Tên",
    "Lớp",
    "Trường",
    "Khối",
    "Tên Bài Thi",
    "Mã Đề",
    "Điểm Tổng",
    "Điểm Phần I",
    "Điểm Phần II",
    "Điểm Phần III",
    "Đúng",
    "Sai",
    "Chưa Làm",
    "Tổng Câu",
    "Thời Gian (phút)",
    "Rời Màn Hình",
    "Tổng Vi Phạm",
    "Tình Trạng Gian Lận",
    "Thời Gian Nộp",
    "Trạng Thái",
    "Chi Tiết Đáp Án Từng Câu",
    "Nhật Ký Vi Phạm Chi Tiết",
  ];

  const lines = [headers.join("\t")];

  filtered.forEach((s, idx) => {
    const isCheating = s.isLockedDueToCheating || s.status === "locked";
    const totalViolations =
      s.tabSwitchCount +
      (s.copyPasteCount || 0) +
      (s.devToolsCount || 0) +
      (s.suspiciousSpeedCount || 0);

    const row = [
      idx + 1,
      s.studentId || `HS${idx + 1}`,
      s.studentName,
      s.studentClass,
      s.school,
      s.grade,
      s.examTitle,
      s.examCode,
      s.score.toFixed(2),
      s.part1Score !== undefined ? s.part1Score.toFixed(2) : "-",
      s.part2Score !== undefined ? s.part2Score.toFixed(2) : "-",
      s.part3Score !== undefined ? s.part3Score.toFixed(2) : "-",
      s.correctCount,
      s.wrongCount,
      s.unansweredCount,
      s.totalQuestions,
      (s.durationTakenSeconds / 60).toFixed(1),
      s.tabSwitchCount,
      totalViolations,
      isCheating
        ? "BỊ ĐÌNH CHỈ DO GIAN LẬN"
        : totalViolations > 0
        ? `Cảnh báo (${totalViolations})`
        : "Hợp lệ",
      new Date(s.submittedAt).toLocaleString("vi-VN"),
      isCheating ? "Bị khóa" : "Đã nộp",
      formatStudentAnswersText(s).replace(/\t/g, " "),
      formatViolationSummary(s).replace(/\t/g, " "),
    ];

    lines.push(row.join("\t"));
  });

  return lines.join("\n");
}

/**
 * Send submission to Google Apps Script Webhook
 */
export async function syncSubmissionToGoogleSheetsWebhook(
  submission: StudentSubmission,
  webhookUrl: string
): Promise<{ success: boolean; message: string }> {
  if (!webhookUrl || !webhookUrl.startsWith("http")) {
    return { success: false, message: "URL Webhook Google Sheets không hợp lệ" };
  }

  try {
    const payload = {
      action: "SUBMISSION_ENTRY",
      timestamp: new Date().toISOString(),
      studentName: submission.studentName,
      studentClass: submission.studentClass,
      studentId: submission.studentId || "",
      school: submission.school || "",
      grade: submission.grade || "",
      examTitle: submission.examTitle,
      examCode: submission.examCode,
      score: Number(submission.score.toFixed(2)),
      part1Score: submission.part1Score ?? 0,
      part2Score: submission.part2Score ?? 0,
      part3Score: submission.part3Score ?? 0,
      correctCount: submission.correctCount,
      wrongCount: submission.wrongCount,
      unansweredCount: submission.unansweredCount,
      totalQuestions: submission.totalQuestions,
      durationTakenMinutes: Number((submission.durationTakenSeconds / 60).toFixed(1)),
      tabSwitchCount: submission.tabSwitchCount,
      isLockedDueToCheating: Boolean(submission.isLockedDueToCheating || submission.status === "locked"),
      status: submission.status,
      submittedAtFormatted: new Date(submission.submittedAt).toLocaleString("vi-VN"),
      detailedAnswersText: formatStudentAnswersText(submission),
      violationSummary: formatViolationSummary(submission),
    };

    // Use mode 'no-cors' for Google Apps Script Webhook compatibility
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      mode: "no-cors",
    });

    return { success: true, message: "Đã đồng bộ sang Google Sheets thành công!" };
  } catch (err: any) {
    console.error("Google Sheets sync error:", err);
    return { success: false, message: err.message || "Lỗi đồng bộ Google Sheets" };
  }
}

/**
 * Google Apps Script template for teachers to paste into Google Sheet Extensions -> Apps Script
 */
export const GOOGLE_APPS_SCRIPT_SAMPLE_CODE = `/**
 * =========================================================================
 * GOOGLE APPS SCRIPT: TỰ ĐỘNG ĐỒNG BỘ ĐIỂM THI THEO TỪNG LỚP (EDUTEST PRO)
 * =========================================================================
 * HƯỚNG DẪN 3 BƯỚC CÀI ĐẶT NHANH (MẤT 1 PHÚT):
 * 1. Mở trang Google Sheet của Thầy/Cô.
 * 2. Trên thanh menu, chọn: Tiện ích mở rộng (Extensions) -> Apps Script.
 * 3. Xóa hết mã cũ, dán toàn bộ đoạn mã này vào và bấm [Triển khai] (Deploy) 
 *    -> [Lần triển khai mới] (New deployment) 
 *    -> Chọn loại: Ứng dụng web (Web app)
 *    -> Người có quyền truy cập: Bất kỳ ai (Anyone)
 *    -> Bấm [Triển khai] và copy đường link Webhook dán vào EduTest Pro!
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Tên lớp của học sinh (Ví dụ: 12A1, 12A2, 10A3...)
    var className = (data.studentClass || "Chưa phân lớp").toString().trim();
    var isLocked = data.isLockedDueToCheating || data.status === "locked";
    var statusLabel = isLocked ? "⛔ BỊ LOẠI DO GIAN LẬN" : "✅ Đã nộp thành công";

    // 1. TỰ ĐỘNG TẠO HOẶC TÌM SHEET CỦA LỚP ĐÓ
    var sheet = ss.getSheetByName(className);
    if (!sheet) {
      sheet = ss.insertSheet(className);
      var headers = [
        "STT", "Họ và Tên", "Lớp", "SBD", "Mã Đề", "Điểm Tổng (10)", 
        "Điểm P.I", "Điểm P.II", "Điểm P.III", "Đúng", "Sai", "Chưa Làm", 
        "Thời Gian (phút)", "Rời Màn Hình", "Tình Trạng", "Thời Gian Nộp", 
        "Chi Tiết Đáp Án Từng Câu", "Nhật Ký Vi Phạm"
      ];
      sheet.appendRow(headers);
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#e6f4ea"); // Xanh lá nhạt
      headerRange.setFontColor("#137333");
      sheet.setFrozenRows(1);
    }

    var rowIdx = sheet.getLastRow() + 1;
    var rowData = [
      rowIdx - 1,
      data.studentName,
      data.studentClass,
      data.studentId,
      data.examCode,
      data.score,
      data.part1Score || 0,
      data.part2Score || 0,
      data.part3Score || 0,
      data.correctCount,
      data.wrongCount,
      data.unansweredCount,
      data.durationTakenMinutes || 0,
      data.tabSwitchCount || 0,
      statusLabel,
      data.submittedAtFormatted || new Date().toLocaleString("vi-VN"),
      data.detailedAnswersText || "",
      data.violationSummary || ""
    ];
    sheet.appendRow(rowData);

    // NẾU HỌC SINH BỊ LOẠI DO GIAN LẬN -> TÔ MÀU ĐỎ CẢ DÒNG ĐỂ GIÁO VIÊN NHẬN BIẾT
    if (isLocked) {
      sheet.getRange(rowIdx, 1, 1, rowData.length)
        .setBackground("#fce8e6")
        .setFontColor("#c5221f")
        .setFontWeight("bold");
    }

    // 2. ĐỒNG THỜI CẬP NHẬT VÀO TAB "TỔNG HỢP TOÀN BỘ"
    var masterSheet = ss.getSheetByName("Tổng Hợp Toàn Bộ");
    if (!masterSheet) {
      masterSheet = ss.insertSheet("Tổng Hợp Toàn Bộ", 0);
      var masterHeaders = [
        "STT", "Họ và Tên", "Lớp", "SBD", "Mã Đề", "Điểm Số", 
        "Đúng", "Sai", "Thời Gian (phút)", "Rời Tab", "Tình Trạng", "Thời Gian Nộp"
      ];
      masterSheet.appendRow(masterHeaders);
      masterSheet.getRange(1, 1, 1, masterHeaders.length)
        .setFontWeight("bold")
        .setBackground("#e8f0fe")
        .setFontColor("#1a73e8");
      masterSheet.setFrozenRows(1);
    }

    var masterRowIdx = masterSheet.getLastRow() + 1;
    var masterRowData = [
      masterRowIdx - 1,
      data.studentName,
      data.studentClass,
      data.studentId,
      data.examCode,
      data.score,
      data.correctCount,
      data.wrongCount,
      data.durationTakenMinutes || 0,
      data.tabSwitchCount || 0,
      statusLabel,
      data.submittedAtFormatted || new Date().toLocaleString("vi-VN")
    ];
    masterSheet.appendRow(masterRowData);
    if (isLocked) {
      masterSheet.getRange(masterRowIdx, 1, 1, masterRowData.length)
        .setBackground("#fce8e6")
        .setFontColor("#c5221f")
        .setFontWeight("bold");
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
`;
