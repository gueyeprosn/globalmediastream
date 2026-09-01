import type { Request } from "express";
import { env } from "../config/env";

export function vmixTokenOk(req: Request): boolean {
  const token = env.VMIX_DS_TOKEN.trim();
  if (!token) return true;
  const q = typeof req.query.token === "string" ? req.query.token : "";
  const h = req.headers["x-vmix-token"];
  const headerToken = typeof h === "string" ? h : Array.isArray(h) ? h[0] : "";
  return q === token || headerToken === token;
}

export function vmixPublicUrls() {
  const base = env.PUBLIC_BASE_URL;
  const token = env.VMIX_DS_TOKEN.trim();
  const q = token ? `?token=${encodeURIComponent(token)}` : "";
  return {
    fifo: `${base}/api/vmix/datasource.xml${q}`,
    currentFile: `${base}/vmix/current.xml${q}`,
    message: (id: string) => `${base}/api/vmix/message/${encodeURIComponent(id)}.xml${q}`,
  };
}
