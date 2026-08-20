---
name: skill-toan-hoc
description: Giải pháp trích xuất công thức toán học từ file DOCX (MathType/OMML) và chuyển đổi sang LaTeX cho AI phân tích. Gọi skill này khi cần xử lý file Word có công thức toán.
---

# Skill Toán Học — Trích Xuất Công Thức từ DOCX

## Mục đích

Skill này giải quyết vấn đề **trích xuất công thức toán học từ file Word (.docx)** để gửi cho AI (Gemini) phân tích. Áp dụng cho module **Ngân hàng câu hỏi** và bất kỳ tính năng nào cần đọc công thức toán từ DOCX.

---

## Vấn đề gốc

File Word chứa công thức toán dưới **2 dạng chính**:

| Loại | Cách lưu trong DOCX | Đặc điểm |
|------|---------------------|----------|
| **OMML** (Office Math) | XML tag `<m:oMath>` trong `word/document.xml` | Word 2007+ tạo bằng Equation Editor mới |
| **MathType** | File **WMF/EMF** trong `word/media/` | Phần mềm MathType bên thứ 3, rất phổ biến trong giáo dục VN |

### Tại sao khó?
- **OMML**: Có thể parse XML trực tiếp → chuyển sang LaTeX ✅
- **MathType (WMF)**: Là **hình ảnh vector Windows** → không thể đọc nội dung trên browser, Gemini API cũng không hỗ trợ format WMF ❌

---

## Giải pháp: Chiến lược Hybrid (XML + Mammoth)

### Nguyên lý cốt lõi

> **Mammoth** (`mammoth.convertToHtml()`) có engine nội bộ tự convert WMF → PNG khi render HTML. Đây là cách DUY NHẤT trên browser để "đọc" công thức MathType.

### Quy trình 3 bước

```
┌──────────────────────────────────────────────────────────────┐
│ BƯỚC 1: Mammoth extract hình ảnh                             │
│ mammoth.convertToHtml() → HTML có <img src="data:image/png"> │
│ → WMF được convert thành PNG base64                          │
│ → Regex extract tất cả hình từ HTML                          │
└──────────────────────┬───────────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────────┐
│ BƯỚC 2: XML Parser extract text + OMML                       │
│ Unzip word/document.xml → parse XML                          │
│ → <m:oMath> chuyển thành LaTeX $...$                         │
│ → Text giữ nguyên cấu trúc câu hỏi                          │
└──────────────────────┬───────────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────────┐
│ BƯỚC 3: Merge & gửi AI                                       │
│ Text: từ XML (có LaTeX cho OMML)                             │
│ Hình: từ Mammoth (có PNG cho MathType WMF)                   │
│ → Gửi cả text + hình cho Gemini AI                           │
│ → AI nhìn hình công thức → viết LaTeX                        │
└──────────────────────────────────────────────────────────────┘
```

---

## File liên quan

### 1. `services/docxMathParser.ts` — Parser chính

**Chức năng**: Unzip DOCX → parse XML → extract images → merge kết quả

**Interface trả về:**
```typescript
export interface DocxParseResult {
  text: string;                                    // Nội dung text (có LaTeX từ OMML)
  images: { base64: string; mimeType: string }[];  // Hình ảnh (PNG từ mammoth, bao gồm WMF đã convert)
  method: 'xml' | 'mammoth' | 'hybrid';            // Phương pháp được dùng
  wmfCount: number;                                 // Số công thức MathType phát hiện
}
```

**Logic chính trong `parseDocxWithMath()`:**
```
1. LUÔN chạy mammoth trước → extract hình ảnh (mammoth convert WMF→PNG)
2. Thử XML parsing → extract text + OMML→LaTeX
3. Nếu XML thành công:
   - Đếm WMF trong zip → wmfCount
   - Merge: text từ XML, hình từ mammoth (nhiều hình hơn vì có WMF đã convert)
   - method = 'hybrid' nếu có WMF, 'xml' nếu không
4. Nếu XML thất bại → fallback mammoth text + images
```

**Các hàm quan trọng:**
- `extractImages()`: Trích xuất TẤT CẢ media files từ zip (kể cả WMF/EMF)
- `processDocumentXml()`: Parse XML, chuyển `<m:oMath>` → LaTeX
- `ommlToLatex()`: Chuyển đổi OMML XML → LaTeX string
- `extractRelationships()`: Đọc `word/_rels/document.xml.rels` để map image relationships

### 2. `services/geminiService.ts` — AI Extraction

**Chức năng**: Gửi text + hình cho Gemini → nhận JSON câu hỏi

