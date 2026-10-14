# Audit V15.4 – Cloud, QR, AI

## Đã sửa
1. `publishExamToCloud()` không còn trả `success: true` vô điều kiện.
2. Trả thêm `durable` để phân biệt Firebase Cloud bền vững với backend tạm thời.
3. QR/link production mới chỉ mang mã phòng, không nhúng payload đầy đủ có đáp án.
4. `App.handlePublishExam()` không coi object `{success:false}` là đã lưu.
5. Online publish trên Vercel yêu cầu Cloud bền vững; backend RAM chỉ được tin ở localhost.
6. AI Diagnostic dùng `pointsEarned` đúng schema và chuẩn hóa JSON trả về.
7. AI Tutor không fallback đáp án A khi thiếu answer key.
8. Test Gemini không báo thành công nếu chỉ đúng định dạng key nhưng không xác minh được.
9. Test Cloud dùng đúng URL đang nhập, không dùng URL cũ đã lưu.
10. Thêm `geminiConfig.ts` để hoàn chỉnh import của ModelSettingsModal.

## Rủi ro kiến trúc còn lại
Firebase RTDB hiện lưu nguyên `ExamPackage`. Nếu rules cho phép client đọc công khai, một người có kiến thức kỹ thuật vẫn có thể đọc answer key từ network/database. Muốn chống lộ đáp án ở mức production nghiêm ngặt cần Firebase Auth + Security Rules hoặc chấm server-side với answer key không gửi xuống client.

## Trạng thái kiểm tra
- TypeScript parser không phát hiện lỗi cú pháp mới ở các file V15.4.
- Full `tsc` chưa thể xanh vì baseline được cung cấp vẫn thiếu một số source modules của repository gốc.
- `npm ci` trong môi trường kiểm tra bị timeout nên chưa tuyên bố full build thành công.
