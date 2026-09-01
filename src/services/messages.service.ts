import fs from "node:fs/promises";
import path from "node:path";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { env } from "../config/env";
import { getDb } from "../firebase";
import { backupPhotoToDrive } from "./drive.service";
import { buildXmlFields } from "../utils/xml";
import {
  approveVpsMessage,
  broadcastVpsMessage,
  consumeVpsFifoMessage,
  getVpsMessageById,
  listVpsMessages,
  refreshVpsCurrentXml,
  rejectVpsMessage,
  buildVmixXmlForVpsMessage,
} from "./vps-messages.service";

export type FirestoreMessage = {
  id: string;
  type: string;
  authorUid: string;
  phone: string;
  content: Record<string, unknown>;
  mediaUrl?: string;
  firebaseMediaUrl?: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  amount: number;
  paymentMethod?: string;
  paymentStatus: string;
  moderationStatus: string;
  broadcast?: boolean;
  countryCode?: string;
  countryName?: string;
  fcmToken?: string;
  rejectReason?: string;
  createdAt?: Timestamp;
  approvedAt?: Timestamp;
};

export type MessageDto = {
  id: string;
  type: string;
  fullName: string;
  phone: string;
  country: string;
  text: string;
  amount: number;
  paymentMethod: string;
  status: string;
  mediaUrl: string;
  createdAt: string | null;
  rejectReason: string;
  driveWebViewLink: string;
  paymentMethodLabel: string;
};

const STATUS_MAP: Record<string, string> = {
  queued: "queued",
  approved: "approved",
  rejected: "rejected",
  broadcast: "broadcast",
};

export function paymentMethodLabel(raw: string): string {
  switch (raw.toLowerCase()) {
    case "wave":
      return "Wave";
    case "orange":
    case "orange_money":
      return "Orange Money";
    case "free":
      return "Gratuit (démo)";
    default:
      return raw || "—";
  }
}

export function toDto(id: string, data: Record<string, unknown>): MessageDto {
  const content = (data.content as Record<string, unknown>) ?? {};
  const createdAt = data.createdAt as Timestamp | undefined;
  const paymentMethod = String(data.paymentMethod ?? "");
  return {
    id,
    type: String(data.type ?? ""),
    fullName: String(content.senderName ?? ""),
    phone: String(data.phone ?? ""),
    country: String(data.countryName ?? ""),
    text: String(content.message ?? ""),
    amount: Number(data.amount ?? 0),
    paymentMethod,
    paymentMethodLabel: paymentMethodLabel(paymentMethod),
    status: String(data.moderationStatus ?? ""),
    mediaUrl: String(data.mediaUrl ?? ""),
    createdAt: createdAt?.toDate?.()?.toISOString() ?? null,
    rejectReason: String(data.rejectReason ?? ""),
    driveWebViewLink: String(data.driveWebViewLink ?? ""),
  };
}

export function buildVmixFieldsFromMessage(msg: FirestoreMessage) {
  const content = msg.content ?? {};
  const photoUrl =
    msg.driveWebViewLink?.trim() ||
    msg.mediaUrl?.trim() ||
    String(content.photoUrl ?? "");
  return [
    { name: "Nom", value: String(content.senderName ?? "") },
    { name: "Destinataire", value: String(content.recipientName ?? "") },
    { name: "Message", value: String(content.message ?? "") },
    { name: "Categorie", value: msg.type },
    { name: "Pays", value: msg.countryName ?? "" },
    { name: "Indicatif", value: msg.countryCode ?? "" },
    { name: "Telephone", value: msg.phone },
    { name: "Montant", value: `${msg.amount} FCFA` },
    { name: "PaymentMethod", value: msg.paymentMethod ?? "" },
    { name: "Photo", value: photoUrl },
    { name: "PhotoDrive", value: msg.driveWebViewLink ?? "" },
    { name: "PhotoBase64", value: "" },
    { name: "Timestamp", value: new Date().toLocaleString("fr-FR") },
  ];
}

export function buildPlaceholderXml() {
  return buildXmlFields([
    { name: "Nom", value: "En attente..." },
    { name: "Message", value: "" },
    { name: "Categorie", value: "" },
    { name: "Pays", value: "" },
    { name: "Indicatif", value: "" },
    { name: "Photo", value: "" },
    { name: "PhotoBase64", value: "" },
  ]);
}

