import cookieParser from "cookie-parser";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import Stripe from "stripe";
import { fileURLToPath } from "node:url";
import { db } from "./db.mjs";
import { sendTransactionalEmail } from "./mailer.mjs";
import {
  autoExecuteSafeMaraTasks,
  buildMaraInitialWorkPlan,
  buildMaraWorkspace,
  createApprovalRequest,
  createApprovedTaskIfPermissionAllows,
  createWorkerActivityLog,
  createRecurringResponsibility,
  createResearchItem,
  createSuggestedTask,
  dismissWorkerTask,
  ensureWorkerPermissions,
  getMaraRelevantKnowledge,
  getWorkerPermissions,
  listWorkerOutputs,
  listWorkerTasksForUserWorker,
  MARA_ROLE_DEFINITION,
  runMaraActionDetector,
  runMaraTask,
  runWorkerTask,
  updateApprovalRequestStatus
} from "./workerEngine.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const workersPath = path.join(rootDir, "data", "workers.json");
const storageRoot =
  process.env.STORAGE_ROOT ||
  process.env.RAILWAY_VOLUME_MOUNT_PATH ||
  path.join(rootDir, "data");
const uploadsDir = path.join(storageRoot, "office-uploads");
const sessionCookieName = "ryva_session";
const googleStateCookieName = "ryva_google_oauth_state";
const sessionDurationMs = 1000 * 60 * 60 * 24 * 7;
const googleStateDurationMs = 1000 * 60 * 10;
const emailTokenDurationMs = 1000 * 60 * 60 * 24;
const resetTokenDurationMs = 1000 * 60 * 30;
const isProduction = process.env.NODE_ENV === "production";
const appUrl = process.env.APP_URL ?? "http://localhost:5173";
const allowedOrigin = new URL(appUrl).origin;
const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const host = process.env.HOST ?? "0.0.0.0";
const MARA_SLUG = "mara-vale";

if (isProduction && !process.env.APP_URL) {
  throw new Error("APP_URL must be set in production.");
}

await fs.mkdir(uploadsDir, { recursive: true });

if (
  (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_WEBHOOK_SECRET) ||
  (!process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET)
) {
  throw new Error("STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET must be set together.");
}

const app = express();
app.disable("x-powered-by");
if (isProduction) {
  app.set("trust proxy", 1);
}
app.use(
  helmet({
    contentSecurityPolicy: false
  })
);
app.use((req, res, next) => {
  if (req.path === "/api/payments/webhook") {
    next();
    return;
  }

  express.json({ limit: "2mb" })(req, res, next);
});
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Please try again later." }
});

const checkoutLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many checkout attempts. Please try again later." }
});

const interviewLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many interview requests. Please try again shortly." }
});

const onboardingLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many onboarding requests. Please try again shortly." }
});

function nowIso() {
  return new Date().toISOString();
}

function hashPassword(password, salt = randomUUID()) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, expectedHash] = storedHash.split(":");
  if (!salt || !expectedHash) return false;

  const actualBuffer = Buffer.from(scryptSync(password, salt, 64).toString("hex"), "utf8");
  const expectedBuffer = Buffer.from(expectedHash, "utf8");
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

const adminEmails = new Set(
  String(process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => normalizeEmail(entry))
    .filter(Boolean)
);

