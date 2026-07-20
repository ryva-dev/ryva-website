import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import path from "node:path";
import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { verify } from "otplib";
import Stripe from "stripe";
import { z, ZodError } from "zod";
import { parse as parseCsv } from "csv-parse/sync";
import type { AppConfig } from "../../../packages/config/src/index.js";
import type { Database } from "../../../packages/database/src/index.js";
import { oneOrNone, withTransaction } from "../../../packages/database/src/index.js";
import {
  createLogger,
  createBuyerCategoryRecommendation,
  createCoreRecord,
  createDecision,
  createEvidence,
  createNote,
  createRisk,
  createSession,
  createSource,
  createTask,
  createIntelligenceObservation,
  createProductBusinessMatch,
  createProductComparison,
  decryptSecret,
  getAccessDecision,
  getCredential,
  getProfile,
  getBrandIntelligence,
  getBusinessIntelligence,
  getProductComparison,
  getProductIntelligence,
  getSettings,
  getHomeCommandCenter,
  getSubscription,
  getRecordContext,
  isCoreRecordType,
  listCoreRecords,
  listBrandIntelligence,
  listBusinessIntelligence,
  listProductIntelligence,
  publicDigest,
  reconcileBillingEvent,
  reconcileCredentialEvent,
  recordAudit,
  searchWorkspace,
  duplicateCandidates,
  enqueueJob,
  retryDeadJob,
  revokeSession,
  updateProfile,
  updateSettings,
  updateCoreRecord,
  updateBrandIntelligence,
  updateBusinessIntelligence,
  updateProductIntelligence,
  updateTaskStatus,
  transitionBrandStage,
  transitionBusinessQualification,
  transitionProductStatus,
  decideBuyerCategoryRecommendation,
  decideProductBusinessMatch,
  decideProductComparison,
  verifyPassword
} from "../../../packages/domain/src/index.js";
import type {
  AiProvider,
  BillingEntitlementEvent,
  CredentialProviderEvent,
  Logger
} from "../../../packages/domain/src/index.js";
import { AppError, emailSchema, newId, uuidSchema } from "../../../packages/shared/src/index.js";
import {
  asyncRoute,
  authenticate,
  databaseRateLimit,
  enforceOrigin,
  requestContext,
  requireCapability,
  requireCsrf,
  requireMfa,
  requireWorkspaceMatch
} from "./middleware.js";
import {
  ConfiguredObjectStorage,
  ConfiguredAiProvider,
  HttpCredentialProvider,
  type CredentialProvider,
  type ObjectStorage
} from "./providers.js";
import "./types.js";
import { registerPhase4Routes } from "./phase4Routes.js";
import { registerPhase5Routes, registerPhase5Webhook } from "./phase5Routes.js";
import { registerPhase6Routes } from "./phase6Routes.js";
import { registerPhase7Routes } from "./phase7Routes.js";
import { registerPhase8Routes } from "./phase8Routes.js";
import { registerPhase9Routes } from "./phase9Routes.js";

type Dependencies = {
  database: Database;
  configuration: AppConfig;
  credentialProvider?: CredentialProvider;
  objectStorage?: ObjectStorage;
  aiProvider?: AiProvider;
  logger?: Logger;
};

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(256),
  mfaCode: z.string().regex(/^\d{6}$/).optional()
});

const profileSchema = z.object({
  version: z.number().int().positive(),
  name: z.string().trim().min(1).max(120),
  timeZone: z.string().trim().min(1).max(100),
  locale: z.string().trim().min(2).max(20),
  professionalTitle: z.string().trim().max(120),
  outreachName: z.string().trim().max(120),
  outreachSignature: z.string().trim().max(4000),
  currency: z.string().regex(/^[A-Z]{3}$/),
  categoryInterests: z.array(z.string().trim().min(1).max(80)).max(50),
  businessTypeInterests: z.array(z.string().trim().min(1).max(80)).max(50),
  geographicPreferences: z.array(z.string().trim().min(1).max(120)).max(100),
  experienceLevel: z.string().trim().min(1).max(40),
  workingHours: z.record(z.string(), z.unknown())
});

const settingsSchema = z.object({
  version: z.number().int().positive(),
  quietHours: z.record(z.string(), z.unknown()),
  notificationPreferences: z.record(z.string(), z.unknown()),
  taskDefaults: z.record(z.string(), z.unknown()),
  aiPreferences: z.record(z.string(), z.unknown())
});

const credentialEventSchema = z.object({
  eventId: z.string().min(1).max(200),
  eventType: z.string().min(1).max(100),
  userId: uuidSchema,
  providerReference: z.string().min(1).max(240),
  credentialType: z.string().min(1).max(120),
  credentialNumberMasked: z.string().min(1).max(80),
  status: z.enum(["pending", "active", "expiring", "expired", "suspended", "revoked", "surrendered"]),
  issuedAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  verifiedAt: z.string().datetime(),
  suspensionReadOnlyAllowed: z.boolean().optional(),
  statusReasonCode: z.string().max(120).nullable().optional(),
  renewalUrl: z.string().url().nullable().optional()
});

const supportGrantSchema = z.object({
  supportUserId: uuidSchema,
  workspaceId: uuidSchema,
  ticketReference: z.string().trim().min(3).max(120),
  reason: z.string().trim().min(10).max(1000),
  allowedRecordTypes: z.array(z.string().trim().min(1).max(80)).max(20),
  allowedRecordIds: z.array(uuidSchema).max(100),
  allowedFields: z.array(z.string().trim().min(1).max(120)).max(100),
  expiresAt: z.string().datetime()
});

const coreCreateSchemas = {
  brand: z.object({
    name: z.string().trim().min(1).max(200),
    legalName: z.string().trim().max(240).optional(),
    website: z.string().url().max(500).optional()
  }),
  product: z.object({
    brandId: uuidSchema,
    name: z.string().trim().min(1).max(240),
    category: z.string().trim().min(1).max(120),
    summary: z.string().trim().max(4000).optional()
  }),
  business: z.object({
    name: z.string().trim().min(1).max(240),
    legalName: z.string().trim().max(240).optional(),
    businessType: z.string().trim().min(1).max(120),
    category: z.string().trim().min(1).max(120),
    website: z.string().url().max(500).optional()
  }),
  contact: z.object({
    parentType: z.enum(["brand", "business"]),
    parentId: uuidSchema,
    name: z.string().trim().min(1).max(200),
    role: z.string().trim().min(1).max(160),
    email: z.string().email().max(320).optional(),
    phone: z.string().trim().max(50).optional()
  })
} as const;

const evidenceSchema = z
  .object({
    exactClaim: z.string().trim().min(1).max(4000),
    evidenceClass: z.enum([
      "verified_fact",
      "direct_evidence",
      "strong_proxy",
      "weak_proxy",
      "estimate",
      "assumption",
      "model_generated_inference",
      "unknown"
    ]),
    verificationStatus: z.enum(["unverified", "reviewed", "verified", "disputed"]),
    sourceId: uuidSchema.nullable().optional(),
    unknownReason: z.string().trim().max(2000).nullable().optional(),
    supports: z.string().trim().max(4000).default(""),
    doesNotSupport: z.string().trim().max(4000).default(""),
    confidence: z.enum(["insufficient", "limited", "supported", "strong"]),
    context: z.string().trim().max(4000).default(""),
    limitations: z.string().trim().max(4000).default(""),
    contraryEvidence: z.string().trim().max(4000).default(""),
    permittedUse: z.string().trim().max(2000).default(""),
    prohibitedInference: z.string().trim().max(2000).default(""),
    observedAt: z.string().datetime().nullable().optional(),
    reassessAt: z.string().datetime().nullable().optional()
  })
  .superRefine((value, context) => {
    if (value.evidenceClass === "unknown" && !value.unknownReason) {
      context.addIssue({ code: "custom", path: ["unknownReason"], message: "Unknown evidence requires a reason." });
    }
    if (value.evidenceClass !== "unknown" && !value.sourceId) {
      context.addIssue({ code: "custom", path: ["sourceId"], message: "This evidence class requires a source." });
    }
    if (value.observedAt && new Date(value.observedAt).getTime() > Date.now() + 300_000) {
      context.addIssue({ code: "custom", path: ["observedAt"], message: "Observed time cannot be in the future." });
    }
  });

const intelligenceUpdateBase = z.object({
  version: z.number().int().positive(),
  evidenceByField: z.record(z.string(), z.array(uuidSchema).min(1).max(20)),
  origin: z.enum(["user_entered", "human_confirmed", "externally_sourced", "imported"])
});

const productIntelligenceChanges = z.object({
  consumerPrice: z.number().nonnegative().nullable().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable().optional(),
  reviewVolume: z.number().int().nonnegative().nullable().optional(),
  reviewQualitySummary: z.string().trim().max(4000).optional(),
  salesEvidenceSummary: z.string().trim().max(4000).optional(),
  trendDirection: z.enum(["rising", "stable", "declining", "volatile", "unknown"]).nullable().optional(),
  repeatPurchaseHypothesis: z.string().trim().max(4000).optional(),
  differentiation: z.string().trim().max(4000).optional(),
  physicalRetailPresence: z.enum(["none_observed", "limited", "moderate", "broad", "unknown"]).nullable().optional(),
  packagingReadiness: z.enum(["not_reviewed", "not_ready", "conditional", "ready", "unknown"]).nullable().optional(),
  wholesaleReadiness: z.enum(["not_reviewed", "not_ready", "conditional", "ready", "unknown"]).nullable().optional(),
  inventoryNotes: z.string().trim().max(4000).optional(),
  fulfillmentNotes: z.string().trim().max(4000).optional(),
  returnsNotes: z.string().trim().max(4000).optional(),
  monitoringStatus: z.enum(["not_monitored", "active", "paused", "source_unavailable"]).optional()
});

const brandIntelligenceChanges = z.object({
  ownershipSummary: z.string().trim().max(4000).optional(),
  wholesaleStatus: z.enum(["unknown", "not_offered", "inquiry_required", "available", "restricted"]).optional(),
  distributionSummary: z.string().trim().max(4000).optional(),
  operationsSummary: z.string().trim().max(4000).optional(),
  inventoryCapability: z.enum(["unknown", "insufficient", "conditional", "supported"]).optional(),
  fulfillmentNotes: z.string().trim().max(4000).optional(),
  communicationCondition: z.enum(["not_reviewed", "concerning", "conditional", "professional"]).optional(),
  communicationRationale: z.string().trim().max(4000).optional(),
  contactPurpose: z.string().trim().max(2000).optional(),
  stopFlag: z.boolean().optional()
});

const businessIntelligenceChanges = z.object({
  locations: z.array(z.object({
    label: z.string().trim().min(1).max(200),
    addressLine1: z.string().trim().max(300).default(""),
    city: z.string().trim().max(120).default(""),
    region: z.string().trim().max(120).default(""),
    postalCode: z.string().trim().max(30).default(""),
    country: z.string().trim().max(2).default("US"),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional()
  })).max(100).optional(),
  assortmentSummary: z.string().trim().max(4000).optional(),
  targetCustomerSummary: z.string().trim().max(4000).optional(),
  pricePositioning: z.enum(["unknown", "value", "mid_market", "premium", "luxury", "mixed"]).optional(),
  currentVendorsSummary: z.string().trim().max(4000).optional(),
  geography: z.object({
    country: z.string().trim().max(2).optional(),
    regions: z.array(z.string().trim().max(120)).max(100).optional(),
    cities: z.array(z.string().trim().max(120)).max(100).optional(),
    radiusMiles: z.number().positive().max(1000).optional()
  }).optional(),
  fitRationale: z.string().trim().max(4000).optional()
});

const classifiedStatementSchema = z.object({
  statement: z.string().trim().min(1).max(2000),
  classification: z.enum(["verified_fact", "direct_evidence", "strong_proxy", "weak_proxy", "estimate", "assumption", "model_generated_inference", "unknown"])
});

function signatureMatches(raw: Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const actualBuffer = Buffer.from(signature.replace(/^sha256=/, ""), "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function sessionPayload(request: Request): Record<string, unknown> {
  return {
    user: {
      id: request.identity?.userId,
      email: request.identity?.email,
      name: request.identity?.name,
      role: request.identity?.role,
      workspaceId: request.identity?.workspaceId
    },
    access: request.access
  };
}

function setSessionCookies(
  response: Response,
  configuration: AppConfig,
  session: { token: string; csrfToken: string; expiresAt: Date }
): void {
  const secure = configuration.NODE_ENV === "production";
  response.cookie("ryva_session", session.token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt
  });
  response.cookie("ryva_csrf", session.csrfToken, {
    httpOnly: false,
    secure,
    sameSite: "strict",
    path: "/",
    expires: session.expiresAt
  });
}

function clearSessionCookies(response: Response, configuration: AppConfig): void {
  const options = {
    secure: configuration.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/"
  };
  response.clearCookie("ryva_session", { ...options, httpOnly: true });
  response.clearCookie("ryva_csrf", {
    ...options,
    sameSite: "strict",
    httpOnly: false
  });
}

function stripeStatus(status: string): BillingEntitlementEvent["status"] {
  if (status === "trialing") return "trial";
  if (status === "active") return "active";
  if (status === "past_due" || status === "unpaid") return "past_due";
  if (status === "canceled") return "canceled";
  if (status === "incomplete_expired") return "ended";
  return "none";
}