**Prompt strategy khi có hình ảnh:**
```
- Thông báo AI có N hình ảnh đính kèm
- Yêu cầu AI ĐỌC KỸ từng hình (bao gồm công thức MathType đã convert PNG)
- AI CHUYỂN ĐỔI công thức trong hình sang LaTeX: $...$
- KẾT HỢP thông tin từ text VÀ hình để trích xuất câu hỏi đầy đủ
```

**Cách gửi hình cho Gemini:**
```typescript
// Hình được gửi dưới dạng inline_data
parts.push({ inline_data: { mime_type: img.mimeType, data: img.base64 } });
// Sau đó gửi text prompt
parts.push({ text: userPrompt });
```

### 3. `components/QuestionBank.tsx` — UI

**Flow xử lý:**
```
1. User chọn file .docx
2. Gọi parseDocxWithMath(arrayBuffer)
3. Hiển thị status: 
   - hybrid → "Phát hiện N công thức MathType. Đã chuyển đổi thành hình ảnh cho AI."
   - xml → "Đã giữ nguyên công thức toán học (OMML → LaTeX)"
   - mammoth → "Đã trích xuất nội dung bằng mammoth"
4. Gửi text + images cho extractQuestionsFromFile()
5. Hiển thị kết quả
```

---

## Tham khảo: Dự án "6 agme tieu hoc"

Giải pháp được lấy cảm hứng từ `6 agme tieu hoc/src/Manage.tsx` (hàm `handleAiAnalyzeFile`):

| Tính năng | "6 agme tieu hoc" | Project hiện tại |
|-----------|-------------------|------------------|
| DOCX → text | mammoth | XML parser (giữ OMML→LaTeX) |
| DOCX → hình | mammoth (WMF→PNG) | mammoth (WMF→PNG) ✅ |
| PDF | Gửi binary trực tiếp cho Gemini | PDF.js extract text |
| AI prompt | Prompt đơn giản + hình inline | Prompt chi tiết + hình inline |
| Math handling | AI đọc hình công thức | XML: OMML→LaTeX, mammoth: WMF→PNG cho AI |

---

## Những lỗi đã mắc (học từ kinh nghiệm)

### ❌ Sai lầm 1: Bỏ qua WMF
```typescript
// SAI — bỏ qua WMF khiến mất công thức MathType
const SUPPORTED = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
if (!SUPPORTED.includes(ext)) continue; // Skip wmf/emf
```

### ❌ Sai lầm 2: Yêu cầu AI "đoán" từ placeholder
```
// SAI — AI không thể đoán nội dung [IMG:image72.wmf] vì không nhìn thấy hình
"Cho mặt phẳng [IMG:image72.wmf]" → AI không biết công thức là gì
```

### ✅ Giải pháp đúng: Mammoth convert WMF → PNG → AI nhìn thấy hình thực
```
1. mammoth convert WMF → PNG base64
2. Gửi PNG cho AI qua inline_data
3. AI nhìn hình công thức → đọc được → viết LaTeX
```

---

## Checklist khi debug

Nếu công thức toán vẫn không hiển thị đúng, kiểm tra:

- [ ] Console log `[DocxMathParser]` — xem `method` là gì? (`hybrid`/`xml`/`mammoth`)
- [ ] `wmfCount` > 0? → file dùng MathType
- [ ] `images.length` > 0? → mammoth có extract được hình không?
- [ ] Gemini có nhận hình không? (check `parts` array trước khi gọi API)
- [ ] File .docx có bị hỏng không? (thử mở bằng Word)
- [ ] Mammoth version? (đảm bảo mammoth hỗ trợ convert WMF)

---

## Lệnh test nhanh

```bash
# Kiểm tra TypeScript không lỗi
npx tsc --noEmit --skipLibCheck 2>&1 | Select-String -NotMatch "6 agme"

# Chạy dev server
npm run dev
```

---

## Dependencies

- **mammoth**: `npm install mammoth` — Convert DOCX → HTML (tự convert WMF → PNG)
- **Gemini API**: Nhận hình inline_data (PNG/JPEG/GIF/WEBP)
- Không cần thêm thư viện convert WMF bên ngoài

---

## Khi nào gọi skill này?

- Khi user report "công thức toán bị mất" hoặc "hiện [IMG:xxx.wmf]"
- Khi thêm tính năng import file Word có công thức
- Khi debug vấn đề trích xuất nội dung DOCX có MathType
- Khi cần tham khảo cách "6 agme tieu hoc" xử lý file upload AI
