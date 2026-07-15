import { createHash, randomUUID } from "node:crypto";
import { validateShadowPlan } from "./maraShadowPlanner.mjs";
import { ensureMaraRuntimeTables } from "./maraRuntimeStorage.mjs";
import { assertAcyclicDependencies, appendTaskAudit, mapTaskRow } from "./maraTaskGraph.mjs";
import { listCalendar, persistCalendarEntry, resolveTaskSchedule } from "./maraDeterministicScheduler.mjs";
import { shouldSuppressWork } from "./maraWorkloadPolicy.mjs";

const SAFE_TOOLS = new Set(["internal_read", "internal_records", "internal_task_create", "internal_artifact", "analytics", "research", "contact_validation"]);
const EXTERNAL_ACTION = /\b(send|email|message|dm|publish|post|purchase|buy|accept|sign|submit|negotiate|quote rates?|grant rights?|delete)\b|gmail draft/i;
const priorityFor = { critical: "p0", high: "p1", normal: "p2", low: "p3" };
const estimatedCostFor = { code: 0, small: 0.01, mid: 0.05, premium: 0.2 };

const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const normalized = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function kindFor(work) {
  const text = normalized(`${work.title} ${work.completionCondition}`);
  if (work.approvalRequirement !== "none") return "approval";
  if (/monitor|watch|check for/.test(text)) return "monitoring";
  if (/research|validate|investigate|find/.test(text)) return "research";
  if (/analy|diagnos|assess|review/.test(text)) return "analysis";
  if (/brief|prepare|create|draft|build/.test(text)) return "deliverable_generation";
  return work.owner === "creator" ? "internal_update" : "analysis";
}
function toolsFor(work, candidates) {
  const capabilities = new Set(work.sourceCandidateTypes.flatMap((type) => candidates.find((item) => item.candidateType === type)?.requiredCapabilities || []));
  const tools = [];
  if (capabilities.has("research") || capabilities.has("risk_investigation") || capabilities.has("international_fit")) tools.push("research");
  if (capabilities.has("contact_validation")) tools.push("contact_validation");
  if (capabilities.has("analytics")) tools.push("analytics");
  if (!tools.length && work.executionModelTier === "code") tools.push("internal_records");
  return { capabilities: [...capabilities], tools };
}
function expiryFor(work, planningTime) {
  const hours = work.urgency === "critical" ? 48 : work.urgency === "high" ? 168 : 720;
  return { rule: { type: "after_hours", hours, revalidateBeforeExecution: true }, at: new Date(new Date(planningTime).getTime() + hours * 3_600_000).toISOString() };
}

