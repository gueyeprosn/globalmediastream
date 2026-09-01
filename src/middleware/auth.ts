import type { NextFunction, Request, Response } from "express";
import { getAuth } from "../firebase";
import { isAdminUid } from "../services/messages.service";

export type AuthedRequest = Request & { uid?: string };

/** Utilisateur Firebase connecté (app mobile, envoi dédicace). */
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ success: false, message: "Connexion requise" });
  }

  try {
    const decoded = await getAuth().verifyIdToken(match[1]);
    req.uid = decoded.uid;
    return next();
  } catch {
    return res.status(401).json({ success: false, message: "Session invalide ou expirée" });
  }
}

export async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ success: false, message: "Connexion requise (Google)" });
  }

  try {
    const decoded = await getAuth().verifyIdToken(match[1]);
    const ok = await isAdminUid(decoded.uid);
    if (!ok) {
      return res.status(403).json({
        success: false,
        message: "Accès refusé. Ajoutez votre UID dans Firestore admins/{uid} avec active:true",
        uid: decoded.uid,
      });
    }
    req.uid = decoded.uid;
    return next();
  } catch {
    return res.status(401).json({ success: false, message: "Session invalide ou expirée" });
  }
}