function createOpaqueToken() {
  const raw = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

function toSafeUser(user) {
  return {
    createdAt: user.created_at,
    email: user.email,
    emailVerified: Boolean(user.email_verified_at),
    id: user.id,
    isAdmin: isAdminUser(user),
    name: user.name,
    onboarded: isUserOnboarded(user.id)
  };
}

function isAdminUser(user) {
  return Boolean(user?.email && adminEmails.has(normalizeEmail(user.email)));
}

function isGoogleAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function isUserOnboarded(userId) {
  return Boolean(
    db
      .prepare(
        `SELECT user_id
         FROM user_onboarding
         WHERE user_id = ? AND completed_at IS NOT NULL`
      )
      .get(userId)
  );
}

function getUserOnboardingRecord(userId) {
  return (
    db
      .prepare(
        `SELECT user_id, brand_name AS brandName, what_you_do AS whatYouDo, completed_at AS completedAt
         FROM user_onboarding
         WHERE user_id = ?`
      )
      .get(userId) ?? null
  );
}

function buildOfficeSettingsSeed(user, onboardingRecord) {
  const existing = db
    .prepare(
      `SELECT settings_json AS settingsJson
       FROM office_global_settings
       WHERE user_id = ?`
    )
    .get(user.id);

  const parsedExisting =
    existing?.settingsJson && typeof existing.settingsJson === "string" ? JSON.parse(existing.settingsJson) : {};

  return {
    autoBriefingPrep: String(parsedExisting.autoBriefingPrep ?? "Enabled"),
    briefingDigestTime: String(parsedExisting.briefingDigestTime ?? "08:30"),
    brandContext: String(onboardingRecord.whatYouDo ?? parsedExisting.brandContext ?? "").trim(),
    companyCustomer: String(parsedExisting.companyCustomer ?? ""),
    companyIdentity: String(parsedExisting.companyIdentity ?? ""),
    companyName: String(parsedExisting.companyName ?? onboardingRecord.brandName ?? user.name ?? "").trim(),
    companyNever: String(parsedExisting.companyNever ?? ""),
    companyOffer: String(parsedExisting.companyOffer ?? ""),
    companyOfferOutcome: String(parsedExisting.companyOfferOutcome ?? ""),
    companyVoice: String(parsedExisting.companyVoice ?? ""),
    decisionStyle: String(parsedExisting.decisionStyle ?? ""),
    defaultTaskPriority: String(parsedExisting.defaultTaskPriority ?? "Medium"),
    digestDelivery: String(parsedExisting.digestDelivery ?? "Email and in-office"),
    dislikes: String(parsedExisting.dislikes ?? ""),
    likes: String(parsedExisting.likes ?? ""),
    managerSummaryFrequency: String(parsedExisting.managerSummaryFrequency ?? "Daily"),
    meetingBuffer: String(parsedExisting.meetingBuffer ?? "15 minutes"),
    nonNegotiables: String(parsedExisting.nonNegotiables ?? ""),
    notificationWindow: String(parsedExisting.notificationWindow ?? ""),
    officeHours: String(parsedExisting.officeHours ?? ""),
    projectName: String(parsedExisting.projectName ?? ""),
    projectObjective: String(parsedExisting.projectObjective ?? ""),
    projectOpenQuestions: String(parsedExisting.projectOpenQuestions ?? ""),
    projectStrategy: String(parsedExisting.projectStrategy ?? ""),
    quietHours: String(parsedExisting.quietHours ?? ""),
    reviewCadence: String(parsedExisting.reviewCadence ?? "Weekly"),
    reviewReminderLead: String(parsedExisting.reviewReminderLead ?? "2 hours before"),
    rightNowGoal: String(parsedExisting.rightNowGoal ?? ""),
    timezone: String(parsedExisting.timezone ?? "America/New_York")
  };
}

function seedOfficeSettingsFromOnboarding(user, onboardingRecord) {
  const settings = buildOfficeSettingsSeed(user, onboardingRecord);
  db.prepare(
    `INSERT INTO office_global_settings (user_id, settings_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       settings_json = excluded.settings_json,
       updated_at = excluded.updated_at`
  ).run(user.id, JSON.stringify(settings), nowIso());
}

async function readWorkers() {
  const file = await fs.readFile(workersPath, "utf8");
  return JSON.parse(file);
}

async function readHiredWorkersForUser(userId) {
  const hiredRows = db
    .prepare(
      `SELECT worker_slug
       FROM hired_workers
       WHERE user_id = ? AND status = ?
       ORDER BY hired_at DESC`
    )
    .all(userId, "active");

  if (hiredRows.length === 0) {
    return [];
  }

  const workers = await readWorkers();
  const workerMap = new Map(workers.map((worker) => [worker.slug, worker]));

  return hiredRows
    .map((row) => workerMap.get(row.worker_slug))
    .filter(Boolean);
}

function hasHiredWorker(userId, workerSlug) {
  return Boolean(
    db
      .prepare("SELECT id FROM hired_workers WHERE user_id = ? AND worker_slug = ? AND status = ?")
      .get(userId, workerSlug, "active")
  );
}

function readOfficeOverlaysForUser(userId) {
  return {
    briefings: db
      .prepare(
        `SELECT worker_slug AS workerSlug, id, title, date_label AS dateLabel, summary,
                agenda_json AS agendaJson, decisions_json AS decisionsJson, actions_json AS actionsJson
         FROM office_custom_briefings
         WHERE user_id = ?
         ORDER BY created_at DESC`
      )
      .all(userId),
    chats: db
      .prepare(
        `SELECT worker_slug AS workerSlug, id, author, text, created_at AS timestamp
         FROM office_chat_messages
         WHERE user_id = ?
         ORDER BY created_at ASC`
      )
      .all(userId),
    tasks: db
      .prepare(
        `SELECT worker_slug AS workerSlug, id, due_date AS dueDate, module_name AS module, owner, priority, status, title
         FROM office_custom_tasks
         WHERE user_id = ?
         ORDER BY created_at DESC`
      )
      .all(userId),
    suggestedActions: db
      .prepare(
        `SELECT worker_slug AS workerSlug, id, action_type AS actionType, title, description, reason,
                related_thread_id AS relatedThreadId, related_campaign_id AS relatedCampaignId, related_brand_id AS relatedBrandId,
                payload_json AS payloadJson, status, requires_approval AS requiresApproval, created_at AS createdAt
         FROM office_suggested_actions
         WHERE user_id = ?
         ORDER BY created_at DESC`
      )
      .all(userId),
    worklog: db
      .prepare(
        `SELECT worker_slug AS workerSlug, id, action, module_name AS module, result, created_at AS timestamp
         FROM office_activity_logs
         WHERE user_id = ?
         ORDER BY created_at DESC`
      )
      .all(userId),
    settings: db
      .prepare(
        `SELECT worker_slug AS workerSlug, settings_json AS settingsJson, updated_at AS updatedAt
         FROM office_worker_settings
         WHERE user_id = ?`
      )
      .all(userId),
    knowledge: db
      .prepare(
        `SELECT worker_slug AS workerSlug, knowledge_json AS knowledgeJson, updated_at AS updatedAt
         FROM office_worker_knowledge
         WHERE user_id = ?`
      )
      .all(userId),
    files: db
      .prepare(
        `SELECT worker_slug AS workerSlug, id, name, type, uploaded_at AS updatedAt
         FROM office_uploaded_files
         WHERE user_id = ?
         ORDER BY uploaded_at DESC`
      )
      .all(userId),
    calendarEvents: db
      .prepare(
        `SELECT id, worker_slug AS workerSlug, title, starts_at AS startsAt, ends_at AS endsAt,
                event_type AS eventType, notes, updated_at AS updatedAt
         FROM office_calendar_events
         WHERE user_id = ?
         ORDER BY starts_at ASC`
      )
      .all(userId),
    globalSettings:
      db
        .prepare(
          `SELECT settings_json AS settingsJson, updated_at AS updatedAt
           FROM office_global_settings
           WHERE user_id = ?`
        )
        .get(userId) ?? null,
    onboarding: db
      .prepare(
        `SELECT worker_slug AS workerSlug, status, answers_json AS answersJson,
                generated_summary_json AS generatedSummaryJson, completed_at AS completedAt
         FROM office_onboarding_sessions
         WHERE user_id = ?`
      )
      .all(userId),
    integrations: db
      .prepare(
        `SELECT worker_slug AS workerSlug, provider, status, account_label AS accountLabel,
                metadata_json AS metadataJson, connected_at AS connectedAt, updated_at AS updatedAt
         FROM office_worker_integrations
         WHERE user_id = ?
         ORDER BY worker_slug ASC, provider ASC`
      )
      .all(userId)
  };
}

function makeWorkerReply(name) {
  return `${name ? name.split(" ")[0] : "I"} received that update and will reflect it in the work queue before the next briefing.`;
}

function buildInterviewGuide(worker) {
  const genericGuide = {
    canHelpWith: worker.profile?.responsibilities?.slice(0, 4) ?? [],
    fitNotes: [
      `Strong fit if you need reliable ${worker.department.toLowerCase()} execution.`,
      `Best when you want clear ownership around the ${worker.title.toLowerCase()} function.`,
      "Works well if you prefer structured reviews over constant oversight."
    ],
    needsFromYou: ["Clear priorities", "Examples of strong work", "Approval rules", "Context that affects how the role should operate"],
    summary: worker.description
  };

  if (worker.slug === "lena-carter") {
    return {
      canHelpWith: [
        "Building a weekly UGC outreach plan",
        "Reviewing your portfolio and positioning",
        "Drafting brand pitches and follow-ups",
        "Organizing your creator pipeline"
      ],
      fitNotes: [
        "Strong fit for creators who want structure and consistency",
        "Best when you want help with outreach, positioning, and deal flow",
        "Works well if you want feedback tied to actual brand outcomes"
      ],
      needsFromYou: [
        "Your creator niche and ideal brand direction",
        "Portfolio or media kit links",
        "A sense of your experience level and confidence",
        "Approval rules for rates, outreach, and messaging"
      ],
      summary:
        "Lena focuses on creator niche, positioning, outreach habits, brand fit, and weekly pitching discipline."
    };
  }

  if (worker.slug === "david-chen") {
    return {
      canHelpWith: [
        "Building outbound lists",
        "Drafting first-touch sequences",
        "Keeping prospecting organized",
        "Improving sales handoff quality"
      ],
      fitNotes: [
        "Strong fit for B2B teams that need disciplined outbound",
        "Best when ICP and offer are reasonably clear",
        "Useful if the founder wants more consistency in prospecting"
      ],
      needsFromYou: ["Your target customer", "Offer positioning", "Approved outreach rules", "Examples of strong leads or accounts"],
      summary: "David is clear on ICP, offer, sequence tone, and prospecting discipline."
    };
  }

  return genericGuide;
}

function fallbackInterviewReply(worker, question) {
  const lower = String(question ?? "").toLowerCase();

  if (worker.slug === "lena-carter") {
    if (lower.includes("help")) {
      return "I would start by understanding your niche, portfolio, current outreach habits, and the kinds of brands you want to attract. From there I would tighten your positioning, build a weekly pitching rhythm, draft outreach, and keep follow-up disciplined so deals move consistently instead of sporadically.";
    }

    if (lower.includes("need from me")) {
      return "I need to understand what kind of creator you are, what brands you want to attract, what has already been tried, and where you want support most. If I have that context early, I can operate more like a real manager and less like generic advice.";
    }

    if (lower.includes("first week")) {
      return "My first week would be about reviewing your portfolio, understanding your niche and goals, mapping where outreach is breaking down, and setting the first batch of brand targets. I would want you to feel like there is already a system taking shape by the end of week one.";
    }
  }

  if (lower.includes("first week")) {
    return "In the first week, I would get aligned on priorities, review your current materials and workflow, set up a clean operating rhythm, and identify the first work batch that should move immediately. I prefer to make the first week concrete so you can see traction early.";
  }

  if (lower.includes("need from me")) {
    return "I need clear priorities, examples of what good work looks like, and your approval rules. If I know where you want speed versus tighter control, I can operate much more effectively.";
  }

  if (lower.includes("meet") || lower.includes("communication")) {
    return "I usually work best with a short recurring briefing plus direct updates when decisions are needed. The goal is consistent visibility without creating more meetings than the work actually requires.";
  }

  if (lower.includes("different")) {
    return `What makes me different is that I am structured around execution in ${worker.department.toLowerCase()}, not generic advice. I take a defined function off your plate, keep the work organized, and make it easier for you to review real decisions instead of supervising every small step.`;
  }

  return `I would help by taking ownership of the ${worker.title.toLowerCase()} function, turning your priorities into an operating plan, and keeping the work visible enough that you only need to step in when decisions are actually needed.`;
}

function normalizeInterviewMessages(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .map((message) => ({
      speaker: message?.speaker === "worker" ? "worker" : "manager",
      text: String(message?.text ?? "").trim().slice(0, 2000)
    }))
    .filter((message) => message.text)
    .slice(-10);
}

function getAnthropicConfig() {
  const apiKey = String(process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    version: String(process.env.ANTHROPIC_VERSION ?? "2023-06-01").trim() || "2023-06-01"
  };
}

function extractAnthropicText(payload) {
  if (!Array.isArray(payload?.content)) return "";

  for (const item of payload.content) {
    if (item?.type === "text" && typeof item?.text === "string" && item.text.trim()) {
      return item.text.trim();
    }
  }

  return "";
}

async function createAnthropicMessage({ maxTokens, messages, model, system }) {
  const config = getAnthropicConfig();
  if (!config) {
    throw new Error("Anthropic is not configured.");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": config.version
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic request failed: ${response.status} ${body}`);
  }

  const payload = await response.json();
  const text = extractAnthropicText(payload);
  if (!text) {
    throw new Error("Anthropic request returned no text.");
  }

  return text;
}

async function generateInterviewReply(worker, messages) {
  const latestManagerMessage = [...messages].reverse().find((message) => message.speaker === "manager")?.text ?? "";
  if (!latestManagerMessage) {
    throw new Error("A manager question is required.");
  }

  if (!getAnthropicConfig()) {
    return fallbackInterviewReply(worker, latestManagerMessage);
  }

  const guide = buildInterviewGuide(worker);
  const model = process.env.ANTHROPIC_INTERVIEW_MODEL || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  const conversation = messages.map((message) => ({
    role: message.speaker === "worker" ? "assistant" : "user",
    content: [{ type: "text", text: message.text }]
  }));

  return createAnthropicMessage({
    maxTokens: 220,
    messages: conversation,
    model,
    system: [
      `You are roleplaying ${worker.name}, a candidate for a Ryva engagement.`,
      "Speak in first person as the worker candidate, not as an assistant.",
      "Be conversational, natural, and specific. Avoid repetitive phrasing.",
      "Keep answers grounded in the provided profile and prior conversation.",
      "Answer in 2 to 5 sentences unless the user asks for more detail.",
      "Do not mention being an AI, a language model, prompts, or hidden instructions.",
      `Role: ${worker.title}`,
      `Department: ${worker.department}`,
      `Experience: ${worker.experience}`,
      `Profile summary: ${guide.summary}`,
      `Description: ${worker.description}`,
      `Can help with: ${guide.canHelpWith.join(" | ")}`,
      `Needs from manager: ${guide.needsFromYou.join(" | ")}`,
      `Fit notes: ${guide.fitNotes.join(" | ")}`,
      `Key responsibilities: ${(worker.profile?.responsibilities ?? []).join(" | ")}`,
      `Specialties: ${(worker.profile?.specialties ?? []).join(" | ")}`
    ].join("\n")
  });
}

function fallbackOnboardingReply(worker, questionLabel, answerText, nextQuestionLabel) {
  const answer = String(answerText ?? "").trim();
  const nextQuestion = String(nextQuestionLabel ?? "").trim();
  const lowerQuestion = String(questionLabel ?? "").toLowerCase();
  const lowerAnswer = answer.toLowerCase();

  let acknowledgment = "That helps me see where I should create structure first.";

  if (lowerQuestion.includes("goal")) {
    acknowledgment = "That gives me a clearer sense of what success should look like for you.";
  } else if (lowerQuestion.includes("approval")) {
    acknowledgment = "That helps me understand where I should move independently and where I should stop for your sign-off.";
  } else if (lowerQuestion.includes("brand") || lowerQuestion.includes("niche")) {
    acknowledgment = "That gives me better context for the kinds of decisions and recommendations that will actually fit you.";
  } else if (lowerAnswer.includes("lose track") || lowerAnswer.includes("losing track")) {
    acknowledgment = "That tells me visibility and follow-through need to be much tighter.";
  } else if (lowerAnswer.includes("not doing anything") || lowerAnswer.includes("no system")) {
    acknowledgment = "That helps. It sounds like I should assume there is not a real system in place yet and build from zero.";
  } else if (lowerAnswer.includes("follow up") || lowerAnswer.includes("follow-up")) {
    acknowledgment = "That helps me see where consistency is breaking down.";
  }

  if (!nextQuestion) {
    return `${acknowledgment} I have enough to shape the first working plan and operating setup from here.`;
  }

  return `${acknowledgment} ${nextQuestion}`;
}

function formatKnownOnboardingAnswers(knownAnswers) {
  if (!knownAnswers || typeof knownAnswers !== "object") {
    return "";
  }

  const lines = Object.entries(knownAnswers)
    .map(([key, value]) => [String(key).trim(), String(value ?? "").trim()])
    .filter(([key, value]) => key && value)
    .slice(-8)
    .map(([key, value]) => `${key}: ${value}`);

  return lines.join("\n");
}

async function generateOnboardingReply(worker, payload) {
  const {
    answerText,
    knownAnswers,
    nextQuestionLabel,
    questionHelperText,
    questionLabel,
    role,
    sectionTitle,
    summarySoFar
  } = payload;

  if (!getAnthropicConfig()) {
    return fallbackOnboardingReply(worker, questionLabel, answerText, nextQuestionLabel);
  }

  const model = process.env.ANTHROPIC_ONBOARDING_MODEL || process.env.ANTHROPIC_INTERVIEW_MODEL || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  return createAnthropicMessage({
    maxTokens: 140,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: `Manager answer: ${answerText}` }]
      }
    ],
    model,
    system: [
      `You are ${worker.name}, a newly hired ${role || worker.title} being onboarded inside Ryva Office.`,
      "Reply like a polished new hire in Slack or Teams.",
      "Sound professional, concise, and human. No hype, no AI phrasing, no generic corporate filler.",
      "Acknowledge the manager's answer in one short sentence, then naturally transition into the next onboarding question if one exists.",
      "Your acknowledgment should sound specific to the manager's situation, not reusable across different users.",
      "Use the running context you have learned so far to make the reply feel tailored.",
      "Never use bullet points.",
      "Keep the full reply under 70 words.",
      `Current onboarding section: ${sectionTitle || "General"}`,
      `Current question: ${questionLabel}`,
      questionHelperText ? `Context for the current question: ${questionHelperText}` : "",
      summarySoFar?.length ? `Working memory so far:\n${summarySoFar.join("\n")}` : "",
      formatKnownOnboardingAnswers(knownAnswers) ? `Known answers so far:\n${formatKnownOnboardingAnswers(knownAnswers)}` : "",
      nextQuestionLabel ? `Next onboarding question to ask: ${nextQuestionLabel}` : "There is no next question. Close the onboarding exchange neatly."
    ]
      .filter(Boolean)
      .join("\n")
  });
}

function normalizeTextList(value, limit = 12) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry).trim())
    .filter(Boolean)
    .slice(0, limit);
}

function isMaraWorker(workerSlug) {
  return workerSlug === MARA_SLUG;
}

function parseJson(value, fallback) {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function serializeJson(value) {
  return JSON.stringify(value ?? {});
}

function getUserBrandContext(userId) {
  const onboarding = getUserOnboardingRecord(userId);
  const globalSettings = db
    .prepare(
      `SELECT settings_json AS settingsJson
       FROM office_global_settings
       WHERE user_id = ?`
    )
    .get(userId);
  const parsedSettings = parseJson(globalSettings?.settingsJson, {});

  return {
    brandName: onboarding?.brandName || String(parsedSettings.companyName ?? "").trim() || "Your brand",
    nicheSummary:
      onboarding?.whatYouDo ||
      String(parsedSettings.brandContext ?? "").trim() ||
      "A creator business focused on organized UGC work, clear follow-up, and better brand operations."
  };
}

function buildMaraWorkerMemory(userId) {
  const { brandName, nicheSummary } = getUserBrandContext(userId);
  const lowerContext = nicheSummary.toLowerCase();
  const preferredNiches = [
    lowerContext.includes("fitness") ? "fitness" : null,
    lowerContext.includes("wellness") ? "wellness" : null,
    lowerContext.includes("beauty") || lowerContext.includes("skincare") ? "skincare" : null,
    "creator tools"
  ].filter(Boolean);

  return {
    brand_name: brandName,
    business_summary: nicheSummary,
    minimum_rate: 350,
    accepts_gifted: false,
    accepts_affiliate_only: false,
    tone: "friendly_professional",
    filming_days: ["Monday", "Wednesday"],
    preferred_niches: preferredNiches.length > 0 ? preferredNiches : ["wellness", "fitness", "skincare"],
    excluded_categories: ["diet teas", "fast fashion"],
    daily_brand_discovery_limit: 5
  };
}

function ensureMaraKnowledge(userId) {
  if (!hasHiredWorker(userId, MARA_SLUG)) return;
  const existing = db
    .prepare(
      `SELECT id
       FROM office_worker_knowledge
       WHERE user_id = ? AND worker_slug = ?`
    )
    .get(userId, MARA_SLUG);

  if (existing) return;

  const memory = buildMaraWorkerMemory(userId);
  const sections = [
    {
      title: "Creator preferences",
      items: [
        `Minimum rate: $${memory.minimum_rate}`,
        `Accepts gifted only: ${memory.accepts_gifted ? "Yes" : "No"}`,
        `Accepts affiliate only: ${memory.accepts_affiliate_only ? "Yes" : "No"}`,
        `Tone: ${memory.tone.replace(/_/g, " ")}`
      ]
    },
    {
      title: "Preferred niches",
      items: memory.preferred_niches
    },
    {
      title: "Excluded categories",
      items: memory.excluded_categories
    }
  ];

  db.prepare(
    `INSERT INTO office_worker_knowledge (id, user_id, worker_slug, knowledge_json, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(randomUUID(), userId, MARA_SLUG, JSON.stringify(sections), nowIso());
}

function ensureMaraIntegrationRecord(userId, provider) {
  const accountLabel = provider === "gmail" ? "Gmail inbox" : "Outlook inbox";
  db.prepare(
    `INSERT INTO office_worker_integrations
      (id, user_id, worker_slug, provider, status, account_label, metadata_json, connected_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, worker_slug, provider) DO UPDATE SET
       status = excluded.status,
       account_label = excluded.account_label,
       metadata_json = excluded.metadata_json,
       connected_at = excluded.connected_at,
       updated_at = excluded.updated_at`
  ).run(
    randomUUID(),
    userId,
    MARA_SLUG,
    provider,
    "connected",
    accountLabel,
    serializeJson({ simulated: false }),
    nowIso(),
    nowIso()
  );
}

function insertMaraSyncJob(userId, provider, jobName, summary, status = "completed") {
  db.prepare(
    `INSERT INTO office_sync_jobs (id, user_id, worker_slug, job_name, provider, status, summary, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), userId, MARA_SLUG, jobName, provider, status, summary, nowIso(), nowIso());
}

function seedMaraThreads(userId, provider = "gmail") {
  const existing = db
    .prepare(
      `SELECT id
       FROM office_email_threads
       WHERE user_id = ? AND worker_slug = ?`
    )
    .all(userId, MARA_SLUG);

  if (existing.length > 0) return;

  const timestamp = nowIso();
  const threads = [
    {
      subject: "Glow Theory UGC brief for August routine campaign",
      snippet: "Sharing the brief, draft deadline, and required skincare talking points for next month's launch.",
      receivedAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
      brandRelated: 1,
      category: "campaign_brief",
      urgency: "high",
      confidence: 0.96,
      reason: "Includes deliverables, timelines, and required talking points.",
      brandName: "Glow Theory",
      contactName: "Nina Patel",
      contactEmail: "nina@glowtheory.co",
      sourceMessageCount: 4,
      threadStatus: "open",
      participants: ["Nina Patel <nina@glowtheory.co>", "You"],
      raw: { suggested_worker: MARA_SLUG, brand_related: true }
    },
    {
      subject: "Can you send rates for three short-form wellness videos?",
      snippet: "Brand asked for pricing but did not mention usage rights or payment timing.",
      receivedAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
      brandRelated: 1,
      category: "rate_request",
      urgency: "medium",
      confidence: 0.92,
      reason: "Clear pricing request with missing usage details.",
      brandName: "Forme Labs",
      contactName: "Eli Brooks",
      contactEmail: "eli@formelabs.com",
      sourceMessageCount: 2,
      threadStatus: "waiting_on_reply",
      participants: ["Eli Brooks <eli@formelabs.com>", "You"],
      raw: { suggested_worker: MARA_SLUG, brand_related: true }
    },
    {
      subject: "A few edits before final approval",
      snippet: "Brand wants one hook change and a cleaner product close before signing off.",
      receivedAt: new Date(Date.now() - 1000 * 60 * 145).toISOString(),
      brandRelated: 1,
      category: "revision_request",
      urgency: "high",
      confidence: 0.94,
      reason: "Explicit request for content revisions.",
      brandName: "Kinfield",
      contactName: "Mara Chen",
      contactEmail: "mara@kinfield.com",
      sourceMessageCount: 6,
      threadStatus: "revision_open",
      participants: ["Mara Chen <mara@kinfield.com>", "You"],
      raw: { suggested_worker: MARA_SLUG, brand_related: true }
    },
    {
      subject: "Checking in on invoice 1048",
      snippet: "Payment team asked for a resend and did not confirm when funds will go out.",
      receivedAt: new Date(Date.now() - 1000 * 60 * 210).toISOString(),
      brandRelated: 1,
      category: "payment_question",
      urgency: "medium",
      confidence: 0.9,
      reason: "Payment conversation with unclear timing.",
      brandName: "SageHaus",
      contactName: "Ari Gomez",
      contactEmail: "finance@sagehaus.com",
      sourceMessageCount: 3,
      threadStatus: "follow_up_needed",
      participants: ["Ari Gomez <finance@sagehaus.com>", "You"],
      raw: { suggested_worker: MARA_SLUG, brand_related: true }
    }
  ];

  for (const thread of threads) {
    db.prepare(
      `INSERT INTO office_email_threads
        (id, user_id, worker_slug, provider, subject, participants_json, snippet, received_at, brand_related, category,
         urgency, confidence, reason, brand_name, contact_name, contact_email, source_message_count, thread_status,
         raw_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      userId,
      MARA_SLUG,
      provider,
      thread.subject,
      JSON.stringify(thread.participants),
      thread.snippet,
      thread.receivedAt,
      thread.brandRelated,
      thread.category,
      thread.urgency,
      thread.confidence,
      thread.reason,
      thread.brandName,
      thread.contactName,
      thread.contactEmail,
      thread.sourceMessageCount,
      thread.threadStatus,
      JSON.stringify(thread.raw),
      timestamp,
      timestamp
    );
  }
}

function seedMaraCampaigns(userId) {
  const existing = db
    .prepare(
      `SELECT id
       FROM office_campaigns
       WHERE user_id = ? AND worker_slug = ?`
    )
    .all(userId, MARA_SLUG);

  if (existing.length > 0) return;

  const threads = db
    .prepare(
      `SELECT id, brand_name AS brandName, contact_name AS contactName, contact_email AS contactEmail, subject, category
       FROM office_email_threads
       WHERE user_id = ? AND worker_slug = ?`
    )
    .all(userId, MARA_SLUG);

  const threadMap = new Map(threads.map((thread) => [thread.brandName, thread]));
  const now = nowIso();
  const campaigns = [
    {
      brandName: "Glow Theory",
      brandWebsite: "https://glowtheory.co",
      contactName: threadMap.get("Glow Theory")?.contactName ?? "Nina Patel",
      contactEmail: threadMap.get("Glow Theory")?.contactEmail ?? "nina@glowtheory.co",
      productName: "Barrier Repair Serum",
      campaignName: "August Routine Launch",
      campaignStatus: "brief_received",
      sourceThreadId: threadMap.get("Glow Theory")?.id ?? null,
      deliverables: ["2 TikTok videos", "1 Instagram Reel", "Story frame with link"],
      briefText: "Brief includes talking points, draft timing, and disclosure requirements.",
      draftDueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
      finalDueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
      paymentAmount: "",
      paymentStatus: "pending_terms",
      usageRights: "",
      usageRightsStatus: "unclear",
      revisionLimit: "",
      rawFootageRequired: 1,
      missingFields: ["payment_amount_missing", "usage_rights_unclear", "revision_limit_missing"],
      riskFlags: ["raw_footage_requested", "usage_rights_unclear"],
      notes: "Draft clarification email prepared before filming starts."
    },
    {
      brandName: "Kinfield",
      brandWebsite: "https://kinfield.com",
      contactName: threadMap.get("Kinfield")?.contactName ?? "Mara Chen",
      contactEmail: threadMap.get("Kinfield")?.contactEmail ?? "mara@kinfield.com",
      productName: "Trail Mist",
      campaignName: "Summer Reset UGC",
      campaignStatus: "revision_requested",
      sourceThreadId: threadMap.get("Kinfield")?.id ?? null,
      deliverables: ["1 short-form video", "1 revised CTA ending"],
      briefText: "Revision requested on the existing draft. Brand wants hook and product close updated.",
      draftDueDate: new Date(Date.now() + 1000 * 60 * 60 * 20).toISOString(),
      finalDueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
      paymentAmount: "$1,200",
      paymentStatus: "approved_pending_final",
      usageRights: "90-day paid social",
      usageRightsStatus: "confirmed",
      revisionLimit: "2 rounds",
      rawFootageRequired: 0,
      missingFields: [],
      riskFlags: ["deadline_missing"],
      notes: "Needs revised hook and cleaner final CTA before approval."
    }
  ];

  for (const campaign of campaigns) {
    db.prepare(
      `INSERT INTO office_campaigns
        (id, user_id, worker_slug, brand_name, brand_website, contact_name, contact_email, product_name, campaign_name,
         campaign_status, source_thread_id, deliverables_json, brief_text, draft_due_date, final_due_date, payment_amount,
         payment_status, usage_rights, usage_rights_status, revision_limit, raw_footage_required, missing_fields_json,
         risk_flags_json, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      userId,
      MARA_SLUG,
      campaign.brandName,
      campaign.brandWebsite,
      campaign.contactName,
      campaign.contactEmail,
      campaign.productName,
      campaign.campaignName,
      campaign.campaignStatus,
      campaign.sourceThreadId,
      JSON.stringify(campaign.deliverables),
      campaign.briefText,
      campaign.draftDueDate,
      campaign.finalDueDate,
      campaign.paymentAmount,
      campaign.paymentStatus,
      campaign.usageRights,
      campaign.usageRightsStatus,
      campaign.revisionLimit,
      campaign.rawFootageRequired,
      JSON.stringify(campaign.missingFields),
      JSON.stringify(campaign.riskFlags),
      campaign.notes,
      now,
      now
    );
  }
}

function seedMaraTasks(userId) {
  const existing = db
    .prepare(
      `SELECT id
       FROM office_custom_tasks
       WHERE user_id = ? AND worker_slug = ? AND module_name = ?`
    )
    .all(userId, MARA_SLUG, "Mara");

  if (existing.length > 0) return;

  const campaigns = db
    .prepare(
      `SELECT id, campaign_name AS campaignName, brand_name AS brandName
       FROM office_campaigns
       WHERE user_id = ? AND worker_slug = ?`
    )
    .all(userId, MARA_SLUG);

  const glow = campaigns.find((campaign) => campaign.brandName === "Glow Theory");
  const kinfield = campaigns.find((campaign) => campaign.brandName === "Kinfield");
  const tasks = [
    {
      title: "Clarify payment and usage rights with Glow Theory",
      module: "Mara",
      owner: "Worker",
      priority: "High",
      status: "Needs Review",
      dueDate: "Today"
    },
    {
      title: "Block filming time for August Routine Launch",
      module: "Mara",
      owner: "Worker",
      priority: "Medium",
      status: "To Do",
      dueDate: "Tomorrow"
    },
    {
      title: "Revise Kinfield draft hook and CTA",
      module: "Mara",
      owner: "Worker",
      priority: "High",
      status: "In Progress",
      dueDate: "Today"
    },
    {
      title: "Follow up on SageHaus invoice timing",
      module: "Mara",
      owner: "Worker",
      priority: "Medium",
      status: "To Do",
      dueDate: "This week"
    }
  ];

  for (const task of tasks) {
    db.prepare(
      `INSERT INTO office_custom_tasks (id, user_id, worker_slug, title, module_name, owner, priority, status, due_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(randomUUID(), userId, MARA_SLUG, task.title, task.module, task.owner, task.priority, task.status, task.dueDate, nowIso());
  }
}

function seedMaraCalendar(userId) {
  const existing = db
    .prepare(
      `SELECT id
       FROM office_calendar_events
       WHERE user_id = ? AND worker_slug = ? AND event_type = ?`
    )
    .all(userId, MARA_SLUG, "Focus");

  if (existing.length > 0) return;

  const today = new Date();
  const draftStart = new Date(today);
  draftStart.setHours(11, 0, 0, 0);
  const draftEnd = new Date(today);
  draftEnd.setHours(12, 0, 0, 0);
  const followupStart = new Date(today);
  followupStart.setHours(15, 30, 0, 0);
  const followupEnd = new Date(today);
  followupEnd.setHours(16, 0, 0, 0);

  const events = [
    {
      title: "Film block — Glow Theory draft",
      startsAt: draftStart.toISOString(),
      endsAt: draftEnd.toISOString(),
      eventType: "Focus",
      notes: "Reserved by Mara from the campaign draft timeline."
    },
    {
      title: "Follow up — SageHaus invoice",
      startsAt: followupStart.toISOString(),
      endsAt: followupEnd.toISOString(),
      eventType: "Review",
      notes: "Suggested payment reminder window."
    }
  ];

  for (const event of events) {
    db.prepare(
      `INSERT INTO office_calendar_events
        (id, user_id, worker_slug, title, starts_at, ends_at, event_type, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(randomUUID(), userId, MARA_SLUG, event.title, event.startsAt, event.endsAt, event.eventType, event.notes, nowIso(), nowIso());
  }
}

function seedMaraSuggestedActions(userId) {
  const existing = db
    .prepare(
      `SELECT id
       FROM office_suggested_actions
       WHERE user_id = ? AND worker_slug = ?`
    )
    .all(userId, MARA_SLUG);

  if (existing.length > 0) return;

  const campaigns = db
    .prepare(
      `SELECT id, brand_name AS brandName, campaign_name AS campaignName
       FROM office_campaigns
       WHERE user_id = ? AND worker_slug = ?`
    )
    .all(userId, MARA_SLUG);

  const threads = db
    .prepare(
      `SELECT id, brand_name AS brandName
       FROM office_email_threads
       WHERE user_id = ? AND worker_slug = ?`
    )
    .all(userId, MARA_SLUG);

  const glowCampaign = campaigns.find((campaign) => campaign.brandName === "Glow Theory");
  const glowThread = threads.find((thread) => thread.brandName === "Glow Theory");
  const sageThread = threads.find((thread) => thread.brandName === "SageHaus");

  const actions = [
    {
      actionType: "draft_email",
      title: "Approve clarification reply to Glow Theory",
      description: "I drafted a concise note asking for payment amount, usage duration, and revision limits before filming starts.",
      reason: "The brief includes deadlines and deliverables, but compensation and rights are still unclear.",
      relatedThreadId: glowThread?.id ?? null,
      relatedCampaignId: glowCampaign?.id ?? null,
      relatedBrandId: "Glow Theory",
      payload: {
        draftText:
          "Thanks for sending this over. Before we block filming, could you confirm compensation, usage rights duration, and how many revision rounds are included?"
      }
    },
    {
      actionType: "create_calendar_event",
      title: "Approve Mara's filming block for Glow Theory",
      description: "I reserved a one-hour filming block on the internal Ryva calendar so the draft deadline does not sneak up.",
      reason: "The draft due date is close enough that it should already be protected on the calendar.",
      relatedThreadId: glowThread?.id ?? null,
      relatedCampaignId: glowCampaign?.id ?? null,
      relatedBrandId: "Glow Theory",
      payload: {
        event: {
          title: "Filming block — Glow Theory",
          eventType: "Focus"
        }
      }
    },
    {
      actionType: "draft_email",
      title: "Approve SageHaus payment follow-up",
      description: "I drafted a polite invoice reminder asking when payment will be released.",
      reason: "The finance thread requested a resend but still did not confirm a payment date.",
      relatedThreadId: sageThread?.id ?? null,
      relatedCampaignId: null,
      relatedBrandId: "SageHaus",
      payload: {
        draftText:
          "Just checking in on invoice 1048. I resent the requested copy here and wanted to confirm the expected payment timing on your side."
      }
    }
  ];

  for (const action of actions) {
    db.prepare(
      `INSERT INTO office_suggested_actions
        (id, user_id, worker_slug, action_type, title, description, reason, related_thread_id, related_campaign_id,
         related_brand_id, payload_json, status, requires_approval, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      userId,
      MARA_SLUG,
      action.actionType,
      action.title,
      action.description,
      action.reason,
      action.relatedThreadId,
      action.relatedCampaignId,
      action.relatedBrandId,
      JSON.stringify(action.payload),
      "suggested",
      1,
      nowIso(),
      nowIso()
    );
  }
}

function seedMaraOpportunities(userId) {
  const existing = db
    .prepare(
      `SELECT id
       FROM office_brand_opportunities
       WHERE user_id = ? AND worker_slug = ?`
    )
    .all(userId, MARA_SLUG);

  if (existing.length > 0) return;

  const opportunities = [
    {
      brandName: "Glow Habit",
      website: "https://glowhabit.com",
      category: "Skincare",
      source: "Ryva market intelligence",
      fitScore: 91,
      ugcPotentialScore: 88,
      riskScore: 23,
      priority: "High",
      contentGap: "Their paid social feels polished, but public creator content is still light on realistic routine demos.",
      suggestedAngle: "Pitch a simple morning routine built around visible before-and-after texture shots.",
      sourceNotes: "Brand site and public ad creative both point toward routine-first messaging.",
      status: "new"
    },
    {
      brandName: "Forme Labs",
      website: "https://formelabs.com",
      category: "Wellness",
      source: "Brand research snapshot",
      fitScore: 84,
      ugcPotentialScore: 86,
      riskScore: 31,
      priority: "Medium",
      contentGap: "Limited founder-facing testimonial content compared with product explainer creative.",
      suggestedAngle: "Offer a testimonial-style workflow video tied to creator productivity.",
      sourceNotes: "Brand posts often highlight product features more than day-in-the-life usage.",
      status: "new"
    },
    {
      brandName: "Twill Active",
      website: "https://twillactive.com",
      category: "Fitness",
      source: "Opportunity monitoring",
      fitScore: 79,
      ugcPotentialScore: 83,
      riskScore: 28,
      priority: "Medium",
      contentGap: "Strong product pages, but almost no creator-led gym locker room content.",
      suggestedAngle: "Pitch a short changing-room to training-floor sequence with natural voiceover.",
      sourceNotes: "Recent product launch suggests they are increasing content volume.",
      status: "new"
    },
    {
      brandName: "SageHaus",
      website: "https://sagehaus.co",
      category: "Home & Wellness",
      source: "Creator chatter signal",
      fitScore: 74,
      ugcPotentialScore: 76,
      riskScore: 57,
      priority: "Low",
      contentGap: "Lifestyle content is clean, but creator demos rarely show practical product setup.",
      suggestedAngle: "Pitch a setup-to-use walkthrough with emphasis on calm daily routines.",
      sourceNotes: "Public creator chatter suggests possible delayed payment concerns. Treat as caution, not confirmed proof.",
      status: "new"
    },
    {
      brandName: "Kinfield",
      website: "https://kinfield.com",
      category: "Outdoor skincare",
      source: "Renewal signal",
      fitScore: 88,
      ugcPotentialScore: 82,
      riskScore: 19,
      priority: "High",
      contentGap: "Their outdoor content is strong, but creator edit styles still skew polished over candid.",
      suggestedAngle: "Propose a more candid routine format once the current revision cycle closes.",
      sourceNotes: "Existing relationship makes this more of a renewal-ready opportunity than cold outreach.",
      status: "new"
    }
  ];

  for (const opportunity of opportunities) {
    db.prepare(
      `INSERT INTO office_brand_opportunities
        (id, user_id, worker_slug, brand_name, website, category, source, fit_score, ugc_potential_score,
         risk_score, priority, content_gap, suggested_angle, source_notes, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      userId,
      MARA_SLUG,
      opportunity.brandName,
      opportunity.website,
      opportunity.category,
      opportunity.source,
      opportunity.fitScore,
      opportunity.ugcPotentialScore,
      opportunity.riskScore,
      opportunity.priority,
      opportunity.contentGap,
      opportunity.suggestedAngle,
      opportunity.sourceNotes,
      opportunity.status,
      nowIso(),
      nowIso()
    );
  }
}

function seedMaraTrendSignals(userId) {
  const existing = db
    .prepare(
      `SELECT id
       FROM office_trend_signals
       WHERE user_id = ? AND worker_slug = ?`
    )
    .all(userId, MARA_SLUG);

  if (existing.length > 0) return;

  const signals = [
    {
      niche: "wellness",
      platform: "TikTok",
      signalType: "hook_format",
      title: "Routine-first hooks are still outperforming polished intros",
      summary: "Creator-facing wellness content is leaning toward casual first lines before product explanation.",
      hashtags: ["#morningsetup", "#realroutine"],
      examples: ["Start on the mess before the product", "Lead with one line of friction before the result"],
      confidence: "medium",
      source: "Ryva market intelligence"
    },
    {
      niche: "ugc",
      platform: "Reddit-derived",
      signalType: "brand_warning",
      title: "Creators are asking harder questions about usage duration",
      summary: "Public creator discussions are increasingly flagging vague paid-usage language as a source of scope creep.",
      hashtags: [],
      examples: ["Ask for duration before filming", "Treat raw footage requests as a separate scope conversation"],
      confidence: "medium",
      source: "Ryva creator chatter layer"
    }
  ];

  for (const signal of signals) {
    db.prepare(
      `INSERT INTO office_trend_signals
        (id, user_id, worker_slug, niche, platform, signal_type, title, summary, hashtags_json, examples_json,
         confidence, source, detected_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      userId,
      MARA_SLUG,
      signal.niche,
      signal.platform,
      signal.signalType,
      signal.title,
      signal.summary,
      JSON.stringify(signal.hashtags),
      JSON.stringify(signal.examples),
      signal.confidence,
      signal.source,
      nowIso()
    );
  }
}

function seedMaraRecentWork(userId, provider = "gmail") {
  const existing = db
    .prepare(
      `SELECT id
       FROM office_activity_logs
       WHERE user_id = ? AND worker_slug = ? AND module_name = ?`
    )
    .all(userId, MARA_SLUG, "Mara");

  if (existing.length > 0) return;

  const worklog = [
    ["Connected inbox.", "Mara", `${provider === "gmail" ? "Gmail" : "Outlook"} integration ready`],
    ["Classified email threads.", "Mara", "4 brand-related conversations tagged"],
    ["Created campaign drafts.", "Mara", "Glow Theory and Kinfield campaigns organized"],
    ["Prepared approval queue.", "Mara", "3 suggested actions waiting on you"],
    ["Found brand opportunities.", "Mara", "5 aligned brands added to today's list"]
  ];

  worklog.forEach(([action, module, result], index) => {
    db.prepare(
      `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      userId,
      MARA_SLUG,
      action,
      module,
      result,
      new Date(Date.now() - index * 1000 * 60 * 18).toISOString()
    );
  });
}

function ensureMaraWorkspaceData(userId, provider = "gmail") {
  if (!hasHiredWorker(userId, MARA_SLUG)) return;
  ensureMaraKnowledge(userId);
  ensureMaraIntegrationRecord(userId, provider);
  seedMaraThreads(userId, provider);
  seedMaraCampaigns(userId);
  seedMaraTasks(userId);
  seedMaraCalendar(userId);
  seedMaraSuggestedActions(userId);
  seedMaraOpportunities(userId);
  seedMaraTrendSignals(userId);
  seedMaraRecentWork(userId, provider);
  insertMaraSyncJob(userId, provider, "generate_daily_mara_brief", "Prepared Mara's daily brief from email, campaigns, and brand signals.");
}

function maraIntegrations(userId) {
  return db
    .prepare(
      `SELECT provider, status, account_label AS accountLabel, connected_at AS connectedAt, metadata_json AS metadataJson
       FROM office_worker_integrations
       WHERE user_id = ? AND worker_slug = ?
       ORDER BY provider ASC`
    )
    .all(userId, MARA_SLUG)
    .map((integration) => ({
      ...integration,
      metadata: parseJson(integration.metadataJson, {})
    }));
}

function buildMaraDailyBrief(userId) {
  const threads = db
    .prepare(
      `SELECT category
       FROM office_email_threads
       WHERE user_id = ? AND worker_slug = ?`
    )
    .all(userId, MARA_SLUG);
  const campaigns = db
    .prepare(
      `SELECT id
       FROM office_campaigns
       WHERE user_id = ? AND worker_slug = ?`
    )
    .all(userId, MARA_SLUG);
  const actions = db
    .prepare(
      `SELECT id
       FROM office_suggested_actions
       WHERE user_id = ? AND worker_slug = ? AND status = ?`
    )
    .all(userId, MARA_SLUG, "suggested");
  const opportunities = db
    .prepare(
      `SELECT id
       FROM office_brand_opportunities
       WHERE user_id = ? AND worker_slug = ? AND status = ?`
    )
    .all(userId, MARA_SLUG, "new");
  const risks = db
    .prepare(
      `SELECT risk_flags_json AS riskFlagsJson, missing_fields_json AS missingFieldsJson
       FROM office_campaigns
       WHERE user_id = ? AND worker_slug = ?`
    )
    .all(userId, MARA_SLUG);

  const countCategory = (category) => threads.filter((thread) => thread.category === category).length;
  const riskCount = risks.reduce((sum, entry) => sum + parseJson(entry.riskFlagsJson, []).length + parseJson(entry.missingFieldsJson, []).length, 0);

  return {
    intro: "I checked your inbox, campaigns, calendar, and Ryva's built-in market signals before you got here.",
    found: [
      `${countCategory("campaign_brief")} campaign brief${countCategory("campaign_brief") === 1 ? "" : "s"}`,
      `${countCategory("revision_request")} revision request${countCategory("revision_request") === 1 ? "" : "s"}`,
      `${countCategory("payment_question")} payment follow-up${countCategory("payment_question") === 1 ? "" : "s"}`,
      `${opportunities.length} aligned brand opportunit${opportunities.length === 1 ? "y" : "ies"}`
    ],
    prepared: [
      `${actions.length} approval item${actions.length === 1 ? "" : "s"}`,
      `${campaigns.length} campaign draft${campaigns.length === 1 ? "" : "s"} in motion`,
      `${riskCount} risk or missing-info flag${riskCount === 1 ? "" : "s"}`
    ]
  };
}

function getMaraDashboard(userId) {
  const threads = db
    .prepare(
      `SELECT id, provider, subject, snippet, received_at AS receivedAt, brand_related AS brandRelated, category, urgency,
              confidence, reason, brand_name AS brandName, contact_name AS contactName, contact_email AS contactEmail,
              source_message_count AS sourceMessageCount, thread_status AS threadStatus
       FROM office_email_threads
       WHERE user_id = ? AND worker_slug = ?
       ORDER BY received_at DESC`
    )
    .all(userId, MARA_SLUG);

  const campaigns = db
    .prepare(
      `SELECT id, brand_name AS brandName, brand_website AS brandWebsite, contact_name AS contactName, contact_email AS contactEmail,
              product_name AS productName, campaign_name AS campaignName, campaign_status AS campaignStatus, source_thread_id AS sourceThreadId,
              deliverables_json AS deliverablesJson, brief_text AS briefText, draft_due_date AS draftDueDate, final_due_date AS finalDueDate,
              payment_amount AS paymentAmount, payment_status AS paymentStatus, usage_rights AS usageRights,
              usage_rights_status AS usageRightsStatus, revision_limit AS revisionLimit, raw_footage_required AS rawFootageRequired,
              missing_fields_json AS missingFieldsJson, risk_flags_json AS riskFlagsJson, notes, created_at AS createdAt, updated_at AS updatedAt
       FROM office_campaigns
       WHERE user_id = ? AND worker_slug = ?
       ORDER BY updated_at DESC`
    )
    .all(userId, MARA_SLUG)
    .map((campaign) => ({
      ...campaign,
      deliverables: parseJson(campaign.deliverablesJson, []),
      missingFields: parseJson(campaign.missingFieldsJson, []),
      riskFlags: parseJson(campaign.riskFlagsJson, [])
    }));

  const suggestedActions = db
    .prepare(
      `SELECT id, action_type AS actionType, title, description, reason, related_thread_id AS relatedThreadId,
              related_campaign_id AS relatedCampaignId, related_brand_id AS relatedBrandId, payload_json AS payloadJson,
              status, requires_approval AS requiresApproval, created_at AS createdAt, updated_at AS updatedAt
       FROM office_suggested_actions
       WHERE user_id = ? AND worker_slug = ?
       ORDER BY created_at DESC`
    )
    .all(userId, MARA_SLUG)
    .map((action) => ({
      ...action,
      payload: parseJson(action.payloadJson, {})
    }));

  const opportunities = db
    .prepare(
      `SELECT id, brand_name AS brandName, website, category, source, fit_score AS fitScore,
              ugc_potential_score AS ugcPotentialScore, risk_score AS riskScore, priority, content_gap AS contentGap,
              suggested_angle AS suggestedAngle, source_notes AS sourceNotes, status, created_at AS createdAt, updated_at AS updatedAt
       FROM office_brand_opportunities
       WHERE user_id = ? AND worker_slug = ?
       ORDER BY created_at DESC`
    )
    .all(userId, MARA_SLUG)
    .slice(0, 5);

  const tasks = db
    .prepare(
      `SELECT id, title, module_name AS module, owner, priority, status, due_date AS dueDate
       FROM office_custom_tasks
       WHERE user_id = ? AND worker_slug = ?
       ORDER BY created_at DESC`
    )
    .all(userId, MARA_SLUG);

  const trendSignals = db
    .prepare(
      `SELECT id, niche, platform, signal_type AS signalType, title, summary, hashtags_json AS hashtagsJson,
              examples_json AS examplesJson, confidence, source, detected_at AS detectedAt
       FROM office_trend_signals
       WHERE user_id = ? AND worker_slug = ?
       ORDER BY detected_at DESC`
    )
    .all(userId, MARA_SLUG)
    .map((signal) => ({
      ...signal,
      hashtags: parseJson(signal.hashtagsJson, []),
      examples: parseJson(signal.examplesJson, [])
    }));

  const recentWork = db
    .prepare(
      `SELECT id, action, module_name AS module, result, created_at AS timestamp
       FROM office_activity_logs
       WHERE user_id = ? AND worker_slug = ?
       ORDER BY created_at DESC`
    )
    .all(userId, MARA_SLUG);

  const risks = campaigns.flatMap((campaign) => [
    ...campaign.missingFields.map((flag) => ({
      id: `${campaign.id}-${flag}`,
      type: "missing_info",
      flag,
      campaignId: campaign.id,
      campaignName: campaign.campaignName,
      plainLanguage:
        flag === "payment_amount_missing"
          ? "This campaign has deliverables and timing, but I could not find the payment amount."
          : flag === "usage_rights_unclear"
            ? "The brief does not clearly say how the brand wants to use the content after delivery."
            : flag === "revision_limit_missing"
              ? "There is no clear revision limit yet, so scope could expand later."
              : "Some important campaign information is still missing."
    })),
    ...campaign.riskFlags.map((flag) => ({
      id: `${campaign.id}-${flag}`,
      type: "risk",
      flag,
      campaignId: campaign.id,
      campaignName: campaign.campaignName,
      plainLanguage:
        flag === "raw_footage_requested"
          ? "Raw footage is being requested. That usually needs explicit confirmation before delivery."
          : flag === "deadline_missing"
            ? "Timing is still fuzzy here, so I would not let this sit without a date lock."
            : flag === "usage_rights_unclear"
              ? "Usage language is still unclear enough that it could create downstream scope confusion."
              : "I found an operational risk worth checking before this moves forward."
    }))
  ]);

  return {
    integrations: maraIntegrations(userId),
    dailyBrief: buildMaraDailyBrief(userId),
    threads,
    campaigns,
    suggestedActions,
    opportunities,
    tasks,
    trendSignals,
    risks,
    recentWork
  };
}

function upsertWorkerKnowledge(userId, workerSlug, recipe) {
  const record = db
    .prepare(
      `SELECT knowledge_json AS knowledgeJson
       FROM office_worker_knowledge
       WHERE user_id = ? AND worker_slug = ?`
    )
    .get(userId, workerSlug);

  const currentKnowledge =
    record?.knowledgeJson && typeof record.knowledgeJson === "string" ? JSON.parse(record.knowledgeJson) : [];

  const nextKnowledge = recipe(Array.isArray(currentKnowledge) ? currentKnowledge : []);

  db.prepare(
    `INSERT INTO office_worker_knowledge (id, user_id, worker_slug, knowledge_json, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, worker_slug) DO UPDATE SET
       knowledge_json = excluded.knowledge_json,
       updated_at = excluded.updated_at`
  ).run(randomUUID(), userId, workerSlug, JSON.stringify(nextKnowledge), nowIso());
}

function replaceWorkerKnowledge(userId, workerSlug, knowledgeSections) {
  const normalizedKnowledge = (Array.isArray(knowledgeSections) ? knowledgeSections : [])
    .map((section) => ({
      items: normalizeTextList(section?.items),
      title: String(section?.title ?? "").trim()
    }))
    .filter((section) => section.title && section.items.length > 0);

  db.prepare(
    `INSERT INTO office_worker_knowledge (id, user_id, worker_slug, knowledge_json, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, worker_slug) DO UPDATE SET
       knowledge_json = excluded.knowledge_json,
       updated_at = excluded.updated_at`
  ).run(randomUUID(), userId, workerSlug, JSON.stringify(normalizedKnowledge), nowIso());
}

function readWorkerKnowledgeSections(userId, workerSlug) {
  const record = db
    .prepare(
      `SELECT knowledge_json AS knowledgeJson
       FROM office_worker_knowledge
       WHERE user_id = ? AND worker_slug = ?`
    )
    .get(userId, workerSlug);

  return parseJson(record?.knowledgeJson, []);
}

function getWorkerKnowledgeSections(userId, workerSlug) {
  const record = db
    .prepare(
      `SELECT knowledge_json AS knowledgeJson
       FROM office_worker_knowledge
       WHERE user_id = ? AND worker_slug = ?`
    )
    .get(userId, workerSlug);

  return parseJson(record?.knowledgeJson, []);
}

function readMaraOnboardingAnswers(userId, workerSlug) {
  const record = db
    .prepare(
      `SELECT answers_json AS answersJson, generated_summary_json AS generatedSummaryJson, status, completed_at AS completedAt
       FROM office_onboarding_sessions
       WHERE user_id = ? AND worker_slug = ?`
    )
    .get(userId, workerSlug);

  if (!record) {
    return null;
  }

  return {
    answers: parseJson(record.answersJson, {}),
    completedAt: record.completedAt ?? null,
    generatedSummary: parseJson(record.generatedSummaryJson, []),
    status: record.status
  };
}

function readWorkerIntegrationMetadata(userId, workerSlug) {
  return db
    .prepare(
      `SELECT provider, status, account_label AS accountLabel, metadata_json AS metadataJson
       FROM office_worker_integrations
       WHERE user_id = ? AND worker_slug = ?
       ORDER BY updated_at DESC`
    )
    .all(userId, workerSlug)
    .map((row) => ({
      ...row,
      metadata: parseJson(row.metadataJson, {})
    }));
}

function readWorkerRecentMessages(userId, workerSlug) {
  return db
    .prepare(
      `SELECT author, text, created_at AS createdAt
       FROM office_chat_messages
       WHERE user_id = ? AND worker_slug = ?
       ORDER BY created_at DESC
       LIMIT 10`
    )
    .all(userId, workerSlug)
    .reverse();
}

function buildMaraExecutionReaders() {
  return {
    readAccountContext: getUserOnboardingRecord,
    readConnectedIntegrations: readWorkerIntegrationMetadata,
    readMaraOnboarding: readMaraOnboardingAnswers,
    readMessages: readWorkerRecentMessages,
    readWorkerKnowledge: readWorkerKnowledgeSections
  };
}

function mergeKnowledgeSections(existingKnowledge, sectionsToMerge) {
  const next = Array.isArray(existingKnowledge) ? [...existingKnowledge] : [];

  for (const section of sectionsToMerge) {
    const title = String(section?.title ?? "").trim();
    const items = normalizeTextList(Array.isArray(section?.items) ? section.items : []);

    if (!title || items.length === 0) {
      continue;
    }

    const index = next.findIndex((entry) => String(entry?.title ?? "").trim() === title);
    const existingItems = index >= 0 && Array.isArray(next[index]?.items) ? next[index].items.map((item) => String(item).trim()) : [];
    const mergedItems = [...items, ...existingItems.filter((item) => !items.includes(item))].slice(0, 8);
    const normalizedSection = { title, items: mergedItems };

    if (index >= 0) {
      next[index] = normalizedSection;
    } else {
      next.unshift(normalizedSection);
    }
  }

  return next;
}

function extractJsonObject(text) {
  const raw = String(text ?? "").trim();
  if (!raw) {
    return null;
  }

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;

  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function fallbackMemorySectionsFromText(text) {
  const cleaned = String(text ?? "").trim();
  const lower = cleaned.toLowerCase();
  const sections = [{ title: "Recent direction", items: [cleaned] }];

  if (!cleaned) {
    return [];
  }

  if (/(always|never|must|only|do not|don't)/.test(lower)) {
    sections.push({ title: "Approval rules", items: [cleaned] });
  }

  if (/(prefer|like|want|don'?t want|hate)/.test(lower)) {
    sections.push({ title: "Preferences", items: [cleaned] });
  }

  if (/(losing track|messy|missed|overwhelming|chaotic|behind)/.test(lower)) {
    sections.push({ title: "Pain points", items: [cleaned] });
  }

  if (/(goal|trying to|need to|want to)/.test(lower)) {
    sections.push({ title: "Goals", items: [cleaned] });
  }

  return sections;
}

async function extractWorkerMemorySections(worker, text) {
  const cleaned = String(text ?? "").trim();
  if (!cleaned) {
    return [];
  }

  if (!getAnthropicConfig()) {
    return fallbackMemorySectionsFromText(cleaned);
  }

  try {
    const model = process.env.ANTHROPIC_MEMORY_MODEL || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
    const response = await createAnthropicMessage({
      maxTokens: 220,
      model,
      system: [
        `You are extracting durable user-specific memory for ${worker.name}, a ${worker.title} in Ryva Office.`,
        "Return JSON only.",
        'Use this schema: {"sections":[{"title":"Recent direction","items":["..."]}]}',
        "Allowed section titles: Recent direction, Goals, Preferences, Approval rules, Pain points, Business context, Inbox priorities, Operating style.",
        "Only include durable information worth remembering for future work.",
        "Keep each item concise and concrete.",
        "Include Recent direction when the message contains actionable direction."
      ].join("\n"),
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: cleaned }]
        }
      ]
    });

    const parsed = extractJsonObject(response);
    const sections = Array.isArray(parsed?.sections) ? parsed.sections : [];
    const normalized = sections
      .map((section) => ({
        title: String(section?.title ?? "").trim(),
        items: normalizeTextList(Array.isArray(section?.items) ? section.items : [])
      }))
      .filter((section) => section.title && section.items.length > 0);

    return normalized.length > 0 ? normalized : fallbackMemorySectionsFromText(cleaned);
  } catch (error) {
    console.error("Worker memory extraction failed:", error);
    return fallbackMemorySectionsFromText(cleaned);
  }
}

async function rememberWorkerDirection(userId, worker, text) {
  const cleaned = String(text ?? "").trim();
  if (!cleaned) return;

  const memorySections = await extractWorkerMemorySections(worker, cleaned);
  upsertWorkerKnowledge(userId, worker.slug, (knowledge) => mergeKnowledgeSections(knowledge, memorySections));
}

function formatKnowledgeForPrompt(knowledge) {
  if (!Array.isArray(knowledge) || knowledge.length === 0) {
    return "No durable worker memory recorded yet.";
  }

  return knowledge
    .slice(0, 8)
    .map((section) => {
      const title = String(section?.title ?? "").trim();
      const items = Array.isArray(section?.items) ? section.items.map((item) => String(item).trim()).filter(Boolean) : [];
      return title && items.length > 0 ? `${title}: ${items.join(" | ")}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function buildMaraKnowledgeAdviceFallback(userId, worker, text) {
  const modules = getMaraRelevantKnowledge({
    db,
    userId,
    userMessage: text,
    workerId: worker.slug
  });
  const message = String(text ?? "").toLowerCase();
  const primary = modules[0];

  if (/price|pricing|rate/.test(message)) {
    return "Based on UGC best practices, I’d frame pricing around deliverables, usage rights, raw footage, timing, and revisions rather than pretending there’s one guaranteed number. A good starter approach is to clarify scope first, then price the package in pieces so you do not accidentally include paid usage or extras for free.";
  }

  if (/usage|rights|contract|raw footage|exclusivity/.test(message)) {
    return "Based on UGC best practices, I’d clarify organic usage, paid ad usage, duration, raw footage, and exclusivity before agreeing to anything. This is not legal advice, but those are the terms I’d want pinned down before you move forward.";
  }

  if (/pitch|outreach|brand/.test(message)) {
    return "A good starter approach is short, personalized outreach with one concrete angle and a low-friction CTA. I’d keep it tight, name why the brand fits, and avoid overexplaining or pretending you have more proof than you do.";
  }

  if (/content|ideas|hooks/.test(message)) {
    return "A good starter approach is to anchor the content around a clear hook, a relatable problem, a product demonstration, and a simple payoff. I’d keep the ideas narrow and usable instead of trying to make every concept do too much at once.";
  }

  if (primary) {
    return `Based on UGC best practices, ${primary.summary.charAt(0).toLowerCase()}${primary.summary.slice(1)} Here’s what I’d do next: keep the plan simple, specific, and easy to execute.`;
  }

  return makeWorkerReply(worker?.name);
}

async function generateOfficeWorkerReply(userId, worker, text) {
  const latestMessage = String(text ?? "").trim();
  if (!latestMessage) {
    throw new Error("A user message is required.");
  }

  if (!getAnthropicConfig()) {
    return buildMaraKnowledgeAdviceFallback(userId, worker, text);
  }

  const model = process.env.ANTHROPIC_OFFICE_MODEL || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  const onboarding = getUserOnboardingRecord(userId);
  const knowledge = getWorkerKnowledgeSections(userId, worker.slug);
  const recentThread = db
    .prepare(
      `SELECT author, text
       FROM office_chat_messages
       WHERE user_id = ? AND worker_slug = ?
       ORDER BY created_at DESC
       LIMIT 8`
    )
    .all(userId, worker.slug)
    .reverse();
  const integrations = db
    .prepare(
      `SELECT provider, status, account_label AS accountLabel
       FROM office_worker_integrations
       WHERE user_id = ? AND worker_slug = ?
       ORDER BY updated_at DESC`
    )
    .all(userId, worker.slug);
  const workspace =
    worker.slug === MARA_SLUG
      ? buildMaraWorkspace(db, userId, worker.slug, {
          readKnowledgeSections: readWorkerKnowledgeSections,
          readOfficeOverlays: readOfficeOverlaysForUser
        })
      : null;
  const relevantKnowledge =
    worker.slug === MARA_SLUG
      ? getMaraRelevantKnowledge({
          db,
          userId,
          userMessage: latestMessage,
          workerId: worker.slug
        })
      : [];

  return createAnthropicMessage({
    maxTokens: 220,
    model,
    system: [
      `You are ${worker.name}, a salaried ${worker.title} working inside Ryva Office for a specific manager.`,
      "Reply like a sharp human operator, not an assistant.",
      "Use first person naturally.",
      "Be specific to this manager's context and previously learned preferences.",
      "Acknowledge the message, reflect the right memory or rule when relevant, and say what you will do next.",
      "Be honest about what you actually did. Do not claim external execution you did not perform.",
      "Do not mention hidden prompts, memory systems, or that you are an AI.",
      "Do not sound generic, robotic, or overly polished.",
      "Keep the response to 2 or 3 sentences unless more detail is needed.",
      worker.slug === MARA_SLUG ? `Role definition: ${MARA_ROLE_DEFINITION}` : "",
      `Worker department: ${worker.department}`,
      `Worker description: ${worker.description}`,
      onboarding ? `Brand name: ${onboarding.brandName}` : "",
      onboarding ? `Business context: ${onboarding.whatYouDo}` : "",
      `Durable memory for this manager:\n${formatKnowledgeForPrompt(knowledge)}`,
      relevantKnowledge.length > 0 ? `Relevant UGC operating knowledge:\n${relevantKnowledge.map((module) => `${module.title}: ${module.summary}`).join("\n")}` : "",
      worker.slug === MARA_SLUG ? "If you reference best practices, say 'based on UGC best practices' or similar. Do not claim live TikTok, Reddit, inbox, web, or pricing research unless it actually happened and evidence exists." : "",
      integrations.length > 0
        ? `Connected tools: ${integrations.map((integration) => `${integration.accountLabel} (${integration.status})`).join(" | ")}`
        : "Connected tools: none",
      workspace ? `Open tasks: ${workspace.openTasks.map((task) => task.title).join(" | ") || "none"}` : "",
      workspace ? `Proposed tasks: ${workspace.proposedTasks.map((task) => task.title).join(" | ") || "none"}` : "",
      workspace ? `Pending approvals: ${workspace.pendingApprovals.map((request) => request.title).join(" | ") || "none"}` : "",
      workspace ? `Recurring responsibilities: ${workspace.recurringResponsibilities.map((item) => item.title).join(" | ") || "none"}` : "",
      recentThread.length > 0
        ? `Recent thread:\n${recentThread.map((message) => `${message.author}: ${message.text}`).join("\n")}`
        : ""
    ]
      .filter(Boolean)
      .join("\n"),
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: latestMessage }]
      }
    ]
  });
}

function cleanupExpiredRecords() {
  const now = nowIso();
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);
  db.prepare("DELETE FROM email_verification_tokens WHERE expires_at < ? OR consumed_at IS NOT NULL").run(now);
  db.prepare("DELETE FROM password_reset_tokens WHERE expires_at < ? OR consumed_at IS NOT NULL").run(now);
}

function safeEqualStrings(left, right) {
  if (!left || !right) return false;
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function setSessionCookie(res, rawToken) {
  res.cookie(sessionCookieName, rawToken, {
    httpOnly: true,
    maxAge: sessionDurationMs,
    path: "/",
    sameSite: "lax",
    secure: isProduction
  });
}

function setGoogleStateCookie(res, rawState) {
  res.cookie(googleStateCookieName, rawState, {
    httpOnly: true,
    maxAge: googleStateDurationMs,
    path: "/",
    sameSite: "lax",
    secure: isProduction
  });
}

function clearGoogleStateCookie(res) {
  res.clearCookie(googleStateCookieName, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isProduction
  });
}

function clearSessionCookie(res) {
  res.clearCookie(sessionCookieName, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isProduction
  });
}

function assertOrigin(req, res, next) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    next();
    return;
  }

  const origin = req.get("origin");
  const referer = req.get("referer");
  let requestOrigin = origin ?? null;

  if (!requestOrigin && referer) {
    try {
      requestOrigin = new URL(referer).origin;
    } catch {
      requestOrigin = null;
    }
  }

  if (requestOrigin && requestOrigin !== allowedOrigin) {
    res.status(403).json({ error: "Invalid request origin." });
    return;
  }

  next();
}

function getUserBySessionToken(rawToken) {
  if (!rawToken) return null;
  cleanupExpiredRecords();
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  return db
    .prepare(
      `SELECT users.*
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ? AND sessions.expires_at >= ?`
    )
    .get(tokenHash, nowIso());
}

async function requireAuth(req, res, next) {
  const user = getUserBySessionToken(req.cookies[sessionCookieName]);
  if (!user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  req.user = user;
  next();
}

async function issueEmailVerification(user) {
  const { hash, raw } = createOpaqueToken();

  db.prepare("DELETE FROM email_verification_tokens WHERE user_id = ?").run(user.id);
  db.prepare(
    `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, consumed_at, created_at)
     VALUES (?, ?, ?, ?, NULL, ?)`
  ).run(randomUUID(), user.id, hash, new Date(Date.now() + emailTokenDurationMs).toISOString(), nowIso());

  const verificationUrl = `${appUrl}/api/auth/verify-email?token=${raw}`;
  return sendTransactionalEmail({
    html: `<p>Verify your Ryva account:</p><p><a href="${verificationUrl}">${verificationUrl}</a></p>`,
    subject: "Verify your Ryva account",
    text: `Verify your Ryva account: ${verificationUrl}`,
    to: user.email
  });
}

async function issuePasswordReset(user) {
  const { hash, raw } = createOpaqueToken();

  db.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").run(user.id);
  db.prepare(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, consumed_at, created_at)
     VALUES (?, ?, ?, ?, NULL, ?)`
  ).run(randomUUID(), user.id, hash, new Date(Date.now() + resetTokenDurationMs).toISOString(), nowIso());

  const resetUrl = `${appUrl}/?reset_token=${raw}#about`;
  return sendTransactionalEmail({
    html: `<p>Reset your Ryva password:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    subject: "Reset your Ryva password",
    text: `Reset your Ryva password: ${resetUrl}`,
    to: user.email
  });
}

function createSession(userId) {
  const { hash, raw } = createOpaqueToken();
  db.prepare(
    `INSERT INTO sessions (id, token_hash, user_id, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(randomUUID(), hash, userId, new Date(Date.now() + sessionDurationMs).toISOString(), nowIso());
  return raw;
}

function authConfigPayload() {
  return {
    googleEnabled: isGoogleAuthConfigured()
  };
}

function getGoogleRedirectUri() {
  return `${appUrl}/api/auth/google/callback`;
}

async function exchangeGoogleCodeForTokens(code) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google auth is not configured.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: getGoogleRedirectUri()
    })
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed with status ${response.status}.`);
  }

  return response.json();
}

async function fetchGoogleProfile(accessToken) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Google profile request failed with status ${response.status}.`);
  }

  return response.json();
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/auth/config", (_req, res) => {
  res.json(authConfigPayload());
});

app.get("/api/workers", async (_req, res) => {
  const workers = await readWorkers();
  res.json({ workers });
});

app.get("/api/workers/:slug", async (req, res) => {
  const workers = await readWorkers();
  const worker = workers.find((entry) => entry.slug === req.params.slug);
  if (!worker) {
    res.status(404).json({ error: "Worker not found." });
    return;
  }

  res.json({ worker });
});

app.post("/api/workers/:slug/interview", interviewLimiter, assertOrigin, async (req, res) => {
  const workers = await readWorkers();
  const worker = workers.find((entry) => entry.slug === req.params.slug);

  if (!worker) {
    res.status(404).json({ error: "Worker not found." });
    return;
  }

  const messages = normalizeInterviewMessages(req.body?.messages);
  if (messages.length === 0) {
    res.status(400).json({ error: "Interview messages are required." });
    return;
  }

  try {
    const reply = await generateInterviewReply(worker, messages);
    res.json({ reply });
  } catch {
    const latestQuestion = [...messages].reverse().find((message) => message.speaker === "manager")?.text ?? "";
    res.json({ reply: fallbackInterviewReply(worker, latestQuestion), fallback: true });
  }
});

app.post("/api/workers/:slug/onboarding/reply", onboardingLimiter, assertOrigin, async (req, res) => {
  const workers = await readWorkers();
  const worker = workers.find((entry) => entry.slug === req.params.slug);

  if (!worker) {
    res.status(404).json({ error: "Worker not found." });
    return;
  }

  const questionLabel = String(req.body?.questionLabel ?? "").trim();
  const answerText = String(req.body?.answerText ?? "").trim();

  if (!questionLabel || !answerText) {
    res.status(400).json({ error: "Onboarding question and answer are required." });
    return;
  }

  try {
    const reply = await generateOnboardingReply(worker, {
      answerText,
      knownAnswers: req.body?.knownAnswers ?? {},
      nextQuestionLabel: String(req.body?.nextQuestionLabel ?? "").trim(),
      questionHelperText: String(req.body?.questionHelperText ?? "").trim(),
      questionLabel,
      role: String(req.body?.role ?? worker.title).trim(),
      sectionTitle: String(req.body?.sectionTitle ?? "").trim(),
      summarySoFar: Array.isArray(req.body?.summarySoFar) ? req.body.summarySoFar.map((entry) => String(entry)) : []
    });
    res.json({ reply });
  } catch (error) {
    console.error("Onboarding reply generation failed:", error);
    res.json({
      reply: fallbackOnboardingReply(worker, questionLabel, answerText, String(req.body?.nextQuestionLabel ?? "").trim()),
      fallback: true
    });
  }
});

app.get("/api/office/workers", requireAuth, async (req, res) => {
  const workers = await readHiredWorkersForUser(req.user.id);
  res.json({ workers });
});

app.get("/api/office/workers/:slug/dashboard", requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug ?? "").trim();

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!isMaraWorker(workerSlug)) {
    res.status(400).json({ error: "This worker does not have a structured dashboard." });
    return;
  }

  ensureMaraKnowledge(req.user.id);
  res.json(getMaraDashboard(req.user.id));
});

