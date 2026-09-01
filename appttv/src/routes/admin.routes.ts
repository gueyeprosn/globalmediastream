import { Router } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../middleware/auth";
import { requireAdmin } from "../middleware/auth";
import {
  approveMessage,
  backupMessagePhotoToDrive,
  broadcastMessage,
  listMessages,
  rejectMessage,
  seedDatabase,
} from "../services/messages.service";
import { vmixPublicUrls } from "../services/vmix-xml";

const router = Router();

router.use(requireAdmin);

router.get("/vmix-urls", (_req, res) => {
  res.json({ success: true, urls: vmixPublicUrls() });
});

router.get("/messages", async (req, res, next) => {
  try {
    const status = String(req.query.status ?? "queued").toLowerCase();
    const rows = await listMessages(status);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

const paramId = (req: import("express").Request) => String(req.params.id);

router.post("/messages/:id/approve", async (req: AuthedRequest, res, next) => {
  try {
    await approveMessage(paramId(req), req.uid!);
    res.json({ success: true, status: "approved" });
  } catch (e) {
    next(e);
  }
});

const rejectSchema = z.object({ reason: z.string().min(3).default("Non conforme") });

router.post("/messages/:id/reject", async (req: AuthedRequest, res, next) => {
  try {
    const { reason } = rejectSchema.parse(req.body ?? {});
    await rejectMessage(paramId(req), req.uid!, reason);
    res.json({ success: true, status: "rejected" });
  } catch (e) {
    next(e);
  }
});

router.post("/messages/:id/broadcast", async (req: AuthedRequest, res, next) => {
  try {
    await broadcastMessage(paramId(req), req.uid!);
    res.json({ success: true, status: "broadcast" });
  } catch (e) {
    next(e);
  }
});

router.post("/messages/:id/drive-backup", async (req: AuthedRequest, res, next) => {
  try {
    const result = await backupMessagePhotoToDrive(paramId(req));
    if (!result.success) {
      return res.status(400).json({ success: false, message: "Pas de photo ou Drive non configuré" });
    }
    res.json({ success: true, link: result.link });
  } catch (e) {
    next(e);
  }
});

router.post("/seed", async (_req, res, next) => {
  try {
    await seedDatabase();
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

export default router;
