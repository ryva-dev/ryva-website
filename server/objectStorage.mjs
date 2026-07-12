import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveUserUploadPath } from "./uploadPaths.mjs";

function storageMode() {
  return String(process.env.OBJECT_STORAGE_DRIVER ?? (process.env.S3_BUCKET ? "s3" : "local")).trim().toLowerCase();
}

function s3Client() {
  return new S3Client({
    region: String(process.env.AWS_REGION ?? "us-east-1"),
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: String(process.env.S3_FORCE_PATH_STYLE ?? "false").toLowerCase() === "true"
  });
}

export function objectKeyForUpload(userId, storedName) {
  const safeUserId = String(userId ?? "").trim();
  const safeStoredName = path.basename(String(storedName ?? "").trim());
  if (!safeUserId || safeUserId !== path.basename(safeUserId) || !safeStoredName) throw new Error("Invalid object key.");
  return `tenant-uploads/${safeUserId}/${safeStoredName}`;
}

export function createObjectStorage({ localRoot } = {}) {
  const driver = storageMode();
  const root = localRoot || process.env.STORAGE_ROOT || path.resolve("data", "office-uploads");
  const bucket = String(process.env.S3_BUCKET ?? "").trim();
  if (driver === "s3" && !bucket) throw new Error("S3_BUCKET is required when OBJECT_STORAGE_DRIVER=s3.");

  return {
    driver,
    async put({ userId, storedName, body, contentType }) {
      if (driver === "s3") {
        await s3Client().send(new PutObjectCommand({
          Bucket: bucket,
          Key: objectKeyForUpload(userId, storedName),
          Body: body,
          ContentType: contentType || "application/octet-stream",
          ServerSideEncryption: String(process.env.S3_SERVER_SIDE_ENCRYPTION ?? "AES256")
        }));
        return;
      }
      const filePath = resolveUserUploadPath(root, userId, storedName);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, body);
    },
    async get({ userId, storedName }) {
      if (driver === "s3") {
        const response = await s3Client().send(new GetObjectCommand({ Bucket: bucket, Key: objectKeyForUpload(userId, storedName) }));
        if (!response.Body) throw new Error("Stored object has no body.");
        return Buffer.from(await response.Body.transformToByteArray());
      }
      return fs.readFile(resolveUserUploadPath(root, userId, storedName));
    },
    async delete({ userId, storedName }) {
      if (driver === "s3") {
        await s3Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKeyForUpload(userId, storedName) }));
        return;
      }
      await fs.unlink(resolveUserUploadPath(root, userId, storedName)).catch((error) => {
        if (error?.code !== "ENOENT") throw error;
      });
    }
  };
}