app.get("/api/office/workers/:slug/workspace", requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug ?? "").trim();

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  ensureWorkerPermissions(db, req.user.id, workerSlug);
  res.json({
    workspace: buildMaraWorkspace(db, req.user.id, workerSlug, {
      readKnowledgeSections: readWorkerKnowledgeSections,
      readOfficeOverlays: readOfficeOverlaysForUser
    })
  });
});

app.post("/api/office/workers/:slug/tasks/:taskId/run", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug ?? "").trim();
  const taskId = String(req.params.taskId ?? "").trim();

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!isMaraWorker(workerSlug)) {
    res.status(400).json({ error: "This worker cannot run internal task execution from office yet." });
    return;
  }

  try {
    const result = runWorkerTask(db, req.user.id, workerSlug, taskId, {
      db,
      ...buildMaraExecutionReaders()
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not run worker task." });
  }
});

app.post("/api/workers/mara/tasks/:taskId/run", assertOrigin, requireAuth, async (req, res) => {
  const taskId = String(req.params.taskId ?? "").trim();

  try {
    const result = runMaraTask({
      db,
      taskId,
      userId: req.user.id,
      workerId: MARA_SLUG,
      ...buildMaraExecutionReaders()
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not run Mara task." });
  }
});

app.post("/api/office/workers/:slug/tasks/:taskId/dismiss", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug ?? "").trim();
  const taskId = String(req.params.taskId ?? "").trim();

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  try {
    const result = dismissWorkerTask(db, req.user.id, workerSlug, taskId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not dismiss worker task." });
  }
});

app.post("/api/office/workers/:slug/recommended-next/create", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug ?? "").trim();
  const title = String(req.body?.title ?? "").trim();
  const description = String(req.body?.description ?? "").trim();
  const priority = String(req.body?.priority ?? "high").trim().toLowerCase();

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!title || !description) {
    res.status(400).json({ error: "A task title and description are required." });
    return;
  }

  const result = createApprovedTaskIfPermissionAllows(db, {
    description,
    priority: ["low", "medium", "high"].includes(priority) ? priority : "high",
    requiredPermissions: [],
    source: "office_recommended_next",
    title,
    userId: req.user.id,
    workerId: workerSlug
  });

  res.status(result.duplicate ? 200 : 201).json({ ok: true, ...result });
});