export function buildVmixXmlForMessage(msg: FirestoreMessage) {
  return buildXmlFields(buildVmixFieldsFromMessage(msg));
}

function docToMessage(id: string, data: Record<string, unknown>): FirestoreMessage {
  return {
    id,
    type: String(data.type ?? ""),
    authorUid: String(data.authorUid ?? ""),
    phone: String(data.phone ?? ""),
    content: (data.content as Record<string, unknown>) ?? {},
    mediaUrl: data.mediaUrl as string | undefined,
    firebaseMediaUrl: data.firebaseMediaUrl as string | undefined,
    driveFileId: data.driveFileId as string | undefined,
    driveWebViewLink: data.driveWebViewLink as string | undefined,
    amount: Number(data.amount ?? 0),
    paymentMethod: data.paymentMethod as string | undefined,
    paymentStatus: String(data.paymentStatus ?? ""),
    moderationStatus: String(data.moderationStatus ?? ""),
    broadcast: data.broadcast === true,
    countryCode: data.countryCode as string | undefined,
    countryName: data.countryName as string | undefined,
    fcmToken: data.fcmToken as string | undefined,
    rejectReason: data.rejectReason as string | undefined,
    createdAt: data.createdAt as Timestamp | undefined,
    approvedAt: data.approvedAt as Timestamp | undefined,
  };
}

export async function listMessages(status: string): Promise<MessageDto[]> {
  if (env.VPS_STORAGE_ENABLED) {
    return listVpsMessages(status);
  }
  const firestoreStatus = STATUS_MAP[status] ?? status;
  const db = getDb();
  const snap = await db
    .collection("messages")
    .where("moderationStatus", "==", firestoreStatus)
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();

  return snap.docs.map((d) => {
    void tryDriveBackup(d.id, d.data());
    return toDto(d.id, d.data());
  });
}

export async function getNextApprovedMessage(): Promise<FirestoreMessage | null> {
  if (env.VPS_STORAGE_ENABLED) {
    const { getNextApprovedMessage: getNextVps } = await import("./vps-store.service");
    const msg = await getNextVps();
    if (!msg) return null;
    return docToMessage(msg.id, {
      type: msg.type,
      authorUid: msg.authorUid,
      phone: msg.phone,
      content: msg.content,
      mediaUrl: msg.mediaUrl,
      amount: msg.amount,
      paymentMethod: msg.paymentMethod,
      paymentStatus: msg.paymentStatus,
      moderationStatus: msg.moderationStatus,
      broadcast: msg.broadcast,
      countryName: msg.countryName,
      fcmToken: msg.fcmToken,
      createdAt: { toDate: () => new Date(msg.createdAt) },
      approvedAt: msg.approvedAt ? { toDate: () => new Date(msg.approvedAt!) } : undefined,
    });
  }
  const db = getDb();
  const snap = await db
    .collection("messages")
    .where("moderationStatus", "==", "approved")
    .where("broadcast", "==", false)
    .orderBy("approvedAt", "asc")
    .limit(1)
    .get();

  if (snap.empty) return null;
  const doc = snap.docs[0];
  return docToMessage(doc.id, doc.data());
}

export async function getMessageById(id: string): Promise<FirestoreMessage | null> {
  if (env.VPS_STORAGE_ENABLED) {
    const msg = await getVpsMessageById(id);
    if (!msg) return null;
    return docToMessage(msg.id, {
      type: msg.type,
      authorUid: msg.authorUid,
      phone: msg.phone,
      content: msg.content,
      mediaUrl: msg.mediaUrl,
      amount: msg.amount,
      paymentMethod: msg.paymentMethod,
      paymentStatus: msg.paymentStatus,
      moderationStatus: msg.moderationStatus,
      broadcast: msg.broadcast,
      countryName: msg.countryName,
      fcmToken: msg.fcmToken,
      rejectReason: msg.rejectReason,
      createdAt: { toDate: () => new Date(msg.createdAt) },
      approvedAt: msg.approvedAt ? { toDate: () => new Date(msg.approvedAt!) } : undefined,
    });
  }
  const doc = await getDb().collection("messages").doc(id).get();
  if (!doc.exists) return null;
  return docToMessage(doc.id, doc.data()!);
}

