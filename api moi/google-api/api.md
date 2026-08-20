# 📋 QUY TẮC PHÁT TRIỂN & TỐI ƯU GEMINI API

> **Phiên bản:** 3.1 — cập nhật 26/06/2026  
> **Mục đích:** Tài liệu chuẩn cho dự án dùng Gemini API, model fallback, API key và triển khai Vercel  
> **Nguồn kiểm tra:** Google AI Models + Google AI Pricing, cập nhật tháng 6/2026

---

## I. DANH SÁCH MODEL HIỆN HÀNH

### 4 model mặc định nên dùng trong app

| Ưu tiên | Model | Trạng thái | Context | Output max | Vai trò |
|---|---|---|---:|---:|---|
| 1 | **gemini-3.5-flash** | Stable | 1,048,576 | 65,536 | Mặc định: nhanh, mạnh, ổn định cho đa số tác vụ |
| 2 | **gemini-3.1-flash-lite** | Stable | 1,048,576 | 65,536 | Dự phòng nhẹ/tiết kiệm khi cần tốc độ hoặc chi phí thấp |
| 3 | **gemini-3.1-pro-preview** | Preview | 1,048,576 | 65,536 | Tác vụ reasoning/coding/agentic khó |
| 4 | **gemini-2.5-flash** | Stable | 1,048,576 | 65,536 | Dự phòng ổn định, cân bằng chi phí/hiệu năng |

### Model tùy chọn

| Model | Khi nào dùng | Ghi chú |
|---|---|---|
| **gemini-2.5-flash-lite** | Tác vụ đơn giản, batch số lượng lớn, cực nhạy chi phí | Stable, rẻ hơn `gemini-2.5-flash` |
| **gemini-2.5-pro** | Cần chất lượng cao, reasoning phức tạp, phân tích code/dữ liệu lớn | Stable, đắt hơn; không nên dùng làm default |

### Model cũ cần tránh

| Model cũ | Trạng thái | Thay bằng |
|---|---|---|
| `gemini-3-pro-preview` | Đã shutdown 09/03/2026 | `gemini-3.1-pro-preview` |
| `gemini-3.1-flash-lite-preview` | Đã shutdown 25/05/2026 | `gemini-3.1-flash-lite` |
| `gemini-2.0-flash` | Đã shutdown 01/06/2026 | `gemini-2.5-flash` hoặc `gemini-3.5-flash` |
| `gemini-2.0-flash-lite` | Đã shutdown 01/06/2026 | `gemini-2.5-flash-lite` hoặc `gemini-3.1-flash-lite` |
| `gemini-2.5-flash-lite-preview-09-2025` | Đã shutdown | `gemini-2.5-flash-lite` |
| `gemini-3-flash-preview` | Vẫn có nhưng là preview | Ưu tiên `gemini-3.5-flash` stable |

---

## II. BẢNG GIÁ THAM KHẢO

> Giá dưới đây là **paid tier, per 1M tokens USD**. Kiểm tra lại trang pricing trước khi release lớn vì Google có thể thay đổi giá.

| Model | Standard input | Standard output | Batch/Flex input | Batch/Flex output |
|---|---:|---:|---:|---:|
| `gemini-3.5-flash` | $1.50 | $9.00 | $0.75 | $4.50 |
| `gemini-3.1-flash-lite` | $0.25 | $1.50 | $0.125 | $0.75 |
| `gemini-3.1-pro-preview` | $2.00 / $4.00 (>200K) | $12.00 / $18.00 (>200K) | $1.00 / $2.00 (>200K) | $6.00 / $9.00 (>200K) |
| `gemini-2.5-flash` | $0.30 | $2.50 | $0.15 | $1.25 |
| `gemini-2.5-flash-lite` | $0.10 | $0.40 | $0.05 | $0.20 |
| `gemini-2.5-pro` | $1.25 / $2.50 (>200K) | $10.00 / $15.00 (>200K) | $0.625 / $1.25 (>200K) | $5.00 / $7.50 (>200K) |

---

## III. CƠ CHẾ FALLBACK TỰ ĐỘNG

### Thứ tự fallback khuyến nghị

```txt
[Model người dùng chọn]
→ gemini-3.5-flash
→ gemini-3.1-flash-lite
→ gemini-3.1-pro-preview
→ gemini-2.5-flash
```

### Chỉ fallback model cho các lỗi tạm thời

Fallback sang model tiếp theo khi gặp:

- `500 INTERNAL`
- `503 UNAVAILABLE`
- `504 DEADLINE_EXCEEDED`
- lỗi text có `overloaded`, `high demand`, `temporarily unavailable`
- `404 NOT_FOUND` do endpoint/model cũ không còn khả dụng

Không fallback model cho:

- `401`, `API_KEY_INVALID`: báo API key sai/hết hạn
- `403`, `PERMISSION_DENIED`: báo key không có quyền
- `429`, `RESOURCE_EXHAUSTED`: báo quota/rate limit, không đánh dấu key là invalid
- `400`, `INVALID_ARGUMENT`: kiểm tra payload/model parameter

### Pseudo-code

```ts
const FALLBACK_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.1-pro-preview',
  'gemini-2.5-flash',
];

const orderedModels = selectedModel
  ? [selectedModel, ...FALLBACK_MODELS.filter((m) => m !== selectedModel)]
  : FALLBACK_MODELS;

for (const model of orderedModels) {
  try {
    return await callGemini(model, prompt);
  } catch (error) {
    if (!isModelTemporaryError(error)) throw error;
  }
}
```

---

## IV. QUẢN LÝ API KEY

### Cơ chế

