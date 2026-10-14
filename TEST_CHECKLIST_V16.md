# TEST CHECKLIST V16

1. Vercel Environment Variables:
   - `FIREBASE_DATABASE_URL`
   - `FIREBASE_DATABASE_AUTH` nếu database rules yêu cầu
   - `EDUTEST_ADMIN_TOKEN`
   - `ENABLE_DEMO_DATA=false`
   - `GEMINI_API_KEY` nếu dùng AI server-side
2. Trên máy giáo viên: nhập cùng `EDUTEST_ADMIN_TOKEN` ở Cài đặt > Cloud/Production.
3. Bấm “Kiểm tra Production”: phải báo backend + kho lưu bền vững sẵn sàng.
4. Publish một đề; chỉ phát QR khi `durable=true`.
5. Mở QR bằng điện thoại 4G khác máy.
6. Kiểm tra Network response `/api/exams/<code>`: không có đáp án/lời giải.
7. Làm đủ Phần I, II, III; nộp bài; điểm chỉ xuất hiện sau response `/api/submissions`.
8. Reload giữa giờ: mã đề và thời gian không thay đổi.
9. Ngắt mạng trước khi nộp: bài vào hàng đợi; bật mạng lại: tự đồng bộ và chấm.
10. Giáo viên mở theo dõi kết quả bằng admin token; học sinh gọi `/api/submissions` không token phải bị từ chối.
11. OMR: thử phiếu đúng, sai, bỏ trống, tô nhiều; trường hợp mơ hồ phải yêu cầu duyệt.
12. Chạy: `npm ci`, `npm run lint`, `npm run build`, `npm run test:security`, `npm run test:paper-grading`, `npm run test:formulas`.
