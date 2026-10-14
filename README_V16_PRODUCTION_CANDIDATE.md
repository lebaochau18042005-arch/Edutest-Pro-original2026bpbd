# EduTest Pro V16 – Production Candidate

## Thay đổi chính
- Repo đầy đủ được hợp nhất với các bản vá V15.1–V15.4.
- QR/link mới chỉ mang mã phòng, không nhúng đáp án.
- `/api/exams/:code` chỉ trả đề đã loại bỏ `correctIndex`, `correctValue`, `shortAnswer`, `answerKey` và lời giải.
- Học sinh không tự chấm trong trình duyệt. Bài làm được gửi tới `/api/submissions`; backend dùng bản đề riêng để chấm.
- Đề riêng được lưu tại Firebase Realtime Database phía server khi `FIREBASE_DATABASE_URL` được cấu hình.
- Nếu Vercel chưa có kho lưu bền vững, publish trả `durable=false` và giao diện không nên phát QR production.

## Vercel Environment Variables
- `FIREBASE_DATABASE_URL`: URL Realtime Database.
- `FIREBASE_DATABASE_AUTH`: credential/token server-only nếu rules yêu cầu. Không dùng biến `VITE_*`.
- `GEMINI_API_KEY`: tùy chọn cho AI server-side.
- `ENABLE_DEMO_DATA=false`.

## Kiểm tra bắt buộc trước khi dùng thật
1. Publish đề và xác nhận response `durable=true`.
2. Trên điện thoại khác/4G, mở `/api/exams/<code>` qua app và kiểm tra JSON không có đáp án.
3. Nộp bài và xác nhận điểm chỉ xuất hiện sau response từ `/api/submissions`.
4. Reload trong lúc thi: thời gian và mã đề không đổi.
5. Test phần I, II, III và thang điểm tùy chỉnh.
