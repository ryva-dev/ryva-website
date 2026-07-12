/**
 * Scheduled outreach follow-up sequences — drafts only until approval policy allows send.
 */
import { randomUUID } from "node:crypto";

export const SEQUENCE_STOP_REASONS = Object.freeze({
  REPLY_RECEIVED: "reply_received",
  USER_CANCELLED: "user_cancelled",
  BOUNCE: "email_bounced",
  OPT_OUT: "brand_opt_out",
  MAX_ATTEMPTS: "max_attempts_reached",
  OPPORTUNITY_CLOSED: "opportunity_closed"
});

const DEFAULT_STEPS = [
  { offsetDays: 3, kind: "follow_up", subjectTemplate: "Quick follow-up — {brand}" },
  { offsetDays: 7, kind: "follow_up", subjectTemplate: "Checking in — {brand} + {creatorAngle}" },
  { offsetDays: 14, kind: "close_loop", subjectTemplate: "Closing the loop — {brand}" }
];

export async function startOutreachSequence(store, {
  userId,
  workerId,
  opportunityId,
  publicBrandId,
  contactId,
  maxAttempts = 3,
  steps = DEFAULT_STEPS
}) {
  const active = await store.queryOne(
    `SELECT id FROM mara_outreach_sequences
     WHERE user_id = ? AND worker_id = ? AND opportunity_id = ? AND status = 'active'`,
    userId,
    workerId,
    opportunityId
  );
  if (active?.id) return { id: active.id, deduplicated: true };

  const now = new Date();
  const first = steps[0];
  const nextRun = new Date(now.getTime() + (first?.offsetDays || 3) * 86_400_000).toISOString();
  const id = randomUUID();
  await store.execute(
    `INSERT INTO mara_outreach_sequences
      (id, user_id, worker_id, opportunity_id, public_brand_id, contact_id, status, attempt_count,
       max_attempts, next_run_at, stop_reason, steps_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', 0, ?, ?, NULL, ?, ?, ?)`,
    id,
    userId,
    workerId,
    opportunityId,
    publicBrandId || null,
    contactId || null,
    maxAttempts,
    nextRun,
    JSON.stringify(steps),
    now.toISOString(),
    now.toISOString()
  );
  return { id, deduplicated: false, nextRunAt: nextRun };
}

export async function stopOutreachSequence(store, { userId, workerId, sequenceId = null, opportunityId = null, reason }) {
  if (!Object.values(SEQUENCE_STOP_REASONS).includes(reason) && reason !== "user_cancelled") {
    // allow custom but prefer constants
  }
  const now = new Date().toISOString();
  if (sequenceId) {
    await store.execute(
      `UPDATE mara_outreach_sequences SET status = 'stopped', stop_reason = ?, next_run_at = NULL, updated_at = ?
       WHERE id = ? AND user_id = ? AND worker_id = ?`,
      reason,
      now,
      sequenceId,
      userId,
      workerId
    );
    return { stopped: 1 };
  }
  const result = await store.execute(
    `UPDATE mara_outreach_sequences SET status = 'stopped', stop_reason = ?, next_run_at = NULL, updated_at = ?
     WHERE user_id = ? AND worker_id = ? AND opportunity_id = ? AND status = 'active'`,
    reason,
    now,
    userId,
    workerId,
    opportunityId
  );
  return { stopped: result?.changes ?? 1 };
}

export async function listDueOutreachSequences(store, userId, workerId, now = new Date()) {
  return store.query(
    `SELECT id, opportunity_id AS "opportunityId", public_brand_id AS "publicBrandId", contact_id AS "contactId",
            attempt_count AS "attemptCount", max_attempts AS "maxAttempts", next_run_at AS "nextRunAt",
            steps_json AS "stepsJson", status
     FROM mara_outreach_sequences
     WHERE user_id = ? AND worker_id = ? AND status = 'active' AND next_run_at IS NOT NULL AND next_run_at <= ?
     ORDER BY next_run_at ASC LIMIT 10`,
    userId,
    workerId,
    now.toISOString()
  );
}

export async function advanceOutreachSequenceAfterDraft(store, { userId, workerId, sequenceId }) {
  // Deprecated name kept for callers: preparing a draft must NOT burn attempts.
  return prepareDueFollowUpDraft(store, { userId, workerId, sequenceId });
}