app.post("/api/office/workers/:slug/approval-requests/:approvalId/status", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug ?? "").trim();
  const approvalId = String(req.params.approvalId ?? "").trim();
  const status = String(req.body?.status ?? "").trim().toLowerCase();

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!isMaraWorker(workerSlug)) {
    res.status(400).json({ error: "Structured worker approvals are only available for Mara right now." });
    return;
  }

  try {
    const result = updateApprovalRequestStatus(db, req.user.id, workerSlug, approvalId, status);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not update approval request." });
  }
});

app.post("/api/office/workers/:slug/connect-email", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug ?? "").trim();
  const provider = String(req.body?.provider ?? "gmail").trim().toLowerCase();

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!isMaraWorker(workerSlug)) {
    res.status(400).json({ error: "Email connection is not available for this worker." });
    return;
  }

  if (!["gmail", "outlook"].includes(provider)) {
    res.status(400).json({ error: "Unsupported provider." });
    return;
  }

  ensureMaraIntegrationRecord(req.user.id, provider);
  insertMaraSyncJob(req.user.id, provider, "connect_integration", `${provider === "gmail" ? "Gmail" : "Outlook"} marked as available for Mara.`);
  db.prepare(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    req.user.id,
    workerSlug,
    "Connected integration.",
    "Integrations",
    `${provider === "gmail" ? "Gmail" : "Outlook"} access enabled`,
    nowIso()
  );

  res.json({
    ok: true,
    dashboard: getMaraDashboard(req.user.id)
  });
});