function unixDate(value: unknown): string | null {
  return typeof value === "number" ? new Date(value * 1000).toISOString() : null;
}

function stripeEventToEntitlement(event: Stripe.Event): BillingEntitlementEvent | null {
  if (!event.type.startsWith("customer.subscription.")) return null;
  const subscription = event.data.object as unknown as Record<string, unknown>;
  const metadata = (subscription.metadata ?? {}) as Record<string, string>;
  const userId = metadata.ryvaUserId;
  if (!userId) return null;
  const items = subscription.items as { data?: Array<{ price?: { id?: string } }> } | undefined;
  return {
    eventId: event.id,
    eventType: event.type,
    userId,
    providerCustomerId:
      typeof subscription.customer === "string"
        ? subscription.customer
        : ((subscription.customer as { id?: string } | null)?.id ?? null),
    providerSubscriptionId: String(subscription.id),
    status: stripeStatus(String(subscription.status)),
    currentPeriodEnd: unixDate(subscription.current_period_end),
    trialEnd: unixDate(subscription.trial_end),
    cancelAt: unixDate(subscription.cancel_at),
    pastDueSince: String(subscription.status) === "past_due" ? new Date().toISOString() : null,
    priceId: items?.data?.[0]?.price?.id ?? null
  };
}

export function createApp(dependencies: Dependencies): express.Express {
  const { database, configuration } = dependencies;
  const logger = dependencies.logger ?? createLogger(configuration);
  const credentialProvider =
    dependencies.credentialProvider ?? new HttpCredentialProvider(configuration);
  const objectStorage = dependencies.objectStorage ?? new ConfiguredObjectStorage(configuration);
  const aiProvider = dependencies.aiProvider ?? new ConfiguredAiProvider(configuration);
  const app = express();

  if (configuration.TRUST_PROXY) app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(requestContext(logger));
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"]
        }
      },
      referrerPolicy: { policy: "no-referrer" }
    })
  );

  app.post(
    "/api/webhooks/certification",
    express.raw({ type: "application/json", limit: "64kb" }),
    asyncRoute(async (request, response) => {
      const raw = request.body as Buffer;
      if (!signatureMatches(raw, request.header("x-ryva-signature"), configuration.CREDENTIAL_WEBHOOK_SECRET)) {
        throw new AppError(401, "webhook_signature_invalid", "Webhook signature is invalid.");
      }
      const event = credentialEventSchema.parse(JSON.parse(raw.toString("utf8"))) as CredentialProviderEvent;
      const result = await reconcileCredentialEvent(database, event, request.requestId);
      response.status(result.processed ? 202 : 200).json(result);
    })
  );

  app.post(
    "/api/webhooks/stripe",
    express.raw({ type: "application/json", limit: "256kb" }),
    asyncRoute(async (request, response) => {
      if (!configuration.STRIPE_SECRET_KEY || !configuration.STRIPE_WEBHOOK_SECRET) {
        throw new AppError(503, "billing_not_configured", "Billing webhook is not configured.");
      }
      const stripe = new Stripe(configuration.STRIPE_SECRET_KEY);
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(
          request.body as Buffer,
          request.header("stripe-signature") ?? "",
          configuration.STRIPE_WEBHOOK_SECRET
        );
      } catch {
        throw new AppError(401, "webhook_signature_invalid", "Webhook signature is invalid.");
      }
      const mapped = stripeEventToEntitlement(event);
      if (mapped) await reconcileBillingEvent(database, mapped, request.requestId);
      response.status(200).json({ received: true, processed: Boolean(mapped) });
    })
  );

  app.post(
    "/api/webhooks/malware-scan",
    express.raw({ type: "application/json", limit: "64kb" }),
    asyncRoute(async (request, response) => {
      const raw = request.body as Buffer;
      if (
        !signatureMatches(
          raw,
          request.header("x-ryva-signature"),
          configuration.MALWARE_SCANNER_WEBHOOK_SECRET
        )
      ) {
        throw new AppError(401, "webhook_signature_invalid", "Webhook signature is invalid.");
      }
      const input = z
        .object({
          documentId: uuidSchema,
          status: z.enum(["clean", "quarantined", "failed"]),
          engine: z.string().trim().min(1).max(120),
          details: z.string().trim().max(2000).default("")
        })
        .parse(JSON.parse(raw.toString("utf8")));
      await withTransaction(database, async (transaction) => {
        const updated = await transaction.query<{
          workspace_id: string;
          owner_user_id: string;
          sha256: string;
          confidentiality: string;
        }>(
          `UPDATE documents
              SET scan_status=$2,
                  status=CASE WHEN $2='clean' THEN 'active'
                              WHEN $2='quarantined' THEN 'quarantined' ELSE 'scanning' END,
                  updated_at=now(),version=version+1
            WHERE id=$1 AND status IN ('uploading','scanning')
            RETURNING workspace_id,owner_user_id,sha256,confidentiality`,
          [input.documentId, input.status]
        );
        const document = updated.rows[0];
        if (!document) {
          throw new AppError(
            404,
            "document_not_found",
            "Document was not found or scan state is final."
          );
        }
        await recordAudit(transaction, {
          workspaceId: document.workspace_id,
          actorUserId: null,
          actorType: "system",
          action: `document.scan_${input.status}`,
          targetType: "document",
          targetId: input.documentId,
          origin: "webhook",
          requestId: request.requestId,
          outcome: "succeeded",
          metadata: { engine: input.engine, details: input.details }
        });
        if (
          input.status === "clean" &&
          document.confidentiality !== "restricted" &&
          configuration.AI_GENERATION_ENABLED &&
          configuration.AI_PROVIDER_URL &&
          configuration.AI_PROVIDER_TOKEN
        ) {
          const preferences = await transaction.query<{ enabled: boolean }>(
            `SELECT coalesce((ai_preferences->>'enabled')::boolean,false) AS enabled
               FROM workspace_settings WHERE workspace_id=$1`,
            [document.workspace_id]
          );
          if (preferences.rows[0]?.enabled) {
            await enqueueJob(transaction, {
              workspaceId: document.workspace_id,
              kind: "ai.document_extraction",
              payload: {
                documentId: input.documentId,
                actorUserId: document.owner_user_id
              },
              idempotencyKey: `ai.document-extraction:${input.documentId}:${document.sha256}`
            });
          }
        }
      });
      response.status(202).json({ processed: true });
    })
  );

  registerPhase5Webhook(app, database, configuration);

  app.use(express.json({ limit: "256kb", type: "application/json" }));
  app.use(cookieParser());
  app.use(enforceOrigin(configuration));

  app.get("/healthz", (_request, response) => response.status(200).json({ status: "ok" }));
  app.get(
    "/readyz",
    asyncRoute(async (_request, response) => {
      await database.query("SELECT 1");
      response.status(200).json({ status: "ready" });
    })
  );

  app.post(
    "/api/auth/login",
    databaseRateLimit(database, {
      prefix: "login",
      limit: configuration.RATE_LIMIT_LOGIN_MAX,
      windowSeconds: configuration.RATE_LIMIT_WINDOW_SECONDS
    }),
    asyncRoute(async (request, response) => {
      const input = loginSchema.parse(request.body);
      const user = await oneOrNone<{
        id: string;
        email: string;
        name: string;
        password_hash: string;
        status: string;
        mfa_secret_ciphertext: string | null;
        role: string;
        workspace_id: string;
      }>(
        database,
        `SELECT u.*, wm.role, wm.workspace_id FROM users u
         JOIN workspace_memberships wm ON wm.user_id=u.id AND wm.status='active'
         WHERE lower(u.email)=lower($1) ORDER BY wm.created_at LIMIT 1`,
        [input.email]
      );
      const passwordValid =
        user?.status === "active" &&
        (await verifyPassword(input.password, user.password_hash, configuration.SESSION_PEPPER));
      if (!user || !passwordValid) {
        await recordAudit(database, {
          actorType: "system",
          action: "session.login_failed",
          targetType: "login_identifier",
          targetId: publicDigest(input.email),
          origin: "api",
          requestId: request.requestId,
          outcome: "denied",
          metadata: { category: "invalid_credentials" }
        });
        throw new AppError(401, "invalid_credentials", "Email or password is incorrect.");
      }

      const staffRequiresMfa = user.role === "admin" || user.role === "support";
      if (staffRequiresMfa) {
        if (!user.mfa_secret_ciphertext || !configuration.FIELD_ENCRYPTION_KEY) {
          throw new AppError(
            403,
            "mfa_setup_required",
            "This staff account requires multi-factor setup before access."
          );
        }
        if (!input.mfaCode) {
          response.status(202).json({ mfaRequired: true });
          return;
        }
        const secret = decryptSecret(user.mfa_secret_ciphertext, configuration.FIELD_ENCRYPTION_KEY);
        if (!(await verify({ token: input.mfaCode, secret })).valid) {
          await recordAudit(database, {
            workspaceId: user.workspace_id,
            actorUserId: user.id,
            actorType: "user",
            action: "session.mfa_failed",
            targetType: "user",
            targetId: user.id,
            origin: "api",
            requestId: request.requestId,
            outcome: "denied"
          });
          throw new AppError(401, "mfa_invalid", "The verification code is invalid.");
        }
      }

      const session = await createSession(database, configuration, {
        userId: user.id,
        mfaVerified: staffRequiresMfa,
        ...(request.ip ? { ip: request.ip } : {}),
        ...(request.header("user-agent") ? { userAgent: request.header("user-agent")! } : {})
      });
      setSessionCookies(response, configuration, session);
      const access = await getAccessDecision(database, user.id, user.workspace_id);
      await recordAudit(database, {
        workspaceId: user.workspace_id,
        actorUserId: user.id,
        actorType: "user",
        action: "session.created",
        targetType: "session",
        targetId: session.sessionId,
        origin: "api",
        requestId: request.requestId,
        outcome: "succeeded",
        metadata: { accessMode: access?.mode, role: user.role }
      });
      response.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          workspaceId: user.workspace_id
        },
        access
      });
    })
  );

  const authenticated = authenticate(database, configuration);
  const csrf = requireCsrf(database, configuration);

  app.get("/api/session", authenticated, (request, response) => response.json(sessionPayload(request)));
  app.post(
    "/api/auth/logout",
    authenticated,
    csrf,
    asyncRoute(async (request, response) => {
      await revokeSession(database, request.identity!.sessionId, "user_logout");
      await recordAudit(database, {
        workspaceId: request.identity!.workspaceId,
        actorUserId: request.identity!.userId,
        actorType: "user",
        action: "session.revoked",
        targetType: "session",
        targetId: request.identity!.sessionId,
        origin: "api",
        requestId: request.requestId,
        outcome: "succeeded",
        metadata: { reason: "user_logout" }
      });
      clearSessionCookies(response, configuration);
      response.status(204).end();
    })
  );

  app.get("/api/access", authenticated, (request, response) => response.json({ access: request.access }));
  app.get(
    "/api/home",
    authenticated,
    requireCapability(database, "operational:read"),
    asyncRoute(async (request, response) => {
      const workspaceId=request.identity!.workspaceId;
      const [nextActions,authorityRisks,stalled,recentChanges,commandCenter]=await Promise.all([
        database.query(
          `SELECT id,title,subject_type AS "subjectType",subject_id AS "subjectId",
                  priority,due_at AS "dueAt",status
             FROM tasks WHERE workspace_id=$1 AND owner_user_id=$2
              AND status IN ('open','in_progress','blocked')
            ORDER BY due_at ASC NULLS LAST,priority DESC LIMIT 12`,
          [workspaceId,request.identity!.userId]
        ),
        database.query(
          `SELECT a.id,a.brand_id AS "brandId",b.public_name AS "brandName",a.status,
                  a.expires_at AS "expiresAt",a.renewal_review_at AS "renewalReviewAt",
                  a.legal_ambiguity_status AS "legalAmbiguityStatus"
             FROM representation_agreements a
             JOIN brands b ON b.workspace_id=a.workspace_id AND b.id=a.brand_id
            WHERE a.workspace_id=$1 AND a.archived_at IS NULL
              AND (a.status IN ('suspended','expired') OR
                   a.legal_ambiguity_status IN ('review_required','specialist_required') OR
                   (a.status='active' AND a.expires_at<now()+interval '60 days'))
            ORDER BY coalesce(a.expires_at,a.updated_at) LIMIT 12`,[workspaceId]
        ),
        database.query(
          `SELECT p.id,br.public_name AS "brandName",b.name AS "businessName",p.stage,
                  p.last_meaningful_action_at AS "lastMeaningfulActionAt"
             FROM placement_opportunities p
             JOIN brands br ON br.workspace_id=p.workspace_id AND br.id=p.brand_id
             JOIN businesses b ON b.workspace_id=p.workspace_id AND b.id=p.business_id
             LEFT JOIN tasks t ON t.workspace_id=p.workspace_id AND t.id=p.next_action_task_id
            WHERE p.workspace_id=$1 AND p.archived_at IS NULL
              AND p.stage NOT IN ('closed_lost','disqualified')
              AND (t.id IS NULL OR (t.status NOT IN ('completed','canceled') AND t.due_at<now())
                   OR p.last_meaningful_action_at<now()-interval '14 days')
              AND (p.snoozed_until IS NULL OR p.snoozed_until<=now())
            ORDER BY p.last_meaningful_action_at LIMIT 12`,[workspaceId]
        ),
        database.query(
          `SELECT action,target_type AS "targetType",target_id AS "targetId",
                  occurred_at AS "occurredAt",outcome
             FROM audit_events WHERE workspace_id=$1 AND
              target_type IN ('representation_agreement','representation_opportunity',
                              'placement_opportunity','authority_evaluation')
            ORDER BY occurred_at DESC LIMIT 12`,[workspaceId]
        ),
        getHomeCommandCenter(database,workspaceId,request.identity!.userId)
      ]);
      response.json({
        access:request.access,
        account:{name:request.identity!.name,workspaceId},
        nextActions:nextActions.rows,
        authorityRisks:authorityRisks.rows,
        stalledPlacements:stalled.rows,
        recentChanges:recentChanges.rows,
        commandCenter
      });
    })
  );

  app.get(
    "/api/certification",
    authenticated,
    asyncRoute(async (request, response) => {
      response.json({
        credential: await getCredential(database, request.identity!.userId),
        access: request.access
      });
    })
  );
  app.post(
    "/api/certification/refresh",
    authenticated,
    csrf,
    asyncRoute(async (request, response) => {
      const current = await getCredential(database, request.identity!.userId);
      if (!current) {
        throw new AppError(
          409,
          "credential_not_linked",
          "Link a credential before requesting a refresh."
        );
      }
      const raw = await credentialProvider.refresh(current.providerReference);
      const event = credentialEventSchema.parse(raw);
      if (event.userId !== request.identity!.userId) {
        throw new AppError(403, "credential_identity_mismatch", "Credential identity does not match.");
      }
      await reconcileCredentialEvent(database, event as CredentialProviderEvent, request.requestId);
      response.json({ credential: await getCredential(database, request.identity!.userId) });
    })
  );

  app.get(
    "/api/subscription",
    authenticated,
    asyncRoute(async (request, response) => {
      response.json({
        subscription: await getSubscription(database, request.identity!.userId),
        access: request.access
      });
    })
  );
  app.post(
    "/api/subscription/checkout",
    authenticated,
    csrf,
    asyncRoute(async (request, response) => {
      const credential = await getCredential(database, request.identity!.userId);
      if (
        !credential ||
        !["active", "expiring"].includes(credential.status) ||
        (credential.expiresAt && credential.expiresAt <= new Date())
      ) {
        throw new AppError(
          403,
          "eligible_credential_required",
          "An active eligible certification is required before subscription activation."
        );
      }
      if (!configuration.STRIPE_SECRET_KEY || !configuration.STRIPE_PRICE_ID) {
        throw new AppError(
          503,
          "billing_not_configured",
          "Subscription checkout is not available until the billing provider is configured."
        );
      }
      const stripe = new Stripe(configuration.STRIPE_SECRET_KEY);
      const checkout = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer_email: request.identity!.email,
        line_items: [{ price: configuration.STRIPE_PRICE_ID, quantity: 1 }],
        success_url: `${configuration.APP_URL}/subscription?checkout=success`,
        cancel_url: `${configuration.APP_URL}/subscription/activate?checkout=canceled`,
        metadata: { ryvaUserId: request.identity!.userId },
        subscription_data: { metadata: { ryvaUserId: request.identity!.userId } }
      });
      if (!checkout.url) throw new AppError(502, "checkout_failed", "Billing checkout did not return a URL.");
      await recordAudit(database, {
        workspaceId: request.identity!.workspaceId,
        actorUserId: request.identity!.userId,
        actorType: "user",
        action: "subscription.checkout_created",
        targetType: "checkout_session",
        targetId: checkout.id,
        origin: "api",
        requestId: request.requestId,
        outcome: "succeeded"
      });
      response.status(201).json({ url: checkout.url });
    })
  );
  app.post(
    "/api/subscription/portal",
    authenticated,
    csrf,
    asyncRoute(async (request, response) => {
      const subscription = await oneOrNone<{ provider_customer_id: string | null }>(
        database,
        "SELECT provider_customer_id FROM subscription_entitlements WHERE user_id=$1",
        [request.identity!.userId]
      );
      if (!subscription?.provider_customer_id || !configuration.STRIPE_SECRET_KEY) {
        throw new AppError(409, "billing_portal_unavailable", "No managed billing account is available.");
      }
      const stripe = new Stripe(configuration.STRIPE_SECRET_KEY);
      const portal = await stripe.billingPortal.sessions.create({
        customer: subscription.provider_customer_id,
        return_url: `${configuration.APP_URL}/subscription`
      });
      response.status(201).json({ url: portal.url });
    })
  );

  app.get(
    "/api/workspaces/:workspaceId/profile",
    authenticated,
    requireWorkspaceMatch(),
    requireCapability(database, "profile:read"),
    asyncRoute(async (request, response) => {
      const profile = await getProfile(database, request.identity!.userId, request.identity!.workspaceId);
      if (!profile) throw new AppError(404, "profile_not_found", "Profile not found.");
      response.json({ profile });
    })
  );
  app.put(
    "/api/workspaces/:workspaceId/profile",
    authenticated,
    requireWorkspaceMatch(),
    csrf,
    requireCapability(database, "profile:write"),
    asyncRoute(async (request, response) => {
      const input = profileSchema.parse(request.body);
      const profile = await updateProfile(database, {
        ...input,
        userId: request.identity!.userId,
        workspaceId: request.identity!.workspaceId,
        requestId: request.requestId
      });
      response.json({ profile });
    })
  );

  app.get(
    "/api/workspaces/:workspaceId/settings",
    authenticated,
    requireWorkspaceMatch(),
    requireCapability(database, "settings:read"),
    asyncRoute(async (request, response) => {
      const settings = await getSettings(database, request.identity!.workspaceId);
      if (!settings) throw new AppError(404, "settings_not_found", "Settings not found.");
      response.json({ settings });
    })
  );
  app.put(
    "/api/workspaces/:workspaceId/settings",
    authenticated,
    requireWorkspaceMatch(),
    csrf,
    requireCapability(database, "settings:write"),
    asyncRoute(async (request, response) => {
      const input = settingsSchema.parse(request.body);
      const settings = await updateSettings(database, {
        ...input,
        workspaceId: request.identity!.workspaceId,
        actorUserId: request.identity!.userId,
        requestId: request.requestId
      });
      response.json({ settings });
    })
  );

  app.get(
    "/api/intelligence/products",
    authenticated,
    requireCapability(database, "operational:read"),
    asyncRoute(async (request, response) => {
      const query = z.object({
        view: z.enum(["discover", "watchlist", "under_review", "qualified", "rejected", "represented", "recently_updated"]).default("discover"),
        q: z.string().trim().max(200).optional(),
        category: z.string().trim().max(160).optional(),
        brandId: uuidSchema.optional(),
        confidence: z.enum(["insufficient", "limited", "supported", "strong"]).optional(),
        risk: z.enum(["low", "medium", "high", "critical"]).optional(),
        readiness: z.enum(["not_reviewed", "not_ready", "conditional", "ready", "unknown"]).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0)
      }).parse(request.query);
      response.json(await listProductIntelligence(database, {
        workspaceId: request.identity!.workspaceId,
        view: query.view,
        limit: query.limit,
        offset: query.offset,
        ...(query.q ? { query: query.q } : {}),
        ...(query.category ? { category: query.category } : {}),
        ...(query.brandId ? { brandId: query.brandId } : {}),
        ...(query.confidence ? { confidence: query.confidence } : {}),
        ...(query.risk ? { risk: query.risk } : {}),
        ...(query.readiness ? { readiness: query.readiness } : {})
      }));
    })
  );
  app.get(
    "/api/intelligence/products/:productId",
    authenticated,
    requireCapability(database, "operational:read"),
    asyncRoute(async (request, response) => {
      response.json(await getProductIntelligence(
        database,
        request.identity!.workspaceId,
        uuidSchema.parse(request.params.productId)
      ));
    })
  );
  app.patch(
    "/api/intelligence/products/:productId",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      const input = intelligenceUpdateBase.extend({
        changes: productIntelligenceChanges
      }).parse(request.body);
      response.json({
        product: await updateProductIntelligence(database, {
          workspaceId: request.identity!.workspaceId,
          actorUserId: request.identity!.userId,
          requestId: request.requestId,
          subjectType: "product",
          subjectId: uuidSchema.parse(request.params.productId),
          ...input
        })
      });
    })
  );
  app.post(
    "/api/intelligence/products/:productId/status",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      const input = z.object({
        version: z.number().int().positive(),
        toStatus: z.enum(["watchlist", "under_review", "qualified", "rejected", "represented"]),
        decisionId: uuidSchema,
        nextActionTaskId: uuidSchema.nullable().optional()
      }).parse(request.body);
      response.json({
        product: await transitionProductStatus(database, {
          workspaceId: request.identity!.workspaceId,
          actorUserId: request.identity!.userId,
          requestId: request.requestId,
          productId: uuidSchema.parse(request.params.productId),
          version: input.version,
          toStatus: input.toStatus,
          decisionId: input.decisionId,
          ...(input.nextActionTaskId !== undefined ? { nextActionTaskId: input.nextActionTaskId } : {})
        })
      });
    })
  );

  app.get(
    "/api/intelligence/brands",
    authenticated,
    requireCapability(database, "operational:read"),
    asyncRoute(async (request, response) => {
      const query = z.object({
        stage: z.enum(["discovered","researching","contact_ready","contacted","conversation","reviewing_terms","authorized","active","paused","ended","rejected"]).optional(),
        q: z.string().trim().max(200).optional(),
        wholesaleStatus: z.enum(["unknown","not_offered","inquiry_required","available","restricted"]).optional(),
        risk: z.enum(["low","medium","high","critical"]).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0)
      }).parse(request.query);
      response.json(await listBrandIntelligence(database, {
        workspaceId: request.identity!.workspaceId,
        limit: query.limit,
        offset: query.offset,
        ...(query.stage ? { stage: query.stage } : {}),
        ...(query.q ? { query: query.q } : {}),
        ...(query.wholesaleStatus ? { wholesaleStatus: query.wholesaleStatus } : {}),
        ...(query.risk ? { risk: query.risk } : {})
      }));
    })
  );
  app.get(
    "/api/intelligence/brands/:brandId",
    authenticated,
    requireCapability(database, "operational:read"),
    asyncRoute(async (request, response) => {
      response.json(await getBrandIntelligence(
        database,
        request.identity!.workspaceId,
        uuidSchema.parse(request.params.brandId)
      ));
    })
  );
  app.patch(
    "/api/intelligence/brands/:brandId",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      const input = intelligenceUpdateBase.extend({ changes: brandIntelligenceChanges }).parse(request.body);
      response.json({
        brand: await updateBrandIntelligence(database, {
          workspaceId: request.identity!.workspaceId,
          actorUserId: request.identity!.userId,
          requestId: request.requestId,
          subjectType: "brand",
          subjectId: uuidSchema.parse(request.params.brandId),
          ...input
        })
      });
    })
  );
  app.post(
    "/api/intelligence/brands/:brandId/stage",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      const input = z.object({
        version: z.number().int().positive(),
        toStage: z.enum(["researching","contact_ready","contacted","conversation","reviewing_terms","authorized","active","paused","ended","rejected"]),
        reason: z.string().trim().min(1).max(4000),
        decisionId: uuidSchema,
        nextActionTaskId: uuidSchema.nullable().optional()
      }).parse(request.body);
      response.json({
        brand: await transitionBrandStage(database, {
          workspaceId: request.identity!.workspaceId,
          actorUserId: request.identity!.userId,
          requestId: request.requestId,
          brandId: uuidSchema.parse(request.params.brandId),
          version: input.version,
          toStage: input.toStage,
          reason: input.reason,
          decisionId: input.decisionId,
          ...(input.nextActionTaskId !== undefined ? { nextActionTaskId: input.nextActionTaskId } : {})
        })
      });
    })
  );

  app.get(
    "/api/intelligence/businesses",
    authenticated,
    requireCapability(database, "operational:read"),
    asyncRoute(async (request, response) => {
      const query = z.object({
        q: z.string().trim().max(200).optional(),
        businessType: z.string().trim().max(160).optional(),
        category: z.string().trim().max(160).optional(),
        qualificationStatus: z.enum(["not_reviewed","researching","qualified","rejected","conditional"]).optional(),
        geography: z.string().trim().max(160).optional(),
        buyerVerification: z.enum(["unverified","reviewing","verified","stale","disputed"]).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0)
      }).parse(request.query);
      response.json(await listBusinessIntelligence(database, {
        workspaceId: request.identity!.workspaceId,
        limit: query.limit,
        offset: query.offset,
        ...(query.q ? { query: query.q } : {}),
        ...(query.businessType ? { businessType: query.businessType } : {}),
        ...(query.category ? { category: query.category } : {}),
        ...(query.qualificationStatus ? { qualificationStatus: query.qualificationStatus } : {}),
        ...(query.geography ? { geography: query.geography } : {}),
        ...(query.buyerVerification ? { buyerVerification: query.buyerVerification } : {})
      }));
    })
  );
  app.get(
    "/api/intelligence/businesses/:businessId",
    authenticated,
    requireCapability(database, "operational:read"),
    asyncRoute(async (request, response) => {
      response.json(await getBusinessIntelligence(
        database,
        request.identity!.workspaceId,
        uuidSchema.parse(request.params.businessId)
      ));
    })
  );
  app.patch(
    "/api/intelligence/businesses/:businessId",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      const input = intelligenceUpdateBase.extend({ changes: businessIntelligenceChanges }).parse(request.body);
      response.json({
        business: await updateBusinessIntelligence(database, {
          workspaceId: request.identity!.workspaceId,
          actorUserId: request.identity!.userId,
          requestId: request.requestId,
          subjectType: "business",
          subjectId: uuidSchema.parse(request.params.businessId),
          ...input
        })
      });
    })
  );
  app.post(
    "/api/intelligence/businesses/:businessId/qualification",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      const input = z.object({
        version: z.number().int().positive(),
        toStatus: z.enum(["researching","qualified","conditional","rejected"]),
        decisionId: uuidSchema,
        nextActionTaskId: uuidSchema.nullable().optional()
      }).parse(request.body);
      response.json({
        business: await transitionBusinessQualification(database, {
          workspaceId: request.identity!.workspaceId,
          actorUserId: request.identity!.userId,
          requestId: request.requestId,
          businessId: uuidSchema.parse(request.params.businessId),
          version: input.version,
          toStatus: input.toStatus,
          decisionId: input.decisionId,
          ...(input.nextActionTaskId !== undefined ? { nextActionTaskId: input.nextActionTaskId } : {})
        })
      });
    })
  );

  app.post(
    "/api/intelligence/:type/:id/observations",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      const type = z.enum(["product", "brand", "business", "contact"]).parse(request.params.type);
      const input = z.object({
        metricCode: z.string().trim().min(1).max(120),
        value: z.unknown(),
        unit: z.string().trim().max(80).nullable().optional(),
        evidenceClass: z.enum(["verified_fact","direct_evidence","strong_proxy","weak_proxy","estimate","assumption","model_generated_inference","unknown"]),
        confidence: z.enum(["insufficient","limited","supported","strong"]),
        sourceId: uuidSchema.nullable().optional(),
        unknownReason: z.string().trim().max(2000).nullable().optional(),
        observedAt: z.string().datetime().nullable().optional(),
        geography: z.string().trim().max(200).nullable().optional(),
        acquisitionContext: z.string().trim().min(1).max(2000),
        limitations: z.string().trim().max(4000).default(""),
        origin: z.enum(["user_entered","externally_sourced","imported"]),
        supersedesId: uuidSchema.nullable().optional()
      }).parse(request.body);
      if (input.observedAt && new Date(input.observedAt).getTime() > Date.now() + 300_000) {
        throw new AppError(422, "observation_time_invalid", "Observed time cannot be in the future.");
      }
      response.status(201).json({
        observation: await createIntelligenceObservation(database, {
          workspaceId: request.identity!.workspaceId,
          actorUserId: request.identity!.userId,
          requestId: request.requestId,
          subjectType: type,
          subjectId: uuidSchema.parse(request.params.id),
          metricCode: input.metricCode,
          value: input.value,
          evidenceClass: input.evidenceClass,
          confidence: input.confidence,
          acquisitionContext: input.acquisitionContext,
          limitations: input.limitations,
          origin: input.origin,
          ...(input.unit !== undefined ? { unit: input.unit } : {}),
          ...(input.sourceId !== undefined ? { sourceId: input.sourceId } : {}),
          ...(input.unknownReason !== undefined ? { unknownReason: input.unknownReason } : {}),
          ...(input.observedAt !== undefined ? { observedAt: input.observedAt } : {}),
          ...(input.geography !== undefined ? { geography: input.geography } : {}),
          ...(input.supersedesId !== undefined ? { supersedesId: input.supersedesId } : {})
        })
      });
    })
  );

  app.post(
    "/api/intelligence/products/:productId/buyer-categories",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      const input = z.object({
        buyerCategory: z.string().trim().min(1).max(200),
        rationale: z.string().trim().min(1).max(4000),
        confidence: z.enum(["insufficient","limited","supported","strong"]),
        evidenceIds: z.array(uuidSchema).min(1).max(50),
        missingEvidence: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
        contraryEvidence: z.string().trim().max(4000).default(""),
        origin: z.enum(["user_entered","imported"])
      }).parse(request.body);
      response.status(201).json({
        recommendation: await createBuyerCategoryRecommendation(database, {
          workspaceId: request.identity!.workspaceId,
          actorUserId: request.identity!.userId,
          requestId: request.requestId,
          productId: uuidSchema.parse(request.params.productId),
          ...input
        })
      });
    })
  );
  app.patch(
    "/api/intelligence/buyer-categories/:recommendationId",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      const input = z.object({
        version: z.number().int().positive(),
        status: z.enum(["confirmed","rejected"])
      }).parse(request.body);
      response.json({
        recommendation: await decideBuyerCategoryRecommendation(database, {
          workspaceId: request.identity!.workspaceId,
          actorUserId: request.identity!.userId,
          requestId: request.requestId,
          recommendationId: uuidSchema.parse(request.params.recommendationId),
          ...input
        })
      });
    })
  );

  app.post(
    "/api/intelligence/matches",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      const input = z.object({
        productId: uuidSchema,
        businessId: uuidSchema,
        context: z.object({
          channel: z.string().trim().min(1).max(160),
          geography: z.string().trim().min(1).max(200),
          buyerType: z.string().trim().min(1).max(200),
          priceBand: z.string().trim().max(120).default("unknown"),
          period: z.string().trim().max(120).default("current")
        }),
        rationale: z.string().trim().min(1).max(6000),
        confidence: z.enum(["insufficient","limited","supported","strong"]),
        materialStatements: z.array(classifiedStatementSchema).min(1).max(30),
        evidenceIds: z.array(uuidSchema).min(1).max(50),
        missingEvidence: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
        contraryEvidence: z.string().trim().max(4000).default(""),
        origin: z.enum(["user_entered","imported"])
      }).parse(request.body);
      response.status(201).json({
        match: await createProductBusinessMatch(database, {
          workspaceId: request.identity!.workspaceId,
          actorUserId: request.identity!.userId,
          requestId: request.requestId,
          contextDigest: publicDigest(JSON.stringify(input.context)),
          ...input
        })
      });
    })
  );
  app.patch(
    "/api/intelligence/matches/:matchId",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      const input = z.object({
        version: z.number().int().positive(),
        status: z.enum(["under_review","qualified","conditional","rejected"]),
        decisionId: uuidSchema,
        nextActionTaskId: uuidSchema.nullable().optional()
      }).parse(request.body);
      response.json({
        match: await decideProductBusinessMatch(database, {
          workspaceId: request.identity!.workspaceId,
          actorUserId: request.identity!.userId,
          requestId: request.requestId,
          matchId: uuidSchema.parse(request.params.matchId),
          version: input.version,
          status: input.status,
          decisionId: input.decisionId,
          ...(input.nextActionTaskId !== undefined ? { nextActionTaskId: input.nextActionTaskId } : {})
        })
      });
    })
  );

  app.post(
    "/api/intelligence/comparisons",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      const input = z.object({
        name: z.string().trim().min(1).max(240),
        productIds: z.array(uuidSchema).min(2).max(4),
        context: z.object({
          category: z.string().trim().max(160).default(""),
          geography: z.string().trim().max(200).default(""),
          channel: z.string().trim().max(160).default(""),
          buyerType: z.string().trim().max(200).default(""),
          period: z.string().trim().max(120).default("current"),
          evidenceDate: z.string().date().nullable().optional()
        })
      }).parse(request.body);
      response.status(201).json(await createProductComparison(database, {
        workspaceId: request.identity!.workspaceId,
        actorUserId: request.identity!.userId,
        requestId: request.requestId,
        ...input
      }));
    })
  );
  app.get(
    "/api/intelligence/comparisons/:comparisonId",
    authenticated,
    requireCapability(database, "operational:read"),
    asyncRoute(async (request, response) => {
      response.json(await getProductComparison(
        database,
        request.identity!.workspaceId,
        uuidSchema.parse(request.params.comparisonId)
      ));
    })
  );
  app.post(
    "/api/intelligence/comparisons/:comparisonId/decision",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      const input = z.object({
        version: z.number().int().positive(),
        selectedProductId: uuidSchema,
        rationale: z.string().trim().min(1).max(6000),
        decisionId: uuidSchema
      }).parse(request.body);
      response.json(await decideProductComparison(database, {
        workspaceId: request.identity!.workspaceId,
        actorUserId: request.identity!.userId,
        requestId: request.requestId,
        comparisonId: uuidSchema.parse(request.params.comparisonId),
        ...input
      }));
    })
  );

  app.get(
    "/api/records/:type",
    authenticated,
    requireCapability(database, "operational:read"),
    asyncRoute(async (request, response) => {
      if (!isCoreRecordType(request.params.type)) {
        throw new AppError(404, "record_type_unknown", "Record type not found.");
      }
      const query = typeof request.query.q === "string" ? request.query.q.slice(0, 200) : undefined;
      const status = typeof request.query.status === "string" ? request.query.status.slice(0, 80) : undefined;
      const limit = z.coerce.number().int().min(1).max(100).default(50).parse(request.query.limit);
      const offset = z.coerce.number().int().min(0).default(0).parse(request.query.offset);
      response.json(
        await listCoreRecords(database, {
          workspaceId: request.identity!.workspaceId,
          type: request.params.type,
          ...(query ? { query } : {}),
          ...(status ? { status } : {}),
          limit,
          offset
        })
      );
    })
  );
  app.post(
    "/api/records/:type",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      if (!isCoreRecordType(request.params.type)) {
        throw new AppError(404, "record_type_unknown", "Record type not found.");
      }
      const values = coreCreateSchemas[request.params.type].parse(request.body) as Record<string, unknown>;
      const candidates = await duplicateCandidates(
        database,
        request.identity!.workspaceId,
        request.params.type,
        String(values.name)
      );
      if (candidates.some((candidate) => Number(candidate.similarity) >= 0.999)) {
        throw new AppError(
          409,
          "duplicate_review_required",
          "An existing record has the same normalized name. Review it before creating another."
        );
      }
      const record = await createCoreRecord(database, {
        workspaceId: request.identity!.workspaceId,
        actorUserId: request.identity!.userId,
        requestId: request.requestId,
        type: request.params.type,
        values
      });
      response.status(201).json({ record });
    })
  );
  app.get(
    "/api/records/:type/duplicates",
    authenticated,
    requireCapability(database, "operational:read"),
    asyncRoute(async (request, response) => {
      if (!isCoreRecordType(request.params.type)) {
        throw new AppError(404, "record_type_unknown", "Record type not found.");
      }
      const name = z.string().trim().min(2).max(240).parse(request.query.name);
      response.json({
        candidates: await duplicateCandidates(
          database,
          request.identity!.workspaceId,
          request.params.type,
          name
        )
      });
    })
  );
  app.get(
    "/api/records/:type/:id",
    authenticated,
    requireCapability(database, "operational:read"),
    asyncRoute(async (request, response) => {
      if (!isCoreRecordType(request.params.type)) {
        throw new AppError(404, "record_type_unknown", "Record type not found.");
      }
      response.json(
        await getRecordContext(
          database,
          request.identity!.workspaceId,
          request.params.type,
          uuidSchema.parse(request.params.id)
        )
      );
    })
  );
  app.patch(
    "/api/records/:type/:id",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      if (!isCoreRecordType(request.params.type)) {
        throw new AppError(404, "record_type_unknown", "Record type not found.");
      }
      const input = z
        .object({
          version: z.number().int().positive(),
          changes: z.record(z.string(), z.unknown())
        })
        .parse(request.body);
      response.json({
        record: await updateCoreRecord(database, {
          workspaceId: request.identity!.workspaceId,
          actorUserId: request.identity!.userId,
          requestId: request.requestId,
          type: request.params.type,
          id: uuidSchema.parse(request.params.id),
          version: input.version,
          changes: input.changes
        })
      });
    })
  );

  app.get(
    "/api/sources",
    authenticated,
    requireCapability(database, "operational:read"),
    asyncRoute(async (request, response) => {
      const result = await database.query<Record<string, unknown>>(
        `SELECT id,source_type AS "sourceType",reference,url,
                owner_or_provider AS "ownerOrProvider",
                rights_classification AS "rightsClassification",confidentiality,
                captured_at AS "capturedAt",status,version
           FROM sources WHERE workspace_id=$1 AND status<>'deleted'
          ORDER BY captured_at DESC LIMIT 200`,
        [request.identity!.workspaceId]
      );
      response.json({ sources: result.rows });
    })
  );
  app.post(
    "/api/sources",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      const input = z
        .object({
          sourceType: z.string().trim().min(1).max(120),
          reference: z.string().trim().min(1).max(500),
          url: z.string().url().max(1000).nullable().optional(),
          ownerOrProvider: z.string().trim().min(1).max(240),
          rightsClassification: z.enum(["owned", "licensed", "public_reference", "restricted", "unknown"]),
          confidentiality: z.enum(["normal", "confidential", "restricted"]),
          observedFrom: z.string().datetime().nullable().optional(),
          observedTo: z.string().datetime().nullable().optional()
        })
        .parse(request.body);
      response.status(201).json({
        source: await createSource(database, {
          ...input,
          workspaceId: request.identity!.workspaceId,
          actorUserId: request.identity!.userId,
          requestId: request.requestId
        })
      });
    })
  );
  app.post(
    "/api/records/:type/:id/evidence",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      if (!isCoreRecordType(request.params.type)) {
        throw new AppError(404, "record_type_unknown", "Record type not found.");
      }
      const input = evidenceSchema.parse(request.body);
      response.status(201).json({
        evidence: await createEvidence(database, {
          ...input,
          workspaceId: request.identity!.workspaceId,
          actorUserId: request.identity!.userId,
          requestId: request.requestId,
          subjectType: request.params.type,
          subjectId: uuidSchema.parse(request.params.id)
        })
      });
    })
  );
  app.post(
    "/api/records/:type/:id/notes",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      if (!isCoreRecordType(request.params.type)) {
        throw new AppError(404, "record_type_unknown", "Record type not found.");
      }
      const input = z
        .object({
          body: z.string().trim().min(1).max(20_000),
          noteType: z.string().trim().min(1).max(80).default("general"),
          pinned: z.boolean().default(false)
        })
        .parse(request.body);
      response.status(201).json({
        note: await createNote(database, {
          ...input,
          workspaceId: request.identity!.workspaceId,
          actorUserId: request.identity!.userId,
          requestId: request.requestId,
          subjectType: request.params.type,
          subjectId: uuidSchema.parse(request.params.id)
        })
      });
    })
  );
  app.patch(
    "/api/notes/:noteId",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      const noteId = uuidSchema.parse(request.params.noteId);
      const input = z.object({
        version: z.number().int().positive(),
        body: z.string().trim().min(1).max(20_000),
        pinned: z.boolean()
      }).parse(request.body);
      const note = await withTransaction(database, async (transaction) => {
        const result = await transaction.query<{
          id: string;
          body: string;
          pinned: boolean;
          version: number;
        }>(
          `UPDATE notes SET body=$5,pinned=$6,version=version+1,updated_at=now()
            WHERE id=$1 AND workspace_id=$2 AND author_user_id=$3 AND version=$4
              AND archived_at IS NULL
            RETURNING id,body,pinned,version`,
          [noteId, request.identity!.workspaceId, request.identity!.userId, input.version, input.body, input.pinned]
        );
        const updated = result.rows[0];
        if (!updated) {
          throw new AppError(409, "version_conflict", "This note changed after you opened it.");
        }
        await transaction.query(
          `INSERT INTO note_versions(id,note_id,body,version,changed_by)
           VALUES($1,$2,$3,$4,$5)`,
          [newId(), noteId, updated.body, updated.version, request.identity!.userId]
        );
        await transaction.query(
          `INSERT INTO activities
            (id,workspace_id,activity_type,actor_user_id,subject_type,subject_id,summary,status,metadata)
           SELECT $1,workspace_id,'note_updated',$2,subject_type,subject_id,
                  'Note updated','completed',$3
             FROM notes WHERE id=$4 AND workspace_id=$5`,
          [newId(), request.identity!.userId, { noteId, version: updated.version }, noteId, request.identity!.workspaceId]
        );
        await recordAudit(transaction, {
          workspaceId: request.identity!.workspaceId,
          actorUserId: request.identity!.userId,
          actorType: "user",
          action: "note.updated",
          targetType: "note",
          targetId: noteId,
          origin: "api",
          requestId: request.requestId,
          outcome: "succeeded",
          after: updated
        });
        return updated;
      });
      response.json({ note });
    })
  );
  app.post(
    "/api/records/:type/:id/tasks",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      if (!isCoreRecordType(request.params.type)) {
        throw new AppError(404, "record_type_unknown", "Record type not found.");
      }
      const input = z
        .object({
          title: z.string().trim().min(1).max(300),
          priority: z.enum(["low", "medium", "high", "critical"]),
          dueAt: z.string().datetime().nullable().optional(),
          createdReason: z.string().trim().min(1).max(500),
          mandatoryGate: z.boolean().default(false)
        })
        .parse(request.body);
      response.status(201).json({
        task: await createTask(database, {
          ...input,
          workspaceId: request.identity!.workspaceId,
          actorUserId: request.identity!.userId,
          requestId: request.requestId,
          subjectType: request.params.type,
          subjectId: uuidSchema.parse(request.params.id)
        })
      });
    })
  );
  app.post(
    "/api/records/:type/:id/risks",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      if (!isCoreRecordType(request.params.type)) {
        throw new AppError(404, "record_type_unknown", "Record type not found.");
      }
      const input = z
        .object({
          riskType: z.string().trim().min(1).max(120),
          severity: z.enum(["low", "medium", "high", "critical"]),
          description: z.string().trim().min(1).max(4000),
          mitigation: z.string().trim().max(4000).default(""),
          dueAt: z.string().datetime().nullable().optional()
        })
        .parse(request.body);
      response.status(201).json({
        risk: await createRisk(database, {
          ...input,
          workspaceId: request.identity!.workspaceId,
          actorUserId: request.identity!.userId,
          requestId: request.requestId,
          subjectType: request.params.type,
          subjectId: uuidSchema.parse(request.params.id)
        })
      });
    })
  );
  app.post(
    "/api/records/:type/:id/decisions",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      if (!isCoreRecordType(request.params.type)) {
        throw new AppError(404, "record_type_unknown", "Record type not found.");
      }
      const input = z
        .object({
          question: z.string().trim().min(1).max(1000),
          scope: z.string().trim().min(1).max(2000),
          outcome: z.string().trim().min(1).max(1000),
          rationale: z.string().trim().min(1).max(8000),
          confidence: z.enum(["insufficient", "limited", "supported", "strong"]),
          nextAction: z.string().trim().max(2000).default(""),
          status: z.enum(["draft", "issued"])
        })
        .parse(request.body);
      response.status(201).json({
        decision: await createDecision(database, {
          ...input,
          workspaceId: request.identity!.workspaceId,
          actorUserId: request.identity!.userId,
          requestId: request.requestId,
          subjectType: request.params.type,
          subjectId: uuidSchema.parse(request.params.id)
        })
      });
    })
  );

  app.get(
    "/api/tasks",
    authenticated,
    requireCapability(database, "operational:read"),
    asyncRoute(async (request, response) => {
      const status = typeof request.query.status === "string" ? request.query.status : null;
      const result = await database.query<Record<string, unknown>>(
        `SELECT id,subject_type AS "subjectType",subject_id AS "subjectId",title,status,
                priority,due_at AS "dueAt",blocker,mandatory_gate AS "mandatoryGate",
                completion_evidence AS "completionEvidence",version,created_at AS "createdAt"
           FROM tasks WHERE workspace_id=$1 AND owner_user_id=$2
             AND ($3::text IS NULL OR status=$3)
          ORDER BY completed_at NULLS FIRST,due_at NULLS LAST,created_at DESC LIMIT 250`,
        [request.identity!.workspaceId, request.identity!.userId, status]
      );
      response.json({ tasks: result.rows });
    })
  );
  app.patch(
    "/api/tasks/:taskId",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      const input = z
        .object({
          version: z.number().int().positive(),
          status: z.enum(["open", "in_progress", "blocked", "completed", "canceled"]),
          completionEvidence: z.string().trim().max(4000).nullable().optional(),
          blocker: z.string().trim().max(2000).nullable().optional()
        })
        .parse(request.body);
      response.json({
        task: await updateTaskStatus(database, {
          ...input,
          workspaceId: request.identity!.workspaceId,
          actorUserId: request.identity!.userId,
          requestId: request.requestId,
          taskId: uuidSchema.parse(request.params.taskId)
        })
      });
    })
  );

  app.get(
    "/api/search",
    authenticated,
    requireCapability(database, "operational:read"),
    asyncRoute(async (request, response) => {
      const query = z.string().trim().min(1).max(200).parse(request.query.q);
      const limit=z.coerce.number().int().min(1).max(100).default(30).parse(request.query.limit);
      const offset=z.coerce.number().int().min(0).max(100_000).default(0).parse(request.query.offset);
      const type=z.string().trim().min(1).max(100).optional().parse(request.query.type);
      const status=z.string().trim().min(1).max(100).optional().parse(request.query.status);
      const results=await searchWorkspace(database,request.identity!.workspaceId,query,limit+1,offset,type,status);
      response.json({
        query,
        results:results.slice(0,limit),
        page:{limit,offset,hasMore:results.length>limit,nextOffset:results.length>limit?offset+limit:null}
      });
    })
  );

  app.post(
    "/api/imports/preview",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      const input = z
        .object({
          recordType: z.enum([
            "brand", "product", "business", "contact",
            "representation_opportunity", "representation_agreement"
          ]),
          sourceName: z.string().trim().min(1).max(240),
          sourceId: uuidSchema.nullable().optional(),
          observedAt: z.string().datetime().nullable().optional(),
          csv: z.string().min(1).max(200_000),
          mapping: z.record(z.string(), z.string())
        })
        .parse(request.body);
      if (input.observedAt && new Date(input.observedAt).getTime() > Date.now() + 300_000) {
        throw new AppError(422, "import_observed_time_invalid", "Import observation time cannot be in the future.");
      }
      if (input.sourceId) {
        const source = await oneOrNone<{ id: string }>(
          database,
          `SELECT id FROM sources WHERE workspace_id=$1 AND id=$2 AND status='active'`,
          [request.identity!.workspaceId, input.sourceId]
        );
        if (!source) throw new AppError(422, "import_source_invalid", "The import Source is unavailable.");
      }
      const parsed = parseCsv<Record<string, string>>(input.csv, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
        relax_column_count: false,
        to: 1001
      });
      if (parsed.length > 1000) {
        throw new AppError(422, "import_preview_too_large", "Preview supports up to 1,000 rows.");
      }
      const required: Record<string, string[]> = {
        brand: ["name"],
        product: ["name", "category", "brandId"],
        business: ["name", "businessType", "category"],
        contact: ["name", "role", "parentType", "parentId"],
        representation_opportunity: ["brandId", "productIds", "proposedChannels"],
        representation_agreement: ["brandId", "effectiveAt", "productIds", "channels"]
      };
      const allowed: Record<string, Set<string>> = {
        brand: new Set([
          "name", "legalName", "website", "ownershipSummary", "wholesaleStatus",
          "distributionSummary", "operationsSummary", "inventoryCapability",
          "fulfillmentNotes", "communicationCondition", "communicationRationale"
        ]),
        product: new Set([
          "name", "category", "brandId", "summary", "consumerPrice", "currency",
          "reviewVolume", "reviewQualitySummary", "salesEvidenceSummary", "trendDirection",
          "repeatPurchaseHypothesis", "differentiation", "physicalRetailPresence",
          "packagingReadiness", "wholesaleReadiness", "inventoryNotes", "fulfillmentNotes",
          "returnsNotes"
        ]),
        business: new Set([
          "name", "legalName", "businessType", "category", "website", "geography",
          "locations", "assortmentSummary", "targetCustomerSummary", "pricePositioning",
          "currentVendorsSummary", "fitRationale"
        ]),
        contact: new Set([
          "name", "role", "parentType", "parentId", "email", "phone",
          "professionalHandle", "seniority"
        ]),
        representation_opportunity: new Set([
          "brandId", "productIds", "brandContactId", "proposedChannels",
          "proposedTerritory", "brandObjectives", "termsSummary", "missingTerms"
        ]),
        representation_agreement: new Set([
          "brandId", "sourceDocumentId", "effectiveAt", "expiresAt", "productIds",
          "channels", "territoryScope", "authoritySummary", "commissionBasis",
          "commissionRate", "commissionCurrency", "commissionTiming",
          "openingOrderRights", "reorderRights", "protectedAccountRules",
          "houseAccountRules", "terminationTerms", "terminationNoticeDays",
          "postTerminationCommissionRights", "renewalReviewAt"
        ])
      };
      const invalidMappings = Object.values(input.mapping).filter(
        (targetField) => !allowed[input.recordType]!.has(targetField)
      );
      if (invalidMappings.length > 0) {
        throw new AppError(
          422,
          "import_mapping_invalid",
          `Unsupported ${input.recordType} fields: ${[...new Set(invalidMappings)].join(", ")}.`
        );
      }
      const rows = [];
      let valid = 0;
      let duplicates = 0;
      for (const [index, raw] of parsed.entries()) {
        const normalized: Record<string, string> = {};
        for (const [sourceColumn, targetField] of Object.entries(input.mapping)) {
          normalized[targetField] = raw[sourceColumn] ?? "";
        }
        const errors = (required[input.recordType] ?? [])
          .filter((field) => !normalized[field])
          .map((field) => `${field} is required`);
        if (normalized.website && !z.string().url().safeParse(normalized.website).success) {
          errors.push("website must be a valid URL");
        }
        if (input.recordType === "contact" && !["brand", "business"].includes(normalized.parentType ?? "")) {
          errors.push("parentType must be brand or business");
        }
        if (input.recordType === "product" && normalized.consumerPrice && !Number.isFinite(Number(normalized.consumerPrice))) {
          errors.push("consumerPrice must be a number");
        }
        if (input.recordType === "product" && normalized.reviewVolume && !Number.isInteger(Number(normalized.reviewVolume))) {
          errors.push("reviewVolume must be a whole number");
        }
        if (input.recordType === "product" && normalized.currency && !/^[A-Z]{3}$/.test(normalized.currency)) {
          errors.push("currency must be a three-letter uppercase code");
        }
        const candidates =
          ["brand", "product", "business", "contact"].includes(input.recordType) &&
          normalized.name && index < 200
            ? await duplicateCandidates(
                database,
                request.identity!.workspaceId,
                input.recordType as "brand" | "product" | "business" | "contact",
                normalized.name
              )
            : [];
        if (candidates.length > 0) duplicates += 1;
        if (errors.length === 0) valid += 1;
        rows.push({
          rowNumber: index + 2,
          raw,
          normalized,
          errors,
          duplicateCandidates: candidates
        });
      }
      const sourceDigest = publicDigest(input.csv);
      const id = newId();
      const summary = {
        total: rows.length,
        valid,
        errors: rows.length - valid,
        duplicates,
        prospectiveCreates: valid - duplicates,
        prospectiveUpdates: 0,
        duplicateReviewRequired: duplicates,
        commitAvailable: false,
        guidance:
          "Resolve errors and duplicates. Committing imported records is introduced with the controlled import workflow.",
        provenance: {
          sourceId: input.sourceId ?? null,
          observedAt: input.observedAt ?? null,
          origin: "imported",
          verificationStatus: "unverified"
        },
        authorityImplications: [
          "Imported values are unverified research inputs.",
          "An import cannot qualify a Product or Business.",
          "An import cannot verify a Contact or Business Buyer.",
          "An import cannot move a Brand to Contact Ready, Authorized, or Active.",
          "Imported Agreement terms remain unverified candidates and cannot activate authority.",
          "Imported protected-account or house-account text cannot create rights without a written original and human approval.",
          "Duplicate candidates require human review and are never auto-merged."
        ]
      };
      const stored = await database.query<{ id: string }>(
        `INSERT INTO import_previews
          (id,workspace_id,user_id,record_type,source_name,source_digest,mapping,rows,summary,
           status,expires_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'validated',now()+interval '24 hours')
         ON CONFLICT(workspace_id,source_digest,record_type) DO UPDATE SET
           user_id=excluded.user_id,source_name=excluded.source_name,mapping=excluded.mapping,
           rows=excluded.rows,summary=excluded.summary,status='validated',
           expires_at=now()+interval '24 hours'
         RETURNING id`,
        [
          id,
          request.identity!.workspaceId,
          request.identity!.userId,
          input.recordType,
          input.sourceName,
          sourceDigest,
          input.mapping,
          JSON.stringify(rows),
          summary
        ]
      );
      await recordAudit(database, {
        workspaceId: request.identity!.workspaceId,
        actorUserId: request.identity!.userId,
        actorType: "user",
        action: "import.preview_validated",
        targetType: "import_preview",
        targetId: stored.rows[0]!.id,
        origin: "api",
        requestId: request.requestId,
        outcome: "succeeded",
        metadata: summary
      });
      response.status(201).json({ id: stored.rows[0]!.id, summary, rows });
    })
  );

  app.get(
    "/api/notifications",
    authenticated,
    requireCapability(database, "operational:read"),
    asyncRoute(async (request, response) => {
      const result = await database.query(
        `SELECT id,notification_type AS "notificationType",severity,title,reason,
                subject_type AS "subjectType",subject_id AS "subjectId",status,blocking,
                occurrence_count AS "occurrenceCount",first_occurred_at AS "firstOccurredAt",
                last_occurred_at AS "lastOccurredAt",expires_at AS "expiresAt",
                due_at AS "dueAt",created_at AS "createdAt"
           FROM notifications WHERE workspace_id=$1 AND user_id=$2
            AND (expires_at IS NULL OR expires_at>now() OR status NOT IN ('read','dismissed','archived'))
          ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'action_required' THEN 2
                   WHEN 'time_sensitive' THEN 3 ELSE 4 END,created_at DESC LIMIT 200`,
        [request.identity!.workspaceId, request.identity!.userId]
      );
      response.json({ notifications: result.rows });
    })
  );
  app.patch(
    "/api/notifications/:notificationId",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      const input = z.object({
        status: z.enum(["unread", "read", "dismissed", "resolved", "archived"])
      }).parse(request.body);
      const notificationId = uuidSchema.parse(request.params.notificationId);
      const result = await database.query<{ id: string; status: string }>(
        `UPDATE notifications SET status=$4,updated_at=now()
          WHERE id=$1 AND workspace_id=$2 AND user_id=$3
            AND NOT (blocking AND $4='archived' AND status<>'resolved')
          RETURNING id,status`,
        [notificationId, request.identity!.workspaceId, request.identity!.userId, input.status]
      );
      if (!result.rows[0]) {
        throw new AppError(
          409,
          "blocking_notification_unresolved",
          "Blocking notifications must be resolved before they can be archived."
        );
      }
      await recordAudit(database, {
        workspaceId: request.identity!.workspaceId,
        actorUserId: request.identity!.userId,
        actorType: "user",
        action: `notification.${input.status}`,
        targetType: "notification",
        targetId: notificationId,
        origin: "api",
        requestId: request.requestId,
        outcome: "succeeded"
      });
      response.json({ notification: result.rows[0] });
    })
  );

  app.get(
    "/api/saved-views",
    authenticated,
    requireCapability(database, "operational:read"),
    asyncRoute(async (request, response) => {
      const result = await database.query(
        `SELECT id,record_type AS "recordType",name,definition,scope,status,version
           FROM saved_views
          WHERE workspace_id=$1 AND status='active'
            AND (owner_user_id=$2 OR scope='workspace')
          ORDER BY name`,
        [request.identity!.workspaceId, request.identity!.userId]
      );
      response.json({ views: result.rows });
    })
  );
  app.post(
    "/api/saved-views",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      const input = z.object({
        recordType: z.string().trim().min(1).max(120),
        name: z.string().trim().min(1).max(160),
        definition: z.object({
          filters: z.array(z.object({
            field: z.string().trim().min(1).max(120),
            operator: z.enum(["equals", "contains", "in", "before", "after"]),
            value: z.unknown()
          })).max(25),
          sort: z.array(z.object({
            field: z.string().trim().min(1).max(120),
            direction: z.enum(["asc", "desc"])
          })).max(5),
          layout: z.enum(["table", "card", "list"])
        }),
        scope: z.enum(["private", "workspace"])
      }).parse(request.body);
      const id = newId();
      const result = await database.query<Record<string, unknown>>(
        `INSERT INTO saved_views
          (id,workspace_id,owner_user_id,record_type,name,definition,scope,status)
         VALUES($1,$2,$3,$4,$5,$6,$7,'active')
         RETURNING id,record_type AS "recordType",name,definition,scope,status,version`,
        [id, request.identity!.workspaceId, request.identity!.userId, input.recordType, input.name, input.definition, input.scope]
      );
      await recordAudit(database, {
        workspaceId: request.identity!.workspaceId,
        actorUserId: request.identity!.userId,
        actorType: "user",
        action: "saved_view.created",
        targetType: "saved_view",
        targetId: id,
        origin: "api",
        requestId: request.requestId,
        outcome: "succeeded",
        after: result.rows[0]
      });
      response.status(201).json({ view: result.rows[0] });
    })
  );

  app.post(
    "/api/records/:type/:id/approvals",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      if (!isCoreRecordType(request.params.type)) throw new AppError(404, "record_type_unknown", "Record type not found.");
      const input = z.object({
        actionType: z.string().trim().min(1).max(160),
        artifact: z.string().min(1).max(100_000),
        scope: z.string().trim().min(1).max(2000),
        expiresAt: z.string().datetime().nullable().optional()
      }).parse(request.body);
      await getRecordContext(database, request.identity!.workspaceId, request.params.type, uuidSchema.parse(request.params.id));
      const id = newId();
      const artifactDigest = publicDigest(input.artifact);
      const result = await database.query<Record<string, unknown>>(
        `INSERT INTO human_approvals
          (id,workspace_id,subject_type,subject_id,action_type,artifact_digest,
           approver_user_id,status,scope,expires_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,'requested',$8,$9)
         RETURNING id,action_type AS "actionType",artifact_digest AS "artifactDigest",
                   status,scope,expires_at AS "expiresAt",requested_at AS "requestedAt"`,
        [id, request.identity!.workspaceId, request.params.type, request.params.id, input.actionType, artifactDigest, request.identity!.userId, input.scope, input.expiresAt ?? null]
      );
      await recordAudit(database, {
        workspaceId: request.identity!.workspaceId,
        actorUserId: request.identity!.userId,
        actorType: "user",
        action: "human_approval.requested",
        targetType: "human_approval",
        targetId: id,
        origin: "api",
        requestId: request.requestId,
        outcome: "succeeded",
        metadata: { artifactDigest, actionType: input.actionType }
      });
      response.status(201).json({ approval: result.rows[0] });
    })
  );
  app.patch(
    "/api/approvals/:approvalId",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      const input = z.object({
        status: z.enum(["approved", "rejected", "changes_required"]),
        artifact: z.string().min(1).max(100_000),
        conditions: z.string().trim().max(4000).default("")
      }).parse(request.body);
      const approvalId = uuidSchema.parse(request.params.approvalId);
      const artifactDigest = publicDigest(input.artifact);
      const result = await database.query<{ id: string; status: string }>(
        `UPDATE human_approvals
            SET status=$5,conditions=$6,decided_at=now()
          WHERE id=$1 AND workspace_id=$2 AND approver_user_id=$3
            AND status='requested' AND artifact_digest=$4
            AND (expires_at IS NULL OR expires_at>now())
          RETURNING id,status`,
        [approvalId, request.identity!.workspaceId, request.identity!.userId, artifactDigest, input.status, input.conditions]
      );
      if (!result.rows[0]) {
        throw new AppError(409, "approval_artifact_changed", "Approval is unavailable, expired, or does not match the exact artifact.");
      }
      await recordAudit(database, {
        workspaceId: request.identity!.workspaceId,
        actorUserId: request.identity!.userId,
        actorType: "user",
        action: `human_approval.${input.status}`,
        targetType: "human_approval",
        targetId: approvalId,
        origin: "api",
        requestId: request.requestId,
        outcome: "succeeded",
        metadata: { artifactDigest }
      });
      response.json({ approval: result.rows[0] });
    })
  );

  app.get(
    "/api/businesses/:businessId/buyers",
    authenticated,
    requireCapability(database, "operational:read"),
    asyncRoute(async (request, response) => {
      const businessId = uuidSchema.parse(request.params.businessId);
      await getRecordContext(database, request.identity!.workspaceId, "business", businessId);
      const result = await database.query(
        `SELECT bb.id,bb.contact_id AS "contactId",c.name,bb.buyer_role AS "buyerRole",
                bb.decision_context AS "decisionContext",bb.authority_evidence AS "authorityEvidence",
                bb.authority_evidence_id AS "authorityEvidenceId",
                bb.stated_needs AS "statedNeeds",bb.buying_window AS "buyingWindow",
                bb.decision_process AS "decisionProcess",
                bb.verification_status AS "verificationStatus",bb.verified_at AS "verifiedAt",bb.version
           FROM business_buyers bb
           JOIN contacts c ON c.workspace_id=bb.workspace_id AND c.id=bb.contact_id
          WHERE bb.workspace_id=$1 AND bb.business_id=$2 ORDER BY c.name`,
        [request.identity!.workspaceId, businessId]
      );
      response.json({ buyers: result.rows });
    })
  );
  app.post(
    "/api/businesses/:businessId/buyers",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      const businessId = uuidSchema.parse(request.params.businessId);
      const input = z.object({
        contactId: uuidSchema,
        buyerRole: z.enum(["unknown", "influencer", "evaluator", "decision_maker", "authorized_purchaser"]),
        decisionContext: z.string().trim().min(1).max(3000),
        authorityEvidence: z.string().trim().max(3000).nullable().optional(),
        authorityEvidenceId: uuidSchema.nullable().optional()
      }).superRefine((value, context) => {
        if (
          ["decision_maker", "authorized_purchaser"].includes(value.buyerRole) &&
          (!value.authorityEvidence || !value.authorityEvidenceId)
        ) {
          context.addIssue({ code: "custom", path: ["authorityEvidenceId"], message: "Claimed decision or purchasing authority requires a linked Evidence Record." });
        }
      }).parse(request.body);
      const contact = await database.query(
        `SELECT id FROM contacts WHERE id=$1 AND workspace_id=$2 AND business_id=$3
          AND archived_at IS NULL`,
        [input.contactId, request.identity!.workspaceId, businessId]
      );
      if (!contact.rows[0]) {
        throw new AppError(422, "buyer_contact_invalid", "Buyer contact must belong to this business.");
      }
      if (input.authorityEvidenceId) {
        const evidence = await database.query(
          `SELECT id FROM evidence_records WHERE workspace_id=$1 AND id=$2
            AND status='current'
            AND ((subject_type='business' AND subject_id=$3)
              OR (subject_type='contact' AND subject_id=$4))`,
          [request.identity!.workspaceId, input.authorityEvidenceId, businessId, input.contactId]
        );
        if (!evidence.rows[0]) {
          throw new AppError(422, "buyer_authority_evidence_invalid", "Authority evidence must belong to this Business or Contact.");
        }
      }
      const id = newId();
      const result = await database.query<Record<string, unknown>>(
        `INSERT INTO business_buyers
          (id,workspace_id,contact_id,business_id,buyer_role,decision_context,authority_evidence,authority_evidence_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id,contact_id AS "contactId",business_id AS "businessId",
                   buyer_role AS "buyerRole",decision_context AS "decisionContext",
                   authority_evidence AS "authorityEvidence",authority_evidence_id AS "authorityEvidenceId",
                   verification_status AS "verificationStatus",version`,
        [id, request.identity!.workspaceId, input.contactId, businessId, input.buyerRole, input.decisionContext, input.authorityEvidence ?? null, input.authorityEvidenceId ?? null]
      );
      await recordAudit(database, {
        workspaceId: request.identity!.workspaceId,
        actorUserId: request.identity!.userId,
        actorType: "user",
        action: "business_buyer.created",
        targetType: "business_buyer",
        targetId: id,
        origin: "api",
        requestId: request.requestId,
        outcome: "succeeded",
        after: result.rows[0]
      });
      response.status(201).json({ buyer: result.rows[0] });
    })
  );
  app.patch(
    "/api/contacts/:contactId/verification",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      const contactId = uuidSchema.parse(request.params.contactId);
      const input = z.object({
        version: z.number().int().positive(),
        status: z.enum(["verified", "stale", "disputed"]),
        sourceId: uuidSchema,
        observedAt: z.string().datetime(),
        notes: z.string().trim().min(1).max(4000)
      }).parse(request.body);
      if (new Date(input.observedAt).getTime() > Date.now() + 300_000) {
        throw new AppError(422, "verification_time_invalid", "Verification observation time cannot be in the future.");
      }
      const contact = await withTransaction(database, async (transaction) => {
        const before = await oneOrNone<Record<string, unknown>>(
          transaction,
          `SELECT * FROM contacts WHERE workspace_id=$1 AND id=$2 AND archived_at IS NULL FOR UPDATE`,
          [request.identity!.workspaceId, contactId]
        );
        if (!before) throw new AppError(404, "contact_not_found", "Contact not found.");
        if (Number(before.version) !== input.version) {
          throw new AppError(409, "version_conflict", "The contact changed. Reload and reconcile before saving.");
        }
        if (input.status === "verified" && !before.email && !before.phone && !before.professional_handle) {
          throw new AppError(422, "professional_channel_required", "Verification requires a professional email, phone number, or professional handle.");
        }
        const source = await oneOrNone<{ id: string }>(
          transaction,
          `SELECT id FROM sources WHERE workspace_id=$1 AND id=$2 AND status='active'`,
          [request.identity!.workspaceId, input.sourceId]
        );
        if (!source) throw new AppError(422, "verification_source_invalid", "An active workspace Source is required.");
        const updated = await oneOrNone<Record<string, unknown>>(
          transaction,
          `UPDATE contacts SET verification_status=$3,source_id=$4,source_observed_at=$5,
                  last_verified_at=CASE WHEN $3='verified' THEN now() ELSE last_verified_at END,
                  verification_notes=$6,version=version+1,updated_at=now()
            WHERE workspace_id=$1 AND id=$2 AND version=$7
            RETURNING id,name,verification_status AS "verificationStatus",
                      source_id AS "sourceId",source_observed_at AS "sourceObservedAt",
                      last_verified_at AS "lastVerifiedAt",verification_notes AS "verificationNotes",version`,
          [request.identity!.workspaceId, contactId, input.status, input.sourceId, input.observedAt, input.notes, input.version]
        );
        if (!updated) throw new AppError(409, "version_conflict", "The contact changed. Reload and reconcile before saving.");
        await recordAudit(transaction, {
          workspaceId: request.identity!.workspaceId,
          actorUserId: request.identity!.userId,
          actorType: "user",
          action: `contact.verification_${input.status}`,
          targetType: "contact",
          targetId: contactId,
          origin: "api",
          requestId: request.requestId,
          outcome: "succeeded",
          before,
          after: updated,
          metadata: { humanOwned: true, sourceId: input.sourceId, observedAt: input.observedAt }
        });
        return updated;
      });
      response.json({ contact });
    })
  );
  app.patch(
    "/api/businesses/:businessId/buyers/:buyerId",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      const businessId = uuidSchema.parse(request.params.businessId);
      const buyerId = uuidSchema.parse(request.params.buyerId);
      const input = z.object({
        version: z.number().int().positive(),
        buyerRole: z.enum(["unknown", "influencer", "evaluator", "decision_maker", "authorized_purchaser"]),
        decisionContext: z.string().trim().min(1).max(3000),
        authorityEvidence: z.string().trim().max(3000).nullable().optional(),
        authorityEvidenceId: uuidSchema.nullable().optional(),
        statedNeeds: z.string().trim().max(4000).default(""),
        buyingWindow: z.string().trim().max(1000).default(""),
        decisionProcess: z.string().trim().max(4000).default(""),
        verificationStatus: z.enum(["unverified", "reviewing", "verified", "stale", "disputed"])
      }).superRefine((value, context) => {
        if (
          ["decision_maker", "authorized_purchaser"].includes(value.buyerRole) &&
          (!value.authorityEvidence || !value.authorityEvidenceId)
        ) {
          context.addIssue({
            code: "custom",
            path: ["authorityEvidenceId"],
            message: "Decision or purchasing authority requires a linked Evidence Record and a human-readable explanation."
          });
        }
        if (value.verificationStatus === "verified" && !value.authorityEvidenceId) {
          context.addIssue({
            code: "custom",
            path: ["verificationStatus"],
            message: "Verified Buyer context requires linked evidence."
          });
        }
      }).parse(request.body);
      const buyer = await withTransaction(database, async (transaction) => {
        const before = await oneOrNone<Record<string, unknown>>(
          transaction,
          `SELECT * FROM business_buyers WHERE workspace_id=$1 AND business_id=$2 AND id=$3 FOR UPDATE`,
          [request.identity!.workspaceId, businessId, buyerId]
        );
        if (!before) throw new AppError(404, "buyer_not_found", "Business Buyer not found.");
        if (Number(before.version) !== input.version) {
          throw new AppError(409, "version_conflict", "The Buyer record changed. Reload and reconcile before saving.");
        }
        if (input.authorityEvidenceId) {
          const evidence = await oneOrNone<{ id: string }>(
            transaction,
            `SELECT id FROM evidence_records
              WHERE workspace_id=$1 AND id=$2 AND status='current'
                AND ((subject_type='business' AND subject_id=$3)
                  OR (subject_type='contact' AND subject_id=$4))`,
            [request.identity!.workspaceId, input.authorityEvidenceId, businessId, before.contact_id]
          );
          if (!evidence) {
            throw new AppError(422, "buyer_authority_evidence_invalid", "Authority evidence must be current and belong to this Business or Contact.");
          }
        }
        const updated = await oneOrNone<Record<string, unknown>>(
          transaction,
          `UPDATE business_buyers SET buyer_role=$4,decision_context=$5,authority_evidence=$6,
                  authority_evidence_id=$7,stated_needs=$8,buying_window=$9,decision_process=$10,
                  verification_status=$11,verified_at=CASE WHEN $11='verified' THEN now() ELSE verified_at END,
                  version=version+1,updated_at=now()
            WHERE workspace_id=$1 AND business_id=$2 AND id=$3 AND version=$12
            RETURNING id,contact_id AS "contactId",business_id AS "businessId",
                      buyer_role AS "buyerRole",decision_context AS "decisionContext",
                      authority_evidence AS "authorityEvidence",authority_evidence_id AS "authorityEvidenceId",
                      stated_needs AS "statedNeeds",buying_window AS "buyingWindow",
                      decision_process AS "decisionProcess",verification_status AS "verificationStatus",
                      verified_at AS "verifiedAt",version`,
          [
            request.identity!.workspaceId, businessId, buyerId, input.buyerRole,
            input.decisionContext, input.authorityEvidence ?? null, input.authorityEvidenceId ?? null,
            input.statedNeeds, input.buyingWindow, input.decisionProcess, input.verificationStatus,
            input.version
          ]
        );
        if (!updated) throw new AppError(409, "version_conflict", "The Buyer record changed. Reload and reconcile before saving.");
        await recordAudit(transaction, {
          workspaceId: request.identity!.workspaceId,
          actorUserId: request.identity!.userId,
          actorType: "user",
          action: "business_buyer.reviewed",
          targetType: "business_buyer",
          targetId: buyerId,
          origin: "api",
          requestId: request.requestId,
          outcome: "succeeded",
          before,
          after: updated,
          metadata: { humanOwned: true }
        });
        return updated;
      });
      response.json({ buyer });
    })
  );

  registerPhase4Routes({
    app,
    database,
    authenticated,
    csrf,
    read: requireCapability(database, "operational:read"),
    write: requireCapability(database, "operational:write")
  });

  registerPhase5Routes({
    app,
    database,
    configuration,
    authenticated,
    csrf,
    read: requireCapability(database, "operational:read"),
    write: requireCapability(database, "operational:write")
  });

  registerPhase6Routes({
    app,
    database,
    authenticated,
    csrf,
    read: requireCapability(database, "operational:read"),
    write: requireCapability(database, "operational:write")
  });

  registerPhase7Routes({
    app,
    database,
    configuration,
    aiProvider,
    objectStorage,
    authenticated,
    csrf,
    read: requireCapability(database, "operational:read"),
    write: requireCapability(database, "operational:write"),
    mfa: requireMfa(),
    adminManage: requireCapability(database, "jobs:manage")
  });

  registerPhase8Routes({
    app,
    database,
    authenticated,
    csrf,
    read: requireCapability(database, "operational:read"),
    write: requireCapability(database, "operational:write"),
    exportRequest: requireCapability(database, "export:request")
  });

  registerPhase9Routes({
    app,
    database,
    configuration,
    authenticated,
    csrf,
    read: requireCapability(database, "operational:read"),
    write: requireCapability(database, "operational:write"),
    exportRequest: requireCapability(database, "export:request"),
    mfa: requireMfa(),
    admin: requireCapability(database, "admin:access")
  });

  app.get(
    "/api/territories",
    authenticated,
    requireCapability(database, "operational:read"),
    asyncRoute(async (request, response) => {
      const result = await database.query(
        `SELECT id,name,territory_type AS "territoryType",scope,status,
                effective_at AS "effectiveAt",expires_at AS "expiresAt",version
           FROM territories WHERE workspace_id=$1 ORDER BY name`,
        [request.identity!.workspaceId]
      );
      response.json({ territories: result.rows });
    })
  );
  app.post(
    "/api/territories",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      const input = z.object({
        name: z.string().trim().min(1).max(200),
        territoryType: z.enum(["geography", "channel", "account_list", "hybrid"]),
        scope: z.record(z.string(), z.unknown()),
        status: z.enum(["proposed", "active", "expired", "ended"]),
        effectiveAt: z.string().datetime().nullable().optional(),
        expiresAt: z.string().datetime().nullable().optional()
      }).parse(request.body);
      const id = newId();
      const result = await database.query<Record<string, unknown>>(
        `INSERT INTO territories
          (id,workspace_id,name,territory_type,scope,status,effective_at,expires_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id,name,territory_type AS "territoryType",scope,status,
                   effective_at AS "effectiveAt",expires_at AS "expiresAt",version`,
        [id, request.identity!.workspaceId, input.name, input.territoryType, input.scope, input.status, input.effectiveAt ?? null, input.expiresAt ?? null]
      );
      await recordAudit(database, {
        workspaceId: request.identity!.workspaceId,
        actorUserId: request.identity!.userId,
        actorType: "user",
        action: "territory.created",
        targetType: "territory",
        targetId: id,
        origin: "api",
        requestId: request.requestId,
        outcome: "succeeded",
        after: result.rows[0]
      });
      response.status(201).json({ territory: result.rows[0] });
    })
  );

  app.get(
    "/api/documents",
    authenticated,
    requireCapability(database, "operational:read"),
    asyncRoute(async (request, response) => {
      const result = await database.query(
        `SELECT id,subject_type AS "subjectType",subject_id AS "subjectId",name,
                document_type AS "documentType",media_type AS "mediaType",
                byte_size::text AS "byteSize",sha256,scan_status AS "scanStatus",
                confidentiality,status,version,created_at AS "createdAt"
           FROM documents WHERE workspace_id=$1 AND status<>'deleted'
          ORDER BY created_at DESC LIMIT 250`,
        [request.identity!.workspaceId]
      );
      response.json({ documents: result.rows });
    })
  );
  app.post(
    "/api/documents",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    asyncRoute(async (request, response) => {
      const input = z
        .object({
          subjectType: z.enum(["brand", "product", "business", "contact", "representation_opportunity"]),
          subjectId: uuidSchema,
          name: z.string().trim().min(1).max(240),
          documentType: z.string().trim().min(1).max(120),
          mediaType: z.enum([
            "application/pdf",
            "image/jpeg",
            "image/png",
            "text/csv",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          ]),
          byteSize: z.number().int().positive().max(20 * 1024 * 1024),
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
          confidentiality: z.enum(["normal", "confidential", "restricted"])
        })
        .parse(request.body);
      if (input.subjectType === "representation_opportunity") {
        const opportunity = await database.query(
          `SELECT id FROM representation_opportunities
            WHERE workspace_id=$1 AND id=$2 AND archived_at IS NULL`,
          [request.identity!.workspaceId, input.subjectId]
        );
        if (!opportunity.rows[0]) throw new AppError(404, "representation_opportunity_not_found", "Representation Opportunity not found.");
      } else {
        await getRecordContext(
          database,
          request.identity!.workspaceId,
          input.subjectType,
          input.subjectId
        );
      }
      const id = newId();
      const storageKey = `${request.identity!.workspaceId}/${id}/original`;
      const inserted = await database.query<{
        id: string;
        name: string;
        status: string;
        scanStatus: string;
        version: number;
      }>(
        `INSERT INTO documents
          (id,workspace_id,subject_type,subject_id,owner_user_id,name,document_type,
           media_type,byte_size,storage_key,sha256,scan_status,confidentiality,status)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',$12,'uploading')
         RETURNING id,name,status,scan_status AS "scanStatus",version`,
        [
          id,
          request.identity!.workspaceId,
          input.subjectType,
          input.subjectId,
          request.identity!.userId,
          input.name,
          input.documentType,
          input.mediaType,
          input.byteSize,
          storageKey,
          input.sha256,
          input.confidentiality
        ]
      );
      const upload = await objectStorage.createUploadTarget({
        documentId: id,
        storageKey,
        mediaType: input.mediaType,
        byteSize: input.byteSize,
        sha256: input.sha256
      });
      await recordAudit(database, {
        workspaceId: request.identity!.workspaceId,
        actorUserId: request.identity!.userId,
        actorType: "user",
        action: "document.upload_requested",
        targetType: "document",
        targetId: id,
        origin: "api",
        requestId: request.requestId,
        outcome: "succeeded",
        metadata: { mediaType: input.mediaType, byteSize: input.byteSize }
      });
      response.status(201).json({ document: inserted.rows[0], upload });
    })
  );
  app.put(
    "/api/documents/:documentId/content",
    authenticated,
    csrf,
    requireCapability(database, "operational:write"),
    express.raw({ type: "*/*", limit: "20mb" }),
    asyncRoute(async (request, response) => {
      const documentId = uuidSchema.parse(request.params.documentId);
      const document = await oneOrNone<{
        storage_key: string;
        byte_size: string;
        sha256: string;
        status: string;
      }>(
        database,
        `SELECT storage_key,byte_size::text,sha256,status FROM documents
          WHERE id=$1 AND workspace_id=$2 AND owner_user_id=$3`,
        [documentId, request.identity!.workspaceId, request.identity!.userId]
      );
      if (!document) throw new AppError(404, "document_not_found", "Document was not found.");
      if (document.status !== "uploading") {
        throw new AppError(409, "document_upload_finalized", "Document upload is already finalized.");
      }
      if (!Buffer.isBuffer(request.body)) {
        throw new AppError(422, "document_content_invalid", "Document content is required.");
      }
      const content = request.body;
      if (content.byteLength !== Number(document.byte_size)) {
        throw new AppError(422, "document_size_mismatch", "Uploaded size does not match the declared size.");
      }
      if (createHash("sha256").update(content).digest("hex") !== document.sha256) {
        throw new AppError(422, "document_hash_mismatch", "Uploaded content does not match the declared hash.");
      }
      if (!objectStorage.writeLocal) {
        throw new AppError(405, "direct_upload_required", "Use the signed object-storage upload.");
      }
      await objectStorage.writeLocal(document.storage_key, content);
      await database.query(
        `UPDATE documents SET status='scanning',updated_at=now(),version=version+1
          WHERE id=$1 AND workspace_id=$2`,
        [documentId, request.identity!.workspaceId]
      );
      await recordAudit(database, {
        workspaceId: request.identity!.workspaceId,
        actorUserId: request.identity!.userId,
        actorType: "user",
        action: "document.upload_completed",
        targetType: "document",
        targetId: documentId,
        origin: "api",
        requestId: request.requestId,
        outcome: "succeeded",
        metadata: { sha256: document.sha256, byteSize: content.byteLength }
      });
      response.status(202).json({ status: "scanning", access: "quarantined_until_clean" });
    })
  );
  app.get(
    "/api/documents/:documentId/content",
    authenticated,
    requireCapability(database, "operational:read"),
    asyncRoute(async (request, response) => {
      const documentId = uuidSchema.parse(request.params.documentId);
      const document = await oneOrNone<{
        storage_key: string;
        media_type: string;
        name: string;
      }>(
        database,
        `SELECT storage_key,media_type,name FROM documents
          WHERE id=$1 AND workspace_id=$2 AND status='active' AND scan_status='clean'`,
        [documentId, request.identity!.workspaceId]
      );
      if (!document) {
        throw new AppError(404, "document_unavailable", "Document is unavailable or has not passed scanning.");
      }
      const target = await objectStorage.createReadTarget(document.storage_key);
      await recordAudit(database, {
        workspaceId: request.identity!.workspaceId,
        actorUserId: request.identity!.userId,
        actorType: "user",
        action: "document.downloaded",
        targetType: "document",
        targetId: documentId,
        origin: "api",
        requestId: request.requestId,
        outcome: "succeeded"
      });
      if (target.url) return response.redirect(302, target.url);
      response.type(document.media_type);
      response.setHeader("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(document.name)}`);
      return response.send(target.content);
    })
  );

  app.get(
    "/api/sessions",
    authenticated,
    requireCapability(database, "profile:read"),
    asyncRoute(async (request, response) => {
      const result = await database.query(
        `SELECT id, created_at AS "createdAt", last_seen_at AS "lastSeenAt",
                expires_at AS "expiresAt", user_agent AS "userAgent",
                id=$2 AS "current"
           FROM sessions WHERE user_id=$1 AND revoked_at IS NULL AND expires_at>now()
          ORDER BY created_at DESC`,
        [request.identity!.userId, request.identity!.sessionId]
      );
      response.json({ sessions: result.rows });
    })
  );
  app.delete(
    "/api/sessions/:sessionId",
    authenticated,
    csrf,
    requireCapability(database, "profile:write"),
    asyncRoute(async (request, response) => {
      const sessionId = uuidSchema.parse(request.params.sessionId);
      const result = await database.query(
        `UPDATE sessions SET revoked_at=now(), revoked_reason='user_revoked'
          WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL`,
        [sessionId, request.identity!.userId]
      );
      if (result.rowCount !== 1) throw new AppError(404, "session_not_found", "Session not found.");
      await recordAudit(database, {
        workspaceId: request.identity!.workspaceId,
        actorUserId: request.identity!.userId,
        actorType: "user",
        action: "session.revoked",
        targetType: "session",
        targetId: sessionId,
        origin: "api",
        requestId: request.requestId,
        outcome: "succeeded",
        metadata: { reason: "user_revoked" }
      });
      response.status(204).end();
    })
  );

  app.get(
    "/api/support/grants/:grantId/profile",
    authenticated,
    requireMfa(),
    requireCapability(database, "support:access"),
    asyncRoute(async (request, response) => {
      const grantId = uuidSchema.parse(request.params.grantId);
      const grant = await oneOrNone<{
        workspace_id: string;
        ticket_reference: string;
        allowed_record_ids: string[];
        allowed_fields: string[];
      }>(
        database,
        `SELECT workspace_id, ticket_reference, allowed_record_ids, allowed_fields
           FROM support_grants
          WHERE id=$1 AND support_user_id=$2 AND revoked_at IS NULL
            AND starts_at<=now() AND expires_at>now()
            AND 'profile'=ANY(allowed_record_types)`,
        [grantId, request.identity!.userId]
      );
      if (!grant || grant.allowed_record_ids.length !== 1) {
        throw new AppError(404, "support_grant_not_found", "Support grant not found.");
      }
      const targetUserId = grant.allowed_record_ids[0]!;
      const profile = await getProfile(database, targetUserId, grant.workspace_id);
      if (!profile) throw new AppError(404, "record_not_found", "Record not found.");
      const permitted = new Set(grant.allowed_fields);
      const safeFields: Record<string, unknown> = {};
      const available: Record<string, unknown> = {
        name: profile.name,
        email: profile.email,
        timeZone: profile.timeZone,
        professionalTitle: profile.professionalTitle,
        outreachName: profile.outreachName,
        version: profile.version
      };
      for (const [key, value] of Object.entries(available)) {
        if (permitted.has(key)) safeFields[key] = value;
      }
      await recordAudit(database, {
        workspaceId: grant.workspace_id,
        actorUserId: request.identity!.userId,
        actorType: "user",
        action: "support_grant.content_viewed",
        targetType: "profile",
        targetId: targetUserId,
        origin: "support_api",
        requestId: request.requestId,
        outcome: "succeeded",
        metadata: { grantId, ticketReference: grant.ticket_reference, fields: [...permitted] }
      });
      response.json({ profile: safeFields, grantId, ticketReference: grant.ticket_reference });
    })
  );

  app.get(
    "/api/admin/jobs",
    authenticated,
    requireMfa(),
    requireCapability(database, "jobs:read"),
    asyncRoute(async (request, response) => {
      const status = z
        .enum(["queued", "running", "completed", "dead", "canceled"])
        .optional()
        .parse(request.query.status);
      const result = await database.query(
        `SELECT id, workspace_id AS "workspaceId", kind, status, attempts,
                max_attempts AS "maxAttempts", available_at AS "availableAt",
                lease_owner AS "leaseOwner", lease_expires_at AS "leaseExpiresAt",
                last_error_code AS "lastErrorCode", last_error_safe AS "lastErrorSafe",
                created_at AS "createdAt", updated_at AS "updatedAt"
           FROM durable_jobs WHERE ($1::text IS NULL OR status=$1)
          ORDER BY updated_at DESC LIMIT 100`,
        [status ?? null]
      );
      response.json({ jobs: result.rows });
    })
  );
  app.post(
    "/api/admin/jobs/:jobId/retry",
    authenticated,
    requireMfa(),
    csrf,
    requireCapability(database, "jobs:manage"),
    asyncRoute(async (request, response) => {
      const jobId = uuidSchema.parse(request.params.jobId);
      if (!(await retryDeadJob(database, jobId))) {
        throw new AppError(409, "job_not_retryable", "Only a dead job can be retried.");
      }
      await recordAudit(database, {
        workspaceId: request.identity!.workspaceId,
        actorUserId: request.identity!.userId,
        actorType: "user",
        action: "job.retry_requested",
        targetType: "durable_job",
        targetId: jobId,
        origin: "admin_api",
        requestId: request.requestId,
        outcome: "succeeded"
      });
      response.status(202).json({ retried: true });
    })
  );
  app.get(
    "/api/admin/audit",
    authenticated,
    requireMfa(),
    requireCapability(database, "audit:read"),
    asyncRoute(async (request, response) => {
      const result = await database.query(
        `SELECT id, workspace_id AS "workspaceId", actor_user_id AS "actorUserId",
                actor_type AS "actorType", action, target_type AS "targetType",
                target_id AS "targetId", occurred_at AS "occurredAt", origin,
                request_id AS "requestId", outcome, metadata
           FROM audit_events ORDER BY occurred_at DESC LIMIT 100`
      );
      response.json({ events: result.rows });
    })
  );
  app.post(
    "/api/admin/support-grants",
    authenticated,
    requireMfa(),
    csrf,
    requireCapability(database, "support_grants:manage"),
    asyncRoute(async (request, response) => {
      const input = supportGrantSchema.parse(request.body);
      if (new Date(input.expiresAt) <= new Date()) {
        throw new AppError(422, "grant_expiry_invalid", "Support grant expiry must be in the future.");
      }
      const id = newId();
      await withTransaction(database, async (transaction) => {
        await transaction.query(
          `INSERT INTO support_grants
            (id, support_user_id, workspace_id, ticket_reference, reason,
             allowed_record_types, allowed_record_ids, allowed_fields,
             approved_by, starts_at, expires_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),$10)`,
          [
            id,
            input.supportUserId,
            input.workspaceId,
            input.ticketReference,
            input.reason,
            input.allowedRecordTypes,
            input.allowedRecordIds,
            input.allowedFields,
            request.identity!.userId,
            input.expiresAt
          ]
        );
        await recordAudit(transaction, {
          workspaceId: input.workspaceId,
          actorUserId: request.identity!.userId,
          actorType: "user",
          action: "support_grant.created",
          targetType: "support_grant",
          targetId: id,
          origin: "admin_api",
          requestId: request.requestId,
          outcome: "succeeded",
          after: input,
          metadata: { ticketReference: input.ticketReference }
        });
      });
      response.status(201).json({ id });
    })
  );

  app.use("/api", (_request, _response, next) => {
    next(new AppError(404, "not_found", "The requested API resource was not found."));
  });

  if (configuration.NODE_ENV === "production") {
    const webRoot = path.resolve(process.cwd(), "dist/web");
    app.use(express.static(webRoot, { index: false, maxAge: "1h" }));
    app.get("*splat", (_request, response) => response.sendFile(path.join(webRoot, "index.html")));
  }

  app.use((error: unknown, request: Request, response: Response, next: NextFunction) => {
    void next;
    const normalized =
      error instanceof AppError
        ? error
        : error instanceof ZodError
          ? new AppError(422, "validation_failed", "Some supplied values are invalid.", {
              errors: error.issues.reduce<Record<string, string[]>>((grouped, issue) => {
                const field = issue.path.join(".") || "request";
                (grouped[field] ??= []).push(issue.message);
                return grouped;
              }, {})
            })
          : new AppError(500, "internal_error", "The request could not be completed.");
    if (!(error instanceof AppError) && !(error instanceof ZodError)) {
      logger.error("http.unhandled_error", {
        requestId: request.requestId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    response
      .status(normalized.status)
      .type("application/problem+json")
      .json({
        type: `https://ryva.example/problems/${normalized.type}`,
        title: normalized.message,
        status: normalized.status,
        detail: normalized.message,
        requestId: request.requestId,
        ...(normalized.errors ? { errors: normalized.errors } : {})
      });
  });

  return app;
}
