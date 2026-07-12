import path from "node:path";

const DEFAULT_MAX_BYTES = Number.parseInt(process.env.UPLOAD_MAX_BYTES ?? String(1024 * 1024), 10);
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "text/markdown",
  "text/plain"
]);
const BLOCKED_EXTENSIONS = new Set([".app", ".bat", ".cmd", ".com", ".dll", ".dmg", ".exe", ".js", ".jar", ".msi", ".ps1", ".sh"]);

export function validateTenantUpload({ name, type, contentBase64, maxBytes = DEFAULT_MAX_BYTES }) {
  const fileName = String(name ?? "").trim();
  const contentType = String(type ?? "").trim().toLowerCase();
  const encoded = String(contentBase64 ?? "").trim();
  if (!fileName || fileName !== path.basename(fileName) || fileName.length > 180) throw new Error("File name is invalid.");
  if (BLOCKED_EXTENSIONS.has(path.extname(fileName).toLowerCase())) throw new Error("Executable or script files are not allowed.");
  if (!ALLOWED_TYPES.has(contentType)) throw new Error("File type is not allowed.");
  if (!encoded || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) throw new Error("File content is not valid base64.");
  const body = Buffer.from(encoded, "base64");
  if (body.length === 0 || body.length > maxBytes) throw new Error(`File must be between 1 and ${maxBytes} bytes.`);
  if (body.subarray(0, 2).toString("hex") === "4d5a" || body.subarray(0, 4).toString("hex") === "7f454c46") {
    throw new Error("Executable content is not allowed.");
  }
  return { body, contentType, fileName };
}
