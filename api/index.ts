export default async function handler(req: any, res: any) {
  const requestedPath = typeof req.query.__path === "string" ? req.query.__path : "";

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
      const mod = await import("./firebaseAdmin");
      const result = await mod.firebaseAdminHealthCheck();
      if (!result.success) {
        return res.status(result.phase === "config" ? 503 : 502).json(result);
      }
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        phase: "admin-sdk-load",
        error: "Không tải được Firebase Admin SDK trên Vercel.",
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
