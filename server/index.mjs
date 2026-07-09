import "./loadEnv.mjs";
import cookieParser from "cookie-parser";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";
import Stripe from "stripe";
import { fileURLToPath } from "node:url";
import { db, ensureOfficeSchema } from "./db.mjs";
import { sendTransactionalEmail } from "./mailer.mjs";
import { extractGmailBodyText } from "./maraInboxParser.mjs";
import { parseUnparsedInboxThreads } from "./maraInboxOps.mjs";
import { deriveMaraPermissionsFromOnboarding, formatTaskSourceLabel, safeList, sentenceCase } from "./maraOfficeUtils.mjs";
import { loadUserTrendInsights, resolveGlobalTrendInsightsPath, resolveStorageRoot, syncUserTrendInsightsFromGlobal } from "./maraTrendOps.mjs";
import {
  approveWorkerProposedTask,
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
  runMaraAutonomyCycle,
  runMaraTask,
  runWorkerTask,
  updateWorkerPermissions,
  updateApprovalRequestStatus,
  updateWorkerTaskStatus
} from "./workerEngine.mjs";
import { handleAgentChatMessage, runAgentAutonomyCycle, runAgentTask } from "./agentCore.mjs";
import { isAgentLlmConfigured, parseTrendPasteHeuristic, tryParseTrendPaste } from "./agentLlm.mjs";
import { hasRoleConfig } from "./roles.mjs";
import { saveUserTrendSnapshot, writeUserTrendInsightsFile } from "./maraTrendOps.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const workersPath = path.join(rootDir, "data", "workers.json");
const storageRoot =
  process.env.STORAGE_ROOT ||
  process.env.RAILWAY_VOLUME_MOUNT_PATH ||
  path.join(rootDir, "data");
const uploadsDir = path.join(storageRoot, "office-uploads");
const privateInsightsPath = resolveGlobalTrendInsightsPath();
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
const maraAutonomyIntervalMinutes = Number.parseInt(process.env.MARA_AUTONOMY_INTERVAL_MINUTES ?? "15", 10);
let maraAutonomyTimer = null;
let maraAutonomyRunning = false;

if (isProduction && !process.env.APP_URL) {
  throw new Error("APP_URL must be set in production.");
}

await fs.mkdir(uploadsDir, { recursive: true });
await fs.mkdir(path.dirname(privateInsightsPath), { recursive: true });

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

function getUserRecordById(userId) {
  if (!userId) return null;
  return db.prepare("SELECT * FROM users WHERE id = ?").get(userId) ?? null;
}

/** Admin accounts are for product ops — Mara should not run autonomously on them. */
function isMaraAutonomyPausedForUser(userOrUserId) {
  const user = typeof userOrUserId === "string" ? getUserRecordById(userOrUserId) : userOrUserId;
  return isAdminUser(user);
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
      `SELECT worker_slug, paused
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
    .map((row) => {
      const worker = workerMap.get(row.worker_slug);
      return worker ? { ...worker, paused: Boolean(row.paused) } : null;
    })
    .filter(Boolean);
}

function isWorkerPaused(userId, workerSlug) {
  const row = db
    .prepare("SELECT paused FROM hired_workers WHERE user_id = ? AND worker_slug = ? AND status = 'active'")
    .get(userId, workerSlug);
  return Boolean(row?.paused);
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
    assignments: db
      .prepare(
        `SELECT id, worker_slug AS workerSlug, source_type AS sourceType, source_id AS sourceId, source_label AS sourceLabel,
                title, summary, status, priority, kind, rhythm, blocked_reason AS blockedReason, due_at AS dueAt,
                artifact_type AS artifactType, artifact_ref_id AS artifactRefId, artifact_title AS artifactTitle,
                artifact_preview AS artifactPreview, created_at AS createdAt, updated_at AS updatedAt
         FROM office_assignments
         WHERE user_id = ?
         ORDER BY updated_at DESC, created_at DESC`
      )
      .all(userId),
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
    deliverables: db
      .prepare(
        `SELECT id, worker_slug AS workerSlug, source_type AS sourceType, source_id AS sourceId, title, summary,
                deliverable_type AS deliverableType, preview_text AS previewText, content_ref_id AS contentRefId,
                created_at AS createdAt, updated_at AS updatedAt
         FROM office_deliverables
         WHERE user_id = ?
         ORDER BY updated_at DESC, created_at DESC`
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
      .all(userId),
    handbookEntries: db
      .prepare(
        `SELECT id, section, subsection, worker_slug AS workerSlug, source_type AS sourceType, source_id AS sourceId,
                source_label AS sourceLabel, statement, created_at AS createdAt, updated_at AS updatedAt
         FROM office_handbook_entries
         WHERE user_id = ?
         ORDER BY section ASC, subsection ASC, updated_at DESC, created_at DESC`
      )
      .all(userId)
  };
}

function truncatePreview(value, max = 240) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function mapWorkerTaskStatusToAssignmentStatus(status) {
  const normalized = String(status ?? "").trim().toLowerCase();
  if (normalized === "completed" || normalized === "dismissed") return "done";
  if (normalized === "blocked") return "blocked";
  if (normalized === "in_progress") return "in_progress";
  if (normalized === "proposed") return "in_review";
  return "queued";
}

function mapOfficeTaskStatusToAssignmentStatus(status) {
  const normalized = String(status ?? "").trim().toLowerCase();
  if (normalized === "completed") return "done";
  if (normalized === "needs review") return "in_review";
  if (normalized === "blocked") return "blocked";
  if (normalized === "in progress") return "in_progress";
  return "queued";
}

function inferArtifactTypeFromOutputType(outputType) {
  const normalized = String(outputType ?? "").toLowerCase();
  if (normalized.includes("reply") || normalized.includes("pitch") || normalized.includes("follow_up")) return "email";
  if (normalized.includes("ideas") || normalized.includes("shot_list") || normalized.includes("criteria")) return "list";
  if (normalized.includes("plan") || normalized.includes("strategy") || normalized.includes("positioning")) return "doc";
  return "report";
}

function upsertOfficeAssignment(record) {
  const existing = db.prepare(
    `SELECT id
     FROM office_assignments
     WHERE user_id = ? AND worker_slug = ? AND source_type = ? AND source_id = ?`
  ).get(record.userId, record.workerSlug, record.sourceType, record.sourceId);

  if (existing) {
    db.prepare(
      `UPDATE office_assignments
       SET source_label = ?, title = ?, summary = ?, status = ?, priority = ?, kind = ?, rhythm = ?, blocked_reason = ?,
           due_at = ?, artifact_type = ?, artifact_ref_id = ?, artifact_title = ?, artifact_preview = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      record.sourceLabel,
      record.title,
      record.summary,
      record.status,
      record.priority,
      record.kind,
      record.rhythm ?? null,
      record.blockedReason ?? "",
      record.dueAt ?? null,
      record.artifactType ?? "none",
      record.artifactRefId ?? null,
      record.artifactTitle ?? "",
      record.artifactPreview ?? "",
      record.updatedAt,
      existing.id
    );
    return existing.id;
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO office_assignments
      (id, user_id, worker_slug, source_type, source_id, source_label, title, summary, status, priority, kind, rhythm,
       blocked_reason, due_at, artifact_type, artifact_ref_id, artifact_title, artifact_preview, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    record.userId,
    record.workerSlug,
    record.sourceType,
    record.sourceId,
    record.sourceLabel,
    record.title,
    record.summary,
    record.status,
    record.priority,
    record.kind,
    record.rhythm ?? null,
    record.blockedReason ?? "",
    record.dueAt ?? null,
    record.artifactType ?? "none",
    record.artifactRefId ?? null,
    record.artifactTitle ?? "",
    record.artifactPreview ?? "",
    record.createdAt,
    record.updatedAt
  );
  return id;
}

