import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../config/env";

export type VpsMessage = {
  id: string;
  type: string;
  authorUid: string;
  phone: string;
  countryName: string;
  content: {
    senderName: string;
    message: string;
    recipientName?: string;
    [key: string]: unknown;
  };
  mediaUrl?: string;
  photoPath?: string;
  amount: number;
  paymentMethod?: string;
  paymentSessionId?: string;
  paymentStatus: string;
  moderationStatus: string;
  broadcast: boolean;
  fcmToken?: string;
  rejectReason?: string;
  moderatedBy?: string;
  createdAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  broadcastAt?: string;
};

const MESSAGES_DIR = () => path.join(env.VPS_DATA_DIR, "messages");
const AUDIT_DIR = () => path.join(env.VPS_DATA_DIR, "audit");

function messagePath(id: string) {
  return path.join(MESSAGES_DIR(), `${id}.json`);
}

export async function ensureVpsDirs() {
  await fs.mkdir(MESSAGES_DIR(), { recursive: true });
  await fs.mkdir(AUDIT_DIR(), { recursive: true });
}

export async function createMessage(
  input: Omit<VpsMessage, "id" | "createdAt" | "moderationStatus" | "broadcast" | "paymentStatus"> & {
    id?: string;
    moderationStatus?: string;
    paymentStatus?: string;
  }
): Promise<VpsMessage> {
  await ensureVpsDirs();
  const msg: VpsMessage = {
    id: input.id ?? randomUUID(),
    type: input.type,
    authorUid: input.authorUid,
    phone: input.phone,
    countryName: input.countryName,
    content: input.content,
    mediaUrl: input.mediaUrl,
    photoPath: input.photoPath,
    amount: input.amount,
    paymentMethod: input.paymentMethod,
    paymentSessionId: input.paymentSessionId,
    paymentStatus: input.paymentStatus ?? "paid",
    moderationStatus: input.moderationStatus ?? "queued",
    broadcast: false,
    fcmToken: input.fcmToken,
    createdAt: new Date().toISOString(),
  };
  await fs.writeFile(messagePath(msg.id), JSON.stringify(msg, null, 2), "utf8");
  return msg;
}

export async function getMessage(id: string): Promise<VpsMessage | null> {
  try {
    const raw = await fs.readFile(messagePath(id), "utf8");
    return JSON.parse(raw) as VpsMessage;
  } catch {
    return null;
  }
}

export async function updateMessage(id: string, patch: Partial<VpsMessage>): Promise<VpsMessage | null> {
  const current = await getMessage(id);
  if (!current) return null;
  const updated = { ...current, ...patch, id: current.id };
  await fs.writeFile(messagePath(id), JSON.stringify(updated, null, 2), "utf8");
  return updated;
}

export async function listMessagesByStatus(status: string, limit = 100): Promise<VpsMessage[]> {
  await ensureVpsDirs();
  let files: string[];
  try {
    files = await fs.readdir(MESSAGES_DIR());
  } catch {
    return [];
  }

  const messages: VpsMessage[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(MESSAGES_DIR(), file), "utf8");
      const msg = JSON.parse(raw) as VpsMessage;
      if (msg.moderationStatus === status) messages.push(msg);
    } catch {
      /* ignore corrupt file */
    }
  }

  messages.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return messages.slice(0, limit);
}

export async function listMessagesByPhone(phone: string, limit = 20): Promise<VpsMessage[]> {
  await ensureVpsDirs();
  let files: string[];
  try {
    files = await fs.readdir(MESSAGES_DIR());
  } catch {
    return [];
  }

  const messages: VpsMessage[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(MESSAGES_DIR(), file), "utf8");
      const msg = JSON.parse(raw) as VpsMessage;
      if (msg.phone === phone) messages.push(msg);
    } catch {
      /* ignore */
    }
  }

  messages.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return messages.slice(0, limit);
}

export async function getNextApprovedMessage(): Promise<VpsMessage | null> {
  const approved = await listMessagesByStatus("approved", 500);
  const pending = approved.filter((m) => !m.broadcast);
  pending.sort((a, b) => (a.approvedAt ?? a.createdAt).localeCompare(b.approvedAt ?? b.createdAt));
  return pending[0] ?? null;
}

export async function appendAudit(entry: Record<string, unknown>) {
  await ensureVpsDirs();
  const name = `${Date.now()}-${randomUUID().slice(0, 8)}.json`;
  await fs.writeFile(path.join(AUDIT_DIR(), name), JSON.stringify({ ...entry, at: new Date().toISOString() }, null, 2));
}
