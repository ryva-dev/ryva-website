/**
 * agentLlm: the LLM brain shared by every worker role.
 *
 * Pure prompt-building/parsing functions are exported separately from the IO
 * wrappers so they can be unit-tested without network or database access.
 *
 * This module must not import workerEngine.mjs (workerEngine imports it).
 */
import { createAnthropicMessage, isMaraLlmConfigured, parseJsonFromLlmText } from "./maraLlm.mjs";
import { SHARED_AGENT_OUTPUT_RULES, getRoleTaskType } from "./roles.mjs";

const AGENT_MODEL =
  process.env.ANTHROPIC_AGENT_MODEL ||
  process.env.ANTHROPIC_OFFICE_MODEL ||
  process.env.ANTHROPIC_MODEL ||
  "claude-sonnet-4-6";

const DAILY_LLM_CALL_LIMIT = Number.parseInt(process.env.AGENT_DAILY_LLM_CALL_LIMIT ?? "300", 10);

export function isAgentLlmConfigured() {
  return isMaraLlmConfigured();
}

/* ------------------------------------------------------------------ */
/* Budget guard                                                        */
/* ------------------------------------------------------------------ */

function ensureUsageTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_llm_usage (
      user_id TEXT NOT NULL,
      day TEXT NOT NULL,
      calls INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, day)
    )
  `);
}

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

export function llmBudgetRemaining(db, userId) {
  ensureUsageTable(db);
  const row = db.prepare("SELECT calls FROM agent_llm_usage WHERE user_id = ? AND day = ?").get(userId, utcDay());
  return Math.max(0, DAILY_LLM_CALL_LIMIT - Number(row?.calls ?? 0));
}

export function recordLlmCall(db, userId) {
  ensureUsageTable(db);
  db.prepare(
    `INSERT INTO agent_llm_usage (user_id, day, calls) VALUES (?, ?, 1)
     ON CONFLICT(user_id, day) DO UPDATE SET calls = calls + 1`
  ).run(userId, utcDay());
}

async function budgetedMessage(db, userId, params) {
  if (!isAgentLlmConfigured()) {
    return null;
  }
  if (db && userId && llmBudgetRemaining(db, userId) <= 0) {
    return null;
  }
  const text = await createAnthropicMessage({ model: AGENT_MODEL, ...params });
  if (db && userId) {
    recordLlmCall(db, userId);
  }
  return text;
}

/* ------------------------------------------------------------------ */
/* Brand context                                                       */
/* ------------------------------------------------------------------ */

/**
 * Assemble everything the LLM needs to know about THIS manager's actual
 * brand. All inputs are pre-fetched by the caller; this function is pure.
 */
export function buildBrandContext({
  accountOnboarding = null,
  workerOnboardingAnswers = {},
  knowledgeSections = [],
  recentOutputs = [],
  openTasks = [],
  integrations = [],
  recentMessages = []
}) {
  const sections = Array.isArray(knowledgeSections) ? knowledgeSections : [];
  const byTitle = (title) => {
    const section = sections.find((entry) => String(entry?.title ?? "").trim().toLowerCase() === title.toLowerCase());
    return Array.isArray(section?.items) ? section.items.map((item) => String(item).trim()).filter(Boolean) : [];
  };

  return {
    brandName: String(accountOnboarding?.brandName ?? "").trim(),
    whatTheyDo: String(accountOnboarding?.whatYouDo ?? "").trim(),
    accountGoals: String(accountOnboarding?.goals ?? accountOnboarding?.mainGoal ?? "").trim(),
    workerOnboardingAnswers: workerOnboardingAnswers && typeof workerOnboardingAnswers === "object" ? workerOnboardingAnswers : {},
    preferences: byTitle("Preferences"),
    goals: byTitle("Goals"),
    approvalRules: byTitle("Approval rules"),
    painPoints: [...byTitle("Pain points"), ...byTitle("Pain point map")],
    recentDirection: byTitle("Recent direction").slice(0, 8),
    recentOutputs: (Array.isArray(recentOutputs) ? recentOutputs : []).slice(0, 10).map((output) => ({
      title: String(output.title ?? ""),
      outputType: String(output.outputType ?? ""),
      createdAt: String(output.createdAt ?? "")
    })),
    openTasks: (Array.isArray(openTasks) ? openTasks : []).slice(0, 15).map((task) => ({
      id: String(task.id ?? ""),
      title: String(task.title ?? ""),
      taskType: String(task.taskType ?? ""),
      status: String(task.status ?? "")
    })),
    connectedIntegrations: (Array.isArray(integrations) ? integrations : [])
      .filter((entry) => String(entry.status ?? "") === "connected")
      .map((entry) => String(entry.provider ?? "")),
    recentMessages: (Array.isArray(recentMessages) ? recentMessages : []).slice(-8).map((message) => ({
      author: String(message.author ?? ""),
      text: String(message.text ?? "").slice(0, 600)
    }))
  };
}

export function formatBrandContextForPrompt(brandContext) {
  const answers = Object.entries(brandContext.workerOnboardingAnswers ?? {})
    .map(([key, value]) => `${key}: ${String(value).slice(0, 300)}`)
    .filter((line) => line.split(": ")[1]);

  return [
    brandContext.brandName ? `Manager's brand: ${brandContext.brandName}` : "Manager's brand: (not yet provided — ask rather than assume)",
    brandContext.whatTheyDo ? `What they do: ${brandContext.whatTheyDo}` : "",
    brandContext.accountGoals ? `Account goals: ${brandContext.accountGoals}` : "",
    answers.length > 0 ? `Onboarding answers:\n${answers.join("\n")}` : "",
    brandContext.goals.length > 0 ? `Stated goals: ${brandContext.goals.join(" | ")}` : "",
    brandContext.preferences.length > 0 ? `Preferences: ${brandContext.preferences.join(" | ")}` : "",
    brandContext.approvalRules.length > 0 ? `Approval rules: ${brandContext.approvalRules.join(" | ")}` : "",
    brandContext.painPoints.length > 0 ? `Pain points: ${brandContext.painPoints.join(" | ")}` : "",
    brandContext.recentDirection.length > 0 ? `Recent direction from manager: ${brandContext.recentDirection.join(" | ")}` : "",
    brandContext.connectedIntegrations.length > 0
      ? `Connected tools: ${brandContext.connectedIntegrations.join(", ")}`
      : "Connected tools: none (no external actions are possible; drafts and approvals only)",
    brandContext.openTasks.length > 0
      ? `Open tasks:\n${brandContext.openTasks.map((task) => `- [${task.status}] ${task.title} (${task.taskType || "untyped"})`).join("\n")}`
      : "Open tasks: none",
    brandContext.recentOutputs.length > 0
      ? `Recent deliverables:\n${brandContext.recentOutputs.map((output) => `- ${output.title} (${output.outputType}, ${output.createdAt})`).join("\n")}`
      : "Recent deliverables: none yet"
  ]
    .filter(Boolean)
    .join("\n");
}