- Người dùng nhập API key qua **Settings** hoặc modal.
- Lưu trong `localStorage` với key `gemini_api_key`.
- Chỉ gửi API key tới endpoint Google; không gửi qua server trung gian nếu app không có backend.
- Hỗ trợ cả 2 prefix:
  - Legacy standard key: `AIzaSy...`
  - Auth key mới: `AQ...`

### Link lấy key

- Dùng link chính thức: https://aistudio.google.com/apikey
- Không dùng link cũ `/api-keys`.

### Validator khuyến nghị

```ts
const GOOGLE_AI_API_KEY_PATTERN = /^(?:AIzaSy|AQ)\S{8,}$/;

function isValidGoogleAiApiKey(key: string): boolean {
  return GOOGLE_AI_API_KEY_PATTERN.test(key.trim());
}
```

### Thông báo lỗi nên dùng

| Trường hợp | Thông báo |
|---|---|
| Chưa nhập key | `Vui lòng cấu hình API Key trước khi sử dụng tính năng này.` |
| Key sai/hết hạn | `API Key không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại trong Settings.` |
| Không có quyền | `API key không có quyền truy cập Gemini API. Hãy tạo auth key mới trong Google AI Studio.` |
| Quota/rate limit | `Đã hết quota hoặc vượt giới hạn tốc độ API. Vui lòng đợi một lúc rồi thử lại.` |
| Model quá tải | `Model Google đang quá tải hoặc tạm thời không khả dụng. App đang thử model dự phòng.` |

---

## V. CHIẾN LƯỢC CHỌN MODEL THEO TÁC VỤ

### Quy tắc nhanh

```txt
FAQ, tóm tắt ngắn, phân loại đơn giản     → gemini-3.1-flash-lite hoặc gemini-2.5-flash-lite
Chat, multimodal, tạo nội dung phổ thông   → gemini-3.5-flash
Xử lý quy mô lớn, chi phí thấp             → gemini-2.5-flash-lite
Reasoning/coding/agentic khó               → gemini-3.1-pro-preview
Chất lượng cao, ổn định, phức tạp          → gemini-2.5-pro
Fallback ổn định                            → gemini-2.5-flash
```

### Bảng gợi ý chi tiết

| Tác vụ | Model khuyến nghị | Lý do |
|---|---|---|
| Chatbot FAQ đơn giản | `gemini-3.1-flash-lite` | Nhanh, rẻ, context lớn |
| Tóm tắt văn bản ngắn | `gemini-3.1-flash-lite` | Độ trễ thấp, chi phí thấp |
| Tạo câu hỏi trắc nghiệm | `gemini-3.5-flash` | Cân bằng tốc độ/chất lượng |
| Phân tích ảnh/PDF/DOCX | `gemini-3.5-flash` | Multimodal mạnh, output dài |
| Batch phân loại dữ liệu lớn | `gemini-2.5-flash-lite` | Rẻ nhất cho throughput |
| Phân tích dữ liệu sâu | `gemini-3.1-pro-preview` | Reasoning tốt |
| Coding/agentic workflow | `gemini-3.1-pro-preview` hoặc `gemini-2.5-pro` | Tốt cho code và suy luận đa bước |
| Fallback khi model mới quá tải | `gemini-2.5-flash` | Stable, phổ biến |

---

## VI. TỐI ƯU CHI PHÍ

### Cấu hình mặc định theo nhóm

| Nhóm model | maxOutputTokens | temperature | Ghi chú |
|---|---:|---:|---|
| Flash-Lite | 1,024-2,048 | 0.3-0.6 | Tác vụ đơn giản, JSON ngắn |
| Flash | 2,048-8,192 | 0.5-0.8 | Nội dung phổ thông, multimodal |
| Pro / Pro Preview | 4,096-16,384 | 0.2-0.6 | Reasoning, coding, phân tích sâu |

### Chiến lược tiết kiệm

1. **Batch API**: giảm khoảng 50% chi phí cho tác vụ không cần real-time.
2. **Hybrid approach**: dùng Flash/Lite để phân loại sơ bộ, chỉ dùng Pro cho phần khó.
3. **Giới hạn output**: đặt `maxOutputTokens` theo đúng nhu cầu, tránh để mặc định quá cao.
4. **Cache prompt hệ thống**: dùng context caching cho system prompt lặp lại.
5. **Fallback có chọn lọc**: chỉ fallback khi model quá tải/tạm lỗi, không fallback bừa cho key/quota.

---

## VII. TRIỂN KHAI VERCEL

### File bắt buộc

`vercel.json` ở root:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Checklist trước deploy

- [ ] Không còn model đã shutdown trong code hoặc docs.
- [ ] Model mặc định là `gemini-3.5-flash`.
- [ ] Fallback chain dùng model hiện hành.
- [ ] API key validator chấp nhận `AIzaSy...` và `AQ...`.
- [ ] Link lấy key là `https://aistudio.google.com/apikey`.
- [ ] Không log full API key.
- [ ] Có thông báo riêng cho `401/403`, `429`, `500/503/504`.
- [ ] Build production chạy thành công.

### Checklist sau deploy

- [ ] Theo dõi tỉ lệ lỗi `503/UNAVAILABLE` để biết model nào hay quá tải.
- [ ] Theo dõi `429/RESOURCE_EXHAUSTED` để tối ưu quota/rate limit.
- [ ] Kiểm tra bundle production không còn model cũ.
- [ ] Cập nhật tài liệu model định kỳ mỗi tháng hoặc trước release lớn.

---

## VIII. THAM KHẢO

- Models: https://ai.google.dev/gemini-api/docs/models
- Pricing: https://ai.google.dev/gemini-api/docs/pricing
- API key: https://ai.google.dev/gemini-api/docs/api-key
- Troubleshooting: https://ai.google.dev/gemini-api/docs/troubleshooting
- Batch API: https://ai.google.dev/gemini-api/docs/batch
