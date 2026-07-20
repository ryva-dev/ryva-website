import type { Express, RequestHandler } from "express";
import { z } from "zod";
import type { Database } from "../../../packages/database/src/index.js";
import {
  addAgreementRestriction,
  changeAgreementStatus,
  createAgreement,
  createPlacement,
  createRepresentationOpportunity,
  createTermCandidate,
  decideAndActivateAgreement,
  evaluateAuthority,
  getAgreement,
  getPlacement,
  getRepresentationOpportunity,
  listAgreements,
  listPlacements,
  listRepresentationOpportunities,
  requestAgreementApproval,
  reviewTermCandidate,
  transitionPlacement,
  transitionRepresentationOpportunity,
  updateAgreement
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

const agreementChanges = z.object({
  effectiveAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  channels: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  territoryScope: z.record(z.string(), z.unknown()).optional(),
  authoritySummary: z.string().trim().max(8000).optional(),
  commissionBasis: z.string().trim().max(4000).optional(),
  commissionRate: z.number().min(0).max(1).nullable().optional(),
  commissionCurrency: z.string().regex(/^[A-Z]{3}$/).nullable().optional(),
  commissionTiming: z.string().trim().max(4000).optional(),
  openingOrderRights: z.string().trim().max(8000).optional(),
  reorderRights: z.string().trim().max(8000).optional(),
  protectedAccountRules: z.string().trim().max(8000).optional(),
  houseAccountRules: z.string().trim().max(8000).optional(),
  terminationTerms: z.string().trim().max(8000).optional(),
  terminationNoticeDays: z.number().int().nonnegative().nullable().optional(),
  postTerminationCommissionRights: z.string().trim().max(8000).optional(),
  postTerminationCommissionEndsAt: z.string().datetime().nullable().optional(),
  renewalStatus: z.enum(["not_reviewed", "not_renewing", "review_due", "renewal_in_progress", "renewed"]).optional(),
  renewalReviewAt: z.string().datetime().nullable().optional(),
  legalAmbiguityStatus: z.enum(["none", "review_required", "specialist_required", "resolved"]).optional(),
  legalAmbiguityNotes: z.string().trim().max(8000).optional()
});

const listQuery = z.object({
  stage: z.string().trim().max(80).optional(),
  status: z.string().trim().max(80).optional(),
  q: z.string().trim().max(200).optional()
});

export function registerPhase4Routes({
  app, database, authenticated, csrf, read, write
}: RouteDependencies): void {
  app.get("/api/representation/opportunities", authenticated, read, asyncRoute(async (request, response) => {
    const query = listQuery.parse(request.query);
    response.json({ opportunities: await listRepresentationOpportunities(database, request.identity!.workspaceId, {
      ...(query.stage ? { stage: query.stage } : {}), ...(query.q ? { query: query.q } : {})
    }) });
  }));

  app.post("/api/representation/opportunities", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      brandId: uuidSchema,
      brandContactId: uuidSchema.nullable().optional(),
      productIds: z.array(uuidSchema).min(1).max(100),
      proposedChannels: z.array(z.string().trim().min(1).max(100)).min(1).max(50),
      proposedTerritory: z.record(z.string(), z.unknown()),
      brandObjectives: z.string().trim().min(1).max(4000),
      termsSummary: z.string().trim().max(8000).default(""),
      missingTerms: z.array(z.string().trim().min(1).max(240)).max(50),
      decisionId: uuidSchema,
      nextActionTaskId: uuidSchema
    }).parse(request.body);
    response.status(201).json({ opportunity: await createRepresentationOpportunity(database, {
      ...input, workspaceId: request.identity!.workspaceId, actorUserId: request.identity!.userId,
      requestId: request.requestId
    }) });
  }));

  app.get("/api/representation/opportunities/:opportunityId", authenticated, read, asyncRoute(async (request, response) => {
    response.json(await getRepresentationOpportunity(
      database,
      request.identity!.workspaceId,
      uuidSchema.parse(request.params.opportunityId)
    ));
  }));

  app.post("/api/representation/opportunities/:opportunityId/stage", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      version: z.number().int().positive(),
      toStage: z.enum(["contact_ready", "contacted", "conversation", "reviewing_terms",
        "agreement_draft", "paused", "rejected"]),
      reason: z.string().trim().min(1).max(4000),
      decisionId: uuidSchema,
      nextActionTaskId: uuidSchema.nullable().optional()
    }).parse(request.body);
    response.json({ opportunity: await transitionRepresentationOpportunity(database, {
      ...input, opportunityId: uuidSchema.parse(request.params.opportunityId),
      workspaceId: request.identity!.workspaceId, actorUserId: request.identity!.userId,
      requestId: request.requestId
    }) });
  }));

  app.get("/api/agreements", authenticated, read, asyncRoute(async (request, response) => {
    const query = listQuery.parse(request.query);
    response.json({ agreements: await listAgreements(database, request.identity!.workspaceId, {
      ...(query.status ? { status: query.status } : {}), ...(query.q ? { query: query.q } : {})
    }) });
  }));

  app.post("/api/agreements", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      representationOpportunityId: uuidSchema,
      sourceDocumentId: uuidSchema.nullable().optional()
    }).parse(request.body);
    response.status(201).json({ agreement: await createAgreement(database, {
      ...input, workspaceId: request.identity!.workspaceId, actorUserId: request.identity!.userId,
      requestId: request.requestId
    }) });
  }));

  app.get("/api/agreements/:agreementId", authenticated, read, asyncRoute(async (request, response) => {
    response.json(await getAgreement(database, request.identity!.workspaceId, uuidSchema.parse(request.params.agreementId)));
  }));

  app.patch("/api/agreements/:agreementId", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      version: z.number().int().positive(),
      changes: agreementChanges,
      productIds: z.array(uuidSchema).min(1).max(100).optional()
    }).parse(request.body);
    response.json({ agreement: await updateAgreement(database, {
      ...input, agreementId: uuidSchema.parse(request.params.agreementId),
      workspaceId: request.identity!.workspaceId, actorUserId: request.identity!.userId,
      requestId: request.requestId
    }) });
  }));

  app.post("/api/agreements/:agreementId/term-candidates", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      sourceDocumentId: uuidSchema,
      fieldName: z.string().trim().min(1).max(120),
      proposedValue: z.unknown(),
      sourcePage: z.number().int().positive().nullable().optional(),
      sourceLocation: z.string().trim().min(1).max(1000),
      evidenceExcerpt: z.string().trim().max(4000).default(""),
      evidenceClass: z.enum(["verified_fact", "direct_evidence", "strong_proxy", "weak_proxy", "estimate", "assumption", "model_generated_inference", "unknown"]),
      confidence: z.enum(["insufficient", "limited", "supported", "strong"]),
      origin: z.enum(["user_entered", "imported"]),
      material: z.boolean().default(true),
      ambiguous: z.boolean().default(false),
      specialistReviewRequired: z.boolean().default(false)
    }).parse(request.body);
    response.status(201).json({ candidate: await createTermCandidate(database, {
      ...input, agreementId: uuidSchema.parse(request.params.agreementId),
      workspaceId: request.identity!.workspaceId, actorUserId: request.identity!.userId,
      requestId: request.requestId
    }) });
  }));

  app.patch("/api/agreement-term-candidates/:candidateId", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      version: z.number().int().positive(),
      decision: z.enum(["confirmed", "rejected"]),
      editedValue: z.unknown().optional(),
      reviewNotes: z.string().trim().min(1).max(4000)
    }).parse(request.body);
    response.json({ candidate: await reviewTermCandidate(database, {
      ...input, candidateId: uuidSchema.parse(request.params.candidateId),
      workspaceId: request.identity!.workspaceId, actorUserId: request.identity!.userId,
      requestId: request.requestId
    }) });
  }));

  app.post("/api/agreements/:agreementId/account-restrictions", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      restrictionType: z.enum(["house_account_exclusion", "protected_account_basis", "account_exclusion"]),
      businessId: uuidSchema.nullable().optional(),
      accountName: z.string().trim().min(1).max(240),
      productIds: z.array(uuidSchema).max(100).default([]),
      channels: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
      territoryScope: z.record(z.string(), z.unknown()).default({}),
      effectiveAt: z.string().datetime().nullable().optional(),
      expiresAt: z.string().datetime().nullable().optional(),
      sourceDocumentId: uuidSchema,
      sourceLocation: z.string().trim().min(1).max(1000)
    }).parse(request.body);
    response.status(201).json({ restriction: await addAgreementRestriction(database, {
      ...input, agreementId: uuidSchema.parse(request.params.agreementId),
      workspaceId: request.identity!.workspaceId, actorUserId: request.identity!.userId,
      requestId: request.requestId
    }) });
  }));

  app.post("/api/agreements/:agreementId/approval", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({ scope: z.string().trim().min(1).max(2000) }).parse(request.body);
    response.status(201).json({ approval: await requestAgreementApproval(database, {
      ...input, agreementId: uuidSchema.parse(request.params.agreementId),
      workspaceId: request.identity!.workspaceId, actorUserId: request.identity!.userId,
      requestId: request.requestId
    }) });
  }));

  app.post("/api/agreements/:agreementId/activate", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      approvalId: uuidSchema,
      decision: z.enum(["approved", "rejected", "changes_required"]),
      conditions: z.string().trim().max(4000).default("")
    }).parse(request.body);
    response.json({ agreement: await decideAndActivateAgreement(database, {
      ...input, agreementId: uuidSchema.parse(request.params.agreementId),
      workspaceId: request.identity!.workspaceId, actorUserId: request.identity!.userId,
      requestId: request.requestId
    }) });
  }));

  app.post("/api/agreements/:agreementId/status", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      version: z.number().int().positive(),
      status: z.enum(["suspended", "ended"]),
      reason: z.string().trim().min(10).max(4000)
    }).parse(request.body);
    response.json({ agreement: await changeAgreementStatus(database, {
      ...input, agreementId: uuidSchema.parse(request.params.agreementId),
      workspaceId: request.identity!.workspaceId, actorUserId: request.identity!.userId,
      requestId: request.requestId
    }) });
  }));

  app.post("/api/authority/evaluate", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      action: z.enum(["prepare_outreach", "approve_outreach", "send_outreach", "brand_authorized", "brand_active", "product_represented", "placement_create", "placement_stage"]),
      brandId: uuidSchema,
      productIds: z.array(uuidSchema).min(1).max(100),
      businessId: uuidSchema.nullable().optional(),
      channel: z.string().trim().max(100).nullable().optional(),
      agreementId: uuidSchema.nullable().optional(),
      context: z.record(z.string(), z.unknown()).optional()
    }).parse(request.body);
    response.json({ authority: await evaluateAuthority(database, {
      ...input, workspaceId: request.identity!.workspaceId, actorUserId: request.identity!.userId,
      requestId: request.requestId
    }) });
  }));

  app.get("/api/placements", authenticated, read, asyncRoute(async (request, response) => {
    const query = listQuery.parse(request.query);
    response.json({ placements: await listPlacements(database, request.identity!.workspaceId, {
      ...(query.stage ? { stage: query.stage } : {}), ...(query.q ? { query: query.q } : {})
    }) });
  }));

  app.post("/api/placements", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const text = z.string().trim().min(1).max(8000);
    const input = z.object({
      agreementId: uuidSchema,
      businessId: uuidSchema,
      productIds: z.array(uuidSchema).min(1).max(100),
      channel: z.string().trim().min(1).max(100),
      matchThesis: text,
      buyerValueBasis: text,
      evidenceConfidence: z.enum(["insufficient", "limited", "supported", "strong"]),
      decisionId: uuidSchema,
      nextActionTaskId: uuidSchema.nullable().optional(),
      triangle: z.object({
        brandValue: text, brandObligations: text, brandRisks: text,
        brandWarningSigns: z.string().trim().max(8000).default(""),
        buyerValue: text, buyerObligations: text, buyerRisks: text,
        buyerWarningSigns: z.string().trim().max(8000).default(""),
        representativeValue: text, representativeObligations: text, representativeRisks: text,
        representativeWarningSigns: z.string().trim().max(8000).default(""),
        allPartiesReceiveLegitimateValue: z.boolean()
      })
    }).parse(request.body);
    response.status(201).json({ placement: await createPlacement(database, {
      ...input, workspaceId: request.identity!.workspaceId, actorUserId: request.identity!.userId,
      requestId: request.requestId
    }) });
  }));

  app.get("/api/placements/:placementId", authenticated, read, asyncRoute(async (request, response) => {
    response.json(await getPlacement(database, request.identity!.workspaceId, uuidSchema.parse(request.params.placementId)));
  }));

  app.post("/api/placements/:placementId/stage", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      version: z.number().int().positive(),
      toStage: z.enum(["identified", "qualified", "prepared", "contacted", "engaged",
        "information_sample_sent", "buyer_review", "terms_order_discussion", "opening_order",
        "active_account", "reorder_management", "closed_lost", "disqualified"]),
      reason: z.string().trim().max(4000),
      decisionId: uuidSchema,
      evidenceIds: z.array(uuidSchema).max(100).default([]),
      nextActionTaskId: uuidSchema.nullable().optional()
    }).parse(request.body);
    response.json({ placement: await transitionPlacement(database, {
      ...input, placementId: uuidSchema.parse(request.params.placementId),
      workspaceId: request.identity!.workspaceId, actorUserId: request.identity!.userId,
      requestId: request.requestId
    }) });
  }));
}
