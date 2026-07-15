import { createHash, randomUUID } from "node:crypto";
import { ensureMaraRuntimeTables, json } from "./maraRuntimeStorage.mjs";

export const MARA_EVENT_TYPES = Object.freeze([
  "business_message_received", "creator_message_sent", "contact_bounced", "follow_up_due",
  "opportunity_deadline_approaching", "invoice_due", "invoice_overdue", "approval_granted",
  "approval_rejected", "user_edit_recorded", "task_completed", "task_ignored", "task_dismissed",
  "task_rescheduled", "video_uploaded", "content_analytics_ready", "portfolio_changed",
  "positioning_changed", "opportunity_state_changed", "payment_recorded", "availability_changed",
  "inactivity_threshold_reached", "evidence_became_stale", "creator_context_received",
  "historical_outreach_imported", "commercial_outcome_recorded"
]);

export function eventIdempotencyKey(event) {
  if (event.idempotencyKey) return String(event.idempotencyKey);
  return createHash("sha256").update(JSON.stringify([
    event.sourceType, event.sourceId || "", event.eventType, event.entityType || "",
    event.entityId || "", event.occurredAt || ""
  ])).digest("hex");
}

export function validateMaraEvent(event) {
  if (!event?.userId || !event?.workerId) throw new Error("Event requires tenant-scoped userId and workerId.");
  if (!MARA_EVENT_TYPES.includes(event.eventType)) throw new Error(`Unsupported Mara event type: ${event.eventType}`);
  if (!event.sourceType) throw new Error("Event requires sourceType.");
  return event;
}

export async function ingestMaraEvent(store, rawEvent) {
  const event = validateMaraEvent(rawEvent);
  await ensureMaraRuntimeTables(store);
  const now = new Date().toISOString();
  const row = {
    id: event.id || randomUUID(),
    key: eventIdempotencyKey(event),
    occurredAt: event.occurredAt || now
  };
  await store.execute(
    `INSERT INTO agent_events (id,user_id,worker_id,event_type,source_type,source_id,entity_type,entity_id,payload_json,provenance_json,confidence,occurred_at,ingested_at,idempotency_key,processed_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL) ON CONFLICT(user_id,worker_id,idempotency_key) DO NOTHING`,
    row.id, event.userId, event.workerId, event.eventType, event.sourceType, event.sourceId || null,
    event.entityType || null, event.entityId || null, JSON.stringify(event.payload || {}),
    JSON.stringify(event.provenance || {}), Number(event.confidence ?? 1), row.occurredAt, now, row.key
  );
  return store.queryOne(
    "SELECT * FROM agent_events WHERE user_id = ? AND worker_id = ? AND idempotency_key = ?",
    event.userId, event.workerId, row.key
  );
}

export async function listMaraEvents(store, { userId, workerId, after, unprocessedOnly = false, limit = 200 }) {
  await ensureMaraRuntimeTables(store);
  const clauses = ["user_id = ?", "worker_id = ?"];
  const params = [userId, workerId];
  if (after) { clauses.push("occurred_at > ?"); params.push(after); }
  if (unprocessedOnly) clauses.push("processed_at IS NULL");
  params.push(Math.max(1, Math.min(1000, Number(limit) || 200)));
  const rows = await store.query(`SELECT * FROM agent_events WHERE ${clauses.join(" AND ")} ORDER BY occurred_at ASC LIMIT ?`, ...params);
  return rows.map((row) => ({
    id: row.id, userId: row.user_id, workerId: row.worker_id, eventType: row.event_type,
    sourceType: row.source_type, sourceId: row.source_id, entityType: row.entity_type,
    entityId: row.entity_id, payload: json(row.payload_json, {}), provenance: json(row.provenance_json, {}),
    confidence: Number(row.confidence), occurredAt: row.occurred_at, processedAt: row.processed_at
  }));
}

export async function markMaraEventsProcessed(store, { userId, workerId, eventIds, processedAt = new Date().toISOString() }) {
  for (const id of [...new Set(eventIds || [])]) {
    await store.execute("UPDATE agent_events SET processed_at = ? WHERE id = ? AND user_id = ? AND worker_id = ?", processedAt, id, userId, workerId);
  }
}
