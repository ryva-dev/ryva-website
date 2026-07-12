import { createHash, randomUUID } from "node:crypto";

export async function initProfessionalIntelligence(store) {
  await store.execute(`CREATE TABLE IF NOT EXISTS professional_research_candidates (
      id TEXT PRIMARY KEY,
      worker_type TEXT NOT NULL,
      title TEXT NOT NULL,
      proposed_summary TEXT NOT NULL,
      proposed_content TEXT NOT NULL,
      source_url TEXT NOT NULL,
      source_publisher TEXT NOT NULL,
      source_published_at TEXT,
      evidence_json TEXT NOT NULL,
      content_hash TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      review_notes TEXT,
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
}

function parseJsonColumn(value, fallback) {
  if (value && typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function assertEligibleSource(sourceUrl) {
  const url = new URL(String(sourceUrl ?? ""));
  if (url.protocol !== "https:") throw new Error("Professional research requires an HTTPS public or licensed source.");
  if (["localhost", "127.0.0.1", "::1"].includes(url.hostname) || url.hostname.endsWith(".local")) {
    throw new Error("Private sources cannot enter shared professional knowledge.");
  }
  return url.toString();
}

export async function proposeProfessionalInsight(store, candidate) {
  const sourceUrl = assertEligibleSource(candidate.sourceUrl);
  if (candidate.userId || candidate.tenantId || candidate.customerId) {
    throw new Error("Tenant-derived material cannot be proposed as shared professional knowledge.");
  }
  const title = String(candidate.title ?? "").trim();
  const summary = String(candidate.summary ?? "").trim();
  const content = String(candidate.content ?? "").trim();
  const evidence = Array.isArray(candidate.evidence) ? candidate.evidence : [];
  if (!title || !summary || !content || evidence.length === 0) throw new Error("Title, summary, content, and evidence are required.");
  const contentHash = createHash("sha256").update(`${sourceUrl}\n${title}\n${content}`).digest("hex");
  const now = new Date().toISOString();
  const id = randomUUID();
  const info = await store.execute(
    `INSERT INTO professional_research_candidates
      (id, worker_type, title, proposed_summary, proposed_content, source_url, source_publisher,
       source_published_at, evidence_json, content_hash, status, review_notes, reviewed_by,
       reviewed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'quarantined', NULL, NULL, NULL, ?, ?)
     ON CONFLICT(content_hash) DO NOTHING`,
    id, String(candidate.workerType || "general"), title, summary, content, sourceUrl,
    String(candidate.sourcePublisher ?? "").trim(), candidate.sourcePublishedAt || null,
    JSON.stringify(evidence), contentHash, now, now);
  return { id: info.changes === 1 ? id : null, duplicate: info.changes !== 1, status: "quarantined" };
}

export async function reviewProfessionalInsight(store, { candidateId, reviewer, decision, notes = "" }) {
  if (!reviewer) throw new Error("A reviewer identity is required.");
  if (!['approved', 'rejected'].includes(decision)) throw new Error("Decision must be approved or rejected.");
  const candidate = await store.queryOne("SELECT * FROM professional_research_candidates WHERE id = ? AND status = 'quarantined'", candidateId);
  if (!candidate) throw new Error("Quarantined candidate not found.");
  const now = new Date().toISOString();
  await store.execute(
    `UPDATE professional_research_candidates SET status = ?, review_notes = ?, reviewed_by = ?,
       reviewed_at = ?, updated_at = ? WHERE id = ?`
    , decision, String(notes), String(reviewer), now, now, candidateId);
  return { ...candidate, status: decision };
}

export async function publishProfessionalInsight(store, { candidateId }) {
  const candidate = await store.queryOne("SELECT * FROM professional_research_candidates WHERE id = ? AND status = 'approved'", candidateId);
  if (!candidate) throw new Error("Only reviewed and approved professional insight can be published.");
  const now = new Date().toISOString();
  const moduleId = `research:${candidate.content_hash}`;
  await store.execute(
    `INSERT INTO worker_knowledge_modules
      (id, worker_type, worker_id, title, category, summary, content, structured_content_json,
       tags_json, is_active, created_at, updated_at)
     VALUES (?, ?, NULL, ?, 'professional_research', ?, ?, ?, '[]', 1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET summary = excluded.summary, content = excluded.content,
       structured_content_json = excluded.structured_content_json, is_active = 1, updated_at = excluded.updated_at`,
    moduleId, candidate.worker_type, candidate.title, candidate.proposed_summary, candidate.proposed_content,
    JSON.stringify({ sourceUrl: candidate.source_url, evidence: parseJsonColumn(candidate.evidence_json, []), reviewedBy: candidate.reviewed_by }), now, now);
  await store.execute("UPDATE professional_research_candidates SET status = 'published', updated_at = ? WHERE id = ?", now, candidateId);
  return { moduleId, publishedAt: now };
}
