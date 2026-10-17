
function base64UrlBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlText(text: string): string {
  return base64UrlBytes(new TextEncoder().encode(text));
}

function pemToPkcs8Bytes(pem: string): Uint8Array {
  const clean = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const raw = atob(clean);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

let cachedAccessToken = "";
let cachedAccessTokenExp = 0;

async function getFirebaseServiceAccountToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessTokenExp - 60 > now) return cachedAccessToken;

  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || "").trim();
  const rawPrivateKey = String(process.env.FIREBASE_PRIVATE_KEY || "").trim();
  const privateKey = rawPrivateKey
    .replace(/^"(.*)"$/s, "$1")
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN_PRIVATE_KEY-----/g, "-----BEGIN PRIVATE KEY-----")
    .replace(/-----END_PRIVATE_KEY-----/g, "-----END PRIVATE KEY-----")
    .trim();
  if (!clientEmail || !privateKey) throw new Error("Thiếu FIREBASE_CLIENT_EMAIL hoặc FIREBASE_PRIVATE_KEY.");
  if (!privateKey.includes("-----BEGIN PRIVATE KEY-----") || !privateKey.includes("-----END PRIVATE KEY-----")) {
    throw new Error("FIREBASE_PRIVATE_KEY sai định dạng PEM. Phải có BEGIN PRIVATE KEY và END PRIVATE KEY.");
  }

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8Bytes(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const header = base64UrlText(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64UrlText(JSON.stringify({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const signature = new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsigned)
  ));
  const assertion = `${unsigned}.${base64UrlBytes(signature)}`;

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json: any = await tokenRes.json().catch(() => null);
  if (!tokenRes.ok || !json?.access_token) {
    throw new Error(json?.error_description || json?.error || `OAuth token thất bại HTTP ${tokenRes.status}.`);
  }
  cachedAccessToken = String(json.access_token);
  cachedAccessTokenExp = now + Number(json.expires_in || 3600);
  return cachedAccessToken;
}

async function runFirebaseServiceAccountHealthCheck() {
  const databaseUrl = String(process.env.FIREBASE_DATABASE_URL || "").trim().replace(/\/+$/, "");
  const projectId = String(process.env.FIREBASE_PROJECT_ID || "").trim();
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || "").trim();
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || "").trim();
  if (!databaseUrl || !projectId || !clientEmail || !privateKey) {
    return { success: false, phase: "config", error: "Thiếu biến môi trường Firebase Service Account trên Vercel." };
  }

  const token = await getFirebaseServiceAccountToken();
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const key = nonce.replace(/[^A-Za-z0-9_-]/g, "_");
  const path = `healthChecks/${key}`;
  const endpoint = `${databaseUrl}/${path}.json`;
  const marker = { source: "edutest-pro-v16-service-account-oauth", nonce, createdAt: new Date().toISOString() };
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  let writeOk = false, readOk = false, deleteOk = false;
  try {
    const put = await fetch(endpoint, { method: "PUT", headers, body: JSON.stringify(marker) });
    if (!put.ok) throw new Error(`Firebase ghi thất bại HTTP ${put.status}: ${(await put.text().catch(() => "")).slice(0, 300)}`);
    writeOk = true;

    const get = await fetch(endpoint, { method: "GET", headers });
    if (!get.ok) throw new Error(`Firebase đọc thất bại HTTP ${get.status}: ${(await get.text().catch(() => "")).slice(0, 300)}`);
    const data = await get.json().catch(() => null);
    readOk = Boolean(data && data.nonce === nonce && data.source === marker.source);
    if (!readOk) throw new Error("Firebase đọc lại dữ liệu nhưng nội dung không khớp.");

    const del = await fetch(endpoint, { method: "DELETE", headers });
    if (!del.ok) throw new Error(`Firebase xóa thất bại HTTP ${del.status}: ${(await del.text().catch(() => "")).slice(0, 300)}`);
    deleteOk = true;

    return {
      success: true,
      phase: "complete",
      writeOk,
      readOk,
      deleteOk,
      authMode: "service-account-oauth2-webcrypto",
      message: "Service Account OAuth2 đã ghi, đọc và xóa Firebase thành công.",
    };
  } catch (err: any) {
    if (writeOk && !deleteOk) {
      try { await fetch(endpoint, { method: "DELETE", headers }); } catch {}
    }
    return {
      success: false,
      phase: writeOk ? (readOk ? "cleanup" : "read") : "write",
      writeOk,
      readOk,
      deleteOk,
      authMode: "service-account-oauth2-webcrypto",
      error: String(err?.message || err || "Lỗi Firebase Service Account."),
    };
  }
}

