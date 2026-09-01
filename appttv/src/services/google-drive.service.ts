import { Readable } from "node:stream";
import { google } from "googleapis";
import { env } from "../config/env";

function driveEnabled(): boolean {
  return env.GOOGLE_DRIVE_ENABLED && Boolean(env.GOOGLE_DRIVE_FOLDER_ID);
}

function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  return google.drive({ version: "v3", auth });
}

function guessExtension(mime: string, url: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  const m = url.match(/\.(jpe?g|png|gif|webp)(\?|$)/i);
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : "jpg";
}

export async function backupMessagePhotoToDrive(opts: {
  messageId: string;
  sourceUrl: string;
  fullName?: string;
  phone?: string;
}): Promise<string | null> {
  if (!driveEnabled()) return null;

  const sourceUrl = opts.sourceUrl.trim();
  if (!sourceUrl) return null;

  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) {
      console.warn(`[drive] téléchargement photo KO ${res.status} msg=${opts.messageId}`);
      return null;
    }

    const mime = res.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 16) {
      console.warn(`[drive] fichier trop petit msg=${opts.messageId}`);
      return null;
    }

    const safeName = (opts.fullName || "message")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .slice(0, 40);
    const phone = (opts.phone || "").replace(/\D+/g, "").slice(-9) || "sans-tel";
    const ext = guessExtension(mime, sourceUrl);
    const fileName = `${new Date().toISOString().slice(0, 10)}_${safeName}_${phone}_${opts.messageId.slice(0, 8)}.${ext}`;

    const drive = getDriveClient();
    const uploaded = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [env.GOOGLE_DRIVE_FOLDER_ID],
      },
      media: {
        mimeType: mime,
        body: Readable.from(buffer),
      },
      fields: "id, webViewLink, webContentLink",
    });

    const link = uploaded.data.webViewLink || uploaded.data.webContentLink || null;
    if (link) {
      console.log(`[drive] photo sauvegardée msg=${opts.messageId} file=${uploaded.data.id}`);
    }
    return link;
  } catch (e) {
    console.error(`[drive] erreur sauvegarde msg=${opts.messageId}`, e);
    return null;
  }
}
