import { fallbackParseExam, mergeParsedQuestionsWithSource, clientParseExam } from "../src/utils/clientAI";
import { normalizeExamQuestions3Parts, SAMPLE_EXAM_TEXT, SAMPLE_ENGLISH_THPT_TEXT } from "../src/utils/examHelpers";

const custom18ExamText = `
ĐỀ THI THỬ 18 CÂU
PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn. Thí sinh trả lời từ câu 1 đến câu 10.
Câu 1. Cho hàm số y = f(x) có đồ thị như hình vẽ. Hàm số đồng biến trên khoảng nào?
A. (0; 2)
B. (-1; 1)
C. (1; 3)
D. (-2; 0)

Câu 2. Cho cấp số cộng (un) có u1 = 3 và d = 2. Giá trị của u2 bằng
A. 5.
B. 6.
C. 1.
D. 9.

Câu 3. Trong không gian Oxyz, mặt cầu (S): x^2 + y^2 + z^2 - 2x + 4y - 6z + 1 = 0 có tâm là
A. I(1; -2; 3).
B. I(-1; 2; -3).
C. I(2; -4; 6).
D. I(-2; 4; -6).

Câu 4. Cho hàm số y = ax^4 + bx^2 + c có đồ thị như hình vẽ. Mệnh đề nào dưới đây đúng?
A. a > 0, b < 0, c > 0.
B. a > 0, b > 0, c < 0.
C. a < 0, b > 0, c > 0.
D. a < 0, b < 0, c < 0.

Câu 5. Tập nghiệm của bất phương trình log2(x - 1) < 3 là
A. (1; 9).
B. (-inf; 9).
C. (1; 8).
D. (0; 9).

Câu 6. Thể tích khối lăng trụ có diện tích đáy B = 6 và chiều cao h = 4 là
A. 24.
B. 8.
C. 12.
D. 72.

Câu 7. Nguyên hàm của hàm số f(x) = 2x + cos x là
A. x^2 + sin x + C.
B. x^2 - sin x + C.
C. 2 + sin x + C.
D. 2 - sin x + C.

Câu 8. Số giao điểm của đồ thị hàm số y = x^3 - 3x + 2 với trục hoành là
A. 2.
B. 3.
C. 1.
D. 0.

Câu 9. Đạo hàm của hàm số y = 3^x là
A. y' = 3^x * ln 3.
B. y' = 3^x / ln 3.
C. y' = x * 3^(x-1).
D. y' = 3^x.

Câu 10. Cho khối chóp S.ABC có đáy ABC là tam giác vuông tại B, AB = a, BC = 2a. Chiều cao SA = 3a. Thể tích khối chóp là
A. a^3.
B. 2a^3.
C. 3a^3.
D. 6a^3.

PHẦN II. Câu trắc nghiệm đúng sai. Thí sinh trả lời từ câu 1 đến câu 4.
Câu 1. Cho hàm số f(x) = x^3 - 3x^2 + 2.
a) Hàm số đạt cực đại tại x = 0. (Đúng)
b) Giá trị cực tiểu của hàm số bằng 2. (Sai)
c) Điểm uốn của đồ thị là I(1; 0). (Đúng)
d) Đồ thị cắt trục hoành tại 3 điểm phân biệt. (Đúng)

Câu 2. Trong không gian Oxyz, cho mặt phẳng (P): 2x - y + 2z - 5 = 0 và điểm A(1; 2; 3).
a) Véc-tơ n = (2; -1; 2) là một VTPT của (P). (Đúng)
b) Điểm A thuộc mặt phẳng (P). (Sai)
c) Khoảng cách từ A đến (P) bằng 1/3. (Sai)
d) Mặt phẳng (Q) song song với (P) và qua gốc tọa độ O có phương trình là 2x - y + 2z = 0. (Đúng)

Câu 3. Một vật chuyển động với gia tốc a(t) = 3t^2 + 2 (m/s^2). Vận tốc ban đầu v(0) = 5 m/s.
a) Vận tốc tại thời điểm t là v(t) = t^3 + 2t + 5. (Đúng)
b) Tại thời điểm t = 2s, vận tốc là 17 m/s. (Đúng)
c) Quãng đường đi được sau 3s là s(3) = 45m. (Sai)
d) Gia tốc tại thời điểm t = 1s là a(1) = 5 m/s^2. (Đúng)

Câu 4. Cho hình chóp S.ABCD có đáy ABCD là hình vuông cạnh a, SA vuông góc với (ABCD), SA = a.
a) Tam giác SBC vuông tại B. (Đúng)
b) Góc giữa SC và mặt phẳng (ABCD) bằng 45 độ. (Sai)
c) Khoảng cách từ A đến (SBD) bằng a*sqrt(3)/3. (Đúng)
d) Thể tích khối chóp S.ABCD là a^3/3. (Đúng)

PHẦN III. Câu trắc nghiệm trả lời ngắn. Thí sinh trả lời từ câu 1 đến câu 4.
Câu 1. Tìm giá trị lớn nhất của hàm số y = -x^4 + 2x^2 + 3 trên đoạn [0; 2].
Đáp án: 4

Câu 2. Cho tích phân I = int_0^1 (2x + 1) dx. Tính giá trị của I.
Đáp án: 2

Câu 3. Có bao nhiêu số tự nhiên có 3 chữ số đôi một khác nhau được lập từ các chữ số {1, 2, 3, 4, 5}?
Đáp án: 60

Câu 4. Một hộp có 5 viên bi đỏ và 4 viên bi xanh. Lấy ngẫu nhiên 2 viên bi. Xác suất để lấy được 2 viên bi cùng màu bằng a/b (phân số tối giản). Tính a + b.
Đáp án: 22
`;

