import { randomUUID } from "node:crypto";
import { ensureMaraRuntimeTables } from "./maraRuntimeStorage.mjs";
import { appendTaskAudit, dependenciesSatisfied, getTaskGraphTask } from "./maraTaskGraph.mjs";
import { isControlledExecutionTenant } from "./maraFeatureFlags.mjs";
import { shouldSuppressWork } from "./maraWorkloadPolicy.mjs";

const SAFE_KINDS = new Set(["monitoring", "research", "analysis", "deliverable_generation", "reassessment", "internal_update"]);
const SAFE_TOOLS = new Set(["internal_read", "internal_records", "internal_task_create", "internal_artifact", "analytics", "research", "contact_validation"]);
const EXTERNAL = /\b(send|email|message|dm|publish|post|purchase|accept|sign|submit|negotiate|delete)\b|gmail/i;

export function verifyExecutionPermission(task, { env = process.env, allowedUserIds, availableTools, budget = {}, currentBusinessState = {} } = {}) {
  const tenantAllowed = allowedUserIds ? allowedUserIds.includes(String(task.userId)) : isControlledExecutionTenant(task.userId, env);
  if (!tenantAllowed) return "Tenant is not allowlisted for controlled execution.";
  if (task.owner !== "mara") return "Only Mara-owned tasks can execute autonomously.";
  if (!SAFE_KINDS.has(task.taskKind)) return "Task kind is not internally executable.";
  if (task.approvalRequirement !== "none") return "Approval is required.";
  if (task.requiredTools.some((tool) => !SAFE_TOOLS.has(tool))) return "Task requests a prohibited tool.";
  if (availableTools && task.requiredTools.some((tool) => !availableTools.includes(tool))) return "A required tool is no longer available.";
  if (Number(task.estimatedMaraCostUsd || 0) > Number(budget.remainingUsd ?? Number.POSITIVE_INFINITY)) return "Task exceeds the remaining execution budget.";
  const obsolete = shouldSuppressWork(task, currentBusinessState, env);
  if (obsolete) return obsolete;
  if (EXTERNAL.test(`${task.title} ${task.description} ${task.completionCondition}`)) return "External action is prohibited.";
  if (task.expiresAt && new Date(task.expiresAt) <= new Date()) return "Task has expired.";
  return null;
}

async function claimTask(store, task) {
  const claimId = randomUUID(); const now = new Date().toISOString();
  const result = await store.execute("UPDATE agent_tasks_v2 SET status = 'running', execution_claim_id = ?, execution_claimed_at = ?, attempt_count = attempt_count + 1, updated_at = ? WHERE id = ? AND user_id = ? AND worker_id = ? AND status IN ('scheduled','ready','failed') AND execution_claim_id IS NULL", claimId, now, now, task.id, task.userId, task.workerId);
  return result.changes === 1 ? claimId : null;
}

export async function recoverStaleExecutionClaims(store, { olderThanMinutes = 15, now = new Date() } = {}) {
  await ensureMaraRuntimeTables(store);
  const cutoff = new Date(now.getTime() - olderThanMinutes * 60_000).toISOString();
  const rows = await store.query("SELECT * FROM agent_tasks_v2 WHERE status = 'running' AND execution_claimed_at < ?", cutoff);
  for (const row of rows) {
    await store.execute("UPDATE agent_tasks_v2 SET status = 'failed', execution_claim_id = NULL, execution_claimed_at = NULL, failure_state_json = ?, updated_at = ? WHERE id = ? AND status = 'running'", JSON.stringify({code:"stale_claim",retryable:true}),now.toISOString(),row.id);
    await appendTaskAudit(store,{userId:row.user_id,workerId:row.worker_id,taskId:row.id,eventType:"execution_recovered",fromStatus:"running",toStatus:"failed",reason:"Stale execution claim recovered after restart."});
  }
  return rows.length;
}

