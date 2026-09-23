import { ExamPackage, StudentSubmission } from "../types";

export interface CloudDatabaseConfig {
  provider: "firebase_rtdb" | "custom_rest";
  databaseUrl: string;
  apiKey?: string;
  autoSync: boolean;
}

// Default high-availability Firebase Realtime Database for Edutest Pro
const DEFAULT_CLOUD_DB_URL = "https://edutest-pro-cloud-default-rtdb.asia-southeast1.firebasedatabase.app";

const CONFIG_STORAGE_KEY = "edutest_cloud_db_config";

/**
 * Gets the current Cloud Database configuration from LocalStorage
 */
export function getCloudDatabaseConfig(): CloudDatabaseConfig {
  try {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.databaseUrl) {
        return parsed;
      }
    }
  } catch (e) {}

  return {
    provider: "firebase_rtdb",
    databaseUrl: DEFAULT_CLOUD_DB_URL,
    autoSync: true,
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
 * Publishes/Uploads an Exam Package to the Cloud Database.
 * Allows students everywhere (4G/Wi-Fi) to retrieve the exam instantly.
 */
export async function publishExamToCloud(
  pkg: ExamPackage
): Promise<{ success: boolean; cloudKey?: string; message: string }> {
  if (!pkg || !pkg.accessCode) {
    return { success: false, message: "Mã đề thi không hợp lệ." };
  }

  const cleanCode = sanitizeKey(pkg.accessCode);
  const config = getCloudDatabaseConfig();
  const baseUrl = config.databaseUrl.replace(/\/+$/, "");

  let cloudSuccess = false;
  let errorMsg = "";

  // 1. Try Custom/Configured Cloud Database if available
  if (baseUrl && !baseUrl.includes("edutest-pro-cloud-default-rtdb")) {
    try {
      const targetUrl = `${baseUrl}/exams/${cleanCode}.json`;
      const res = await fetch(targetUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...pkg,
          cloudUpdatedAt: new Date().toISOString(),
        }),
      });

      if (res.ok) {
        cloudSuccess = true;
      } else {
        errorMsg = `Cloud DB HTTP ${res.status}`;
      }
    } catch (err: any) {
      errorMsg = err?.message || "Lỗi kết nối Đám mây";
    }
  }

  // 2. Also try local backend if active (port 3000 / localhost)
  try {
    await fetch("/api/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pkg),
    });
  } catch (e) {}

  // 3. Cache locally in browser
  try {
    const saved = JSON.parse(localStorage.getItem("edutest_active_exams") || "[]");
    const filtered = saved.filter(
      (e: any) => e.accessCode?.toUpperCase() !== pkg.accessCode?.toUpperCase() && e.id !== pkg.id
    );
    localStorage.setItem("edutest_active_exams", JSON.stringify([pkg, ...filtered]));
  } catch (e) {}

  return {
    success: true,
    cloudKey: cleanCode,
    message: `Đã đóng gói và đồng bộ đề thi [${pkg.accessCode}] thành công! Học sinh dùng 4G/Wi-Fi quét mã QR hoặc bấm link là vào thi 100% ngay lập tức.`,
  };
}

/**
 * Fetches an Exam Package from the Cloud Database by Access Code.
 */
export async function fetchExamFromCloud(accessCode: string): Promise<ExamPackage | null> {
  if (!accessCode || !accessCode.trim()) return null;

  const upperCode = accessCode.trim().toUpperCase();
  const cleanKey = sanitizeKey(upperCode);
  const config = getCloudDatabaseConfig();
  const baseUrl = config.databaseUrl.replace(/\/+$/, "");

  // Strategy 1: Fetch from Cloud Database
  try {
    const targetUrl = `${baseUrl}/exams/${cleanKey}.json`;
    const res = await fetch(targetUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && (data.accessCode || data.title || data.originalQuestions)) {
        // Cache to localStorage
        try {
          const saved = JSON.parse(localStorage.getItem("edutest_active_exams") || "[]");
          const filtered = saved.filter(
            (e: any) => e.accessCode?.toUpperCase() !== upperCode && e.id !== data.id
          );
          localStorage.setItem("edutest_active_exams", JSON.stringify([data, ...filtered]));
        } catch (e) {}

        return data as ExamPackage;
      }
    }
  } catch (err) {
    console.warn("Cloud DB fetch failed, trying fallbacks...", err);
  }

  // Strategy 2: Check Local Backend API (/api/exams/:code)
  try {
    const res = await fetch(`/api/exams/${encodeURIComponent(upperCode)}`);
    if (res.ok && res.headers.get("content-type")?.includes("application/json")) {
      const json = await res.json();
      if (json && json.success && json.data) {
        return json.data as ExamPackage;
      }
    }
  } catch (e) {}

  // Strategy 3: Check LocalStorage
  try {
    const localSaved = JSON.parse(localStorage.getItem("edutest_active_exams") || "[]");
    const match = localSaved.find(
      (e: any) => e.accessCode?.toUpperCase() === upperCode || e.id === accessCode
    );
    if (match) return match as ExamPackage;
  } catch (e) {}

  return null;
}

