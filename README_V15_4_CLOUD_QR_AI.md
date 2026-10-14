# EduTest Pro V15.4 – Cloud / QR / AI Stable

Bản này kế thừa V15.3 và tích hợp 5 file cuối: cloudExamDatabase, shareUrlHelper, ModelSettingsModal, AIDiagnosticCard, AITutorModal.

## Sửa chính
- Publish Cloud không còn báo success giả khi mọi nơi lưu đều thất bại.
- Online QR/link chỉ phát khi Cloud lưu bền vững; link production không nhúng full đề + đáp án vào URL.
- Không fallback đáp án A trong share/tutor.
- Kiểm tra Cloud dùng đúng URL đang nhập.
- Kiểm tra Gemini không báo thành công chỉ dựa vào định dạng key.
- Đồng bộ schema AI Diagnostic với UI và dùng pointsEarned đúng type.

## Giới hạn bảo mật cần hiểu
Nếu Firebase Realtime Database được mở quyền đọc công khai và lưu nguyên ExamPackage có đáp án, người dùng kỹ thuật vẫn có thể đọc dữ liệu mạng. Để bảo mật đề thi nghiêm ngặt cần Firebase Auth + Security Rules hoặc backend/server-side grading với kho đáp án riêng.
