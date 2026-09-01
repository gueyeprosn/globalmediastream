import admin from "firebase-admin";
import { env } from "./config/env";

let initialized = false;

export function initFirebase(): admin.app.App {
  if (initialized && admin.apps.length) {
    return admin.app();
  }

  if (env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: env.FIREBASE_PROJECT_ID,
    });
  } else {
    admin.initializeApp({ projectId: env.FIREBASE_PROJECT_ID });
  }

  initialized = true;
  return admin.app();
}

export function getDb() {
  initFirebase();
  return admin.firestore();
}

export function getAuth() {
  initFirebase();
  return admin.auth();
}

export { admin };