/**
 * Propose the next follow-up copy without advancing attempt_count.
 * Attempts advance only after an approved send (advanceOutreachSequenceAfterSend).
 * Holding next_run_at prevents the same due row from re-firing every autonomy cycle.
 */
export async function prepareDueFollowUpDraft(store, { userId, workerId, sequenceId, holdHours = 48 } = {}) {
  const row = await store.queryOne(
    `SELECT * FROM mara_outreach_sequences WHERE id = ? AND user_id = ? AND worker_id = ?`,
    sequenceId,
    userId,
    workerId
  );
  if (!row || row.status !== "active") return null;
  const steps = typeof row.steps_json === "object" ? row.steps_json : JSON.parse(row.steps_json || "[]");
  const attemptCount = Number(row.attempt_count || 0);
  if (attemptCount >= Number(row.max_attempts || 3)) {
    await stopOutreachSequence(store, {
      userId,
      workerId,
      sequenceId,
      reason: SEQUENCE_STOP_REASONS.MAX_ATTEMPTS
    });
    return { status: "stopped", reason: SEQUENCE_STOP_REASONS.MAX_ATTEMPTS };
  }
  const nextStep = steps[Math.min(attemptCount, steps.length - 1)] || steps[steps.length - 1];
  const holdMs = Math.max(1, Number(holdHours) || 48) * 3_600_000;
  const holdUntil = new Date(Date.now() + holdMs).toISOString();
  const now = new Date().toISOString();
  await store.execute(
    `UPDATE mara_outreach_sequences SET next_run_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND worker_id = ?`,
    holdUntil,
    now,
    sequenceId,
    userId,
    workerId
  );
  return {
    status: "draft_pending",
    attemptCount,
    proposedFollowUp: nextStep,
    requiresApproval: true,
    nextRunAt: holdUntil,
    publicBrandId: row.public_brand_id || row.publicBrandId || null,
    contactId: row.contact_id || row.contactId || null,
    opportunityId: row.opportunity_id || row.opportunityId || null
  };
}

/** Call after an approved send so the next follow-up is scheduled. */
export async function advanceOutreachSequenceAfterSend(store, { userId, workerId, sequenceId = null, opportunityId = null }) {
  const row = sequenceId
    ? await store.queryOne(
        `SELECT * FROM mara_outreach_sequences WHERE id = ? AND user_id = ? AND worker_id = ?`,
        sequenceId,
        userId,
        workerId
      )
    : await store.queryOne(
        `SELECT * FROM mara_outreach_sequences
         WHERE user_id = ? AND worker_id = ? AND opportunity_id = ? AND status = 'active'
         ORDER BY updated_at DESC LIMIT 1`,
        userId,
        workerId,
        opportunityId
      );
  if (!row || row.status !== "active") return null;
  const steps = typeof row.steps_json === "object" ? row.steps_json : JSON.parse(row.steps_json || "[]");
  const attemptCount = Number(row.attempt_count || 0) + 1;
  const now = new Date();
  if (attemptCount >= Number(row.max_attempts || 3)) {
    await stopOutreachSequence(store, {
      userId,
      workerId,
      sequenceId: row.id,
      reason: SEQUENCE_STOP_REASONS.MAX_ATTEMPTS
    });
    return { status: "stopped", reason: SEQUENCE_STOP_REASONS.MAX_ATTEMPTS, attemptCount };
  }
  const nextStep = steps[Math.min(attemptCount, steps.length - 1)];
  const nextRun = new Date(now.getTime() + (nextStep?.offsetDays || 7) * 86_400_000).toISOString();
  await store.execute(
    `UPDATE mara_outreach_sequences SET attempt_count = ?, next_run_at = ?, updated_at = ? WHERE id = ?`,
    attemptCount,
    nextRun,
    now.toISOString(),
    row.id
  );
  return { status: "active", attemptCount, nextRunAt: nextRun, sequenceId: row.id };
}

export function shouldStopOnReply(threadText = "") {
  const text = String(threadText || "");
  if (!text.trim()) return false;
  // Any inbound brand reply associated with the opportunity should stop the sequence.
  return true;
}
