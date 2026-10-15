export default async function handler(req: any, res: any) {
  const requestedPath = typeof req.query.__path === "string" ? req.query.__path : "";

  // Keep lightweight health checks independent from the full Express backend.
  // This lets Vercel report configuration/storage status even if another backend module fails to initialize.
  if (requestedPath === "system-status") {
    const firebaseUrl = String(process.env.FIREBASE_DATABASE_URL || "").trim();
    const adminToken = String(process.env.EDUTEST_ADMIN_TOKEN || "").trim();
    return res.status(200).json({
      success: true,
      secureServerGrading: true,
      durableExamStorageConfigured: Boolean(firebaseUrl),
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

    const databaseUrl = String(process.env.FIREBASE_DATABASE_URL || "").trim().replace(/\/+$/, "");
    if (!databaseUrl) {
      return res.status(503).json({ success: false, error: "Chưa cấu hình FIREBASE_DATABASE_URL trên Vercel." });
    }

    const firebaseAuth = String(process.env.FIREBASE_DATABASE_AUTH || "").trim();
    const authQuery = firebaseAuth ? `?auth=${encodeURIComponent(firebaseAuth)}` : "";
    const marker = {
      source: "edutest-pro-v16",
      nonce: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      createdAt: new Date().toISOString(),
    };
    const key = marker.nonce.replace(/[^A-Za-z0-9_-]/g, "_");
    const endpoint = `${databaseUrl}/healthChecks/${key}.json${authQuery}`;

    let writeOk = false;
    let readOk = false;
    let deleteOk = false;
    let firebaseStatus = 0;
    let firebaseMessage = "";

    try {
      const put = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(marker),
      });
      firebaseStatus = put.status;
      writeOk = put.ok;
      if (!put.ok) {
        firebaseMessage = (await put.text().catch(() => "")).slice(0, 500);
        return res.status(502).json({
          success: false,
          phase: "write",
          writeOk,
          readOk,
          deleteOk,
          firebaseStatus,
          authConfigured: Boolean(firebaseAuth),
          error: firebaseMessage || `Firebase từ chối ghi dữ liệu (HTTP ${put.status}).`,
        });
      }

      const get = await fetch(endpoint, { method: "GET" });
      firebaseStatus = get.status;
      if (get.ok) {
        const data = await get.json().catch(() => null);
        readOk = Boolean(data && data.nonce === marker.nonce && data.source === marker.source);
      } else {
        firebaseMessage = (await get.text().catch(() => "")).slice(0, 500);
      }

      const del = await fetch(endpoint, { method: "DELETE" });
      deleteOk = del.ok;

      if (!readOk) {
        return res.status(502).json({
          success: false,
          phase: "read",
          writeOk,
          readOk,
          deleteOk,
          firebaseStatus,
          authConfigured: Boolean(firebaseAuth),
          error: firebaseMessage || "Đã ghi được nhưng không đọc xác nhận lại đúng dữ liệu.",
        });
      }

      if (!deleteOk) {
        return res.status(502).json({
          success: false,
          phase: "cleanup",
          writeOk,
          readOk,
          deleteOk,
          firebaseStatus: del.status,
          authConfigured: Boolean(firebaseAuth),
          error: "Đọc/ghi thành công nhưng không xóa được bản ghi kiểm tra.",
        });
      }

      return res.status(200).json({
        success: true,
        writeOk,
        readOk,
        deleteOk,
        authConfigured: Boolean(firebaseAuth),
        message: "Firebase đã vượt qua kiểm tra ghi, đọc và xóa dữ liệu thật.",
      });
    } catch (err: any) {
      if (writeOk && !deleteOk) {
        try {
          const del = await fetch(endpoint, { method: "DELETE" });
          deleteOk = del.ok;
        } catch {}
      }
      return res.status(502).json({
        success: false,
        phase: "network",
        writeOk,
        readOk,
        deleteOk,
        authConfigured: Boolean(firebaseAuth),
        error: err?.message || "Không thể kết nối Firebase.",
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
