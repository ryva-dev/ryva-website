// Ryva — encryption at rest for stored secrets (Phase 2, P0)
//
// OAuth access/refresh tokens live in office_worker_integrations.metadata_json.
// A DB backup or breach must NOT hand an attacker every user's Gmail. This
// module encrypts those payloads with AES-256-GCM (authenticated encryption).
//
// Key: ENCRYPTION_KEY env var — 64 hex chars or base64 that decodes to 32 bytes.
//   Generate one:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//   In production, source it from a secrets manager (SSM/Secrets Manager), not .env.
//
// Backward compatible: values are prefixed "enc:v1:". Anything without the prefix
// is treated as legacy plaintext and returned as-is, so existing rows keep working
// and a one-time re-save migrates them. If no key is set (local dev), encryption
// is a pass-through and a warning is logged once.

import crypto from "node:crypto";

const PREFIX = "enc:v1:";
let warnedNoKey = false;

function getKey() {
  const raw = String(process.env.ENCRYPTION_KEY ?? "").trim();
  if (!raw) return null;
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must decode to 32 bytes (AES-256): use 64 hex chars or base64.");
  }
  return key;
}

export function isEncryptionEnabled() {
  return getKey() !== null;
}

/** Encrypt a string. Returns plaintext unchanged when no key is configured (dev). */
export function encryptString(plaintext) {
  const key = getKey();
  if (key === null) {
    if (!warnedNoKey) {
      console.warn(JSON.stringify({ level: "warn", msg: "encryption_disabled", detail: "ENCRYPTION_KEY not set — secrets stored in plaintext (dev only)." }));
      warnedNoKey = true;
    }
    return String(plaintext ?? "");
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext ?? ""), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString("base64");
}

/** Decrypt a value. Legacy plaintext (no prefix) is returned unchanged. */
export function decryptString(value) {
  const s = String(value ?? "");
  if (!s.startsWith(PREFIX)) return s;
  const key = getKey();
  if (key === null) {
    throw new Error("ENCRYPTION_KEY is required to decrypt stored secrets but is not set.");
  }
  const buf = Buffer.from(s.slice(PREFIX.length), "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/** Encrypt an object for storage in a *_json secret column. */
export function encryptJson(obj) {
  return encryptString(JSON.stringify(obj ?? {}));
}

/** Decrypt a secret *_json column back to an object (tolerates legacy plaintext). */
export function decryptJson(value, fallback = {}) {
  try {
    return JSON.parse(decryptString(value));
  } catch {
    return fallback;
  }
}
