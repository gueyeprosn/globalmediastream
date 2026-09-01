import "dotenv/config";
import path from "node:path";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Variable d'environnement manquante: ${name}`);
  return v;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  HOST: process.env.HOST ?? "127.0.0.1",
  PORT: Number(process.env.PORT ?? 3010),
  BASE_PATH: (process.env.BASE_PATH ?? "/appttv").replace(/\/+$/, "") || "/appttv",
  PUBLIC_BASE_URL: (process.env.PUBLIC_BASE_URL ?? "http://127.0.0.1:3010/appttv").replace(/\/+$/, ""),
  LIVE_HLS_URL: process.env.LIVE_HLS_URL ?? "https://stream.broadcastsn.com/toubatv/index.m3u8",
  VMIX_DS_TOKEN: process.env.VMIX_DS_TOKEN ?? "",
  FIREBASE_PROJECT_ID: required("FIREBASE_PROJECT_ID", "touba-tv-823d7"),
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  FIREBASE_API_KEY: process.env.FIREBASE_API_KEY ?? "",
  FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN ?? "touba-tv-823d7.firebaseapp.com",
  FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET ?? "touba-tv-823d7.firebasestorage.app",
  FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID ?? "68793261862",
  FIREBASE_WEB_APP_ID: process.env.FIREBASE_WEB_APP_ID ?? "",
  GOOGLE_DRIVE_ENABLED: process.env.GOOGLE_DRIVE_ENABLED === "true",
  GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID ?? "",
  /** Messages + photos sur disque VPS (recommandé). */
  VPS_STORAGE_ENABLED: process.env.VPS_STORAGE_ENABLED !== "false",
  VPS_DATA_DIR: process.env.VPS_DATA_DIR ?? path.resolve(process.cwd(), "data", "vps"),
};

export const isProduction = () => env.NODE_ENV === "production";
