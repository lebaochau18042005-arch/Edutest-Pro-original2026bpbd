import { ExamPackage, StudentSubmission, Classroom, ClassAssignment } from "../types";

export interface CloudDatabaseConfig {
  provider: "firebase_rtdb" | "custom_rest";
  databaseUrl: string;
  apiKey?: string;
  autoSync: boolean;
}

// Default Cloud Database URL helper
export function isConfiguredCloudUrl(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return false;
  if (trimmed.includes("edutest-pro-cloud-default-rtdb")) return false;
  return true;
}

const CONFIG_STORAGE_KEY = "edutest_cloud_db_config";
const ADMIN_TOKEN_STORAGE_KEY = "edutest_admin_token";

function getAdminHeaders(extra: Record<string, string> = {}): Record<string, string> {
  let token = "";
  try { token = localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || ""; } catch {}
  return token.trim() ? { ...extra, "x-edutest-admin-token": token.trim() } : extra;
}

/**
 * Gets the current Cloud Database configuration from LocalStorage
 */
export function getCloudDatabaseConfig(): CloudDatabaseConfig {
  try {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed.databaseUrl === "string") {
        if (parsed.databaseUrl.includes("edutest-pro-cloud-default-rtdb")) {
          parsed.databaseUrl = "";
          parsed.autoSync = false;
        }
        return parsed;
      }
    }
  } catch (e) {}

  return {
    provider: "firebase_rtdb",
    databaseUrl: "",
    autoSync: false,
  };
}

/**
 * Saves Cloud Database configuration to LocalStorage
 */
export function saveCloudDatabaseConfig(config: Partial<CloudDatabaseConfig>): CloudDatabaseConfig {
  const current = getCloudDatabaseConfig();
  const updated: CloudDatabaseConfig = {
    ...current,
    ...config,
  };
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {}
  return updated;
}

/**
 * Sanitizes an access code to be safe for database path keys
 */
function sanitizeKey(code: string): string {
  return encodeURIComponent(code.trim().toUpperCase().replace(/[.#$[\]/]/g, "_"));
}

/**
 * Helper to fetch with a timeout
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 6000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/**
 * Publishes/Uploads an Exam Package to the Cloud Database.
 * Allows students everywhere (4G/Wi-Fi) to retrieve the exam instantly.
 */
export async function publishExamToCloud(
  pkg: ExamPackage
): Promise<{ success: boolean; durable?: boolean; cloudKey?: string; message: string }> {
  if (!pkg || !pkg.accessCode) return { success: false, message: "Mã đề thi không hợp lệ." };
  try {
    const res = await fetchWithTimeout("/api?__path=publish-exam", {
      method: "POST",
      headers: getAdminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(pkg),
    }, 10000);
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return { success: false, durable: false, message: json?.error || `Máy chủ từ chối lưu đề (HTTP ${res.status}).` };
    }
    try {
      const saved = JSON.parse(localStorage.getItem("edutest_active_exams") || "[]");
      const filtered = saved.filter((e: any) => e.accessCode?.toUpperCase() !== pkg.accessCode?.toUpperCase() && e.id !== pkg.id);
      localStorage.setItem("edutest_active_exams", JSON.stringify([pkg, ...filtered]));
    } catch {}
    return {
      success: true,
      durable: Boolean(json.durable),
      cloudKey: sanitizeKey(pkg.accessCode),
      message: json.message || (json.durable ? "Đã lưu đề an toàn trên máy chủ." : "Đề mới chỉ lưu tạm trên máy chủ."),
    };
  } catch (err: any) {
    return { success: false, durable: false, message: `Không thể kết nối máy chủ: ${err?.message || "Lỗi mạng"}.` };
  }
}

export async function fetchExamFromCloud(accessCode: string): Promise<ExamPackage | null> {
  if (!accessCode || !accessCode.trim()) return null;
  const upperCode = accessCode.trim().toUpperCase();
  try {
    const res = await fetchWithTimeout(`/api?__path=student-exam&code=${encodeURIComponent(upperCode)}`, {}, 8000);
    if (res.ok && (res.headers.get("content-type") || "").includes("application/json")) {
      const json = await res.json();
      if (json?.success && json.data) return json.data as ExamPackage;
    }
  } catch (err) {
    console.warn("Secure exam fetch failed:", err);
  }
  return null;
}

export async function submitExamToCloud(
  submission: StudentSubmission
): Promise<{ success: boolean; durable?: boolean; message: string; data?: StudentSubmission }> {
  if (!submission) return { success: false, message: "Dữ liệu bài nộp rỗng." };
  try {
    const res = await fetchWithTimeout("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission),
    }, 12000);
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success || !json?.data) {
      return { success: false, durable: false, message: json?.error || `Máy chủ chưa chấm được bài (HTTP ${res.status}).` };
    }
    const graded = json.data as StudentSubmission;
    try {
      const localSubs: StudentSubmission[] = JSON.parse(localStorage.getItem("edutest_submissions") || "[]");
      const updated = [graded, ...localSubs.filter((x) => x.id !== graded.id)];
      localStorage.setItem("edutest_submissions", JSON.stringify(updated));
    } catch {}
    return {
      success: true,
      durable: Boolean(json.durable),
      message: json.durable ? "Đã chấm và lưu kết quả bền vững trên máy chủ." : "Đã chấm trên máy chủ; kết quả chưa xác nhận lưu bền vững.",
      data: graded,
    };
  } catch (err: any) {
    return { success: false, durable: false, message: `Không thể gửi bài lên máy chủ: ${err?.message || "Lỗi mạng"}.` };
  }
}

