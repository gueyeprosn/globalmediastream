import crypto from "node:crypto";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const sessions = new Map<string, number>();

export function createAdminSession(): string {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

export function validateAdminSession(token: string): boolean {
  const exp = sessions.get(token);
  if (!exp || Date.now() > exp) {
    sessions.delete(token);
    return false;
  }
  return true;
}

export function revokeAdminSession(token: string) {
  sessions.delete(token);
}
