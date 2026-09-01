import { randomUUID } from "node:crypto";
import { savePhotoBuffer } from "./local-files.service";
import {
  appendAudit,
  createMessage,
  getMessage,
  getNextApprovedMessage,
  listMessagesByPhone,
  listMessagesByStatus,
  updateMessage,
  type VpsMessage,
} from "./vps-store.service";
import { toDto, buildVmixFieldsFromMessage, buildPlaceholderXml, writeCurrentXmlFile, type FirestoreMessage } from "./messages.service";
import { buildXmlFields } from "../utils/xml";

function vpsToFirestoreShape(msg: VpsMessage): FirestoreMessage {
  return {
    id: msg.id,
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
  };
}

function vpsToDto(msg: VpsMessage) {
  return toDto(msg.id, {
    type: msg.type,
    content: msg.content,
    phone: msg.phone,
    countryName: msg.countryName,
    amount: msg.amount,
    paymentMethod: msg.paymentMethod,
    moderationStatus: msg.moderationStatus,
    mediaUrl: msg.mediaUrl,
    createdAt: { toDate: () => new Date(msg.createdAt) },
    rejectReason: msg.rejectReason,
    driveWebViewLink: "",
  });
}

export function buildVmixXmlForVpsMessage(msg: VpsMessage) {
  return buildXmlFields(buildVmixFieldsFromMessage(vpsToFirestoreShape(msg)));
}

export async function submitVpsMessage(input: {
  authorUid: string;
  type: string;
  senderName: string;
  phone: string;
  countryName: string;
  messageText: string;
  amount: number;
  paymentMethod: string;
  paymentSessionId?: string;
  fcmToken?: string;
  photo?: { buffer: Buffer; contentType: string };
}) {
  const messageId = randomUUID();

  let mediaUrl: string | undefined;
  let photoPath: string | undefined;

  if (input.photo?.buffer.length) {
    const saved = await savePhotoBuffer({
      buffer: input.photo.buffer,
      contentType: input.photo.contentType,
      messageId,
    });
    mediaUrl = saved.mediaUrl;
    photoPath = saved.relativePath;
  }

  const msg = await createMessage({
    id: messageId,
    type: input.type,
    authorUid: input.authorUid,
    phone: input.phone,
    countryName: input.countryName,
    content: {
      senderName: input.senderName,
      message: input.messageText,
    },
    mediaUrl,
    photoPath,
    amount: input.amount,
    paymentMethod: input.paymentMethod,
    paymentSessionId: input.paymentSessionId,
    paymentStatus: "paid",
    fcmToken: input.fcmToken,
  });

  await appendAudit({ action: "MESSAGE_CREATED", messageId: msg.id, phone: msg.phone });
  console.log(`[vps] message enregistré ${msg.id} photo=${mediaUrl ?? "non"}`);

  return { success: true, messageId: msg.id, status: "queued", mediaUrl };
}

export async function listVpsMessages(status: string) {
  const rows = await listMessagesByStatus(status);
  return rows.map(vpsToDto);
}

export async function trackVpsMessages(phone: string) {
  const rows = await listMessagesByPhone(phone);
  return rows.map((m) => ({
    id: m.id,
    category: m.type,
    moderationStatus: m.moderationStatus,
    paymentStatus: m.paymentStatus,
    createdAt: m.createdAt,
    mediaUrl: m.mediaUrl,
  }));
}

export async function approveVpsMessage(messageId: string, adminUid: string) {
  const msg = await getMessage(messageId);
  if (!msg) throw new Error("Message introuvable");
  if (msg.moderationStatus !== "queued") throw new Error("Message déjà traité");

  await updateMessage(messageId, {
    moderationStatus: "approved",
    approvedAt: new Date().toISOString(),
    moderatedBy: adminUid,
  });
  await appendAudit({ action: "MESSAGE_APPROVED", messageId, adminUid });
  await refreshVpsCurrentXml();
}

export async function rejectVpsMessage(messageId: string, adminUid: string, reason: string) {
  const msg = await getMessage(messageId);
  if (!msg) throw new Error("Message introuvable");
  if (msg.moderationStatus !== "queued") throw new Error("Message déjà traité");

  await updateMessage(messageId, {
    moderationStatus: "rejected",
    rejectReason: reason,
    rejectedAt: new Date().toISOString(),
    moderatedBy: adminUid,
  });
  await appendAudit({ action: "MESSAGE_REJECTED", messageId, adminUid, reason });
}

export async function broadcastVpsMessage(messageId: string, adminUid: string) {
  const msg = await getMessage(messageId);
  if (!msg) throw new Error("Message introuvable");
  if (msg.moderationStatus !== "approved" || msg.broadcast) {
    throw new Error("Message non prêt pour diffusion");
  }

  const updated = await updateMessage(messageId, {
    broadcast: true,
    moderationStatus: "broadcast",
    broadcastAt: new Date().toISOString(),
    moderatedBy: adminUid,
  });
  if (updated) {
    await writeCurrentXmlFile(buildVmixXmlForVpsMessage(updated));
  }
  await appendAudit({ action: "MESSAGE_BROADCAST", messageId, adminUid });
}

export async function consumeVpsFifoMessage() {
  const msg = await getNextApprovedMessage();
  if (!msg) {
    await writeCurrentXmlFile(buildPlaceholderXml());
    return { xml: buildPlaceholderXml(), messageId: null };
  }
  const xml = buildVmixXmlForVpsMessage(msg);
  await updateMessage(msg.id, {
    broadcast: true,
    moderationStatus: "broadcast",
    broadcastAt: new Date().toISOString(),
  });
  await writeCurrentXmlFile(xml);
  return { xml, messageId: msg.id };
}

export async function getVpsMessageById(id: string) {
  return getMessage(id);
}

export async function refreshVpsCurrentXml() {
  const msg = await getNextApprovedMessage();
  if (!msg) {
    await writeCurrentXmlFile(buildPlaceholderXml());
    return;
  }
  await writeCurrentXmlFile(buildVmixXmlForVpsMessage(msg));
}

export async function saveVpsPhotoOnly(input: {
  authorUid: string;
  senderName: string;
  messageId?: string;
  buffer: Buffer;
  contentType: string;
}) {
  const saved = await savePhotoBuffer({
    buffer: input.buffer,
    contentType: input.contentType,
    messageId: input.messageId,
  });
  return {
    success: true,
    mediaUrl: saved.mediaUrl,
    photoPath: saved.relativePath,
    fileName: saved.fileName,
  };
}