function upsertOfficeDeliverable(record) {
  const existing = db.prepare(
    `SELECT id
     FROM office_deliverables
     WHERE user_id = ? AND worker_slug = ? AND source_type = ? AND source_id = ?`
  ).get(record.userId, record.workerSlug, record.sourceType, record.sourceId);

  if (existing) {
    db.prepare(
      `UPDATE office_deliverables
       SET title = ?, summary = ?, deliverable_type = ?, preview_text = ?, content_ref_id = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      record.title,
      record.summary,
      record.deliverableType,
      record.previewText,
      record.contentRefId ?? null,
      record.updatedAt,
      existing.id
    );
    return existing.id;
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO office_deliverables
      (id, user_id, worker_slug, source_type, source_id, title, summary, deliverable_type, preview_text, content_ref_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    record.userId,
    record.workerSlug,
    record.sourceType,
    record.sourceId,
    record.title,
    record.summary,
    record.deliverableType,
    record.previewText,
    record.contentRefId ?? null,
    record.createdAt,
    record.updatedAt
  );
  return id;
}

function upsertHandbookEntry(record) {
  const existing = db.prepare(
    `SELECT id
     FROM office_handbook_entries
     WHERE user_id = ? AND section = ? AND subsection = ? AND COALESCE(worker_slug, '') = COALESCE(?, '') AND source_type = ? AND source_id = ?`
  ).get(record.userId, record.section, record.subsection, record.workerSlug ?? null, record.sourceType, record.sourceId);

  if (existing) {
    db.prepare(
      `UPDATE office_handbook_entries
       SET source_label = ?, statement = ?, updated_at = ?
       WHERE id = ?`
    ).run(record.sourceLabel, record.statement, record.updatedAt, existing.id);
    return existing.id;
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO office_handbook_entries
      (id, user_id, section, subsection, worker_slug, source_type, source_id, source_label, statement, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    record.userId,
    record.section,
    record.subsection,
    record.workerSlug ?? null,
    record.sourceType,
    record.sourceId,
    record.sourceLabel,
    record.statement,
    record.createdAt,
    record.updatedAt
  );
  return id;
}

function syncWorkerAssignments(userId, workerSlug) {
  const workerTasks = db.prepare(
    `SELECT id, title, description, source, status, priority, due_at AS dueAt, output, task_type AS taskType, updated_at AS updatedAt, created_at AS createdAt
     FROM worker_tasks
     WHERE user_id = ? AND worker_id = ?`
  ).all(userId, workerSlug);

  for (const task of workerTasks) {
    const parsedOutput = parseJson(task.output, null);
    upsertOfficeAssignment({
      artifactPreview: truncatePreview(parsedOutput?.preview || parsedOutput?.content || task.output || ""),
      artifactRefId: null,
      artifactTitle: parsedOutput?.title || "",
      artifactType: parsedOutput?.type || (task.taskType ? inferArtifactTypeFromOutputType(task.taskType) : "none"),
      blockedReason: mapWorkerTaskStatusToAssignmentStatus(task.status) === "blocked" ? truncatePreview(task.description, 180) : "",
      createdAt: task.createdAt,
      dueAt: task.dueAt,
      kind: task.source === "recurring" ? "recurring" : "one_off",
      priority: String(task.priority || "medium"),
      rhythm: task.source === "recurring" ? "Recurring" : null,
      sourceId: task.id,
      sourceLabel: formatTaskSourceLabel(task.source) || "In progress",
      sourceType: "worker_task",
      status: mapWorkerTaskStatusToAssignmentStatus(task.status),
      summary: truncatePreview(task.description, 180),
      title: task.title,
      updatedAt: task.updatedAt,
      userId,
      workerSlug
    });
  }

  const officeTasks = db.prepare(
    `SELECT id, title, module_name AS moduleName, priority, status, due_date AS dueDate, created_at AS createdAt
     FROM office_custom_tasks
     WHERE user_id = ? AND worker_slug = ?`
  ).all(userId, workerSlug);

  // Worker tasks are the source of truth. Office rows that mirror a worker
  // task (same title) would render as duplicates — skip them, and clean up
  // any duplicate assignment rows older syncs left behind.
  const workerTaskTitles = new Set(workerTasks.map((task) => String(task.title).trim().toLowerCase()));

  for (const task of officeTasks) {
    if (workerTaskTitles.has(String(task.title).trim().toLowerCase())) {
      db.prepare(
        `DELETE FROM office_assignments
         WHERE user_id = ? AND worker_slug = ? AND source_type = 'office_task' AND source_id = ?`
      ).run(userId, workerSlug, task.id);
      continue;
    }
    const moduleLabel = String(task.moduleName ?? "").trim();
    const readableModule = /^[a-z0-9]+([_-][a-z0-9]+)+$/i.test(moduleLabel)
      ? formatTaskSourceLabel(moduleLabel) || sentenceCase(moduleLabel.replace(/[_-]+/g, " "))
      : moduleLabel;
    upsertOfficeAssignment({
      artifactPreview: "",
      artifactRefId: null,
      artifactTitle: "",
      artifactType: "none",
      blockedReason: "",
      createdAt: task.createdAt,
      dueAt: task.dueDate,
      kind: "one_off",
      priority: String(task.priority || "Medium").toLowerCase(),
      rhythm: null,
      sourceId: task.id,
      sourceLabel: "Office task",
      sourceType: "office_task",
      status: mapOfficeTaskStatusToAssignmentStatus(task.status),
      summary: truncatePreview(readableModule, 180),
      title: task.title,
      updatedAt: task.createdAt,
      userId,
      workerSlug
    });
  }
}

function syncWorkerDeliverables(userId, workerSlug) {
  const outputs = listWorkerOutputs(db, userId, workerSlug);
  for (const output of outputs) {
    upsertOfficeDeliverable({
      contentRefId: output.id,
      createdAt: output.createdAt,
      deliverableType: output.outputType,
      previewText: truncatePreview(output.content || output.structuredContent?.preview || "", 260),
      sourceId: output.id,
      sourceType: "worker_output",
      summary: truncatePreview(output.content || output.title, 160),
      title: output.title,
      updatedAt: output.updatedAt,
      userId,
      workerSlug
    });
  }

  const uploadedFiles = db.prepare(
    `SELECT id, name, type, uploaded_at AS uploadedAt
     FROM office_uploaded_files
     WHERE user_id = ? AND worker_slug = ?`
  ).all(userId, workerSlug);

  for (const file of uploadedFiles) {
    upsertOfficeDeliverable({
      contentRefId: file.id,
      createdAt: file.uploadedAt,
      deliverableType: file.type || "file",
      previewText: `${file.type} uploaded to the office files.`,
      sourceId: file.id,
      sourceType: "uploaded_file",
      summary: `${file.type} available to open or download.`,
      title: file.name,
      updatedAt: file.uploadedAt,
      userId,
      workerSlug
    });
  }
}

function syncHandbookEntries(userId, workerSlug) {
  const timestamp = nowIso();
  const settingsRow = db.prepare(
    `SELECT settings_json AS settingsJson
     FROM office_global_settings
     WHERE user_id = ?`
  ).get(userId);
  const settings = parseJson(settingsRow?.settingsJson, {});
  const baseEntries = [
    ["business_profile", "company", "global_settings", "brand_context", String(settings.brandContext || "").trim(), "Added in settings"],
    ["voice_and_tone", "decision_style", "global_settings", "decision_style", String(settings.decisionStyle || "").trim(), "Decision style · settings"],
    ["rules", "review_cadence", "global_settings", "review_cadence", String(settings.reviewCadence || "").trim(), "Review cadence · settings"],
    ["rules", "quiet_hours", "global_settings", "quiet_hours", String(settings.quietHours || "").trim(), "Quiet hours · settings"]
  ];

  for (const [section, subsection, sourceType, sourceId, statement, sourceLabel] of baseEntries) {
    if (!statement) continue;
    upsertHandbookEntry({
      createdAt: timestamp,
      section,
      sourceId,
      sourceLabel,
      sourceType,
      statement,
      subsection,
      updatedAt: timestamp,
      userId,
      workerSlug: null
    });
  }

  const onboarding = db.prepare(
    `SELECT generated_summary_json AS generatedSummaryJson
     FROM office_onboarding_sessions
     WHERE user_id = ? AND worker_slug = ?`
  ).get(userId, workerSlug);
  const generatedSummary = normalizeTextList(parseJson(onboarding?.generatedSummaryJson, []), 12);
  generatedSummary.forEach((statement, index) => {
    upsertHandbookEntry({
      createdAt: timestamp,
      section: "workers",
      sourceId: `${workerSlug}-onboarding-${index}`,
      sourceLabel: `Learned during ${workerSlug} onboarding`,
      sourceType: "worker_onboarding",
      statement: truncatePreview(statement, 220),
      subsection: "learned_context",
      updatedAt: timestamp,
      userId,
      workerSlug
    });
  });

  const knowledgeRow = db.prepare(
    `SELECT knowledge_json AS knowledgeJson
     FROM office_worker_knowledge
     WHERE user_id = ? AND worker_slug = ?`
  ).get(userId, workerSlug);
  const knowledge = parseJson(knowledgeRow?.knowledgeJson, []);
  if (Array.isArray(knowledge)) {
    knowledge.slice(0, 12).forEach((section, index) => {
      const title = String(section?.title ?? "").trim();
      const items = Array.isArray(section?.items) ? section.items : [];
      items
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .slice(0, 2)
        .forEach((statement, itemIndex) => {
          upsertHandbookEntry({
            createdAt: timestamp,
            section: "workers",
            sourceId: `${workerSlug}-knowledge-${index}-${itemIndex}`,
            sourceLabel: `${workerSlug} knowledge`,
            sourceType: "worker_knowledge",
            statement: truncatePreview(statement, 220),
            subsection: sentenceCase(title || "Knowledge"),
            updatedAt: timestamp,
            userId,
            workerSlug
          });
        });
    });
  } else {
    Object.entries(knowledge || {}).slice(0, 12).forEach(([key, value], index) => {
      const items = Array.isArray(value) ? value : [value];
      items
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .slice(0, 2)
        .forEach((statement, itemIndex) => {
          upsertHandbookEntry({
            createdAt: timestamp,
            section: "workers",
            sourceId: `${workerSlug}-knowledge-${index}-${itemIndex}`,
            sourceLabel: `${workerSlug} knowledge`,
            sourceType: "worker_knowledge",
            statement: truncatePreview(statement, 220),
            subsection: sentenceCase(String(key).replace(/_/g, " ")),
            updatedAt: timestamp,
            userId,
            workerSlug
          });
        });
    });
  }

  const decisions = db.prepare(
    `SELECT id, date_label AS dateLabel, decisions_json AS decisionsJson
     FROM office_custom_briefings
     WHERE user_id = ? AND worker_slug = ?`
  ).all(userId, workerSlug);
  decisions.forEach((briefing) => {
    safeList(briefing.decisionsJson).slice(0, 6).forEach((statement, index) => {
      upsertHandbookEntry({
        createdAt: timestamp,
        section: "decisions",
        sourceId: `${briefing.id}-${index}`,
        sourceLabel: `Decided in briefing · ${briefing.dateLabel}`,
        sourceType: "briefing_decision",
        statement: truncatePreview(statement, 220),
        subsection: "review_decisions",
        updatedAt: timestamp,
        userId,
        workerSlug
      });
    });
  });

  const integrations = db.prepare(
    `SELECT provider, status, account_label AS accountLabel
     FROM office_worker_integrations
     WHERE user_id = ? AND worker_slug = ?`
  ).all(userId, workerSlug);
  integrations.forEach((integration) => {
    upsertHandbookEntry({
      createdAt: timestamp,
      section: "sources",
      sourceId: `${workerSlug}-${integration.provider}`,
      sourceLabel: sentenceCase(integration.status),
      sourceType: "integration",
      statement: `${integration.accountLabel || integration.provider} is connected for ${workerSlug}.`,
      subsection: "connected_tools",
      updatedAt: timestamp,
      userId,
      workerSlug
    });
  });
}

function syncOfficeCanonicalRecords(userId, workerSlug) {
  syncWorkerAssignments(userId, workerSlug);
  syncWorkerDeliverables(userId, workerSlug);
  syncHandbookEntries(userId, workerSlug);
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

function ensureMaraKnowledge(userId) {
  // Worker memory must only ever contain things the manager actually said
  // (onboarding answers, chat direction). Never seed invented preferences.
  if (!hasHiredWorker(userId, MARA_SLUG)) return;
  const existing = db
    .prepare(
      `SELECT id
       FROM office_worker_knowledge
       WHERE user_id = ? AND worker_slug = ?`
    )
    .get(userId, MARA_SLUG);

  if (existing) return;

  const sections = [];

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

function upsertWorkerIntegration(userId, workerSlug, provider, status, accountLabel, metadata = {}) {
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
    workerSlug,
    provider,
    status,
    accountLabel,
    serializeJson(metadata),
    status === "connected" ? nowIso() : null,
    nowIso()
  );
}

function getWorkerIntegration(userId, workerSlug, provider) {
  const row = db.prepare(
    `SELECT provider, status, account_label AS accountLabel, metadata_json AS metadataJson, connected_at AS connectedAt, updated_at AS updatedAt
     FROM office_worker_integrations
     WHERE user_id = ? AND worker_slug = ? AND provider = ?`
  ).get(userId, workerSlug, provider);

  if (!row) return null;
  return {
    ...row,
    metadata: parseJson(row.metadataJson, {})
  };
}

async function getFreshGoogleAccessToken(userId, workerSlug, provider = "gmail") {
  const integration = getWorkerIntegration(userId, workerSlug, provider);
  if (!integration || integration.status !== "connected") {
    throw new Error("Gmail is not connected.");
  }

  const metadata = integration.metadata || {};
  const refreshToken = String(metadata.refreshToken ?? "").trim();
  if (!refreshToken) {
    throw new Error("Missing Gmail refresh token.");
  }

  const expiresAt = String(metadata.expiresAt ?? "").trim();
  const accessToken = String(metadata.accessToken ?? "").trim();
  const needsRefresh = !accessToken || !expiresAt || new Date(expiresAt).getTime() <= Date.now() + 60_000;

  if (!needsRefresh) {
    return {
      accessToken,
      emailAddress: String(metadata.emailAddress ?? "").trim(),
      integration
    };
  }

  const refreshed = await refreshGoogleAccessToken(refreshToken);
  const nextMetadata = {
    ...metadata,
    accessToken: String(refreshed.access_token ?? ""),
    expiresAt: new Date(Date.now() + Number(refreshed.expires_in ?? 3600) * 1000).toISOString()
  };
  upsertWorkerIntegration(userId, workerSlug, provider, "connected", integration.accountLabel, nextMetadata);

  return {
    accessToken: nextMetadata.accessToken,
    emailAddress: String(nextMetadata.emailAddress ?? "").trim(),
    integration: getWorkerIntegration(userId, workerSlug, provider)
  };
}

function extractHeaderValue(headers, name) {
  const match = (headers || []).find((header) => String(header?.name || "").toLowerCase() === name.toLowerCase());
  return String(match?.value ?? "").trim();
}

function parseEmailAddress(value) {
  const raw = String(value ?? "").trim();
  const bracketMatch = raw.match(/<([^>]+)>/);
  if (bracketMatch) return bracketMatch[1].trim().toLowerCase();
  const emailMatch = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return emailMatch ? emailMatch[0].trim().toLowerCase() : "";
}

function deriveBrandNameFromEmail(email, fallbackName = "") {
  if (fallbackName) {
    return fallbackName.replace(/<.*?>/g, "").trim();
  }
  const host = email.split("@")[1] || "";
  const label = host.split(".")[0] || email;
  return label
    .split(/[-_.]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function classifyGmailThread({ bodyText = "", emailAddress, from, snippet, subject }) {
  const senderEmail = parseEmailAddress(from);
  const lowerSnippet = `${subject} ${snippet} ${bodyText}`.toLowerCase();
  const fromSelf = Boolean(senderEmail) && senderEmail === emailAddress.toLowerCase();
  const brandRelated = !/@gmail\.com$/.test(senderEmail) && !/@yahoo\./.test(senderEmail) && !/@icloud\./.test(senderEmail);
  const urgency = /asap|urgent|today|deadline|tomorrow|eod|by friday|by monday/.test(lowerSnippet) ? "high" : /soon|follow up|follow-up/.test(lowerSnippet) ? "medium" : "low";
  let category = "general";
  if (/revision|revise|updated hook|revised cta/.test(lowerSnippet)) {
    category = "revision_request";
  } else if (/brief|deliverable|talking points|usage rights|campaign/.test(lowerSnippet)) {
    category = "campaign_brief";
  } else if (/brief|deliverable|campaign|ugc|creator|product/.test(lowerSnippet)) {
    category = "outreach";
  }
  let threadStatus = fromSelf ? "outbound" : "awaiting_reply";
  if (category === "campaign_brief") {
    threadStatus = "brief_received";
  } else if (category === "revision_request") {
    threadStatus = "needs_follow_up";
  }
  const reason = brandRelated
    ? "Likely brand-related thread from a non-personal domain."
    : "Captured from connected Gmail for inbox organization.";
  return { brandRelated, category, reason, threadStatus, urgency };
}

function mapThreadStatusToCampaignStatus(threadStatus) {
  const status = String(threadStatus || "").toLowerCase();
  if (status === "awaiting_reply") return "awaiting_reply";
  if (status === "outbound") return "pitched";
  if (status === "brief_received") return "brief_received";
  if (status === "needs_follow_up") return "follow_up_due";
  return "active_thread";
}

function mapThreadStatusToLeadStage(threadStatus) {
  const status = String(threadStatus || "").toLowerCase();
  if (status === "awaiting_reply") return "awaiting_reply";
  if (status === "outbound") return "pitched";
  if (status === "brief_received") return "in_conversation";
  if (status === "needs_follow_up") return "follow_up_due";
  return "active";
}

function upsertOfficeLead({
  brandName,
  contactEmail,
  contactName = "",
  lastActivityAt = null,
  leadStage,
  metadata = {},
  sourceReferenceId = null,
  sourceType,
  summary,
  userId,
  workerSlug
}) {
  const safeBrandName = String(brandName || "").trim();
  const safeEmail = String(contactEmail || "").trim();
  if (!safeBrandName || !safeEmail) return null;

  const existing = db.prepare(
    `SELECT id, history_json AS historyJson, metadata_json AS metadataJson
     FROM office_leads
     WHERE user_id = ? AND worker_slug = ? AND brand_name = ? AND contact_email = ?
     LIMIT 1`
  ).get(userId, workerSlug, safeBrandName, safeEmail);

  const timestamp = nowIso();
  const historyEntry = {
    at: timestamp,
    leadStage,
    sourceReferenceId,
    sourceType,
    summary
  };

  if (existing) {
    const history = parseJson(existing.historyJson, []);
    const nextHistory = Array.isArray(history) ? [historyEntry, ...history].slice(0, 25) : [historyEntry];
    const nextMetadata = {
      ...parseJson(existing.metadataJson, {}),
      ...metadata
    };
    db.prepare(
      `UPDATE office_leads
       SET contact_name = ?, lead_stage = ?, source_type = ?, source_reference_id = ?, last_activity_at = ?,
           summary = ?, history_json = ?, metadata_json = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      contactName,
      leadStage,
      sourceType,
      sourceReferenceId,
      lastActivityAt,
      summary,
      JSON.stringify(nextHistory),
      JSON.stringify(nextMetadata),
      timestamp,
      existing.id
    );
    return existing.id;
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO office_leads
      (id, user_id, worker_slug, brand_name, contact_name, contact_email, lead_stage, source_type, source_reference_id,
       last_activity_at, next_follow_up_at, summary, history_json, metadata_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    userId,
    workerSlug,
    safeBrandName,
    contactName,
    safeEmail,
    leadStage,
    sourceType,
    sourceReferenceId,
    lastActivityAt,
    null,
    summary,
    JSON.stringify([historyEntry]),
    JSON.stringify(metadata),
    timestamp,
    timestamp
  );
  return id;
}

function syncCampaignsToLeadTracker(userId, workerSlug) {
  const campaigns = db.prepare(
    `SELECT id, brand_name AS brandName, contact_name AS contactName, contact_email AS contactEmail,
            campaign_status AS campaignStatus, brief_text AS briefText, updated_at AS updatedAt
     FROM office_campaigns
     WHERE user_id = ? AND worker_slug = ?
     ORDER BY updated_at DESC`
  ).all(userId, workerSlug);

  let syncedCount = 0;
  for (const campaign of campaigns) {
    const leadId = upsertOfficeLead({
      brandName: campaign.brandName,
      contactEmail: campaign.contactEmail,
      contactName: campaign.contactName,
      lastActivityAt: campaign.updatedAt,
      leadStage: String(campaign.campaignStatus || "active"),
      metadata: { campaignId: campaign.id },
      sourceReferenceId: campaign.id,
      sourceType: "campaign",
      summary: campaign.briefText || `${campaign.brandName} campaign is in ${campaign.campaignStatus}.`,
      userId,
      workerSlug
    });
    if (leadId) syncedCount += 1;
  }
  return { syncedCount };
}

function syncResearchToOfficeIntel(userId, workerSlug) {
  const researchItems = db.prepare(
    `SELECT id, topic, source_type AS sourceType, summary, insights_json AS insightsJson, evidence_json AS evidenceJson, created_at AS createdAt
     FROM worker_research_items
     WHERE user_id = ? AND worker_id = ?
     ORDER BY created_at DESC
     LIMIT 50`
  ).all(userId, workerSlug);

  let opportunityCount = 0;
  let trendSignalCount = 0;

  for (const item of researchItems) {
    const insights = parseJson(item.insightsJson, []);
    const evidence = parseJson(item.evidenceJson, []);
    if (item.sourceType === "web_brand") {
      const existing = db.prepare(
        `SELECT id
         FROM office_brand_opportunities
         WHERE user_id = ? AND worker_slug = ? AND brand_name = ?
         LIMIT 1`
      ).get(userId, workerSlug, item.topic);
      const suggestedAngle = Array.isArray(insights)
        ? String(insights.find((entry) => String(entry).startsWith("Suggested angle:")) || "").replace(/^Suggested angle:\s*/i, "").trim()
        : "";
      const contentGap = Array.isArray(insights)
        ? String(insights.find((entry) => String(entry).startsWith("TikTok content gap signal:")) || "").replace(/^TikTok content gap signal:\s*/i, "").trim()
        : "";
      const sourceNotes = Array.isArray(insights)
        ? insights.join(" | ").slice(0, 500)
        : String(item.summary || "");
      const website = String(evidence?.[0]?.url || "").trim();
      const fitScore = Math.max(55, Math.min(95, 65 + (contentGap ? 10 : 0) + (suggestedAngle ? 8 : 0)));
      const ugcPotentialScore = Math.max(50, Math.min(95, 60 + (suggestedAngle ? 12 : 0)));
      const riskScore = /caution|warning|delayed payment|risk/i.test(sourceNotes) ? 58 : 24;
      if (existing) {
        db.prepare(
          `UPDATE office_brand_opportunities
           SET website = ?, fit_score = ?, ugc_potential_score = ?, risk_score = ?, content_gap = ?, suggested_angle = ?,
               source_notes = ?, updated_at = ?
           WHERE id = ?`
        ).run(website, fitScore, ugcPotentialScore, riskScore, contentGap, suggestedAngle, sourceNotes, nowIso(), existing.id);
      } else {
        db.prepare(
          `INSERT INTO office_brand_opportunities
            (id, user_id, worker_slug, brand_name, website, category, source, fit_score, ugc_potential_score, risk_score,
             priority, content_gap, suggested_angle, source_notes, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          randomUUID(),
          userId,
          workerSlug,
          item.topic,
          website,
          "Brand research",
          "Mara autonomy research",
          fitScore,
          ugcPotentialScore,
          riskScore,
          fitScore >= 85 ? "High" : fitScore >= 72 ? "Medium" : "Low",
          contentGap,
          suggestedAngle,
          sourceNotes,
          "new",
          item.createdAt,
          nowIso()
        );
      }
      opportunityCount += 1;
    }

    if (item.sourceType === "reddit_signal") {
      const existingSignal = db.prepare(
        `SELECT id
         FROM office_trend_signals
         WHERE user_id = ? AND worker_slug = ? AND title = ?
         LIMIT 1`
      ).get(userId, workerSlug, item.topic);
      if (!existingSignal) {
        db.prepare(
          `INSERT INTO office_trend_signals
            (id, user_id, worker_slug, niche, platform, signal_type, title, summary, hashtags_json, examples_json, confidence, source, detected_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          randomUUID(),
          userId,
          workerSlug,
          "ugc",
          "Reddit",
          "creator_chatter",
          item.topic,
          item.summary || item.topic,
          JSON.stringify([]),
          JSON.stringify(Array.isArray(insights) ? insights.slice(0, 3) : []),
          "medium",
          "Mara autonomy research",
          item.createdAt
        );
      }
      trendSignalCount += 1;
    }
  }

  return { opportunityCount, trendSignalCount };
}

function syncPrivateTikTokInsightsToTrendSignals(userId, workerSlug, privateInsights) {
  const hashtags = Array.isArray(privateInsights?.hashtags) ? privateInsights.hashtags : [];
  const niche = String(privateInsights?.niche || "ugc").trim();
  let syncedCount = 0;
  for (const hashtag of hashtags.slice(0, 25)) {
    const title = String(hashtag?.hashtag || "").trim();
    if (!title) continue;
    const existing = db.prepare(
      `SELECT id
       FROM office_trend_signals
       WHERE user_id = ? AND worker_slug = ? AND title = ?
       LIMIT 1`
    ).get(userId, workerSlug, title);
    const summary = `${title} has ${String(hashtag.posts || "")} posts and ${String(hashtag.views || "")} views in ${String(privateInsights?.region || "US")} over the last ${String(privateInsights?.periodDays || 7)} days for ${niche}.`.trim();
    const examples = Array.isArray(hashtag.categories) ? hashtag.categories : [];
    if (existing) {
      db.prepare(
        `UPDATE office_trend_signals
         SET summary = ?, examples_json = ?, detected_at = ?
         WHERE id = ?`
      ).run(summary, JSON.stringify(examples), String(privateInsights?.updatedAt || nowIso()), existing.id);
    } else {
      db.prepare(
        `INSERT INTO office_trend_signals
          (id, user_id, worker_slug, niche, platform, signal_type, title, summary, hashtags_json, examples_json, confidence, source, detected_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        randomUUID(),
        userId,
        workerSlug,
        niche,
        "TikTok",
        "creator_search_hashtag",
        title,
        summary,
        JSON.stringify([title]),
        JSON.stringify(examples),
        privateInsights?.loginWallEncountered ? "medium" : "high",
        "TikTok Creative Center",
        String(privateInsights?.updatedAt || nowIso())
      );
    }
    syncedCount += 1;
  }
  return { syncedCount };
}

function syncInboxThreadsToCampaigns(userId, workerSlug) {
  const brandThreads = db.prepare(
    `SELECT brand_name AS brandName, contact_name AS contactName, contact_email AS contactEmail, subject, snippet,
            received_at AS receivedAt, urgency, thread_status AS threadStatus, id
     FROM office_email_threads
     WHERE user_id = ? AND worker_slug = ? AND brand_related = 1
     ORDER BY received_at DESC`
  ).all(userId, workerSlug);

  const seenBrands = new Set();
  let syncedCount = 0;

  for (const thread of brandThreads) {
    const brandKey = String(thread.brandName || thread.contactEmail || thread.subject || "").trim().toLowerCase();
    if (!brandKey || seenBrands.has(brandKey)) continue;
    seenBrands.add(brandKey);

    const existing = db.prepare(
      `SELECT id
       FROM office_campaigns
       WHERE user_id = ? AND worker_slug = ? AND brand_name = ? AND contact_email = ?
       LIMIT 1`
    ).get(userId, workerSlug, thread.brandName || "Unknown brand", thread.contactEmail || "");

    if (existing) {
      const existingCampaign = db.prepare(
        `SELECT last_parsed_at AS lastParsedAt, deliverables_json AS deliverablesJson
         FROM office_campaigns
         WHERE id = ?`
      ).get(existing.id);
      const hasParsedBrief = Boolean(existingCampaign?.lastParsedAt) || parseJson(existingCampaign?.deliverablesJson, []).length > 0;
      if (hasParsedBrief) {
        db.prepare(
          `UPDATE office_campaigns
           SET source_thread_id = ?, notes = ?, updated_at = ?
           WHERE id = ?`
        ).run(
          thread.id,
          `Linked to latest Gmail thread: ${thread.subject || thread.brandName || "Inbox thread"}`,
          nowIso(),
          existing.id
        );
      } else {
        db.prepare(
          `UPDATE office_campaigns
           SET campaign_name = ?, campaign_status = ?, source_thread_id = ?, brief_text = ?, notes = ?, updated_at = ?
           WHERE id = ?`
        ).run(
          thread.subject || `${thread.brandName || "Brand"} outreach`,
          mapThreadStatusToCampaignStatus(thread.threadStatus),
          thread.id,
          thread.snippet || "",
          `Synced from Gmail thread: ${thread.subject || thread.brandName || "Inbox thread"}`,
          nowIso(),
          existing.id
        );
      }
      syncedCount += 1;
      continue;
    }

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
      workerSlug,
      thread.brandName || "Unknown brand",
      "",
      thread.contactName || "",
      thread.contactEmail || "",
      "",
      thread.subject || `${thread.brandName || "Brand"} outreach`,
      mapThreadStatusToCampaignStatus(thread.threadStatus),
      thread.id,
      JSON.stringify([]),
      thread.snippet || "",
      null,
      null,
      "",
      "unknown",
      "",
      "needs_review",
      "",
      0,
      JSON.stringify([]),
      JSON.stringify(thread.urgency === "high" ? ["urgent_thread"] : []),
      `Synced from Gmail thread: ${thread.subject || thread.brandName || "Inbox thread"}`,
      nowIso(),
      nowIso()
    );
    syncedCount += 1;
  }

  return { syncedCount };
}

/**
 * Reddit lessons Mara distilled become durable playbook memory, and weekly
 * schedules land on the calendar as real time blocks. Both are idempotent —
 * each output is harvested exactly once.
 */
function harvestMaraOutputSideEffects(userId, workerSlug) {
  const recentThreshold = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  const rows = db.prepare(
    `SELECT id, output_type AS outputType, structured_content_json AS structuredContentJson
     FROM worker_outputs
     WHERE user_id = ? AND worker_id = ? AND created_at >= ? AND output_type IN ('market_pulse', 'weekly_schedule')`
  ).all(userId, workerSlug, recentThreshold);

  for (const row of rows) {
    const structured = parseJson(row.structuredContentJson, {});
    let changed = false;

    // Lessons → "UGC playbook (learned)" memory section, capped at 20.
    if (row.outputType === "market_pulse" && Array.isArray(structured.lessonsLearned) && structured.lessonsLearned.length > 0 && !structured.lessonsHarvestedAt) {
      upsertWorkerKnowledge(userId, workerSlug, (knowledge) => {
        const next = Array.isArray(knowledge) ? [...knowledge] : [];
        const title = "UGC playbook (learned)";
        const index = next.findIndex((section) => String(section?.title ?? "").trim() === title);
        const existingItems = index >= 0 && Array.isArray(next[index]?.items) ? next[index].items : [];
        const mergedItems = normalizeTextList([...structured.lessonsLearned, ...existingItems], 20);
        const section = { title, items: mergedItems };
        if (index >= 0) next[index] = section;
        else next.push(section);
        return next;
      });
      structured.lessonsHarvestedAt = nowIso();
      changed = true;
    }

    // Schedule blocks → calendar events for the upcoming week.
    if (row.outputType === "weekly_schedule" && Array.isArray(structured.blocks) && structured.blocks.length > 0 && !structured.calendarSyncedAt) {
      const dayIndex = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
      const now = new Date();
      let created = 0;
      for (const block of structured.blocks.slice(0, 20)) {
        const targetDay = dayIndex[String(block?.day ?? "").trim()];
        const startMatch = String(block?.start ?? "").match(/^(\d{1,2}):(\d{2})$/);
        const endMatch = String(block?.end ?? "").match(/^(\d{1,2}):(\d{2})$/);
        const activity = String(block?.activity ?? "").trim();
        if (targetDay === undefined || !startMatch || !endMatch || !activity) continue;

        const start = new Date(now);
        let delta = (targetDay - start.getDay() + 7) % 7;
        if (delta === 0 && (start.getHours() > Number(startMatch[1]) || (start.getHours() === Number(startMatch[1]) && start.getMinutes() > Number(startMatch[2])))) {
          delta = 7; // today's slot already passed — schedule next week
        }
        start.setDate(start.getDate() + delta);
        start.setHours(Number(startMatch[1]), Number(startMatch[2]), 0, 0);
        const end = new Date(start);
        end.setHours(Number(endMatch[1]), Number(endMatch[2]), 0, 0);
        if (end.getTime() <= start.getTime()) continue;

        db.prepare(
          `INSERT INTO office_calendar_events
            (id, user_id, worker_slug, title, starts_at, ends_at, event_type, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          randomUUID(),
          userId,
          workerSlug,
          activity.slice(0, 120),
          start.toISOString(),
          end.toISOString(),
          "Focus",
          String(block?.goal ?? "").slice(0, 240),
          nowIso(),
          nowIso()
        );
        created += 1;
      }
      if (created > 0) {
        createWorkerActivityLog(db, {
          description: `Placed ${created} time block${created === 1 ? "" : "s"} on your calendar for the week.`,
          eventType: "task_completed",
          metadata: { outputId: row.id },
          title: "Weekly schedule on calendar",
          userId,
          workerId: workerSlug
        });
      }
      structured.calendarSyncedAt = nowIso();
      changed = true;
    }

    if (changed) {
      db.prepare("UPDATE worker_outputs SET structured_content_json = ?, updated_at = ? WHERE id = ?")
        .run(JSON.stringify(structured), nowIso(), row.id);
    }
  }
}

function syncMaraOperationalRecords(userId, workerSlug) {
  harvestMaraOutputSideEffects(userId, workerSlug);
  const privateInsights = loadUserTrendInsights({
    db,
    globalPath: privateInsightsPath,
    readAccountContext: getUserOnboardingRecord,
    readMaraOnboarding: readMaraOnboardingAnswers,
    readWorkerKnowledge: readWorkerKnowledgeSections,
    storageRoot: resolveStorageRoot(),
    userId,
    workerId: workerSlug
  });
  const campaignLeadSync = syncCampaignsToLeadTracker(userId, workerSlug);
  const researchSync = syncResearchToOfficeIntel(userId, workerSlug);
  const trendSync = syncPrivateTikTokInsightsToTrendSignals(userId, workerSlug, privateInsights);
  syncOfficeCanonicalRecords(userId, workerSlug);
  return {
    campaignLeadSyncCount: campaignLeadSync.syncedCount,
    opportunitySyncCount: researchSync.opportunityCount,
    trendSignalSyncCount: researchSync.trendSignalCount + trendSync.syncedCount
  };
}

async function syncGmailInbox(userId, workerSlug) {
  const { accessToken, emailAddress } = await getFreshGoogleAccessToken(userId, workerSlug, "gmail");
  const listResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=25&q=newer_than:60d", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!listResponse.ok) {
    throw new Error(`Gmail message list failed with status ${listResponse.status}.`);
  }

  const listPayload = await listResponse.json();
  const messages = Array.isArray(listPayload.messages) ? listPayload.messages : [];
  let syncedCount = 0;

  for (const message of messages) {
    const detailResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=full`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!detailResponse.ok) continue;
    const detail = await detailResponse.json();
    const headers = detail.payload?.headers ?? [];
    const subject = extractHeaderValue(headers, "Subject") || "(no subject)";
    const from = extractHeaderValue(headers, "From");
    const to = extractHeaderValue(headers, "To");
    const senderEmail = parseEmailAddress(from);
    const senderName = String(from || "").replace(/<.*?>/g, "").trim();
    const snippet = String(detail.snippet ?? "").trim();
    const bodyText = extractGmailBodyText(detail.payload);
    const receivedAt = extractHeaderValue(headers, "Date") ? new Date(extractHeaderValue(headers, "Date")).toISOString() : nowIso();
    const classification = classifyGmailThread({ bodyText, emailAddress, from, snippet, subject });
    const brandName = deriveBrandNameFromEmail(senderEmail, senderName);
    const gmailThreadId = String(detail.threadId || "");

    db.prepare(
      `INSERT INTO office_email_threads
        (id, user_id, worker_slug, provider, subject, participants_json, snippet, body_text, received_at, brand_related, category, urgency, confidence, reason, brand_name, contact_name, contact_email, source_message_count, thread_status, gmail_thread_id, raw_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         subject = excluded.subject,
         participants_json = excluded.participants_json,
         snippet = excluded.snippet,
         body_text = excluded.body_text,
         received_at = excluded.received_at,
         brand_related = excluded.brand_related,
         category = excluded.category,
         urgency = excluded.urgency,
         confidence = excluded.confidence,
         reason = excluded.reason,
         brand_name = excluded.brand_name,
         contact_name = excluded.contact_name,
         contact_email = excluded.contact_email,
         source_message_count = excluded.source_message_count,
         thread_status = excluded.thread_status,
         gmail_thread_id = excluded.gmail_thread_id,
         raw_json = excluded.raw_json,
         updated_at = excluded.updated_at`
    ).run(
      String(detail.id),
      userId,
      workerSlug,
      "gmail",
      subject,
      JSON.stringify([from, to].filter(Boolean)),
      snippet,
      bodyText,
      receivedAt,
      classification.brandRelated ? 1 : 0,
      classification.category,
      classification.urgency,
      classification.brandRelated ? 0.9 : 0.55,
      classification.reason,
      brandName,
      senderName || brandName,
      senderEmail,
      1,
      classification.threadStatus,
      gmailThreadId,
      JSON.stringify(detail),
      nowIso(),
      nowIso()
    );
    syncedCount += 1;
  }

  insertMaraSyncJob(userId, "gmail", "gmail_inbox_sync", `Synced ${syncedCount} Gmail message${syncedCount === 1 ? "" : "s"} into Mara's inbox view.`);
  const campaignSync = syncInboxThreadsToCampaigns(userId, workerSlug);
  const briefParse = await parseUnparsedInboxThreads(db, userId, workerSlug, { fetchImpl: fetch });
  const operationalSync = syncMaraOperationalRecords(userId, workerSlug);
  return {
    briefParseCount: briefParse.parsedCount,
    campaignSyncCount: campaignSync.syncedCount,
    syncedCount,
    ...operationalSync
  };
}

function extractDraftBrandLabel(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (!text) continue;
    const directMatch = text.match(/\bfor ([A-Z0-9][A-Za-z0-9&.' -]{1,80})$/);
    if (directMatch?.[1]) return directMatch[1].trim();
    const ideaMatch = text.match(/\b(?:reply to|pitch for|follow[- ]up for)\s+([A-Z0-9][A-Za-z0-9&.' -]{1,80})/i);
    if (ideaMatch?.[1]) return ideaMatch[1].trim();
  }
  return "";
}

function normalizePlaceholderText(value, replacements = {}) {
  let next = String(value ?? "");
  for (const [key, replacement] of Object.entries(replacements)) {
    next = next.replace(new RegExp(`\\[${key}\\]`, "g"), String(replacement ?? ""));
  }
  return next
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function buildGmailRawMessage({ body, subject, to }) {
  const headers = [
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit"
  ];
  if (to) headers.push(`To: ${to}`);
  headers.push(`Subject: ${subject || "(no subject)"}`);
  return Buffer.from(`${headers.join("\r\n")}\r\n\r\n${String(body ?? "").trim()}\r\n`, "utf8").toString("base64url");
}

function findBestDraftContact(userId, workerSlug, brandLabel = "") {
  const normalizedBrand = String(brandLabel ?? "").trim().toLowerCase();
  if (normalizedBrand) {
    const campaignMatch = db.prepare(
      `SELECT brand_name AS brandName, contact_email AS contactEmail, contact_name AS contactName, campaign_name AS subject
       FROM office_campaigns
       WHERE user_id = ? AND worker_slug = ? AND lower(brand_name) = lower(?)
         AND contact_email <> ''
       ORDER BY updated_at DESC
       LIMIT 1`
    ).get(userId, workerSlug, brandLabel);
    if (campaignMatch) return campaignMatch;

    const threadMatch = db.prepare(
      `SELECT brand_name AS brandName, contact_email AS contactEmail, contact_name AS contactName, subject
       FROM office_email_threads
       WHERE user_id = ? AND worker_slug = ? AND contact_email <> ''
         AND (lower(brand_name) = ? OR lower(subject) LIKE ?)
       ORDER BY received_at DESC
       LIMIT 1`
    ).get(userId, workerSlug, normalizedBrand, `%${normalizedBrand}%`);
    if (threadMatch) return threadMatch;
  }

  return db.prepare(
    `SELECT brand_name AS brandName, contact_email AS contactEmail, contact_name AS contactName, subject
     FROM office_email_threads
     WHERE user_id = ? AND worker_slug = ? AND contact_email <> '' AND brand_related = 1
     ORDER BY received_at DESC
     LIMIT 1`
  ).get(userId, workerSlug);
}

function buildDraftSpecsFromOutput(outputRow) {
  const structured = outputRow.structuredContent ?? {};
  const brandLabel = extractDraftBrandLabel(
    structured.brandName,
    outputRow.title,
    outputRow.taskTitle,
    outputRow.taskDescription
  );
  const contact = findBestDraftContact(outputRow.userId, outputRow.workerId, brandLabel);
  const resolvedBrand = brandLabel || String(contact?.brandName ?? "Brand").trim();
  const replacements = {
    Brand: resolvedBrand,
    "Your name": outputRow.userName || "Your name"
  };
  const drafts = [];

  if (outputRow.outputType === "pitch_template" || outputRow.outputType === "pitch_draft") {
    drafts.push({
      body: normalizePlaceholderText(structured.emailPitch || outputRow.content, replacements),
      subject: normalizePlaceholderText(
        Array.isArray(structured.subjectLineOptions) ? structured.subjectLineOptions[0] : `UGC idea for ${resolvedBrand}`,
        replacements
      ),
      title: outputRow.outputType === "pitch_draft" ? `Personalized pitch draft for ${resolvedBrand}` : `Pitch template draft for ${resolvedBrand}`,
      to: String(contact?.contactEmail ?? "").trim()
    });
  }

  if (outputRow.outputType === "reply_draft") {
    drafts.push({
      body: normalizePlaceholderText(structured.replyDraft || outputRow.content, replacements),
      subject: String(contact?.subject ?? "").trim() ? `Re: ${String(contact.subject).trim()}` : `Reply for ${resolvedBrand}`,
      title: `Brand reply draft for ${resolvedBrand}`,
      to: String(contact?.contactEmail ?? "").trim()
    });
  }

  if (outputRow.outputType === "follow_up_sequence") {
    const followUps = [
      ["Follow-up 1", structured.followUp1],
      ["Follow-up 2", structured.followUp2],
      ["Final close-the-loop", structured.finalCloseLoop]
    ].filter(([, body]) => String(body ?? "").trim());

    for (const [label, body] of followUps) {
      drafts.push({
        body: normalizePlaceholderText(body, replacements),
        subject: `${label} for ${resolvedBrand}`,
        title: `${label} draft for ${resolvedBrand}`,
        to: String(contact?.contactEmail ?? "").trim()
      });
    }
  }

  return drafts;
}

/**
 * Send a previously created Gmail draft. This is the only place the platform
 * ever sends email on a user's behalf, and it only runs after an explicit
 * human approval of a specific draft.
 */
async function sendGmailDraft(userId, workerSlug, draftId) {
  const { accessToken } = await getFreshGoogleAccessToken(userId, workerSlug, "gmail");
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ id: draftId })
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Gmail send failed with status ${response.status}: ${payload.slice(0, 240)}`);
  }

  return response.json();
}

async function createGmailDraftForOutput(userId, workerSlug, spec) {
  const { accessToken } = await getFreshGoogleAccessToken(userId, workerSlug, "gmail");
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: {
        raw: buildGmailRawMessage(spec)
      }
    })
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Gmail draft creation failed with status ${response.status}: ${payload.slice(0, 240)}`);
  }

  const payload = await response.json();
  return {
    createdAt: nowIso(),
    gmailDraftId: String(payload.id ?? ""),
    gmailMessageId: String(payload.message?.id ?? ""),
    subject: spec.subject,
    title: spec.title,
    to: spec.to || ""
  };
}

async function syncMaraGmailDraftsForOutputs(userId, workerSlug, outputIds = []) {
  const gmail = getWorkerIntegration(userId, workerSlug, "gmail");
  if (!gmail || gmail.status !== "connected") {
    return { createdCount: 0, skipped: "gmail_not_connected" };
  }

  const rows = (outputIds.length > 0
    ? db.prepare(
        `SELECT o.id, o.user_id AS userId, o.worker_id AS workerId, o.task_id AS taskId, o.output_type AS outputType,
                o.title, o.content, o.structured_content_json AS structuredContentJson,
                t.title AS taskTitle, t.description AS taskDescription,
                u.name AS userName
         FROM worker_outputs o
         LEFT JOIN worker_tasks t ON t.id = o.task_id
         LEFT JOIN users u ON u.id = o.user_id
         WHERE o.user_id = ? AND o.worker_id = ? AND o.id IN (${outputIds.map(() => "?").join(",")})
         ORDER BY o.created_at DESC`
      ).all(userId, workerSlug, ...outputIds)
    : [])
    .map((row) => ({ ...row, structuredContent: parseJson(row.structuredContentJson, {}) }));

  let createdCount = 0;

  for (const row of rows) {
    if (!["pitch_template", "pitch_draft", "reply_draft", "follow_up_sequence"].includes(String(row.outputType))) {
      continue;
    }

    const existingDrafts = Array.isArray(row.structuredContent?.gmailDrafts) ? row.structuredContent.gmailDrafts : [];
    if (existingDrafts.length > 0) {
      continue;
    }

    const draftSpecs = buildDraftSpecsFromOutput(row);
    if (draftSpecs.length === 0) continue;

    const createdDrafts = [];
    for (const spec of draftSpecs) {
      const created = await createGmailDraftForOutput(userId, workerSlug, spec);
      createdDrafts.push(created);
    }

    const nextStructured = {
      ...row.structuredContent,
      gmailDrafts: createdDrafts
    };

    db.prepare(
      `UPDATE worker_outputs
       SET structured_content_json = ?, updated_at = ?
       WHERE id = ? AND user_id = ? AND worker_id = ?`
    ).run(JSON.stringify(nextStructured), nowIso(), row.id, userId, workerSlug);

    // The approve-and-send loop: drafts with a real recipient become a
    // one-click approval. Approving sends from the user's own Gmail.
    const permissions = getWorkerPermissions(db, userId, workerSlug);
    const sendableDrafts = createdDrafts.filter((draft) => String(draft.to ?? "").trim());
    if (sendableDrafts.length > 0 && permissions.canSendEmailsWithApproval) {
      createApprovalRequest(db, {
        actionType: "send_email",
        description: `Ready to go from your Gmail: ${sendableDrafts
          .map((draft) => `“${draft.subject}” → ${draft.to}`)
          .join("; ")}. Nothing sends until you approve.`,
        payload: {
          drafts: sendableDrafts.map((draft) => ({
            gmailDraftId: draft.gmailDraftId,
            subject: draft.subject,
            title: draft.title,
            to: draft.to
          })),
          outputId: row.id
        },
        title: `Send: ${sendableDrafts[0].subject}`.slice(0, 140),
        userId,
        workerId: workerSlug
      });
    }

    createWorkerActivityLog(db, {
      description: `Saved ${createdDrafts.length} Gmail draft${createdDrafts.length === 1 ? "" : "s"} from ${row.title}.`,
      eventType: "gmail_draft_created",
      metadata: { draftCount: createdDrafts.length, outputId: row.id },
      relatedTaskId: row.taskId ?? null,
      title: row.title,
      userId,
      workerId: workerSlug
    });

    createdCount += createdDrafts.length;
  }

  return { createdCount };
}

function insertMaraSyncJob(userId, provider, jobName, summary, status = "completed") {
  db.prepare(
    `INSERT INTO office_sync_jobs (id, user_id, worker_slug, job_name, provider, status, summary, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), userId, MARA_SLUG, jobName, provider, status, summary, nowIso(), nowIso());
}

/**
 * Earlier builds seeded fictional demo data (SageHaus, Glow Theory, Kinfield
 * threads, tasks, events, approvals) into real user offices. Scrub every
 * trace at startup so no fabricated work ever appears again. Idempotent.
 */
function purgeLegacyDemoData() {
  const fakeBrands = ["SageHaus", "Glow Theory", "Kinfield"];
  const brandList = fakeBrands.map(() => "?").join(", ");
  const likeClauses = fakeBrands.map(() => "title LIKE ?").join(" OR ");
  const likeParams = fakeBrands.map((brand) => `%${brand}%`);

  const statements = [
    [`DELETE FROM office_email_threads WHERE brand_name IN (${brandList})`, fakeBrands],
    [`DELETE FROM office_campaigns WHERE brand_name IN (${brandList})`, fakeBrands],
    [`DELETE FROM office_leads WHERE brand_name IN (${brandList})`, fakeBrands],
    [`DELETE FROM office_custom_tasks WHERE ${likeClauses}`, likeParams],
    [`DELETE FROM office_calendar_events WHERE ${likeClauses}`, likeParams],
    [`DELETE FROM office_suggested_actions WHERE ${likeClauses}`, likeParams],
    [`DELETE FROM office_brand_opportunities WHERE ${likeClauses.replace(/title/g, "brand_name")}`, likeParams],
    [`DELETE FROM office_assignments WHERE ${likeClauses}`, likeParams],
    [`DELETE FROM office_deliverables WHERE ${likeClauses}`, likeParams],
    [
      "DELETE FROM office_activity_logs WHERE result IN (?, ?, ?, ?)",
      [
        "Glow Theory and Kinfield campaigns organized",
        "3 suggested actions waiting on you",
        "5 aligned brands added to today's list",
        "Prepared Mara's daily brief from email, campaigns, and brand signals."
      ]
    ]
  ];

  let purged = 0;
  for (const [sql, params] of statements) {
    try {
      purged += db.prepare(sql).run(...params).changes;
    } catch {
      /* table may not exist in older databases */
    }
  }

  // Strip fabricated memory sections earlier builds invented ("Minimum
  // rate: $350", filming days, excluded categories the user never stated).
  try {
    const knowledgeRows = db.prepare("SELECT id, knowledge_json AS knowledgeJson FROM office_worker_knowledge").all();
    const fabricatedTitles = new Set(["Creator preferences", "Preferred niches", "Excluded categories"]);
    for (const row of knowledgeRows) {
      let sections;
      try {
        sections = JSON.parse(row.knowledgeJson);
      } catch {
        continue;
      }
      if (!Array.isArray(sections)) continue;
      const hasFabricatedFingerprint = sections.some(
        (section) => Array.isArray(section?.items) && section.items.some((item) => String(item).startsWith("Minimum rate: $350"))
      );
      if (!hasFabricatedFingerprint) continue;
      const cleaned = sections.filter((section) => !fabricatedTitles.has(String(section?.title ?? "")));
      db.prepare("UPDATE office_worker_knowledge SET knowledge_json = ?, updated_at = ? WHERE id = ?")
        .run(JSON.stringify(cleaned), nowIso(), row.id);
      purged += 1;
    }
  } catch {
    /* table may not exist */
  }

  if (purged > 0) {
    console.log(`Purged ${purged} legacy demo record(s).`);
  }
}
purgeLegacyDemoData();

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

function readMaraPrivateInsights(userId, workerId) {
  return loadUserTrendInsights({
    db,
    globalPath: privateInsightsPath,
    readAccountContext: getUserOnboardingRecord,
    readMaraOnboarding: readMaraOnboardingAnswers,
    readWorkerKnowledge: readWorkerKnowledgeSections,
    storageRoot: resolveStorageRoot(),
    userId,
    workerId
  });
}

function buildMaraExecutionReaders() {
  return {
    readAccountContext: getUserOnboardingRecord,
    readConnectedIntegrations: readWorkerIntegrationMetadata,
    readMaraOnboarding: readMaraOnboardingAnswers,
    readMessages: readWorkerRecentMessages,
    readPrivateInsights: readMaraPrivateInsights,
    readWorkerKnowledge: readWorkerKnowledgeSections
  };
}

async function runMaraFirstDayAutomation({ userId, workerSlug, answers, generatedSummary, normalizedKnowledge }) {
  if (isMaraAutonomyPausedForUser(userId)) {
    return {
      summary: { paused: true, reason: "admin_account" },
      workspace: buildMaraWorkspace(db, userId, workerSlug, {
        readKnowledgeSections: readWorkerKnowledgeSections,
        readOfficeOverlays: readOfficeOverlaysForUser
      })
    };
  }

  const accountContext = getUserOnboardingRecord(userId);
  const initialPlan = buildMaraInitialWorkPlan({
    accountContext,
    maraAnswers: answers
  });
  const mergedKnowledge = [...initialPlan.memoryEntries, ...normalizedKnowledge];
  replaceWorkerKnowledge(userId, workerSlug, mergedKnowledge);
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
      userId,
      workerId: workerSlug
    });
    if (created.id) {
      if (!created.duplicate) {
        createdTaskIds.push(created.id);
      } else {
        const existingTask = listWorkerTasksForUserWorker(db, userId, workerSlug).find((entry) => entry.id === created.id);
        if (existingTask && ["approved", "in_progress"].includes(existingTask.status)) {
          createdTaskIds.push(created.id);
        }
      }
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
      userId,
      workerId: workerSlug
    });
  }

  const starterResults = await autoExecuteSafeMaraTasks({
    db,
    taskIds: createdTaskIds,
    userId,
    workerId: workerSlug,
    ...buildMaraExecutionReaders()
  });
  const starterOutputIds = starterResults.map((result) => result?.output?.id).filter(Boolean);
  if (starterOutputIds.length > 0) {
    await syncMaraGmailDraftsForOutputs(userId, workerSlug, starterOutputIds);
  }

  const summary = await runMaraAutonomyCycle({
    db,
    mode: "interactive",
    userId,
    workerId: workerSlug,
    ...buildMaraExecutionReaders()
  });
  syncMaraOperationalRecords(userId, workerSlug);
  const outputIds = Array.isArray(summary?.outputs) ? summary.outputs.map((output) => output?.id).filter(Boolean) : [];
  if (outputIds.length > 0) {
    await syncMaraGmailDraftsForOutputs(userId, workerSlug, outputIds);
  }

  return {
    summary,
    workspace: buildMaraWorkspace(db, userId, workerSlug, {
      readKnowledgeSections: readWorkerKnowledgeSections,
      readOfficeOverlays: readOfficeOverlaysForUser
    })
  };
}

const DIGEST_INTERVAL_DAYS = Number.parseInt(process.env.DIGEST_INTERVAL_DAYS ?? "7", 10);

/**
 * Weekly digest: what the team shipped, what's waiting on the manager.
 * The single most reliable reason to come back to the office.
 */
async function sendWeeklyDigests() {
  if (DIGEST_INTERVAL_DAYS <= 0) return;
  const threshold = new Date(Date.now() - DIGEST_INTERVAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const users = db.prepare(
    `SELECT DISTINCT u.id, u.email, u.name
     FROM users u
     INNER JOIN hired_workers hw ON hw.user_id = u.id AND hw.status = 'active'
     LEFT JOIN user_digest_log dl ON dl.user_id = u.id
     WHERE u.email_verified_at IS NOT NULL AND (dl.last_sent_at IS NULL OR dl.last_sent_at <= ?)`
  ).all(threshold);

  for (const user of users) {
    try {
      const outputs = db.prepare(
        `SELECT title, output_type AS outputType, worker_id AS workerId, created_at AS createdAt
         FROM worker_outputs
         WHERE user_id = ? AND created_at >= ?
         ORDER BY created_at DESC
         LIMIT 12`
      ).all(user.id, threshold);
      const approvals = db.prepare(
        `SELECT title FROM worker_approval_requests WHERE user_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 8`
      ).all(user.id);
      const completedTasks = db.prepare(
        `SELECT COUNT(*) AS count FROM worker_tasks WHERE user_id = ? AND status = 'completed' AND updated_at >= ?`
      ).get(user.id, threshold);

      // Nothing shipped and nothing waiting — stay silent rather than spam.
      if (outputs.length === 0 && approvals.length === 0) {
        continue;
      }

      const firstName = String(user.name ?? "").split(" ")[0] || "there";
      const shippedLines = outputs.slice(0, 8).map((output) => `• ${output.title}`);
      const approvalLines = approvals.map((approval) => `• ${approval.title}`);
      const textParts = [
        `Hi ${firstName},`,
        "",
        `Here's what your Ryva team got done over the last ${DIGEST_INTERVAL_DAYS} days:`,
        "",
        outputs.length > 0 ? `Shipped (${outputs.length} deliverable${outputs.length === 1 ? "" : "s"}, ${Number(completedTasks?.count ?? 0)} tasks closed):\n${shippedLines.join("\n")}` : "",
        approvals.length > 0 ? `\nWaiting on you (${approvals.length}):\n${approvalLines.join("\n")}` : "",
        "",
        `Open your office: ${appUrl}/#app/office/today`
      ].filter((part) => part !== "");
      const text = textParts.join("\n");
      const html = textParts
        .map((part) => `<p style="margin:0 0 12px;white-space:pre-line;font-family:Georgia,serif;color:#191713;">${part.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`)
        .join("");

      await sendTransactionalEmail({
        html,
        subject:
          approvals.length > 0
            ? `Your team shipped ${outputs.length} deliverable${outputs.length === 1 ? "" : "s"} — ${approvals.length} thing${approvals.length === 1 ? "" : "s"} need${approvals.length === 1 ? "s" : ""} you`
            : `Your team shipped ${outputs.length} deliverable${outputs.length === 1 ? "" : "s"} this week`,
        text,
        to: user.email
      });

      db.prepare(
        `INSERT INTO user_digest_log (user_id, last_sent_at) VALUES (?, ?)
         ON CONFLICT(user_id) DO UPDATE SET last_sent_at = excluded.last_sent_at`
      ).run(user.id, nowIso());
    } catch (error) {
      console.error(`Digest failed for ${user.id}:`, error);
    }
  }
}

async function runScheduledMaraAutonomy() {
  if (maraAutonomyRunning) return;
  maraAutonomyRunning = true;
  try {
    const workersToRun = db.prepare(
      `SELECT DISTINCT hw.user_id AS userId, hw.worker_slug AS workerSlug
       FROM hired_workers hw
       INNER JOIN office_onboarding_sessions os
         ON os.user_id = hw.user_id AND os.worker_slug = hw.worker_slug
       WHERE hw.status = 'active' AND hw.paused = 0 AND os.status = 'completed'`
    ).all();

    for (const row of workersToRun) {
      if (!hasRoleConfig(row.workerSlug)) continue;
      try {
        if (row.workerSlug === MARA_SLUG) {
          if (isMaraAutonomyPausedForUser(row.userId)) continue;
          const gmail = getWorkerIntegration(row.userId, row.workerSlug, "gmail");
          if (gmail?.status === "connected") {
            await syncGmailInbox(row.userId, row.workerSlug);
          }
          // Full mode: the scheduled loop is exactly where the heavy
          // autonomous work (research, inbox organization) should happen.
          const summary = await runMaraAutonomyCycle({
            db,
            mode: "full",
            userId: row.userId,
            workerId: row.workerSlug,
            ...buildMaraExecutionReaders()
          });
          syncMaraOperationalRecords(row.userId, row.workerSlug);
          const outputIds = Array.isArray(summary?.outputs) ? summary.outputs.map((output) => output?.id).filter(Boolean) : [];
          if (outputIds.length > 0) {
            await syncMaraGmailDraftsForOutputs(row.userId, row.workerSlug, outputIds);
          }
        } else {
          await runAgentAutonomyCycle({
            db,
            userId: row.userId,
            workerId: row.workerSlug,
            readers: buildMaraExecutionReaders()
          });
          syncOfficeCanonicalRecords(row.userId, row.workerSlug);
        }
      } catch (error) {
        console.error(`Scheduled autonomy failed for ${row.userId}/${row.workerSlug}:`, error);
      }
    }
  } finally {
    maraAutonomyRunning = false;
  }
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

function getGmailConnectRedirectUri() {
  return `${appUrl}/api/office/workers/${MARA_SLUG}/gmail/callback`;
}

function encodeGoogleStatePayload(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeGoogleStatePayload(value) {
  try {
    return JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function buildGoogleAuthorizationUrl({ accessType = null, prompt = "select_account", redirectUri, scope, state }) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!isGoogleAuthConfigured() || !clientId) {
    throw new Error("Google auth is not configured.");
  }
  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", scope);
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("prompt", prompt);
  if (accessType) authorizationUrl.searchParams.set("access_type", accessType);
  return authorizationUrl;
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

async function refreshGoogleAccessToken(refreshToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google refresh configuration is incomplete.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });

  if (!response.ok) {
    throw new Error(`Google token refresh failed with status ${response.status}.`);
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

  if (!hasRoleConfig(workerSlug)) {
    res.status(400).json({ error: "This worker cannot run internal task execution from office yet." });
    return;
  }

  try {
    let result;
    if (isMaraWorker(workerSlug)) {
      result = await runWorkerTask(db, req.user.id, workerSlug, taskId, {
        db,
        ...buildMaraExecutionReaders()
      });
      syncMaraOperationalRecords(req.user.id, workerSlug);
      if (result?.output?.id) {
        await syncMaraGmailDraftsForOutputs(req.user.id, workerSlug, [result.output.id]);
      }
    } else {
      result = await runAgentTask({
        db,
        userId: req.user.id,
        workerId: workerSlug,
        taskId,
        readers: buildMaraExecutionReaders()
      });
      syncOfficeCanonicalRecords(req.user.id, workerSlug);
    }
    res.json({
      ok: true,
      ...result,
      workspace: buildMaraWorkspace(db, req.user.id, workerSlug, {
        readKnowledgeSections: readWorkerKnowledgeSections,
        readOfficeOverlays: readOfficeOverlaysForUser
      })
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not run worker task." });
  }
});

app.post("/api/workers/mara/tasks/:taskId/run", assertOrigin, requireAuth, async (req, res) => {
  const taskId = String(req.params.taskId ?? "").trim();

  try {
    const result = await runMaraTask({
      db,
      taskId,
      userId: req.user.id,
      workerId: MARA_SLUG,
      ...buildMaraExecutionReaders()
    });
    syncMaraOperationalRecords(req.user.id, MARA_SLUG);
    if (result?.output?.id) {
      await syncMaraGmailDraftsForOutputs(req.user.id, MARA_SLUG, [result.output.id]);
    }
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

  if (!hasRoleConfig(workerSlug)) {
    res.status(400).json({ error: "Structured worker approvals are not available for this worker yet." });
    return;
  }

  try {
    const approvalRow = db
      .prepare(
        `SELECT action_type AS actionType, payload_json AS payloadJson, title
         FROM worker_approval_requests
         WHERE id = ? AND user_id = ? AND worker_id = ?`
      )
      .get(approvalId, req.user.id, workerSlug);

    const result = await updateApprovalRequestStatus(
      db,
      req.user.id,
      workerSlug,
      approvalId,
      status,
      isMaraWorker(workerSlug) && status === "approved" ? buildMaraExecutionReaders() : null
    );

    // Approve-and-send: an approved send_email request actually sends the
    // Gmail drafts. If sending fails, the approval reopens for retry.
    let emailsSent = 0;
    if (status === "approved" && approvalRow?.actionType === "send_email") {
      const payload = parseJson(approvalRow.payloadJson, {});
      const draftsToSend = (Array.isArray(payload.drafts) ? payload.drafts : []).filter((draft) => draft?.gmailDraftId);
      try {
        for (const draft of draftsToSend) {
          await sendGmailDraft(req.user.id, workerSlug, String(draft.gmailDraftId));
          emailsSent += 1;
          createWorkerActivityLog(db, {
            description: `Sent “${draft.subject}” to ${draft.to} from your Gmail after your approval.`,
            eventType: "email_sent",
            metadata: { outputId: payload.outputId ?? null, subject: draft.subject, to: draft.to },
            title: `Sent: ${draft.subject}`.slice(0, 140),
            userId: req.user.id,
            workerId: workerSlug
          });
        }
        if (emailsSent > 0 && payload.outputId) {
          const outputRow = db
            .prepare("SELECT structured_content_json AS structuredContentJson FROM worker_outputs WHERE id = ? AND user_id = ? AND worker_id = ?")
            .get(payload.outputId, req.user.id, workerSlug);
          if (outputRow) {
            const structured = parseJson(outputRow.structuredContentJson, {});
            structured.sentAt = nowIso();
            structured.sentCount = emailsSent;
            db.prepare("UPDATE worker_outputs SET structured_content_json = ?, updated_at = ? WHERE id = ? AND user_id = ? AND worker_id = ?")
              .run(JSON.stringify(structured), nowIso(), payload.outputId, req.user.id, workerSlug);
          }
        }
      } catch (error) {
        db.prepare(
          `UPDATE worker_approval_requests SET status = 'pending', updated_at = ? WHERE id = ? AND user_id = ? AND worker_id = ?`
        ).run(nowIso(), approvalId, req.user.id, workerSlug);
        res.status(502).json({
          error: `The email did not send (${error instanceof Error ? error.message.slice(0, 120) : "Gmail error"}). The approval is back in your queue — nothing went out twice.`
        });
        return;
      }
    }

    if (isMaraWorker(workerSlug)) {
      syncMaraOperationalRecords(req.user.id, workerSlug);
    } else {
      syncOfficeCanonicalRecords(req.user.id, workerSlug);
    }
    const outputIds = Array.isArray(result.followThrough?.results)
      ? result.followThrough.results.map((entry) => entry.outputId).filter(Boolean)
      : [];
    if (outputIds.length > 0) {
      await syncMaraGmailDraftsForOutputs(req.user.id, workerSlug, outputIds);
    }
    res.json({
      ...result,
      emailsSent,
      workspace: buildMaraWorkspace(db, req.user.id, workerSlug, {
        readKnowledgeSections: readWorkerKnowledgeSections,
        readOfficeOverlays: readOfficeOverlaysForUser
      })
    });
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

  if (provider === "outlook") {
    res.status(501).json({ error: "Outlook is not wired yet. Use Gmail for the first live inbox integration." });
    return;
  }

  res.json({
    ok: true,
    redirectUrl: `/api/office/workers/${workerSlug}/connect-email/google`
  });
});

app.post("/api/office/workers/:slug/autonomy/run", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug ?? "").trim();

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!hasRoleConfig(workerSlug)) {
    res.status(400).json({ error: "This worker does not support autonomy runs yet." });
    return;
  }

  if (isWorkerPaused(req.user.id, workerSlug)) {
    res.status(409).json({ error: "This worker is paused. Resume them from their desk to run work." });
    return;
  }

  try {
    let summary;
    if (isMaraWorker(workerSlug)) {
      if (isMaraAutonomyPausedForUser(req.user)) {
        res.json({
          ok: true,
          paused: true,
          summary: { paused: true, reason: "admin_account" },
          workspace: buildMaraWorkspace(db, req.user.id, workerSlug, {
            readKnowledgeSections: readWorkerKnowledgeSections,
            readOfficeOverlays: readOfficeOverlaysForUser
          })
        });
        return;
      }
      // Fast interactive pass now; heavy work (research, inbox) continues in
      // the background so the request stays responsive.
      summary = await runMaraAutonomyCycle({
        db,
        mode: "interactive",
        userId: req.user.id,
        workerId: workerSlug,
        ...buildMaraExecutionReaders()
      });
      syncMaraOperationalRecords(req.user.id, workerSlug);
      void runMaraAutonomyCycle({
        db,
        mode: "full",
        userId: req.user.id,
        workerId: workerSlug,
        ...buildMaraExecutionReaders()
      })
        .then(() => syncMaraOperationalRecords(req.user.id, workerSlug))
        .catch((error) => console.error("Background full autonomy run failed:", error));
    } else {
      summary = await runAgentAutonomyCycle({
        db,
        userId: req.user.id,
        workerId: workerSlug,
        readers: buildMaraExecutionReaders()
      });
      syncOfficeCanonicalRecords(req.user.id, workerSlug);
    }
    const workspace = buildMaraWorkspace(db, req.user.id, workerSlug, {
      readKnowledgeSections: readWorkerKnowledgeSections,
      readOfficeOverlays: readOfficeOverlaysForUser
    });
    const outputIds = Array.isArray(summary?.outputs) ? summary.outputs.map((output) => output?.id).filter(Boolean) : [];
    res.json({
      ok: true,
      summary,
      workspace
    });
    if (isMaraWorker(workerSlug) && outputIds.length > 0) {
      void syncMaraGmailDraftsForOutputs(req.user.id, workerSlug, outputIds).catch((error) => {
        console.error("Mara Gmail draft sync failed after autonomy run:", error);
      });
    }
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not run worker autonomy." });
  }
});

app.post("/api/office/workers/:slug/pause", assertOrigin, requireAuth, (req, res) => {
  const workerSlug = String(req.params.slug ?? "").trim();
  const paused = Boolean(req.body?.paused);

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  db.prepare("UPDATE hired_workers SET paused = ? WHERE user_id = ? AND worker_slug = ? AND status = 'active'")
    .run(paused ? 1 : 0, req.user.id, workerSlug);

  db.prepare(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    req.user.id,
    workerSlug,
    paused ? "Paused autonomous work." : "Resumed autonomous work.",
    "People",
    paused ? "No background work or AI usage until resumed" : "Back on the clock",
    nowIso()
  );

  res.json({ ok: true, paused });
});

/**
 * Manual weekly TikTok trend intake: the manager pastes trend notes, Mara
 * parses them into a structured snapshot and immediately produces a fresh
 * hashtag-and-content-gap brief from it.
 */
app.post("/api/office/workers/:slug/trends/manual", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug ?? "").trim();
  const text = String(req.body?.text ?? "").trim();

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }
  if (!isMaraWorker(workerSlug)) {
    res.status(400).json({ error: "Trend intake is only available for Mara right now." });
    return;
  }
  if (text.length < 10) {
    res.status(400).json({ error: "Paste this week's trend notes — hashtags, view counts, anything you have." });
    return;
  }

  try {
    const accountContext = getUserOnboardingRecord(req.user.id);
    const niche = String(accountContext?.whatYouDo ?? "").trim();
    let parsed = await tryParseTrendPaste({ db, userId: req.user.id, text, niche });
    let parsedBy = "llm";
    if (!parsed) {
      parsed = parseTrendPasteHeuristic(text);
      parsedBy = "heuristic";
    }
    if ((parsed.hashtags?.length ?? 0) === 0 && (parsed.contentGaps?.length ?? 0) === 0) {
      res.status(400).json({ error: "I couldn't find hashtags or content gaps in that paste. Include lines like '#glowyskin — 2.1M views'." });
      return;
    }

    const insights = {
      contentGaps: (parsed.contentGaps ?? []).map((gap) => ({ label: gap.label, note: gap.note ?? "" })),
      hashtags: parsed.hashtags ?? [],
      insights: [],
      loginWallEncountered: false,
      matchedToNiche: true,
      niche: niche || "creator content",
      notes: parsed.notes ?? [],
      periodDays: 7,
      region: parsed.region || "US",
      source: "manual_paste",
      sourceUrl: "",
      updatedAt: nowIso()
    };

    saveUserTrendSnapshot(db, { insights, userId: req.user.id, workerId: workerSlug });
    await writeUserTrendInsightsFile(resolveStorageRoot(), req.user.id, insights).catch(() => undefined);

    // Fresh data deserves a fresh brief: run the trend pulse right away.
    const created = createApprovedTaskIfPermissionAllows(db, {
      description: "Turn this week's pasted TikTok trend data into a hashtag plan mapped to content gaps.",
      priority: "high",
      requiredPermissions: [],
      source: "autonomy_tiktok_trends",
      status: "approved",
      taskType: "tiktok_trend_pulse",
      title: `TikTok hashtag plan — week of ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      userId: req.user.id,
      workerId: workerSlug
    });
    let output = null;
    if (created?.id) {
      const result = await runMaraTask({ db, taskId: created.id, userId: req.user.id, workerId: workerSlug, ...buildMaraExecutionReaders() });
      output = result?.output ?? null;
    }
    syncMaraOperationalRecords(req.user.id, workerSlug);

    res.json({
      ok: true,
      parsedBy,
      hashtagCount: insights.hashtags.length,
      gapCount: insights.contentGaps.length,
      outputTitle: output?.title ?? null,
      workspace: buildMaraWorkspace(db, req.user.id, workerSlug, {
        readKnowledgeSections: readWorkerKnowledgeSections,
        readOfficeOverlays: readOfficeOverlaysForUser
      })
    });
  } catch (error) {
    console.error("Trend intake failed:", error);
    res.status(500).json({ error: "I couldn't process that trend paste. Try again." });
  }
});

app.post("/api/office/workers/:slug/sync-trends", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug ?? "").trim();

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!isMaraWorker(workerSlug)) {
    res.status(400).json({ error: "Trend sync is only available for Mara." });
    return;
  }

  if (isMaraAutonomyPausedForUser(req.user)) {
    res.json({
      dashboard: getMaraDashboard(req.user.id),
      ok: true,
      paused: true,
      synced: false
    });
    return;
  }

  try {
    const syncResult = syncUserTrendInsightsFromGlobal({
      db,
      globalPath: privateInsightsPath,
      readAccountContext: getUserOnboardingRecord,
      readMaraOnboarding: readMaraOnboardingAnswers,
      readWorkerKnowledge: readWorkerKnowledgeSections,
      storageRoot: resolveStorageRoot(),
      userId: req.user.id,
      workerId: workerSlug
    });
    syncMaraOperationalRecords(req.user.id, workerSlug);
    res.json({
      dashboard: getMaraDashboard(req.user.id),
      insights: syncResult.insights ?? null,
      niche: syncResult.niche ?? null,
      ok: true,
      synced: Boolean(syncResult.synced)
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not sync TikTok trends." });
  }
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

  if (isMaraAutonomyPausedForUser(req.user)) {
    res.json({ dashboard: getMaraDashboard(req.user.id), ok: true, paused: true });
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

  try {
    const syncResult = await syncGmailInbox(req.user.id, workerSlug);
    const summary = await runMaraAutonomyCycle({
      db,
      userId: req.user.id,
      workerId: workerSlug,
      ...buildMaraExecutionReaders()
    });
    syncMaraOperationalRecords(req.user.id, workerSlug);
    const outputIds = Array.isArray(summary?.outputs) ? summary.outputs.map((output) => output?.id).filter(Boolean) : [];
    if (outputIds.length > 0) {
      await syncMaraGmailDraftsForOutputs(req.user.id, workerSlug, outputIds);
    }
    insertMaraSyncJob(req.user.id, "gmail", "generate_daily_mara_brief", `Mara synced ${syncResult.syncedCount} Gmail message${syncResult.syncedCount === 1 ? "" : "s"} and refreshed her working brief.`);
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Could not sync Gmail right now." });
    return;
  }

  db.prepare(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    req.user.id,
    MARA_SLUG,
    "Requested inbox scan.",
    "Mara",
    "Connected Gmail inbox synced for real campaign and thread ingestion",
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
  try {
    ensureOfficeSchema();
    const workerRows = db
      .prepare(
        `SELECT worker_slug AS workerSlug
         FROM hired_workers
         WHERE user_id = ? AND status = 'active'`
      )
      .all(req.user.id);

    for (const row of workerRows) {
      syncOfficeCanonicalRecords(req.user.id, row.workerSlug);
    }

    res.json(readOfficeOverlaysForUser(req.user.id));
  } catch (error) {
    console.error("Office overlays load failed:", error);
    res.status(500).json({ error: "The office could not finish loading right now." });
  }
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

app.get("/api/office/deliverables/:deliverableId", requireAuth, (req, res) => {
  const deliverableId = String(req.params.deliverableId ?? "").trim();
  const deliverable = db
    .prepare(
      `SELECT id, worker_slug AS workerSlug, source_type AS sourceType, source_id AS sourceId, title, summary,
              deliverable_type AS deliverableType, preview_text AS previewText, content_ref_id AS contentRefId
       FROM office_deliverables
       WHERE id = ? AND user_id = ?`
    )
    .get(deliverableId, req.user.id);

  if (!deliverable) {
    res.status(404).json({ error: "Deliverable not found." });
    return;
  }

  const worker = WORKERS.find((entry) => entry.slug === deliverable.workerSlug);

  if (deliverable.sourceType === "worker_output" || deliverable.contentRefId || deliverable.sourceId) {
    // Resolve the full output through a fallback chain so the reader never
    // silently degrades to a truncated summary: ref id → source id → title.
    const outputQuery = `SELECT output_type AS outputType, title, content, structured_content_json AS structuredContentJson
       FROM worker_outputs
       WHERE id = ? AND user_id = ? AND worker_id = ?`;
    let output = deliverable.contentRefId
      ? db.prepare(outputQuery).get(deliverable.contentRefId, req.user.id, deliverable.workerSlug)
      : null;
    if (!output && deliverable.sourceId && deliverable.sourceId !== deliverable.contentRefId) {
      output = db.prepare(outputQuery).get(deliverable.sourceId, req.user.id, deliverable.workerSlug);
    }
    if (!output) {
      output = db
        .prepare(
          `SELECT output_type AS outputType, title, content, structured_content_json AS structuredContentJson
           FROM worker_outputs
           WHERE user_id = ? AND worker_id = ? AND title = ?
           ORDER BY created_at DESC
           LIMIT 1`
        )
        .get(req.user.id, deliverable.workerSlug, deliverable.title);
    }

    if (output) {
      res.json({
        deliverable: {
          content: String(output.content ?? ""),
          previewText: deliverable.previewText,
          structuredContent: parseJson(output.structuredContentJson, null),
          summary: deliverable.summary,
          title: output.title || deliverable.title,
          type: sentenceCase(String(output.outputType ?? deliverable.deliverableType).replace(/_/g, " ")),
          workerName: worker?.name ?? "Worker"
        }
      });
      return;
    }
  }

  if (deliverable.sourceType === "uploaded_file" && deliverable.contentRefId) {
    res.json({
      deliverable: {
        content: "",
        downloadUrl: `/api/office/files/${deliverable.contentRefId}/download`,
        previewText: deliverable.previewText,
        summary: deliverable.summary,
        title: deliverable.title,
        type: sentenceCase(String(deliverable.deliverableType ?? "file").replace(/_/g, " ")),
        workerName: worker?.name ?? "Worker"
      }
    });
    return;
  }

  res.json({
    deliverable: {
      content: "",
      previewText: deliverable.previewText,
      summary: deliverable.summary,
      title: deliverable.title,
      type: sentenceCase(String(deliverable.deliverableType ?? "deliverable").replace(/_/g, " ")),
      workerName: worker?.name ?? "Worker"
    }
  });
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
  if (!isGoogleAuthConfigured()) {
    res.status(501).json({ error: "Google auth is not configured." });
    return;
  }

  const nonce = randomBytes(24).toString("hex");
  const statePayload = { kind: "auth_login", nonce };
  setGoogleStateCookie(res, encodeGoogleStatePayload(statePayload));
  const authorizationUrl = buildGoogleAuthorizationUrl({
    redirectUri: getGoogleRedirectUri(),
    scope: "openid email profile",
    state: nonce
  });

  res.redirect(authorizationUrl.toString());
});

app.get("/api/auth/google/callback", async (req, res) => {
  const code = String(req.query.code ?? "").trim();
  const state = String(req.query.state ?? "").trim();
  const cookieState = String(req.cookies[googleStateCookieName] ?? "").trim();
  const statePayload = decodeGoogleStatePayload(cookieState);

  clearGoogleStateCookie(res);

  if (!code || !state || !statePayload?.nonce || !safeEqualStrings(state, statePayload.nonce)) {
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

app.get("/api/office/workers/:slug/connect-email/google", requireAuth, (req, res) => {
  const workerSlug = String(req.params.slug ?? "").trim();

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!isMaraWorker(workerSlug)) {
    res.status(400).json({ error: "Gmail connection is only available for Mara right now." });
    return;
  }

  const nonce = randomBytes(24).toString("hex");
  const statePayload = {
    kind: "gmail_connect",
    nonce,
    provider: "gmail",
    userId: req.user.id,
    workerSlug
  };
  setGoogleStateCookie(res, encodeGoogleStatePayload(statePayload));
  const authorizationUrl = buildGoogleAuthorizationUrl({
    accessType: "offline",
    prompt: "consent",
    redirectUri: getGmailConnectRedirectUri(),
    scope: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.compose"
    ].join(" "),
    state: nonce
  });

  res.redirect(authorizationUrl.toString());
});

app.get("/api/office/workers/:slug/gmail/callback", async (req, res) => {
  const workerSlug = String(req.params.slug ?? "").trim();
  const code = String(req.query.code ?? "").trim();
  const state = String(req.query.state ?? "").trim();
  const cookieState = String(req.cookies[googleStateCookieName] ?? "").trim();
  const statePayload = decodeGoogleStatePayload(cookieState);

  clearGoogleStateCookie(res);

  if (
    !code ||
    !state ||
    !statePayload?.nonce ||
    statePayload.kind !== "gmail_connect" ||
    statePayload.provider !== "gmail" ||
    statePayload.workerSlug !== workerSlug ||
    !safeEqualStrings(state, statePayload.nonce)
  ) {
    res.redirect(`${appUrl}/?notice=gmail-connect-failed#app/office`);
    return;
  }

  if (!hasHiredWorker(statePayload.userId, workerSlug)) {
    res.redirect(`${appUrl}/?notice=gmail-connect-failed#app/office`);
    return;
  }

  try {
    const tokens = await exchangeGoogleCodeForTokens(code);
    const profile = await fetchGoogleProfile(String(tokens.access_token ?? ""));
    const gmailProfileResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: {
        Authorization: `Bearer ${String(tokens.access_token ?? "")}`
      }
    });
    const gmailProfile = gmailProfileResponse.ok ? await gmailProfileResponse.json() : {};
    const emailAddress = String(gmailProfile.emailAddress ?? profile.email ?? "").trim();
    const nextMetadata = {
      accessToken: String(tokens.access_token ?? ""),
      emailAddress,
      expiresAt: new Date(Date.now() + Number(tokens.expires_in ?? 3600) * 1000).toISOString(),
      refreshToken: String(tokens.refresh_token ?? "").trim()
    };
    upsertWorkerIntegration(statePayload.userId, workerSlug, "gmail", "connected", "Gmail inbox", nextMetadata);
    updateWorkerPermissions(db, statePayload.userId, workerSlug, {
      canDraftOutreach: true,
      canReadInbox: true,
      canSendEmailsWithApproval: true,
      canUseConnectedIntegrations: true
    });
    await syncGmailInbox(statePayload.userId, workerSlug);
    if (!isMaraAutonomyPausedForUser(statePayload.userId)) {
      const summary = await runMaraAutonomyCycle({
        db,
        userId: statePayload.userId,
        workerId: workerSlug,
        ...buildMaraExecutionReaders()
      });
      syncMaraOperationalRecords(statePayload.userId, workerSlug);
      const outputIds = Array.isArray(summary?.outputs) ? summary.outputs.map((output) => output?.id).filter(Boolean) : [];
      if (outputIds.length > 0) {
        await syncMaraGmailDraftsForOutputs(statePayload.userId, workerSlug, outputIds);
      }
    }
    res.redirect(`${appUrl}/?notice=gmail-connected#app/office/desk/${workerSlug}`);
  } catch (error) {
    console.error("Gmail connect failed:", error);
    res.redirect(`${appUrl}/?notice=gmail-connect-failed#app/office`);
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

app.post("/api/payments/portal", assertOrigin, requireAuth, async (req, res) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    res.status(501).json({ error: "Billing is not configured yet." });
    return;
  }

  const customerId = db.prepare("SELECT stripe_customer_id AS customerId FROM users WHERE id = ?").get(req.user.id)?.customerId;
  if (!customerId) {
    res.status(404).json({ error: "No billing account yet — you'll get one with your first paid hire." });
    return;
  }

  try {
    const stripe = new Stripe(stripeKey);
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/#app/office/settings`
    });
    res.json({ url: session.url });
  } catch (error) {
    console.error("Billing portal session failed:", error);
    res.status(502).json({ error: "Could not open the billing portal. Try again shortly." });
  }
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

      if (userId && session.customer) {
        db.prepare("UPDATE users SET stripe_customer_id = ? WHERE id = ?").run(String(session.customer), userId);
      }

      if (checkoutId && userId && workerSlug) {
        db.prepare(
          `INSERT INTO hired_workers (id, user_id, worker_slug, checkout_session_id, status, hired_at, stripe_subscription_id, billing_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, worker_slug) DO UPDATE SET
             checkout_session_id = excluded.checkout_session_id,
             status = excluded.status,
             hired_at = excluded.hired_at,
             stripe_subscription_id = excluded.stripe_subscription_id,
             billing_status = excluded.billing_status`
        ).run(randomUUID(), userId, workerSlug, checkoutId, "active", nowIso(), session.subscription ? String(session.subscription) : null, "active");
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      db.prepare(
        `UPDATE hired_workers
         SET status = 'terminated', billing_status = 'cancelled'
         WHERE stripe_subscription_id = ?`
      ).run(String(subscription.id));
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      const subscriptionId = invoice.subscription ? String(invoice.subscription) : null;
      if (subscriptionId) {
        db.prepare(
          `UPDATE hired_workers
           SET billing_status = 'past_due'
           WHERE stripe_subscription_id = ?`
        ).run(subscriptionId);
      }
    }

    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object;
      const subscriptionId = invoice.subscription ? String(invoice.subscription) : null;
      if (subscriptionId) {
        db.prepare(
          `UPDATE hired_workers
           SET billing_status = 'active'
           WHERE stripe_subscription_id = ? AND billing_status = 'past_due'`
        ).run(subscriptionId);
      }
    }

    res.json({ received: true });
  } catch (error) {
    res.status(400).send(error instanceof Error ? error.message : "Webhook verification failed.");
  }
});

