import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import type { AuthedRequest } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { env } from "../config/env";
import { isDriveConfigured, uploadBufferToDrive } from "../services/drive.service";
import { saveVpsPhotoOnly, submitVpsMessage, trackVpsMessages } from "../services/vps-messages.service";
import { isLikelyImageUpload, normalizeImageMime } from "../utils/image-upload";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isLikelyImageUpload(file.mimetype, file.originalname)) {
      cb(null, true);
      return;
    }
    cb(new Error("Format accepté : image JPEG, PNG ou WebP (max 8 Mo)"));
  },
});

function photoPayload(file: Express.Multer.File) {
  const contentType =
    normalizeImageMime(file.mimetype, file.originalname, file.buffer) ?? file.mimetype;
  return { buffer: file.buffer, contentType };
}

const submitSchema = z.object({
  category: z.string().min(1),
  senderName: z.string().min(1),
  phone: z.string().min(6),
  message: z.string().min(1),
  countryName: z.string().optional().default(""),
  amount: z.coerce.number().default(0),
  payment: z.string().optional().default("free"),
  paymentSessionId: z.string().optional(),
  fcmToken: z.string().optional(),
});

/** Envoi complet message + photo optionnelle → stockage VPS. */
router.post("/submit", requireAuth, upload.single("photo"), async (req: AuthedRequest, res, next) => {
  try {
    if (!env.VPS_STORAGE_ENABLED) {
      return res.status(503).json({ success: false, message: "Stockage VPS désactivé" });
    }

    const fields = submitSchema.parse(req.body ?? {});
    const file = req.file;

    const result = await submitVpsMessage({
      authorUid: req.uid!,
      type: fields.category.toLowerCase(),
      senderName: fields.senderName,
      phone: fields.phone,
      countryName: fields.countryName,
      messageText: fields.message,
      amount: fields.amount,
      paymentMethod: fields.payment,
      paymentSessionId: fields.paymentSessionId,
      fcmToken: fields.fcmToken,
      photo: file?.buffer?.length ? photoPayload(file) : undefined,
    });

    res.json(result);
  } catch (e) {
    next(e);
  }
});

/** Suivi par numéro de téléphone. */
router.get("/track/:phone", requireAuth, async (req, res, next) => {
  try {
    if (!env.VPS_STORAGE_ENABLED) {
      return res.status(503).json({ success: false, message: "Stockage VPS désactivé" });
    }
    const phone = String(req.params.phone).trim();
    const rows = await trackVpsMessages(phone);
    res.json({ success: true, messages: rows });
  } catch (e) {
    next(e);
  }
});

/** Upload photo seule → disque VPS (ou Drive si VPS désactivé). */
router.post("/photo", requireAuth, upload.single("photo"), async (req: AuthedRequest, res, next) => {
  try {
    const file = req.file;
    if (!file?.buffer?.length) {
      return res.status(400).json({ success: false, message: "Fichier photo requis (champ photo)" });
    }

    const senderName = String(req.body?.senderName ?? "dedicace").trim();
    const messageId = String(req.body?.messageId ?? "").trim() || undefined;

    if (env.VPS_STORAGE_ENABLED) {
      const result = await saveVpsPhotoOnly({
        authorUid: req.uid!,
        senderName,
        messageId,
        ...photoPayload(file),
      });
      return res.json({
        success: true,
        mediaUrl: result.mediaUrl,
        photoPath: result.photoPath,
        storage: "vps",
      });
    }

    if (!isDriveConfigured()) {
      return res.status(503).json({
        success: false,
        message: "Stockage non configuré sur le serveur",
      });
    }

    const result = await uploadBufferToDrive({
      buffer: file.buffer,
      contentType: file.mimetype,
      senderName,
      messageId,
      authorUid: req.uid,
    });

    if (!result) {
      return res.status(500).json({ success: false, message: "Échec enregistrement Google Drive" });
    }

    const mediaUrl = result.webContentLink?.trim() || result.webViewLink;

    res.json({
      success: true,
      fileId: result.fileId,
      driveWebViewLink: result.webViewLink,
      mediaUrl,
      storage: "drive",
    });
  } catch (e) {
    next(e);
  }
});

export default router;