export async function compileMaraPlan(store, { userId, workerId = "mara", planId, stateHash, plan, plannerInput, mode = "shadow", env = process.env }) {
  await ensureMaraRuntimeTables(store);
  const valid = validateShadowPlan(structuredClone(plan), plannerInput);
  const report = { planId, mode, created: [], reused: [], rejected: [], relationships: [], calendars: { mara: [], creator: [] } };
  const titleIds = new Map(); const drafts = [];
  for (const plannedWork of valid.workToCreate) {
    const work = { ...plannedWork, owner: plannedWork.owner === "shared" ? (Number(plannedWork.creatorEffortMinutes) > 0 ? "creator" : "mara") : plannedWork.owner };
    const reason = shouldSuppressWork(work, plannerInput.businessState, env);
    const actionText = `${work.title} ${work.completionCondition} ${work.expectedBusinessEffect}`;
    if (reason) { report.rejected.push({ title: work.title, reason }); continue; }
    if (work.owner !== "creator" && EXTERNAL_ACTION.test(actionText)) { report.rejected.push({ title: work.title, reason: "Mara cannot take external or consequential action." }); continue; }
    if (!normalized(work.commercialObjective)) { report.rejected.push({ title: work.title, reason: "Every task requires a commercial objective." }); continue; }
    const { capabilities, tools } = toolsFor(work, plannerInput.candidateWork || []);
    const unavailable = tools.find((tool) => !SAFE_TOOLS.has(tool) || !(plannerInput.availableTools || []).includes(tool));
    if (unavailable && work.owner !== "creator") { report.rejected.push({ title: work.title, reason: `Required tool is unavailable: ${unavailable}` }); continue; }
    const id = randomUUID(); const expiry = expiryFor(work, plannerInput.planningTime);
    const key = hash([userId, workerId, stateHash || "", normalized(work.title), work.owner, normalized(work.commercialObjective)]);
    const draft = { id, userId, workerId, work, capabilities, tools, kind: kindFor(work), key, expiresAt: expiry.at, expirationRule: expiry.rule };
    drafts.push(draft); titleIds.set(normalized(work.title), id);
  }
  for (const question of valid.questionsForUser) {
    const work = {
      title: `Provide information: ${question}`, sourceCandidateTypes: [], owner: "creator",
      commercialObjective: `Resolve the current bottleneck toward legitimate creator income: ${valid.currentBottleneck}`,
      expectedBusinessEffect: "Supply the minimum missing fact needed for safe progress", urgency: "high",
      creatorEffortMinutes: 5, dependencies: [], scheduledTime: null, schedulingWindow: "next available creator work block",
      approvalRequirement: "none", executionModelTier: "code", completionCondition: "Creator supplies the requested information",
      reassessmentTrigger: "The information arrives or the underlying work becomes obsolete", confidence: 1, evidence: ["planner blocking question"]
    };
    const id = randomUUID(); const expiry = expiryFor(work, plannerInput.planningTime);
    const key = hash([userId, workerId, stateHash || "", normalized(work.title), work.owner, normalized(work.commercialObjective)]);
    drafts.push({ id, userId, workerId, work, capabilities: [], tools: [], kind: "information_request", key, expiresAt: expiry.at, expirationRule: expiry.rule });
    titleIds.set(normalized(work.title), id);
  }
  const relations = [];
  for (const draft of drafts) for (const dependency of draft.work.dependencies) {
    const dependencyId = titleIds.get(normalized(dependency));
    if (!dependencyId) throw new Error(`Unknown task dependency '${dependency}' for '${draft.work.title}'.`);
    relations.push({ fromTaskId: draft.id, toTaskId: dependencyId, relationshipType: "depends_on" });
  }
  assertAcyclicDependencies(drafts.map((draft) => draft.id), relations);
  if (mode === "shadow") return { report, tasks: drafts.map((draft) => ({ ...draft.work, id: draft.id, taskKind: draft.kind, idempotencyKey: draft.key })) };

  const persisted = [];
  await store.tx(async (tx) => {
    for (const draft of drafts) {
      const existing = await tx.queryOne("SELECT * FROM agent_tasks_v2 WHERE user_id = ? AND worker_id = ? AND idempotency_key = ?", userId, workerId, draft.key);
      if (existing) { persisted.push(mapTaskRow(existing)); report.reused.push(existing.id); titleIds.set(normalized(draft.work.title), existing.id); continue; }
      const w = draft.work; const now = new Date().toISOString();
      const initialStatus = draft.kind === "information_request" ? "awaiting_information" : w.approvalRequirement !== "none" ? "awaiting_approval" : w.owner === "creator" ? "awaiting_creator_action" : "proposed";
      await tx.execute(`INSERT INTO agent_tasks_v2 (id,user_id,worker_id,owner,task_kind,source_plan_id,source_state_hash,source_event_ids_json,source_candidate_types_json,title,description,commercial_objective,expected_business_effect,priority,urgency,creator_effort_minutes,estimated_mara_cost_usd,required_capabilities_json,required_tools_json,approval_requirement,execution_tier,scheduled_at,scheduled_window,duration_minutes,timezone,completion_condition,reassessment_trigger,expiration_rule_json,expires_at,confidence,status,failure_state_json,retry_policy_json,idempotency_key,output_json,execution_claim_id,execution_claimed_at,attempt_count,completed_at,created_at,updated_at) VALUES (${Array(41).fill("?").join(",")})`,
        draft.id,userId,workerId,w.owner,draft.kind,planId,stateHash||null,JSON.stringify(plannerInput.meaningfulRecentEvents.map((event)=>event.id)),JSON.stringify(w.sourceCandidateTypes),w.title,w.expectedBusinessEffect,w.commercialObjective,w.expectedBusinessEffect,priorityFor[w.urgency],w.urgency,Number(w.creatorEffortMinutes),estimatedCostFor[w.executionModelTier],JSON.stringify(draft.capabilities),JSON.stringify(draft.tools),w.approvalRequirement,w.executionModelTier,w.scheduledTime||null,w.schedulingWindow,Math.max(5,Number(w.owner === "creator" ? w.creatorEffortMinutes : 30)||30),plannerInput.timeZone,w.completionCondition,w.reassessmentTrigger,JSON.stringify(draft.expirationRule),draft.expiresAt,w.confidence,initialStatus,null,JSON.stringify({maxAttempts:3,backoffMinutes:[5,30,180]}),draft.key,null,null,null,0,null,now,now);
      await appendTaskAudit(tx,{userId,workerId,taskId:draft.id,eventType:"created",toStatus:initialStatus,reason:"compiled_from_validated_plan",metadata:{planId}});
      persisted.push(mapTaskRow(await tx.queryOne("SELECT * FROM agent_tasks_v2 WHERE id = ?",draft.id))); report.created.push(draft.id);
    }
    for (const relation of relations) {
      const from = titleIds.get(normalized(drafts.find((d)=>d.id===relation.fromTaskId)?.work.title)) || relation.fromTaskId;
      const to = titleIds.get(normalized(drafts.find((d)=>d.id===relation.toTaskId)?.work.title)) || relation.toTaskId;
      await tx.execute("INSERT INTO agent_task_relationships (id,user_id,worker_id,from_task_id,to_task_id,relationship_type,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(user_id,worker_id,from_task_id,to_task_id,relationship_type) DO NOTHING",randomUUID(),userId,workerId,from,to,"depends_on","{}",new Date().toISOString());
      report.relationships.push({fromTaskId:from,toTaskId:to,relationshipType:"depends_on"});
    }
  });
  const maraEntries = await listCalendar(store,{userId,workerId,calendarOwner:"mara"});
  const creatorEntries = await listCalendar(store,{userId,workerId,calendarOwner:"creator"});
  const scheduled = new Map();
  const ordered = []; const remaining = [...persisted];
  while (remaining.length) {
    const index = remaining.findIndex((task) => report.relationships.filter((relation) => relation.fromTaskId === task.id).every((relation) => ordered.some((item) => item.id === relation.toTaskId) || !remaining.some((item) => item.id === relation.toTaskId)));
    if (index < 0) throw new Error("Unable to produce a dependency-safe scheduling order.");
    ordered.push(remaining.splice(index, 1)[0]);
  }
  for (const task of ordered) {
    if (["completed", "invalidated", "expired", "cancelled", "superseded"].includes(task.status)) continue;
    const deps = report.relationships.filter((r)=>r.fromTaskId===task.id).map((r)=>scheduled.get(r.toTaskId)).filter(Boolean);
    const activeEntry = await store.queryOne("SELECT * FROM agent_task_calendar_entries WHERE user_id = ? AND worker_id = ? AND task_id = ? AND status = 'scheduled' ORDER BY created_at DESC LIMIT 1", userId, workerId, task.id);
    if (activeEntry) {
      scheduled.set(task.id, activeEntry.ends_at);
      report.calendars[task.owner === "mara" ? "mara" : "creator"].push({ id: activeEntry.id, duplicate: true, startsAt: activeEntry.starts_at, endsAt: activeEntry.ends_at, timezone: activeEntry.timezone });
      continue;
    }
    const existingEntries = task.owner === "mara" ? maraEntries : creatorEntries;
    const schedule = resolveTaskSchedule(task,{planningTime:plannerInput.planningTime,state:plannerInput.businessState,existingEntries,dependencyEndTimes:deps});
    const entry = await persistCalendarEntry(store,{userId,workerId,task,schedule});
    scheduled.set(task.id,schedule.endsAt); report.calendars[task.owner === "mara" ? "mara" : "creator"].push(entry);
  }
  await store.execute("INSERT INTO agent_task_compilation_runs (id,user_id,worker_id,source_plan_id,mode,report_json,status,created_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(user_id,worker_id,source_plan_id,mode) DO NOTHING",randomUUID(),userId,workerId,planId,mode,JSON.stringify(report),"completed",new Date().toISOString());
  return { report, tasks: persisted };
}
