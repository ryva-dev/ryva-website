import type { Database } from "../../database/src/index.js";
import { withTransaction } from "../../database/src/index.js";
import { AppError, newId } from "../../shared/src/index.js";
import { recordAudit } from "./audit.js";
import { getCoreRecord, type CoreRecordType } from "./records.js";

async function requireSubject(
  database: Database,
  workspaceId: string,
  subjectType: CoreRecordType,
  subjectId: string
): Promise<void> {
  if (!(await getCoreRecord(database, workspaceId, subjectType, subjectId))) {
    throw new AppError(404, "record_not_found", "Record not found.");
  }
}

export async function createSource(
  database: Database,
  input: {
    workspaceId: string;
    actorUserId: string;
    requestId: string;
    sourceType: string;
    reference: string;
    url?: string | null | undefined;
    ownerOrProvider: string;
    rightsClassification: string;
    confidentiality: string;
    observedFrom?: string | null | undefined;
    observedTo?: string | null | undefined;
  }
): Promise<Record<string, unknown>> {
  const id = newId();
  const result = await database.query(
    `INSERT INTO sources
      (id,workspace_id,source_type,reference,url,owner_or_provider,rights_classification,
       confidentiality,observed_from,observed_to,status,created_by)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active',$11)
     RETURNING id,source_type AS "sourceType",reference,url,
       owner_or_provider AS "ownerOrProvider",rights_classification AS "rightsClassification",
       confidentiality,captured_at AS "capturedAt",status,version`,
    [
      id,
      input.workspaceId,
      input.sourceType,
      input.reference,
      input.url ?? null,
      input.ownerOrProvider,
      input.rightsClassification,
      input.confidentiality,
      input.observedFrom ?? null,
      input.observedTo ?? null,
      input.actorUserId
    ]
  );
  await recordAudit(database, {
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    actorType: "user",
    action: "source.created",
    targetType: "source",
    targetId: id,
    origin: "api",
    requestId: input.requestId,
    outcome: "succeeded",
    after: result.rows[0]
  });
  return result.rows[0] as Record<string, unknown>;
}

export async function createEvidence(
  database: Database,
  input: {
    workspaceId: string;
    actorUserId: string;
    requestId: string;
    subjectType: CoreRecordType;
    subjectId: string;
    exactClaim: string;
    evidenceClass: string;
    verificationStatus: string;
    sourceId?: string | null | undefined;
    unknownReason?: string | null | undefined;
    supports: string;
    doesNotSupport: string;
    confidence: string;
    context: string;
    limitations: string;
    contraryEvidence: string;
    permittedUse: string;
    prohibitedInference: string;
    observedAt?: string | null | undefined;
    reassessAt?: string | null | undefined;
  }
): Promise<Record<string, unknown>> {
  await requireSubject(database, input.workspaceId, input.subjectType, input.subjectId);
  if (input.sourceId) {
    const source = await database.query(
      "SELECT id FROM sources WHERE id=$1 AND workspace_id=$2 AND status<>'deleted'",
      [input.sourceId, input.workspaceId]
    );
    if (!source.rows[0]) throw new AppError(422, "source_not_found", "Evidence source was not found.");
  }
  const id = newId();
  return withTransaction(database, async (transaction) => {
    const result = await transaction.query(
      `INSERT INTO evidence_records
        (id,workspace_id,subject_type,subject_id,exact_claim,evidence_class,
         verification_status,source_id,unknown_reason,supports,does_not_support,confidence,
         context,limitations,contrary_evidence,permitted_use,prohibited_inference,
         observed_at,reassess_at,reviewed_by,status)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,'current')
       RETURNING *`,
      [
        id,
        input.workspaceId,
        input.subjectType,
        input.subjectId,
        input.exactClaim,
        input.evidenceClass,
        input.verificationStatus,
        input.sourceId ?? null,
        input.unknownReason ?? null,
        input.supports,
        input.doesNotSupport,
        input.confidence,
        input.context,
        input.limitations,
        input.contraryEvidence,
        input.permittedUse,
        input.prohibitedInference,
        input.observedAt ?? null,
        input.reassessAt ?? null,
        input.actorUserId
      ]
    );
    await transaction.query(
      `INSERT INTO activities
        (id,workspace_id,activity_type,actor_user_id,subject_type,subject_id,summary,status,metadata)
       VALUES($1,$2,'evidence_added',$3,$4,$5,$6,'completed',$7)`,
      [
        newId(),
        input.workspaceId,
        input.actorUserId,
        input.subjectType,
        input.subjectId,
        input.exactClaim,
        { evidenceId: id, class: input.evidenceClass, confidence: input.confidence }
      ]
    );
    await recordAudit(transaction, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      actorType: "user",
      action: "evidence.created",
      targetType: "evidence_record",
      targetId: id,
      origin: "api",
      requestId: input.requestId,
      outcome: "succeeded",
      after: result.rows[0]
    });
    return result.rows[0] as Record<string, unknown>;
  });
}

