import { env } from "../config/env";
import { getDb } from "../firebase";
import { isDriveConfigured } from "./drive.service";
import { backupMessagePhotoToDrive } from "./messages.service";

const inFlight = new Set<string>();

function scheduleDriveBackup(messageId: string, data: Record<string, unknown>) {
  const mediaUrl = String(data.mediaUrl ?? "").trim();
  if (!mediaUrl || data.driveFileId || inFlight.has(messageId)) return;

  inFlight.add(messageId);
  void backupMessagePhotoToDrive(messageId)
    .then((result) => {
      if (result.success && result.link) {
        console.log(`[drive] photo enregistrée ${messageId} → ${result.link}`);
      }
    })
    .catch((e) => console.warn(`[drive] échec ${messageId}`, e))
    .finally(() => inFlight.delete(messageId));
}

async function pollRecentMessages() {
  const snap = await getDb()
    .collection("messages")
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();

  for (const doc of snap.docs) {
    scheduleDriveBackup(doc.id, doc.data());
  }
}

/** Écoute Firestore + poll : chaque photo mediaUrl → Google Drive automatiquement. */
export function startDrivePhotoWatcher() {
  if (!isDriveConfigured()) {
    console.log("[drive] sync désactivé — GOOGLE_DRIVE_ENABLED=true et GOOGLE_DRIVE_FOLDER_ID requis");
    return;
  }

  console.log(`[drive] sync auto actif → dossier ${env.GOOGLE_DRIVE_FOLDER_ID}`);

  getDb()
    .collection("messages")
    .onSnapshot(
      (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type === "removed") continue;
          scheduleDriveBackup(change.doc.id, change.doc.data());
        }
      },
      (err) => console.error("[drive] listener Firestore", err)
    );

  void pollRecentMessages();
  setInterval(() => void pollRecentMessages().catch((e) => console.warn("[drive] poll", e)), 2 * 60 * 1000);
}
