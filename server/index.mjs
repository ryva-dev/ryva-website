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
import { validateConfiguredPrice } from "./billingPricePolicy.mjs";
import { fileURLToPath } from "node:url";
import { db, ensureOfficeSchema } from "./db.mjs";
import { sendTransactionalEmail } from "./mailer.mjs";
import { extractGmailBodyText } from "./maraInboxParser.mjs";
import { parseUnparsedInboxThreads } from "./maraInboxOps.mjs";
import { deriveMaraPermissionsFromOnboarding, formatTaskSourceLabel, safeList, sentenceCase } from "./maraOfficeUtils.mjs";
import { createDurableRateLimitStore, initRateLimitStore, rateLimitKeyForRequest } from "./rateLimitStore.mjs";
import {
  deleteUserTrendArtifacts,
  loadUserTrendInsights,
  resolveGlobalTrendInsightsPath,
  resolveStorageRoot,
  saveGlobalTrendInsights,
  syncUserTrendInsightsFromGlobal
} from "./maraTrendOps.mjs";
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
import { isLikelyListicleTitle } from "./workerEngine.mjs";
import { isAgentLlmConfigured, normalizeDeliverableTitle, parseTrendPasteHeuristic, tryParseTrendPaste } from "./agentLlm.mjs";
import { hasRoleConfig } from "./roles.mjs";
import {
  errorHandler,
  installGracefulShutdown,
  log,
  notFoundHandler,
  registerHealthEndpoints,
  requestContext,
  validateConfig
} from "./observability.mjs";
import { captureException, getMetricsSnapshot, incrementMetric } from "./metrics.mjs";
import { decryptJson, encryptJson } from "./secretsCrypto.mjs";
import { canSpend, noteSpend } from "./llmBudget.mjs";
import { createStore, wrapSqliteHandle } from "./dataStore.mjs";
import { createObjectStorage } from "./objectStorage.mjs";
import {
  claimJobs,
  completeJob,
  enqueueJob,
  failJob,
  initJobQueue,
  mergeOAuthTokenMetadata,
  startJobLeaseHeartbeat
} from "./jobQueue.mjs";
import { initProfessionalIntelligence } from "./professionalIntelligence.mjs";
import { appendActionAuditEvent, evaluateActionPolicy, initActionAudit } from "./actionPolicy.mjs";
import { validateTenantUpload } from "./uploadSecurity.mjs";
import { claimExternalAction, completeExternalAction, initExternalActions, markExternalActionUncertain } from "./externalActions.mjs";
import { getMaraGrowthIntelligenceSnapshot, initMaraIntelligence, listTopPitchTargets, recordCommercialOutcome, resolveCanonicalDesiredBrand, saveCreativeAnalysis } from "./maraIntelligence.mjs";
import { inferAndRecordCommercialOutcomes } from "./maraOutcomeInference.mjs";
import {
  buildGoogleAuthorizationUrl,
  exchangeGoogleCodeForTokens,
  getGmailConnectRedirectUri,
  getGoogleLoginRedirectUri,
  GMAIL_CONNECT_SCOPES,
  GOOGLE_LOGIN_SCOPES,
  refreshGoogleAccessToken as refreshGoogleAccessTokenShared
} from "./googleOAuth.mjs";
import { initMaraBrandArchitecture } from "./maraBrandCanonical.mjs";
import { getCreatorIntelligenceProfile, seedCreatorProfileFromOnboarding, upsertCreatorIntelligenceProfile } from "./maraCreatorProfile.mjs";
import { deepResearchBrand, listResearchProviders } from "./maraResearchProviders.mjs";
import { confirmInferredContact, listBrandContacts } from "./maraContactDiscovery.mjs";
import { createOrUpdateOpportunityFromResearch } from "./maraOpportunityPackages.mjs";
import { buildConceptFromGap, saveConceptIfNovel } from "./maraConceptEngine.mjs";
import { getAutonomyLimits, saveAutonomyLimits } from "./maraAutonomyLimits.mjs";
import {
  buildTenantMediaKey,
  enqueueVideoAnalysis,
  processVideoAnalysisJob,
  registerMediaAsset,
  scanMediaForMalware,
  validateVideoUpload
} from "./maraMediaPipeline.mjs";
import { startOutreachSequence, stopOutreachSequence, SEQUENCE_STOP_REASONS } from "./maraOutreachSequences.mjs";
import { createEvidenceItem, EVIDENCE_KINDS } from "./maraEvidence.mjs";
import { USER_SCOPED_TABLES, authorizeAccountDeletion } from "./accountErasure.mjs";
import { ensureMaraRuntimeTables } from "./maraRuntimeStorage.mjs";
import { normalizeAnthropicUsage, recordModelUsage } from "./modelUsageAccounting.mjs";

function logCaught(message, error, fields = {}) {
  const errMessage = error instanceof Error ? error.message : String(error);
  log.error(message, {
    ...fields,
    error: errMessage,
    stack: error instanceof Error ? error.stack : undefined
  });
  void captureException(error instanceof Error ? error : new Error(errMessage), { message, ...fields });
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const workersPath = path.join(rootDir, "data", "workers.json");
const storageRoot =
  process.env.STORAGE_ROOT ||
  process.env.RAILWAY_VOLUME_MOUNT_PATH ||
  path.join(rootDir, "data");
const uploadsDir = path.join(storageRoot, "office-uploads");
const objectStorage = createObjectStorage({ localRoot: uploadsDir });

// Single data plane: Postgres when DATABASE_URL is set, otherwise the SQLite
// handle opened by db.mjs. Never wrap a null db or open a second backend.
const usingPostgres = Boolean(String(process.env.DATABASE_URL ?? "").trim());
const appStore = usingPostgres ? createStore() : wrapSqliteHandle(db);
if (usingPostgres) {
  await appStore.init();
}
const trendStore = appStore;
const jobStore = appStore;
const auditStore = appStore;
const professionalStore = appStore;
const agentStore = appStore;
const authStore = appStore;
const maraStore = appStore;
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
// Autonomy is core product behavior, not an optional production add-on. The
// durable queue and idempotency keys make this safe across restarts/replicas;
// operators can still explicitly set AUTONOMY_SCHEDULER_ENABLED=0 to pause it.
const autonomySchedulerEnabled = String(process.env.AUTONOMY_SCHEDULER_ENABLED ?? "1").trim() === "1";
let maraAutonomyTimer = null;
let maraAutonomyRunning = false;
const jobLeaseOwner = `${host}:${port}:${process.pid}:${randomUUID()}`;

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

// Fail fast at boot if production configuration is incomplete.
validateConfig();

if (usingPostgres) {
  const { runMigrations } = await import("./migrate.mjs");
  // Idempotent migrate-on-boot (set MIGRATE_ON_BOOT=0 to rely on an init container only).
  if (String(process.env.MIGRATE_ON_BOOT ?? "1").trim() !== "0") {
    log.info("migrate_on_boot_start");
    await runMigrations();
    log.info("migrate_on_boot_complete");
  }
}

await initJobQueue(jobStore);
await initRateLimitStore(jobStore);
await initProfessionalIntelligence(professionalStore);
await initActionAudit(auditStore);
await initExternalActions(auditStore);
await initMaraIntelligence(professionalStore);
await initMaraBrandArchitecture(professionalStore);
await ensureMaraRuntimeTables(appStore);
await authStore.execute(`CREATE TABLE IF NOT EXISTS agent_llm_usage (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  calls INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
)`);

const app = express();
app.disable("x-powered-by");
if (isProduction) {
  app.set("trust proxy", 1);
}
app.use(
  helmet({
    // Enforce CSP in production once built assets are self-hosted; report-only in dev.
    contentSecurityPolicy: {
      reportOnly: !isProduction,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "data:", "https:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
        baseUri: ["'self'"],
        reportUri: ["/api/csp-report"]
      }
    }
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

// Request correlation + structured access logs.
app.use(requestContext);

// Liveness/readiness probes for the load balancer — unauthenticated, cheap, and
// registered before auth/rate-limiting so orchestrators can always reach them.
registerHealthEndpoints(app, {
  pingStore: async () => {
    await authStore.ping();
    if (usingPostgres) {
      const { assertSchemaCurrent } = await import("./migrate.mjs");
      await assertSchemaCurrent(async (sql) => authStore.query(sql));
    }
  }
});

function requireMetricsAuth(req, res, next) {
  const expected = String(process.env.METRICS_TOKEN ?? "").trim();
  if (!expected) {
    if (isProduction) {
      res.status(401).json({ error: "Metrics require METRICS_TOKEN." });
      return;
    }
    next();
    return;
  }
  const header = String(req.headers.authorization ?? "");
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const matches = (value) => {
    if (!value || value.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
  };
  if (matches(bearer)) {
    next();
    return;
  }
  res.status(401).json({ error: "Unauthorized." });
}

app.get("/metrics", requireMetricsAuth, async (_req, res) => {
  try {
    const dead = await jobStore.queryOne(
      `SELECT COUNT(*) AS count FROM durable_jobs WHERE status = 'dead'`
    );
    const queued = await jobStore.queryOne(
      `SELECT COUNT(*) AS count FROM durable_jobs WHERE status = 'queued'`
    );
    const oldest = await jobStore.queryOne(
      `SELECT MIN(available_at) AS "oldestAvailableAt" FROM durable_jobs WHERE status = 'queued'`
    );
    res.status(200).json({
      ...getMetricsSnapshot(),
      jobs: {
        dead: Number(dead?.count ?? 0),
        queued: Number(queued?.count ?? 0),
        oldestQueuedAt: oldest?.oldestAvailableAt ?? null
      },
      backend: usingPostgres ? "postgres" : "sqlite"
    });
  } catch (error) {
    logCaught("metrics_endpoint_failed", error);
    res.status(500).json({ error: "metrics unavailable" });
  }
});

// CSP violation sink — browsers POST reports here (report-only mode). Logged so
// you can see what an enforcing policy would block before flipping it on.
app.post(
  "/api/csp-report",
  express.json({ type: ["application/csp-report", "application/reports+json", "application/json"], limit: "100kb" }),
  (req, res) => {
    const report = req.body?.["csp-report"] ?? req.body ?? null;
    if (report) log.warn("csp_violation", { report });
    res.status(204).end();
  }
);

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
  limit: isProduction ? 15 : 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many interview requests. Please try again shortly." }
});

const onboardingLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: isProduction ? 20 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many onboarding requests. Please try again shortly." }
});

const expensiveApiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: createDurableRateLimitStore(jobStore, { windowMs: 10 * 60 * 1000 }),
  keyGenerator: (req) => rateLimitKeyForRequest(req, "expensive"),
  validate: { keyGeneratorIpFallback: false },
  message: { error: "Too many requests for this action. Please try again shortly." }
});

const llmHeavyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: createDurableRateLimitStore(jobStore, { windowMs: 10 * 60 * 1000 }),
  keyGenerator: (req) => rateLimitKeyForRequest(req, "llm"),
  validate: { keyGeneratorIpFallback: false },
  message: { error: "LLM budget throttle: slow down and retry shortly." }
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

async function toSafeUser(user) {
  const onboarding = await authStore.queryOne(
    "SELECT user_id FROM user_onboarding WHERE user_id = ? AND completed_at IS NOT NULL",
    user.id
  );
  return {
    createdAt: user.created_at,
    email: user.email,
    emailVerified: Boolean(user.email_verified_at),
    id: user.id,
    isAdmin: isAdminUser(user),
    name: user.name,
    onboarded: Boolean(onboarding)
  };
}

function isAdminUser(user) {
  return Boolean(user?.email && adminEmails.has(normalizeEmail(user.email)));
}

async function getUserRecordById(userId) {
  if (!userId) return null;
  return authStore.queryOne("SELECT * FROM users WHERE id = ?", userId);
}

function isGoogleAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

async function isUserOnboarded(userId) {
  return Boolean(await authStore.queryOne(
    `SELECT user_id
     FROM user_onboarding
     WHERE user_id = ? AND completed_at IS NOT NULL`,
    userId
  ));
}

async function getUserOnboardingRecordAsync(userId) {
  const record = await authStore.queryOne(
    `SELECT uo.user_id, uo.brand_name AS "brandName", uo.what_you_do AS "whatYouDo",
            uo.completed_at AS "completedAt", ogs.settings_json AS "settingsJson"
     FROM user_onboarding uo
     LEFT JOIN office_global_settings ogs ON ogs.user_id = uo.user_id
     WHERE uo.user_id = ?`,
    userId
  );
  if (!record) return null;
  const settings = parseJson(record.settingsJson, {});
  return {
    brandName: String(settings.companyName || record.brandName || "").trim(),
    completedAt: record.completedAt,
    creatorProfiles: String(settings.creatorProfiles || "").trim(),
    userId: record.user_id,
    whatYouDo: String(settings.brandContext || record.whatYouDo || "").trim()
  };
}

