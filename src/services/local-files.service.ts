import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../config/env";

const UPLOADS_DIR = () => path.join(env.VPS_DATA_DIR, "uploads");

export function publicUploadUrl(relativePath: string): string {
  const clean = relativePath.replace(/^\/+/, "");
  return `${env.PUBLIC_BASE_URL}/uploads/${clean}`;
}

export async function savePhotoBuffer(input: {
  buffer: Buffer;
  contentType: string;
  messageId?: string;
}): Promise<{ relativePath: string; mediaUrl: string; fileName: string }> {
  const ext = input.contentType.includes("png") ? "png" : "jpg";
  const id = input.messageId ?? randomUUID();
  const fileName = `${id}.${ext}`;
  const dir = UPLOADS_DIR();
  await fs.mkdir(dir, { recursive: true });
  const fullPath = path.join(dir, fileName);
  await fs.writeFile(fullPath, input.buffer);
  const relativePath = fileName;
  return {
    relativePath,
    fileName,
    mediaUrl: publicUploadUrl(relativePath),
  };
}

export async function readPhotoBuffer(relativePath: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(UPLOADS_DIR(), relativePath));
  } catch {
    return null;
  }
}

export function uploadsDirectory(): string {
  return UPLOADS_DIR();
}