function safeFirebaseKey(value: string): string {
  return encodeURIComponent(String(value || "").trim().toUpperCase().replace(/[.#$[\]/]/g, "_"));
}

async function firebaseDbRequest(pathname: string, method: "GET" | "PUT" | "DELETE", body?: unknown): Promise<any> {
  const databaseUrl = String(process.env.FIREBASE_DATABASE_URL || "").trim().replace(/\/+$/, "");
  if (!databaseUrl) throw new Error("Thiếu FIREBASE_DATABASE_URL.");
  const token = await getFirebaseServiceAccountToken();
  const url = `${databaseUrl}/${pathname.replace(/^\/+/, "")}.json`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`Firebase ${method} thất bại HTTP ${res.status}: ${text.slice(0, 300)}`);
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

function sanitizeQuestionForStudentApi(q: any): any {
  const out: any = { ...(q || {}) };
  delete out.correctIndex;
  delete out.originalCorrectIndex;
  delete out.shortAnswer;
  delete out.acceptableAnswers;
  delete out.explanation;
  delete out.answer;
  delete out.correctAnswer;
  delete out.answerKey;
  if (Array.isArray(out.statements)) {
    out.statements = out.statements.map((st: any) => {
      const s = { ...st };
      delete s.correctValue;
      delete s.isCorrect;
      delete s.answer;
      delete s.explanation;
      return s;
    });
  }
  return out;
}

function sanitizeExamForStudentApi(exam: any): any {
  if (!exam) return exam;
  const out: any = {
    ...exam,
    originalQuestions: Array.isArray(exam.originalQuestions)
      ? exam.originalQuestions.map(sanitizeQuestionForStudentApi)
      : [],
    variants: Array.isArray(exam.variants)
      ? exam.variants.map((v: any) => ({
          ...v,
          questions: Array.isArray(v.questions) ? v.questions.map(sanitizeQuestionForStudentApi) : [],
          answerKey: {},
        }))
      : [],
  };
  delete out.answerKey;
  return out;
}

function validateExamPackageForStore(pkg: any): string[] {
  const issues: string[] = [];
  if (!pkg || typeof pkg !== "object") issues.push("Gói đề không hợp lệ.");
  if (!String(pkg?.accessCode || "").trim()) issues.push("Thiếu mã phòng thi.");
  if (!Array.isArray(pkg?.originalQuestions) || pkg.originalQuestions.length === 0) issues.push("Đề không có câu hỏi.");
  if (!Array.isArray(pkg?.variants) || pkg.variants.length === 0) issues.push("Đề chưa có mã đề.");
  for (const [i, q] of (pkg?.originalQuestions || []).entries()) {
    if (!String(q?.content || "").trim()) issues.push(`Câu ${i + 1} thiếu nội dung.`);
    if (q?.needsReview) issues.push(`Câu ${i + 1} chưa được giáo viên kiểm duyệt.`);
    const part = q?.part || (q?.questionType === "true_false" ? 2 : q?.questionType === "short_answer" ? 3 : 1);
    if (part === 1 && (!Number.isInteger(q?.correctIndex) || q.correctIndex < 0)) issues.push(`Câu ${i + 1} chưa có đáp án đúng.`);
    if (part === 2) {
      const st = Array.isArray(q?.statements) ? q.statements : [];
      if (st.length !== 4 || st.some((x: any) => typeof x?.correctValue !== "boolean")) issues.push(`Câu ${i + 1} Đúng/Sai chưa đủ đáp án.`);
    }
    if (part === 3 && !String(q?.shortAnswer || "").trim()) issues.push(`Câu ${i + 1} chưa có đáp án trả lời ngắn.`);
  }
  return issues.slice(0, 20);
}

export default async function handler(req: any, res: any) {
  const requestedPath = typeof req.query.__path === "string" ? req.query.__path : "";

  // Lightweight durable exam store for Vercel. This bypasses the full Express bundle
  // so QR publishing/loading uses the same verified Service Account path as the health check.
  if (requestedPath === "exams" && String(req.method || "GET").toUpperCase() === "POST") {
    const configuredToken = String(process.env.EDUTEST_ADMIN_TOKEN || "").trim();
    const providedToken = String(req.headers?.["x-edutest-admin-token"] || "").trim();
    if (!configuredToken) return res.status(503).json({ success: false, error: "Chưa cấu hình EDUTEST_ADMIN_TOKEN trên Vercel." });
    if (!providedToken || providedToken !== configuredToken) return res.status(401).json({ success: false, error: "Mã quản trị không đúng hoặc chưa được gửi." });

    try {
      const pkg = req.body;
      const issues = validateExamPackageForStore(pkg);
      if (issues.length) return res.status(400).json({ success: false, error: "Đề chưa đủ điều kiện xuất bản.", issues });

      const accessCode = String(pkg.accessCode).trim().toUpperCase();
      const stored = { ...pkg, accessCode, serverUpdatedAt: new Date().toISOString() };
      await firebaseDbRequest(`privateExams/${safeFirebaseKey(accessCode)}`, "PUT", stored);
      return res.status(200).json({
        success: true,
        durable: true,
        data: sanitizeExamForStudentApi(stored),
        message: "Đã lưu đề an toàn vào Firebase bằng Service Account.",
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        durable: false,
        error: "Không thể lưu đề lên Firebase.",
        detail: String(err?.message || err || "").slice(0, 500),
      });
    }
  }

  if (requestedPath.startsWith("exams/") && String(req.method || "GET").toUpperCase() === "GET") {
    try {
      const code = decodeURIComponent(requestedPath.slice("exams/".length)).trim().toUpperCase();
      if (!code) return res.status(400).json({ success: false, error: "Thiếu mã phòng thi." });
      const exam = await firebaseDbRequest(`privateExams/${safeFirebaseKey(code)}`, "GET");
      if (!exam) return res.status(404).json({ success: false, error: `Không tìm thấy đề kiểm tra với mã ${code}` });
      return res.status(200).json({ success: true, data: sanitizeExamForStudentApi(exam) });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: "Không thể tải đề từ Firebase.",
        detail: String(err?.message || err || "").slice(0, 500),
      });
    }
  }

  // Keep lightweight health checks independent from the full Express backend.
  // This lets Vercel report configuration/storage status even if another backend module fails to initialize.
  if (requestedPath === "system-status") {
    const adminToken = String(process.env.EDUTEST_ADMIN_TOKEN || "").trim();
    const firebaseAdmin = {
      databaseUrlConfigured: Boolean(String(process.env.FIREBASE_DATABASE_URL || "").trim()),
      projectIdConfigured: Boolean(String(process.env.FIREBASE_PROJECT_ID || "").trim()),
      clientEmailConfigured: Boolean(String(process.env.FIREBASE_CLIENT_EMAIL || "").trim()),
      privateKeyConfigured: Boolean(String(process.env.FIREBASE_PRIVATE_KEY || "").trim()),
    };
    const ready = firebaseAdmin.databaseUrlConfigured &&
      firebaseAdmin.projectIdConfigured &&
      firebaseAdmin.clientEmailConfigured &&
      firebaseAdmin.privateKeyConfigured;
    return res.status(200).json({
      success: true,
      secureServerGrading: true,
      durableExamStorageConfigured: ready,
      firebaseAdminConfigured: ready,
      firebaseAdmin: { ...firebaseAdmin, ready },
      adminTokenConfigured: Boolean(adminToken),
      demoDataEnabled: process.env.ENABLE_DEMO_DATA === "true",
      runtime: "vercel-serverless",
    });
  }

  if (requestedPath === "firebase-health") {
    const adminToken = String(process.env.EDUTEST_ADMIN_TOKEN || "").trim();
    const provided = String(req.headers?.["x-edutest-admin-token"] || "").trim();
    if (!adminToken) {
      return res.status(503).json({ success: false, error: "Chưa cấu hình EDUTEST_ADMIN_TOKEN trên Vercel." });
    }
    if (!provided || provided !== adminToken) {
      return res.status(401).json({ success: false, error: "Mã quản trị không đúng hoặc chưa được gửi." });
    }

    try {
      const result = await runFirebaseServiceAccountHealthCheck();
      if (!result.success) {
        return res.status(result.phase === "config" ? 503 : 502).json(result);
      }
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        phase: "service-account-auth",
        error: "Không thể xác thực Firebase Service Account trên Vercel.",
        detail: String(err?.message || err || "").slice(0, 500),
      });
    }
  }

  if (requestedPath) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (key === "__path") continue;
      if (Array.isArray(value)) value.forEach(v => query.append(key, String(v)));
      else if (value !== undefined) query.append(key, String(value));
    }
    req.url = `/api/${requestedPath}${query.toString() ? `?${query.toString()}` : ""}`;
  }

  const { default: app } = await import("../server");
  return app(req as any, res as any);
}