async function buildOfficeSettingsSeed(user, onboardingRecord) {
  const existing = await authStore.queryOne(
    `SELECT settings_json AS "settingsJson" FROM office_global_settings WHERE user_id = ?`,
    user.id
  );

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
    creatorProfiles: String(parsedExisting.creatorProfiles ?? ""),
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

async function seedOfficeSettingsFromOnboarding(user, onboardingRecord) {
  const settings = await buildOfficeSettingsSeed(user, onboardingRecord);
  await authStore.execute(
    `INSERT INTO office_global_settings (user_id, settings_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       settings_json = excluded.settings_json,
       updated_at = excluded.updated_at`,
    user.id, JSON.stringify(settings), nowIso());
}

async function readWorkers() {
  const file = await fs.readFile(workersPath, "utf8");
  return JSON.parse(file);
}

async function readHiredWorkersForUser(userId) {
  const hiredRows = await authStore.query(
    `SELECT worker_slug AS "workerSlug", paused
     FROM hired_workers
     WHERE user_id = ? AND status = ?
     ORDER BY hired_at DESC`,
    userId,
    "active"
  );

  if (hiredRows.length === 0) {
    return [];
  }

  const workers = await readWorkers();
  const workerMap = new Map(workers.map((worker) => [worker.slug, worker]));

  return hiredRows
    .map((row) => {
      const worker = workerMap.get(row.workerSlug);
      return worker ? { ...worker, paused: Boolean(row.paused) } : null;
    })
    .filter(Boolean);
}

async function isWorkerPaused(userId, workerSlug) {
  const row = await authStore.queryOne(
    "SELECT paused FROM hired_workers WHERE user_id = ? AND worker_slug = ? AND status = 'active'",
    userId,
    workerSlug
  );
  return Boolean(row?.paused);
}

// Billing has lapsed when the subscription is past_due or cancelled. Empty
// billing_status ('') is a free/admin hire and is allowed to run.
async function isWorkerBillingLapsed(userId, workerSlug) {
  const row = await authStore.queryOne(
    `SELECT billing_status AS "billingStatus"
     FROM hired_workers WHERE user_id = ? AND worker_slug = ? AND status = 'active'`,
    userId,
    workerSlug
  );
  return ["past_due", "cancelled"].includes(String(row?.billingStatus ?? ""));
}

async function hasHiredWorker(userId, workerSlug) {
  return Boolean(await authStore.queryOne(
    "SELECT id FROM hired_workers WHERE user_id = ? AND worker_slug = ? AND status = ?",
    userId,
    workerSlug,
    "active"
  ));
}

async function readOfficeOverlaysForUser(userId) {
  const [
    assignments,
    briefings,
    chats,
    tasks,
    suggestedActions,
    worklog,
    settings,
    knowledge,
    files,
    deliverables,
    calendarEvents,
    globalSettings,
    onboarding,
    integrations,
    handbookEntries
  ] = await Promise.all([
    authStore.query(
      `SELECT id, worker_slug AS "workerSlug", source_type AS "sourceType", source_id AS "sourceId", source_label AS "sourceLabel",
              title, summary, status, priority, kind, rhythm, blocked_reason AS "blockedReason", due_at AS "dueAt",
              artifact_type AS "artifactType", artifact_ref_id AS "artifactRefId", artifact_title AS "artifactTitle",
              artifact_preview AS "artifactPreview", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM office_assignments
       WHERE user_id = ?
       ORDER BY updated_at DESC, created_at DESC`,
      userId
    ),
    authStore.query(
      `SELECT worker_slug AS "workerSlug", id, title, date_label AS "dateLabel", summary,
              agenda_json AS "agendaJson", decisions_json AS "decisionsJson", actions_json AS "actionsJson"
       FROM office_custom_briefings
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      userId
    ),
    authStore.query(
      `SELECT worker_slug AS "workerSlug", id, author, text, created_at AS timestamp
       FROM office_chat_messages
       WHERE user_id = ?
       ORDER BY created_at ASC`,
      userId
    ),
    authStore.query(
      `SELECT worker_slug AS "workerSlug", id, due_date AS "dueDate", module_name AS module, owner, priority, status, title
       FROM office_custom_tasks
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      userId
    ),
    authStore.query(
      `SELECT worker_slug AS "workerSlug", id, action_type AS "actionType", title, description, reason,
              related_thread_id AS "relatedThreadId", related_campaign_id AS "relatedCampaignId", related_brand_id AS "relatedBrandId",
              payload_json AS "payloadJson", status, requires_approval AS "requiresApproval", created_at AS "createdAt"
       FROM office_suggested_actions
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      userId
    ),
    authStore.query(
      `SELECT worker_slug AS "workerSlug", id, action, module_name AS module, result, created_at AS timestamp
       FROM office_activity_logs
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      userId
    ),
    authStore.query(
      `SELECT worker_slug AS "workerSlug", settings_json AS "settingsJson", updated_at AS "updatedAt"
       FROM office_worker_settings
       WHERE user_id = ?`,
      userId
    ),
    authStore.query(
      `SELECT worker_slug AS "workerSlug", knowledge_json AS "knowledgeJson", updated_at AS "updatedAt"
       FROM office_worker_knowledge
       WHERE user_id = ?`,
      userId
    ),
    authStore.query(
      `SELECT worker_slug AS "workerSlug", id, name, type, uploaded_at AS "updatedAt"
       FROM office_uploaded_files
       WHERE user_id = ?
       ORDER BY uploaded_at DESC`,
      userId
    ),
    authStore.query(
      `SELECT id, worker_slug AS "workerSlug", source_type AS "sourceType", source_id AS "sourceId", title, summary,
              deliverable_type AS "deliverableType", preview_text AS "previewText", content_ref_id AS "contentRefId",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM office_deliverables
       WHERE user_id = ?
       ORDER BY updated_at DESC, created_at DESC`,
      userId
    ),
    authStore.query(
      `SELECT id, worker_slug AS "workerSlug", title, starts_at AS "startsAt", ends_at AS "endsAt",
              event_type AS "eventType", notes, updated_at AS "updatedAt"
       FROM office_calendar_events
       WHERE user_id = ?
       ORDER BY starts_at ASC`,
      userId
    ),
    authStore.queryOne(
      `SELECT settings_json AS "settingsJson", updated_at AS "updatedAt"
       FROM office_global_settings
       WHERE user_id = ?`,
      userId
    ),
    authStore.query(
      `SELECT worker_slug AS "workerSlug", status, answers_json AS "answersJson",
              generated_summary_json AS "generatedSummaryJson", completed_at AS "completedAt"
       FROM office_onboarding_sessions
       WHERE user_id = ?`,
      userId
    ),
    authStore.query(
      // Never send integration metadata (OAuth tokens) to the browser — the
      // client only needs provider/status/label. metadataJson is returned
      // empty to preserve the payload shape.
      `SELECT worker_slug AS "workerSlug", provider, status, account_label AS "accountLabel",
              '' AS "metadataJson", connected_at AS "connectedAt", updated_at AS "updatedAt"
       FROM office_worker_integrations
       WHERE user_id = ?
       ORDER BY worker_slug ASC, provider ASC`,
      userId
    ),
    authStore.query(
      `SELECT id, section, subsection, worker_slug AS "workerSlug", source_type AS "sourceType", source_id AS "sourceId",
              source_label AS "sourceLabel", statement, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM office_handbook_entries
       WHERE user_id = ?
       ORDER BY section ASC, subsection ASC, updated_at DESC, created_at DESC`,
      userId
    )
  ]);

  return {
    assignments,
    briefings,
    chats,
    tasks,
    suggestedActions,
    worklog,
    settings,
    knowledge,
    files,
    deliverables,
    calendarEvents,
    globalSettings: globalSettings ?? null,
    onboarding,
    integrations,
    handbookEntries
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

async function upsertOfficeAssignment(record) {
  const existing = await authStore.queryOne(
    `SELECT id
     FROM office_assignments
     WHERE user_id = ? AND worker_slug = ? AND source_type = ? AND source_id = ?`
  , record.userId, record.workerSlug, record.sourceType, record.sourceId);

  if (existing) {
    await authStore.execute(
      `UPDATE office_assignments
       SET source_label = ?, title = ?, summary = ?, status = ?, priority = ?, kind = ?, rhythm = ?, blocked_reason = ?,
           due_at = ?, artifact_type = ?, artifact_ref_id = ?, artifact_title = ?, artifact_preview = ?, updated_at = ?
       WHERE id = ?`
    ,
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
  await authStore.execute(
    `INSERT INTO office_assignments
      (id, user_id, worker_slug, source_type, source_id, source_label, title, summary, status, priority, kind, rhythm,
       blocked_reason, due_at, artifact_type, artifact_ref_id, artifact_title, artifact_preview, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ,
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

async function upsertOfficeDeliverable(record) {
  const existing = await authStore.queryOne(
    `SELECT id
     FROM office_deliverables
     WHERE user_id = ? AND worker_slug = ? AND source_type = ? AND source_id = ?`
  , record.userId, record.workerSlug, record.sourceType, record.sourceId);

  if (existing) {
    await authStore.execute(
      `UPDATE office_deliverables
       SET title = ?, summary = ?, deliverable_type = ?, preview_text = ?, content_ref_id = ?, updated_at = ?
       WHERE id = ?`
    ,
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
  await authStore.execute(
    `INSERT INTO office_deliverables
      (id, user_id, worker_slug, source_type, source_id, title, summary, deliverable_type, preview_text, content_ref_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ,
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

async function upsertHandbookEntry(record) {
  const existing = await authStore.queryOne(
    `SELECT id
     FROM office_handbook_entries
     WHERE user_id = ? AND section = ? AND subsection = ? AND COALESCE(worker_slug, '') = COALESCE(?, '') AND source_type = ? AND source_id = ?`
  , record.userId, record.section, record.subsection, record.workerSlug ?? null, record.sourceType, record.sourceId);

  if (existing) {
    await authStore.execute(
      `UPDATE office_handbook_entries
       SET source_label = ?, statement = ?, updated_at = ?
       WHERE id = ?`
    , record.sourceLabel, record.statement, record.updatedAt, existing.id);
    return existing.id;
  }

  const id = randomUUID();
  await authStore.execute(
    `INSERT INTO office_handbook_entries
      (id, user_id, section, subsection, worker_slug, source_type, source_id, source_label, statement, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ,
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

async function syncWorkerAssignments(userId, workerSlug) {
  const workerTasks = await authStore.query(
    `SELECT id, title, description, source, status, priority, due_at AS "dueAt", output, task_type AS "taskType", updated_at AS "updatedAt", created_at AS "createdAt"
     FROM worker_tasks
     WHERE user_id = ? AND worker_id = ?`
  , userId, workerSlug);

  for (const task of workerTasks) {
    const parsedOutput = parseJson(task.output, null);
    await upsertOfficeAssignment({
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

  const officeTasks = await authStore.query(
    `SELECT id, title, module_name AS "moduleName", priority, status, due_date AS "dueDate", created_at AS "createdAt"
     FROM office_custom_tasks
     WHERE user_id = ? AND worker_slug = ?`
  , userId, workerSlug);

  // Worker tasks are the source of truth. Office rows that mirror a worker
  // task (same title) would render as duplicates — skip them, and clean up
  // any duplicate assignment rows older syncs left behind.
  const workerTaskTitles = new Set(workerTasks.map((task) => String(task.title).trim().toLowerCase()));

  for (const task of officeTasks) {
    if (workerTaskTitles.has(String(task.title).trim().toLowerCase())) {
      await authStore.execute(
        `DELETE FROM office_assignments
         WHERE user_id = ? AND worker_slug = ? AND source_type = 'office_task' AND source_id = ?`
      , userId, workerSlug, task.id);
      continue;
    }
    const moduleLabel = String(task.moduleName ?? "").trim();
    const readableModule = /^[a-z0-9]+([_-][a-z0-9]+)+$/i.test(moduleLabel)
      ? formatTaskSourceLabel(moduleLabel) || sentenceCase(moduleLabel.replace(/[_-]+/g, " "))
      : moduleLabel;
    await upsertOfficeAssignment({
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

/**
 * The Deliverables library is a showcase, not a system log. Internal
 * artifacts stay off it: plain summaries, status notes, and weekly
 * schedules (those live on the calendar, where they belong).
 */
const HIDDEN_DELIVERABLE_OUTPUT_TYPES = new Set([
  "summary",
  "status_note",
  "ops_brief",
  "tracker_structure",
  "weekly_plan",
  "weekly_schedule"
]);

function personalizeCreatorPositioningText(value) {
  return String(value ?? "")
    .replace(/\b(?:this|the) creator's\b/gi, "your")
    .replace(/\b(?:this|the) creator\b/gi, "you")
    .replace(/\btheir\b/gi, "your")
    .replace(/\bthem\b/gi, "you")
    .replace(/\bthey\b/gi, "you");
}

function personalizeCreatorPositioningStructured(value) {
  if (Array.isArray(value)) return value.map(personalizeCreatorPositioningStructured);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, personalizeCreatorPositioningStructured(entry)]));
  }
  return typeof value === "string" ? personalizeCreatorPositioningText(value) : value;
}

async function syncWorkerDeliverables(userId, workerSlug) {
  const outputs = (await authStore.query(
    `SELECT o.id, o.user_id AS "userId", o.worker_id AS "workerId", o.task_id AS "taskId", o.output_type AS "outputType",
            o.title, o.content, o.structured_content_json AS "structuredContentJson", o.source,
            o.created_at AS "createdAt", o.updated_at AS "updatedAt", t.title AS "taskTitle"
     FROM worker_outputs o
     LEFT JOIN worker_tasks t ON t.id = o.task_id AND t.user_id = o.user_id
     WHERE o.user_id = ? AND o.worker_id = ? ORDER BY o.created_at DESC`,
    userId, workerSlug
  )).map((row) => ({ ...row, structuredContent: parseJson(row.structuredContentJson, null) }));

  // One early fallback shipped skincare/beauty categories for every creator.
  // Remove only that exact platform-generated fingerprint when the creator
  // never declared a related niche, then let Mara rebuild from real context.
  const [accountContext, onboarding] = await Promise.all([
    getUserOnboardingRecordAsync(userId),
    readMaraOnboardingAnswers(userId, workerSlug)
  ]);
  const declaredNiche = `${accountContext?.whatYouDo || ""} ${onboarding?.answers?.niche_focus || ""}`;
  const creatorDeclaredBeauty = /\b(skincare|skin care|beauty|cosmetic|wellness|serum)\b/i.test(declaredNiche);
  if (!creatorDeclaredBeauty) {
    const cleanupAt = nowIso();
    await authStore.execute(
      `UPDATE worker_tasks SET status = 'dismissed', updated_at = ?
       WHERE user_id = ? AND worker_id = ? AND status NOT IN ('completed', 'dismissed')
         AND (lower(title) LIKE '%skincare%' OR lower(description) LIKE '%skincare%')`,
      cleanupAt, userId, workerSlug
    );
    await authStore.execute(
      `UPDATE worker_research_items SET status = 'dismissed', updated_at = ?
       WHERE user_id = ? AND worker_id = ? AND status <> 'dismissed'
         AND (lower(topic) LIKE '%skincare%' OR lower(query) LIKE '%skincare%')`,
      cleanupAt, userId, workerSlug
    );
    await authStore.execute(
      `UPDATE worker_recurring_responsibilities SET is_active = 0, updated_at = ?
       WHERE user_id = ? AND worker_id = ? AND is_active = 1
         AND (lower(title) LIKE '%skincare%' OR lower(description) LIKE '%skincare%')`,
      cleanupAt, userId, workerSlug
    );
  }
  const contaminatedOutputIds = creatorDeclaredBeauty
    ? []
    : outputs.filter((output) => {
        if (String(output.outputType) !== "brand_criteria") return false;
        const fingerprint = `${output.content || ""} ${JSON.stringify(output.structuredContent || {})}`;
        return /beauty-adjacent lifestyle/i.test(fingerprint) && /serums/i.test(fingerprint) && /supplements/i.test(fingerprint);
      }).map((output) => output.id);
  for (const outputId of contaminatedOutputIds) {
    await authStore.execute(
      `DELETE FROM office_deliverables WHERE user_id = ? AND worker_slug = ? AND source_type = 'worker_output' AND (source_id = ? OR content_ref_id = ?)`,
      userId, workerSlug, outputId, outputId
    );
    await authStore.execute(`DELETE FROM worker_outputs WHERE id = ? AND user_id = ? AND worker_id = ?`, outputId, userId, workerSlug);
  }
  const cleanOutputs = outputs.filter((output) => !contaminatedOutputIds.includes(output.id));

  // Remove anything previously synced that no longer belongs on display.
  for (const hiddenType of HIDDEN_DELIVERABLE_OUTPUT_TYPES) {
    await authStore.execute(
      `DELETE FROM office_deliverables
       WHERE user_id = ? AND worker_slug = ? AND source_type = 'worker_output' AND deliverable_type = ?`
    , userId, workerSlug, hiddenType);
  }

  for (const output of cleanOutputs) {
    if (HIDDEN_DELIVERABLE_OUTPUT_TYPES.has(String(output.outputType))) {
      continue;
    }
    if (["placeholder", "template"].includes(String(output.structuredContent?.generatedBy || ""))) {
      // Keep the underlying record for diagnostics, but never present a
      // generic fallback or held placeholder as completed professional work.
      await authStore.execute(
        `DELETE FROM office_deliverables
         WHERE user_id = ? AND worker_slug = ? AND source_type = 'worker_output'
           AND (source_id = ? OR content_ref_id = ?)`,
        userId, workerSlug, output.id, output.id
      );
      continue;
    }
    const displayContent = output.outputType === "creator_positioning"
      ? personalizeCreatorPositioningText(output.content)
      : output.content;
    const displayTitle = normalizeDeliverableTitle(output.title, output.taskTitle || sentenceCase(String(output.outputType || "deliverable").replace(/_/g, " ")));
    await upsertOfficeDeliverable({
      contentRefId: output.id,
      createdAt: output.createdAt,
      deliverableType: output.outputType,
      previewText: truncatePreview(displayContent || output.structuredContent?.preview || "", 260),
      sourceId: output.id,
      sourceType: "worker_output",
      summary: truncatePreview(displayContent || displayTitle, 160),
      title: displayTitle,
      updatedAt: output.updatedAt,
      userId,
      workerSlug
    });
  }

  const uploadedFiles = await authStore.query(
    `SELECT id, name, type, uploaded_at AS "uploadedAt"
     FROM office_uploaded_files
     WHERE user_id = ? AND worker_slug = ?`
  , userId, workerSlug);

  for (const file of uploadedFiles) {
    await upsertOfficeDeliverable({
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

async function syncHandbookEntries(userId, workerSlug) {
  const timestamp = nowIso();
  const entries = [];
  const settingsRow = await authStore.queryOne(
    `SELECT settings_json AS "settingsJson"
     FROM office_global_settings
     WHERE user_id = ?`
  , userId);
  const settings = parseJson(settingsRow?.settingsJson, {});
  const baseEntries = [
    ["business_profile", "company", "global_settings", "brand_context", String(settings.brandContext || "").trim(), "Added in settings"],
    ["voice_and_tone", "decision_style", "global_settings", "decision_style", String(settings.decisionStyle || "").trim(), "Decision style · settings"],
    ["rules", "review_cadence", "global_settings", "review_cadence", String(settings.reviewCadence || "").trim(), "Review cadence · settings"],
    ["rules", "quiet_hours", "global_settings", "quiet_hours", String(settings.quietHours || "").trim(), "Quiet hours · settings"]
  ];

  for (const [section, subsection, sourceType, sourceId, statement, sourceLabel] of baseEntries) {
    if (!statement) continue;
    entries.push({
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

  const onboarding = await authStore.queryOne(
    `SELECT generated_summary_json AS "generatedSummaryJson"
     FROM office_onboarding_sessions
     WHERE user_id = ? AND worker_slug = ?`
  , userId, workerSlug);
  const generatedSummary = normalizeTextList(parseJson(onboarding?.generatedSummaryJson, []), 12);
  generatedSummary.forEach((statement, index) => {
    entries.push({
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

  const knowledgeRow = await authStore.queryOne(
    `SELECT knowledge_json AS "knowledgeJson"
     FROM office_worker_knowledge
     WHERE user_id = ? AND worker_slug = ?`
  , userId, workerSlug);
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
          entries.push({
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
          entries.push({
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

  const decisions = await authStore.query(
    `SELECT id, date_label AS "dateLabel", decisions_json AS "decisionsJson"
     FROM office_custom_briefings
     WHERE user_id = ? AND worker_slug = ?`
  , userId, workerSlug);
  decisions.forEach((briefing) => {
    safeList(briefing.decisionsJson).slice(0, 6).forEach((statement, index) => {
      entries.push({
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

  const integrations = await authStore.query(
    `SELECT provider, status, account_label AS "accountLabel"
     FROM office_worker_integrations
     WHERE user_id = ? AND worker_slug = ?`
  , userId, workerSlug);
  integrations.forEach((integration) => {
    entries.push({
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
  for (const entry of entries) {
    await upsertHandbookEntry(entry);
  }
}

async function syncOfficeCanonicalRecords(userId, workerSlug) {
  await syncWorkerAssignments(userId, workerSlug);
  await syncWorkerDeliverables(userId, workerSlug);
  await syncHandbookEntries(userId, workerSlug);
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
      return "I would start by understanding your niche, portfolio, current outreach habits, and the kinds of brands you want to attract. From there I would tighten your positioning, build a weekly pitching rhythm, prepare outreach copy inside Ryva, and keep follow-up disciplined so deals move consistently instead of sporadically. You remain responsible for every external send.";
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

async function createAnthropicMessage({ maxTokens, messages, model, system, userId, usageContext = {} }) {
  const config = getAnthropicConfig();
  if (!config) {
    throw new Error("Anthropic is not configured.");
  }

  // Unified per-user daily budget shared with every other Anthropic path.
  // Authenticated callers pass userId; unauthenticated ones (e.g. interview)
  // rely on rate limiting instead.
  if (!(await canSpend(userId))) {
    throw new Error("Daily LLM budget reached for this account.");
  }

  const started = Date.now();
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": config.apiKey, "anthropic-version": config.version },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages })
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Anthropic request failed: ${response.status} ${body}`);
    }
    const payload = await response.json();
    const text = extractAnthropicText(payload);
    if (!text) throw new Error("Anthropic request returned no text.");
    await noteSpend(userId);
    await recordModelUsage(appStore, { ...usageContext, ...normalizeAnthropicUsage(payload), userId, provider: "anthropic", model, taskType: usageContext.taskType || "office_runtime", requestStatus: "success", latencyMs: Date.now() - started, requestId: payload.id });
    return text;
  } catch (error) {
    await recordModelUsage(appStore, { ...usageContext, userId, provider: "anthropic", model, taskType: usageContext.taskType || "office_runtime", requestStatus: "failure", latencyMs: Date.now() - started });
    throw error;
  }
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

async function getUserBrandContext(userId) {
  const [onboarding, globalSettings] = await Promise.all([
    getUserOnboardingRecordAsync(userId),
    authStore.queryOne(
      `SELECT settings_json AS "settingsJson"
       FROM office_global_settings
       WHERE user_id = ?`,
      userId
    )
  ]);
  const parsedSettings = parseJson(globalSettings?.settingsJson, {});

  return {
    brandName: onboarding?.brandName || String(parsedSettings.companyName ?? "").trim() || "Your brand",
    nicheSummary:
      onboarding?.whatYouDo ||
      String(parsedSettings.brandContext ?? "").trim() ||
      "A creator business focused on organized UGC work, clear follow-up, and better brand operations."
  };
}

async function ensureMaraKnowledge(userId) {
  // Worker memory must only ever contain things the manager actually said
  // (onboarding answers, chat direction). Never seed invented preferences.
  if (!(await hasHiredWorker(userId, MARA_SLUG))) return;
  const existing = await authStore.queryOne(
    `SELECT id FROM office_worker_knowledge WHERE user_id = ? AND worker_slug = ?`,
    userId, MARA_SLUG);

  if (existing) return;

  const sections = [];

  await authStore.execute(
    `INSERT INTO office_worker_knowledge (id, user_id, worker_slug, knowledge_json, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  , randomUUID(), userId, MARA_SLUG, JSON.stringify(sections), nowIso());
}

async function ensureMaraIntegrationRecord(userId, provider) {
  const accountLabel = provider === "gmail" ? "Gmail inbox" : "Outlook inbox";
  await authStore.execute(
    `INSERT INTO office_worker_integrations
      (id, user_id, worker_slug, provider, status, account_label, metadata_json, connected_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, worker_slug, provider) DO UPDATE SET
       status = excluded.status,
       account_label = excluded.account_label,
       metadata_json = excluded.metadata_json,
       connected_at = excluded.connected_at,
       updated_at = excluded.updated_at`
  ,
    randomUUID(),
    userId,
    MARA_SLUG,
    provider,
    "connected",
    accountLabel,
    encryptJson({ simulated: false }),
    nowIso(),
    nowIso()
  );
}

async function upsertWorkerIntegration(userId, workerSlug, provider, status, accountLabel, metadata = {}) {
  await authStore.execute(
    `INSERT INTO office_worker_integrations
      (id, user_id, worker_slug, provider, status, account_label, metadata_json, connected_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, worker_slug, provider) DO UPDATE SET
       status = excluded.status,
       account_label = excluded.account_label,
       metadata_json = excluded.metadata_json,
       connected_at = excluded.connected_at,
       updated_at = excluded.updated_at`
  ,
    randomUUID(),
    userId,
    workerSlug,
    provider,
    status,
    accountLabel,
    encryptJson(metadata),
    status === "connected" ? nowIso() : null,
    nowIso()
  );
}

async function getWorkerIntegration(userId, workerSlug, provider) {
  const row = await authStore.queryOne(
    `SELECT provider, status, account_label AS "accountLabel", metadata_json AS "metadataJson", connected_at AS "connectedAt", updated_at AS "updatedAt"
     FROM office_worker_integrations
     WHERE user_id = ? AND worker_slug = ? AND provider = ?`,
    userId, workerSlug, provider);

  if (!row) return null;
  return {
    ...row,
    metadata: decryptJson(row.metadataJson, {})
  };
}

async function getFreshGoogleAccessToken(userId, workerSlug, provider = "gmail") {
  const integration = await getWorkerIntegration(userId, workerSlug, provider);
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

  const refreshed = await refreshGoogleAccessTokenShared(refreshToken);
  const nextMetadata = {
    ...metadata,
    accessToken: String(refreshed.access_token ?? ""),
    expiresAt: new Date(Date.now() + Number(refreshed.expires_in ?? 3600) * 1000).toISOString()
  };
  await upsertWorkerIntegration(userId, workerSlug, provider, "connected", integration.accountLabel, nextMetadata);

  return {
    accessToken: nextMetadata.accessToken,
    emailAddress: String(nextMetadata.emailAddress ?? "").trim(),
    integration: await getWorkerIntegration(userId, workerSlug, provider)
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

async function upsertOfficeLead({
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

  const existing = await authStore.queryOne(
    `SELECT id, history_json AS "historyJson", metadata_json AS "metadataJson"
     FROM office_leads
     WHERE user_id = ? AND worker_slug = ? AND brand_name = ? AND contact_email = ?
     LIMIT 1`
  , userId, workerSlug, safeBrandName, safeEmail);

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
    await authStore.execute(
      `UPDATE office_leads
       SET contact_name = ?, lead_stage = ?, source_type = ?, source_reference_id = ?, last_activity_at = ?,
           summary = ?, history_json = ?, metadata_json = ?, updated_at = ?
       WHERE id = ?`
    ,
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
  await authStore.execute(
    `INSERT INTO office_leads
      (id, user_id, worker_slug, brand_name, contact_name, contact_email, lead_stage, source_type, source_reference_id,
       last_activity_at, next_follow_up_at, summary, history_json, metadata_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ,
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

async function syncCampaignsToLeadTracker(userId, workerSlug) {
  const campaigns = await authStore.query(
    `SELECT id, brand_name AS "brandName", contact_name AS "contactName", contact_email AS "contactEmail",
            campaign_status AS "campaignStatus", brief_text AS "briefText", updated_at AS "updatedAt"
     FROM office_campaigns
     WHERE user_id = ? AND worker_slug = ?
     ORDER BY updated_at DESC`
  , userId, workerSlug);

  let syncedCount = 0;
  for (const campaign of campaigns) {
    const leadId = await upsertOfficeLead({
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

async function syncResearchToOfficeIntel(userId, workerSlug) {
  const researchItems = await authStore.query(
    `SELECT id, topic, source_type AS "sourceType", summary, insights_json AS "insightsJson", evidence_json AS "evidenceJson", created_at AS "createdAt"
     FROM worker_research_items
     WHERE user_id = ? AND worker_id = ?
     ORDER BY created_at DESC
     LIMIT 50`
  , userId, workerSlug);

  let opportunityCount = 0;
  let trendSignalCount = 0;

  for (const item of researchItems) {
    const insights = parseJson(item.insightsJson, []);
    const evidence = parseJson(item.evidenceJson, []);
    if (item.sourceType === "web_brand") {
      const existing = await authStore.queryOne(
        `SELECT id
         FROM office_brand_opportunities
         WHERE user_id = ? AND worker_slug = ? AND brand_name = ?
         LIMIT 1`
      , userId, workerSlug, item.topic);
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
        await authStore.execute(
          `UPDATE office_brand_opportunities
           SET website = ?, fit_score = ?, ugc_potential_score = ?, risk_score = ?, content_gap = ?, suggested_angle = ?,
               source_notes = ?, updated_at = ?
           WHERE id = ?`
        , website, fitScore, ugcPotentialScore, riskScore, contentGap, suggestedAngle, sourceNotes, nowIso(), existing.id);
      } else {
        await authStore.execute(
          `INSERT INTO office_brand_opportunities
            (id, user_id, worker_slug, brand_name, website, category, source, fit_score, ugc_potential_score, risk_score,
             priority, content_gap, suggested_angle, source_notes, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ,
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
      const existingSignal = await authStore.queryOne(
        `SELECT id
         FROM office_trend_signals
         WHERE user_id = ? AND worker_slug = ? AND title = ?
         LIMIT 1`
      , userId, workerSlug, item.topic);
      if (!existingSignal) {
        await authStore.execute(
          `INSERT INTO office_trend_signals
            (id, user_id, worker_slug, niche, platform, signal_type, title, summary, hashtags_json, examples_json, confidence, source, detected_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ,
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

async function syncPrivateTikTokInsightsToTrendSignals(userId, workerSlug, privateInsights) {
  const hashtags = Array.isArray(privateInsights?.hashtags) ? privateInsights.hashtags : [];
  const niche = String(privateInsights?.niche || "ugc").trim();
  let syncedCount = 0;
  for (const hashtag of hashtags.slice(0, 25)) {
    const title = String(hashtag?.hashtag || "").trim();
    if (!title) continue;
    const existing = await authStore.queryOne(
      `SELECT id
       FROM office_trend_signals
       WHERE user_id = ? AND worker_slug = ? AND title = ?
       LIMIT 1`
    , userId, workerSlug, title);
    const summary = `${title} has ${String(hashtag.posts || "")} posts and ${String(hashtag.views || "")} views in ${String(privateInsights?.region || "US")} over the last ${String(privateInsights?.periodDays || 7)} days for ${niche}.`.trim();
    const examples = Array.isArray(hashtag.categories) ? hashtag.categories : [];
    if (existing) {
      await authStore.execute(
        `UPDATE office_trend_signals
         SET summary = ?, examples_json = ?, detected_at = ?
         WHERE id = ?`
      , summary, JSON.stringify(examples), String(privateInsights?.updatedAt || nowIso()), existing.id);
    } else {
      await authStore.execute(
        `INSERT INTO office_trend_signals
          (id, user_id, worker_slug, niche, platform, signal_type, title, summary, hashtags_json, examples_json, confidence, source, detected_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ,
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

async function syncInboxThreadsToCampaigns(userId, workerSlug) {
  const brandThreads = await authStore.query(
    `SELECT brand_name AS "brandName", contact_name AS "contactName", contact_email AS "contactEmail", subject, snippet,
            received_at AS "receivedAt", urgency, thread_status AS "threadStatus", id
     FROM office_email_threads
     WHERE user_id = ? AND worker_slug = ? AND brand_related = 1
     ORDER BY received_at DESC`
  , userId, workerSlug);

  const seenBrands = new Set();
  let syncedCount = 0;

  for (const thread of brandThreads) {
    const brandKey = String(thread.brandName || thread.contactEmail || thread.subject || "").trim().toLowerCase();
    if (!brandKey || seenBrands.has(brandKey)) continue;
    seenBrands.add(brandKey);

    const existing = await authStore.queryOne(
      `SELECT id
       FROM office_campaigns
       WHERE user_id = ? AND worker_slug = ? AND brand_name = ? AND contact_email = ?
       LIMIT 1`
    , userId, workerSlug, thread.brandName || "Unknown brand", thread.contactEmail || "");

    if (existing) {
      const existingCampaign = await authStore.queryOne(
        `SELECT last_parsed_at AS "lastParsedAt", deliverables_json AS "deliverablesJson"
         FROM office_campaigns
         WHERE id = ?`
      , existing.id);
      const hasParsedBrief = Boolean(existingCampaign?.lastParsedAt) || parseJson(existingCampaign?.deliverablesJson, []).length > 0;
      if (hasParsedBrief) {
        await authStore.execute(
          `UPDATE office_campaigns
           SET source_thread_id = ?, notes = ?, updated_at = ?
           WHERE id = ?`
        ,
          thread.id,
          `Linked to latest Gmail thread: ${thread.subject || thread.brandName || "Inbox thread"}`,
          nowIso(),
          existing.id
        );
      } else {
        await authStore.execute(
          `UPDATE office_campaigns
           SET campaign_name = ?, campaign_status = ?, source_thread_id = ?, brief_text = ?, notes = ?, updated_at = ?
           WHERE id = ?`
        ,
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

    await authStore.execute(
      `INSERT INTO office_campaigns
        (id, user_id, worker_slug, brand_name, brand_website, contact_name, contact_email, product_name, campaign_name,
         campaign_status, source_thread_id, deliverables_json, brief_text, draft_due_date, final_due_date, payment_amount,
         payment_status, usage_rights, usage_rights_status, revision_limit, raw_footage_required, missing_fields_json,
         risk_flags_json, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ,
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
 * schedules/plans land on the calendar as real time blocks. Both are idempotent —
 * each output is harvested exactly once (or retried until events land).
 */
async function harvestMaraOutputSideEffects(userId, workerSlug) {
  const { harvestWeeklyOutputToCalendar } = await import("./maraCalendarSync.mjs");
  const recentThreshold = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  const rows = await authStore.query(
    `SELECT id, output_type AS "outputType", structured_content_json AS "structuredContentJson"
     FROM worker_outputs
     WHERE user_id = ? AND worker_id = ? AND created_at >= ? AND output_type IN ('market_pulse', 'weekly_schedule', 'weekly_plan')`,
    userId, workerSlug, recentThreshold);

  for (const row of rows) {
    const structured = parseJson(row.structuredContentJson, {});
    let changed = false;

    // Lessons → "UGC playbook (learned)" memory section, capped at 20.
    if (row.outputType === "market_pulse" && Array.isArray(structured.lessonsLearned) && structured.lessonsLearned.length > 0 && !structured.lessonsHarvestedAt) {
      await upsertWorkerKnowledge(userId, workerSlug, (knowledge) => {
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

    if (row.outputType === "weekly_schedule" || row.outputType === "weekly_plan") {
      // A sync stamp without any persisted event is not success. This can
      // happen after an interrupted deploy or an earlier calendar bug. Clear
      // the stale stamp so the idempotent harvester repairs the calendar.
      if (structured.calendarSyncedAt) {
        const event = await authStore.queryOne(
          `SELECT id FROM office_calendar_events
           WHERE user_id = ? AND worker_slug = ? AND notes LIKE ? LIMIT 1`,
          userId, workerSlug, `%:${row.id}]%`
        );
        if (!event) {
          delete structured.calendarSyncedAt;
          delete structured.calendarEventsCreated;
          changed = true;
        }
      }
      if (!structured.calendarSyncedAt) {
        const harvested = await harvestWeeklyOutputToCalendar(authStore, {
          userId,
          workerSlug,
          outputId: row.id,
          outputType: row.outputType,
          structured,
          createActivityLog: (payload) => createWorkerActivityLog(maraStore, payload)
        });
        Object.assign(structured, harvested.structured || {});
        changed = true;
      }
    }

    if (changed) {
      await authStore.execute("UPDATE worker_outputs SET structured_content_json = ?, updated_at = ? WHERE id = ?", JSON.stringify(structured), nowIso(), row.id);
    }
  }
}

function localRundownClock(timezone) {
  const safeTimezone = String(timezone || "UTC").trim() || "UTC";
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: safeTimezone,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        hourCycle: "h23"
      }).formatToParts(new Date()).map((part) => [part.type, part.value])
    );
    return {
      dateLabel: `${parts.weekday}, ${parts.month} ${parts.day}, ${parts.year}`,
      hour: Number(parts.hour || 0),
      timezone: safeTimezone
    };
  } catch {
    return localRundownClock("UTC");
  }
}

async function syncMaraDailyRundown(userId, workerSlug) {
  const context = await authStore.queryOne(
    `SELECT os.answers_json AS "answersJson", ogs.settings_json AS "settingsJson"
     FROM office_onboarding_sessions os
     LEFT JOIN office_global_settings ogs ON ogs.user_id = os.user_id
     WHERE os.user_id = ? AND os.worker_slug = ? AND os.status = 'completed'`,
    userId, workerSlug
  );
  if (!context) return;

  const answers = parseJson(context.answersJson, {});
  const settings = parseJson(context.settingsJson, {});
  const requestedOutput = String(answers.daily_output || "").trim();
  const reviewCadence = String(settings.reviewCadence || "").trim().toLowerCase();
  const wantsDailyRundown =
    reviewCadence === "daily" ||
    /end of (?:my )?day|end-of-day|daily (?:brief|rundown|check)|what (?:was|got) done|tomorrow/i.test(requestedOutput);
  if (!wantsDailyRundown) return;

  const clock = localRundownClock(settings.timezone);
  if (clock.hour < 17) return;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const outputs = await authStore.query(
    `SELECT title, output_type AS "outputType" FROM worker_outputs
     WHERE user_id = ? AND worker_id = ? AND created_at >= ?
     ORDER BY created_at DESC LIMIT 20`,
    userId, workerSlug, since
  );
  const finished = outputs
    .filter((output) => !HIDDEN_DELIVERABLE_OUTPUT_TYPES.has(String(output.outputType || "")))
    .map((output) => String(output.title || "").trim())
    .filter(Boolean)
    .filter((title, index, list) => list.indexOf(title) === index)
    .slice(0, 8);
  if (finished.length === 0) return;

  const openTasks = await authStore.query(
    `SELECT title, status FROM worker_tasks
     WHERE user_id = ? AND worker_id = ? AND status IN ('approved', 'in_progress', 'proposed', 'blocked')
     ORDER BY CASE priority WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC, created_at ASC
     LIMIT 8`,
    userId, workerSlug
  );
  const tomorrow = openTasks
    .filter((task) => ["approved", "in_progress"].includes(String(task.status)))
    .map((task) => String(task.title || "").trim())
    .filter(Boolean)
    .slice(0, 5);
  const needsYou = openTasks
    .filter((task) => ["proposed", "blocked"].includes(String(task.status)))
    .map((task) => String(task.title || "").trim())
    .filter(Boolean)
    .slice(0, 5);
  const title = "Your end-of-day rundown";
  const summary = `Mara finished ${finished.length} meaningful item${finished.length === 1 ? "" : "s"}. Tomorrow's list reflects work that is actually queued now.`;
  const existing = await authStore.queryOne(
    `SELECT id FROM office_custom_briefings
     WHERE user_id = ? AND worker_slug = ? AND title = ? AND date_label = ?`,
    userId, workerSlug, title, clock.dateLabel
  );
  if (existing) {
    await authStore.execute(
      `UPDATE office_custom_briefings
       SET summary = ?, agenda_json = ?, decisions_json = ?, actions_json = ? WHERE id = ?`,
      summary, JSON.stringify(finished), JSON.stringify(needsYou), JSON.stringify(tomorrow), existing.id
    );
    return;
  }
  await authStore.execute(
    `INSERT INTO office_custom_briefings
     (id, user_id, worker_slug, title, date_label, summary, agenda_json, decisions_json, actions_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    randomUUID(), userId, workerSlug, title, clock.dateLabel, summary,
    JSON.stringify(finished), JSON.stringify(needsYou), JSON.stringify(tomorrow), nowIso()
  );
}

async function syncMaraOperationalRecords(userId, workerSlug) {
  // Retire legacy auto-generated status tasks. They are internal telemetry,
  // not creator work, and otherwise linger in Assignments after the product
  // has stopped generating the artifact.
  await authStore.execute(
    `UPDATE worker_tasks SET status = 'dismissed', updated_at = ?
     WHERE user_id = ? AND worker_id = ? AND task_type = 'ops_brief'
       AND source = 'autonomy_ops_brief' AND status NOT IN ('completed', 'dismissed')`,
    nowIso(), userId, workerSlug
  );
  // Completed canonical artifacts satisfy older queued refresh work. This
  // prevents a scheduler cycle from spending tokens on the same document.
  for (const [taskType, outputType] of [["creator_positioning", "creator_positioning"], ["brand_fit_criteria", "brand_criteria"]]) {
    await authStore.execute(
      `UPDATE worker_tasks
       SET status = 'dismissed', updated_at = ?
       WHERE user_id = ? AND worker_id = ? AND task_type = ?
         AND status NOT IN ('completed', 'dismissed')
         AND EXISTS (
           SELECT 1 FROM worker_outputs o
           WHERE o.user_id = worker_tasks.user_id AND o.worker_id = worker_tasks.worker_id
             AND o.output_type = ? AND o.created_at >= worker_tasks.created_at
         )`,
      nowIso(), userId, workerSlug, taskType, outputType
    );
  }
  await authStore.execute(
    `UPDATE worker_recurring_responsibilities SET is_active = 0, updated_at = ?
     WHERE user_id = ? AND worker_id = ? AND normalized_title = 'monthly creator profile refresh'`,
    nowIso(), userId, workerSlug
  );
  await harvestMaraOutputSideEffects(userId, workerSlug);
  await syncMaraDailyRundown(userId, workerSlug);
  const privateInsights = await loadUserTrendInsights({
    store: trendStore,
    globalPath: privateInsightsPath,
    readAccountContext: getUserOnboardingRecordAsync,
    readMaraOnboarding: readMaraOnboardingAnswers,
    readWorkerKnowledge: readWorkerKnowledgeSections,
    storageRoot: resolveStorageRoot(),
    objectStorage,
    userId,
    workerId: workerSlug
  });
  const campaignLeadSync = await syncCampaignsToLeadTracker(userId, workerSlug);
  const researchSync = await syncResearchToOfficeIntel(userId, workerSlug);
  const trendSync = await syncPrivateTikTokInsightsToTrendSignals(userId, workerSlug, privateInsights);
  await syncOfficeCanonicalRecords(userId, workerSlug);
  const growthIntelligenceSync = await syncMaraGrowthIntelligenceFromResearch(userId, workerSlug);
  return {
    campaignLeadSyncCount: campaignLeadSync.syncedCount,
    growthIntelligenceSyncCount: growthIntelligenceSync.syncedCount,
    opportunitySyncCount: researchSync.opportunityCount,
    trendSignalSyncCount: researchSync.trendSignalCount + trendSync.syncedCount
  };
}

async function syncMaraGrowthIntelligenceFromResearch(userId, workerSlug) {
  const brands = await professionalStore.query(
    `SELECT b.brand_name AS "brandName", b.website, b.identity_summary AS "identitySummary",
            b.vibe_notes AS "vibeNotes", b.suggested_angle AS "suggestedAngle",
            b.contact_email AS "contactEmail", b.research_item_id AS "researchItemId",
            r.evidence_json AS "evidenceJson", r.created_at AS "researchedAt"
     FROM worker_brands b
     LEFT JOIN worker_research_items r ON r.id = b.research_item_id AND r.user_id = b.user_id
     WHERE b.user_id = ? AND b.worker_id = ?`,
    userId, workerSlug
  );
  let syncedCount = 0;
  const creatorProfile = await getCreatorIntelligenceProfile(professionalStore, userId, workerSlug);
  for (const brand of brands) {
    const canonicalBrand = resolveCanonicalDesiredBrand(brand, creatorProfile?.business?.desiredBrands);
    const publicEvidence = parseJson(brand.evidenceJson, []);
    const sourceUrl = String(publicEvidence?.[0]?.url || brand.website || "").trim() || null;
    // Public facts only into mara_public_brands; creator thesis lives on the opportunity package.
    const evidence = [
      createEvidenceItem({
        kind: EVIDENCE_KINDS.OBSERVED,
        claim: String(brand.identitySummary || `${canonicalBrand.brandName} was found in current public research.`),
        sourceUrl,
        observedAt: brand.researchedAt,
        confidence: sourceUrl ? 82 : 60
      }),
      createEvidenceItem({
        kind: EVIDENCE_KINDS.HYPOTHESIS,
        claim: /\bdream\b.*\bfor me\b|\bwould be (?:a )?dream\b/i.test(String(brand.suggestedAngle || ""))
          ? "A creator-specific creative gap still needs validation against current advertising."
          : String(brand.suggestedAngle || "A creator-specific creative gap still needs validation against current advertising."),
        confidence: brand.suggestedAngle ? 58 : 35
      })
    ];
    try {
      await createOrUpdateOpportunityFromResearch(professionalStore, {
        userId,
        workerId: workerSlug,
        brandName: canonicalBrand.brandName,
        website: canonicalBrand.website || null,
        evidence,
        creatorProfile,
        contacts: brand.contactEmail && (!canonicalBrand.canonicalDesiredBrand || String(brand.contactEmail).toLowerCase().includes(String(canonicalBrand.brandName).toLowerCase().replace(/[^a-z0-9]/g, "")))
          ? [{ contactType: "email", value: brand.contactEmail, mayUseForOutreach: 1 }]
          : []
      });
      syncedCount += 1;
    } catch (error) {
      if (error?.code === "BRAND_ENTITY_REJECTED") continue;
      throw error;
    }
  }
  return { syncedCount };
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

    await authStore.execute(
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
    ,
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

  await insertMaraSyncJob(userId, "gmail", "gmail_inbox_sync", `Synced ${syncedCount} Gmail message${syncedCount === 1 ? "" : "s"} into Mara's inbox view.`);
  const campaignSync = await syncInboxThreadsToCampaigns(userId, workerSlug);
  const briefParse = await parseUnparsedInboxThreads(maraStore, userId, workerSlug, { fetchImpl: fetch });
  const operationalSync = await syncMaraOperationalRecords(userId, workerSlug);
  let outcomeInference = { recorded: [], skipped: [] };
  try {
    await initMaraIntelligence(professionalStore);
    outcomeInference = await inferAndRecordCommercialOutcomes(professionalStore, userId, workerSlug, { limit: 30 });
    if (outcomeInference.recorded.length) {
      await insertMaraSyncJob(
        userId,
        "growth",
        "commercial_outcome_inference",
        `Inferred ${outcomeInference.recorded.length} commercial outcome${outcomeInference.recorded.length === 1 ? "" : "s"} from inbox evidence and re-ranked opportunities.`
      );
    }
  } catch (error) {
    logCaught("commercial_outcome_inference_failed", error, { userId, workerSlug });
  }
  return {
    briefParseCount: briefParse.parsedCount,
    campaignSyncCount: campaignSync.syncedCount,
    syncedCount,
    outcomesInferred: outcomeInference.recorded.length,
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

async function findBestDraftContact(userId, workerSlug, brandLabel = "") {
  const normalizedBrand = String(brandLabel ?? "").trim().toLowerCase();
  // Never fall back to a different brand's thread — wrong To: is worse than empty To:.
  if (!normalizedBrand) return null;

  try {
    const { findOutreachContactByBrandName } = await import("./maraContactDiscovery.mjs");
    const maraContact = await findOutreachContactByBrandName(professionalStore, userId, workerSlug, brandLabel);
    if (maraContact?.value?.includes("@") && Number(maraContact.mayUseForOutreach) === 1) {
      return {
        brandName: maraContact.brandName || brandLabel,
        contactEmail: maraContact.value,
        contactName: "",
        subject: "",
        contactId: maraContact.id,
        source: "mara_brand_contacts"
      };
    }
  } catch {
    /* table may be missing mid-migrate */
  }

  const campaignMatch = await authStore.queryOne(
    `SELECT brand_name AS "brandName", contact_email AS "contactEmail", contact_name AS "contactName", campaign_name AS subject
     FROM office_campaigns
     WHERE user_id = ? AND worker_slug = ? AND lower(brand_name) = lower(?)
       AND contact_email <> ''
     ORDER BY updated_at DESC
     LIMIT 1`,
    userId,
    workerSlug,
    brandLabel
  );
  if (campaignMatch) return campaignMatch;

  return authStore.queryOne(
    `SELECT brand_name AS "brandName", contact_email AS "contactEmail", contact_name AS "contactName", subject
     FROM office_email_threads
     WHERE user_id = ? AND worker_slug = ? AND contact_email <> ''
       AND (lower(brand_name) = ? OR lower(subject) LIKE ?)
     ORDER BY received_at DESC
     LIMIT 1`,
    userId,
    workerSlug,
    normalizedBrand,
    `%${normalizedBrand}%`
  );
}

async function buildDraftSpecsFromOutput(outputRow) {
  const structured = outputRow.structuredContent ?? {};
  const brandLabel = extractDraftBrandLabel(
    structured.brandName,
    outputRow.title,
    outputRow.taskTitle,
    outputRow.taskDescription
  );
  const stampedEmail = String(structured.contactEmail ?? "").trim();
  const contact = stampedEmail
    ? { brandName: brandLabel, contactEmail: stampedEmail, contactName: "", subject: String(structured.followUpSubject || structured.subject || "") }
    : await findBestDraftContact(outputRow.userId, outputRow.workerId, brandLabel);
  const resolvedBrand = brandLabel || String(contact?.brandName ?? "Brand").trim();
  const replacements = {
    Brand: resolvedBrand,
    "Your name": outputRow.userName || "Your name"
  };
  const drafts = [];
  const to = String(stampedEmail || contact?.contactEmail || "").trim();

  if (outputRow.outputType === "pitch_template" || outputRow.outputType === "pitch_draft") {
    drafts.push({
      body: normalizePlaceholderText(structured.emailPitch || outputRow.content, replacements),
      subject: normalizePlaceholderText(
        Array.isArray(structured.subjectLineOptions) ? structured.subjectLineOptions[0] : `UGC idea for ${resolvedBrand}`,
        replacements
      ),
      title: outputRow.outputType === "pitch_draft" ? `Personalized pitch draft for ${resolvedBrand}` : `Pitch template draft for ${resolvedBrand}`,
      to
    });
  }

  if (outputRow.outputType === "reply_draft") {
    drafts.push({
      body: normalizePlaceholderText(structured.replyDraft || outputRow.content, replacements),
      subject: String(contact?.subject ?? "").trim() ? `Re: ${String(contact.subject).trim()}` : `Reply for ${resolvedBrand}`,
      title: `Brand reply draft for ${resolvedBrand}`,
      to
    });
  }

  if (outputRow.outputType === "follow_up_sequence") {
    const primaryBody = structured.emailPitch || structured.followUp1 || outputRow.content;
    if (String(primaryBody ?? "").trim()) {
      drafts.push({
        body: normalizePlaceholderText(primaryBody, replacements),
        subject: normalizePlaceholderText(
          structured.followUpSubject ||
            (Array.isArray(structured.subjectLineOptions) ? structured.subjectLineOptions[0] : null) ||
            `Follow-up for ${resolvedBrand}`,
          replacements
        ),
        title: `Follow-up draft for ${resolvedBrand}`,
        to
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
  // Founder policy: Mara's artifacts stay inside Ryva. Gmail is read-only
  // context; Mara never creates Gmail drafts or sends external communication.
  if (isMaraWorker(workerSlug)) return { createdCount: 0, skipped: "mara_external_communication_prohibited" };
  const gmail = await getWorkerIntegration(userId, workerSlug, "gmail");
  if (!gmail || gmail.status !== "connected") {
    return { createdCount: 0, skipped: "gmail_not_connected" };
  }

  const rows = (outputIds.length > 0
    ? await authStore.query(
        `SELECT o.id, o.user_id AS "userId", o.worker_id AS "workerId", o.task_id AS "taskId", o.output_type AS "outputType",
                o.title, o.content, o.structured_content_json AS "structuredContentJson",
                t.title AS "taskTitle", t.description AS "taskDescription",
                u.name AS "userName"
         FROM worker_outputs o
         LEFT JOIN worker_tasks t ON t.id = o.task_id
         LEFT JOIN users u ON u.id = o.user_id
         WHERE o.user_id = ? AND o.worker_id = ? AND o.id IN (${outputIds.map(() => "?").join(",")})
         ORDER BY o.created_at DESC`,
        userId, workerSlug, ...outputIds
      )
    : [])
    .map((row) => ({ ...row, structuredContent: parseJson(row.structuredContentJson, {}) }));

  let createdCount = 0;

  for (const row of rows) {
    if (!["pitch_template", "pitch_draft", "reply_draft", "follow_up_sequence"].includes(String(row.outputType))) {
      continue;
    }

    const existingDrafts = Array.isArray(row.structuredContent?.gmailDrafts) ? row.structuredContent.gmailDrafts : [];
    const hasSendableDraft = existingDrafts.some((draft) => String(draft?.to ?? "").trim());
    // Refresh when drafts exist but none have a To: (contact was found after first sync).
    if (existingDrafts.length > 0 && hasSendableDraft) {
      continue;
    }

    const draftSpecs = await buildDraftSpecsFromOutput(row);
    if (draftSpecs.length === 0) continue;

    // Prefer stamped contactEmail from the output; never create endless empty-To drafts.
    const anyRecipient = draftSpecs.some((spec) => String(spec.to || "").trim());
    if (!anyRecipient) {
      if (existingDrafts.length > 0) {
        // Keep the existing empty draft record; wait for a real contact before recreating in Gmail.
        continue;
      }
      // Still create one internal draft record only when structured content already has To:.
      // Without a recipient, skip Gmail API creation entirely.
      continue;
    }

    const createdDrafts = [];
    for (const spec of draftSpecs) {
      if (!String(spec.to || "").trim()) continue;
      const created = await createGmailDraftForOutput(userId, workerSlug, spec);
      createdDrafts.push(created);
    }
    if (createdDrafts.length === 0) continue;

    const nextStructured = {
      ...row.structuredContent,
      gmailDrafts: createdDrafts
    };

    await authStore.execute(
      `UPDATE worker_outputs
       SET structured_content_json = ?, updated_at = ?
       WHERE id = ? AND user_id = ? AND worker_id = ?`
    , JSON.stringify(nextStructured), nowIso(), row.id, userId, workerSlug);

    // The approve-and-send loop: drafts with a real recipient become a
    // one-click approval. Approving sends from the user's own Gmail.
    const permissions = await getWorkerPermissions(maraStore, userId, workerSlug);
    const sendableDrafts = createdDrafts.filter((draft) => String(draft.to ?? "").trim());
    if (sendableDrafts.length > 0 && permissions.canSendEmailsWithApproval) {
      await createApprovalRequest(maraStore, {
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

    await createWorkerActivityLog(maraStore, {
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

async function insertMaraSyncJob(userId, provider, jobName, summary, status = "completed") {
  await authStore.execute(
    `INSERT INTO office_sync_jobs (id, user_id, worker_slug, job_name, provider, status, summary, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  , randomUUID(), userId, MARA_SLUG, jobName, provider, status, summary, nowIso(), nowIso());
}

/**
 * Earlier builds seeded fictional demo data (SageHaus, Glow Theory, Kinfield
 * threads, tasks, events, approvals) into real user offices. Scrub every
 * trace at startup so no fabricated work ever appears again. Idempotent.
 */
async function purgeLegacyDemoData() {
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
      purged += (await authStore.execute(sql, ...params)).changes;
    } catch {
      /* table may not exist in older databases */
    }
  }

  // Strip fabricated memory sections earlier builds invented ("Minimum
  // rate: $350", filming days, excluded categories the user never stated).
  try {
    const knowledgeRows = await authStore.query(
      `SELECT id, knowledge_json AS "knowledgeJson" FROM office_worker_knowledge`
    );
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
      await authStore.execute(
        "UPDATE office_worker_knowledge SET knowledge_json = ?, updated_at = ? WHERE id = ?",
        JSON.stringify(cleaned), nowIso(), row.id
      );
      purged += 1;
    }
  } catch {
    /* table may not exist */
  }

  if (purged > 0) {
    console.log(`Purged ${purged} legacy demo record(s).`);
  }
}
await purgeLegacyDemoData();

/**
 * Scraped HTML entities (&mdash; &amp; …) leaked into stored text in earlier
 * builds. Decode them in place across every user-visible column. Idempotent.
 */
async function cleanHtmlEntitiesInDatabase() {
  const targets = [
    ["worker_research_items", ["topic", "summary"]],
    ["worker_brands", ["brand_name", "identity_summary", "suggested_angle", "vibe_notes"]],
    ["worker_tasks", ["title", "description"]],
    ["worker_outputs", ["title", "content"]],
    ["office_deliverables", ["title", "summary", "preview_text"]],
    ["office_assignments", ["title", "summary", "artifact_title", "artifact_preview"]],
    ["office_custom_tasks", ["title"]],
    ["office_chat_messages", ["text"]]
  ];
  const replacements = [
    ["&mdash;", "—"], ["&ndash;", "–"], ["&amp;", "&"], ["&quot;", '"'],
    ["&#39;", "'"], ["&apos;", "'"], ["&rsquo;", "’"], ["&lsquo;", "‘"],
    ["&rdquo;", "”"], ["&ldquo;", "“"], ["&nbsp;", " "], ["&hellip;", "…"]
  ];

  let cleaned = 0;
  for (const [table, columns] of targets) {
    for (const column of columns) {
      for (const [entity, character] of replacements) {
        try {
          cleaned += (await authStore.execute(
            `UPDATE ${table} SET ${column} = REPLACE(${column}, ?, ?) WHERE ${column} LIKE ?`,
            entity, character, `%${entity}%`
          )).changes;
        } catch {
          /* column/table may not exist in older databases */
        }
      }
    }
  }
  if (cleaned > 0) {
    console.log(`Decoded HTML entities in ${cleaned} stored record(s).`);
  }
}
await cleanHtmlEntitiesInDatabase();

/**
 * Earlier scrapes stored article headlines ("15+ Wellness Brands for…") as
 * brands, producing absurd pitches. Purge every artifact built on them:
 * brand rows, research items, tasks, outputs, and displayed deliverables.
 */
async function purgeListicleArtifacts() {
  let purged = 0;

  try {
    for (const row of await authStore.query(`SELECT id, brand_name AS "brandName" FROM worker_brands`)) {
      if (isLikelyListicleTitle(row.brandName)) {
        purged += (await authStore.execute("DELETE FROM worker_brands WHERE id = ?", row.id)).changes;
      }
    }
    for (const row of await authStore.query("SELECT id, topic FROM worker_research_items")) {
      const topic = String(row.topic ?? "").replace(/^\[(Opportunity|r\/[^\]]+)\]\s*/i, "");
      if (isLikelyListicleTitle(topic) && !/^\[/.test(String(row.topic ?? ""))) {
        purged += (await authStore.execute("DELETE FROM worker_research_items WHERE id = ?", row.id)).changes;
      }
    }
  } catch (error) {
    logCaught("Listicle purge failed:", error);
  }

  if (purged > 0) {
    console.log(`Purged ${purged} listicle-derived record(s).`);
  }
}
await purgeListicleArtifacts();

async function maraIntegrations(userId) {
  const integrations = await maraStore.query(
    `SELECT provider, status, account_label AS "accountLabel", connected_at AS "connectedAt", metadata_json AS "metadataJson"
     FROM office_worker_integrations
     WHERE user_id = ? AND worker_slug = ?
     ORDER BY provider ASC`,
    userId,
    MARA_SLUG
  );
  return integrations.map((integration) => ({
      ...integration,
      metadata: decryptJson(integration.metadataJson, {})
    }));
}

async function buildMaraDailyBrief(userId) {
  const [threads, campaigns, actions, opportunities, risks] = await Promise.all([
    maraStore.query(
      `SELECT category
       FROM office_email_threads
       WHERE user_id = ? AND worker_slug = ?`,
      userId,
      MARA_SLUG
    ),
    maraStore.query(
      `SELECT id
       FROM office_campaigns
       WHERE user_id = ? AND worker_slug = ?`,
      userId,
      MARA_SLUG
    ),
    maraStore.query(
      `SELECT id
       FROM office_suggested_actions
       WHERE user_id = ? AND worker_slug = ? AND status = ?`,
      userId,
      MARA_SLUG,
      "suggested"
    ),
    maraStore.query(
      `SELECT id
       FROM office_brand_opportunities
       WHERE user_id = ? AND worker_slug = ? AND status = ?`,
      userId,
      MARA_SLUG,
      "new"
    ),
    maraStore.query(
      `SELECT risk_flags_json AS "riskFlagsJson", missing_fields_json AS "missingFieldsJson"
       FROM office_campaigns
       WHERE user_id = ? AND worker_slug = ?`,
      userId,
      MARA_SLUG
    )
  ]);

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

async function getMaraDashboard(userId) {
  const [
    threads,
    campaignRows,
    suggestedActionRows,
    opportunityRows,
    tasks,
    trendSignalRows,
    recentWork,
    integrations,
    dailyBrief
  ] = await Promise.all([
    maraStore.query(
      `SELECT id, provider, subject, snippet, received_at AS "receivedAt", brand_related AS "brandRelated", category, urgency,
              confidence, reason, brand_name AS "brandName", contact_name AS "contactName", contact_email AS "contactEmail",
              source_message_count AS "sourceMessageCount", thread_status AS "threadStatus"
       FROM office_email_threads
       WHERE user_id = ? AND worker_slug = ?
       ORDER BY received_at DESC`,
      userId,
      MARA_SLUG
    ),
    maraStore.query(
      `SELECT id, brand_name AS "brandName", brand_website AS "brandWebsite", contact_name AS "contactName", contact_email AS "contactEmail",
              product_name AS "productName", campaign_name AS "campaignName", campaign_status AS "campaignStatus", source_thread_id AS "sourceThreadId",
              deliverables_json AS "deliverablesJson", brief_text AS "briefText", draft_due_date AS "draftDueDate", final_due_date AS "finalDueDate",
              payment_amount AS "paymentAmount", payment_status AS "paymentStatus", usage_rights AS "usageRights",
              usage_rights_status AS "usageRightsStatus", revision_limit AS "revisionLimit", raw_footage_required AS "rawFootageRequired",
              missing_fields_json AS "missingFieldsJson", risk_flags_json AS "riskFlagsJson", notes, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM office_campaigns
       WHERE user_id = ? AND worker_slug = ?
       ORDER BY updated_at DESC`,
      userId,
      MARA_SLUG
    ),
    maraStore.query(
      `SELECT id, action_type AS "actionType", title, description, reason, related_thread_id AS "relatedThreadId",
              related_campaign_id AS "relatedCampaignId", related_brand_id AS "relatedBrandId", payload_json AS "payloadJson",
              status, requires_approval AS "requiresApproval", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM office_suggested_actions
       WHERE user_id = ? AND worker_slug = ?
       ORDER BY created_at DESC`,
      userId,
      MARA_SLUG
    ),
    maraStore.query(
      `SELECT id, brand_name AS "brandName", website, category, source, fit_score AS "fitScore",
              ugc_potential_score AS "ugcPotentialScore", risk_score AS "riskScore", priority, content_gap AS "contentGap",
              suggested_angle AS "suggestedAngle", source_notes AS "sourceNotes", status, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM office_brand_opportunities
       WHERE user_id = ? AND worker_slug = ?
       ORDER BY created_at DESC`,
      userId,
      MARA_SLUG
    ),
    maraStore.query(
      `SELECT id, title, module_name AS module, owner, priority, status, due_date AS "dueDate"
       FROM office_custom_tasks
       WHERE user_id = ? AND worker_slug = ?
       ORDER BY created_at DESC`,
      userId,
      MARA_SLUG
    ),
    maraStore.query(
      `SELECT id, niche, platform, signal_type AS "signalType", title, summary, hashtags_json AS "hashtagsJson",
              examples_json AS "examplesJson", confidence, source, detected_at AS "detectedAt"
       FROM office_trend_signals
       WHERE user_id = ? AND worker_slug = ?
       ORDER BY detected_at DESC`,
      userId,
      MARA_SLUG
    ),
    maraStore.query(
      `SELECT id, action, module_name AS module, result, created_at AS timestamp
       FROM office_activity_logs
       WHERE user_id = ? AND worker_slug = ?
       ORDER BY created_at DESC`,
      userId,
      MARA_SLUG
    ),
    maraIntegrations(userId),
    buildMaraDailyBrief(userId)
  ]);

  const campaigns = campaignRows.map((campaign) => ({
      ...campaign,
      deliverables: parseJson(campaign.deliverablesJson, []),
      missingFields: parseJson(campaign.missingFieldsJson, []),
      riskFlags: parseJson(campaign.riskFlagsJson, [])
    }));

  const suggestedActions = suggestedActionRows.map((action) => ({
      ...action,
      payload: parseJson(action.payloadJson, {})
    }));

  const opportunities = opportunityRows.slice(0, 5);

  const trendSignals = trendSignalRows.map((signal) => ({
      ...signal,
      hashtags: parseJson(signal.hashtagsJson, []),
      examples: parseJson(signal.examplesJson, [])
    }));

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
    integrations,
    dailyBrief,
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

async function upsertWorkerKnowledge(userId, workerSlug, recipe) {
  const record = await authStore.queryOne(
      `SELECT knowledge_json AS "knowledgeJson"
       FROM office_worker_knowledge
       WHERE user_id = ? AND worker_slug = ?`,
    userId, workerSlug);

  const currentKnowledge =
    record?.knowledgeJson && typeof record.knowledgeJson === "string" ? JSON.parse(record.knowledgeJson) : [];

  const nextKnowledge = recipe(Array.isArray(currentKnowledge) ? currentKnowledge : []);

  await authStore.execute(
    `INSERT INTO office_worker_knowledge (id, user_id, worker_slug, knowledge_json, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, worker_slug) DO UPDATE SET
       knowledge_json = excluded.knowledge_json,
       updated_at = excluded.updated_at`
  , randomUUID(), userId, workerSlug, JSON.stringify(nextKnowledge), nowIso());
}

async function replaceWorkerKnowledge(userId, workerSlug, knowledgeSections) {
  const normalizedKnowledge = (Array.isArray(knowledgeSections) ? knowledgeSections : [])
    .map((section) => ({
      items: normalizeTextList(section?.items),
      title: String(section?.title ?? "").trim()
    }))
    .filter((section) => section.title && section.items.length > 0);

  await authStore.execute(
    `INSERT INTO office_worker_knowledge (id, user_id, worker_slug, knowledge_json, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, worker_slug) DO UPDATE SET
       knowledge_json = excluded.knowledge_json,
       updated_at = excluded.updated_at`
  , randomUUID(), userId, workerSlug, JSON.stringify(normalizedKnowledge), nowIso());
}

async function readWorkerKnowledgeSections(userId, workerSlug) {
  const record = await authStore.queryOne(
      `SELECT knowledge_json AS "knowledgeJson"
       FROM office_worker_knowledge
       WHERE user_id = ? AND worker_slug = ?`,
    userId, workerSlug);

  return parseJson(record?.knowledgeJson, []);
}

async function readMaraOnboardingAnswers(userId, workerSlug) {
  const record = await authStore.queryOne(
      `SELECT answers_json AS "answersJson", generated_summary_json AS "generatedSummaryJson", status, completed_at AS "completedAt"
       FROM office_onboarding_sessions
       WHERE user_id = ? AND worker_slug = ?`,
    userId, workerSlug);

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

async function readWorkerIntegrationMetadata(userId, workerSlug) {
  const rows = await authStore.query(
      `SELECT provider, status, account_label AS "accountLabel", metadata_json AS "metadataJson"
       FROM office_worker_integrations
       WHERE user_id = ? AND worker_slug = ?
       ORDER BY updated_at DESC`,
    userId, workerSlug);
  return rows.map((row) => ({
      ...row,
      metadata: decryptJson(row.metadataJson, {})
    }));
}

async function readWorkerRecentMessages(userId, workerSlug) {
  const rows = await authStore.query(
      `SELECT author, text, created_at AS "createdAt"
       FROM office_chat_messages
       WHERE user_id = ? AND worker_slug = ?
       ORDER BY created_at DESC
       LIMIT 10`,
    userId, workerSlug);
  return rows.reverse();
}

async function readMaraPrivateInsights(userId, workerId) {
  return loadUserTrendInsights({
    store: trendStore,
    globalPath: privateInsightsPath,
    readAccountContext: getUserOnboardingRecordAsync,
    readMaraOnboarding: readMaraOnboardingAnswers,
    readWorkerKnowledge: readWorkerKnowledgeSections,
    storageRoot: resolveStorageRoot(),
    objectStorage,
    userId,
    workerId
  });
}

function buildMaraExecutionReaders() {
  return {
    readAccountContext: getUserOnboardingRecordAsync,
    readConnectedIntegrations: readWorkerIntegrationMetadata,
    readMaraOnboarding: readMaraOnboardingAnswers,
    readMessages: readWorkerRecentMessages,
    readGrowthIntelligence: (userId, workerId) => getMaraGrowthIntelligenceSnapshot(professionalStore, userId, workerId),
    readPrivateInsights: readMaraPrivateInsights,
    readWorkerKnowledge: readWorkerKnowledgeSections
  };
}

async function runMaraFirstDayAutomation({ userId, workerSlug, answers, generatedSummary, normalizedKnowledge }) {

  const accountContext = await getUserOnboardingRecordAsync(userId);
  const initialPlan = buildMaraInitialWorkPlan({
    accountContext,
    maraAnswers: answers
  });
  const mergedKnowledge = [...initialPlan.memoryEntries, ...normalizedKnowledge];
  await replaceWorkerKnowledge(userId, workerSlug, mergedKnowledge);
  try {
    await seedCreatorProfileFromOnboarding(professionalStore, { userId, workerId: workerSlug, answers });
  } catch (error) {
    logCaught("creator_profile_seed_failed", error, { userId, workerSlug });
  }
  const createdTaskIds = [];

  for (const task of initialPlan.tasks) {
    const created = await createApprovedTaskIfPermissionAllows(maraStore, {
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
        const existingTask = (await listWorkerTasksForUserWorker(maraStore, userId, workerSlug)).find((entry) => entry.id === created.id);
        if (existingTask && ["approved", "in_progress"].includes(existingTask.status)) {
          createdTaskIds.push(created.id);
        }
      }
    }
  }

  for (const recurring of initialPlan.recurringResponsibilities) {
    await createRecurringResponsibility(maraStore, {
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
    store: maraStore,
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
    store: maraStore,
    mode: "interactive",
    userId,
    workerId: workerSlug,
    ...buildMaraExecutionReaders()
  });
  await syncMaraOperationalRecords(userId, workerSlug);
  const outputIds = Array.isArray(summary?.outputs) ? summary.outputs.map((output) => output?.id).filter(Boolean) : [];
  if (outputIds.length > 0) {
    await syncMaraGmailDraftsForOutputs(userId, workerSlug, outputIds);
  }

  return {
    summary,
    workspace: await buildMaraWorkspace(maraStore, userId, workerSlug, {
      readKnowledgeSections: readWorkerKnowledgeSections,
      readOfficeOverlays: readOfficeOverlaysForUser
    })
  };
}

const DIGEST_INTERVAL_DAYS = Number.parseInt(process.env.DIGEST_INTERVAL_DAYS ?? "7", 10);

/**
 * Weekly digest for one user. Idempotent via user_digest_log + job idempotency key.
 */
async function sendDigestForUser(user, threshold) {
  const outputs = await authStore.query(
    `SELECT title, output_type AS "outputType", worker_id AS "workerId", created_at AS "createdAt"
     FROM worker_outputs
     WHERE user_id = ? AND created_at >= ?
     ORDER BY created_at DESC
     LIMIT 12`,
    user.id, threshold
  );
  const approvals = await authStore.query(
    `SELECT title FROM worker_approval_requests WHERE user_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 8`,
    user.id
  );
  const completedTasks = await authStore.queryOne(
    `SELECT COUNT(*) AS count FROM worker_tasks WHERE user_id = ? AND status = 'completed' AND updated_at >= ?`,
    user.id, threshold
  );

  if (outputs.length === 0 && approvals.length === 0) {
    return false;
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

  await authStore.execute(
    `INSERT INTO user_digest_log (user_id, last_sent_at) VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET last_sent_at = excluded.last_sent_at`,
    user.id, nowIso()
  );
  return true;
}

/**
 * Enqueue per-user digest jobs so multiple replicas do not double-send.
 */
async function enqueueWeeklyDigests() {
  if (DIGEST_INTERVAL_DAYS <= 0) return;
  const threshold = new Date(Date.now() - DIGEST_INTERVAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const weekBucket = Math.floor(Date.now() / (DIGEST_INTERVAL_DAYS * 24 * 60 * 60 * 1000));

  const users = await authStore.query(
    `SELECT DISTINCT u.id, u.email, u.name
     FROM users u
     INNER JOIN hired_workers hw ON hw.user_id = u.id AND hw.status = 'active'
     LEFT JOIN user_digest_log dl ON dl.user_id = u.id
     WHERE u.email_verified_at IS NOT NULL
       AND u.created_at <= ?
       AND hw.hired_at <= ?
       AND (dl.last_sent_at IS NULL OR dl.last_sent_at <= ?)`,
    threshold, threshold, threshold
  );

  for (const user of users) {
    await enqueueJob(jobStore, {
      kind: "weekly_digest",
      userId: user.id,
      payload: { email: user.email, name: user.name, threshold },
      idempotencyKey: `weekly_digest:${user.id}:${weekBucket}`
    });
  }
}

async function runScheduledMaraAutonomy() {
  if (maraAutonomyRunning) return;
  maraAutonomyRunning = true;
  try {
    const workersToRun = await authStore.query(
      // Skip workers whose billing has lapsed: past_due / cancelled subscriptions
      // must not keep spending LLM budget. Empty billing_status ('') covers free
      // and admin hires and is intentionally allowed.
      `SELECT DISTINCT hw.user_id AS "userId", hw.worker_slug AS "workerSlug"
       FROM hired_workers hw
       INNER JOIN office_onboarding_sessions os
         ON os.user_id = hw.user_id AND os.worker_slug = hw.worker_slug
       WHERE hw.status = 'active' AND hw.paused = 0 AND os.status = 'completed'
         AND hw.billing_status NOT IN ('past_due', 'cancelled')`
    );

    const intervalMs = Math.max(60_000, maraAutonomyIntervalMinutes * 60 * 1000);
    const bucket = Math.floor(Date.now() / intervalMs);
    for (const row of workersToRun) {
      if (!hasRoleConfig(row.workerSlug)) continue;
      await enqueueJob(jobStore, {
        kind: "worker_autonomy",
        userId: row.userId,
        workerId: row.workerSlug,
        idempotencyKey: `worker_autonomy:${row.userId}:${row.workerSlug}:${bucket}`
      });
    }

    await enqueueWeeklyDigests();

    const jobs = await claimJobs(jobStore, {
      owner: jobLeaseOwner,
      limit: 20,
      onReclaim: ({ kind }) => incrementMetric("jobs_reclaimed_expired_lease", 1, { kind })
    });
    for (const job of jobs) {
      const stopHeartbeat = ["worker_autonomy", "mara_first_day", "mara_video_analysis"].includes(job.kind)
        ? startJobLeaseHeartbeat(jobStore, job.id, jobLeaseOwner, {
            leaseMs: 15 * 60 * 1000,
            intervalMs: 60_000
          })
        : null;
      try {
        if (job.kind === "weekly_digest") {
          const user = {
            id: job.user_id,
            email: job.payload?.email,
            name: job.payload?.name
          };
          if (!user.email) {
            const row = await authStore.queryOne("SELECT id, email, name FROM users WHERE id = ?", job.user_id);
            if (!row) {
              await completeJob(jobStore, job.id, jobLeaseOwner);
              incrementMetric("jobs_completed", 1, { kind: job.kind });
              continue;
            }
            user.email = row.email;
            user.name = row.name;
          }
          await sendDigestForUser(user, job.payload?.threshold || new Date(Date.now() - DIGEST_INTERVAL_DAYS * 24 * 60 * 60 * 1000).toISOString());
          await completeJob(jobStore, job.id, jobLeaseOwner);
          incrementMetric("jobs_completed", 1, { kind: job.kind });
          continue;
        }

        if (job.kind === "mara_video_analysis") {
          await processVideoAnalysisJob(professionalStore, {
            analysisId: job.payload?.analysisId,
            mediaAssetId: job.payload?.mediaAssetId,
            userId: job.user_id,
            workerId: job.worker_id,
            objectStorage
          });
          await completeJob(jobStore, job.id, jobLeaseOwner);
          incrementMetric("jobs_completed", 1, { kind: job.kind });
          continue;
        }

        if (job.kind === "mara_first_day") {
          const onboarding = await readMaraOnboardingAnswers(job.user_id, job.worker_id);
          const normalizedKnowledge = await readWorkerKnowledgeSections(job.user_id, job.worker_id);
          if (!onboarding || onboarding.status !== "completed") {
            throw new Error("Completed Mara onboarding context was not found.");
          }
          await runMaraFirstDayAutomation({
            userId: job.user_id,
            workerSlug: job.worker_id,
            answers: onboarding.answers,
            generatedSummary: onboarding.generatedSummary,
            normalizedKnowledge
          });
          await completeJob(jobStore, job.id, jobLeaseOwner);
          incrementMetric("jobs_completed", 1, { kind: job.kind });
          continue;
        }

        if (job.kind !== "worker_autonomy") {
          await failJob(jobStore, job.id, jobLeaseOwner, `Unknown job kind: ${job.kind}`);
          incrementMetric("jobs_failed", 1, { kind: job.kind });
          continue;
        }
        const row = { userId: job.user_id, workerSlug: job.worker_id };
        if (row.workerSlug === MARA_SLUG) {
          const gmail = await getWorkerIntegration(row.userId, row.workerSlug, "gmail");
          if (gmail?.status === "connected") {
            await syncGmailInbox(row.userId, row.workerSlug);
          }
          // Full mode: the scheduled loop is exactly where the heavy
          // autonomous work (research, inbox organization) should happen.
          const summary = await runMaraAutonomyCycle({
            store: maraStore,
            mode: "full",
            userId: row.userId,
            workerId: row.workerSlug,
            ...buildMaraExecutionReaders()
          });
          await syncMaraOperationalRecords(row.userId, row.workerSlug);
          const outputIds = Array.isArray(summary?.outputs) ? summary.outputs.map((output) => output?.id).filter(Boolean) : [];
          if (outputIds.length > 0) {
            await syncMaraGmailDraftsForOutputs(row.userId, row.workerSlug, outputIds);
          }
        } else {
          await runAgentAutonomyCycle({
            store: agentStore,
            userId: row.userId,
            workerId: row.workerSlug,
            readers: buildMaraExecutionReaders()
          });
          await syncOfficeCanonicalRecords(row.userId, row.workerSlug);
        }
        await completeJob(jobStore, job.id, jobLeaseOwner);
        incrementMetric("jobs_completed", 1, { kind: job.kind });
      } catch (error) {
        await failJob(jobStore, job.id, jobLeaseOwner, error instanceof Error ? error.message : String(error));
        incrementMetric("jobs_failed", 1, { kind: job.kind });
        logCaught(`Scheduled job failed (${job.kind} ${job.id})`, error);
      } finally {
        if (typeof stopHeartbeat === "function") stopHeartbeat();
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

async function extractWorkerMemorySections(userId, worker, text) {
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
      userId,
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
    logCaught("Worker memory extraction failed:", error);
    return fallbackMemorySectionsFromText(cleaned);
  }
}

async function rememberWorkerDirection(userId, worker, text) {
  const cleaned = String(text ?? "").trim();
  if (!cleaned) return;

  const memorySections = await extractWorkerMemorySections(userId, worker, cleaned);
  await upsertWorkerKnowledge(userId, worker.slug, (knowledge) => mergeKnowledgeSections(knowledge, memorySections));
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

async function buildMaraKnowledgeAdviceFallback(userId, worker, text) {
  const modules = await getMaraRelevantKnowledge({
    store: maraStore,
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
  const [onboarding, knowledge, recentMessages, integrations] = await Promise.all([
    getUserOnboardingRecordAsync(userId),
    readWorkerKnowledgeSections(userId, worker.slug),
    authStore.query(
      `SELECT author, text
       FROM office_chat_messages
       WHERE user_id = ? AND worker_slug = ?
       ORDER BY created_at DESC
       LIMIT 8`,
      userId,
      worker.slug
    ),
    authStore.query(
      `SELECT provider, status, account_label AS "accountLabel"
       FROM office_worker_integrations
       WHERE user_id = ? AND worker_slug = ?
       ORDER BY updated_at DESC`,
      userId,
      worker.slug
    )
  ]);
  const recentThread = recentMessages.reverse();
  const workspace =
    worker.slug === MARA_SLUG
      ? await buildMaraWorkspace(maraStore, userId, worker.slug, {
          readKnowledgeSections: readWorkerKnowledgeSections,
          readOfficeOverlays: readOfficeOverlaysForUser
        })
      : null;
  const relevantKnowledge =
    worker.slug === MARA_SLUG
      ? await getMaraRelevantKnowledge({
          store: maraStore,
          userId,
          userMessage: latestMessage,
          workerId: worker.slug
        })
      : [];

  return createAnthropicMessage({
    maxTokens: 220,
    model,
    userId,
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

let expiredRecordCleanupAt = 0;
let expiredRecordCleanupPromise = null;
async function cleanupExpiredRecords({ force = false } = {}) {
  const nowMs = Date.now();
  if (!force && nowMs - expiredRecordCleanupAt < 15 * 60 * 1000) return;
  if (expiredRecordCleanupPromise) return expiredRecordCleanupPromise;
  expiredRecordCleanupPromise = (async () => {
  const now = nowIso();
  await authStore.execute("DELETE FROM sessions WHERE expires_at < ?", now);
  await authStore.execute("DELETE FROM email_verification_tokens WHERE expires_at < ? OR consumed_at IS NOT NULL", now);
  await authStore.execute("DELETE FROM password_reset_tokens WHERE expires_at < ? OR consumed_at IS NOT NULL", now);
    expiredRecordCleanupAt = Date.now();
  })();
  try {
    await expiredRecordCleanupPromise;
  } finally {
    expiredRecordCleanupPromise = null;
  }
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

  if (!requestOrigin && isProduction) {
    res.status(403).json({ error: "Missing request origin." });
    return;
  }

  if (requestOrigin && requestOrigin !== allowedOrigin) {
    res.status(403).json({ error: "Invalid request origin." });
    return;
  }

  next();
}

async function getUserBySessionToken(rawToken) {
  if (!rawToken) return null;
  await cleanupExpiredRecords();
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  return authStore.queryOne(
      `SELECT users.*
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ? AND sessions.expires_at >= ?`,
    tokenHash,
    nowIso()
  );
}

async function requireAuth(req, res, next) {
  const user = await getUserBySessionToken(req.cookies[sessionCookieName]);
  if (!user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  req.user = user;
  next();
}

async function issueEmailVerification(user) {
  const { hash, raw } = createOpaqueToken();

  await authStore.execute("DELETE FROM email_verification_tokens WHERE user_id = ?", user.id);
  await authStore.execute(
    `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, consumed_at, created_at)
     VALUES (?, ?, ?, ?, NULL, ?)`,
    randomUUID(), user.id, hash, new Date(Date.now() + emailTokenDurationMs).toISOString(), nowIso());

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

  await authStore.execute("DELETE FROM password_reset_tokens WHERE user_id = ?", user.id);
  await authStore.execute(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, consumed_at, created_at)
     VALUES (?, ?, ?, ?, NULL, ?)`,
    randomUUID(), user.id, hash, new Date(Date.now() + resetTokenDurationMs).toISOString(), nowIso());

  const resetUrl = `${appUrl}/?reset_token=${raw}#about`;
  return sendTransactionalEmail({
    html: `<p>Reset your Ryva password:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    subject: "Reset your Ryva password",
    text: `Reset your Ryva password: ${resetUrl}`,
    to: user.email
  });
}

async function createSession(userId) {
  const { hash, raw } = createOpaqueToken();
  await authStore.execute(
    `INSERT INTO sessions (id, token_hash, user_id, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    randomUUID(), hash, userId, new Date(Date.now() + sessionDurationMs).toISOString(), nowIso());
  return raw;
}

function authConfigPayload() {
  return {
    googleEnabled: isGoogleAuthConfigured(),
    supportEmail: String(process.env.SUPPORT_EMAIL || "").trim() || null,
    videoQaEnabled: String(process.env.MARA_DISABLE_VIDEO_QA || "").trim() !== "1"
  };
}

function getGoogleRedirectUri() {
  return getGoogleLoginRedirectUri(appUrl);
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

/* Google OAuth authorize/exchange helpers live in ./googleOAuth.mjs */

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

/* refreshGoogleAccessToken → refreshGoogleAccessTokenShared from ./googleOAuth.mjs */

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
    logCaught("Onboarding reply generation failed:", error);
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

  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!isMaraWorker(workerSlug)) {
    res.status(400).json({ error: "This worker does not have a structured dashboard." });
    return;
  }

  await ensureMaraKnowledge(req.user.id);
  res.json(await getMaraDashboard(req.user.id));
});

app.get("/api/office/workers/:slug/workspace", requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug ?? "").trim();

  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  await ensureWorkerPermissions(maraStore, req.user.id, workerSlug);
  res.json({
    workspace: await buildMaraWorkspace(maraStore, req.user.id, workerSlug, {
      readKnowledgeSections: readWorkerKnowledgeSections,
      readOfficeOverlays: readOfficeOverlaysForUser
    })
  });
});

app.post("/api/office/workers/:slug/tasks/:taskId/run", assertOrigin, requireAuth, expensiveApiLimiter, async (req, res) => {
  const workerSlug = String(req.params.slug ?? "").trim();
  const taskId = String(req.params.taskId ?? "").trim();

  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
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
      result = await runWorkerTask(maraStore, req.user.id, workerSlug, taskId, {
        store: maraStore,
        ...buildMaraExecutionReaders()
      });
      await syncMaraOperationalRecords(req.user.id, workerSlug);
      if (result?.output?.id) {
        await syncMaraGmailDraftsForOutputs(req.user.id, workerSlug, [result.output.id]);
      }
    } else {
      result = await runAgentTask({
        store: agentStore,
        userId: req.user.id,
        workerId: workerSlug,
        taskId,
        readers: buildMaraExecutionReaders()
      });
      await syncOfficeCanonicalRecords(req.user.id, workerSlug);
    }
    res.json({
      ok: true,
      ...result,
      workspace: await buildMaraWorkspace(maraStore, req.user.id, workerSlug, {
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
      store: maraStore,
      taskId,
      userId: req.user.id,
      workerId: MARA_SLUG,
      ...buildMaraExecutionReaders()
    });
    await syncMaraOperationalRecords(req.user.id, MARA_SLUG);
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

  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  try {
    const result = await dismissWorkerTask(maraStore, req.user.id, workerSlug, taskId);
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

  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!title || !description) {
    res.status(400).json({ error: "A task title and description are required." });
    return;
  }

  const result = await createApprovedTaskIfPermissionAllows(maraStore, {
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

  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!hasRoleConfig(workerSlug)) {
    res.status(400).json({ error: "Structured worker approvals are not available for this worker yet." });
    return;
  }

  try {
    const approvalRow = await authStore.queryOne(
      `SELECT action_type AS "actionType", payload_json AS "payloadJson", title, status
       FROM worker_approval_requests
       WHERE id = ? AND user_id = ? AND worker_id = ?`,
      approvalId, req.user.id, workerSlug
    );
    if (!approvalRow) {
      res.status(404).json({ error: "Approval request not found." });
      return;
    }
    if (approvalRow.status !== "pending") {
      res.status(409).json({ error: "This approval request has already been decided or requires reconciliation." });
      return;
    }

    if (status === "approved" && approvalRow.actionType === "send_email") {
      const permissions = await getWorkerPermissions(maraStore, req.user.id, workerSlug);
      const gmail = await getWorkerIntegration(req.user.id, workerSlug, "gmail");
      const policy = evaluateActionPolicy({
        actionType: "send_email",
        workerId: workerSlug,
        permissions,
        integrationConnected: gmail?.status === "connected",
        approvalId
      });
      await appendActionAuditEvent(auditStore, {
        userId: req.user.id,
        workerId: workerSlug,
        actionType: "send_email",
        decision: policy.allowed ? "allowed" : "denied",
        policyVersion: policy.policyVersion,
        reasons: policy.reasons,
        evidence: [{ approvalId, title: approvalRow.title }],
        approvalId,
        idempotencyKey: `approval-policy:${approvalId}`
      });
      if (!policy.allowed) {
        res.status(403).json({ error: policy.reasons.join(" ") });
        return;
      }
    }

    const claimed = await authStore.execute(
      `UPDATE worker_approval_requests SET status = 'processing', updated_at = ?
       WHERE id = ? AND user_id = ? AND worker_id = ? AND status = 'pending'`,
      nowIso(), approvalId, req.user.id, workerSlug
    );
    if (claimed.changes !== 1) {
      res.status(409).json({ error: "This approval request is already being processed." });
      return;
    }

    let result;
    try {
      result = await updateApprovalRequestStatus(
        maraStore,
        req.user.id,
        workerSlug,
        approvalId,
        status,
        isMaraWorker(workerSlug) && status === "approved" ? buildMaraExecutionReaders() : null
      );
    } catch (error) {
      await authStore.execute(
        `UPDATE worker_approval_requests SET status = 'pending', updated_at = ?
         WHERE id = ? AND user_id = ? AND worker_id = ? AND status = 'processing'`,
        nowIso(), approvalId, req.user.id, workerSlug
      );
      throw error;
    }

    // Approve-and-send: an approved send_email request actually sends the
    // Gmail drafts. If sending fails, the approval reopens for retry.
    let emailsSent = 0;
    if (status === "approved" && approvalRow?.actionType === "send_email") {
      const payload = parseJson(approvalRow.payloadJson, {});
      const draftsToSend = (Array.isArray(payload.drafts) ? payload.drafts : []).filter((draft) => draft?.gmailDraftId);
      try {
        for (const draft of draftsToSend) {
          const gmailDraftId = String(draft.gmailDraftId);
          const execution = await claimExternalAction(auditStore, {
            userId: req.user.id,
            workerId: workerSlug,
            actionType: "send_email",
            approvalId,
            idempotencyKey: `gmail-draft:${req.user.id}:${gmailDraftId}`,
            request: { gmailDraftId, subject: draft.subject, to: draft.to }
          });
          if (!execution.claimed) {
            if (execution.status === "completed") continue;
            throw new Error(`Email outcome requires reconciliation (${execution.status}).`);
          }
          let providerResult;
          try {
            providerResult = await sendGmailDraft(req.user.id, workerSlug, gmailDraftId);
            await completeExternalAction(auditStore, execution.id, {
              gmailDraftId,
              messageId: providerResult?.id ?? providerResult?.message?.id ?? null,
              threadId: providerResult?.threadId ?? providerResult?.message?.threadId ?? null
            });
          } catch (error) {
            await markExternalActionUncertain(auditStore, execution.id, error instanceof Error ? error.message : String(error));
            throw error;
          }
          emailsSent += 1;
          await createWorkerActivityLog(maraStore, {
            description: `Sent “${draft.subject}” to ${draft.to} from your Gmail after your approval.`,
            eventType: "email_sent",
            metadata: { outputId: payload.outputId ?? null, subject: draft.subject, to: draft.to },
            title: `Sent: ${draft.subject}`.slice(0, 140),
            userId: req.user.id,
            workerId: workerSlug
          });
        }
        if (emailsSent > 0 && payload.outputId) {
          const outputRow = await authStore.queryOne(
            `SELECT structured_content_json AS "structuredContentJson", title FROM worker_outputs
             WHERE id = ? AND user_id = ? AND worker_id = ?`,
            payload.outputId, req.user.id, workerSlug
          );
          if (outputRow) {
            const structured = parseJson(outputRow.structuredContentJson, {});
            structured.sentAt = nowIso();
            structured.sentCount = emailsSent;
            await authStore.execute(
              "UPDATE worker_outputs SET structured_content_json = ?, updated_at = ? WHERE id = ? AND user_id = ? AND worker_id = ?",
              JSON.stringify(structured), nowIso(), payload.outputId, req.user.id, workerSlug
            );
            // Start or advance follow-up sequence only after a real approved send.
            try {
              const { advanceOutreachSequenceAfterSend, startOutreachSequence } = await import("./maraOutreachSequences.mjs");
              const opportunityId = structured.opportunityId || null;
              const sequenceId = structured.sequenceId || null;
              if (sequenceId || opportunityId) {
                await advanceOutreachSequenceAfterSend(professionalStore, {
                  userId: req.user.id,
                  workerId: workerSlug,
                  sequenceId,
                  opportunityId
                });
              } else if (structured.brandName || outputRow.title) {
                const brandLabel = String(structured.brandName || outputRow.title || "").replace(/^Personalized pitch for\s+/i, "").trim();
                const opp = brandLabel
                  ? await professionalStore.queryOne(
                      `SELECT o.id, o.public_brand_id AS "publicBrandId"
                       FROM mara_creator_brand_opportunities o
                       LEFT JOIN mara_public_brands pb ON pb.id = COALESCE(o.public_brand_id, o.brand_profile_id)
                       WHERE o.user_id = ? AND o.worker_id = ? AND lower(pb.brand_name) = lower(?)
                       ORDER BY o.updated_at DESC LIMIT 1`,
                      req.user.id,
                      workerSlug,
                      brandLabel
                    )
                  : null;
                if (opp?.id) {
                  const { findBestOutreachContact } = await import("./maraContactDiscovery.mjs");
                  const { getAutonomyLimits } = await import("./maraAutonomyLimits.mjs");
                  const contact = opp.publicBrandId
                    ? await findBestOutreachContact(professionalStore, req.user.id, workerSlug, opp.publicBrandId)
                    : null;
                  const autonomyLimits = await getAutonomyLimits(professionalStore, req.user.id, workerSlug);
                  await startOutreachSequence(professionalStore, {
                    userId: req.user.id,
                    workerId: workerSlug,
                    opportunityId: opp.id,
                    publicBrandId: opp.publicBrandId || null,
                    contactId: contact?.id || null,
                    maxAttempts: autonomyLimits.maxFollowUpAttempts
                  });
                }
              }
            } catch (error) {
              log.warn("outreach_sequence_after_send_failed", { error: error?.message });
            }
          }
        }
      } catch (error) {
        await authStore.execute(
          `UPDATE worker_approval_requests SET status = 'needs_reconciliation', updated_at = ?
           WHERE id = ? AND user_id = ? AND worker_id = ?`,
          nowIso(), approvalId, req.user.id, workerSlug
        );
        res.status(502).json({
          error: `Gmail did not confirm the final outcome (${error instanceof Error ? error.message.slice(0, 120) : "Gmail error"}). Ryva will not retry automatically; review the Gmail Sent folder before reconciling this action.`
        });
        return;
      }
    }

    if (isMaraWorker(workerSlug)) {
      await syncMaraOperationalRecords(req.user.id, workerSlug);
    } else {
      await syncOfficeCanonicalRecords(req.user.id, workerSlug);
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
      workspace: await buildMaraWorkspace(maraStore, req.user.id, workerSlug, {
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

  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
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

// Disconnect an inbox: revoke the OAuth token at the provider, delete the stored
// integration (and its encrypted tokens), and drop the email permissions.
app.post("/api/office/workers/:slug/disconnect-email", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug ?? "").trim();
  const provider = String(req.body?.provider ?? "gmail").trim().toLowerCase();

  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  const integration = await getWorkerIntegration(req.user.id, workerSlug, provider);

  // Best-effort revocation at Google so the token is dead even after we forget it.
  if (provider === "gmail" && integration?.metadata) {
    const token = String(integration.metadata.refreshToken || integration.metadata.accessToken || "").trim();
    if (token) {
      try {
        await fetch("https://oauth2.googleapis.com/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token }).toString()
        });
      } catch (error) {
        log.warn("oauth_revoke_failed", { userId: req.user.id, provider, error: error?.message });
      }
    }
  }

  await authStore.execute(
    "DELETE FROM office_worker_integrations WHERE user_id = ? AND worker_slug = ? AND provider = ?",
    req.user.id, workerSlug, provider
  );

  // Drop the permissions that depended on the inbox connection.
  await updateWorkerPermissions(maraStore, req.user.id, workerSlug, {
    canReadInbox: false,
    canDraftOutreach: false,
    canSendEmailsWithApproval: false,
    canUseConnectedIntegrations: false
  });

  await authStore.execute(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  , randomUUID(), req.user.id, workerSlug, "Disconnected an inbox.", "Integrations", provider, nowIso());

  res.json({ ok: true });
});

app.post("/api/office/workers/:slug/autonomy/run", assertOrigin, requireAuth, expensiveApiLimiter, async (req, res) => {
  const workerSlug = String(req.params.slug ?? "").trim();

  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!hasRoleConfig(workerSlug)) {
    res.status(400).json({ error: "This worker does not support autonomy runs yet." });
    return;
  }

  if (await isWorkerPaused(req.user.id, workerSlug)) {
    res.status(409).json({ error: "This worker is paused. Resume them from their desk to run work." });
    return;
  }

  if (await isWorkerBillingLapsed(req.user.id, workerSlug)) {
    res.status(402).json({ error: "This worker's billing is past due. Update payment to resume their work." });
    return;
  }

  try {
    let summary;
    if (isMaraWorker(workerSlug)) {
      // Fast interactive pass now. Heavy work is queued durably so a deploy or
      // process restart cannot silently discard the manager's requested run.
      summary = await runMaraAutonomyCycle({
        store: maraStore,
        mode: "interactive",
        userId: req.user.id,
        workerId: workerSlug,
        ...buildMaraExecutionReaders()
      });
      await syncMaraOperationalRecords(req.user.id, workerSlug);
      const queuedFullRun = await enqueueJob(jobStore, {
        kind: "worker_autonomy",
        userId: req.user.id,
        workerId: workerSlug,
        payload: { requestedBy: "manager", requestedAt: nowIso() },
        idempotencyKey: `manager_autonomy:${req.user.id}:${workerSlug}:${randomUUID()}`
      });
      summary.notes = [
        ...(Array.isArray(summary.notes) ? summary.notes : []),
        `Full research run queued as ${queuedFullRun.id}.`
      ];
      // Wake the consumer now for responsiveness. The queued record remains
      // recoverable by the next scheduler tick if this process exits.
      if (autonomySchedulerEnabled) {
        void runScheduledMaraAutonomy().catch((error) => logCaught("Queued autonomy wake failed:", error));
      }
    } else {
      summary = await runAgentAutonomyCycle({
        store: agentStore,
        userId: req.user.id,
        workerId: workerSlug,
        readers: buildMaraExecutionReaders()
      });
      await syncOfficeCanonicalRecords(req.user.id, workerSlug);
    }
    const workspace = await buildMaraWorkspace(maraStore, req.user.id, workerSlug, {
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
        logCaught("Mara Gmail draft sync failed after autonomy run:", error);
      });
    }
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not run worker autonomy." });
  }
});

app.post("/api/office/workers/:slug/pause", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug ?? "").trim();
  const paused = Boolean(req.body?.paused);

  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  await authStore.tx(async (transaction) => {
    await transaction.execute(
      "UPDATE hired_workers SET paused = ? WHERE user_id = ? AND worker_slug = ? AND status = 'active'",
      paused ? 1 : 0,
      req.user.id,
      workerSlug
    );
    await transaction.execute(
      `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      randomUUID(),
      req.user.id,
      workerSlug,
      paused ? "Paused autonomous work." : "Resumed autonomous work.",
      "People",
      paused ? "No background work or AI usage until resumed" : "Back on the clock",
      nowIso()
    );
  });

  res.json({ ok: true, paused });
});

/**
 * OPS-ONLY weekly TikTok trend intake. The platform operator pastes this
 * week's trend data once; it becomes the GLOBAL trend source, and every
 * user's Mara scopes it to their own niche automatically. Users never see
 * this — to them, trend intelligence is simply part of Mara.
 */
app.post("/api/office/workers/:slug/trends/manual", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug ?? "").trim();
  const text = String(req.body?.text ?? "").trim();

  if (!isAdminUser(req.user)) {
    res.status(403).json({ error: "Not available." });
    return;
  }
  if (text.length < 10) {
    res.status(400).json({ error: "Paste this week's trend notes — hashtags, view counts, anything you have." });
    return;
  }

  try {
    let parsed = await tryParseTrendPaste({ userId: req.user.id, text, niche: "" });
    let parsedBy = "llm";
    if (!parsed) {
      parsed = parseTrendPasteHeuristic(text);
      parsedBy = "heuristic";
    }
    if ((parsed.hashtags?.length ?? 0) === 0 && (parsed.contentGaps?.length ?? 0) === 0) {
      res.status(400).json({ error: "No hashtags or content gaps found. Include lines like '#glowyskin — 2.1M views'." });
      return;
    }

    // Write the global source every user's Mara reads from.
    const globalPayload = {
      capturedAt: nowIso(),
      contentGaps: (parsed.contentGaps ?? []).map((gap) => ({ gap: gap.label, label: gap.label, note: gap.note ?? "" })),
      hashtags: (parsed.hashtags ?? []).map((entry) => ({
        categories: [],
        hashtag: entry.hashtag,
        note: entry.note ?? "",
        posts: entry.posts ?? "",
        views: entry.views ?? ""
      })),
      loginWallEncountered: false,
      notes: parsed.notes ?? [],
      periodDays: 7,
      region: parsed.region || "US",
      source: "manual_ops_intake",
      sourceUrl: "",
      updatedAt: nowIso()
    };
    await fs.writeFile(privateInsightsPath, `${JSON.stringify(globalPayload, null, 2)}\n`, "utf8");
    // Shared SoT for all replicas — DB, not local disk alone.
    await saveGlobalTrendInsights(trendStore, globalPayload, { source: "manual_ops_intake" });

    // Invalidate every user's scoped snapshot so fresh data flows through
    // on their next cycle — silently, as if Mara found it herself.
    const invalidated = (await authStore.execute("DELETE FROM worker_trend_snapshots WHERE platform = 'tiktok'")).changes;

    // Give the admin's own Mara an immediate refresh for verification.
    let outputTitle = null;
    if ((await hasHiredWorker(req.user.id, workerSlug)) && isMaraWorker(workerSlug)) {
      await syncUserTrendInsightsFromGlobal({
        store: trendStore,
        globalPath: privateInsightsPath,
        readAccountContext: getUserOnboardingRecordAsync,
        readMaraOnboarding: readMaraOnboardingAnswers,
        readWorkerKnowledge: readWorkerKnowledgeSections,
        storageRoot: resolveStorageRoot(),
        objectStorage,
        userId: req.user.id,
        workerId: workerSlug
      });
      const created = await createApprovedTaskIfPermissionAllows(maraStore, {
        description: "Turn this week's trend data into a hashtag plan mapped to content gaps.",
        priority: "high",
        requiredPermissions: [],
        source: "autonomy_tiktok_trends",
        status: "approved",
        taskType: "tiktok_trend_pulse",
        title: `TikTok hashtag plan — week of ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
        userId: req.user.id,
        workerId: workerSlug
      });
      if (created?.id) {
        const result = await runMaraTask({ store: maraStore, taskId: created.id, userId: req.user.id, workerId: workerSlug, ...buildMaraExecutionReaders() });
        outputTitle = result?.output?.title ?? null;
      }
      // Seed the creative loop: content ideas + portfolio samples from the same intake.
      for (const followOn of [
        {
          taskType: "content_idea_batch",
          title: "Content idea batch from this week's trends",
          description: "Build 10 UGC concepts from this week's content gaps and trending hashtags.",
          priority: "high"
        },
        {
          taskType: "portfolio_recommendations",
          title: "Portfolio samples from this week's gaps",
          description: "Recommend portfolio sample projects grounded in current trend gaps and brand creative gaps.",
          priority: "medium"
        }
      ]) {
        await createApprovedTaskIfPermissionAllows(maraStore, {
          ...followOn,
          requiredPermissions: [],
          source: "autonomy_tiktok_trends",
          status: "approved",
          userId: req.user.id,
          workerId: workerSlug
        });
      }
      await syncMaraOperationalRecords(req.user.id, workerSlug);
    }

    res.json({
      ok: true,
      parsedBy,
      hashtagCount: globalPayload.hashtags.length,
      gapCount: globalPayload.contentGaps.length,
      usersInvalidated: invalidated,
      outputTitle
    });
  } catch (error) {
    logCaught("Trend intake failed:", error);
    res.status(500).json({ error: "Trend intake failed. Try again." });
  }
});

app.post("/api/office/workers/:slug/sync-trends", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug ?? "").trim();

  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!isMaraWorker(workerSlug)) {
    res.status(400).json({ error: "Trend sync is only available for Mara." });
    return;
  }


  try {
    const syncResult = await syncUserTrendInsightsFromGlobal({
      store: trendStore,
      globalPath: privateInsightsPath,
      readAccountContext: getUserOnboardingRecordAsync,
      readMaraOnboarding: readMaraOnboardingAnswers,
      readWorkerKnowledge: readWorkerKnowledgeSections,
      storageRoot: resolveStorageRoot(),
      objectStorage,
      userId: req.user.id,
      workerId: workerSlug
    });
    await syncMaraOperationalRecords(req.user.id, workerSlug);
    res.json({
      dashboard: await getMaraDashboard(req.user.id),
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

  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!isMaraWorker(workerSlug)) {
    res.status(400).json({ error: "Structured scans are not available for this worker." });
    return;
  }

  const hasConnectedEmail = await authStore.queryOne(
    `SELECT id
     FROM office_worker_integrations
     WHERE user_id = ? AND worker_slug = ? AND provider IN ('gmail', 'outlook') AND status = ?`,
    req.user.id, workerSlug, "connected"
  );

  if (!hasConnectedEmail) {
    res.status(400).json({
      error: "Connect Gmail or Outlook before running an email scan. Mara can still help with briefs, tasks, and operating context without inbox access."
    });
    return;
  }

  try {
    const syncResult = await syncGmailInbox(req.user.id, workerSlug);
    const summary = await runMaraAutonomyCycle({
      store: maraStore,
      userId: req.user.id,
      workerId: workerSlug,
      ...buildMaraExecutionReaders()
    });
    await syncMaraOperationalRecords(req.user.id, workerSlug);
    const outputIds = Array.isArray(summary?.outputs) ? summary.outputs.map((output) => output?.id).filter(Boolean) : [];
    if (outputIds.length > 0) {
      await syncMaraGmailDraftsForOutputs(req.user.id, workerSlug, outputIds);
    }
    await insertMaraSyncJob(req.user.id, "gmail", "generate_daily_mara_brief", `Mara synced ${syncResult.syncedCount} Gmail message${syncResult.syncedCount === 1 ? "" : "s"} and refreshed her working brief.`);
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Could not sync Gmail right now." });
    return;
  }

  await authStore.execute(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ,
    randomUUID(),
    req.user.id,
    MARA_SLUG,
    "Requested inbox scan.",
    "Mara",
    "Connected Gmail inbox synced for real campaign and thread ingestion",
    nowIso()
  );

  res.json({ ok: true, dashboard: await getMaraDashboard(req.user.id) });
});

app.post("/api/office/workers/:slug/suggested-actions/:actionId", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug ?? "").trim();
  const actionId = String(req.params.actionId ?? "").trim();
  const decision = String(req.body?.decision ?? "").trim().toLowerCase();
  const note = String(req.body?.note ?? "").trim();

  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!isMaraWorker(workerSlug)) {
    res.status(400).json({ error: "Suggested actions are not available for this worker." });
    return;
  }

  const action = await authStore.queryOne(
    `SELECT *
     FROM office_suggested_actions
     WHERE id = ? AND user_id = ? AND worker_slug = ?`,
    actionId, req.user.id, workerSlug
  );

  if (!action) {
    res.status(404).json({ error: "Suggested action not found." });
    return;
  }

  if (!["approve", "reject", "revise", "edit"].includes(decision)) {
    res.status(400).json({ error: "Unsupported decision." });
    return;
  }
  if (!["suggested", "edited"].includes(String(action.status))) {
    res.status(409).json({ error: "This suggested action has already been decided." });
    return;
  }

  const payload = parseJson(action.payload_json, {});
  const nextStatus = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "edited";
  await authStore.tx(async (transaction) => {
    const claimed = await transaction.execute(
      `UPDATE office_suggested_actions SET status = ?, updated_at = ?
       WHERE id = ? AND user_id = ? AND status IN ('suggested', 'edited')`,
      nextStatus, nowIso(), actionId, req.user.id
    );
    if (claimed.changes !== 1) {
      const error = new Error("This suggested action has already been decided.");
      error.statusCode = 409;
      throw error;
    }
    if (decision === "approve" && action.action_type === "create_calendar_event" && payload?.event?.title) {
      const startsAt = new Date(Date.now() + 1000 * 60 * 60 * 22).toISOString();
      const endsAt = new Date(Date.now() + 1000 * 60 * 60 * 23).toISOString();
      await transaction.execute(
        `INSERT INTO office_calendar_events
          (id, user_id, worker_slug, title, starts_at, ends_at, event_type, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        randomUUID(), req.user.id, workerSlug, payload.event.title, startsAt, endsAt,
        String(payload.event.eventType ?? "Focus"), "Approved from Mara's suggested actions.", nowIso(), nowIso()
      );
    }
    if (decision === "approve" && action.action_type === "draft_email") {
      await transaction.execute(
        `INSERT INTO office_chat_messages (id, user_id, worker_slug, author, text, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        randomUUID(), req.user.id, workerSlug, "Worker", `Draft approved: ${String(payload?.draftText ?? action.title)}`, nowIso()
      );
    }
    if ((decision === "revise" || decision === "edit") && note) {
      await transaction.execute(
        `UPDATE office_suggested_actions SET description = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
        `${action.description} ${decision === "edit" ? "Edit requested" : "Revision requested"}: ${note}`,
        nowIso(), actionId, req.user.id
      );
    }
    await transaction.execute(
      `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      randomUUID(), req.user.id, workerSlug,
      decision === "approve" ? "Approved suggested action." : decision === "reject" ? "Rejected suggested action." : decision === "edit" ? "Requested edit." : "Requested revision.",
      "Mara", action.title, nowIso()
    );
    await appendActionAuditEvent(transaction, {
      userId: req.user.id,
      workerId: workerSlug,
      actionType: String(action.action_type || "suggested_action"),
      decision: decision === "approve" ? "allowed" : decision === "reject" ? "denied" : "revision_requested",
      policyVersion: "manager-decision/2026-07-12.1",
      reasons: [`Manager selected ${decision}.`],
      evidence: [{ actionId, title: action.title }],
      approvalId: decision === "approve" ? actionId : null,
      idempotencyKey: `suggested-action:${actionId}:${decision}`
    });
  });

  res.json({ ok: true, dashboard: await getMaraDashboard(req.user.id) });
});

app.post("/api/office/workers/:slug/opportunities/:opportunityId", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug ?? "").trim();
  const opportunityId = String(req.params.opportunityId ?? "").trim();
  const status = String(req.body?.status ?? "").trim();

  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
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

  const opportunity = await authStore.queryOne(
      `SELECT brand_name AS "brandName"
       FROM office_brand_opportunities
       WHERE id = ? AND user_id = ? AND worker_slug = ?`,
    opportunityId, req.user.id, workerSlug);

  if (!opportunity) {
    res.status(404).json({ error: "Opportunity not found." });
    return;
  }

  await authStore.execute(
    `UPDATE office_brand_opportunities
     SET status = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`
  , status, nowIso(), opportunityId, req.user.id);

  await authStore.execute(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  , randomUUID(), req.user.id, workerSlug, "Updated brand opportunity.", "Mara", `${opportunity.brandName} → ${status}`, nowIso());

  res.json({ ok: true, dashboard: await getMaraDashboard(req.user.id) });
});

app.get("/api/office/overlays", requireAuth, async (req, res) => {
  try {
    ensureOfficeSchema();
    const workerRows = await authStore.query(
      `SELECT worker_slug AS "workerSlug"
       FROM hired_workers
       WHERE user_id = ? AND status = 'active'`,
      req.user.id
    );

    for (const row of workerRows) {
      await syncOfficeCanonicalRecords(req.user.id, row.workerSlug);
    }

    res.json(await readOfficeOverlaysForUser(req.user.id));
  } catch (error) {
    logCaught("Office overlays load failed:", error);
    res.status(500).json({ error: "The office could not finish loading right now." });
  }
});

app.post("/api/office/calendar/events", assertOrigin, requireAuth, async (req, res) => {
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
  await authStore.execute(
    `INSERT INTO office_calendar_events
      (id, user_id, worker_slug, title, starts_at, ends_at, event_type, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  , id, req.user.id, workerSlug, title, startsAt, endsAt, eventType, notes, nowIso(), nowIso());

  res.status(201).json({ ok: true, id });
});

app.post("/api/office/calendar/events/:eventId", assertOrigin, requireAuth, async (req, res) => {
  const eventId = String(req.params.eventId ?? "").trim();
  const existing = await authStore.queryOne(`SELECT id FROM office_calendar_events WHERE id = ? AND user_id = ?`, eventId, req.user.id);

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

  await authStore.execute(
    `UPDATE office_calendar_events
     SET worker_slug = ?, title = ?, starts_at = ?, ends_at = ?, event_type = ?, notes = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`
  , workerSlug, title, startsAt, endsAt, eventType, notes, nowIso(), eventId, req.user.id);

  res.json({ ok: true });
});

app.post("/api/office/calendar/events/:eventId/delete", assertOrigin, requireAuth, async (req, res) => {
  const eventId = String(req.params.eventId ?? "").trim();
  const existing = await authStore.queryOne(`SELECT id FROM office_calendar_events WHERE id = ? AND user_id = ?`, eventId, req.user.id);

  if (!existing) {
    res.status(404).json({ error: "Calendar event not found." });
    return;
  }

  await authStore.execute(`DELETE FROM office_calendar_events WHERE id = ? AND user_id = ?`, eventId, req.user.id);
  res.json({ ok: true });
});

app.get("/api/office/deliverables/:deliverableId", requireAuth, async (req, res) => {
  const deliverableId = String(req.params.deliverableId ?? "").trim();
  const workers = await readWorkers();
  const deliverable = await authStore.queryOne(
      `SELECT id, worker_slug AS "workerSlug", source_type AS "sourceType", source_id AS "sourceId", title, summary,
              deliverable_type AS "deliverableType", preview_text AS "previewText", content_ref_id AS "contentRefId"
       FROM office_deliverables
       WHERE id = ? AND user_id = ?`,
    deliverableId, req.user.id);

  if (!deliverable) {
    // Worker desks reference the canonical worker-output id, while the
    // library uses a separate display-record id. Accept either, scoped to the
    // signed-in user, so completed work opens consistently everywhere.
    const directOutput = await authStore.queryOne(
      `SELECT id, worker_id AS "workerSlug", output_type AS "outputType", title, content,
              structured_content_json AS "structuredContentJson"
       FROM worker_outputs WHERE id = ? AND user_id = ?`,
      deliverableId, req.user.id
    );
    if (directOutput) {
      const directWorker = workers.find((entry) => entry.slug === directOutput.workerSlug);
      res.json({
        deliverable: {
          content: directOutput.outputType === "creator_positioning"
            ? personalizeCreatorPositioningText(directOutput.content)
            : String(directOutput.content ?? ""),
          previewText: "",
          structuredContent: directOutput.outputType === "creator_positioning"
            ? personalizeCreatorPositioningStructured(parseJson(directOutput.structuredContentJson, null))
            : parseJson(directOutput.structuredContentJson, null),
          summary: "",
          title: directOutput.title,
          type: sentenceCase(String(directOutput.outputType || "deliverable").replace(/_/g, " ")),
          workerName: directWorker?.name ?? "Worker"
        }
      });
      return;
    }
    res.status(404).json({ error: "Deliverable not found." });
    return;
  }

  const worker = workers.find((entry) => entry.slug === deliverable.workerSlug);

  if (deliverable.sourceType === "worker_output" || deliverable.contentRefId || deliverable.sourceId) {
    // Resolve the full output through a fallback chain so the reader never
    // silently degrades to a truncated summary: ref id → source id → title.
    const outputQuery = `SELECT output_type AS "outputType", title, content, structured_content_json AS "structuredContentJson"
       FROM worker_outputs
       WHERE id = ? AND user_id = ? AND worker_id = ?`;
    let output = deliverable.contentRefId
      ? await authStore.queryOne(outputQuery, deliverable.contentRefId, req.user.id, deliverable.workerSlug)
      : null;
    if (!output && deliverable.sourceId && deliverable.sourceId !== deliverable.contentRefId) {
      output = await authStore.queryOne(outputQuery, deliverable.sourceId, req.user.id, deliverable.workerSlug);
    }
    if (!output) {
      output = await authStore.queryOne(
          `SELECT output_type AS "outputType", title, content, structured_content_json AS "structuredContentJson"
           FROM worker_outputs
           WHERE user_id = ? AND worker_id = ? AND title = ?
           ORDER BY created_at DESC
           LIMIT 1`,
        req.user.id, deliverable.workerSlug, deliverable.title);
    }

    if (output) {
      res.json({
        deliverable: {
          content: output.outputType === "creator_positioning"
            ? personalizeCreatorPositioningText(output.content)
            : String(output.content ?? ""),
          previewText: deliverable.previewText,
          structuredContent: output.outputType === "creator_positioning"
            ? personalizeCreatorPositioningStructured(parseJson(output.structuredContentJson, null))
            : parseJson(output.structuredContentJson, null),
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
  const file = await authStore.queryOne(
      `SELECT id, user_id, name, type, stored_name
       FROM office_uploaded_files
       WHERE id = ? AND user_id = ?`,
    req.params.fileId,
    req.user.id
  );

  if (!file) {
    res.status(404).json({ error: "File not found." });
    return;
  }

  try {
    const body = await objectStorage.get({ userId: req.user.id, storedName: file.stored_name });
    res.setHeader("Content-Type", file.type || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    res.send(body);
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
    scope: GOOGLE_LOGIN_SCOPES,
    state: nonce
  });

  res.redirect(authorizationUrl.toString());
});

app.get("/api/account/delete/google", requireAuth, async (req, res) => {
  if (!isGoogleAuthConfigured()) {
    res.status(501).json({ error: "Google auth is not configured. Set a password or contact support to delete this account." });
    return;
  }
  const nonce = randomBytes(24).toString("hex");
  const statePayload = { kind: "account_delete", nonce, userId: req.user.id };
  setGoogleStateCookie(res, encodeGoogleStatePayload(statePayload));
  const authorizationUrl = buildGoogleAuthorizationUrl({
    redirectUri: getGoogleRedirectUri(),
    scope: GOOGLE_LOGIN_SCOPES,
    state: nonce,
    prompt: "consent"
  });
  res.redirect(authorizationUrl.toString());
});

app.get("/api/account/security", requireAuth, async (req, res) => {
  const row = await authStore.queryOne(
    `SELECT password_is_set AS "passwordIsSet" FROM users WHERE id = ?`,
    req.user.id
  );
  res.json({
    passwordIsSet: Number(row?.passwordIsSet ?? 1) === 1,
    googleEnabled: isGoogleAuthConfigured()
  });
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
    const tokens = await exchangeGoogleCodeForTokens(code, getGoogleRedirectUri());
    const profile = await fetchGoogleProfile(String(tokens.access_token ?? ""));
    const normalizedEmail = normalizeEmail(profile.email);

    if (!normalizedEmail || !profile.email_verified) {
      res.redirect(`${appUrl}/?notice=google-email-unverified#home`);
      return;
    }

    if (statePayload.kind === "account_delete") {
      const userId = String(statePayload.userId ?? "").trim();
      const user = await authStore.queryOne(
        `SELECT id, email, password_hash AS "passwordHash", password_is_set AS "passwordIsSet" FROM users WHERE id = ?`,
        userId
      );
      if (!user || normalizeEmail(user.email) !== normalizedEmail) {
        res.redirect(`${appUrl}/?notice=google-auth-failed#app/office`);
        return;
      }
      const erased = await eraseUserAccount(user.id);
      if (!erased.ok) {
        res.redirect(`${appUrl}/?notice=account-delete-failed#app/office`);
        return;
      }
      clearSessionCookie(res);
      res.redirect(`${appUrl}/?notice=account-deleted#home`);
      return;
    }

    let user = await authStore.queryOne("SELECT * FROM users WHERE email = ?", normalizedEmail);
    if (!user) {
      const createdAt = nowIso();
      const newUser = {
        created_at: createdAt,
        email: normalizedEmail,
        email_verified_at: createdAt,
        id: randomUUID(),
        name: String(profile.name ?? profile.given_name ?? normalizedEmail.split("@")[0]).trim(),
        password_hash: hashPassword(randomUUID()),
        password_is_set: 0
      };

      await authStore.execute(
        `INSERT INTO users (id, email, name, password_hash, email_verified_at, created_at, password_is_set)
         VALUES (?, ?, ?, ?, ?, ?, 0)`
      ,
        newUser.id,
        newUser.email,
        newUser.name,
        newUser.password_hash,
        newUser.email_verified_at,
        newUser.created_at
      );

      user = newUser;
    }

    await authStore.execute("DELETE FROM sessions WHERE user_id = ?", user.id);
    const sessionToken = await createSession(user.id);
    setSessionCookie(res, sessionToken);
    res.redirect(`${appUrl}/#app/office`);
  } catch {
    res.redirect(`${appUrl}/?notice=google-auth-failed#home`);
  }
});

app.get("/api/office/workers/:slug/connect-email/google", requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug ?? "").trim();

  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
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
    redirectUri: getGmailConnectRedirectUri(appUrl, workerSlug),
    scope: GMAIL_CONNECT_SCOPES,
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

  if (!(await hasHiredWorker(statePayload.userId, workerSlug))) {
    res.redirect(`${appUrl}/?notice=gmail-connect-failed#app/office`);
    return;
  }

  try {
    const tokens = await exchangeGoogleCodeForTokens(code, getGmailConnectRedirectUri(appUrl, workerSlug));
    const profile = await fetchGoogleProfile(String(tokens.access_token ?? ""));
    const gmailProfileResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: {
        Authorization: `Bearer ${String(tokens.access_token ?? "")}`
      }
    });
    const gmailProfile = gmailProfileResponse.ok ? await gmailProfileResponse.json() : {};
    const emailAddress = String(gmailProfile.emailAddress ?? profile.email ?? "").trim();
    const existing = await getWorkerIntegration(statePayload.userId, workerSlug, "gmail");
    const nextMetadata = mergeOAuthTokenMetadata(existing?.metadata || {}, {
      accessToken: String(tokens.access_token ?? ""),
      emailAddress,
      expiresAt: new Date(Date.now() + Number(tokens.expires_in ?? 3600) * 1000).toISOString(),
      refreshToken: String(tokens.refresh_token ?? "").trim()
    });
    await upsertWorkerIntegration(statePayload.userId, workerSlug, "gmail", "connected", "Gmail inbox", nextMetadata);
    await updateWorkerPermissions(maraStore, statePayload.userId, workerSlug, {
      canDraftOutreach: true,
      canReadInbox: true,
      canSendEmailsWithApproval: false,
      canUseConnectedIntegrations: true
    });
    await syncGmailInbox(statePayload.userId, workerSlug);
    {
      const summary = await runMaraAutonomyCycle({
        store: maraStore,
        userId: statePayload.userId,
        workerId: workerSlug,
        ...buildMaraExecutionReaders()
      });
      await syncMaraOperationalRecords(statePayload.userId, workerSlug);
      const outputIds = Array.isArray(summary?.outputs) ? summary.outputs.map((output) => output?.id).filter(Boolean) : [];
      if (outputIds.length > 0) {
        await syncMaraGmailDraftsForOutputs(statePayload.userId, workerSlug, outputIds);
      }
    }
    res.redirect(`${appUrl}/?notice=gmail-connected#app/office/desk/${workerSlug}`);
  } catch (error) {
    logCaught("Gmail connect failed:", error);
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
  const existing = await authStore.queryOne("SELECT id FROM users WHERE email = ?", normalizedEmail);
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

  await authStore.execute(
    `INSERT INTO users (id, email, name, password_hash, email_verified_at, created_at, password_is_set)
     VALUES (?, ?, ?, ?, NULL, ?, 1)`
  , user.id, user.email, user.name, user.password_hash, user.created_at);

  const sessionToken = await createSession(user.id);
  setSessionCookie(res, sessionToken);
  res.status(201).json({
    emailVerificationQueued: true,
    user: await toSafeUser(user)
  });

  void issueEmailVerification(user).catch((error) => {
    logCaught("Email verification delivery failed on register:", error);
  });
});

app.post("/api/auth/login", authLimiter, assertOrigin, async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  const user = await authStore.queryOne("SELECT * FROM users WHERE email = ?", normalizeEmail(email));
  if (!user || !verifyPassword(String(password), user.password_hash)) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  await authStore.execute("DELETE FROM sessions WHERE user_id = ?", user.id);
  const sessionToken = await createSession(user.id);
  setSessionCookie(res, sessionToken);
  res.json({ user: await toSafeUser(user) });
});

app.post("/api/auth/logout", assertOrigin, async (req, res) => {
  const rawToken = req.cookies[sessionCookieName];
  if (rawToken) {
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await authStore.execute("DELETE FROM sessions WHERE token_hash = ?", tokenHash);
  }

  clearSessionCookie(res);
  res.status(204).end();
});

app.get("/api/auth/me", async (req, res) => {
  const user = await getUserBySessionToken(req.cookies[sessionCookieName]);
  res.json({ user: user ? await toSafeUser(user) : null });
});

app.get("/api/onboarding", requireAuth, async (req, res) => {
  const onboarding = await getUserOnboardingRecordAsync(req.user.id);
  res.json({
    onboarding,
    user: {
      name: req.user.name,
      onboarded: Boolean(onboarding?.completedAt)
    }
  });
});

app.post("/api/onboarding/complete", assertOrigin, requireAuth, async (req, res) => {
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

  await authStore.tx(async (transaction) => {
    await transaction.execute("UPDATE users SET name = ? WHERE id = ?", name, req.user.id);
    await transaction.execute(
      `INSERT INTO user_onboarding (user_id, brand_name, what_you_do, completed_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET brand_name = excluded.brand_name,
         what_you_do = excluded.what_you_do, completed_at = excluded.completed_at`,
      req.user.id, brandName, whatYouDo, nowIso()
    );
  });

  const refreshedUser = await authStore.queryOne("SELECT * FROM users WHERE id = ?", req.user.id);
  const onboarding = await getUserOnboardingRecordAsync(req.user.id);
  await seedOfficeSettingsFromOnboarding(refreshedUser, onboarding);

  res.json({
    ok: true,
    user: await toSafeUser(refreshedUser)
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
    logCaught("Email verification resend failed:", error);
    res.status(502).json({ error: "We couldn't send the verification email right now. Please try again shortly." });
  }
});

app.get("/api/auth/verify-email", async (req, res) => {
  const token = String(req.query.token ?? "");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const record = await authStore.queryOne(
      `SELECT * FROM email_verification_tokens
       WHERE token_hash = ? AND consumed_at IS NULL AND expires_at >= ?`,
    tokenHash,
    nowIso()
  );

  if (!record) {
    res.redirect(`${appUrl}/?notice=verification-invalid#about`);
    return;
  }

  await authStore.tx(async (transaction) => {
    const verifiedAt = nowIso();
    await transaction.execute("UPDATE email_verification_tokens SET consumed_at = ? WHERE id = ?", verifiedAt, record.id);
    await transaction.execute("UPDATE users SET email_verified_at = ? WHERE id = ?", verifiedAt, record.user_id);
  });
  res.redirect(`${appUrl}/?notice=email-verified#workers`);
});

app.post("/api/auth/request-password-reset", authLimiter, assertOrigin, async (req, res) => {
  const { email } = req.body ?? {};
  if (!email) {
    res.status(400).json({ error: "Email is required." });
    return;
  }

  const user = await authStore.queryOne("SELECT * FROM users WHERE email = ?", normalizeEmail(email));
  if (user) {
    try {
      const mailResult = await issuePasswordReset(user);
      res.json({ ok: true, preview: mailResult.preview, sent: Boolean(mailResult.sent) });
      return;
    } catch (error) {
      logCaught("Password reset delivery failed:", error);
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
  const record = await authStore.queryOne(
      `SELECT * FROM password_reset_tokens
       WHERE token_hash = ? AND consumed_at IS NULL AND expires_at >= ?`,
    tokenHash,
    nowIso()
  );

  if (!record) {
    res.status(400).json({ error: "Password reset token is invalid or expired." });
    return;
  }

  await authStore.tx(async (transaction) => {
    await transaction.execute("UPDATE password_reset_tokens SET consumed_at = ? WHERE id = ?", nowIso(), record.id);
    await transaction.execute("UPDATE users SET password_hash = ?, password_is_set = 1 WHERE id = ?", hashPassword(String(password)), record.user_id);
    await transaction.execute("DELETE FROM sessions WHERE user_id = ?", record.user_id);
  });
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

  if (await hasHiredWorker(req.user.id, workerSlug)) {
    res.status(409).json({ error: "You have already hired this worker." });
    return;
  }

  const unitAmount = Number.parseInt(worker.salary.replace(/[^0-9]/g, ""), 10) * 100;
  const checkoutId = randomUUID();
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (unitAmount === 0 || isAdmin) {
    await authStore.tx(async (transaction) => {
      const timestamp = nowIso();
      await transaction.execute(
        `INSERT INTO checkout_sessions (id, user_id, worker_slug, amount_cents, stripe_session_id, status, created_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        checkoutId, req.user.id, worker.slug, unitAmount, null, "completed", timestamp, timestamp
      );
      await transaction.execute(
        `INSERT INTO hired_workers (id, user_id, worker_slug, checkout_session_id, status, hired_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, worker_slug) DO UPDATE SET checkout_session_id = excluded.checkout_session_id,
           status = excluded.status, hired_at = excluded.hired_at`,
        randomUUID(), req.user.id, worker.slug, checkoutId, "active", timestamp
      );
    });

    res.json({
      free: true,
      adminBypass: isAdmin,
      url: `${appUrl}/?checkout=success&worker=${encodeURIComponent(worker.slug)}#app/office`
    });
    return;
  }

  if (!stripeKey) {
    res.status(501).json({ error: "Stripe is not configured. Set STRIPE_SECRET_KEY to enable checkout." });
    return;
  }

  const stripe = new Stripe(stripeKey);

  const priceEnvKey = `STRIPE_PRICE_ID_${String(worker.slug).toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
  const configuredPriceId = String(process.env[priceEnvKey] || process.env.STRIPE_PRICE_ID || "").trim();
  if (configuredPriceId) {
    try {
      const configuredPrice = await stripe.prices.retrieve(configuredPriceId);
      const validation = validateConfiguredPrice(configuredPrice, { expectedAmountCents: unitAmount });
      if (!validation.valid) {
        res.status(503).json({ error: "Checkout is temporarily unavailable because billing configuration does not match the displayed price. Support has been notified." });
        log.error("stripe_price_mismatch", { workerSlug: worker.slug, configuredPriceId, reasons: validation.reasons });
        return;
      }
    } catch (error) {
      log.error("stripe_price_lookup_failed", { workerSlug: worker.slug, configuredPriceId, error: error?.message });
      res.status(503).json({ error: "Checkout is temporarily unavailable while billing configuration is verified." });
      return;
    }
  }
  const lineItems = configuredPriceId
    ? [{ price: configuredPriceId, quantity: 1 }]
    : [
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
      ];

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: req.user.email || undefined,
    client_reference_id: `${req.user.id}:${worker.slug}:${checkoutId}`,
    success_url: `${appUrl}/?checkout=success&worker=${encodeURIComponent(worker.slug)}#app/office`,
    cancel_url: `${appUrl}/?checkout=cancelled#worker-${worker.slug}`,
    line_items: lineItems,
    metadata: {
      checkoutId,
      userId: req.user.id,
      workerSlug: worker.slug
    }
  }, { idempotencyKey: checkoutId });

  await authStore.execute(
    `INSERT INTO checkout_sessions (id, user_id, worker_slug, amount_cents, stripe_session_id, status, created_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
    checkoutId, req.user.id, worker.slug, unitAmount, session.id, "pending", nowIso());

  res.json({ url: session.url });
});

app.get("/api/payments/hire-status", requireAuth, async (req, res) => {
  const workerSlug = String(req.query.worker || "").trim();
  if (!workerSlug) {
    res.status(400).json({ error: "worker query parameter is required." });
    return;
  }
  const hired = await hasHiredWorker(req.user.id, workerSlug);
  const row = hired
    ? await authStore.queryOne(
        `SELECT status, billing_status AS "billingStatus", hired_at AS "hiredAt"
         FROM hired_workers WHERE user_id = ? AND worker_slug = ? AND status = 'active'`,
        req.user.id,
        workerSlug
      )
    : null;
  const pendingCheckout = await authStore.queryOne(
    `SELECT id, status, created_at AS "createdAt"
     FROM checkout_sessions
     WHERE user_id = ? AND worker_slug = ?
     ORDER BY created_at DESC LIMIT 1`,
    req.user.id,
    workerSlug
  ).catch(() => null);
  res.json({
    workerSlug,
    hired,
    status: row?.status || null,
    billingStatus: row?.billingStatus || null,
    hiredAt: row?.hiredAt || null,
    checkoutStatus: pendingCheckout?.status || null
  });
});

app.post("/api/payments/portal", assertOrigin, requireAuth, async (req, res) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    res.status(501).json({ error: "Billing is not configured yet." });
    return;
  }

  const customerId = (await authStore.queryOne(
    `SELECT stripe_customer_id AS "customerId" FROM users WHERE id = ?`,
    req.user.id
  ))?.customerId;
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
    logCaught("Billing portal session failed:", error);
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

    // Idempotency: record the event id first. Stripe retries deliver the same
    // event.id; a duplicate insert affects 0 rows, so we ack and skip — no
    // double billing-state mutations.
    const outcome = await authStore.tx(async (transaction) => {
      const seen = await transaction.execute(
        `INSERT INTO stripe_webhook_events (event_id, type, received_at) VALUES (?, ?, ?)
         ON CONFLICT(event_id) DO NOTHING`,
        String(event.id), String(event.type), nowIso()
      );
      if (seen.changes === 0) return { duplicate: true };

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const checkoutId = session.metadata?.checkoutId;
        const userId = session.metadata?.userId;
        const workerSlug = session.metadata?.workerSlug;

        if (checkoutId) {
          await transaction.execute(
            "UPDATE checkout_sessions SET status = ?, completed_at = ? WHERE id = ?",
            "completed", nowIso(), checkoutId
          );
        }
        if (userId && session.customer) {
          await transaction.execute("UPDATE users SET stripe_customer_id = ? WHERE id = ?", String(session.customer), userId);
        }
        if (checkoutId && userId && workerSlug) {
          await transaction.execute(
            `INSERT INTO hired_workers (id, user_id, worker_slug, checkout_session_id, status, hired_at, stripe_subscription_id, billing_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(user_id, worker_slug) DO UPDATE SET checkout_session_id = excluded.checkout_session_id,
               status = excluded.status, hired_at = excluded.hired_at,
               stripe_subscription_id = excluded.stripe_subscription_id, billing_status = excluded.billing_status`,
            randomUUID(), userId, workerSlug, checkoutId, "active", nowIso(),
            session.subscription ? String(session.subscription) : null, "active"
          );
        }
      }

      if (event.type === "customer.subscription.deleted") {
        await transaction.execute(
          "UPDATE hired_workers SET status = 'terminated', billing_status = 'cancelled' WHERE stripe_subscription_id = ?",
          String(event.data.object.id)
        );
      }

      if (event.type === "invoice.payment_failed" && event.data.object.subscription) {
        await transaction.execute(
          "UPDATE hired_workers SET billing_status = 'past_due' WHERE stripe_subscription_id = ?",
          String(event.data.object.subscription)
        );
      }

      if (event.type === "invoice.payment_succeeded" && event.data.object.subscription) {
        await transaction.execute(
          "UPDATE hired_workers SET billing_status = 'active' WHERE stripe_subscription_id = ? AND billing_status = 'past_due'",
          String(event.data.object.subscription)
        );
      }
      return { duplicate: false };
    });
    if (outcome.duplicate) {
      res.json({ received: true, duplicate: true });
      return;
    }

    res.json({ received: true });
  } catch (error) {
    res.status(400).send(error instanceof Error ? error.message : "Webhook verification failed.");
  }
});

async function mergeChatMemories(userId, workerSlug, memories) {
  for (const memory of memories) {
    await upsertWorkerKnowledge(userId, workerSlug, (knowledge) => {
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
  void (async () => {
    try {
      const executedResults = [];
      if (workerSlug === MARA_SLUG) {
        const results = await autoExecuteSafeMaraTasks({
          store: maraStore,
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
        await syncMaraOperationalRecords(userId, workerSlug);
      } else {
        for (const taskId of taskIds) {
          try {
            const result = await runAgentTask({
              store: agentStore,
              userId,
              workerId: workerSlug,
              taskId,
              readers: buildMaraExecutionReaders()
            });
            if (result) executedResults.push(result);
          } catch (error) {
            logCaught(`Background chat task failed for ${workerSlug}:`, error);
          }
        }
        await syncOfficeCanonicalRecords(userId, workerSlug);
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
        await authStore.execute(
          `INSERT INTO office_chat_messages (id, user_id, worker_slug, author, text, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        , randomUUID(), userId, workerSlug, workerChatAuthor(worker, workerSlug), replyParts.join("\n\n"), nowIso());
      }

      for (const result of executedResults) {
        if (result?.task?.id) {
          await createWorkerActivityLog(maraStore, {
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
      logCaught(`Background chat execution failed for ${workerSlug}:`, error);
    }
  })();
}

app.post("/api/office/workers/:slug/chat", assertOrigin, requireAuth, llmHeavyLimiter, async (req, res) => {
  const workerSlug = req.params.slug;
  const text = String(req.body?.text ?? "").trim();

  if (!text) {
    res.status(400).json({ error: "Message text is required." });
    return;
  }

  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  const workers = await readWorkers();
  const worker = workers.find((entry) => entry.slug === workerSlug);
  const createdAt = nowIso();

  await authStore.execute(
    `INSERT INTO office_chat_messages (id, user_id, worker_slug, author, text, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  , randomUUID(), req.user.id, workerSlug, "You", text, createdAt);
  if (worker) {
    await rememberWorkerDirection(req.user.id, worker, text);
  }

  // LLM-first path for every role-config worker: interpret the message,
  // reply in the worker's voice, queue typed tasks, execute in background.
  // Mara has a specialized task/runtime repository. Sending her through the
  // generic agent repository creates orphan task ids that her executor cannot
  // find, so her direct assignments must use the Mara path below.
  if (worker && workerSlug !== MARA_SLUG && hasRoleConfig(workerSlug) && isAgentLlmConfigured()) {
    try {
      const agentResult = await handleAgentChatMessage({
        store: agentStore,
        userId: req.user.id,
        workerId: workerSlug,
        message: text,
        readers: buildMaraExecutionReaders()
      });
      if (agentResult) {
        await mergeChatMemories(req.user.id, workerSlug, agentResult.memoriesToSave);
        await authStore.execute(
          `INSERT INTO office_chat_messages (id, user_id, worker_slug, author, text, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ,
          randomUUID(),
          req.user.id,
          workerSlug,
          workerChatAuthor(worker, workerSlug),
          agentResult.reply,
          new Date(Date.now() + 1000).toISOString()
        );
        const paused = await isWorkerPaused(req.user.id, workerSlug);
        res.status(201).json({ ok: true, executing: !paused && agentResult.createdTaskIds.length > 0 });
        if (!paused) {
          executeChatTasksInBackground(req.user.id, workerSlug, worker, agentResult.createdTaskIds, text);
        }
        return;
      }
    } catch (error) {
      logCaught("Agent chat interpretation failed, falling back:", error);
    }
  }

  if (workerSlug === MARA_SLUG && worker) {
    await ensureWorkerPermissions(maraStore, req.user.id, workerSlug);
    const createdChatTaskIds = [];
    const detectorResult = runMaraActionDetector({
      openTasks: await listWorkerTasksForUserWorker(maraStore, req.user.id, workerSlug),
      permissions: await getWorkerPermissions(maraStore, req.user.id, workerSlug),
      recentMessages: await authStore.query(
        `SELECT author, text
         FROM office_chat_messages
         WHERE user_id = ? AND worker_slug = ?
         ORDER BY created_at DESC
         LIMIT 6`,
        req.user.id, workerSlug
      ),
      triggerText: text,
      triggerType: "chat_message",
      userId: req.user.id,
      workerId: workerSlug
    });

    for (const memory of detectorResult.memoriesToSave) {
      await upsertWorkerKnowledge(req.user.id, workerSlug, (knowledge) => {
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
        const created = await createApprovedTaskIfPermissionAllows(maraStore, {
          ...task,
          userId: req.user.id,
          workerId: workerSlug
        });
        if (!created.duplicate && created.id) {
          createdChatTaskIds.push(created.id);
          const createdTask = (await listWorkerTasksForUserWorker(maraStore, req.user.id, workerSlug)).find((entry) => entry.id === created.id);
          await createWorkerActivityLog(maraStore, {
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
        await createSuggestedTask(maraStore, {
          ...task,
          userId: req.user.id,
          workerId: workerSlug
        });
      }
    }

    for (const recurring of detectorResult.recurringResponsibilitiesToSuggest) {
      await createRecurringResponsibility(maraStore, {
        ...recurring,
        isActive: false,
        userId: req.user.id,
        workerId: workerSlug
      });
    }

    for (const research of detectorResult.researchItemsToCreate) {
      await createResearchItem(maraStore, {
        ...research,
        userId: req.user.id,
        workerId: workerSlug
      });
    }

    for (const approval of detectorResult.approvalRequests) {
      await createApprovalRequest(maraStore, {
        ...approval,
        userId: req.user.id,
        workerId: workerSlug
      });
    }

    const executedResults = await autoExecuteSafeMaraTasks({
        store: maraStore,
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
        await createWorkerActivityLog(maraStore, {
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
        await authStore.execute(
          `INSERT INTO office_chat_messages (id, user_id, worker_slug, author, text, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        , randomUUID(), req.user.id, workerSlug, "Mara", replyParts.join("\n\n"), replyCreatedAt);
        res.status(201).json({ ok: true });
        return;
      }
    }
  }

  await authStore.execute(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  , randomUUID(), req.user.id, workerSlug, "Sent a chat message.", "Chat", "Worker memory and conversation context updated", createdAt);

  let replyText = makeWorkerReply(worker?.name);
  if (worker) {
    try {
      replyText = await generateOfficeWorkerReply(req.user.id, worker, text);
    } catch (error) {
      logCaught("Office worker reply generation failed:", error);
    }
  }
  const chatAuthor = workerSlug === MARA_SLUG ? "Mara" : "Worker";
  const replyCreatedAt = new Date(Date.now() + 1000).toISOString();
  await authStore.execute(
    `INSERT INTO office_chat_messages (id, user_id, worker_slug, author, text, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  , randomUUID(), req.user.id, workerSlug, chatAuthor, replyText, replyCreatedAt);

  res.status(201).json({ ok: true });
});

app.post("/api/office/workers/:slug/tasks", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = req.params.slug;
  const { dueDate, module, owner, priority, title } = req.body ?? {};

  if (!title || !module) {
    res.status(400).json({ error: "Task title and module are required." });
    return;
  }

  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  const createdAt = nowIso();
  await authStore.tx(async (transaction) => {
    await transaction.execute(
      `INSERT INTO office_custom_tasks (id, user_id, worker_slug, title, module_name, owner, priority, status, due_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    await transaction.execute(
      `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      randomUUID(), req.user.id, workerSlug, "Created a task.", String(module), String(title), createdAt
    );
  });

  res.status(201).json({ ok: true });
});

app.post("/api/office/workers/:slug/tasks/:taskId/status", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = req.params.slug;
  const taskId = req.params.taskId;
  const status = String(req.body?.status ?? "");

  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  const allowedStatuses = ["To Do", "In Progress", "Needs Review", "Pending approval", "Blocked", "Completed"];
  if (!allowedStatuses.includes(status)) {
    res.status(400).json({ error: "Unsupported task status." });
    return;
  }

  const updated = await authStore.execute(
    `UPDATE office_custom_tasks SET status = ? WHERE id = ? AND user_id = ? AND worker_slug = ?`,
    status, taskId, req.user.id, workerSlug
  );

  if (updated.changes === 0) {
    res.status(404).json({ error: "Custom task not found." });
    return;
  }

  const workerTask = await authStore.queryOne(
    `SELECT id, status FROM worker_tasks WHERE id = ? AND user_id = ? AND worker_id = ?`,
    taskId, req.user.id, workerSlug
  );

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
      await updateWorkerTaskStatus(maraStore, req.user.id, workerSlug, taskId, nextStatus);
    }
  }

  await authStore.execute(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  , randomUUID(), req.user.id, workerSlug, "Updated task status.", "Tasks", `${taskId} -> ${status}`, nowIso());

  if (isMaraWorker(workerSlug)) {
    await syncMaraOperationalRecords(req.user.id, workerSlug);
  } else if (hasRoleConfig(workerSlug)) {
    await syncOfficeCanonicalRecords(req.user.id, workerSlug);
  }

  res.json({ ok: true });
});

app.post("/api/office/workers/:slug/tasks/:taskId/approve", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug ?? "").trim();
  const taskId = String(req.params.taskId ?? "").trim();

  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
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
      result = await approveWorkerProposedTask(maraStore, req.user.id, workerSlug, taskId, {
        store: maraStore,
        ...buildMaraExecutionReaders()
      });
      await syncMaraOperationalRecords(req.user.id, workerSlug);
    } else {
      await updateWorkerTaskStatus(maraStore, req.user.id, workerSlug, taskId, "approved");
      result = await runAgentTask({
        store: agentStore,
        userId: req.user.id,
        workerId: workerSlug,
        taskId,
        readers: buildMaraExecutionReaders()
      });
      await syncOfficeCanonicalRecords(req.user.id, workerSlug);
    }
    res.json({
      ok: true,
      ...result,
      workspace: await buildMaraWorkspace(maraStore, req.user.id, workerSlug, {
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

  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  const createdAt = nowIso();

  if (action === "approve") {
    await authStore.tx(async (transaction) => {
      await transaction.execute(
        `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        randomUUID(), req.user.id, workerSlug, "Approved a briefing.", "Briefings", briefingId, createdAt
      );
      const briefing = await transaction.queryOne(
        `SELECT title, date_label AS "dateLabel" FROM office_custom_briefings
         WHERE id = ? AND user_id = ? AND worker_slug = ?`,
        briefingId, req.user.id, workerSlug
      );
      if (briefing) {
        await transaction.execute(
          `DELETE FROM office_custom_briefings WHERE user_id = ? AND worker_slug = ? AND title = ? AND date_label = ?`,
          req.user.id, workerSlug, briefing.title, briefing.dateLabel
        );
      } else {
        await transaction.execute(`DELETE FROM office_custom_briefings WHERE id = ? AND user_id = ?`, briefingId, req.user.id);
      }
    });
    res.json({ ok: true });
    return;
  }

  if (action === "followup") {
    const followupText = "Please prepare follow-up notes and update the queue before the next review.";
    await authStore.tx(async (transaction) => {
      await transaction.execute(
        `INSERT INTO office_chat_messages (id, user_id, worker_slug, author, text, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        randomUUID(), req.user.id, workerSlug, "You", followupText, createdAt
      );
      await transaction.execute(
        `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        randomUUID(), req.user.id, workerSlug, "Requested briefing follow-up.", "Briefings", briefingId, createdAt
      );
      await transaction.execute(`DELETE FROM office_custom_briefings WHERE id = ? AND user_id = ?`, briefingId, req.user.id);
    });
    void rememberWorkerDirection(req.user.id, workerSlug, followupText).catch((error) => {
      logCaught("Could not retain briefing follow-up direction:", error);
    });
    res.json({ ok: true });
    return;
  }

  if (action === "task") {
    await authStore.tx(async (transaction) => {
      await transaction.execute(
        `INSERT INTO office_custom_tasks (id, user_id, worker_slug, title, module_name, owner, priority, status, due_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        randomUUID(), req.user.id, workerSlug, "Follow up on briefing decisions", "Briefings", "Worker", "High", "To Do", "Tomorrow", createdAt
      );
      await transaction.execute(
        `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        randomUUID(), req.user.id, workerSlug, "Created a task from briefing.", "Briefings", briefingId, createdAt
      );
    });
    res.json({ ok: true });
    return;
  }

  res.status(400).json({ error: "Unsupported briefing action." });
});

app.post("/api/office/workers/:slug/settings", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = req.params.slug;
  const settings = req.body?.settings;

  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!Array.isArray(settings)) {
    res.status(400).json({ error: "Settings payload is invalid." });
    return;
  }

  await authStore.tx(async (transaction) => {
    await transaction.execute(
      `INSERT INTO office_worker_settings (id, user_id, worker_slug, settings_json, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, worker_slug) DO UPDATE SET
         settings_json = excluded.settings_json,
         updated_at = excluded.updated_at`,
      randomUUID(), req.user.id, workerSlug, JSON.stringify(settings), nowIso()
    );
    await transaction.execute(
      `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      randomUUID(), req.user.id, workerSlug, "Updated worker settings.", "Settings", "Office preferences saved", nowIso()
    );
  });

  res.json({ ok: true });
});

app.post("/api/office/workers/:slug/fire", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = req.params.slug;

  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  const worker = await authStore.queryOne(
    `SELECT worker_slug AS "workerSlug", stripe_subscription_id AS "stripeSubscriptionId"
     FROM hired_workers
     WHERE user_id = ? AND worker_slug = ? AND status = ?`,
    req.user.id, workerSlug, "active"
  );

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
      logCaught(`Stripe subscription cancel failed for ${worker.stripeSubscriptionId}:`, error);
      res.status(502).json({
        error: "The worker was not removed because their subscription could not be cancelled. Please try again or contact support so you are not billed."
      });
      return;
    }
  }

  await authStore.tx(async (transaction) => {
    await transaction.execute(
      `UPDATE hired_workers
       SET status = ?, billing_status = 'cancelled'
       WHERE user_id = ? AND worker_slug = ? AND status = ?`,
      "terminated", req.user.id, workerSlug, "active"
    );
    await transaction.execute(
      `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      randomUUID(), req.user.id, workerSlug, "Ended worker engagement.", "People", "Worker removed from active office roster", nowIso()
    );
  });

  res.json({ ok: true });
});

app.post("/api/office/workers/:slug/knowledge", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = req.params.slug;
  const knowledge = req.body?.knowledge;

  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
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

  await authStore.tx(async (transaction) => {
    await transaction.execute(
      `INSERT INTO office_worker_knowledge (id, user_id, worker_slug, knowledge_json, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, worker_slug) DO UPDATE SET
         knowledge_json = excluded.knowledge_json,
         updated_at = excluded.updated_at`,
      randomUUID(), req.user.id, workerSlug, JSON.stringify(normalizedKnowledge), nowIso()
    );
    await transaction.execute(
      `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      randomUUID(), req.user.id, workerSlug, "Updated worker knowledge.", "Memory", "Operating context saved", nowIso()
    );
  });

  res.json({ ok: true });
});

app.post("/api/office/workers/:slug/files", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = req.params.slug;
  const name = String(req.body?.name ?? "").trim();
  const type = String(req.body?.type ?? "").trim();
  const contentBase64 = String(req.body?.contentBase64 ?? "");

  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  let validated;
  try {
    validated = validateTenantUpload({ name, type, contentBase64 });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "File is invalid." });
    return;
  }

  const fileId = randomUUID();
  const storedName = `${fileId}-${name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  await objectStorage.put({
    userId: req.user.id,
    storedName,
    body: validated.body,
    contentType: validated.contentType
  });

  await authStore.execute(
    `INSERT INTO office_uploaded_files (id, user_id, worker_slug, name, type, stored_name, uploaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    fileId, req.user.id, workerSlug, name, type || "File", storedName, nowIso());

  await authStore.execute(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    randomUUID(), req.user.id, workerSlug, "Uploaded a file.", "Files", name, nowIso());

  await syncOfficeCanonicalRecords(req.user.id, workerSlug);

  res.status(201).json({ ok: true });
});

app.post("/api/office/workers/:slug/files/:fileId/delete", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = req.params.slug;
  const fileId = req.params.fileId;

  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  const file = await authStore.queryOne(
      `SELECT stored_name, name
       FROM office_uploaded_files
       WHERE id = ? AND user_id = ? AND worker_slug = ?`,
    fileId, req.user.id, workerSlug
  );

  if (!file) {
    res.status(404).json({ error: "File not found." });
    return;
  }

  await authStore.execute("DELETE FROM office_uploaded_files WHERE id = ? AND user_id = ?", fileId, req.user.id);

  try {
    await objectStorage.delete({ userId: req.user.id, storedName: file.stored_name });
  } catch {
    // Ignore missing file on disk if metadata was present.
  }

  await authStore.execute(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    randomUUID(), req.user.id, workerSlug, "Removed a file.", "Files", file.name, nowIso());

  await syncOfficeCanonicalRecords(req.user.id, workerSlug);

  res.json({ ok: true });
});

app.post("/api/office/workers/:slug/briefings", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = req.params.slug;
  const { agenda, dateLabel, decisionsNeeded, recommendedActions, summary, title } = req.body ?? {};

  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!title || !dateLabel) {
    res.status(400).json({ error: "Briefing title and time are required." });
    return;
  }

  const briefingId = randomUUID();
  await authStore.execute(
    `INSERT INTO office_custom_briefings
     (id, user_id, worker_slug, title, date_label, summary, agenda_json, decisions_json, actions_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

  await authStore.execute(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    randomUUID(), req.user.id, workerSlug, "Scheduled a briefing.", "Briefings", String(title), nowIso());

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
    creatorProfiles: String(settings.creatorProfiles ?? "").trim(),
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

  await authStore.execute(
    `INSERT INTO office_global_settings (user_id, settings_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
      settings_json = excluded.settings_json,
      updated_at = excluded.updated_at`
  , req.user.id, JSON.stringify(normalizedSettings), nowIso());

  const workerRows = await authStore.query(
      `SELECT worker_slug AS "workerSlug"
       FROM hired_workers
       WHERE user_id = ? AND status = 'active'`,
    req.user.id);
  for (const row of workerRows) {
    await syncHandbookEntries(req.user.id, row.workerSlug);
  }

  res.json({ ok: true });
});

app.post("/api/office/workers/:slug/onboarding/save", assertOrigin, requireAuth, async (req, res) => {
  try {
    const workerSlug = req.params.slug;
    const answers = req.body?.answers;
    const generatedSummary = req.body?.generatedSummary;

    if (!(await hasHiredWorker(req.user.id, workerSlug))) {
      res.status(404).json({ error: "Hired worker not found." });
      return;
    }

    if (!answers || typeof answers !== "object") {
      res.status(400).json({ error: "Onboarding answers are required." });
      return;
    }

    await authStore.execute(
      `INSERT INTO office_onboarding_sessions
       (id, user_id, worker_slug, status, answers_json, generated_summary_json, completed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)
       ON CONFLICT(user_id, worker_slug) DO UPDATE SET
         status = excluded.status,
         answers_json = excluded.answers_json,
         generated_summary_json = excluded.generated_summary_json,
         updated_at = excluded.updated_at`
    ,
      randomUUID(),
      req.user.id,
      workerSlug,
      "in_progress",
      JSON.stringify(answers),
      JSON.stringify(Array.isArray(generatedSummary) ? generatedSummary : []),
      nowIso(),
      nowIso()
    );

    await syncHandbookEntries(req.user.id, workerSlug);

    res.json({ ok: true });
  } catch (error) {
    logCaught("Worker onboarding save failed:", error);
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

    if (!(await hasHiredWorker(req.user.id, workerSlug))) {
      res.status(404).json({ error: "Hired worker not found." });
      return;
    }

    if (!answers || typeof answers !== "object" || !Array.isArray(knowledge) || !Array.isArray(tasks) || !briefing) {
      res.status(400).json({ error: "Onboarding payload is incomplete." });
      return;
    }

    const existing = await authStore.queryOne(
        `SELECT status
         FROM office_onboarding_sessions
         WHERE user_id = ? AND worker_slug = ?`,
      req.user.id, workerSlug);

    const timestamp = nowIso();

    await authStore.execute(
      `INSERT INTO office_onboarding_sessions
       (id, user_id, worker_slug, status, answers_json, generated_summary_json, completed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, worker_slug) DO UPDATE SET
         status = excluded.status,
         answers_json = excluded.answers_json,
         generated_summary_json = excluded.generated_summary_json,
         completed_at = excluded.completed_at,
         updated_at = excluded.updated_at`
    ,
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

    await replaceWorkerKnowledge(req.user.id, workerSlug, normalizedKnowledge);

    await ensureWorkerPermissions(maraStore, req.user.id, workerSlug);
    if (workerSlug === MARA_SLUG) {
      const gmail = await getWorkerIntegration(req.user.id, workerSlug, "gmail");
      await updateWorkerPermissions(
        maraStore,
        req.user.id,
        workerSlug,
        deriveMaraPermissionsFromOnboarding(answers, { inboxConnected: gmail?.status === "connected" })
      );
    }

    let shouldRunMaraOnboardingAutomation = false;
    const maraHasOutputs =
      workerSlug === MARA_SLUG
        ? Number(
            (await authStore.queryOne(
                `SELECT COUNT(*) AS count
                 FROM worker_outputs
                 WHERE user_id = ? AND worker_id = ?`,
              req.user.id, workerSlug))?.count || 0
          ) > 0
        : true;

    if (existing?.status !== "completed") {
      if (workerSlug !== MARA_SLUG) {
        for (const task of tasks) {
          await authStore.execute(
            `INSERT INTO office_custom_tasks (id, user_id, worker_slug, title, module_name, owner, priority, status, due_date, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ,
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

      await authStore.execute(
      `INSERT INTO office_custom_briefings
       (id, user_id, worker_slug, title, date_label, summary, agenda_json, decisions_json, actions_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ,
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
        store: agentStore,
        userId: req.user.id,
        workerId: workerSlug,
        readers: buildMaraExecutionReaders()
      })
        .then(() => syncOfficeCanonicalRecords(req.user.id, workerSlug))
        .catch((error) => logCaught(`First-day agent cycle failed for ${workerSlug}:`, error));
    }
    await authStore.execute(
      `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ,
      randomUUID(),
      req.user.id,
      workerSlug,
      "Completed new hire onboarding.",
      "Onboarding",
      String(worklogEntry?.result ?? (workerSlug === MARA_SLUG ? "I captured your workflow and I'm setting up my desk." : "Worker prepared first-day setup")),
      timestamp
    );

    let maraFirstDayQueued = false;
    if (shouldRunMaraOnboardingAutomation) {
      const queued = await enqueueJob(jobStore, {
        kind: "mara_first_day",
        userId: req.user.id,
        workerId: workerSlug,
        payload: { requestedAt: timestamp },
        idempotencyKey: `mara_first_day:${req.user.id}:${workerSlug}:v1`
      });
      maraFirstDayQueued = queued.enqueued;
    }
    await syncOfficeCanonicalRecords(req.user.id, workerSlug);
    if (workerSlug === MARA_SLUG) {
      await syncMaraGrowthIntelligenceFromResearch(req.user.id, workerSlug);
    }

    res.json({
      ok: true,
      firstWorkStatus: maraFirstDayQueued ? "queued" : null,
      workspace:
        workerSlug === MARA_SLUG
          ? await buildMaraWorkspace(maraStore, req.user.id, workerSlug, {
              readKnowledgeSections: readWorkerKnowledgeSections,
              readOfficeOverlays: readOfficeOverlaysForUser
            })
          : null
    });
    if (maraFirstDayQueued && autonomySchedulerEnabled) {
      void runScheduledMaraAutonomy().catch((error) => logCaught("Queued Mara first-day wake failed:", error));
    }
  } catch (error) {
    logCaught("Worker onboarding completion failed:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unable to complete onboarding." });
  }
});

app.get("/api/office/workers/:slug/intelligence", requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug || "").trim();
  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }
  if (!isMaraWorker(workerSlug)) {
    res.status(400).json({ error: "Growth intelligence is currently available for Mara." });
    return;
  }
  const intelligence = await getMaraGrowthIntelligenceSnapshot(professionalStore, req.user.id, workerSlug);
  let commercialBriefing = null;
  let bookOfBusiness = [];
  let funnel = null;
  try {
    const { buildCommercialReturnBriefing } = await import("./maraCommercialBriefing.mjs");
    const { listBookOfBusiness, ensureOpportunityLifecycleSchema } = await import("./maraOpportunityStateEngine.mjs");
    const { getCommercialFunnelMetrics } = await import("./maraRevenueAttribution.mjs");
    await ensureOpportunityLifecycleSchema(professionalStore);
    commercialBriefing = await buildCommercialReturnBriefing(professionalStore, req.user.id, workerSlug, { sinceHours: 72 });
    bookOfBusiness = await listBookOfBusiness(professionalStore, req.user.id, workerSlug, { limit: 30 });
    funnel = await getCommercialFunnelMetrics(professionalStore, req.user.id, workerSlug);
  } catch {
    /* optional commercial spine */
  }
  res.json({ intelligence, commercialBriefing, bookOfBusiness, funnel });
});

app.post("/api/office/workers/:slug/intelligence/opportunities/:opportunityId/stage", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug || "").trim();
  const opportunityId = String(req.params.opportunityId || "").trim();
  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }
  if (!isMaraWorker(workerSlug)) {
    res.status(400).json({ error: "Growth intelligence is currently available for Mara." });
    return;
  }
  try {
    const { transitionOpportunityStage, ensureOpportunityLifecycleSchema } = await import("./maraOpportunityStateEngine.mjs");
    const { applyOutcomeToLearning } = await import("./maraLearningLoop.mjs");
    await ensureOpportunityLifecycleSchema(professionalStore);
    const result = await transitionOpportunityStage(professionalStore, {
      userId: req.user.id,
      workerId: workerSlug,
      opportunityId,
      toStage: req.body?.stage,
      confidence: 100,
      evidence: [{ claim: req.body?.reason || "User correction", basis: "user_correction" }],
      source: "user_correction",
      reason: req.body?.reason || "Manager corrected opportunity stage",
      force: true,
      lossReason: req.body?.lossReason || null
    });
    if (req.body?.correctionNote) {
      await applyOutcomeToLearning(professionalStore, {
        userId: req.user.id,
        workerId: workerSlug,
        userCorrection: req.body.correctionNote
      });
    }
    res.json({ ok: true, result });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Stage update failed." });
  }
});

app.get("/api/office/workers/:slug/commercial-briefing", requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug || "").trim();
  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }
  if (!isMaraWorker(workerSlug)) {
    res.status(400).json({ error: "Commercial briefing is currently available for Mara." });
    return;
  }
  const { buildCommercialReturnBriefing } = await import("./maraCommercialBriefing.mjs");
  const briefing = await buildCommercialReturnBriefing(professionalStore, req.user.id, workerSlug, {
    sinceHours: Number(req.query.sinceHours || 72)
  });
  res.json({ ok: true, briefing });
});

app.post("/api/office/workers/:slug/intelligence/outcomes", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug || "").trim();
  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }
  if (!isMaraWorker(workerSlug)) {
    res.status(400).json({ error: "Growth intelligence is currently available for Mara." });
    return;
  }
  try {
    const recorded = await recordCommercialOutcome(professionalStore, {
      userId: req.user.id,
      workerId: workerSlug,
      opportunityId: req.body?.opportunityId || null,
      contacted: Boolean(req.body?.contacted),
      responded: Boolean(req.body?.responded),
      conceptAccepted: Boolean(req.body?.conceptAccepted),
      hired: Boolean(req.body?.hired),
      rehired: Boolean(req.body?.rehired),
      revenueAmount: req.body?.revenueAmount || 0,
      currency: req.body?.currency || "USD",
      occurredAt: req.body?.occurredAt || null,
      details: req.body?.details || {}
    });
    await authStore.execute(
      `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      randomUUID(), req.user.id, workerSlug, "Recorded a commercial outcome.", "Growth intelligence", recorded.id, nowIso()
    );
    const snapshot = await getMaraGrowthIntelligenceSnapshot(professionalStore, req.user.id, workerSlug);
    res.status(201).json({
      ok: true,
      id: recorded.id,
      ranking: recorded.ranking,
      metrics: snapshot.metrics,
      intelligence: snapshot
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not record commercial outcome." });
  }
});

app.post("/api/office/workers/:slug/intelligence/creative-analyses", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug || "").trim();
  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }
  if (!isMaraWorker(workerSlug)) {
    res.status(400).json({ error: "Growth intelligence is currently available for Mara." });
    return;
  }
  try {
    const saved = await saveCreativeAnalysis(professionalStore, {
      userId: req.user.id,
      workerId: workerSlug,
      assetType: req.body?.assetType,
      assetRef: req.body?.assetRef,
      analysis: req.body?.analysis,
      evidence: req.body?.evidence
    });
    await authStore.execute(
      `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      randomUUID(), req.user.id, workerSlug, "Saved timestamped creative analysis.", "Growth intelligence", saved.id, nowIso()
    );
    res.status(201).json({ ok: true, analysis: saved });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not save creative analysis." });
  }
});

app.get("/api/office/workers/:slug/creator-profile", requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug || "").trim();
  if (!(await hasHiredWorker(req.user.id, workerSlug)) || !isMaraWorker(workerSlug)) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  const profile = await getCreatorIntelligenceProfile(professionalStore, req.user.id, workerSlug);
  res.json({ ok: true, profile });
});

app.post("/api/office/workers/:slug/creator-profile", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug || "").trim();
  if (!(await hasHiredWorker(req.user.id, workerSlug)) || !isMaraWorker(workerSlug)) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  try {
    const profile = await upsertCreatorIntelligenceProfile(professionalStore, {
      userId: req.user.id,
      workerId: workerSlug,
      business: req.body?.business,
      creative: req.body?.creative,
      commercial: req.body?.commercial,
      provenance: { basis: EVIDENCE_KINDS.CREATOR_PREFERENCE, source: "user_edit" },
      confidence: 80
    });
    res.json({ ok: true, profile });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not save profile." });
  }
});

app.get("/api/office/workers/:slug/research/providers", requireAuth, async (req, res) => {
  // Ops-only: platform API keys are server-owned, not a creator setting.
  if (!isAdminUser(req.user)) {
    res.status(403).json({ error: "Not available." });
    return;
  }
  if (!(await hasHiredWorker(req.user.id, String(req.params.slug || "").trim()))) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  res.json({ ok: true, providers: await listResearchProviders() });
});

app.post("/api/office/workers/:slug/research/deep", assertOrigin, requireAuth, llmHeavyLimiter, async (req, res) => {
  const workerSlug = String(req.params.slug || "").trim();
  if (!(await hasHiredWorker(req.user.id, workerSlug)) || !isMaraWorker(workerSlug)) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  try {
    const { assertWithinDeepResearchLimit } = await import("./maraAutonomyLimits.mjs");
    await assertWithinDeepResearchLimit(professionalStore, req.user.id, workerSlug);
    const research = await deepResearchBrand(professionalStore, {
      userId: req.user.id,
      workerId: workerSlug,
      brandName: req.body?.brandName,
      website: req.body?.website,
      niche: req.body?.niche,
      fetchImpl: fetch
    });
    // Creators see outcomes, not provider/key plumbing.
    const publicResearch = {
      id: research.id,
      brandName: research.brandName,
      website: research.website,
      socialProfiles: research.socialProfiles || {},
      observationCount: (research.runs || []).reduce((sum, run) => sum + (run.observations?.length || 0), 0),
      sourcesUsed: (research.runs || [])
        .filter((run) => run.status === "ok" && (run.observations?.length || 0) > 0)
        .map((run) => run.providerName)
    };
    res.json({ ok: true, research: publicResearch });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Deep research failed." });
  }
});

app.get("/api/office/workers/:slug/brands/:brandId/contacts", requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug || "").trim();
  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  const contacts = await listBrandContacts(professionalStore, req.user.id, workerSlug, req.params.brandId);
  res.json({
    ok: true,
    contacts: contacts.map((row) => ({
      ...row,
      metadata: typeof row.metadataJson === "object" ? row.metadataJson : JSON.parse(row.metadataJson || "{}")
    }))
  });
});

app.post("/api/office/workers/:slug/contacts/:contactId/confirm", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug || "").trim();
  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  try {
    const id = await confirmInferredContact(professionalStore, {
      userId: req.user.id,
      workerId: workerSlug,
      contactId: req.params.contactId
    });
    // Rebuild Gmail drafts that were stuck without a To: field.
    const recentOutputs = await professionalStore.query(
      `SELECT id FROM worker_outputs
       WHERE user_id = ? AND worker_id = ? AND output_type IN ('pitch_draft', 'pitch_template', 'follow_up_sequence', 'reply_draft')
       ORDER BY created_at DESC LIMIT 20`,
      req.user.id,
      workerSlug
    );
    if (recentOutputs.length) {
      void syncMaraGmailDraftsForOutputs(
        req.user.id,
        workerSlug,
        recentOutputs.map((row) => row.id)
      ).catch((error) => logCaught("Draft refresh after contact confirm failed:", error));
    }
    res.json({ ok: true, contactId: id });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not confirm contact." });
  }
});

app.post("/api/office/workers/:slug/brands/:brandId/contacts", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug || "").trim();
  if (!(await hasHiredWorker(req.user.id, workerSlug)) || !isMaraWorker(workerSlug)) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  try {
    const { upsertBrandContact, CONTACT_TYPES } = await import("./maraContactDiscovery.mjs");
    const email = String(req.body?.email || req.body?.value || "").trim().toLowerCase();
    if (!email.includes("@")) {
      res.status(400).json({ error: "Provide a real email address. Mara will not invent one." });
      return;
    }
    const id = await upsertBrandContact(professionalStore, {
      userId: req.user.id,
      workerId: workerSlug,
      publicBrandId: req.params.brandId,
      contactType: CONTACT_TYPES.USER_PROVIDED,
      value: email,
      source: "user",
      confidence: 95,
      verificationState: "user_provided",
      forceAllow: true
    });
    const recentOutputs = await professionalStore.query(
      `SELECT id FROM worker_outputs
       WHERE user_id = ? AND worker_id = ? AND output_type IN ('pitch_draft', 'pitch_template', 'follow_up_sequence', 'reply_draft')
       ORDER BY created_at DESC LIMIT 20`,
      req.user.id,
      workerSlug
    );
    if (recentOutputs.length) {
      void syncMaraGmailDraftsForOutputs(
        req.user.id,
        workerSlug,
        recentOutputs.map((row) => row.id)
      ).catch((error) => logCaught("Draft refresh after contact save failed:", error));
    }
    res.status(201).json({ ok: true, contactId: id, mayUseForOutreach: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not save contact." });
  }
});

app.post("/api/office/workers/:slug/brands/:brandId/discover-contacts", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug || "").trim();
  if (!(await hasHiredWorker(req.user.id, workerSlug)) || !isMaraWorker(workerSlug)) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  try {
    const { discoverAndPersistBrandContacts } = await import("./maraContactDiscovery.mjs");
    const brand = await professionalStore.queryOne(
      `SELECT id, brand_name AS "brandName", website FROM mara_public_brands WHERE id = ?`,
      req.params.brandId
    );
    if (!brand) {
      res.status(404).json({ error: "Brand not found." });
      return;
    }
    const result = await discoverAndPersistBrandContacts(professionalStore, {
      userId: req.user.id,
      workerId: workerSlug,
      publicBrandId: brand.id,
      brandName: brand.brandName,
      website: req.body?.website || brand.website,
      fetchImpl: fetch
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Contact discovery failed." });
  }
});

app.get("/api/office/workers/:slug/autonomy/limits", requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug || "").trim();
  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  res.json({ ok: true, limits: await getAutonomyLimits(professionalStore, req.user.id, workerSlug) });
});

app.post("/api/office/workers/:slug/autonomy/limits", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug || "").trim();
  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  const limits = await saveAutonomyLimits(professionalStore, req.user.id, workerSlug, req.body?.limits || req.body || {});
  res.json({ ok: true, limits });
});

app.post("/api/office/workers/:slug/media/videos", assertOrigin, requireAuth, expensiveApiLimiter, async (req, res) => {
  const workerSlug = String(req.params.slug || "").trim();
  if (!(await hasHiredWorker(req.user.id, workerSlug)) || !isMaraWorker(workerSlug)) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  if (String(process.env.MARA_DISABLE_VIDEO_QA || "").trim() === "1") {
    res.status(503).json({
      error: "Video creative QA is disabled on this deployment. Contact support if you need it enabled with real providers."
    });
    return;
  }
  try {
    const encoded = String(req.body?.contentBase64 || "").trim();
    const body = Buffer.from(encoded, "base64");
    const validated = validateVideoUpload({ name: req.body?.name, type: req.body?.type, body });
    const scan = await scanMediaForMalware(body, validated);
    if (!scan.ok) {
      res.status(400).json({ error: `Media rejected by scanner: ${scan.reason}` });
      return;
    }
    const storageKey = buildTenantMediaKey(req.user.id, validated.fileName);
    const storedName = `mara-media/${path.basename(storageKey)}`;
    await objectStorage.put({
      userId: req.user.id,
      storedName,
      body,
      contentType: validated.contentType
    });
    const mediaAssetId = await registerMediaAsset(professionalStore, {
      userId: req.user.id,
      workerId: workerSlug,
      storageKey: `tenant-uploads/${req.user.id}/${storedName}`,
      contentType: validated.contentType,
      byteSize: validated.byteSize,
      durationSeconds: req.body?.durationSeconds ?? null,
      metadata: { originalName: validated.fileName, scanner: scan.scanner, storedName }
    });
    const analysisId = await enqueueVideoAnalysis(professionalStore, {
      userId: req.user.id,
      workerId: workerSlug,
      mediaAssetId
    });
    res.status(201).json({ ok: true, mediaAssetId, analysisId, status: "queued" });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Video upload failed." });
  }
});

app.get("/api/office/workers/:slug/media/analyses/:analysisId", requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug || "").trim();
  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  const row = await professionalStore.queryOne(
    `SELECT id, media_asset_id AS "mediaAssetId", status, analysis_json AS "analysisJson",
            timeline_json AS "timelineJson", created_at AS "createdAt", updated_at AS "updatedAt"
     FROM mara_video_analyses WHERE id = ? AND user_id = ? AND worker_id = ?`,
    req.params.analysisId,
    req.user.id,
    workerSlug
  );
  if (!row) {
    res.status(404).json({ error: "Analysis not found." });
    return;
  }
  const parse = (value, fallback) => {
    if (value && typeof value === "object") return value;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  };
  res.json({
    ok: true,
    analysis: {
      ...row,
      analysis: parse(row.analysisJson, {}),
      timeline: parse(row.timelineJson, [])
    }
  });
});

app.post("/api/office/workers/:slug/outreach/sequences", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug || "").trim();
  if (!(await hasHiredWorker(req.user.id, workerSlug)) || !isMaraWorker(workerSlug)) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  try {
    const { getAutonomyLimits } = await import("./maraAutonomyLimits.mjs");
    const autonomyLimits = await getAutonomyLimits(professionalStore, req.user.id, workerSlug);
    const requestedAttempts = Number.parseInt(req.body?.maxAttempts, 10);
    const maxAttempts = Number.isFinite(requestedAttempts)
      ? Math.min(autonomyLimits.maxFollowUpAttempts, Math.max(0, requestedAttempts))
      : autonomyLimits.maxFollowUpAttempts;
    const result = await startOutreachSequence(professionalStore, {
      userId: req.user.id,
      workerId: workerSlug,
      opportunityId: req.body?.opportunityId,
      publicBrandId: req.body?.publicBrandId,
      contactId: req.body?.contactId,
      maxAttempts
    });
    res.status(201).json({ ok: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not start sequence." });
  }
});

app.post("/api/office/workers/:slug/outreach/sequences/:sequenceId/stop", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug || "").trim();
  if (!(await hasHiredWorker(req.user.id, workerSlug))) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  const result = await stopOutreachSequence(professionalStore, {
    userId: req.user.id,
    workerId: workerSlug,
    sequenceId: req.params.sequenceId,
    reason: req.body?.reason || SEQUENCE_STOP_REASONS.USER_CANCELLED
  });
  res.json({ ok: true, ...result });
});

app.post("/api/office/workers/:slug/opportunities/packages", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = String(req.params.slug || "").trim();
  if (!(await hasHiredWorker(req.user.id, workerSlug)) || !isMaraWorker(workerSlug)) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  try {
    const creatorProfile = await getCreatorIntelligenceProfile(professionalStore, req.user.id, workerSlug);
    const result = await createOrUpdateOpportunityFromResearch(professionalStore, {
      userId: req.user.id,
      workerId: workerSlug,
      brandName: req.body?.brandName,
      website: req.body?.website,
      evidence: req.body?.evidence || [],
      creatorProfile
    });
    if (req.body?.buildConcept) {
      const concept = buildConceptFromGap({
        creatorProfile,
        brandName: req.body.brandName,
        thesis: req.body?.thesis || null,
        evidenceIds: result.evidence.map((item) => item.id)
      });
      result.concept = await saveConceptIfNovel(professionalStore, {
        userId: req.user.id,
        workerId: workerSlug,
        opportunityId: result.id,
        publicBrandId: result.publicBrandId,
        concept
      });
    }
    res.status(201).json({ ok: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not create opportunity package." });
  }
});

// Every table that holds user-scoped data (all keyed by user_id). Hardcoded
// allowlist — safe to interpolate into SQL. worker_knowledge_modules is global
// seed data and intentionally excluded.
// Every table that holds user-scoped data (all keyed by user_id). Hardcoded
// allowlist — safe to interpolate into SQL. worker_knowledge_modules and
// mara_public_brands are global and intentionally excluded (see accountErasure.mjs).

// Data portability (GDPR/CCPA): download everything we hold about the account.
app.get("/api/account/export", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const data = {
    exportedAt: nowIso(),
    account: await authStore.queryOne(
      `SELECT id, email, name, email_verified_at AS "emailVerifiedAt", created_at AS "createdAt"
       FROM users WHERE id = ?`,
      userId
    )
  };
  for (const table of USER_SCOPED_TABLES) {
    // Never export session or credential-reset material.
    if (["sessions", "email_verification_tokens", "password_reset_tokens"].includes(table)) continue;
    try {
      data[table] = await authStore.query(`SELECT * FROM ${table} WHERE user_id = ?`, userId);
    } catch {
      data[table] = [];
    }
  }
  // Redact stored OAuth tokens from the export.
  if (Array.isArray(data.office_worker_integrations)) {
    data.office_worker_integrations = data.office_worker_integrations.map((row) => ({ ...row, metadata_json: "[redacted]" }));
  }
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="ryva-account-export.json"`);
  res.send(JSON.stringify(data, null, 2));
});

async function eraseUserAccount(userId) {
  if (process.env.STRIPE_SECRET_KEY) {
    const subs = await authStore.query(
      "SELECT stripe_subscription_id AS id FROM hired_workers WHERE user_id = ? AND stripe_subscription_id IS NOT NULL",
      userId
    );
    if (subs.length > 0) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      for (const sub of subs) {
        try {
          await stripe.subscriptions.cancel(sub.id);
        } catch (error) {
          log.error("stripe_cancel_failed_on_delete", { userId, error: error?.message });
          return { ok: false, status: 502, error: "We couldn't stop billing safely. Your account was not deleted; please retry or contact support." };
        }
      }
    }
  }

  const files = await authStore.query(
    `SELECT stored_name AS "storedName" FROM office_uploaded_files WHERE user_id = ?`,
    userId
  );
  for (const file of files) {
    if (file.storedName) {
      await objectStorage.delete({ userId, storedName: file.storedName });
    }
  }

  await deleteUserTrendArtifacts(storageRoot, userId, objectStorage).catch((error) => {
    log.warn("trend_artifact_delete_failed", { userId, error: error?.message });
  });

  await authStore.tx(async (transaction) => {
    for (const table of USER_SCOPED_TABLES) {
      await transaction.execute(`DELETE FROM ${table} WHERE user_id = ?`, userId);
    }
    await transaction.execute("DELETE FROM users WHERE id = ?", userId);
  });

  log.info("account_deleted", { userId });
  return { ok: true };
}

// Right to erasure: verify password or Google re-auth proof, stop billing, wipe all user data.
app.post("/api/account/delete", authLimiter, assertOrigin, requireAuth, async (req, res) => {
  const userId = req.user.id;
  const password = String(req.body?.password ?? "");
  const googleAccessToken = String(req.body?.googleAccessToken ?? "").trim();
  const user = await authStore.queryOne(
    `SELECT id, email, password_hash AS "passwordHash", password_is_set AS "passwordIsSet" FROM users WHERE id = ?`,
    userId
  );
  if (!user) {
    res.status(404).json({ error: "Account not found." });
    return;
  }

  const authz = await authorizeAccountDeletion({
    user,
    password,
    googleAccessToken,
    verifyPassword,
    fetchGoogleProfile,
    normalizeEmail
  });
  if (!authz.ok) {
    const error =
      authz.reason === "google_reauth_required"
        ? "This account uses Google sign-in. Confirm deletion by reconnecting Google."
        : "Confirm deletion with your password, or reconnect Google to authorize account deletion.";
    res.status(403).json({ error, reason: authz.reason });
    return;
  }

  const erased = await eraseUserAccount(userId);
  if (!erased.ok) {
    res.status(erased.status || 502).json({ error: erased.error });
    return;
  }

  clearSessionCookie(res);
  res.json({ ok: true, method: authz.method });
});

app.use(express.static(distDir));
app.use(async (req, res, next) => {
  // Unmatched API routes return a clean JSON 404 instead of the SPA shell.
  if (req.path.startsWith("/api/")) {
    notFoundHandler(req, res);
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

// Terminal error handler — structured, correlated, no stack leaks in prod.
app.use(errorHandler(isProduction));

const server = app.listen(port, host, () => {
  log.info("server_listening", { url: `http://${host}:${port}` });
  if (autonomySchedulerEnabled && maraAutonomyIntervalMinutes > 0) {
    const intervalMs = maraAutonomyIntervalMinutes * 60 * 1000;
    maraAutonomyTimer = setInterval(() => {
      void runScheduledMaraAutonomy();
    }, intervalMs);
    void runScheduledMaraAutonomy();
    log.info("autonomy_scheduler_enabled", { minutes: maraAutonomyIntervalMinutes });
  } else {
    log.info("autonomy_scheduler_disabled", { configured: autonomySchedulerEnabled, minutes: maraAutonomyIntervalMinutes });
  }
});

// Drain cleanly on deploy/rollback: stop the scheduler, finish in-flight
// requests, then exit. (Stage D moves the scheduler to a durable queue.)
installGracefulShutdown({
  server,
  onShutdown: async () => {
    if (maraAutonomyTimer) {
      clearInterval(maraAutonomyTimer);
      maraAutonomyTimer = null;
    }
  }
});
