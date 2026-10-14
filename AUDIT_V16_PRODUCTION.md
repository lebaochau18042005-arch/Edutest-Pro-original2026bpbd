# AUDIT EDU TEST PRO V16 – PRODUCTION CANDIDATE

## Đã hợp nhất
- Toàn bộ source ZIP gốc của dự án.
- Các sửa lỗi V15.1–V15.4: bảo toàn DOCX/MathType, QR, OMR, biểu điểm, Student Exam/Result, Cloud/AI.
- Bổ sung 7 module bị thiếu trong ZIP gốc để không còn import tương đối bị mất.

## Thay đổi production quan trọng
1. QR/link mới chỉ chứa mã phòng; không nhúng `#exam=` chứa đáp án.
2. `/api/exams/:code` trả bản đề công khai đã loại `correctIndex`, `originalCorrectIndex`, `correctValue`, `shortAnswer`, `acceptableAnswers`, `answerKey`, `explanation`.
3. `StudentExamRoom` không gọi `gradeSubmission()`; học sinh gửi đáp án thô và backend chấm.
4. Backend lưu bản đề đầy đủ ở `privateExams/<accessCode>` thông qua biến môi trường server-side.
5. Thêm `EDUTEST_ADMIN_TOKEN` để chặn API quản trị (ngân hàng câu hỏi, publish/xóa đề, bài nộp, lớp học, kết quả chấm giấy).
6. Bài làm offline được giữ trong hàng đợi; khi có mạng sẽ gửi lại và nhận kết quả chấm chính thức từ server.
7. Submission giữ nguyên ID để retry không tạo bản ghi trùng.

## Kiểm tra đã chạy trong môi trường này
- 49 file TS/TSX: TypeScript `transpileModule` => 0 lỗi cú pháp.
- Import tương đối: 0 file thiếu.
- `package.json`, `package-lock.json`, `vercel.json`: JSON hợp lệ.
- ZIP được kiểm tra bằng `unzip -t` sau khi đóng gói.

## Giới hạn kiểm tra
`npm install/npm ci` trong sandbox bị timeout mạng, nên chưa thể chạy `vite build` với node_modules hoàn chỉnh tại đây. Bộ source đã được chuẩn bị để trên máy/Vercel chạy `npm ci && npm run build`.