/* ------------------------------------------------------------------ */
/* Task execution                                                      */
/* ------------------------------------------------------------------ */

export function buildTaskExecutionSystemPrompt(roleConfig) {
  return [
    `You are ${roleConfig.name}, ${roleConfig.title} at the manager's company, working inside Ryva Office.`,
    roleConfig.roleDefinition,
    `Voice: ${roleConfig.voice}`,
    ...SHARED_AGENT_OUTPUT_RULES
  ].join("\n");
}

export function buildTaskExecutionUserPrompt(roleConfig, task, brandContext, taskTypeConfig) {
  const schemaHint = taskTypeConfig?.schemaHint || '{"summary":"","details":[],"nextSteps":[]}';
  return [
    `Execute this task as a finished deliverable for the manager.`,
    `Task: ${task.title}`,
    task.description ? `Task details: ${task.description}` : "",
    taskTypeConfig ? `Deliverable type: ${taskTypeConfig.label} — ${taskTypeConfig.description}` : "",
    "",
    "Manager context (use it — the deliverable must be specific to this brand):",
    formatBrandContextForPrompt(brandContext),
    "",
    `Return JSON exactly matching this schema: ${schemaHint}`,
    'Additionally include a top-level field "headline" (one sentence describing what you produced) and "confidenceNotes" (array of anything you were unsure about or that needs the manager\'s input).'
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function sectionTitleFromKey(key) {
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Render arbitrary structured JSON into readable deliverable text. */
export function renderStructuredContentToText(structured) {
  const lines = [];
  for (const [key, value] of Object.entries(structured)) {
    if (["generatedBy", "headline", "confidenceNotes"].includes(key)) continue;
    if (value === null || value === undefined || value === "") continue;
    const title = sectionTitleFromKey(key);
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      lines.push(`${title}:`);
      for (const item of value) {
        if (item && typeof item === "object") {
          lines.push(`- ${Object.values(item).filter((part) => part !== "" && part !== null).map(String).join(" — ")}`);
        } else {
          lines.push(`- ${String(item)}`);
        }
      }
      lines.push("");
    } else if (typeof value === "object") {
      lines.push(`${title}:`);
      for (const [innerKey, innerValue] of Object.entries(value)) {
        if (innerValue === "" || innerValue === null) continue;
        lines.push(`- ${sectionTitleFromKey(innerKey)}: ${String(innerValue)}`);
      }
      lines.push("");
    } else {
      lines.push(`${title}: ${String(value)}`);
      lines.push("");
    }
  }
  return lines.join("\n").trim();
}

/**
 * LLM-first execution for any role task. Returns null when the LLM is not
 * configured, over budget, or fails — the caller decides the fallback and
 * must label it honestly.
 */
export async function tryExecuteAgentTaskLlm({ db, userId, roleConfig, task, brandContext, fetchImpl }) {
  if (!roleConfig || !task) return null;
  const taskTypeConfig = getRoleTaskType(roleConfig, task.taskType);

  let text;
  try {
    text = await budgetedMessage(db, userId, {
      fetchImpl,
      maxTokens: 2400,
      system: buildTaskExecutionSystemPrompt(roleConfig),
      messages: [
        { role: "user", content: [{ type: "text", text: buildTaskExecutionUserPrompt(roleConfig, task, brandContext, taskTypeConfig) }] }
      ]
    });
  } catch {
    return null;
  }
  if (!text) return null;

  let payload;
  try {
    payload = parseJsonFromLlmText(text);
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;

  const structuredContent = { ...payload, generatedBy: "llm" };
  const content = renderStructuredContentToText(structuredContent);
  if (!content) return null;

  return {
    content,
    outputType: taskTypeConfig?.outputType || task.taskType || "summary",
    structuredContent,
    title: String(payload.headline || task.title).slice(0, 160)
  };
}

/* ------------------------------------------------------------------ */
/* Chat interpretation (replaces the regex action detector)            */
/* ------------------------------------------------------------------ */

export function buildChatInterpreterSystemPrompt(roleConfig) {
  const typeList = roleConfig.taskTypes
    .map((entry) => `- ${entry.id}: ${entry.description}`)
    .join("\n");
  return [
    `You are ${roleConfig.name}, ${roleConfig.title}, interpreting a message from your manager inside Ryva Office.`,
    roleConfig.roleDefinition,
    `Voice: ${roleConfig.voice}`,
    roleConfig.chatGuidance,
    "",
    "Your job: (1) reply to the manager in your own voice, and (2) extract structured actions.",
    "Available task types (use ONLY these ids for tasksToCreate.taskType):",
    typeList,
    "",
    "Rules:",
    "- Only create tasks the manager actually asked for or clearly implied. Do not pad.",
    "- Capture durable preferences, goals, approval rules, and pain points as memories. Do not store throwaway chatter.",
    "- If the manager asks for something external (sending emails, posting, paying), create an approvalRequest instead of a task and say so in your reply.",
    "- If the message is just conversation, return empty arrays and a good reply.",
    "- Reply in 1-4 sentences, specific to this manager. State what you will do next, honestly. Never claim work happened that has not.",
    'Return only JSON: {"reply":"","tasksToCreate":[{"title":"","taskType":"","description":"","priority":"low|medium|high"}],"memoriesToSave":[{"title":"Preferences|Goals|Approval rules|Pain points","items":[""]}],"approvalRequests":[{"title":"","actionType":"","description":""}],"clarifyingQuestion":""}'
  ].join("\n");
}

export function buildChatInterpreterUserPrompt(message, brandContext) {
  return [
    "Manager context:",
    formatBrandContextForPrompt(brandContext),
    "",
    brandContext.recentMessages.length > 0
      ? `Recent conversation:\n${brandContext.recentMessages.map((entry) => `${entry.author}: ${entry.text}`).join("\n")}`
      : "",
    "",
    `Manager's new message: ${message}`
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function parseChatInterpreterResponse(payload, roleConfig) {
  if (!payload || typeof payload !== "object") return null;
  const validTypes = new Set(roleConfig.taskTypes.map((entry) => entry.id));
  const allowedMemoryTitles = new Set(["Preferences", "Goals", "Approval rules", "Pain points", "Recent direction"]);

  const tasksToCreate = (Array.isArray(payload.tasksToCreate) ? payload.tasksToCreate : [])
    .map((task) => ({
      title: String(task?.title ?? "").trim().slice(0, 140),
      taskType: validTypes.has(String(task?.taskType ?? "").trim()) ? String(task.taskType).trim() : null,
      description: String(task?.description ?? "").trim().slice(0, 600),
      priority: ["low", "medium", "high"].includes(String(task?.priority ?? "")) ? String(task.priority) : "medium"
    }))
    .filter((task) => task.title && task.taskType)
    .slice(0, 4);

  const memoriesToSave = (Array.isArray(payload.memoriesToSave) ? payload.memoriesToSave : [])
    .map((memory) => ({
      title: allowedMemoryTitles.has(String(memory?.title ?? "").trim()) ? String(memory.title).trim() : "Recent direction",
      items: (Array.isArray(memory?.items) ? memory.items : []).map((item) => String(item).trim().slice(0, 300)).filter(Boolean)
    }))
    .filter((memory) => memory.items.length > 0)
    .slice(0, 4);

  const approvalRequests = (Array.isArray(payload.approvalRequests) ? payload.approvalRequests : [])
    .map((request) => ({
      title: String(request?.title ?? "").trim().slice(0, 140),
      actionType: String(request?.actionType ?? "external_action").trim().slice(0, 60) || "external_action",
      description: String(request?.description ?? "").trim().slice(0, 600)
    }))
    .filter((request) => request.title)
    .slice(0, 3);

  const reply = String(payload.reply ?? "").trim();
  const clarifyingQuestion = String(payload.clarifyingQuestion ?? "").trim();

  if (!reply) return null;

  return { approvalRequests, clarifyingQuestion, memoriesToSave, reply, tasksToCreate };
}

export async function tryInterpretChatMessageLlm({ db, userId, roleConfig, message, brandContext, fetchImpl }) {
  if (!roleConfig || !String(message ?? "").trim()) return null;

  let text;
  try {
    text = await budgetedMessage(db, userId, {
      fetchImpl,
      maxTokens: 900,
      system: buildChatInterpreterSystemPrompt(roleConfig),
      messages: [{ role: "user", content: [{ type: "text", text: buildChatInterpreterUserPrompt(message, brandContext) }] }]
    });
  } catch {
    return null;
  }
  if (!text) return null;

  try {
    return parseChatInterpreterResponse(parseJsonFromLlmText(text), roleConfig);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Autonomy planning                                                   */
/* ------------------------------------------------------------------ */

export function buildAutonomyPlannerSystemPrompt(roleConfig) {
  const typeList = roleConfig.taskTypes
    .filter((entry) => entry.safeAutoExecute)
    .map((entry) => `- ${entry.id}: ${entry.description}`)
    .join("\n");
  return [
    `You are ${roleConfig.name}, ${roleConfig.title}, planning your next autonomous work cycle.`,
    roleConfig.roleDefinition,
    "Your standing responsibilities:",
    ...roleConfig.autonomyPlaybook.map((line) => `- ${line}`),
    "",
    "Available task types you can execute this cycle:",
    typeList,
    "",
    "Rules:",
    "- Plan at most 3 tasks. Prefer work that is stale, missing, or was recently requested.",
    "- Do NOT recreate deliverables that are already fresh (check recent deliverables and their dates).",
    "- Do NOT duplicate open tasks.",
    "- If nothing genuinely needs doing, return an empty plan — idle honesty beats busywork.",
    'Return only JSON: {"plan":[{"title":"","taskType":"","description":"","reason":""}],"skippedBecause":""}'
  ].join("\n");
}

export function parseAutonomyPlannerResponse(payload, roleConfig) {
  if (!payload || typeof payload !== "object") return null;
  const validTypes = new Set(roleConfig.taskTypes.filter((entry) => entry.safeAutoExecute).map((entry) => entry.id));
  const plan = (Array.isArray(payload.plan) ? payload.plan : [])
    .map((entry) => ({
      title: String(entry?.title ?? "").trim().slice(0, 140),
      taskType: validTypes.has(String(entry?.taskType ?? "").trim()) ? String(entry.taskType).trim() : null,
      description: String(entry?.description ?? "").trim().slice(0, 600),
      reason: String(entry?.reason ?? "").trim().slice(0, 300)
    }))
    .filter((entry) => entry.title && entry.taskType)
    .slice(0, 3);
  return { plan, skippedBecause: String(payload.skippedBecause ?? "").trim() };
}

export async function tryPlanAutonomyLlm({ db, userId, roleConfig, brandContext, fetchImpl }) {
  let text;
  try {
    text = await budgetedMessage(db, userId, {
      fetchImpl,
      maxTokens: 700,
      system: buildAutonomyPlannerSystemPrompt(roleConfig),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Manager context:\n${formatBrandContextForPrompt(brandContext)}\n\nCurrent date: ${new Date().toISOString().slice(0, 10)}\nPlan your cycle.`
            }
          ]
        }
      ]
    });
  } catch {
    return null;
  }
  if (!text) return null;

  try {
    return parseAutonomyPlannerResponse(parseJsonFromLlmText(text), roleConfig);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Voice pass: rewrite data-driven drafts as natural briefs            */
/* ------------------------------------------------------------------ */

/**
 * Data-driven executors (trend pulses, ops briefs) produce factually
 * grounded but robotic text. This pass rewrites the draft in the worker's
 * voice using ONLY the facts already in the draft — no new claims.
 * Returns null on failure; callers keep the original draft.
 */
export async function tryPolishDeliverableVoice({ db, userId, roleConfig, title, draftContent, brandContext, fetchImpl }) {
  const draft = String(draftContent ?? "").trim();
  if (!roleConfig || !draft) return null;

  let text;
  try {
    text = await budgetedMessage(db, userId, {
      fetchImpl,
      maxTokens: 1200,
      system: [
        `You are ${roleConfig.name}, ${roleConfig.title}, rewriting one of your own working documents into a clean brief for your manager.`,
        `Voice: ${roleConfig.voice}`,
        "Rules:",
        "- Use ONLY facts present in the draft. Do not add data, metrics, names, or claims.",
        "- If the draft says data is missing or empty, say so plainly in one line — do not pad around it.",
        "- Write as a natural one-page brief: short opening line, clear section headings ending with a colon, tight bullets starting with '- '.",
        "- First person, direct, warm. No corporate filler, no 'as an AI'.",
        "- Plain text only. No markdown symbols other than '- ' bullets and 'Heading:' lines."
      ].join("\n"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                `Manager context (for tone only, not new facts):`,
                `Brand: ${brandContext?.brandName || "(unknown)"} — ${brandContext?.whatTheyDo || ""}`,
                "",
                `Document title: ${title}`,
                "Draft to rewrite:",
                draft
              ].join("\n")
            }
          ]
        }
      ]
    });
  } catch {
    return null;
  }

  const polished = String(text ?? "").trim();
  if (!polished || polished.length < 40) return null;
  return polished;
}

/* ------------------------------------------------------------------ */
/* Honest placeholder fallback                                         */
/* ------------------------------------------------------------------ */

/**
 * When the LLM is unavailable, we never fake a deliverable. We produce a
 * clearly-labeled placeholder that tells the manager what is going on.
 */
export function buildPlaceholderOutput(roleConfig, task) {
  const content = [
    `I queued "${task.title}" but could not produce the full deliverable right now because my reasoning engine is offline or over its daily budget.`,
    "",
    "What you can do:",
    "- Make sure the platform's AI key is configured (Settings → AI).",
    "- Re-run this task once it is — I'll pick it up with your full brand context.",
    "",
    "I have NOT generated placeholder work product; I don't ship generic filler as if it were real."
  ].join("\n");

  return {
    content,
    outputType: "status_note",
    structuredContent: { generatedBy: "placeholder", reason: "llm_unavailable_or_over_budget" },
    title: `Pending: ${task.title}`.slice(0, 160)
  };
}