export async function createNote(
  database: Database,
  input: {
    workspaceId: string;
    actorUserId: string;
    requestId: string;
    subjectType: CoreRecordType;
    subjectId: string;
    body: string;
    noteType: string;
    pinned: boolean;
  }
): Promise<Record<string, unknown>> {
  await requireSubject(database, input.workspaceId, input.subjectType, input.subjectId);
  const id = newId();
  return withTransaction(database, async (transaction) => {
    const result = await transaction.query(
      `INSERT INTO notes(id,workspace_id,subject_type,subject_id,author_user_id,note_type,body,pinned)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id,note_type AS "noteType",body,pinned,version,created_at AS "createdAt"`,
      [
        id,
        input.workspaceId,
        input.subjectType,
        input.subjectId,
        input.actorUserId,
        input.noteType,
        input.body,
        input.pinned
      ]
    );
    await transaction.query(
      `INSERT INTO note_versions(id,note_id,body,version,changed_by) VALUES($1,$2,$3,1,$4)`,
      [newId(), id, input.body, input.actorUserId]
    );
    await transaction.query(
      `INSERT INTO activities
        (id,workspace_id,activity_type,actor_user_id,subject_type,subject_id,summary,status,metadata)
       VALUES($1,$2,'note_added',$3,$4,$5,'Note added','completed',$6)`,
      [newId(), input.workspaceId, input.actorUserId, input.subjectType, input.subjectId, { noteId: id }]
    );
    await recordAudit(transaction, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      actorType: "user",
      action: "note.created",
      targetType: "note",
      targetId: id,
      origin: "api",
      requestId: input.requestId,
      outcome: "succeeded",
      after: result.rows[0]
    });
    return result.rows[0] as Record<string, unknown>;
  });
}

export async function createTask(
  database: Database,
  input: {
    workspaceId: string;
    actorUserId: string;
    requestId: string;
    subjectType: CoreRecordType;
    subjectId: string;
    title: string;
    priority: string;
    dueAt?: string | null | undefined;
    createdReason: string;
    mandatoryGate: boolean;
  }
): Promise<Record<string, unknown>> {
  await requireSubject(database, input.workspaceId, input.subjectType, input.subjectId);
  const id = newId();
  return withTransaction(database, async (transaction) => {
    const result = await transaction.query(
      `INSERT INTO tasks
        (id,workspace_id,subject_type,subject_id,title,owner_user_id,status,priority,
         created_reason,due_at,mandatory_gate)
       VALUES($1,$2,$3,$4,$5,$6,'open',$7,$8,$9,$10)
       RETURNING id,title,status,priority,due_at AS "dueAt",mandatory_gate AS "mandatoryGate",
         version,created_at AS "createdAt"`,
      [
        id,
        input.workspaceId,
        input.subjectType,
        input.subjectId,
        input.title,
        input.actorUserId,
        input.priority,
        input.createdReason,
        input.dueAt ?? null,
        input.mandatoryGate
      ]
    );
    await transaction.query(
      `INSERT INTO activities
        (id,workspace_id,activity_type,actor_user_id,subject_type,subject_id,summary,status,metadata)
       VALUES($1,$2,'task_created',$3,$4,$5,$6,'completed',$7)`,
      [newId(), input.workspaceId, input.actorUserId, input.subjectType, input.subjectId, input.title, { taskId: id }]
    );
    await recordAudit(transaction, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      actorType: "user",
      action: "task.created",
      targetType: "task",
      targetId: id,
      origin: "api",
      requestId: input.requestId,
      outcome: "succeeded",
      after: result.rows[0]
    });
    return result.rows[0] as Record<string, unknown>;
  });
}

export async function updateTaskStatus(
  database: Database,
  input: {
    workspaceId: string;
    actorUserId: string;
    requestId: string;
    taskId: string;
    version: number;
    status: "open" | "in_progress" | "blocked" | "completed" | "canceled";
    completionEvidence?: string | null | undefined;
    blocker?: string | null | undefined;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const beforeResult = await transaction.query(
      "SELECT * FROM tasks WHERE id=$1 AND workspace_id=$2 FOR UPDATE",
      [input.taskId, input.workspaceId]
    );
    const before = beforeResult.rows[0] as Record<string, unknown> | undefined;
    if (!before) throw new AppError(404, "task_not_found", "Task not found.");
    if (before.mandatory_gate === true && input.status === "canceled") {
      throw new AppError(
        409,
        "mandatory_task_cannot_cancel",
        "Resolve the source condition before closing this mandatory task."
      );
    }
    if (input.status === "completed" && !input.completionEvidence) {
      throw new AppError(422, "completion_evidence_required", "Completion evidence is required.");
    }
    if (input.status === "blocked" && !input.blocker) {
      throw new AppError(422, "blocker_required", "A blocker is required.");
    }
    const result = await transaction.query(
      `UPDATE tasks SET status=$4,completion_evidence=$5,blocker=$6,
              completed_at=CASE WHEN $4='completed' THEN now() ELSE NULL END,
              version=version+1,updated_at=now()
        WHERE id=$1 AND workspace_id=$2 AND version=$3
       RETURNING id,title,status,priority,due_at AS "dueAt",blocker,
         completion_evidence AS "completionEvidence",version,updated_at AS "updatedAt"`,
      [
        input.taskId,
        input.workspaceId,
        input.version,
        input.status,
        input.completionEvidence ?? null,
        input.blocker ?? null
      ]
    );
    if (!result.rows[0]) throw new AppError(409, "version_conflict", "Task changed. Reload before updating.");
    await transaction.query(
      `INSERT INTO activities
        (id,workspace_id,activity_type,actor_user_id,subject_type,subject_id,summary,status,metadata)
       VALUES($1,$2,'task_status_changed',$3,$4,$5,$6,'completed',$7)`,
      [
        newId(),
        input.workspaceId,
        input.actorUserId,
        before.subject_type,
        before.subject_id,
        `Task ${input.status.replaceAll("_", " ")}`,
        { taskId: input.taskId, from: before.status, to: input.status }
      ]
    );
    await recordAudit(transaction, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      actorType: "user",
      action: "task.status_changed",
      targetType: "task",
      targetId: input.taskId,
      origin: "api",
      requestId: input.requestId,
      outcome: "succeeded",
      before,
      after: result.rows[0]
    });
    return result.rows[0] as Record<string, unknown>;
  });
}