app.post("/api/office/workers/:slug/run-scan", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug ?? "").trim();

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!isMaraWorker(workerSlug)) {
    res.status(400).json({ error: "Structured scans are not available for this worker." });
    return;
  }

  const hasConnectedEmail = db
    .prepare(
      `SELECT id
       FROM office_worker_integrations
       WHERE user_id = ? AND worker_slug = ? AND provider IN ('gmail', 'outlook') AND status = ?`
    )
    .get(req.user.id, workerSlug, "connected");

  if (!hasConnectedEmail) {
    res.status(400).json({
      error: "Connect Gmail or Outlook before running an email scan. Mara can still help with briefs, tasks, and operating context without inbox access."
    });
    return;
  }

  ensureMaraKnowledge(req.user.id);
  insertMaraSyncJob(req.user.id, "gmail", "generate_daily_mara_brief", "Mara started a fresh scan using connected inbox access.");
  db.prepare(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    req.user.id,
    MARA_SLUG,
    "Requested inbox scan.",
    "Mara",
    "Connected inbox is ready for real campaign and thread ingestion",
    nowIso()
  );

  res.json({ ok: true, dashboard: getMaraDashboard(req.user.id) });
});

app.post("/api/office/workers/:slug/suggested-actions/:actionId", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug ?? "").trim();
  const actionId = String(req.params.actionId ?? "").trim();
  const decision = String(req.body?.decision ?? "").trim().toLowerCase();
  const note = String(req.body?.note ?? "").trim();

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!isMaraWorker(workerSlug)) {
    res.status(400).json({ error: "Suggested actions are not available for this worker." });
    return;
  }

  const action = db
    .prepare(
      `SELECT *
       FROM office_suggested_actions
       WHERE id = ? AND user_id = ? AND worker_slug = ?`
    )
    .get(actionId, req.user.id, workerSlug);

  if (!action) {
    res.status(404).json({ error: "Suggested action not found." });
    return;
  }

  if (!["approve", "reject", "revise", "edit"].includes(decision)) {
    res.status(400).json({ error: "Unsupported decision." });
    return;
  }

  const payload = parseJson(action.payload_json, {});
  const nextStatus = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "edited";
  db.prepare(
    `UPDATE office_suggested_actions
     SET status = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`
  ).run(nextStatus, nowIso(), actionId, req.user.id);

  if (decision === "approve") {
    if (action.action_type === "create_calendar_event" && payload?.event?.title) {
      const startsAt = new Date(Date.now() + 1000 * 60 * 60 * 22).toISOString();
      const endsAt = new Date(Date.now() + 1000 * 60 * 60 * 23).toISOString();
      db.prepare(
        `INSERT INTO office_calendar_events
          (id, user_id, worker_slug, title, starts_at, ends_at, event_type, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        randomUUID(),
        req.user.id,
        workerSlug,
        payload.event.title,
        startsAt,
        endsAt,
        String(payload.event.eventType ?? "Focus"),
        "Approved from Mara's suggested actions.",
        nowIso(),
        nowIso()
      );
    }

    if (action.action_type === "draft_email") {
      db.prepare(
        `INSERT INTO office_chat_messages (id, user_id, worker_slug, author, text, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        randomUUID(),
        req.user.id,
        workerSlug,
        "Worker",
        `Draft approved: ${String(payload?.draftText ?? action.title)}`,
        nowIso()
      );
    }
  }

  if ((decision === "revise" || decision === "edit") && note) {
    db.prepare(
      `UPDATE office_suggested_actions
       SET description = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`
    ).run(
      `${action.description} ${decision === "edit" ? "Edit requested" : "Revision requested"}: ${note}`,
      nowIso(),
      actionId,
      req.user.id
    );
  }

  db.prepare(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    req.user.id,
    workerSlug,
    decision === "approve"
      ? "Approved suggested action."
      : decision === "reject"
        ? "Rejected suggested action."
        : decision === "edit"
          ? "Requested edit."
          : "Requested revision.",
    "Mara",
    action.title,
    nowIso()
  );

  res.json({ ok: true, dashboard: getMaraDashboard(req.user.id) });
});

