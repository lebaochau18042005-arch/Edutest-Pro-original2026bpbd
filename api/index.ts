export default async function handler(req: any, res: any) {
  const requestedPath = typeof req.query.__path === "string" ? req.query.__path : "";

  // Keep the production health check independent from the full Express backend.
  // This lets Vercel report configuration status even if another backend module fails to initialize.
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
