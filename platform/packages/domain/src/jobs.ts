import type { Database, Transaction } from "../../database/src/index.js";
import { oneOrNone, withTransaction } from "../../database/src/index.js";
import { newId } from "../../shared/src/index.js";

export type DurableJob = {
  id: string;
  workspaceId: string | null;
  kind: string;
  payload: Record<string, unknown>;
  status: "queued" | "running" | "completed" | "dead" | "canceled";
  attempts: number;
  maxAttempts: number;
  leaseOwner: string | null;
};

export async function enqueueJob(
  client: Database | Transaction,
  input: {
    workspaceId?: string | null;
    kind: string;
    payload?: Record<string, unknown>;
    idempotencyKey: string;
    maxAttempts?: number;
    availableAt?: Date;
  }
): Promise<{ id: string; inserted: boolean }> {
  const id = newId();
  const result = await client.query<{ id: string }>(
    `INSERT INTO durable_jobs
      (id, workspace_id, kind, payload, idempotency_key, status, max_attempts, available_at)
     VALUES ($1,$2,$3,$4,$5,'queued',$6,$7)
     ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
    [
      id,
      input.workspaceId ?? null,
      input.kind,
      input.payload ?? {},
      input.idempotencyKey,
      input.maxAttempts ?? 5,
      input.availableAt ?? new Date()
    ]
  );
  if (result.rows[0]) return { id: result.rows[0].id, inserted: true };
  const existing = await oneOrNone<{ id: string }>(
    client,
    "SELECT id FROM durable_jobs WHERE idempotency_key = $1",
    [input.idempotencyKey]
  );
  if (!existing) throw new Error("Idempotent job lookup failed.");
  return { id: existing.id, inserted: false };
}

export async function claimJobs(
  database: Database,
  owner: string,
  options: { limit?: number; leaseMs?: number } = {}
): Promise<DurableJob[]> {
  const limit = Math.min(Math.max(options.limit ?? 10, 1), 50);
  const leaseMs = Math.max(options.leaseMs ?? 60_000, 5_000);
  return withTransaction(database, async (transaction) => {
    const result = await transaction.query<DurableJob>(
      `WITH candidates AS (
         SELECT id FROM durable_jobs
          WHERE attempts < max_attempts AND available_at <= now()
            AND (status = 'queued' OR (status = 'running' AND lease_expires_at < now()))
          ORDER BY available_at, created_at FOR UPDATE SKIP LOCKED LIMIT $1
       )
       UPDATE durable_jobs j
          SET status='running', attempts=attempts+1, lease_owner=$2,
              lease_expires_at=now()+($3 * interval '1 millisecond'), updated_at=now()
         FROM candidates c WHERE j.id=c.id
       RETURNING j.id, j.workspace_id AS "workspaceId", j.kind, j.payload, j.status,
                 j.attempts, j.max_attempts AS "maxAttempts", j.lease_owner AS "leaseOwner"`,
      [limit, owner, leaseMs]
    );
    return result.rows;
  });
}

export async function completeJob(
  database: Database,
  jobId: string,
  owner: string,
  result: Record<string, unknown> = {}
): Promise<boolean> {
  const update = await database.query(
    `UPDATE durable_jobs SET status='completed', result=$3, completed_at=now(),
            lease_owner=NULL, lease_expires_at=NULL, updated_at=now()
      WHERE id=$1 AND status='running' AND lease_owner=$2`,
    [jobId, owner, result]
  );
  return update.rowCount === 1;
}

export async function failJob(
  database: Database,
  jobId: string,
  owner: string,
  errorCode: string,
  safeMessage: string,
  retryDelayMs = 30_000
): Promise<boolean> {
  const result = await database.query(
    `UPDATE durable_jobs
        SET status=CASE WHEN attempts >= max_attempts THEN 'dead' ELSE 'queued' END,
            available_at=now()+($5 * greatest(attempts,1) * interval '1 millisecond'),
            lease_owner=NULL, lease_expires_at=NULL, last_error_code=$3,
            last_error_safe=$4, updated_at=now()
      WHERE id=$1 AND status='running' AND lease_owner=$2`,
    [jobId, owner, errorCode.slice(0, 100), safeMessage.slice(0, 500), retryDelayMs]
  );
  return result.rowCount === 1;
}

export async function retryDeadJob(database: Database, jobId: string): Promise<boolean> {
  const result = await database.query(
    `UPDATE durable_jobs SET status='queued', attempts=0, available_at=now(),
            lease_owner=NULL, lease_expires_at=NULL, last_error_code=NULL,
            last_error_safe=NULL, updated_at=now()
      WHERE id=$1 AND status='dead'`,
    [jobId]
  );
  return result.rowCount === 1;
}