app.post("/api/office/workers/:slug/opportunities/:opportunityId", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug ?? "").trim();
  const opportunityId = String(req.params.opportunityId ?? "").trim();
  const status = String(req.body?.status ?? "").trim();

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!isMaraWorker(workerSlug)) {
    res.status(400).json({ error: "Brand opportunity actions are not available for this worker." });
    return;
  }

  if (!["saved_to_crm", "ignored", "not_a_fit", "contacted"].includes(status)) {
    res.status(400).json({ error: "Unsupported opportunity status." });
    return;
  }

  const opportunity = db
    .prepare(
      `SELECT brand_name AS brandName
       FROM office_brand_opportunities
       WHERE id = ? AND user_id = ? AND worker_slug = ?`
    )
    .get(opportunityId, req.user.id, workerSlug);

  if (!opportunity) {
    res.status(404).json({ error: "Opportunity not found." });
    return;
  }

  db.prepare(
    `UPDATE office_brand_opportunities
     SET status = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`
  ).run(status, nowIso(), opportunityId, req.user.id);

  db.prepare(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), req.user.id, workerSlug, "Updated brand opportunity.", "Mara", `${opportunity.brandName} → ${status}`, nowIso());

  res.json({ ok: true, dashboard: getMaraDashboard(req.user.id) });
});

app.get("/api/office/overlays", requireAuth, (req, res) => {
  res.json(readOfficeOverlaysForUser(req.user.id));
});

app.post("/api/office/calendar/events", assertOrigin, requireAuth, (req, res) => {
  const title = String(req.body?.title ?? "").trim();
  const startsAt = String(req.body?.startsAt ?? "").trim();
  const endsAt = String(req.body?.endsAt ?? "").trim();
  const eventType = String(req.body?.eventType ?? "Office").trim() || "Office";
  const notes = String(req.body?.notes ?? "").trim();
  const workerSlug = String(req.body?.workerSlug ?? "").trim() || null;

  if (!title || !startsAt || !endsAt) {
    res.status(400).json({ error: "Title, start time, and end time are required." });
    return;
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO office_calendar_events
      (id, user_id, worker_slug, title, starts_at, ends_at, event_type, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, req.user.id, workerSlug, title, startsAt, endsAt, eventType, notes, nowIso(), nowIso());

  res.status(201).json({ ok: true, id });
});

app.post("/api/office/calendar/events/:eventId", assertOrigin, requireAuth, (req, res) => {
  const eventId = String(req.params.eventId ?? "").trim();
  const existing = db
    .prepare(`SELECT id FROM office_calendar_events WHERE id = ? AND user_id = ?`)
    .get(eventId, req.user.id);

  if (!existing) {
    res.status(404).json({ error: "Calendar event not found." });
    return;
  }

  const title = String(req.body?.title ?? "").trim();
  const startsAt = String(req.body?.startsAt ?? "").trim();
  const endsAt = String(req.body?.endsAt ?? "").trim();
  const eventType = String(req.body?.eventType ?? "Office").trim() || "Office";
  const notes = String(req.body?.notes ?? "").trim();
  const workerSlug = String(req.body?.workerSlug ?? "").trim() || null;

  if (!title || !startsAt || !endsAt) {
    res.status(400).json({ error: "Title, start time, and end time are required." });
    return;
  }

  db.prepare(
    `UPDATE office_calendar_events
     SET worker_slug = ?, title = ?, starts_at = ?, ends_at = ?, event_type = ?, notes = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`
  ).run(workerSlug, title, startsAt, endsAt, eventType, notes, nowIso(), eventId, req.user.id);

  res.json({ ok: true });
});

app.post("/api/office/calendar/events/:eventId/delete", assertOrigin, requireAuth, (req, res) => {
  const eventId = String(req.params.eventId ?? "").trim();
  const existing = db
    .prepare(`SELECT id FROM office_calendar_events WHERE id = ? AND user_id = ?`)
    .get(eventId, req.user.id);

  if (!existing) {
    res.status(404).json({ error: "Calendar event not found." });
    return;
  }

  db.prepare(`DELETE FROM office_calendar_events WHERE id = ? AND user_id = ?`).run(eventId, req.user.id);
  res.json({ ok: true });
});

app.get("/api/office/files/:fileId/download", requireAuth, async (req, res) => {
  const file = db
    .prepare(
      `SELECT id, user_id, name, type, stored_name
       FROM office_uploaded_files
       WHERE id = ? AND user_id = ?`
    )
    .get(req.params.fileId, req.user.id);

  if (!file) {
    res.status(404).json({ error: "File not found." });
    return;
  }

  const fullPath = path.join(uploadsDir, req.user.id, file.stored_name);

  try {
    await fs.access(fullPath);
    res.download(fullPath, file.name);
  } catch {
    res.status(404).json({ error: "Stored file is missing." });
  }
});

app.get("/api/auth/google", (_req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!isGoogleAuthConfigured() || !clientId) {
    res.status(501).json({ error: "Google auth is not configured." });
    return;
  }

  const state = randomBytes(24).toString("hex");
  setGoogleStateCookie(res, state);

  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("redirect_uri", getGoogleRedirectUri());
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", "openid email profile");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("prompt", "select_account");

  res.redirect(authorizationUrl.toString());
});

app.get("/api/auth/google/callback", async (req, res) => {
  const code = String(req.query.code ?? "").trim();
  const state = String(req.query.state ?? "").trim();
  const cookieState = String(req.cookies[googleStateCookieName] ?? "").trim();

  clearGoogleStateCookie(res);

  if (!code || !state || !safeEqualStrings(state, cookieState)) {
    res.redirect(`${appUrl}/?notice=google-auth-failed#home`);
    return;
  }

  try {
    const tokens = await exchangeGoogleCodeForTokens(code);
    const profile = await fetchGoogleProfile(String(tokens.access_token ?? ""));
    const normalizedEmail = normalizeEmail(profile.email);

    if (!normalizedEmail || !profile.email_verified) {
      res.redirect(`${appUrl}/?notice=google-email-unverified#home`);
      return;
    }

    let user = db.prepare("SELECT * FROM users WHERE email = ?").get(normalizedEmail);
    if (!user) {
      const createdAt = nowIso();
      const newUser = {
        created_at: createdAt,
        email: normalizedEmail,
        email_verified_at: createdAt,
        id: randomUUID(),
        name: String(profile.name ?? profile.given_name ?? normalizedEmail.split("@")[0]).trim(),
        password_hash: hashPassword(randomUUID())
      };

      db.prepare(
        `INSERT INTO users (id, email, name, password_hash, email_verified_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        newUser.id,
        newUser.email,
        newUser.name,
        newUser.password_hash,
        newUser.email_verified_at,
        newUser.created_at
      );

      user = newUser;
    }

    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
    const sessionToken = createSession(user.id);
    setSessionCookie(res, sessionToken);
    res.redirect(`${appUrl}/#app/office`);
  } catch {
    res.redirect(`${appUrl}/?notice=google-auth-failed#home`);
  }
});

app.post("/api/auth/register", authLimiter, assertOrigin, async (req, res) => {
  const { email, name, password } = req.body ?? {};

  if (!email || !name || !password) {
    res.status(400).json({ error: "Name, email, and password are required." });
    return;
  }

  if (String(password).length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const trimmedName = String(name).trim();
  if (trimmedName.length < 2) {
    res.status(400).json({ error: "Enter your full name." });
    return;
  }

  const normalizedEmail = normalizeEmail(email);
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail);
  if (existing) {
    res.status(409).json({ error: "An account with that email already exists." });
    return;
  }

  const user = {
    created_at: nowIso(),
    email: normalizedEmail,
    id: randomUUID(),
    name: trimmedName,
    password_hash: hashPassword(String(password))
  };

  db.prepare(
    `INSERT INTO users (id, email, name, password_hash, email_verified_at, created_at)
     VALUES (?, ?, ?, ?, NULL, ?)`
  ).run(user.id, user.email, user.name, user.password_hash, user.created_at);

  const sessionToken = createSession(user.id);
  setSessionCookie(res, sessionToken);
  res.status(201).json({
    emailVerificationQueued: true,
    user: toSafeUser(user)
  });

  void issueEmailVerification(user).catch((error) => {
    console.error("Email verification delivery failed on register:", error);
  });
});

app.post("/api/auth/login", authLimiter, assertOrigin, async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(normalizeEmail(email));
  if (!user || !verifyPassword(String(password), user.password_hash)) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
  const sessionToken = createSession(user.id);
  setSessionCookie(res, sessionToken);
  res.json({ user: toSafeUser(user) });
});

app.post("/api/auth/logout", assertOrigin, (req, res) => {
  const rawToken = req.cookies[sessionCookieName];
  if (rawToken) {
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
  }

  clearSessionCookie(res);
  res.status(204).end();
});

app.get("/api/auth/me", (req, res) => {
  const user = getUserBySessionToken(req.cookies[sessionCookieName]);
  res.json({ user: user ? toSafeUser(user) : null });
});

app.get("/api/onboarding", requireAuth, (req, res) => {
  const onboarding = getUserOnboardingRecord(req.user.id);
  res.json({
    onboarding,
    user: {
      name: req.user.name,
      onboarded: Boolean(onboarding?.completedAt)
    }
  });
});

app.post("/api/onboarding/complete", assertOrigin, requireAuth, (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const brandName = String(req.body?.brandName ?? "").trim();
  const whatYouDo = String(req.body?.whatYouDo ?? "").trim();

  if (name.length < 2) {
    res.status(400).json({ error: "Enter your name." });
    return;
  }

  if (brandName.length < 2) {
    res.status(400).json({ error: "Enter your business or brand name." });
    return;
  }

  if (whatYouDo.length < 8) {
    res.status(400).json({ error: "Add one clear line about what you do." });
    return;
  }

  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name, req.user.id);
  db.prepare(
    `INSERT INTO user_onboarding (user_id, brand_name, what_you_do, completed_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       brand_name = excluded.brand_name,
       what_you_do = excluded.what_you_do,
       completed_at = excluded.completed_at`
  ).run(req.user.id, brandName, whatYouDo, nowIso());

  const refreshedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  const onboarding = getUserOnboardingRecord(req.user.id);
  seedOfficeSettingsFromOnboarding(refreshedUser, onboarding);

  res.json({
    ok: true,
    user: toSafeUser(refreshedUser)
  });
});

