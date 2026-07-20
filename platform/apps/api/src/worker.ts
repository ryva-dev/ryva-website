import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { config } from "../../../packages/config/src/index.js";
import { createDatabase } from "../../../packages/database/src/index.js";
import {
  claimJobs,
  completeJob,
  createLogger,
  failJob,
  generateAiSuggestion,
  refreshAnalyticsAlerts,
  scheduleDailyAnalyticsRefreshes,
  processCommercialJob,
  processWorkspaceExport,
  processOutreachSend,
  processSequenceStep,
  recordAudit
} from "../../../packages/domain/src/index.js";
import {
  ConfiguredAiProvider,
  ConfiguredEmailProvider,
  ConfiguredObjectStorage
} from "./providers.js";
import { loadDocumentAiAttachment } from "./phase7Routes.js";

const configuration = config();
const logger = createLogger(configuration);
const database = createDatabase(configuration);
const emailProvider = new ConfiguredEmailProvider(configuration);
const aiProvider = new ConfiguredAiProvider(configuration);
const objectStorage = new ConfiguredObjectStorage(configuration);
const owner = `worker:${randomUUID()}`;
let stopping = false;

function payloadString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});

async function processJob(job: Awaited<ReturnType<typeof claimJobs>>[number]): Promise<void> {
  try {
    if (job.kind === "session.cleanup") {
      const result = await database.query(
        "DELETE FROM sessions WHERE expires_at < now() - interval '30 days'"
      );
      await completeJob(database, job.id, owner, { deleted: result.rowCount ?? 0 });
    } else if (job.kind === "rate_limit.cleanup") {
      const result = await database.query("DELETE FROM rate_limit_buckets WHERE reset_at < now()");
      await completeJob(database, job.id, owner, { deleted: result.rowCount ?? 0 });
    } else if (job.kind === "outreach.send") {
      if (!job.workspaceId) throw new Error("Outreach send requires a workspace.");
      const messageId = payloadString(job.payload.messageId);
      const actorUserId = payloadString(job.payload.actorUserId);
      const result = await processOutreachSend(database, emailProvider, {
        workspaceId: job.workspaceId,
        messageId,
        actorUserId
      });
      await completeJob(database, job.id, owner, result);
    } else if (job.kind === "outreach.sequence_step") {
      if (!job.workspaceId) throw new Error("Outreach sequence step requires a workspace.");
      const result = await processSequenceStep(database, {
        workspaceId: job.workspaceId,
        enrollmentId: payloadString(job.payload.enrollmentId),
        actorUserId: payloadString(job.payload.actorUserId)
      });
      await completeJob(database, job.id, owner, result);
    } else if (job.kind === "ai.document_extraction") {
      if (!job.workspaceId) throw new Error("AI document extraction requires a workspace.");
      const documentId = payloadString(job.payload.documentId);
      const actorUserId = payloadString(job.payload.actorUserId);
      const attachment = await loadDocumentAiAttachment(
        database,
        objectStorage,
        job.workspaceId,
        documentId
      );
      const result = await generateAiSuggestion(database, aiProvider, {
        workspaceId: job.workspaceId,
        actorUserId,
        requestId: job.id,
        useCase: "document_extraction",
        targetType: "document",
        targetId: documentId,
        instruction:
          "Extract reviewable field candidates with exact source locations. Do not apply or interpret any term.",
        maxContextItems: configuration.AI_MAX_CONTEXT_ITEMS,
        attachment
      });
      await completeJob(database, job.id, owner, {
        suggestionId: String((result.suggestion as Record<string, unknown>).id)
      });
    } else if (job.kind === "analytics.priority_refresh") {
      if (!job.workspaceId) throw new Error("Analytics refresh requires a workspace.");
      const userId=payloadString(job.payload.userId);
      const result=await refreshAnalyticsAlerts(database,{
        workspaceId:job.workspaceId,userId,requestId:job.id
      });
      const next=new Date();
      next.setUTCDate(next.getUTCDate()+1);
      next.setUTCHours(8,0,0,0);
      await scheduleDailyAnalyticsRefreshes(database,next);
      await completeJob(database,job.id,owner,result);
    } else if (job.kind === "data_export.generate") {
      const result=await processWorkspaceExport(database,payloadString(job.payload.exportId));
      await completeJob(database,job.id,owner,result);
    } else if ([
      "commerce.protection_expiring",
      "commerce.protection_expired",
      "commerce.reorder_due",
      "commerce.commission_due"
    ].includes(job.kind)) {
      if (!job.workspaceId) throw new Error("Commercial review requires a workspace.");
      const result = await processCommercialJob(database, {
        workspaceId: job.workspaceId,
        kind: job.kind as
          | "commerce.protection_expiring"
          | "commerce.protection_expired"
          | "commerce.reorder_due"
          | "commerce.commission_due",
        payload: job.payload,
        requestId: job.id
      });
      await completeJob(database, job.id, owner, result);
    } else {
      await failJob(database, job.id, owner, "unknown_job_kind", "No registered handler exists.", 60_000);
      return;
    }
    await recordAudit(database, {
      workspaceId: job.workspaceId,
      actorType: "job",
      action: "job.completed",
      targetType: "durable_job",
      targetId: job.id,
      origin: owner,
      requestId: job.id,
      outcome: "succeeded",
      metadata: { kind: job.kind, attempt: job.attempts }
    });
  } catch (error) {
    await failJob(
      database,
      job.id,
      owner,
      "handler_failed",
      "The job handler failed and will retry."
    );
    logger.error("job.failed", {
      jobId: job.id,
      kind: job.kind,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

await scheduleDailyAnalyticsRefreshes(database);
while (!stopping) {
  const jobs = await claimJobs(database, owner);
  if (jobs.length === 0) {
    await delay(configuration.JOB_POLL_INTERVAL_MS);
    continue;
  }
  for (const job of jobs) {
    if (stopping) break;
    await processJob(job);
  }
}

await database.end();
