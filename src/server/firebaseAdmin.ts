import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getDatabase, type Database } from "firebase-admin/database";

const DATABASE_URL = String(process.env.FIREBASE_DATABASE_URL || "").trim().replace(/\/+$/, "");
const PROJECT_ID = String(process.env.FIREBASE_PROJECT_ID || "").trim();
const CLIENT_EMAIL = String(process.env.FIREBASE_CLIENT_EMAIL || "").trim();
const PRIVATE_KEY = String(process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();

export function firebaseAdminConfigStatus() {
  return {
    databaseUrlConfigured: Boolean(DATABASE_URL),
    projectIdConfigured: Boolean(PROJECT_ID),
    clientEmailConfigured: Boolean(CLIENT_EMAIL),
    privateKeyConfigured: Boolean(PRIVATE_KEY),
    ready: Boolean(DATABASE_URL && PROJECT_ID && CLIENT_EMAIL && PRIVATE_KEY),
  };
}

function getAdminApp(): App {
  const status = firebaseAdminConfigStatus();
  if (!status.ready) {
    throw new Error("Firebase Admin chưa đủ cấu hình FIREBASE_DATABASE_URL, FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.");
  }
  const existing = getApps()[0];
  if (existing) return existing;
  return initializeApp({
    credential: cert({
      projectId: PROJECT_ID,
      clientEmail: CLIENT_EMAIL,
      privateKey: PRIVATE_KEY,
    }),
    databaseURL: DATABASE_URL,
  });
}

export function getFirebaseAdminDatabase(): Database {
  return getDatabase(getAdminApp());
}

export async function adminPut(pathname: string, value: unknown): Promise<void> {
  const db = getFirebaseAdminDatabase();
  await db.ref(pathname.replace(/^\/+/, "")).set(value);
}

export async function adminGet<T = any>(pathname: string): Promise<T | null> {
  const db = getFirebaseAdminDatabase();
  const snap = await db.ref(pathname.replace(/^\/+/, "")).get();
  return snap.exists() ? (snap.val() as T) : null;
}

export async function adminDelete(pathname: string): Promise<void> {
  const db = getFirebaseAdminDatabase();
  await db.ref(pathname.replace(/^\/+/, "")).remove();
}

export async function firebaseAdminHealthCheck() {
  const status = firebaseAdminConfigStatus();
  if (!status.ready) {
    return {
      success: false,
      phase: "config",
      ...status,
      error: "Thiếu biến môi trường Firebase Admin trên Vercel.",
    };
  }

  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const key = nonce.replace(/[^A-Za-z0-9_-]/g, "_");
  const path = `healthChecks/${key}`;
  const marker = {
    source: "edutest-pro-v16-admin",
    nonce,
    createdAt: new Date().toISOString(),
  };

  let writeOk = false;
  let readOk = false;
  let deleteOk = false;

  try {
    await adminPut(path, marker);
    writeOk = true;

    const readBack = await adminGet<any>(path);
    readOk = Boolean(readBack && readBack.nonce === nonce && readBack.source === marker.source);
    if (!readOk) {
      return {
        success: false,
        phase: "read",
        writeOk,
        readOk,
        deleteOk,
        error: "Firebase Admin ghi được nhưng dữ liệu đọc lại không khớp.",
      };
    }

    await adminDelete(path);
    deleteOk = true;

    return {
      success: true,
      writeOk,
      readOk,
      deleteOk,
      authMode: "firebase-admin-sdk",
      message: "Firebase Admin SDK đã ghi, đọc và xóa dữ liệu thật thành công.",
    };
  } catch (err: any) {
    if (writeOk && !deleteOk) {
      try {
        await adminDelete(path);
        deleteOk = true;
      } catch {}
    }
    return {
      success: false,
      phase: writeOk ? (readOk ? "cleanup" : "read") : "write",
      writeOk,
      readOk,
      deleteOk,
      authMode: "firebase-admin-sdk",
      error: err?.message || "Firebase Admin SDK không thể truy cập Realtime Database.",
    };
  }
}
