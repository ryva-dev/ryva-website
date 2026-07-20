import type { Express, RequestHandler } from "express";
import { z } from "zod";
import type { Database } from "../../../packages/database/src/index.js";
import {
  changeProtectedAccountStatus,
  confirmOrder,
  correctOrder,
  createProtectedAccountDraft,
  createOrder,
  decideProtectedAccountApproval,
  exportCommercialRecords,
  getAccount,
  getCommission,
  getCommissionDispute,
  getOrder,
  getProtectedAccount,
  linkCommercialDocument,
  listAccounts,
  listCommissionDisputes,
  listCommissions,
  listOrders,
  listProtectedAccounts,
  listReorders,
  openCommissionDispute,
  recordAudit,
  requestProtectedAccountApproval,
  resolveCommissionDispute,
  transitionCommission,
  updateAccount,
  updateCommissionDispute,
  updateProtectedAccountDraft,
  updateReorder
} from "../../../packages/domain/src/index.js";
import { uuidSchema } from "../../../packages/shared/src/index.js";
import { asyncRoute } from "./middleware.js";
import "./types.js";

type RouteDependencies = {
  app: Express;
  database: Database;
  authenticated: RequestHandler;
  csrf: RequestHandler;
  read: RequestHandler;
  write: RequestHandler;
};

const money = z.string().regex(/^\d+(?:\.\d{1,2})?$/).max(30);
const quantity = z.string().regex(/^\d+(?:\.\d{1,4})?$/).max(30);
const unitPrice = z.string().regex(/^\d+(?:\.\d{1,4})?$/).max(30);
const date = z.string().date();
const dateTime = z.string().datetime();

const lineSchema = z.object({
  productId: uuidSchema,
  description: z.string().trim().min(1).max(1000),
  quantity,
  unitWholesalePrice: unitPrice,
  grossAmount: money,
  discountAmount: money.default("0"),
  returnAmount: money.default("0"),
  cancellationAmount: money.default("0"),
  commissionEligible: z.boolean().default(true)
});

const orderBody = z.object({
  placementId: uuidSchema,
  accountId: uuidSchema.nullable().optional(),
  priorOrderId: uuidSchema.nullable().optional(),
  orderNumber: z.string().trim().min(1).max(200),
  externalReference: z.string().trim().max(500).nullable().optional(),
  idempotencyKey: z.string().trim().min(8).max(500),
  orderType: z.enum(["opening_order", "reorder"]),
  orderDate: date,
  currency: z.string().regex(/^[A-Z]{3}$/),
  sourceType: z.enum(["document", "external_reference", "manual_with_evidence", "imported"]),
  sourceDocumentId: uuidSchema,
  sourceReference: z.string().trim().max(2000).default(""),
  paymentStatus: z.enum(["unknown", "unpaid", "partially_paid", "paid", "refunded", "chargeback"]),
  fulfillmentStatus: z.enum(["unknown", "unfulfilled", "partial", "fulfilled", "returned", "canceled"]),
  lines: z.array(lineSchema).min(1).max(500)
});