/**
 * Fetches all student submissions from Cloud Database for a given exam or all exams.
 */
export async function fetchSubmissionsFromCloud(
  examCodeOrId?: string
): Promise<StudentSubmission[]> {
  try {
    const query = examCodeOrId ? `?examId=${encodeURIComponent(examCodeOrId)}` : "";
    const res = await fetchWithTimeout(`/api/submissions${query}`, { headers: getAdminHeaders() }, 8000);
    if (res.ok) {
      const json = await res.json();
      if (json?.success && Array.isArray(json.data)) return json.data as StudentSubmission[];
    }
  } catch (err) {
    console.warn("Secure submissions fetch failed:", err);
  }
  return [];
}

/**
 * Syncs Classrooms to Cloud Database so student devices can load class roster.
 */
export async function syncClassroomsToCloud(classrooms: Classroom[]): Promise<boolean> {
  try {
    const res = await fetchWithTimeout("/api/classrooms", {
      method: "PUT",
      headers: getAdminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(classrooms || []),
    }, 8000);
    const json = await res.json().catch(() => null);
    return Boolean(res.ok && json?.success && json?.durable);
  } catch {
    return false;
  }
}

export async function fetchClassroomsFromCloud(): Promise<Classroom[] | null> {
  try {
    const res = await fetchWithTimeout("/api/classrooms", { headers: getAdminHeaders() }, 8000);
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success && Array.isArray(json.data)) return json.data as Classroom[];
  } catch {}
  return null;
}

export async function syncAssignmentsToCloud(assignments: ClassAssignment[]): Promise<boolean> {
  try {
    const res = await fetchWithTimeout("/api/assignments", {
      method: "PUT",
      headers: getAdminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(assignments || []),
    }, 8000);
    const json = await res.json().catch(() => null);
    return Boolean(res.ok && json?.success && json?.durable);
  } catch {
    return false;
  }
}

export async function fetchAssignmentsFromCloud(): Promise<ClassAssignment[] | null> {
  try {
    const res = await fetchWithTimeout("/api/assignments", { headers: getAdminHeaders() }, 8000);
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success && Array.isArray(json.data)) return json.data as ClassAssignment[];
  } catch {}
  return null;
}

/**
 * Tests connection to the Cloud Database.
 */
export async function testCloudDatabaseConnection(_databaseUrlOverride?: string): Promise<{
  success: boolean;
  latencyMs: number;
  message: string;
}> {
  const start = performance.now();
  try {
    const statusRes = await fetchWithTimeout("/api/system-status", {}, 6000);
    const statusJson = await statusRes.json().catch(() => null);
    if (!statusRes.ok || !statusJson?.success) {
      const elapsed = Math.round(performance.now() - start);
      return { success: false, latencyMs: elapsed, message: `Backend phản hồi HTTP ${statusRes.status}.` };
    }
    if (!statusJson.adminTokenConfigured) {
      const elapsed = Math.round(performance.now() - start);
      return { success: false, latencyMs: elapsed, message: "Backend chưa cấu hình EDUTEST_ADMIN_TOKEN trên Vercel." };
    }
    if (!statusJson.durableExamStorageConfigured) {
      const elapsed = Math.round(performance.now() - start);
      const missing: string[] = [];
      const cfg = statusJson.firebaseAdmin || {};
      if (!cfg.databaseUrlConfigured) missing.push("FIREBASE_DATABASE_URL");
      if (!cfg.projectIdConfigured) missing.push("FIREBASE_PROJECT_ID");
      if (!cfg.clientEmailConfigured) missing.push("FIREBASE_CLIENT_EMAIL");
      if (!cfg.privateKeyConfigured) missing.push("FIREBASE_PRIVATE_KEY");
      return {
        success: false,
        latencyMs: elapsed,
        message: missing.length
          ? `Backend hoạt động nhưng Firebase Admin chưa đủ cấu hình trên Vercel. Còn thiếu: ${missing.join(", ")}.`
          : "Backend hoạt động nhưng Firebase Admin chưa sẵn sàng. Chưa nên phát QR thi production.",
      };
    }

    const firebaseRes = await fetchWithTimeout("/api/firebase-health", {
      method: "POST",
      headers: getAdminHeaders({ "Content-Type": "application/json" }),
    }, 10000);
    const elapsed = Math.round(performance.now() - start);
    const firebaseJson = await firebaseRes.json().catch(() => null);

    if (!firebaseRes.ok || !firebaseJson?.success) {
      const phase = firebaseJson?.phase ? ` (bước ${firebaseJson.phase})` : "";
      const hint = firebaseJson?.phase === "config"
        ? " Hãy cấu hình đủ FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL và FIREBASE_PRIVATE_KEY cho Preview."
        : "";
      return {
        success: false,
        latencyMs: elapsed,
        message: `${firebaseJson?.error || `Firebase kiểm tra thất bại HTTP ${firebaseRes.status}`}${firebaseJson?.detail ? ` Chi tiết: ${firebaseJson.detail}` : ""}${phase}.${hint}`,
      };
    }

    return {
      success: true,
      latencyMs: elapsed,
      message: `Backend và Firebase đã kiểm tra ghi/đọc/xóa dữ liệu thật thành công (${elapsed}ms).`,
    };
  } catch (err: any) {
    return {
      success: false,
      latencyMs: Math.round(performance.now() - start),
      message: `Không thể kiểm tra backend/Firebase production: ${err?.message || "Lỗi mạng"}.`,
    };
  }
}
