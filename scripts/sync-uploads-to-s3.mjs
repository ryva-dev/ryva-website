#!/usr/bin/env node
/**
 * Stage F helper — copy local tenant uploads into S3.
 *
 * Usage:
 *   OBJECT_STORAGE_DRIVER=s3 S3_BUCKET=… AWS_REGION=… \
 *     node scripts/sync-uploads-to-s3.mjs [--dry-run] [--root path/to/office-uploads]
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createObjectStorage, objectKeyForUpload } from "../server/objectStorage.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const args = { dryRun: false, root: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--root") args.root = argv[++i];
    else if (arg.startsWith("--root=")) args.root = arg.slice("--root=".length);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

async function walkFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walkFiles(full)));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  process.env.OBJECT_STORAGE_DRIVER = process.env.OBJECT_STORAGE_DRIVER || "s3";
  const root =
    args.root ||
    process.env.UPLOADS_ROOT ||
    path.join(
      process.env.STORAGE_ROOT || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(repoRoot, "data"),
      "office-uploads"
    );

  const storage = createObjectStorage({ localRoot: root });
  if (storage.driver !== "s3") {
    throw new Error("Set OBJECT_STORAGE_DRIVER=s3 and S3_BUCKET before syncing.");
  }

  let uploaded = 0;
  const tenantDirs = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  for (const tenant of tenantDirs) {
    if (!tenant.isDirectory()) continue;
    const userId = tenant.name;
    const files = await walkFiles(path.join(root, userId));
    for (const filePath of files) {
      const storedName = path.basename(filePath);
      const key = objectKeyForUpload(userId, storedName);
      console.log(`${args.dryRun ? "would upload" : "upload"} ${filePath} -> s3://${process.env.S3_BUCKET}/${key}`);
      if (!args.dryRun) {
        const body = await fs.readFile(filePath);
        await storage.put({ userId, storedName, body });
        uploaded += 1;
      }
    }
  }
  console.log(args.dryRun ? "Dry-run complete." : `Uploaded ${uploaded} object(s).`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