export async function markBroadcast(msg: FirestoreMessage, adminUid?: string) {
  const ref = getDb().collection("messages").doc(msg.id);
  await ref.update({
    broadcast: true,
    broadcastReady: true,
    moderationStatus: "broadcast",
    broadcastAt: FieldValue.serverTimestamp(),
    ...(adminUid ? { broadcastBy: adminUid } : {}),
  });
  await recordAlert(msg, "Message diffusé", "Votre message vient d'être diffusé à l'antenne TOUBA TV.", "MESSAGE_BROADCAST");
  if (adminUid) await audit("MESSAGE_BROADCAST", msg.id, adminUid);
}

export async function backupMessagePhotoToDrive(messageId: string): Promise<{ success: boolean; link?: string }> {
  const ref = getDb().collection("messages").doc(messageId);
  const snap = await ref.get();
  if (!snap.exists) return { success: false };

  const data = snap.data()!;
  if (data.driveFileId) {
    return { success: true, link: String(data.driveWebViewLink ?? "") };
  }

  const mediaUrl = String(data.mediaUrl ?? "").trim();
  if (!mediaUrl) return { success: false };

  const content = (data.content as Record<string, unknown>) ?? {};
  const senderName = String(content.senderName ?? "dedicace");
  const result = await backupPhotoToDrive({
    messageId,
    mediaUrl,
    senderName,
    authorUid: String(data.authorUid ?? ""),
  });
  if (!result) return { success: false };

  const canonicalPhoto =
    result.webContentLink?.trim() || result.webViewLink?.trim() || mediaUrl;

  await ref.update({
    driveFileId: result.fileId,
    driveWebViewLink: result.webViewLink,
    driveBackedUpAt: FieldValue.serverTimestamp(),
    firebaseMediaUrl: data.firebaseMediaUrl ?? data.mediaUrl ?? null,
    mediaUrl: canonicalPhoto,
  });

  return { success: true, link: result.webViewLink };
}

async function tryDriveBackup(messageId: string, data: Record<string, unknown>) {
  if (data.driveFileId || !String(data.mediaUrl ?? "").trim()) return;
  void backupMessagePhotoToDrive(messageId).catch((e) => console.warn("[drive] async", messageId, e));
}