function mergeChatMemories(userId, workerSlug, memories) {
  for (const memory of memories) {
    upsertWorkerKnowledge(userId, workerSlug, (knowledge) => {
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
}

function workerChatAuthor(worker, workerSlug) {
  if (workerSlug === MARA_SLUG) return "Mara";
  return worker?.name ? worker.name.split(" ")[0] : "Worker";
}

/**
 * Execute chat-created tasks off the request path, then post a follow-up
 * chat message with the results so the conversation stays honest and alive.
 */
function executeChatTasksInBackground(userId, workerSlug, worker, taskIds, triggerText) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) return;
  if (workerSlug === MARA_SLUG && isMaraAutonomyPausedForUser(userId)) return;
  void (async () => {
    try {
      const executedResults = [];
      if (workerSlug === MARA_SLUG) {
        const results = await autoExecuteSafeMaraTasks({
          db,
          taskIds,
          userId,
          workerId: workerSlug,
          ...buildMaraExecutionReaders()
        });
        executedResults.push(...results.filter(Boolean));
        const outputIds = executedResults.map((result) => result?.output?.id).filter(Boolean);
        if (outputIds.length > 0) {
          await syncMaraGmailDraftsForOutputs(userId, workerSlug, outputIds);
        }
        syncMaraOperationalRecords(userId, workerSlug);
      } else {
        for (const taskId of taskIds) {
          try {
            const result = await runAgentTask({
              db,
              userId,
              workerId: workerSlug,
              taskId,
              readers: buildMaraExecutionReaders()
            });
            if (result) executedResults.push(result);
          } catch (error) {
            console.error(`Background chat task failed for ${workerSlug}:`, error);
          }
        }
        syncOfficeCanonicalRecords(userId, workerSlug);
      }

      const completed = executedResults.filter((result) => result?.output?.content && !result.blockerReason);
      const blocked = executedResults.filter((result) => result?.blockerReason);
      const replyParts = [];
      for (const result of completed.slice(0, 2)) {
        replyParts.push(`${result.output.title}\n\n${result.output.content}`);
      }
      for (const blockedResult of blocked.slice(0, 1)) {
        replyParts.push(
          `I couldn't complete that yet.\n\nReason: ${blockedResult.blockerReason}\nNeed from you: ${blockedResult.neededFromUser}\nNext: ${blockedResult.suggestedNextStep}`
        );
      }
      if (completed.length > 2) {
        replyParts.push(`Plus ${completed.length - 2} more deliverable(s) waiting on your desk.`);
      }

      if (replyParts.length > 0) {
        db.prepare(
          `INSERT INTO office_chat_messages (id, user_id, worker_slug, author, text, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(randomUUID(), userId, workerSlug, workerChatAuthor(worker, workerSlug), replyParts.join("\n\n"), nowIso());
      }

      for (const result of executedResults) {
        if (result?.task?.id) {
          createWorkerActivityLog(db, {
            description: triggerText,
            eventType: "chat_task_executed",
            metadata: { outputId: result.output?.id ?? null },
            relatedTaskId: result.task.id,
            title: result.task.title,
            userId,
            workerId: workerSlug
          });
        }
      }
    } catch (error) {
      console.error(`Background chat execution failed for ${workerSlug}:`, error);
    }
  })();
}

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

  // LLM-first path for every role-config worker: interpret the message,
  // reply in the worker's voice, queue typed tasks, execute in background.
  if (worker && hasRoleConfig(workerSlug) && isAgentLlmConfigured()) {
    try {
      const agentResult = await handleAgentChatMessage({
        db,
        userId: req.user.id,
        workerId: workerSlug,
        message: text,
        readers: buildMaraExecutionReaders()
      });
      if (agentResult) {
        mergeChatMemories(req.user.id, workerSlug, agentResult.memoriesToSave);
        db.prepare(
          `INSERT INTO office_chat_messages (id, user_id, worker_slug, author, text, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(
          randomUUID(),
          req.user.id,
          workerSlug,
          workerChatAuthor(worker, workerSlug),
          agentResult.reply,
          new Date(Date.now() + 1000).toISOString()
        );
        const paused = isWorkerPaused(req.user.id, workerSlug);
        res.status(201).json({ ok: true, executing: !paused && agentResult.createdTaskIds.length > 0 });
        if (!paused) {
          executeChatTasksInBackground(req.user.id, workerSlug, worker, agentResult.createdTaskIds, text);
        }
        return;
      }
    } catch (error) {
      console.error("Agent chat interpretation failed, falling back:", error);
    }
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

    const executedResults = isMaraAutonomyPausedForUser(req.user)
      ? []
      : await autoExecuteSafeMaraTasks({
        db,
        taskIds: createdChatTaskIds,
        userId: req.user.id,
        workerId: workerSlug,
        ...buildMaraExecutionReaders()
      });
    const executedOutputIds = executedResults.map((result) => result?.output?.id).filter(Boolean);
    if (executedOutputIds.length > 0) {
      await syncMaraGmailDraftsForOutputs(req.user.id, workerSlug, executedOutputIds);
    }

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
        ).run(randomUUID(), req.user.id, workerSlug, "Mara", replyParts.join("\n\n"), replyCreatedAt);
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
  const chatAuthor = workerSlug === MARA_SLUG ? "Mara" : "Worker";
  const replyCreatedAt = new Date(Date.now() + 1000).toISOString();
  db.prepare(
    `INSERT INTO office_chat_messages (id, user_id, worker_slug, author, text, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), req.user.id, workerSlug, chatAuthor, replyText, replyCreatedAt);

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

  const allowedStatuses = ["To Do", "In Progress", "Needs Review", "Pending approval", "Blocked", "Completed"];
  if (!allowedStatuses.includes(status)) {
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

  const workerTask = db
    .prepare(
      `SELECT id, status
       FROM worker_tasks
       WHERE id = ? AND user_id = ? AND worker_id = ?`
    )
    .get(taskId, req.user.id, workerSlug);

  if (workerTask && hasRoleConfig(workerSlug)) {
    const officeToEngine = {
      "To Do": "approved",
      "In Progress": "in_progress",
      "Needs Review": "proposed",
      "Pending approval": "proposed",
      Blocked: "blocked",
      Completed: "completed"
    };
    const nextStatus = officeToEngine[status];
    if (nextStatus) {
      updateWorkerTaskStatus(db, req.user.id, workerSlug, taskId, nextStatus);
    }
  }

  db.prepare(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), req.user.id, workerSlug, "Updated task status.", "Tasks", `${taskId} -> ${status}`, nowIso());

  if (isMaraWorker(workerSlug)) {
    syncMaraOperationalRecords(req.user.id, workerSlug);
  } else if (hasRoleConfig(workerSlug)) {
    syncOfficeCanonicalRecords(req.user.id, workerSlug);
  }

  res.json({ ok: true });
});

app.post("/api/office/workers/:slug/tasks/:taskId/approve", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug ?? "").trim();
  const taskId = String(req.params.taskId ?? "").trim();

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!hasRoleConfig(workerSlug)) {
    res.status(400).json({ error: "Task approval is not available for this worker yet." });
    return;
  }

  try {
    let result;
    if (isMaraWorker(workerSlug)) {
      result = await approveWorkerProposedTask(db, req.user.id, workerSlug, taskId, {
        db,
        ...buildMaraExecutionReaders()
      });
      syncMaraOperationalRecords(req.user.id, workerSlug);
    } else {
      updateWorkerTaskStatus(db, req.user.id, workerSlug, taskId, "approved");
      result = await runAgentTask({
        db,
        userId: req.user.id,
        workerId: workerSlug,
        taskId,
        readers: buildMaraExecutionReaders()
      });
      syncOfficeCanonicalRecords(req.user.id, workerSlug);
    }
    res.json({
      ok: true,
      ...result,
      workspace: buildMaraWorkspace(db, req.user.id, workerSlug, {
        readKnowledgeSections: readWorkerKnowledgeSections,
        readOfficeOverlays: readOfficeOverlaysForUser
      })
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not approve task." });
  }
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
      `SELECT worker_slug, stripe_subscription_id AS stripeSubscriptionId
       FROM hired_workers
       WHERE user_id = ? AND worker_slug = ? AND status = ?`
    )
    .get(req.user.id, workerSlug, "active");

  if (!worker) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  // Firing a worker must stop their salary: cancel the Stripe subscription.
  if (worker.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      await stripe.subscriptions.cancel(worker.stripeSubscriptionId);
    } catch (error) {
      console.error(`Stripe subscription cancel failed for ${worker.stripeSubscriptionId}:`, error);
      res.status(502).json({
        error: "The worker was not removed because their subscription could not be cancelled. Please try again or contact support so you are not billed."
      });
      return;
    }
  }

  db.prepare(
    `UPDATE hired_workers
     SET status = ?, billing_status = 'cancelled'
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

  syncOfficeCanonicalRecords(req.user.id, workerSlug);

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

  syncOfficeCanonicalRecords(req.user.id, workerSlug);

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

  const workerRows = db
    .prepare(
      `SELECT worker_slug AS workerSlug
       FROM hired_workers
       WHERE user_id = ? AND status = 'active'`
    )
    .all(req.user.id);
  for (const row of workerRows) {
    syncHandbookEntries(req.user.id, row.workerSlug);
  }

  res.json({ ok: true });
});

app.post("/api/office/workers/:slug/onboarding/save", assertOrigin, requireAuth, async (req, res) => {
  try {
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

    syncHandbookEntries(req.user.id, workerSlug);

    res.json({ ok: true });
  } catch (error) {
    console.error("Worker onboarding save failed:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unable to save onboarding progress." });
  }
});

app.post("/api/office/workers/:slug/onboarding/complete", assertOrigin, requireAuth, async (req, res) => {
  try {
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
    if (workerSlug === MARA_SLUG) {
      const gmail = getWorkerIntegration(req.user.id, workerSlug, "gmail");
      updateWorkerPermissions(
        db,
        req.user.id,
        workerSlug,
        deriveMaraPermissionsFromOnboarding(answers, { inboxConnected: gmail?.status === "connected" })
      );
    }

    let shouldRunMaraOnboardingAutomation = false;
    const maraHasOutputs =
      workerSlug === MARA_SLUG
        ? Number(
            db
              .prepare(
                `SELECT COUNT(*) AS count
                 FROM worker_outputs
                 WHERE user_id = ? AND worker_id = ?`
              )
              .get(req.user.id, workerSlug)?.count || 0
          ) > 0
        : true;

    if (existing?.status !== "completed") {
      if (workerSlug !== MARA_SLUG) {
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
        shouldRunMaraOnboardingAutomation = true;
      }
    } else if (workerSlug === MARA_SLUG && !maraHasOutputs) {
      shouldRunMaraOnboardingAutomation = true;
    }

    // Non-Mara role-config workers: kick a first autonomy cycle in the
    // background so starter deliverables land on their desk right away.
    if (workerSlug !== MARA_SLUG && hasRoleConfig(workerSlug)) {
      void runAgentAutonomyCycle({
        db,
        userId: req.user.id,
        workerId: workerSlug,
        readers: buildMaraExecutionReaders()
      })
        .then(() => syncOfficeCanonicalRecords(req.user.id, workerSlug))
        .catch((error) => console.error(`First-day agent cycle failed for ${workerSlug}:`, error));
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
      String(worklogEntry?.result ?? (workerSlug === MARA_SLUG ? "I captured your workflow and I'm setting up my desk." : "Worker prepared first-day setup")),
      timestamp
    );

    if (shouldRunMaraOnboardingAutomation && isMaraAutonomyPausedForUser(req.user)) {
      shouldRunMaraOnboardingAutomation = false;
    }

    let maraAutomationResult = null;
    if (shouldRunMaraOnboardingAutomation) {
      try {
        maraAutomationResult = await runMaraFirstDayAutomation({
          userId: req.user.id,
          workerSlug,
          answers,
          generatedSummary: Array.isArray(generatedSummary) ? generatedSummary : [],
          normalizedKnowledge
        });
      } catch (error) {
        console.error("Mara onboarding automation failed:", error);
        createWorkerActivityLog(db, {
          description: "I finished onboarding, but my first work pass needs another try.",
          eventType: "onboarding_automation_failed",
          metadata: { message: error instanceof Error ? error.message : String(error) },
          relatedTaskId: null,
          title: "First-day follow-up",
          userId: req.user.id,
          workerId: workerSlug
        });
      } finally {
        syncOfficeCanonicalRecords(req.user.id, workerSlug);
      }
    } else {
      syncOfficeCanonicalRecords(req.user.id, workerSlug);
    }

    res.json({
      ok: true,
      workspace:
        maraAutomationResult?.workspace ??
        (workerSlug === MARA_SLUG
          ? buildMaraWorkspace(db, req.user.id, workerSlug, {
              readKnowledgeSections: readWorkerKnowledgeSections,
              readOfficeOverlays: readOfficeOverlaysForUser
            })
          : null)
    });
  } catch (error) {
    console.error("Worker onboarding completion failed:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unable to complete onboarding." });
  }
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
  if (maraAutonomyIntervalMinutes > 0) {
    const intervalMs = maraAutonomyIntervalMinutes * 60 * 1000;
    maraAutonomyTimer = setInterval(() => {
      void runScheduledMaraAutonomy();
      void sendWeeklyDigests();
    }, intervalMs);
    void runScheduledMaraAutonomy();
    void sendWeeklyDigests();
    console.log(`Mara autonomy scheduler enabled every ${maraAutonomyIntervalMinutes} minute(s).`);
  }
});