export async function createRisk(
  database: Database,
  input: {
    workspaceId: string;
    actorUserId: string;
    requestId: string;
    subjectType: CoreRecordType;
    subjectId: string;
    riskType: string;
    severity: string;
    description: string;
    mitigation: string;
    dueAt?: string | null | undefined;
  }
): Promise<Record<string, unknown>> {
  await requireSubject(database, input.workspaceId, input.subjectType, input.subjectId);
  const id = newId();
  return withTransaction(database, async (transaction) => {
    const result = await transaction.query(
    `INSERT INTO risk_flags
      (id,workspace_id,subject_type,subject_id,risk_type,severity,status,owner_user_id,
       description,mitigation,due_at)
     VALUES($1,$2,$3,$4,$5,$6,'open',$7,$8,$9,$10) RETURNING *`,
    [
      id,
      input.workspaceId,
      input.subjectType,
      input.subjectId,
      input.riskType,
      input.severity,
      input.actorUserId,
      input.description,
      input.mitigation,
      input.dueAt ?? null
    ]
  );
    await transaction.query(
    `INSERT INTO activities
      (id,workspace_id,activity_type,actor_user_id,subject_type,subject_id,summary,status,metadata)
     VALUES($1,$2,'risk_flagged',$3,$4,$5,$6,'completed',$7)`,
    [newId(), input.workspaceId, input.actorUserId, input.subjectType, input.subjectId, input.description, { riskId: id, severity: input.severity }]
  );
    await recordAudit(transaction, {
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    actorType: "user",
    action: "risk.created",
    targetType: "risk_flag",
    targetId: id,
    origin: "api",
    requestId: input.requestId,
    outcome: "succeeded",
    after: result.rows[0]
  });
    return result.rows[0] as Record<string, unknown>;
  });
}

export async function createDecision(
  database: Database,
  input: {
    workspaceId: string;
    actorUserId: string;
    requestId: string;
    subjectType: CoreRecordType;
    subjectId: string;
    question: string;
    scope: string;
    outcome: string;
    rationale: string;
    confidence: string;
    nextAction: string;
    status: "draft" | "issued";
  }
): Promise<Record<string, unknown>> {
  await requireSubject(database, input.workspaceId, input.subjectType, input.subjectId);
  const id = newId();
  return withTransaction(database, async (transaction) => {
    const result = await transaction.query(
    `INSERT INTO decision_records
      (id,workspace_id,subject_type,subject_id,question,scope,outcome,rationale,
       confidence,owner_user_id,decided_at,next_action,status)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
       CASE WHEN $12='issued' THEN now() ELSE NULL END,$11,$12) RETURNING *`,
    [
      id,
      input.workspaceId,
      input.subjectType,
      input.subjectId,
      input.question,
      input.scope,
      input.outcome,
      input.rationale,
      input.confidence,
      input.actorUserId,
      input.nextAction,
      input.status
    ]
  );
    await transaction.query(
    `INSERT INTO activities
      (id,workspace_id,activity_type,actor_user_id,subject_type,subject_id,summary,status,metadata)
     VALUES($1,$2,'decision_recorded',$3,$4,$5,$6,'completed',$7)`,
    [newId(), input.workspaceId, input.actorUserId, input.subjectType, input.subjectId, input.question, { decisionId: id, status: input.status }]
  );
    await recordAudit(transaction, {
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    actorType: "user",
    action: `decision.${input.status}`,
    targetType: "decision_record",
    targetId: id,
    origin: "api",
    requestId: input.requestId,
    outcome: "succeeded",
    after: result.rows[0]
  });
    return result.rows[0] as Record<string, unknown>;
  });
}