app.post("/api/auth/resend-verification", authLimiter, assertOrigin, requireAuth, async (req, res) => {
  if (req.user.email_verified_at) {
    res.json({ ok: true, preview: null, alreadyVerified: true });
    return;
  }
  try {
    const mailResult = await issueEmailVerification(req.user);
    res.json({ ok: true, preview: mailResult.preview, alreadyVerified: false, sent: Boolean(mailResult.sent) });
  } catch (error) {
    console.error("Email verification resend failed:", error);
    res.status(502).json({ error: "We couldn't send the verification email right now. Please try again shortly." });
  }
});

app.get("/api/auth/verify-email", async (req, res) => {
  const token = String(req.query.token ?? "");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const record = db
    .prepare(
      `SELECT * FROM email_verification_tokens
       WHERE token_hash = ? AND consumed_at IS NULL AND expires_at >= ?`
    )
    .get(tokenHash, nowIso());

  if (!record) {
    res.redirect(`${appUrl}/?notice=verification-invalid#about`);
    return;
  }

  db.prepare("UPDATE email_verification_tokens SET consumed_at = ? WHERE id = ?").run(nowIso(), record.id);
  db.prepare("UPDATE users SET email_verified_at = ? WHERE id = ?").run(nowIso(), record.user_id);
  res.redirect(`${appUrl}/?notice=email-verified#workers`);
});

app.post("/api/auth/request-password-reset", authLimiter, assertOrigin, async (req, res) => {
  const { email } = req.body ?? {};
  if (!email) {
    res.status(400).json({ error: "Email is required." });
    return;
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(normalizeEmail(email));
  if (user) {
    try {
      const mailResult = await issuePasswordReset(user);
      res.json({ ok: true, preview: mailResult.preview, sent: Boolean(mailResult.sent) });
      return;
    } catch (error) {
      console.error("Password reset delivery failed:", error);
      res.status(502).json({ error: "We couldn't send the reset email right now. Please try again shortly." });
      return;
    }
  }

  res.json({ ok: true, preview: null });
});

app.post("/api/auth/reset-password", authLimiter, assertOrigin, async (req, res) => {
  const { password, token } = req.body ?? {};
  if (!token || !password) {
    res.status(400).json({ error: "Token and new password are required." });
    return;
  }

  if (String(password).length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const tokenHash = createHash("sha256").update(String(token)).digest("hex");
  const record = db
    .prepare(
      `SELECT * FROM password_reset_tokens
       WHERE token_hash = ? AND consumed_at IS NULL AND expires_at >= ?`
    )
    .get(tokenHash, nowIso());

  if (!record) {
    res.status(400).json({ error: "Password reset token is invalid or expired." });
    return;
  }

  db.prepare("UPDATE password_reset_tokens SET consumed_at = ? WHERE id = ?").run(nowIso(), record.id);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(String(password)), record.user_id);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(record.user_id);
  res.json({ ok: true });
});

app.post("/api/payments/checkout", checkoutLimiter, assertOrigin, requireAuth, async (req, res) => {
  const { workerSlug } = req.body ?? {};
  const isAdmin = isAdminUser(req.user);
  if (!req.user.email_verified_at && !isAdmin) {
    res.status(403).json({ error: "Verify your email before starting checkout." });
    return;
  }

  const workers = await readWorkers();
  const worker = workers.find((entry) => entry.slug === workerSlug);

  if (!worker) {
    res.status(404).json({ error: "Worker not found." });
    return;
  }

  if (hasHiredWorker(req.user.id, workerSlug)) {
    res.status(409).json({ error: "You have already hired this worker." });
    return;
  }

  const unitAmount = Number.parseInt(worker.salary.replace(/[^0-9]/g, ""), 10) * 100;
  const checkoutId = randomUUID();
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (unitAmount === 0 || isAdmin) {
    db.prepare(
      `INSERT INTO checkout_sessions (id, user_id, worker_slug, amount_cents, stripe_session_id, status, created_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(checkoutId, req.user.id, worker.slug, unitAmount, null, "completed", nowIso(), nowIso());

    db.prepare(
      `INSERT INTO hired_workers (id, user_id, worker_slug, checkout_session_id, status, hired_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, worker_slug) DO UPDATE SET
         checkout_session_id = excluded.checkout_session_id,
         status = excluded.status,
         hired_at = excluded.hired_at`
    ).run(randomUUID(), req.user.id, worker.slug, checkoutId, "active", nowIso());

    res.json({
      free: true,
      adminBypass: isAdmin,
      url: `${appUrl}/?checkout=success&worker=${worker.slug}#app/office/workers/${worker.slug}/onboarding`
    });
    return;
  }

  if (!stripeKey) {
    res.status(501).json({ error: "Stripe is not configured. Set STRIPE_SECRET_KEY to enable checkout." });
    return;
  }

  const stripe = new Stripe(stripeKey);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    success_url: `${appUrl}/?checkout=success&worker=${worker.slug}#app/office/workers/${worker.slug}/onboarding`,
    cancel_url: `${appUrl}/?checkout=cancelled#worker-${worker.slug}`,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            description: `Monthly salary for ${worker.department}`,
            name: `${worker.name} - ${worker.title}`
          },
          recurring: {
            interval: "month"
          },
          unit_amount: unitAmount
        },
        quantity: 1
      }
    ],
    metadata: {
      checkoutId,
      userId: req.user.id,
      workerSlug: worker.slug
    }
  });

  db.prepare(
    `INSERT INTO checkout_sessions (id, user_id, worker_slug, amount_cents, stripe_session_id, status, created_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`
  ).run(checkoutId, req.user.id, worker.slug, unitAmount, session.id, "pending", nowIso());

  res.json({ url: session.url });
});

app.post("/api/payments/webhook", express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    res.status(501).json({ error: "Stripe webhook is not configured." });
    return;
  }

  const signature = req.headers["stripe-signature"];
  if (!signature) {
    res.status(400).send("Missing Stripe signature.");
    return;
  }

  try {
    const stripe = new Stripe(stripeKey);
    const event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const checkoutId = session.metadata?.checkoutId;
      const userId = session.metadata?.userId;
      const workerSlug = session.metadata?.workerSlug;

      if (checkoutId) {
        db.prepare(
          `UPDATE checkout_sessions
           SET status = ?, completed_at = ?
           WHERE id = ?`
        ).run("completed", nowIso(), checkoutId);
      }

      if (checkoutId && userId && workerSlug) {
        db.prepare(
          `INSERT INTO hired_workers (id, user_id, worker_slug, checkout_session_id, status, hired_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, worker_slug) DO UPDATE SET
             checkout_session_id = excluded.checkout_session_id,
             status = excluded.status,
             hired_at = excluded.hired_at`
        ).run(randomUUID(), userId, workerSlug, checkoutId, "active", nowIso());
      }
    }

    res.json({ received: true });
  } catch (error) {
    res.status(400).send(error instanceof Error ? error.message : "Webhook verification failed.");
  }
});

app.post("/api/office/workers/:slug/chat", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = req.params.slug;
  const text = String(req.body?.text ?? "").trim();

  if (!text) {
    res.status(400).json({ error: "Message text is required." });
    return;
  }

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  const workers = await readWorkers();
  const worker = workers.find((entry) => entry.slug === workerSlug);
  const createdAt = nowIso();

  db.prepare(
    `INSERT INTO office_chat_messages (id, user_id, worker_slug, author, text, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), req.user.id, workerSlug, "You", text, createdAt);
  if (worker) {
    await rememberWorkerDirection(req.user.id, worker, text);
  }

  if (workerSlug === MARA_SLUG && worker) {
    ensureWorkerPermissions(db, req.user.id, workerSlug);
    const createdChatTaskIds = [];
    const detectorResult = runMaraActionDetector({
      openTasks: listWorkerTasksForUserWorker(db, req.user.id, workerSlug),
      permissions: getWorkerPermissions(db, req.user.id, workerSlug),
      recentMessages: db
        .prepare(
          `SELECT author, text
           FROM office_chat_messages
           WHERE user_id = ? AND worker_slug = ?
           ORDER BY created_at DESC
           LIMIT 6`
        )
        .all(req.user.id, workerSlug),
      triggerText: text,
      triggerType: "chat_message",
      userId: req.user.id,
      workerId: workerSlug
    });

    for (const memory of detectorResult.memoriesToSave) {
      upsertWorkerKnowledge(req.user.id, workerSlug, (knowledge) => {
        const next = Array.isArray(knowledge) ? [...knowledge] : [];
        const index = next.findIndex((section) => String(section?.title ?? "").trim() === memory.title);
        const existingItems = index >= 0 && Array.isArray(next[index]?.items) ? next[index].items : [];
        const mergedItems = normalizeTextList([...(memory.items ?? []), ...existingItems]);
        const section = { title: memory.title, items: mergedItems };
        if (index >= 0) next[index] = section;
        else next.unshift(section);
        return next;
      });
    }

    for (const task of detectorResult.tasksToCreate) {
      if (task.status === "approved") {
        const created = createApprovedTaskIfPermissionAllows(db, {
          ...task,
          userId: req.user.id,
          workerId: workerSlug
        });
        if (!created.duplicate && created.id) {
          createdChatTaskIds.push(created.id);
          const createdTask = listWorkerTasksForUserWorker(db, req.user.id, workerSlug).find((entry) => entry.id === created.id);
          createWorkerActivityLog(db, {
            description: text,
            eventType: "chat_task_created",
            metadata: { taskType: createdTask?.taskType || null },
            relatedTaskId: created.id,
            title: createdTask?.title || task.title,
            userId: req.user.id,
            workerId: workerSlug
          });
        }
      } else {
        createSuggestedTask(db, {
          ...task,
          userId: req.user.id,
          workerId: workerSlug
        });
      }
    }

    for (const recurring of detectorResult.recurringResponsibilitiesToSuggest) {
      createRecurringResponsibility(db, {
        ...recurring,
        isActive: false,
        userId: req.user.id,
        workerId: workerSlug
      });
    }

    for (const research of detectorResult.researchItemsToCreate) {
      createResearchItem(db, {
        ...research,
        userId: req.user.id,
        workerId: workerSlug
      });
    }

    for (const approval of detectorResult.approvalRequests) {
      createApprovalRequest(db, {
        ...approval,
        userId: req.user.id,
        workerId: workerSlug
      });
    }

    const executedResults = autoExecuteSafeMaraTasks({
      db,
      taskIds: createdChatTaskIds,
      userId: req.user.id,
      workerId: workerSlug,
      ...buildMaraExecutionReaders()
    });

    for (const result of executedResults) {
      if (result?.task?.id) {
        createWorkerActivityLog(db, {
          description: text,
          eventType: "chat_task_executed",
          metadata: { outputId: result.output?.id ?? null },
          relatedTaskId: result.task.id,
          title: result.task.title,
          userId: req.user.id,
          workerId: workerSlug
        });
      }
    }

    if (executedResults.length > 0) {
      const completedOutputs = executedResults.filter((result) => result?.output?.content);
      const blockedOutputs = executedResults.filter((result) => result?.blockerReason);
      const replyParts = [];

      for (const result of completedOutputs.slice(0, 2)) {
        replyParts.push(`${result.output.title}\n\n${result.output.content}`);
      }

      for (const blocked of blockedOutputs.slice(0, 1)) {
        replyParts.push(`I couldn't complete that yet.\n\nReason: ${blocked.blockerReason}\nNeed from you: ${blocked.neededFromUser}\nNext: ${blocked.suggestedNextStep}`);
      }

      if (replyParts.length > 0) {
        const replyCreatedAt = new Date(Date.now() + 1000).toISOString();
        db.prepare(
          `INSERT INTO office_chat_messages (id, user_id, worker_slug, author, text, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(randomUUID(), req.user.id, workerSlug, "Worker", replyParts.join("\n\n"), replyCreatedAt);
        res.status(201).json({ ok: true });
        return;
      }
    }
  }

  db.prepare(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), req.user.id, workerSlug, "Sent a chat message.", "Chat", "Worker memory and conversation context updated", createdAt);

  let replyText = makeWorkerReply(worker?.name);
  if (worker) {
    try {
      replyText = await generateOfficeWorkerReply(req.user.id, worker, text);
    } catch (error) {
      console.error("Office worker reply generation failed:", error);
    }
  }
  const replyCreatedAt = new Date(Date.now() + 1000).toISOString();
  db.prepare(
    `INSERT INTO office_chat_messages (id, user_id, worker_slug, author, text, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), req.user.id, workerSlug, "Worker", replyText, replyCreatedAt);

  res.status(201).json({ ok: true });
});

