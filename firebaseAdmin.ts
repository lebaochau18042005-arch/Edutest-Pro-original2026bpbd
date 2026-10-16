import { createSign } from "node:crypto";

const DATABASE_URL = String(process.env.FIREBASE_DATABASE_URL || "").trim().replace(/\/+$/, "");
const PROJECT_ID = String(process.env.FIREBASE_PROJECT_ID || "").trim();
const CLIENT_EMAIL = String(process.env.FIREBASE_CLIENT_EMAIL || "").trim();
const PRIVATE_KEY = String(process.env.FIREBASE_PRIVATE_KEY || "")
  .trim()
  .replace(/^"(.*)"$/s, "$1")
  .replace(/\\n/g, "\n")
  .replace(/-----BEGIN_PRIVATE_KEY-----/g, "-----BEGIN PRIVATE KEY-----")
  .replace(/-----END_PRIVATE_KEY-----/g, "-----END PRIVATE KEY-----")
  .trim();

let cachedAccessToken = "";
let cachedAccessTokenExp = 0;

export function firebaseAdminConfigStatus() {
  return {
    databaseUrlConfigured: Boolean(DATABASE_URL),
    projectIdConfigured: Boolean(PROJECT_ID),
    clientEmailConfigured: Boolean(CLIENT_EMAIL),
    privateKeyConfigured: Boolean(PRIVATE_KEY),
    ready: Boolean(DATABASE_URL && PROJECT_ID && CLIENT_EMAIL && PRIVATE_KEY),
  };
}

function base64Url(input: string | Buffer): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getServiceAccountAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessTokenExp - 60 > now) return cachedAccessToken;

  const status = firebaseAdminConfigStatus();
  if (!status.ready) {
    throw new Error("Firebase server auth chưa đủ FIREBASE_DATABASE_URL, FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.");
  }

  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(PRIVATE_KEY);
  const assertion = `${unsigned}.${base64Url(signature)}`;

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const tokenJson: any = await tokenRes.json().catch(() => null);
  if (!tokenRes.ok || !tokenJson?.access_token) {
    throw new Error(tokenJson?.error_description || tokenJson?.error || `Không lấy được OAuth access token (HTTP ${tokenRes.status}).`);
  }

  cachedAccessToken = String(tokenJson.access_token);
  cachedAccessTokenExp = now + Number(tokenJson.expires_in || 3600);
  return cachedAccessToken;
}

async function firebaseRest(pathname: string, init: RequestInit): Promise<Response> {
  const token = await getServiceAccountAccessToken();
  const url = `${DATABASE_URL}/${pathname.replace(/^\/+/, "")}.json`;
  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}

export async function adminPut(pathname: string, value: unknown): Promise<void> {
  const r = await firebaseRest(pathname, { method: "PUT", body: JSON.stringify(value) });
  if (!r.ok) throw new Error(`Firebase ghi thất bại HTTP ${r.status}: ${(await r.text().catch(() => "")).slice(0, 300)}`);
}

export async function adminGet<T = any>(pathname: string): Promise<T | null> {
  const r = await firebaseRest(pathname, { method: "GET" });
  if (!r.ok) throw new Error(`Firebase đọc thất bại HTTP ${r.status}: ${(await r.text().catch(() => "")).slice(0, 300)}`);
  const data = await r.json().catch(() => null);
  return data ?? null;
}

export async function adminDelete(pathname: string): Promise<void> {
  const r = await firebaseRest(pathname, { method: "DELETE" });
  if (!r.ok) throw new Error(`Firebase xóa thất bại HTTP ${r.status}: ${(await r.text().catch(() => "")).slice(0, 300)}`);
}

export async function firebaseAdminHealthCheck() {
  const status = firebaseAdminConfigStatus();
  if (!status.ready) return { success: false, phase: "config", ...status, error: "Thiếu biến môi trường Firebase server auth trên Vercel." };

  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const key = nonce.replace(/[^A-Za-z0-9_-]/g, "_");
  const path = `healthChecks/${key}`;
  const marker = { source: "edutest-pro-v16-service-account-oauth", nonce, createdAt: new Date().toISOString() };

  let writeOk = false, readOk = false, deleteOk = false;
  try {
    await adminPut(path, marker); writeOk = true;
    const readBack = await adminGet<any>(path);
    readOk = Boolean(readBack && readBack.nonce === nonce && readBack.source === marker.source);
    if (!readOk) return { success: false, phase: "read", writeOk, readOk, deleteOk, error: "Ghi được nhưng dữ liệu đọc lại không khớp." };
    await adminDelete(path); deleteOk = true;
    return {
      success: true, writeOk, readOk, deleteOk,
      authMode: "service-account-oauth2",
      message: "Service Account OAuth2 đã ghi, đọc và xóa Firebase thành công.",
    };
  } catch (err: any) {
    if (writeOk && !deleteOk) { try { await adminDelete(path); deleteOk = true; } catch {} }
    return {
      success: false,
      phase: writeOk ? (readOk ? "cleanup" : "read") : "write",
      writeOk, readOk, deleteOk,
      authMode: "service-account-oauth2",
      error: err?.message || "Không thể truy cập Firebase bằng Service Account OAuth2.",
    };
  }
}
