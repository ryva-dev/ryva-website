/**
 * agentCore: role-generic orchestration for every Ryva employee.
 *
 * Mara keeps her specialized engine (inbox sync, live brand research, trend
 * snapshots) inside workerEngine.mjs. Everything else — and every future
 * employee — runs through this module:
 *
 *   chat message  -> handleAgentChatMessage (LLM interpretation + actions)
 *   autonomy tick -> runAgentAutonomyCycle  (LLM planning + execution)
 *   task run      -> runAgentTask           (LLM-first execution, honest fallback)
 *
 * Adding an employee requires only a role config in roles.mjs.
 */
import {
  buildBrandContext,
  buildPlaceholderOutput,
  isAgentLlmConfigured,
  tryExecuteAgentTaskLlm,
  tryInterpretChatMessageLlm,
  tryPlanAutonomyLlm
} from "./agentLlm.mjs";
import { getRoleConfig, getRoleTaskType } from "./roles.mjs";
import { appendActionAuditEvent, evaluateActionPolicy, initActionAudit } from "./actionPolicy.mjs";
import { wrapSqliteHandle } from "./dataStore.mjs";
import {
  appendAgentActivity,
  createAgentApproval,
  createAgentOutput,
  createAgentTask,
  ensureAgentPermissions,
  listAgentApprovals,
  listAgentKnowledge,
  listAgentOutputs,
  listAgentTasks,
  updateAgentTaskStatus
} from "./agentRepository.mjs";

function nowIso() {
  return new Date().toISOString();
}