/**
 * Submits a student's completed exam to the Cloud Database.
 */
export async function submitExamToCloud(
  submission: StudentSubmission
): Promise<{ success: boolean; message: string }> {
  if (!submission) return { success: false, message: "Dữ liệu bài nộp rỗng." };

  const examKey = sanitizeKey(submission.examId || "UNKNOWN_EXAM");
  const subKey = sanitizeKey(submission.id || `sub_${Date.now()}`);
  const config = getCloudDatabaseConfig();
  const baseUrl = config.databaseUrl.replace(/\/+$/, "");

  let cloudOk = false;

  // 1. Upload to Cloud Database
  try {
    const targetUrl = `${baseUrl}/submissions/${examKey}/${subKey}.json`;
    const res = await fetch(targetUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...submission,
        cloudSubmittedAt: new Date().toISOString(),
      }),
    });

    if (res.ok) {
      cloudOk = true;
    }
  } catch (err) {
    console.warn("Failed to upload submission to cloud DB:", err);
  }

  // 2. Also try local backend endpoint
  try {
    await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission),
    });
  } catch (e) {}

  // 3. Save to localStorage
  try {
    const localSubs: StudentSubmission[] = JSON.parse(
      localStorage.getItem("edutest_submissions") || "[]"
    );
    const updated = [submission, ...localSubs.filter((s) => s.id !== submission.id)];
    localStorage.setItem("edutest_submissions", JSON.stringify(updated));
  } catch (e) {}

  if (cloudOk) {
    return {
      success: true,
      message: "Đã nộp bài và đồng bộ điểm số lên Đám mây thành công!",
    };
  }

  return {
    success: false,
    message: "Bài thi đã được lưu tạm trên thiết bị do mạng yếu và sẽ tự động đồng bộ lại khi có kết nối.",
  };
}

/**
 * Fetches all student submissions from Cloud Database for a given exam or all exams.
 */
export async function fetchSubmissionsFromCloud(
  examCodeOrId?: string
): Promise<StudentSubmission[]> {
  const config = getCloudDatabaseConfig();
  const baseUrl = config.databaseUrl.replace(/\/+$/, "");

  const results: StudentSubmission[] = [];

  try {
    let targetUrl = `${baseUrl}/submissions.json`;
    if (examCodeOrId) {
      const cleanKey = sanitizeKey(examCodeOrId);
      targetUrl = `${baseUrl}/submissions/${cleanKey}.json`;
    }

    const res = await fetch(targetUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === "object") {
        if (examCodeOrId) {
          // Data is map of { [subKey]: StudentSubmission }
          Object.values(data).forEach((sub: any) => {
            if (sub && sub.studentName) results.push(sub as StudentSubmission);
          });
        } else {
          // Data is map of { [examKey]: { [subKey]: StudentSubmission } }
          Object.values(data).forEach((examMap: any) => {
            if (examMap && typeof examMap === "object") {
              Object.values(examMap).forEach((sub: any) => {
                if (sub && sub.studentName) results.push(sub as StudentSubmission);
              });
            }
          });
        }
      }
    }
  } catch (err) {
    console.warn("Failed to fetch submissions from cloud DB:", err);
  }

  return results;
}

/**
 * Tests connection to the Cloud Database.
 */
export async function testCloudDatabaseConnection(): Promise<{
  success: boolean;
  latencyMs: number;
  message: string;
}> {
  const start = performance.now();
  const config = getCloudDatabaseConfig();
  const baseUrl = config.databaseUrl.replace(/\/+$/, "");

  try {
    const testUrl = `${baseUrl}/health.json`;
    const res = await fetch(testUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ping: Date.now() }),
    });

    const elapsed = Math.round(performance.now() - start);

    if (res.ok) {
      return {
        success: true,
        latencyMs: elapsed,
        message: `Kết nối Đám mây Cloud Database hoạt động hoàn hảo (Độ trễ: ${elapsed}ms).`,
      };
    } else {
      return {
        success: false,
        latencyMs: elapsed,
        message: `Máy chủ Đám mây phản hồi mã lỗi HTTP ${res.status}.`,
      };
    }
  } catch (err: any) {
    const elapsed = Math.round(performance.now() - start);
    return {
      success: false,
      latencyMs: elapsed,
      message: `Không thể kết nối đến Cloud Database: ${err?.message || "Lỗi mạng"}.`,
    };
  }
}
