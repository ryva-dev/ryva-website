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
import {
  completeWorkerTask,
  createApprovalRequest,
  createApprovedTaskIfPermissionAllows,
  createWorkerActivityLog,
  createWorkerOutput,
  ensureWorkerPermissions,
  listApprovalRequests,
  listWorkerOutputs,
  listWorkerTasksForUserWorker,
  updateWorkerTaskStatus
} from "./workerEngine.mjs";

function nowIso() {
  return new Date().toISOString();
}

function normalizeTitle(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

export function buildAgentBrandContext({ db, userId, workerId, readers = {} }) {
  const accountOnboarding = typeof readers.readAccountContext === "function" ? readers.readAccountContext(userId) : null;
  const workerOnboarding = typeof readers.readMaraOnboarding === "function" ? readers.readMaraOnboarding(userId, workerId) : null;
  const knowledgeSections = typeof readers.readWorkerKnowledge === "function" ? readers.readWorkerKnowledge(userId, workerId) : [];
  const integrations = typeof readers.readConnectedIntegrations === "function" ? readers.readConnectedIntegrations(userId, workerId) : [];
  const recentMessages = typeof readers.readMessages === "function" ? readers.readMessages(userId, workerId) : [];

  return buildBrandContext({
    accountOnboarding,
    workerOnboardingAnswers: workerOnboarding?.answers ?? {},
    knowledgeSections,
    recentOutputs: listWorkerOutputs(db, userId, workerId),
    openTasks: listWorkerTasksForUserWorker(db, userId, workerId).filter((task) =>
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
export async function runAgentTask({ db, userId, workerId, taskId, readers = {}, fetchImpl }) {
  const roleConfig = getRoleConfig(workerId);
  if (!roleConfig) {
    throw new Error("No role configuration for this worker.");
  }

  const task = listWorkerTasksForUserWorker(db, userId, workerId).find((entry) => entry.id === taskId);
  if (!task) {
    throw new Error("Worker task not found.");
  }
  if (!["approved", "in_progress"].includes(task.status)) {
    throw new Error("Only approved or in-progress tasks can be executed.");
  }

  ensureWorkerPermissions(db, userId, workerId);
  updateWorkerTaskStatus(db, userId, workerId, taskId, "in_progress");
  createWorkerActivityLog(db, {
    description: `Started ${task.title}.`,
    eventType: "task_execution_started",
    relatedTaskId: taskId,
    title: task.title,
    userId,
    workerId
  });

  const brandContext = buildAgentBrandContext({ db, userId, workerId, readers });
  const llmResult = await tryExecuteAgentTaskLlm({ db, userId, roleConfig, task, brandContext, fetchImpl });

  if (!llmResult) {
    // Honest degradation: labeled placeholder, task stays approved for retry.
    const placeholder = buildPlaceholderOutput(roleConfig, task);
    const savedOutput = createWorkerOutput(db, {
      content: placeholder.content,
      outputType: placeholder.outputType,
      source: "task_execution",
      structuredContent: placeholder.structuredContent,
      taskId,
      title: placeholder.title,
      userId,
      workerId
    });
    updateWorkerTaskStatus(db, userId, workerId, taskId, "approved");
    createWorkerActivityLog(db, {
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
      task: listWorkerTasksForUserWorker(db, userId, workerId).find((entry) => entry.id === taskId)
    };
  }

  const savedOutput = createWorkerOutput(db, {
    content: llmResult.content,
    outputType: llmResult.outputType,
    source: "task_execution",
    structuredContent: llmResult.structuredContent,
    taskId,
    title: llmResult.title || task.title,
    userId,
    workerId
  });
  completeWorkerTask(
    db,
    userId,
    workerId,
    taskId,
    JSON.stringify({
      outputId: savedOutput.id,
      preview: String(llmResult.content).slice(0, 280),
      title: savedOutput.title,
      type: savedOutput.outputType
    })
  );
  createWorkerActivityLog(db, {
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
    task: listWorkerTasksForUserWorker(db, userId, workerId).find((entry) => entry.id === taskId)
  };
}

/* ------------------------------------------------------------------ */
/* Autonomy                                                            */
/* ------------------------------------------------------------------ */

function ensureStarterTasks(db, userId, workerId, roleConfig, existingTasks) {
  const createdIds = [];
  const existingTitles = new Set(existingTasks.map((task) => normalizeTitle(task.title)));
  for (const taskTypeId of roleConfig.starterTaskTypes ?? []) {
    const typeConfig = getRoleTaskType(roleConfig, taskTypeId);
    if (!typeConfig) continue;
    const title = typeConfig.label;
    if (existingTitles.has(normalizeTitle(title))) continue;
    const alreadyDelivered = listWorkerOutputs(db, userId, workerId).some(
      (output) => output.outputType === typeConfig.outputType
    );
    if (alreadyDelivered) continue;
    const created = createApprovedTaskIfPermissionAllows(db, {
      description: typeConfig.description,
      priority: "high",
      requiredPermissions: [],
      source: "autonomy_starter",
      status: "approved",
      taskType: taskTypeId,
      title,
      userId,
      workerId
    });
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
export async function runAgentAutonomyCycle({ db, userId, workerId, readers = {}, fetchImpl, maxExecutions = 3 }) {
  const roleConfig = getRoleConfig(workerId);
  if (!roleConfig) {
    throw new Error("No role configuration for this worker.");
  }

  ensureWorkerPermissions(db, userId, workerId);
  const summary = {
    blockers: [],
    createdTaskIds: [],
    executedTaskIds: [],
    mode: "full",
    notes: [],
    outputs: [],
    plannedActions: []
  };

  const existingTasks = listWorkerTasksForUserWorker(db, userId, workerId);
  summary.createdTaskIds.push(...ensureStarterTasks(db, userId, workerId, roleConfig, existingTasks));

  // LLM planning for anything beyond starters.
  if (isAgentLlmConfigured()) {
    const brandContext = buildAgentBrandContext({ db, userId, workerId, readers });
    const planResult = await tryPlanAutonomyLlm({ db, userId, roleConfig, brandContext, fetchImpl });
    if (planResult) {
      const currentTitles = new Set(
        listWorkerTasksForUserWorker(db, userId, workerId).map((task) => normalizeTitle(task.title))
      );
      for (const planned of planResult.plan) {
        summary.plannedActions.push(planned.taskType);
        if (currentTitles.has(normalizeTitle(planned.title))) continue;
        const created = createApprovedTaskIfPermissionAllows(db, {
          description: planned.description || planned.reason,
          priority: "medium",
          requiredPermissions: [],
          source: "autonomy_planned",
          status: "approved",
          taskType: planned.taskType,
          title: planned.title,
          userId,
          workerId
        });
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
  const runnable = listWorkerTasksForUserWorker(db, userId, workerId)
    .filter((task) => task.status === "approved")
    .filter((task) => {
      const typeConfig = getRoleTaskType(roleConfig, task.taskType);
      return typeConfig ? typeConfig.safeAutoExecute : false;
    })
    .slice(0, maxExecutions);

  for (const task of runnable) {
    try {
      const result = await runAgentTask({ db, userId, workerId, taskId: task.id, readers, fetchImpl });
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

  createWorkerActivityLog(db, {
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
export async function handleAgentChatMessage({ db, userId, workerId, message, readers = {}, fetchImpl }) {
  const roleConfig = getRoleConfig(workerId);
  if (!roleConfig || !isAgentLlmConfigured()) {
    return null;
  }

  ensureWorkerPermissions(db, userId, workerId);
  const brandContext = buildAgentBrandContext({ db, userId, workerId, readers });
  const interpretation = await tryInterpretChatMessageLlm({ db, userId, roleConfig, message, brandContext, fetchImpl });
  if (!interpretation) {
    return null;
  }

  const createdTaskIds = [];
  const existingTitles = new Set(
    listWorkerTasksForUserWorker(db, userId, workerId).map((task) => normalizeTitle(task.title))
  );
  for (const task of interpretation.tasksToCreate) {
    if (existingTitles.has(normalizeTitle(task.title))) continue;
    const created = createApprovedTaskIfPermissionAllows(db, {
      description: task.description,
      priority: task.priority,
      requiredPermissions: [],
      source: "chat_direct_request",
      status: "approved",
      taskType: task.taskType,
      title: task.title,
      userId,
      workerId
    });
    if (created?.id && !created.duplicate) {
      createdTaskIds.push(created.id);
      createWorkerActivityLog(db, {
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
    listApprovalRequests(db, userId, workerId)
      .filter((entry) => entry.status === "pending")
      .map((entry) => normalizeTitle(entry.title))
  );
  for (const request of interpretation.approvalRequests) {
    if (pendingApprovalTitles.has(normalizeTitle(request.title))) continue;
    createApprovalRequest(db, {
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