app.post("/api/office/workers/:slug/tasks", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = req.params.slug;
  const { dueDate, module, owner, priority, title } = req.body ?? {};

  if (!title || !module) {
    res.status(400).json({ error: "Task title and module are required." });
    return;
  }

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  const createdAt = nowIso();
  db.prepare(
    `INSERT INTO office_custom_tasks (id, user_id, worker_slug, title, module_name, owner, priority, status, due_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    req.user.id,
    workerSlug,
    String(title),
    String(module),
    owner === "You" ? "You" : "Worker",
    priority === "Low" || priority === "Medium" || priority === "High" ? priority : "Medium",
    "To Do",
    String(dueDate || "This week"),
    createdAt
  );

  db.prepare(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), req.user.id, workerSlug, "Created a task.", String(module), String(title), createdAt);

  res.status(201).json({ ok: true });
});

app.post("/api/office/workers/:slug/tasks/:taskId/status", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = req.params.slug;
  const taskId = req.params.taskId;
  const status = String(req.body?.status ?? "");

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!["To Do", "In Progress", "Needs Review", "Completed"].includes(status)) {
    res.status(400).json({ error: "Unsupported task status." });
    return;
  }

  const updated = db
    .prepare(
      `UPDATE office_custom_tasks
       SET status = ?
       WHERE id = ? AND user_id = ? AND worker_slug = ?`
    )
    .run(status, taskId, req.user.id, workerSlug);

  if (updated.changes === 0) {
    res.status(404).json({ error: "Custom task not found." });
    return;
  }

  db.prepare(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), req.user.id, workerSlug, "Updated task status.", "Tasks", `${taskId} -> ${status}`, nowIso());

  res.json({ ok: true });
});

app.post("/api/office/workers/:slug/briefings/:briefingId/action", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = req.params.slug;
  const briefingId = req.params.briefingId;
  const action = String(req.body?.action ?? "");

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  const createdAt = nowIso();

  if (action === "approve") {
    db.prepare(
      `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(randomUUID(), req.user.id, workerSlug, "Approved a briefing.", "Briefings", briefingId, createdAt);
    res.json({ ok: true });
    return;
  }

  if (action === "followup") {
    const followupText = "Please prepare follow-up notes and update the queue before the next review.";
    db.prepare(
      `INSERT INTO office_chat_messages (id, user_id, worker_slug, author, text, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      req.user.id,
      workerSlug,
      "You",
      followupText,
      createdAt
    );
    rememberWorkerDirection(req.user.id, workerSlug, followupText);
    db.prepare(
      `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(randomUUID(), req.user.id, workerSlug, "Requested briefing follow-up.", "Briefings", briefingId, createdAt);
    res.json({ ok: true });
    return;
  }

  if (action === "task") {
    db.prepare(
      `INSERT INTO office_custom_tasks (id, user_id, worker_slug, title, module_name, owner, priority, status, due_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      req.user.id,
      workerSlug,
      "Follow up on briefing decisions",
      "Briefings",
      "Worker",
      "High",
      "To Do",
      "Tomorrow",
      createdAt
    );
    db.prepare(
      `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(randomUUID(), req.user.id, workerSlug, "Created a task from briefing.", "Briefings", briefingId, createdAt);
    res.json({ ok: true });
    return;
  }

  res.status(400).json({ error: "Unsupported briefing action." });
});

app.post("/api/office/workers/:slug/settings", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = req.params.slug;
  const settings = req.body?.settings;

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!Array.isArray(settings)) {
    res.status(400).json({ error: "Settings payload is invalid." });
    return;
  }

  db.prepare(
    `INSERT INTO office_worker_settings (id, user_id, worker_slug, settings_json, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, worker_slug) DO UPDATE SET
       settings_json = excluded.settings_json,
       updated_at = excluded.updated_at`
  ).run(randomUUID(), req.user.id, workerSlug, JSON.stringify(settings), nowIso());

  db.prepare(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), req.user.id, workerSlug, "Updated worker settings.", "Settings", "Office preferences saved", nowIso());

  res.json({ ok: true });
});

app.post("/api/office/workers/:slug/fire", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = req.params.slug;

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  const worker = db
    .prepare(
      `SELECT worker_slug
       FROM hired_workers
       WHERE user_id = ? AND worker_slug = ? AND status = ?`
    )
    .get(req.user.id, workerSlug, "active");

  if (!worker) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  db.prepare(
    `UPDATE hired_workers
     SET status = ?
     WHERE user_id = ? AND worker_slug = ? AND status = ?`
  ).run("terminated", req.user.id, workerSlug, "active");

  db.prepare(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), req.user.id, workerSlug, "Ended worker engagement.", "People", "Worker removed from active office roster", nowIso());

  res.json({ ok: true });
});

app.post("/api/office/workers/:slug/knowledge", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = req.params.slug;
  const knowledge = req.body?.knowledge;

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!Array.isArray(knowledge)) {
    res.status(400).json({ error: "Knowledge payload is invalid." });
    return;
  }

  const normalizedKnowledge = knowledge
    .map((section) => ({
      items: normalizeTextList(section?.items),
      title: String(section?.title ?? "").trim()
    }))
    .filter((section) => section.title && section.items.length > 0);

  db.prepare(
    `INSERT INTO office_worker_knowledge (id, user_id, worker_slug, knowledge_json, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, worker_slug) DO UPDATE SET
       knowledge_json = excluded.knowledge_json,
       updated_at = excluded.updated_at`
  ).run(randomUUID(), req.user.id, workerSlug, JSON.stringify(normalizedKnowledge), nowIso());

  db.prepare(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), req.user.id, workerSlug, "Updated worker knowledge.", "Memory", "Operating context saved", nowIso());

  res.json({ ok: true });
});

app.post("/api/office/workers/:slug/files", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = req.params.slug;
  const name = String(req.body?.name ?? "").trim();
  const type = String(req.body?.type ?? "File").trim();
  const contentBase64 = String(req.body?.contentBase64 ?? "");

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!name || !contentBase64) {
    res.status(400).json({ error: "File name and content are required." });
    return;
  }

  const fileId = randomUUID();
  const storedName = `${fileId}-${name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  const userDir = path.join(uploadsDir, req.user.id);
  await fs.mkdir(userDir, { recursive: true });
  await fs.writeFile(path.join(userDir, storedName), Buffer.from(contentBase64, "base64"));

  db.prepare(
    `INSERT INTO office_uploaded_files (id, user_id, worker_slug, name, type, stored_name, uploaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(fileId, req.user.id, workerSlug, name, type || "File", storedName, nowIso());

  db.prepare(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), req.user.id, workerSlug, "Uploaded a file.", "Files", name, nowIso());

  res.status(201).json({ ok: true });
});

app.post("/api/office/workers/:slug/files/:fileId/delete", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = req.params.slug;
  const fileId = req.params.fileId;

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  const file = db
    .prepare(
      `SELECT stored_name, name
       FROM office_uploaded_files
       WHERE id = ? AND user_id = ? AND worker_slug = ?`
    )
    .get(fileId, req.user.id, workerSlug);

  if (!file) {
    res.status(404).json({ error: "File not found." });
    return;
  }

  db.prepare("DELETE FROM office_uploaded_files WHERE id = ? AND user_id = ?").run(fileId, req.user.id);

  try {
    await fs.unlink(path.join(uploadsDir, req.user.id, file.stored_name));
  } catch {
    // Ignore missing file on disk if metadata was present.
  }

  db.prepare(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), req.user.id, workerSlug, "Removed a file.", "Files", file.name, nowIso());

  res.json({ ok: true });
});

app.post("/api/office/workers/:slug/briefings", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = req.params.slug;
  const { agenda, dateLabel, decisionsNeeded, recommendedActions, summary, title } = req.body ?? {};

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!title || !dateLabel) {
    res.status(400).json({ error: "Briefing title and time are required." });
    return;
  }

  const briefingId = randomUUID();
  db.prepare(
    `INSERT INTO office_custom_briefings
     (id, user_id, worker_slug, title, date_label, summary, agenda_json, decisions_json, actions_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    briefingId,
    req.user.id,
    workerSlug,
    String(title),
    String(dateLabel),
    String(summary || ""),
    JSON.stringify(Array.isArray(agenda) ? agenda : []),
    JSON.stringify(Array.isArray(decisionsNeeded) ? decisionsNeeded : []),
    JSON.stringify(Array.isArray(recommendedActions) ? recommendedActions : []),
    nowIso()
  );

  db.prepare(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), req.user.id, workerSlug, "Scheduled a briefing.", "Briefings", String(title), nowIso());

  res.status(201).json({ ok: true });
});

app.post("/api/office/settings", assertOrigin, requireAuth, async (req, res) => {
  const settings = req.body?.settings;
  if (!settings || typeof settings !== "object") {
    res.status(400).json({ error: "Office settings payload is invalid." });
    return;
  }

  const normalizedSettings = {
    autoBriefingPrep: String(settings.autoBriefingPrep ?? "Enabled"),
    briefingDigestTime: String(settings.briefingDigestTime ?? "08:30"),
    brandContext: String(settings.brandContext ?? "").trim(),
    defaultTaskPriority: String(settings.defaultTaskPriority ?? "Medium"),
    decisionStyle: String(settings.decisionStyle ?? "").trim(),
    digestDelivery: String(settings.digestDelivery ?? "Email and in-office"),
    dislikes: String(settings.dislikes ?? "").trim(),
    likes: String(settings.likes ?? "").trim(),
    meetingBuffer: String(settings.meetingBuffer ?? "15 minutes"),
    managerSummaryFrequency: String(settings.managerSummaryFrequency ?? "Daily"),
    nonNegotiables: String(settings.nonNegotiables ?? "").trim(),
    notificationWindow: String(settings.notificationWindow ?? "").trim(),
    officeHours: String(settings.officeHours ?? "").trim(),
    quietHours: String(settings.quietHours ?? "").trim(),
    reviewCadence: String(settings.reviewCadence ?? "Weekly"),
    reviewReminderLead: String(settings.reviewReminderLead ?? "2 hours before"),
    timezone: String(settings.timezone ?? "America/New_York")
  };

  db.prepare(
    `INSERT INTO office_global_settings (user_id, settings_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       settings_json = excluded.settings_json,
       updated_at = excluded.updated_at`
  ).run(req.user.id, JSON.stringify(normalizedSettings), nowIso());

  res.json({ ok: true });
});

app.post("/api/office/workers/:slug/onboarding/save", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = req.params.slug;
  const answers = req.body?.answers;
  const generatedSummary = req.body?.generatedSummary;

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!answers || typeof answers !== "object") {
    res.status(400).json({ error: "Onboarding answers are required." });
    return;
  }

  db.prepare(
    `INSERT INTO office_onboarding_sessions
     (id, user_id, worker_slug, status, answers_json, generated_summary_json, completed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)
     ON CONFLICT(user_id, worker_slug) DO UPDATE SET
       status = excluded.status,
       answers_json = excluded.answers_json,
       generated_summary_json = excluded.generated_summary_json,
       updated_at = excluded.updated_at`
  ).run(
    randomUUID(),
    req.user.id,
    workerSlug,
    "in_progress",
    JSON.stringify(answers),
    JSON.stringify(Array.isArray(generatedSummary) ? generatedSummary : []),
    nowIso(),
    nowIso()
  );

  res.json({ ok: true });
});

app.post("/api/office/workers/:slug/onboarding/complete", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = req.params.slug;
  const answers = req.body?.answers;
  const generatedSummary = req.body?.generatedSummary;
  const knowledge = req.body?.knowledge;
  const tasks = req.body?.tasks;
  const briefing = req.body?.briefing;
  const worklogEntry = req.body?.worklogEntry;

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!answers || typeof answers !== "object" || !Array.isArray(knowledge) || !Array.isArray(tasks) || !briefing) {
    res.status(400).json({ error: "Onboarding payload is incomplete." });
    return;
  }

  const existing = db
    .prepare(
      `SELECT status
       FROM office_onboarding_sessions
       WHERE user_id = ? AND worker_slug = ?`
    )
    .get(req.user.id, workerSlug);

  const timestamp = nowIso();

  db.prepare(
    `INSERT INTO office_onboarding_sessions
     (id, user_id, worker_slug, status, answers_json, generated_summary_json, completed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, worker_slug) DO UPDATE SET
       status = excluded.status,
       answers_json = excluded.answers_json,
       generated_summary_json = excluded.generated_summary_json,
       completed_at = excluded.completed_at,
       updated_at = excluded.updated_at`
  ).run(
    randomUUID(),
    req.user.id,
    workerSlug,
    "completed",
    JSON.stringify(answers),
    JSON.stringify(Array.isArray(generatedSummary) ? generatedSummary : []),
    timestamp,
    timestamp,
    timestamp
  );

  const normalizedKnowledge = knowledge
    .map((section) => ({
      items: normalizeTextList(section?.items),
      title: String(section?.title ?? "").trim()
    }))
    .filter((section) => section.title && section.items.length > 0);

  replaceWorkerKnowledge(req.user.id, workerSlug, normalizedKnowledge);

  ensureWorkerPermissions(db, req.user.id, workerSlug);

  if (existing?.status !== "completed") {
    for (const task of tasks) {
      db.prepare(
        `INSERT INTO office_custom_tasks (id, user_id, worker_slug, title, module_name, owner, priority, status, due_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        randomUUID(),
        req.user.id,
        workerSlug,
        String(task.title ?? "First task"),
        String(task.module ?? "Onboarding"),
        task.owner === "You" ? "You" : "Worker",
        task.priority === "Low" || task.priority === "Medium" || task.priority === "High" ? task.priority : "Medium",
        ["To Do", "In Progress", "Needs Review", "Completed"].includes(String(task.status)) ? String(task.status) : "To Do",
        String(task.dueDate ?? "Today"),
        timestamp
      );
    }

    db.prepare(
      `INSERT INTO office_custom_briefings
       (id, user_id, worker_slug, title, date_label, summary, agenda_json, decisions_json, actions_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      req.user.id,
      workerSlug,
      String(briefing.title ?? "First Briefing"),
      String(briefing.dateLabel ?? "Tomorrow"),
      String(briefing.summary ?? ""),
      JSON.stringify(normalizeTextList(briefing.agenda)),
      JSON.stringify(normalizeTextList(briefing.decisionsNeeded)),
      JSON.stringify(normalizeTextList(briefing.recommendedActions)),
      timestamp
    );

    if (workerSlug === MARA_SLUG) {
      const accountContext = getUserOnboardingRecord(req.user.id);
      const initialPlan = buildMaraInitialWorkPlan({
        accountContext,
        maraAnswers: answers
      });
      const mergedKnowledge = [...initialPlan.memoryEntries, ...normalizedKnowledge];
      replaceWorkerKnowledge(req.user.id, workerSlug, mergedKnowledge);
      const createdTaskIds = [];

      for (const task of initialPlan.tasks) {
        const created = createApprovedTaskIfPermissionAllows(db, {
          description: task.description,
          dueAt: task.priority === "high" ? "This week" : "Next 7 days",
          evidenceUsed: generatedSummary,
          priority: task.priority,
          requiredPermissions: [],
          source: "onboarding_generated",
          title: task.title,
          userId: req.user.id,
          workerId: workerSlug
        });
        if (!created.duplicate && created.id) {
          createdTaskIds.push(created.id);
        }
      }

      for (const recurring of initialPlan.recurringResponsibilities) {
        createRecurringResponsibility(db, {
          cadence: recurring.cadence,
          createdFrom: "onboarding",
          dayOfWeek: recurring.dayOfWeek,
          description: recurring.description,
          permissionRequired: recurring.permissionRequired ?? null,
          title: recurring.title,
          userId: req.user.id,
          workerId: workerSlug
        });
      }

      autoExecuteSafeMaraTasks({
        db,
        taskIds: createdTaskIds,
        userId: req.user.id,
        workerId: workerSlug,
        ...buildMaraExecutionReaders()
      });
    }
  }

  db.prepare(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    req.user.id,
    workerSlug,
    "Completed new hire onboarding.",
    "Onboarding",
    String(worklogEntry?.result ?? "Worker prepared first-day setup"),
    timestamp
  );

  res.json({ ok: true });
});

app.use(express.static(distDir));
app.use(async (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    next();
    return;
  }

  try {
    const indexPath = path.join(distDir, "index.html");
    await fs.access(indexPath);
    res.sendFile(indexPath);
  } catch {
    next();
  }
});

app.listen(port, host, () => {
  console.log(`Ryva API listening on http://${host}:${port}`);
});
