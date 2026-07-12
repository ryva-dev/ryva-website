import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createObjectStorage, objectKeyForUpload } from "./objectStorage.mjs";

test("object keys are tenant-scoped and traversal safe", () => {
  assert.equal(objectKeyForUpload("user-1", "contract.pdf"), "tenant-uploads/user-1/contract.pdf");
  assert.throws(() => objectKeyForUpload("../other", "contract.pdf"));
});

test("local object storage supports put, get, and idempotent delete", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ryva-storage-"));
  const previous = process.env.OBJECT_STORAGE_DRIVER;
  process.env.OBJECT_STORAGE_DRIVER = "local";
  try {
    const storage = createObjectStorage({ localRoot: root });
    await storage.put({ userId: "user-1", storedName: "file.txt", body: Buffer.from("private") });
    assert.equal((await storage.get({ userId: "user-1", storedName: "file.txt" })).toString(), "private");
    await storage.delete({ userId: "user-1", storedName: "file.txt" });
    await storage.delete({ userId: "user-1", storedName: "file.txt" });
  } finally {
    if (previous === undefined) delete process.env.OBJECT_STORAGE_DRIVER;
    else process.env.OBJECT_STORAGE_DRIVER = previous;
    await rm(root, { recursive: true, force: true });
  }
});
