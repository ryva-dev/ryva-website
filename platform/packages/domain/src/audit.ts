import type { Database, Transaction } from "../../database/src/index.js";
import { newId } from "../../shared/src/index.js";
import { publicDigest } from "./crypto.js";

export type AuditInput = {
  workspaceId?: string | null;
  actorUserId?: string | null;
  actorType: "user" | "system" | "provider" | "job";
  action: string;
  targetType: string;
  targetId: string;
  origin: string;
  requestId: string;
  outcome: "succeeded" | "denied" | "failed";
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
};

function digest(value: unknown): string | null {
  return value === undefined ? null : publicDigest(JSON.stringify(value));
}

export async function recordAudit(
  client: Database | Transaction,
  input: AuditInput
): Promise<string> {
  const id = newId();
  await client.query(
    `INSERT INTO audit_events
      (id, workspace_id, actor_user_id, actor_type, action, target_type, target_id,
       origin, request_id, outcome, before_digest, after_digest, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      id,
      input.workspaceId ?? null,
      input.actorUserId ?? null,
      input.actorType,
      input.action,
      input.targetType,
      input.targetId,
      input.origin,
      input.requestId,
      input.outcome,
      digest(input.before),
      digest(input.after),
      input.metadata ?? {}
    ]
  );
  return id;
}