export async function executeInternalTask(store, { userId, workerId = "mara", taskId, executors = {}, env = process.env, allowedUserIds, availableTools, budget, currentBusinessState, timeoutMs = 30_000 }) {
  await ensureMaraRuntimeTables(store);
  let task = await getTaskGraphTask(store,{userId,workerId,taskId});
  if (!task) throw new Error("Task not found.");
  const denial = verifyExecutionPermission(task,{env,allowedUserIds,availableTools,budget,currentBusinessState});
  if (denial) return {status:"denied",reason:denial,task};
  if (!(await dependenciesSatisfied(store,task))) return {status:"blocked",reason:"Dependencies are not complete.",task};
  if (task.output && task.status === "completed") return {status:"reused",task};
  if (task.failureState?.retryable === false) return {status:"non_retryable",task};
  if (task.failureState?.retryAfter && new Date(task.failureState.retryAfter) > new Date()) return {status:"backoff",retryAfter:task.failureState.retryAfter,task};
  const maxAttempts = Number(task.retryPolicy.maxAttempts || 3);
  if (task.attemptCount >= maxAttempts) return {status:"exhausted",task};
  const claimId = await claimTask(store,task);
  if (!claimId) return {status:"already_claimed",task:await getTaskGraphTask(store,{userId,workerId,taskId})};
  await appendTaskAudit(store,{userId,workerId,taskId,eventType:"execution_claimed",fromStatus:task.status,toStatus:"running",reason:"Atomic internal execution claim acquired.",metadata:{claimId}});
  const attemptId = randomUUID(); const startedAt = new Date().toISOString();
  await store.execute("INSERT INTO agent_task_execution_attempts (id,user_id,worker_id,task_id,claim_id,execution_tier,status,result_json,error_json,started_at,completed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",attemptId,userId,workerId,taskId,claimId,task.executionTier,"running",null,null,startedAt,null);
  const executor = executors[task.executionTier];
  try {
    if (!executor) throw Object.assign(new Error(`No ${task.executionTier} executor is configured.`),{code:"executor_unavailable",retryable:true});
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error("Execution timed out."), { code: "timeout", retryable: true })), timeoutMs); });
    const result = await Promise.race([executor(task), timeout]).finally(() => clearTimeout(timer));
    if (!result || result.accepted !== true) throw Object.assign(new Error("Executor result failed the acceptance threshold."),{code:"quality_threshold",retryable:false,partialResult:result});
    const completedAt = new Date().toISOString();
    const completed = await store.execute("UPDATE agent_tasks_v2 SET status = 'completed', output_json = ?, completed_at = ?, execution_claim_id = NULL, execution_claimed_at = NULL, failure_state_json = NULL, updated_at = ? WHERE id = ? AND user_id = ? AND worker_id = ? AND status = 'running' AND execution_claim_id = ?",JSON.stringify(result),completedAt,completedAt,taskId,userId,workerId,claimId);
    if (completed.changes !== 1) {
      await store.execute("UPDATE agent_task_execution_attempts SET status = 'discarded', result_json = ?, error_json = ?, completed_at = ? WHERE id = ?",JSON.stringify(result),JSON.stringify({code:"invalidated_during_execution"}),completedAt,attemptId);
      return {status:"invalidated_during_execution",task:await getTaskGraphTask(store,{userId,workerId,taskId})};
    }
    await store.execute("UPDATE agent_task_execution_attempts SET status = 'completed', result_json = ?, completed_at = ? WHERE id = ?",JSON.stringify(result),completedAt,attemptId);
    await appendTaskAudit(store,{userId,workerId,taskId,eventType:"execution_completed",fromStatus:"running",toStatus:"completed",reason:"Internal result met its acceptance threshold.",metadata:{attemptId}});
    const completedTask=await getTaskGraphTask(store,{userId,workerId,taskId});
    return {status:"completed",task:completedTask,result};
  } catch (error) {
    const completedAt = new Date().toISOString();
    const backoffMinutes = Number(task.retryPolicy.backoffMinutes?.[Math.min(task.attemptCount, (task.retryPolicy.backoffMinutes?.length || 1) - 1)] || 5);
    const failure = {code:error.code||"execution_error",message:error.message,retryable:error.retryable!==false,partialResult:error.partialResult||null,retryAfter:error.retryable===false?null:new Date(Date.now()+backoffMinutes*60_000).toISOString()};
    await store.execute("UPDATE agent_task_execution_attempts SET status = 'failed', error_json = ?, result_json = ?, completed_at = ? WHERE id = ?",JSON.stringify(failure),failure.partialResult?JSON.stringify(failure.partialResult):null,completedAt,attemptId);
    await store.execute("UPDATE agent_tasks_v2 SET status = 'failed', failure_state_json = ?, execution_claim_id = NULL, execution_claimed_at = NULL, updated_at = ? WHERE id = ? AND execution_claim_id = ?",JSON.stringify(failure),completedAt,taskId,claimId);
    await appendTaskAudit(store,{userId,workerId,taskId,eventType:"execution_failed",fromStatus:"running",toStatus:"failed",reason:failure.message,metadata:{attemptId,code:failure.code,retryable:failure.retryable,retryAfter:failure.retryAfter}});
    return {status:"failed",failure,task:await getTaskGraphTask(store,{userId,workerId,taskId})};
  }
}

export async function executeDueInternalTasks(store, options = {}) {
  const {userId,workerId="mara",now=new Date()}=options;
  const rows=await store.query("SELECT id FROM agent_tasks_v2 WHERE user_id = ? AND worker_id = ? AND owner = 'mara' AND status IN ('scheduled','ready','failed') AND scheduled_at <= ? ORDER BY priority ASC, scheduled_at ASC",userId,workerId,now.toISOString());
  const results=[]; for (const row of rows) results.push(await executeInternalTask(store,{...options,taskId:row.id})); return results;
}