async function runAllTests() {
  console.log("=== TEST 1: Fallback parser on 18Q custom exam ===");
  const parsed18 = fallbackParseExam(custom18ExamText);
  const norm18 = normalizeExamQuestions3Parts(parsed18);
  console.log(`Total: ${norm18.length} | P1: ${norm18.filter(q => q.part === 1).length} (exp 10) | P2: ${norm18.filter(q => q.part === 2).length} (exp 4) | P3: ${norm18.filter(q => q.part === 3).length} (exp 4)`);

  console.log("\n=== TEST 2: ClientParseExam (with fallback) on 18Q custom exam ===");
  const res18 = await clientParseExam({ rawText: custom18ExamText });
  const data18 = res18.data || [];
  console.log(`Total: ${data18.length} | P1: ${data18.filter(q => q.part === 1).length} (exp 10) | P2: ${data18.filter(q => q.part === 2).length} (exp 4) | P3: ${data18.filter(q => q.part === 3).length} (exp 4)`);

  console.log("\n=== TEST 3: ClientParseExam on Sample Math 22Q ===");
  const resMath = await clientParseExam({ rawText: SAMPLE_EXAM_TEXT });
  const dataMath = resMath.data || [];
  console.log(`Total: ${dataMath.length} | P1: ${dataMath.filter(q => q.part === 1).length} (exp 12) | P2: ${dataMath.filter(q => q.part === 2).length} (exp 4) | P3: ${dataMath.filter(q => q.part === 3).length} (exp 6)`);

  console.log("\n=== TEST 4: ClientParseExam on Sample English 40Q ===");
  const resEng = await clientParseExam({ rawText: SAMPLE_ENGLISH_THPT_TEXT });
  const dataEng = resEng.data || [];
  console.log(`Total: ${dataEng.length} | P1: ${dataEng.filter(q => q.part === 1).length} (exp ${dataEng.length}) | P2: ${dataEng.filter(q => q.part === 2).length} (exp 0) | P3: ${dataEng.filter(q => q.part === 3).length} (exp 0)`);

  console.log("\n=== TEST 5: Verify Statement Text Quality in Part II ===");
  const p2Questions = data18.filter(q => q.part === 2);
  p2Questions.forEach((q, idx) => {
    console.log(`P2 Q${idx + 1} Statements:`);
    q.statements?.forEach(s => {
      console.log(`  ${s.label} text="${s.text}" correct=${s.correctValue}`);
    });
  });

  console.log("\n=== TEST 6: Simulated AI Response with Merging ===");
  const aiFormatted = data18.map(q => ({
    ...q,
    explanation: "AI detailed explanation",
  }));
  const merged = mergeParsedQuestionsWithSource(aiFormatted, fallbackParseExam(custom18ExamText));
  console.log(`Merged Total: ${merged.length} | P1: ${merged.filter(q => q.part === 1).length} | P2: ${merged.filter(q => q.part === 2).length} | P3: ${merged.filter(q => q.part === 3).length}`);
  console.log("All tests completed successfully!");
}

runAllTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
