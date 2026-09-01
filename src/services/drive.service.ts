import { google } from "googleapis";
import { Readable } from "node:stream";
import { getStorage } from "firebase-admin/storage";
import { env } from "../config/env";

let driveClient: ReturnType<typeof google.drive> | null = null;

function getDrive() {
  if (!env.GOOGLE_DRIVE_ENABLED || !env.GOOGLE_DRIVE_FOLDER_ID) {
    return null;
  }
  if (!driveClient) {
    const auth = new google.auth.GoogleAuth({
      keyFile: env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });
    driveClient = google.drive({ version: "v3", auth });
  }
  return driveClient;
}

export type DriveBackupResult = {
  fileId: string;
  webViewLink: string;
  webContentLink?: string;
};

export async function uploadBufferToDrive(input: {
  buffer: Buffer;
  contentType: string;
  senderName: string;
  messageId?: string;
  authorUid?: string;
}): Promise<DriveBackupResult | null> {
  const drive = getDrive();
  if (!drive || !input.buffer.length) return null;

  try {
    const contentType = input.contentType || "image/jpeg";
    const ext = contentType.includes("png") ? "png" : "jpg";
    const safeName = input.senderName.replace(/[^\w\s-]/g, "").trim().slice(0, 40) || "dedicace";
    const idPart = input.messageId?.slice(0, 8) ?? input.authorUid?.slice(0, 8) ?? Date.now().toString(36);
    const fileName = `${new Date().toISOString().slice(0, 10)}_${safeName}_${idPart}.${ext}`;
    const description = input.messageId
      ? `Dédicace TOUBA TV — ${input.messageId}`
      : `Dédicace TOUBA TV — ${input.authorUid ?? "mobile"}`;

    const created = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [env.GOOGLE_DRIVE_FOLDER_ID],
        description,
      },
      media: {
        mimeType: contentType,
        body: Readable.from(input.buffer),
      },
      fields: "id, webViewLink, webContentLink",
    });

    const fileId = created.data.id;
    if (!fileId) return null;

    return {
      fileId,
      webViewLink: created.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`,
      webContentLink: created.data.webContentLink ?? undefined,
    };
  } catch (e) {
    console.error("[drive] upload failed", input.messageId ?? input.authorUid, e);
    return null;
  }
}

/** Copie une photo existante (Storage / URL) vers Drive — rétrocompat messages anciens. */
export async function backupPhotoToDrive(input: {
  messageId: string;
  mediaUrl: string;
  senderName: string;
  authorUid?: string;
}): Promise<DriveBackupResult | null> {
  if (!input.mediaUrl.trim()) return null;

  try {
    let buffer: Buffer;
    let contentType = "image/jpeg";

    const res = await fetch(input.mediaUrl);
    if (res.ok) {
      buffer = Buffer.from(await res.arrayBuffer());
      contentType = res.headers.get("content-type") ?? contentType;
    } else if (input.authorUid) {
      const downloaded = await downloadFromFirebaseStorage(input.authorUid, input.messageId);
      if (!downloaded) {
        console.warn("[drive] download failed", res.status, input.messageId);
        return null;
      }
      buffer = downloaded.buffer;
      contentType = downloaded.contentType;
    } else {
      console.warn("[drive] download failed", res.status, input.messageId);
      return null;
    }

    return uploadBufferToDrive({
      buffer,
      contentType,
      senderName: input.senderName,
      messageId: input.messageId,
      authorUid: input.authorUid,
    });
  } catch (e) {
    console.error("[drive] backup failed", input.messageId, e);
    return null;
  }
}

export function isDriveConfigured(): boolean {
  return Boolean(env.GOOGLE_DRIVE_ENABLED && env.GOOGLE_DRIVE_FOLDER_ID);
}

async function downloadFromFirebaseStorage(
  authorUid: string,
  messageId: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const bucket = getStorage().bucket();
    const [files] = await bucket.getFiles({ prefix: `messages/${authorUid}/${messageId}/` });
    const image = files.find((f) => /\.(jpe?g|png|webp)$/i.test(f.name) || f.name.includes("img_"));
    if (!image) return null;
    const [buf] = await image.download();
    const [meta] = await image.getMetadata();
    return {
      buffer: buf,
      contentType: (meta.contentType as string) ?? "image/jpeg",
    };
  } catch (e) {
    console.warn("[drive] storage fallback failed", messageId, e);
    return null;
  }
}
