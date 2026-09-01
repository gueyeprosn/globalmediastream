import cors from "cors";
import express from "express";
import morgan from "morgan";
import path from "node:path";
import { env, isProduction } from "./config/env";
import { initFirebase } from "./firebase";
import adminRoutes from "./routes/admin.routes";
import configRoutes from "./routes/config.routes";
import messagesRoutes from "./routes/messages.routes";
import vmixRoutes, { handleCurrentXmlFile } from "./routes/vmix.routes";
import { refreshCurrentXmlFile } from "./services/messages.service";
import { refreshVpsCurrentXml } from "./services/vps-messages.service";
import { uploadsDirectory } from "./services/local-files.service";
import { startDrivePhotoWatcher } from "./services/drive-sync.service";

const BASE = env.BASE_PATH;
const app = express();

if (!isProduction()) {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
  app.set("trust proxy", 1);
}

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

try {
  initFirebase();
  console.log(`[appttv] Firebase project=${env.FIREBASE_PROJECT_ID}`);
} catch (e) {
  console.error("[appttv] Firebase init failed:", e);
}

const mount = express.Router();

mount.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "touba-tv-appttv",
    basePath: BASE,
    publicUrl: env.PUBLIC_BASE_URL,
    vpsStorage: env.VPS_STORAGE_ENABLED,
  });
});

mount.get("/firebase-config.js", (_req, res) => {
  res.type("application/javascript").send(`
window.__FIREBASE_CONFIG__ = {
  apiKey: ${JSON.stringify(env.FIREBASE_API_KEY)},
  authDomain: ${JSON.stringify(env.FIREBASE_AUTH_DOMAIN)},
  projectId: ${JSON.stringify(env.FIREBASE_PROJECT_ID)},
  storageBucket: ${JSON.stringify(env.FIREBASE_STORAGE_BUCKET)},
  messagingSenderId: ${JSON.stringify(env.FIREBASE_MESSAGING_SENDER_ID)},
  appId: ${JSON.stringify(env.FIREBASE_WEB_APP_ID)}
};
window.__APP_BASE__ = ${JSON.stringify(BASE)};
`);
});

mount.use("/api/vmix", vmixRoutes);
mount.get("/vmix/current.xml", handleCurrentXmlFile);
mount.use("/uploads", express.static(uploadsDirectory(), { maxAge: "7d", etag: true }));
mount.use("/api/messages", messagesRoutes);
mount.use("/api/admin", adminRoutes);
mount.use("/api/config", configRoutes);

mount.use(express.static(path.resolve(process.cwd(), "public")));

mount.get("/", (_req, res) => {
  res.sendFile(path.resolve(process.cwd(), "public", "index.html"));
});

app.use(BASE, mount);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : "Erreur serveur";
  console.error("[appttv]", err);
  res.status(500).json({ success: false, message });
});

const server = app.listen(env.PORT, env.HOST, () => {
  console.log(`[appttv] http://${env.HOST}:${env.PORT}${BASE}`);
  console.log(`[appttv] public=${env.PUBLIC_BASE_URL}`);
  void (env.VPS_STORAGE_ENABLED ? refreshVpsCurrentXml() : refreshCurrentXmlFile()).catch((e) =>
    console.warn("[appttv] vmix xml init", e)
  );
  startDrivePhotoWatcher();
});

process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT", () => server.close(() => process.exit(0)));