export function registerPhase6Routes({
  app, database, authenticated, csrf, read, write
}: RouteDependencies): void {
  app.get("/api/accounts", authenticated, read, asyncRoute(async (request, response) => {
    const query = z.object({
      status: z.string().trim().max(80).optional(),
      health: z.string().trim().max(80).optional(),
      brandId: uuidSchema.optional(),
      businessId: uuidSchema.optional()
    }).parse(request.query);
    response.json({ accounts: await listAccounts(database, request.identity!.workspaceId, query) });
  }));

  app.get("/api/accounts/:accountId", authenticated, read, asyncRoute(async (request, response) => {
    response.json(await getAccount(
      database, request.identity!.workspaceId, uuidSchema.parse(request.params.accountId)
    ));
  }));

  app.patch("/api/accounts/:accountId", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      version: z.number().int().positive(),
      status: z.enum(["onboarding", "active", "at_risk", "paused", "ended"]),
      health: z.enum(["unknown", "healthy", "watch", "at_risk", "inactive"]),
      healthRationale: z.string().trim().min(10).max(10_000),
      endedReason: z.string().trim().max(10_000).nullable().optional()
    }).parse(request.body);
    response.json({ account: await updateAccount(database, {
      ...input, workspaceId: request.identity!.workspaceId,
      actorUserId: request.identity!.userId, requestId: request.requestId,
      accountId: uuidSchema.parse(request.params.accountId)
    }) });
  }));

  app.get("/api/protected-accounts", authenticated, read, asyncRoute(async (request, response) => {
    const query = z.object({
      status: z.string().trim().max(80).optional(),
      brandId: uuidSchema.optional(),
      businessId: uuidSchema.optional(),
      expiringBefore: date.optional()
    }).parse(request.query);
    response.json({
      protectedAccounts: await listProtectedAccounts(
        database, request.identity!.workspaceId, query
      )
    });
  }));

  app.post("/api/protected-accounts", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      accountId: uuidSchema,
      basisDocumentId: uuidSchema,
      originDate: date,
      scopeSummary: z.string().trim().min(10).max(20_000),
      productIds: z.array(uuidSchema).min(1).max(500),
      channels: z.array(z.string().trim().min(1).max(100)).min(1).max(50),
      territoryScope: z.record(z.string(), z.unknown()),
      protectionStartsOn: date,
      protectionEndsOn: date,
      protectionTerm: z.string().trim().min(5).max(10_000),
      commissionRights: z.string().trim().min(1).max(20_000),
      reorderRights: z.string().trim().min(1).max(20_000),
      houseAccountExclusions: z.string().trim().max(20_000),
      releaseTerms: z.string().trim().max(20_000)
    }).parse(request.body);
    response.status(201).json({ protectedAccount: await createProtectedAccountDraft(database, {
      ...input, workspaceId: request.identity!.workspaceId,
      actorUserId: request.identity!.userId, requestId: request.requestId
    }) });
  }));

  app.get("/api/protected-accounts/:protectedAccountId", authenticated, read, asyncRoute(async (request, response) => {
    response.json(await getProtectedAccount(
      database, request.identity!.workspaceId,
      uuidSchema.parse(request.params.protectedAccountId)
    ));
  }));

  app.patch("/api/protected-accounts/:protectedAccountId", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      version: z.number().int().positive(),
      basisDocumentId: uuidSchema,
      scopeSummary: z.string().trim().min(10).max(20_000),
      productIds: z.array(uuidSchema).min(1).max(500),
      channels: z.array(z.string().trim().min(1).max(100)).min(1).max(50),
      territoryScope: z.record(z.string(), z.unknown()),
      protectionStartsOn: date,
      protectionEndsOn: date,
      protectionTerm: z.string().trim().min(5).max(10_000),
      commissionRights: z.string().trim().min(1).max(20_000),
      reorderRights: z.string().trim().min(1).max(20_000),
      houseAccountExclusions: z.string().trim().max(20_000),
      releaseTerms: z.string().trim().max(20_000),
      conflictNotes: z.string().trim().max(20_000)
    }).parse(request.body);
    response.json({ protectedAccount: await updateProtectedAccountDraft(database, {
      ...input, workspaceId: request.identity!.workspaceId,
      actorUserId: request.identity!.userId, requestId: request.requestId,
      protectedAccountId: uuidSchema.parse(request.params.protectedAccountId)
    }) });
  }));

  app.post("/api/protected-accounts/:protectedAccountId/approval", authenticated, csrf, write, asyncRoute(async (request, response) => {
    response.status(201).json({ approval: await requestProtectedAccountApproval(database, {
      workspaceId: request.identity!.workspaceId, actorUserId: request.identity!.userId,
      requestId: request.requestId,
      protectedAccountId: uuidSchema.parse(request.params.protectedAccountId)
    }) });
  }));

  app.post("/api/protected-accounts/:protectedAccountId/approval/:approvalId", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      decision: z.enum(["approved", "rejected", "changes_required"]),
      conditions: z.string().trim().max(10_000).default("")
    }).parse(request.body);
    response.json({ protectedAccount: await decideProtectedAccountApproval(database, {
      ...input, workspaceId: request.identity!.workspaceId,
      actorUserId: request.identity!.userId, requestId: request.requestId,
      protectedAccountId: uuidSchema.parse(request.params.protectedAccountId),
      approvalId: uuidSchema.parse(request.params.approvalId)
    }) });
  }));

  app.post("/api/protected-accounts/:protectedAccountId/status", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      version: z.number().int().positive(),
      action: z.enum(["renew", "release", "end"]),
      reason: z.string().trim().min(10).max(10_000),
      newEndsOn: date.nullable().optional(),
      evidenceDocumentId: uuidSchema
    }).parse(request.body);
    response.json({ protectedAccount: await changeProtectedAccountStatus(database, {
      ...input, workspaceId: request.identity!.workspaceId,
      actorUserId: request.identity!.userId, requestId: request.requestId,
      protectedAccountId: uuidSchema.parse(request.params.protectedAccountId)
    }) });
  }));

  app.get("/api/orders", authenticated, read, asyncRoute(async (request, response) => {
    const query = z.object({
      status: z.string().trim().max(80).optional(),
      paymentStatus: z.string().trim().max(80).optional(),
      orderType: z.string().trim().max(80).optional(),
      accountId: uuidSchema.optional()
    }).parse(request.query);
    response.json({ orders: await listOrders(database, request.identity!.workspaceId, query) });
  }));

  app.post("/api/orders", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = orderBody.parse(request.body);
    response.status(201).json({ order: await createOrder(database, {
      ...input, workspaceId: request.identity!.workspaceId,
      actorUserId: request.identity!.userId, requestId: request.requestId
    }) });
  }));

  app.get("/api/orders/:orderId", authenticated, read, asyncRoute(async (request, response) => {
    response.json(await getOrder(
      database, request.identity!.workspaceId, uuidSchema.parse(request.params.orderId)
    ));
  }));

  app.post("/api/orders/:orderId/confirm", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      version: z.number().int().positive(),
      verificationNotes: z.string().trim().min(10).max(10_000),
      expectedReorderWindowStartsOn: date.nullable().optional(),
      expectedReorderWindowEndsOn: date.nullable().optional()
    }).parse(request.body);
    response.json(await confirmOrder(database, {
      ...input, workspaceId: request.identity!.workspaceId,
      actorUserId: request.identity!.userId, requestId: request.requestId,
      orderId: uuidSchema.parse(request.params.orderId)
    }));
  }));

  app.post("/api/orders/:orderId/corrections", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      version: z.number().int().positive(),
      reason: z.string().trim().min(10).max(10_000),
      sourceDocumentId: uuidSchema,
      status: z.enum(["draft", "submitted", "confirmed", "fulfilled", "partially_returned", "returned", "canceled"]),
      paymentStatus: z.enum(["unknown", "unpaid", "partially_paid", "paid", "refunded", "chargeback"]),
      fulfillmentStatus: z.enum(["unknown", "unfulfilled", "partial", "fulfilled", "returned", "canceled"]),
      lines: z.array(lineSchema).min(1).max(500)
    }).parse(request.body);
    response.json(await correctOrder(database, {
      ...input, workspaceId: request.identity!.workspaceId,
      actorUserId: request.identity!.userId, requestId: request.requestId,
      orderId: uuidSchema.parse(request.params.orderId)
    }));
  }));

  app.get("/api/reorders", authenticated, read, asyncRoute(async (request, response) => {
    const query = z.object({
      status: z.string().trim().max(80).optional(),
      health: z.string().trim().max(80).optional(),
      dueBefore: date.optional()
    }).parse(request.query);
    response.json({ reorders: await listReorders(database, request.identity!.workspaceId, query) });
  }));

  app.patch("/api/reorders/:reorderId", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      version: z.number().int().positive(),
      status: z.enum(["projected", "due", "contacted", "deferred", "not_expected", "closed"]),
      expectedWindowStartsOn: date.nullable().optional(),
      expectedWindowEndsOn: date.nullable().optional(),
      reminderAt: dateTime.nullable().optional(),
      accountHealth: z.enum(["unknown", "healthy", "watch", "at_risk", "inactive"]),
      healthRationale: z.string().trim().min(10).max(10_000),
      nextAction: z.string().trim().min(1).max(10_000),
      likelihoodLabel: z.enum(["low", "medium", "high"]).nullable().optional(),
      likelihoodOrigin: z.enum(["user_entered", "system_estimate"]).nullable().optional(),
      estimateExplanation: z.string().trim().max(10_000),
      recommendedFollowUp: z.string().trim().max(10_000),
      deferOrCloseReason: z.string().trim().max(10_000).nullable().optional()
    }).parse(request.body);
    response.json({ reorder: await updateReorder(database, {
      ...input, workspaceId: request.identity!.workspaceId,
      actorUserId: request.identity!.userId, requestId: request.requestId,
      reorderId: uuidSchema.parse(request.params.reorderId)
    }) });
  }));

  app.get("/api/commissions", authenticated, read, asyncRoute(async (request, response) => {
    const query = z.object({
      status: z.string().trim().max(80).optional(),
      accountId: uuidSchema.optional(),
      overdue: z.enum(["true", "false"]).transform((value) => value === "true").optional()
    }).parse(request.query);
    response.json({
      commissions: await listCommissions(database, request.identity!.workspaceId, query)
    });
  }));

  app.get("/api/commissions/:commissionId", authenticated, read, asyncRoute(async (request, response) => {
    response.json(await getCommission(
      database, request.identity!.workspaceId, uuidSchema.parse(request.params.commissionId)
    ));
  }));

  app.post("/api/commissions/:commissionId/status", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      version: z.number().int().positive(),
      toStatus: z.enum(["pending_verification", "approved", "payable", "paid", "canceled", "clawed_back"]),
      reason: z.string().trim().min(10).max(10_000),
      sourceDocumentId: uuidSchema,
      verifiedAmount: money.nullable().optional(),
      approvedAmount: money.nullable().optional(),
      paidAmount: money.nullable().optional(),
      paymentDueDate: date.nullable().optional(),
      paymentDate: date.nullable().optional(),
      clawbackAmount: money.nullable().optional()
    }).parse(request.body);
    response.json({ commission: await transitionCommission(database, {
      ...input, workspaceId: request.identity!.workspaceId,
      actorUserId: request.identity!.userId, requestId: request.requestId,
      commissionId: uuidSchema.parse(request.params.commissionId)
    }) });
  }));

  app.post("/api/commissions/:commissionId/disputes", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      reasonCode: z.string().trim().min(1).max(100),
      reason: z.string().trim().min(10).max(20_000),
      disputedAmount: money,
      evidenceDocumentId: uuidSchema,
      nextAction: z.string().trim().min(1).max(10_000)
    }).parse(request.body);
    response.status(201).json({ dispute: await openCommissionDispute(database, {
      ...input, workspaceId: request.identity!.workspaceId,
      actorUserId: request.identity!.userId, requestId: request.requestId,
      commissionId: uuidSchema.parse(request.params.commissionId)
    }) });
  }));

  app.get("/api/commission-disputes", authenticated, read, asyncRoute(async (request, response) => {
    const query = z.object({
      status: z.string().trim().max(80).optional(),
      commissionId: uuidSchema.optional()
    }).parse(request.query);
    response.json({
      disputes: await listCommissionDisputes(database, request.identity!.workspaceId, query)
    });
  }));

  app.get("/api/commission-disputes/:disputeId", authenticated, read, asyncRoute(async (request, response) => {
    response.json(await getCommissionDispute(
      database, request.identity!.workspaceId, uuidSchema.parse(request.params.disputeId)
    ));
  }));

  app.patch("/api/commission-disputes/:disputeId", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      version: z.number().int().positive(),
      status: z.enum(["evidence_needed", "submitted", "under_review", "rejected", "withdrawn"]),
      nextAction: z.string().trim().min(1).max(10_000),
      brandResponse: z.string().trim().max(20_000),
      reason: z.string().trim().min(10).max(10_000),
      evidenceDocumentId: uuidSchema.nullable().optional()
    }).parse(request.body);
    response.json({ dispute: await updateCommissionDispute(database, {
      ...input, workspaceId: request.identity!.workspaceId,
      actorUserId: request.identity!.userId, requestId: request.requestId,
      disputeId: uuidSchema.parse(request.params.disputeId)
    }) });
  }));

  app.post("/api/commission-disputes/:disputeId/resolve", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      version: z.number().int().positive(),
      resolutionAmount: money,
      resolution: z.string().trim().min(10).max(20_000),
      resolutionDate: date,
      evidenceDocumentId: uuidSchema,
      finalDecisionId: uuidSchema
    }).parse(request.body);
    response.json({ dispute: await resolveCommissionDispute(database, {
      ...input, workspaceId: request.identity!.workspaceId,
      actorUserId: request.identity!.userId, requestId: request.requestId,
      disputeId: uuidSchema.parse(request.params.disputeId)
    }) });
  }));

  app.post("/api/commercial-documents", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      subjectType: z.enum(["protected_account", "account", "order", "reorder", "commission", "commission_dispute"]),
      subjectId: uuidSchema,
      documentId: uuidSchema,
      purpose: z.string().trim().min(1).max(1000)
    }).parse(request.body);
    await linkCommercialDocument(database, {
      ...input, workspaceId: request.identity!.workspaceId,
      actorUserId: request.identity!.userId, requestId: request.requestId
    });
    response.status(204).end();
  }));

  app.get("/api/commercial-export/:recordType", authenticated, read, asyncRoute(async (request, response) => {
    const recordType = z.enum(["account", "order", "reorder", "commission", "commission_dispute"])
      .parse(request.params.recordType);
    const csv = await exportCommercialRecords(
      database, request.identity!.workspaceId, recordType
    );
    await recordAudit(database, {
      workspaceId: request.identity!.workspaceId,
      actorUserId: request.identity!.userId,
      actorType: "user",
      action: "commercial_export.generated",
      targetType: recordType,
      targetId: request.requestId,
      origin: "api",
      requestId: request.requestId,
      outcome: "succeeded",
      metadata: { format: "csv" }
    });
    response.setHeader("content-type", "text/csv; charset=utf-8");
    response.setHeader("content-disposition", `attachment; filename="ryva-${recordType}s.csv"`);
    response.send(csv);
  }));
}
