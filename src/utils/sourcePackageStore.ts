export interface SourcePackageMetadata {
  subject?: string;
  grade?: string;
  kind?: string;
  extractor?: string;
  embeddingCount?: number;
  formulaCount?: number;
  imageCount?: number;
  tableCount?: number;
  [key: string]: any;
}

export interface SourcePackageRecord {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  sha256?: string;
  createdAt: string;
  blob: Blob;
  metadata?: SourcePackageMetadata;
}

const DB_NAME = "edutest_source_packages";
const STORE_NAME = "source_packages";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Trình duyệt không hỗ trợ IndexedDB."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("fileName", "fileName", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Không thể mở IndexedDB."));
  });
}

async function sha256Hex(file: Blob): Promise<string | undefined> {
  try {
    if (!globalThis.crypto?.subtle) return undefined;
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return undefined;
  }
}

export async function saveSourcePackage(
  file: File,
  metadata: SourcePackageMetadata = {}
): Promise<SourcePackageRecord> {
  const sha256 = await sha256Hex(file);
  const stablePart = sha256?.slice(0, 20) || Math.random().toString(36).slice(2, 14);
  const id = `src_${stablePart}_${Date.now()}`;
  const record: SourcePackageRecord = {
    id,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    sha256,
    createdAt: new Date().toISOString(),
    blob: file.slice(0, file.size, file.type || "application/octet-stream"),
    metadata,
  };

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Không thể lưu file nguồn."));
    tx.onabort = () => reject(tx.error || new Error("Lưu file nguồn bị hủy."));
  });
  db.close();
  return record;
}

export async function getSourcePackage(id: string): Promise<SourcePackageRecord | null> {
  if (!id) return null;
  const db = await openDb();
  const result = await new Promise<SourcePackageRecord | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve((req.result as SourcePackageRecord) || null);
    req.onerror = () => reject(req.error || new Error("Không thể đọc file nguồn."));
  });
  db.close();
  return result;
}

export async function hasSourcePackage(id?: string): Promise<boolean> {
  if (!id) return false;
  try {
    return Boolean(await getSourcePackage(id));
  } catch {
    return false;
  }
}

export async function deleteSourcePackage(id: string): Promise<void> {
  if (!id) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Không thể xóa file nguồn."));
  });
  db.close();
}

export async function downloadSourcePackage(id: string): Promise<boolean> {
  const record = await getSourcePackage(id);
  if (!record) return false;
  const url = URL.createObjectURL(record.blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = record.fileName || "source-file";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function listSourcePackages(): Promise<SourcePackageRecord[]> {
  const db = await openDb();
  const result = await new Promise<SourcePackageRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve((req.result as SourcePackageRecord[]) || []);
    req.onerror = () => reject(req.error || new Error("Không thể liệt kê file nguồn."));
  });
  db.close();
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