function normalizeTitle(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

export async function buildAgentBrandContext({ store, userId, workerId, readers = {} }) {
  const accountOnboarding = typeof readers.readAccountContext === "function" ? await readers.readAccountContext(userId) : null;
  const workerOnboarding = typeof readers.readMaraOnboarding === "function" ? await readers.readMaraOnboarding(userId, workerId) : null;
  const knowledgeSections = typeof readers.readWorkerKnowledge === "function" ? await readers.readWorkerKnowledge(userId, workerId) : [];
  const integrations = typeof readers.readConnectedIntegrations === "function" ? await readers.readConnectedIntegrations(userId, workerId) : [];
  const recentMessages = typeof readers.readMessages === "function" ? await readers.readMessages(userId, workerId) : [];

  return buildBrandContext({
    accountOnboarding,
    workerOnboardingAnswers: workerOnboarding?.answers ?? {},
    professionalKnowledge: await listAgentKnowledge(store, { workerId, workerType: null }),
    knowledgeSections,
    recentOutputs: await listAgentOutputs(store, userId, workerId),
    openTasks: (await listAgentTasks(store, userId, workerId)).filter((task) =>
      ["proposed", "approved", "in_progress", "blocked"].includes(task.status)
    ),
    integrations,
    recentMessages
  });
}

/* ------------------------------------------------------------------ */
/* Task execution                                                      */
/* ------------------------------------------------------------------ */

/**
 * Execute one task for a role-config worker. LLM-first; if the LLM cannot
 * run, we store an honestly-labeled placeholder and keep the task open.
 */
export async function runAgentTask({ db, store = db ? wrapSqliteHandle(db) : null, userId, workerId, taskId, readers = {}, fetchImpl }) {
  const roleConfig = getRoleConfig(workerId);
  if (!roleConfig) {
    throw new Error("No role configuration for this worker.");
  }

  const task = (await listAgentTasks(store, userId, workerId)).find((entry) => entry.id === taskId);
  if (!task) {
    throw new Error("Worker task not found.");
  }
  if (!["approved", "in_progress"].includes(task.status)) {
    throw new Error("Only approved or in-progress tasks can be executed.");
  }

  await ensureAgentPermissions(store, userId, workerId);
  await updateAgentTaskStatus(store, userId, workerId, taskId, "in_progress");
  await appendAgentActivity(store, {
    description: `Started ${task.title}.`,
    eventType: "task_execution_started",
    relatedTaskId: taskId,
    title: task.title,
    userId,
    workerId
  });

  const brandContext = await buildAgentBrandContext({ store, userId, workerId, readers });
  const llmResult = await tryExecuteAgentTaskLlm({ db, userId, roleConfig, task, brandContext, fetchImpl });

  if (!llmResult) {
    // Honest degradation: labeled placeholder, task stays approved for retry.
    const placeholder = buildPlaceholderOutput(roleConfig, task);
    const savedOutput = await createAgentOutput(store, {
      content: placeholder.content,
      outputType: placeholder.outputType,
      source: "task_execution",
      structuredContent: placeholder.structuredContent,
      taskId,
      title: placeholder.title,
      userId,
      workerId
    });
    await updateAgentTaskStatus(store, userId, workerId, taskId, "approved");
    await appendAgentActivity(store, {
      description: "Deliverable deferred: reasoning engine unavailable or over budget.",
      eventType: "task_execution_blocked",
      metadata: { outputId: savedOutput.id, reason: "llm_unavailable" },
      relatedTaskId: taskId,
      title: task.title,
      userId,
      workerId
    });
    return {
      blockerReason: "My reasoning engine is offline or over its daily budget, so I can't produce this deliverable properly yet.",
      neededFromUser: "Configure the platform AI key (or wait for the daily budget to reset), then re-run this task.",
      output: savedOutput,
      suggestedNextStep: "Re-run the task once AI is available.",
      task: (await listAgentTasks(store, userId, workerId)).find((entry) => entry.id === taskId)
    };
  }

  const savedOutput = await createAgentOutput(store, {
    content: llmResult.content,
    outputType: llmResult.outputType,
    source: "task_execution",
    structuredContent: llmResult.structuredContent,
    taskId,
    title: llmResult.title || task.title,
    userId,
    workerId
  });
  await updateAgentTaskStatus(store, userId, workerId, taskId, "completed",
    JSON.stringify({
      outputId: savedOutput.id,
      preview: String(llmResult.content).slice(0, 280),
      title: savedOutput.title,
      type: savedOutput.outputType
    })
  );
  await appendAgentActivity(store, {
    description: `Finished ${task.title}.`,
    eventType: "task_execution_completed",
    metadata: { outputId: savedOutput.id, outputType: savedOutput.outputType },
    relatedTaskId: taskId,
    title: task.title,
    userId,
    workerId
  });

  return {
    output: savedOutput,
    task: (await listAgentTasks(store, userId, workerId)).find((entry) => entry.id === taskId)
  };
}

/* ------------------------------------------------------------------ */
/* Autonomy                                                            */
/* ------------------------------------------------------------------ */

async function ensureStarterTasks(store, userId, workerId, roleConfig, existingTasks, permissions) {
  const createdIds = [];
  const existingTitles = new Set(existingTasks.map((task) => normalizeTitle(task.title)));
  for (const taskTypeId of roleConfig.starterTaskTypes ?? []) {
    const typeConfig = getRoleTaskType(roleConfig, taskTypeId);
    if (!typeConfig) continue;
    const title = typeConfig.label;
    if (existingTitles.has(normalizeTitle(title))) continue;
    const alreadyDelivered = (await listAgentOutputs(store, userId, workerId)).some(
      (output) => output.outputType === typeConfig.outputType
    );
    if (alreadyDelivered) continue;
    const created = await createAgentTask(store, {
      description: typeConfig.description,
      priority: "high",
      requiredPermissions: [],
      source: "autonomy_starter",
      status: "approved",
      taskType: taskTypeId,
      title,
      userId,
      workerId
    }, permissions);
    if (created?.id && !created.duplicate) {
      createdIds.push(created.id);
    }
  }
  return createdIds;
}

/**
 * One autonomy cycle for a role-config worker (non-Mara).
 * Returns a summary shaped like Mara's cycle summary.
 */
export async function runAgentAutonomyCycle({ db, store = db ? wrapSqliteHandle(db) : null, userId, workerId, readers = {}, fetchImpl, maxExecutions = 3 }) {
  const roleConfig = getRoleConfig(workerId);
  if (!roleConfig) {
    throw new Error("No role configuration for this worker.");
  }

  const permissions = await ensureAgentPermissions(store, userId, workerId);
  await initActionAudit(store);
  const summary = {
    blockers: [],
    createdTaskIds: [],
    executedTaskIds: [],
    mode: "full",
    notes: [],
    outputs: [],
    plannedActions: []
  };

  const existingTasks = await listAgentTasks(store, userId, workerId);
  summary.createdTaskIds.push(...await ensureStarterTasks(store, userId, workerId, roleConfig, existingTasks, permissions));

  // LLM planning for anything beyond starters.
  if (isAgentLlmConfigured()) {
    const brandContext = await buildAgentBrandContext({ store, userId, workerId, readers });
    const planResult = await tryPlanAutonomyLlm({ db, userId, roleConfig, brandContext, fetchImpl });
    if (planResult) {
      const currentTitles = new Set(
        (await listAgentTasks(store, userId, workerId)).map((task) => normalizeTitle(task.title))
      );
      for (const planned of planResult.plan) {
        summary.plannedActions.push(planned.taskType);
        if (currentTitles.has(normalizeTitle(planned.title))) continue;
        const created = await createAgentTask(store, {
          description: planned.description || planned.reason,
          priority: "medium",
          requiredPermissions: [],
          source: "autonomy_planned",
          status: "approved",
          taskType: planned.taskType,
          title: planned.title,
          userId,
          workerId
        }, permissions);
        if (created?.id && !created.duplicate) {
          summary.createdTaskIds.push(created.id);
        }
      }
      if (planResult.skippedBecause) {
        summary.notes.push(planResult.skippedBecause);
      }
    }
  } else {
    summary.notes.push("Reasoning engine offline: only starter work was queued; no deliverables were generated.");
  }

  // Execute approved tasks, newest-first, bounded.
  const runnable = (await listAgentTasks(store, userId, workerId))
    .filter((task) => task.status === "approved")
    .filter((task) => {
      const typeConfig = getRoleTaskType(roleConfig, task.taskType);
      return typeConfig ? typeConfig.safeAutoExecute : false;
    })
    .slice(0, maxExecutions);

  for (const task of runnable) {
    const typeConfig = getRoleTaskType(roleConfig, task.taskType);
    const policy = evaluateActionPolicy({
      actionType: "internal_task",
      permissions,
      safeAutoExecute: Boolean(typeConfig?.safeAutoExecute)
    });
    await appendActionAuditEvent(store, {
      userId, workerId, taskId: task.id, actionType: "internal_task",
      decision: policy.allowed ? "allowed" : "denied", policyVersion: policy.policyVersion,
      reasons: policy.reasons, evidence: task.evidenceUsed || [], idempotencyKey: `task:${task.id}`
    });
    if (!policy.allowed) {
      summary.blockers.push(...policy.reasons);
      continue;
    }
    try {
      const result = await runAgentTask({ db, store, userId, workerId, taskId: task.id, readers, fetchImpl });
      if (result?.output && !result.blockerReason) {
        summary.executedTaskIds.push(task.id);
        summary.outputs.push(result.output);
      } else if (result?.blockerReason) {
        summary.blockers.push(result.blockerReason);
        break; // LLM is down/over budget; no point trying more tasks this cycle.
      }
    } catch (error) {
      summary.blockers.push(error instanceof Error ? error.message : "Task execution failed.");
    }
  }

  await appendAgentActivity(store, {
    description: `Cycle complete: ${summary.executedTaskIds.length} task(s) executed, ${summary.createdTaskIds.length} queued.`,
    eventType: "autonomy_cycle_completed",
    metadata: { blockers: summary.blockers, executed: summary.executedTaskIds.length },
    title: "Autonomy cycle",
    userId,
    workerId
  });

  return summary;
}

/* ------------------------------------------------------------------ */
/* Chat                                                                */
/* ------------------------------------------------------------------ */

/**
 * Interpret a manager chat message for any role-config worker.
 * Persists tasks/approvals; memories are returned for the caller to merge
 * (knowledge storage lives in the server layer).
 *
 * Returns null when the LLM is unavailable so the caller can fall back.
 */
export async function handleAgentChatMessage({ db, store = db ? wrapSqliteHandle(db) : null, userId, workerId, message, readers = {}, fetchImpl }) {
  const roleConfig = getRoleConfig(workerId);
  if (!roleConfig || !isAgentLlmConfigured()) {
    return null;
  }

  const permissions = await ensureAgentPermissions(store, userId, workerId);
  const brandContext = await buildAgentBrandContext({ store, userId, workerId, readers });
  const interpretation = await tryInterpretChatMessageLlm({ db, userId, roleConfig, message, brandContext, fetchImpl });
  if (!interpretation) {
    return null;
  }

  const createdTaskIds = [];
  const existingTitles = new Set(
    (await listAgentTasks(store, userId, workerId)).map((task) => normalizeTitle(task.title))
  );
  for (const task of interpretation.tasksToCreate) {
    if (existingTitles.has(normalizeTitle(task.title))) continue;
    const created = await createAgentTask(store, {
      description: task.description,
      priority: task.priority,
      requiredPermissions: [],
      source: "chat_direct_request",
      status: "approved",
      taskType: task.taskType,
      title: task.title,
      userId,
      workerId
    }, permissions);
    if (created?.id && !created.duplicate) {
      createdTaskIds.push(created.id);
      await appendAgentActivity(store, {
        description: message,
        eventType: "chat_task_created",
        metadata: { taskType: task.taskType },
        relatedTaskId: created.id,
        title: task.title,
        userId,
        workerId
      });
    }
  }

  const pendingApprovalTitles = new Set(
    (await listAgentApprovals(store, userId, workerId))
      .filter((entry) => entry.status === "pending")
      .map((entry) => normalizeTitle(entry.title))
  );
  for (const request of interpretation.approvalRequests) {
    if (pendingApprovalTitles.has(normalizeTitle(request.title))) continue;
    await createAgentApproval(store, {
      actionType: request.actionType,
      description: request.description,
      title: request.title,
      userId,
      workerId
    });
  }

  return {
    createdTaskIds,
    memoriesToSave: interpretation.memoriesToSave,
    reply: interpretation.clarifyingQuestion
      ? `${interpretation.reply}\n\n${interpretation.clarifyingQuestion}`
      : interpretation.reply
  };
}
