import { Router } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../middleware/auth";
import { requireAdmin } from "../middleware/auth";
import {
  approveMessage,
  broadcastMessage,
  buildPlaceholderXml,
  buildVmixXmlForMessage,
  getMessageById,
  listMessages,
  markBroadcast,
  previewCurrentXml,
  readCurrentXmlFile,
  rejectMessage,
  seedDatabase,
  writeCurrentXmlFile,
} from "../services/messages.service";
import { vmixTokenOk } from "../services/vmix-xml";

const router = Router();

function sendXml(res: import("express").Response, xml: string) {
  res.set("Content-Type", "application/xml; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.send(xml);
}

function denyVmix(res: import("express").Response) {
  res.status(403).type("xml").send(
    '<?xml version="1.0" encoding="UTF-8"?><DataSource><Fields><Field Name="Erreur">Token vMix invalide</Field></Fields></DataSource>'
  );
}

/** FIFO — vMix poll (~5 s) : consomme le prochain message approuvé. */
router.get("/datasource.xml", async (req, res) => {
  if (!vmixTokenOk(req)) return denyVmix(res);
  try {
    const { consumeFifoMessage } = await import("../services/messages.service");
    const { xml } = await consumeFifoMessage();
    sendXml(res, xml);
  } catch (e) {
    console.error("[vmix] datasource", e);
    sendXml(res, buildPlaceholderXml());
  }
});

router.get("/datasource", async (req, res) => {
  if (!vmixTokenOk(req)) return denyVmix(res);
  try {
    const { consumeFifoMessage } = await import("../services/messages.service");
    const { xml } = await consumeFifoMessage();
    sendXml(res, xml);
  } catch (e) {
    sendXml(res, buildPlaceholderXml());
  }
});

router.get("/message/:id.xml", async (req, res) => {
  if (!vmixTokenOk(req)) return denyVmix(res);
  const id = String(req.params.id).replace(/\.xml$/, "");
  try {
    const msg = await getMessageById(id);
    if (!msg || msg.moderationStatus !== "approved" || msg.broadcast) {
      return sendXml(res, buildPlaceholderXml());
    }
    const xml = buildVmixXmlForMessage(msg);
    await markBroadcast(msg);
    await writeCurrentXmlFile(xml);
    sendXml(res, xml);
  } catch (e) {
    sendXml(res, buildPlaceholderXml());
  }
});

router.get("/preview.xml", async (req, res) => {
  if (!vmixTokenOk(req)) return denyVmix(res);
  try {
    sendXml(res, await previewCurrentXml());
  } catch {
    sendXml(res, buildPlaceholderXml());
  }
});

export default router;

export async function handleCurrentXmlFile(req: import("express").Request, res: import("express").Response) {
  if (!vmixTokenOk(req)) return denyVmix(res);
  try {
    let xml = await readCurrentXmlFile();
    if (!xml) {
      xml = await previewCurrentXml();
      await writeCurrentXmlFile(xml);
    }
    sendXml(res, xml);
  } catch {
    sendXml(res, buildPlaceholderXml());
  }
}
