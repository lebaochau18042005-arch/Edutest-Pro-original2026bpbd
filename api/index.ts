import app from "../server";

export default async function handler(req: any, res: any) {
  const requestedPath = typeof req.query.__path === "string" ? req.query.__path : "";
  if (requestedPath) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (key === "__path") continue;
      if (Array.isArray(value)) value.forEach(v => query.append(key, String(v)));
      else if (value !== undefined) query.append(key, String(value));
    }
    req.url = `/api/${requestedPath}${query.toString() ? `?${query.toString()}` : ""}`;
  }
  return app(req as any, res as any);
}
