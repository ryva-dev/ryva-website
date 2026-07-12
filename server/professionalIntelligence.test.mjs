import assert from "node:assert/strict";
import Database from "better-sqlite3";
import test from "node:test";
import { initProfessionalIntelligence, proposeProfessionalInsight, publishProfessionalInsight, reviewProfessionalInsight } from "./professionalIntelligence.mjs";
import { wrapSqliteHandle } from "./dataStore.mjs";

async function database() {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE worker_knowledge_modules (id TEXT PRIMARY KEY, worker_type TEXT, worker_id TEXT, title TEXT NOT NULL,
    category TEXT NOT NULL, summary TEXT NOT NULL, content TEXT NOT NULL, structured_content_json TEXT, tags_json TEXT,
    is_active INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
  const store = wrapSqliteHandle(db);
  await initProfessionalIntelligence(store);
  return { db, store };
}

test("shared professional research is quarantined and cannot contain tenant identity", async () => {
  const { db, store } = await database();
  await assert.rejects(() => proposeProfessionalInsight(store, { userId: "private-user", sourceUrl: "https://example.com", title: "x", summary: "x", content: "x", evidence: ["x"] }), /Tenant-derived/);
  await assert.rejects(() => proposeProfessionalInsight(store, { sourceUrl: "http://localhost/private", title: "x", summary: "x", content: "x", evidence: ["x"] }), /HTTPS/);
  db.close();
});

test("only reviewed research can publish into professional knowledge", async () => {
  const { db, store } = await database();
  const proposed = await proposeProfessionalInsight(store, {
    workerType: "mara", title: "Usage licensing update", summary: "Price licenses separately.",
    content: "Paid usage should have a defined duration.", sourceUrl: "https://example.com/research",
    sourcePublisher: "Example", evidence: ["Section 2 defines duration-based licensing."]
  });
  await assert.rejects(() => publishProfessionalInsight(store, { candidateId: proposed.id }), /approved/);
  await reviewProfessionalInsight(store, { candidateId: proposed.id, reviewer: "editor@example.com", decision: "approved" });
  const published = await publishProfessionalInsight(store, { candidateId: proposed.id });
  assert.match(published.moduleId, /^research:/);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM worker_knowledge_modules").get().count, 1);
  db.close();
});