export async function approveMessage(messageId: string, adminUid: string) {
  if (env.VPS_STORAGE_ENABLED) {
    await approveVpsMessage(messageId, adminUid);
    return;
  }
  const ref = getDb().collection("messages").doc(messageId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Message introuvable");
  const data = snap.data()!;
  if (data.moderationStatus !== "queued") throw new Error("Message déjà traité");

  await ref.update({
    moderationStatus: "approved",
    broadcastReady: true,
    approvedAt: FieldValue.serverTimestamp(),
    moderatedBy: adminUid,
  });

  const msg = docToMessage(messageId, { ...data, moderationStatus: "approved" });
  await recordAlert(msg, "Message approuvé", `Votre ${msg.type} a été validé par la rédaction TOUBA TV.`, "MESSAGE_APPROVED");
  await audit("MESSAGE_APPROVED", messageId, adminUid);
  await tryDriveBackup(messageId, data);
  await refreshCurrentXmlFile();
}

export async function rejectMessage(messageId: string, adminUid: string, reason: string) {
  if (env.VPS_STORAGE_ENABLED) {
    await rejectVpsMessage(messageId, adminUid, reason);
    return;
  }
  const ref = getDb().collection("messages").doc(messageId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Message introuvable");
  const data = snap.data()!;
  if (data.moderationStatus !== "queued") throw new Error("Message déjà traité");

  await ref.update({
    moderationStatus: "rejected",
    rejectReason: reason,
    moderatedBy: adminUid,
    rejectedAt: FieldValue.serverTimestamp(),
  });

  const msg = docToMessage(messageId, data);
  await recordAlert(msg, "Message refusé", `Votre message a été refusé (${reason}).`, "MESSAGE_REJECTED");
  await audit("MESSAGE_REJECTED", messageId, adminUid, { reason });
}

export async function broadcastMessage(messageId: string, adminUid: string) {
  if (env.VPS_STORAGE_ENABLED) {
    await broadcastVpsMessage(messageId, adminUid);
    return;
  }
  const msg = await getMessageById(messageId);
  if (!msg) throw new Error("Message introuvable");
  if (msg.moderationStatus !== "approved" || msg.broadcast) {
    throw new Error("Message non prêt pour diffusion");
  }
  await markBroadcast(msg, adminUid);
  await writeCurrentXmlFile(buildVmixXmlForMessage(msg));
}

export async function consumeFifoMessage(): Promise<{ xml: string; messageId: string | null }> {
  if (env.VPS_STORAGE_ENABLED) {
    return consumeVpsFifoMessage();
  }
  const msg = await getNextApprovedMessage();
  if (!msg) {
    await writeCurrentXmlFile(buildPlaceholderXml());
    return { xml: buildPlaceholderXml(), messageId: null };
  }
  const xml = buildVmixXmlForMessage(msg);
  await markBroadcast(msg);
  await writeCurrentXmlFile(xml);
  return { xml, messageId: msg.id };
}

export async function previewCurrentXml(): Promise<string> {
  if (env.VPS_STORAGE_ENABLED) {
    const msg = await getNextApprovedMessage();
    if (!msg) return buildPlaceholderXml();
    const vps = await getVpsMessageById(msg.id);
    if (vps) return buildVmixXmlForVpsMessage(vps);
    return buildVmixXmlForMessage(msg);
  }
  const msg = await getNextApprovedMessage();
  if (!msg) return buildPlaceholderXml();
  return buildVmixXmlForMessage(msg);
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const VMIX_FILE = path.join(DATA_DIR, "vmix-current.xml");

export async function writeCurrentXmlFile(xml: string) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(VMIX_FILE, xml, "utf8");
}

export async function refreshCurrentXmlFile() {
  if (env.VPS_STORAGE_ENABLED) {
    await refreshVpsCurrentXml();
    return;
  }
  const xml = await previewCurrentXml();
  await writeCurrentXmlFile(xml);
}

export async function readCurrentXmlFile(): Promise<string | null> {
  try {
    return await fs.readFile(VMIX_FILE, "utf8");
  } catch {
    return null;
  }
}

async function recordAlert(msg: FirestoreMessage, title: string, body: string, type: string) {
  await getDb().collection("alerts").add({
    authorUid: msg.authorUid,
    phone: msg.phone,
    title,
    body,
    type,
    messageId: msg.id,
    createdAt: FieldValue.serverTimestamp(),
  });
}

async function audit(action: string, messageId: string, adminUid: string, details?: Record<string, unknown>) {
  await getDb().collection("audit_logs").add({
    action,
    messageId,
    adminUid,
    details: details ?? {},
    timestamp: FieldValue.serverTimestamp(),
  });
}

export async function getLiveConfig() {
  const snap = await getDb().collection("config").doc("live").get();
  return snap.data() ?? { hlsUrl: "", viewers: 0, ads: [] };
}

export async function updateLiveConfig(data: Record<string, unknown>) {
  await getDb().collection("config").doc("live").set(data, { merge: true });
}

export async function seedDatabase() {
  const db = getDb();
  const batch = db.batch();
  const pricing = [
    { type: "dedicace", baseAmount: 1000, active: true, label: "Dédicace", options: { audio: 200 } },
    { type: "annonce", baseAmount: 2500, active: true, label: "Annonce" },
    { type: "necrologie", baseAmount: 5000, active: true, label: "Nécrologie" },
  ];
  for (const p of pricing) {
    batch.set(db.collection("pricing").doc(p.type), p, { merge: true });
  }
  batch.set(
    db.collection("config").doc("live"),
    {
      hlsUrl: env.LIVE_HLS_URL,
      viewers: 1500,
      ads: [
        { id: "ad1", category: "Sport", title: "Pack sponsor Gold", cta: "Voir offre", url: "https://toubatv.sn" },
        { id: "ad2", category: "Actu", title: "Bannière prime time", cta: "Réserver", url: "https://toubatv.sn" },
      ],
    },
    { merge: true }
  );
  await batch.commit();
}

export async function isAdminUid(uid: string): Promise<boolean> {
  const snap = await getDb().collection("admins").doc(uid).get();
  return snap.exists && snap.data()?.active === true;
}
