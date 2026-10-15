import { firebaseAdminConfigStatus, firebaseAdminHealthCheck } from "../src/server/firebaseAdmin";

export default async function handler(req: any, res: any) {
  const requestedPath = typeof req.query.__path === "string" ? req.query.__path : "";

  // Keep lightweight health checks independent from the full Express backend.
  // This lets Vercel report configuration/storage status even if another backend module fails to initialize.
  if (requestedPath === "system-status") {
    const adminToken = String(process.env.EDUTEST_ADMIN_TOKEN || "").trim();
    const firebaseAdmin = firebaseAdminConfigStatus();
    return res.status(200).json({
      success: true,
      secureServerGrading: true,
      durableExamStorageConfigured: firebaseAdmin.ready,
      firebaseAdminConfigured: firebaseAdmin.ready,
      firebaseAdmin,
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

    const result = await firebaseAdminHealthCheck();
    if (!result.success) {
      return res.status(result.phase === "config" ? 503 : 502).json(result);
    }
    return res.status(200).json(result);
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
