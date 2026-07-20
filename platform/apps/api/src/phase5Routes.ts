import { createHmac, timingSafeEqual } from "node:crypto";
import type { Express, RequestHandler } from "express";
import express from "express";
import { z } from "zod";
import type { AppConfig } from "../../../packages/config/src/index.js";
import type { Database } from "../../../packages/database/src/index.js";
import {
  addSuppression,
  classifyOutreachResponse,
  confirmManualOutreach,
  correctSuppression,
  createOutreachMessage,
  createOutreachTemplate,
  createSequence,
  decideOutreachApproval,
  enrollSequence,
  getOutreachMessage,
  listOutreach,
  listOutreachTemplates,
  listSequences,
  logOutreachCall,
  processOutreachProviderEvent,
  publicDigest,
  queueOutreachMessage,
  recordAudit,
  requestOutreachApproval,
  unifiedOutreachHistory,
  updateOutreachMessage
} from "../../../packages/domain/src/index.js";
import { AppError, newId, uuidSchema } from "../../../packages/shared/src/index.js";
import { asyncRoute } from "./middleware.js";
import "./types.js";

type RouteDependencies = {
  app: Express;
  database: Database;
  configuration: AppConfig;
  authenticated: RequestHandler;
  csrf: RequestHandler;
  read: RequestHandler;
  write: RequestHandler;
};

function signatureMatches(raw: Buffer, provided: string | undefined, secret: string): boolean {
  if (!provided || !secret) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function registerPhase5Webhook(
  app: Express,
  database: Database,
  configuration: AppConfig
): void {
  app.post(
    "/api/webhooks/email",
    express.raw({ type: "application/json", limit: "256kb" }),
    asyncRoute(async (request, response) => {
      const raw = request.body as Buffer;
      if (!signatureMatches(raw, request.header("x-ryva-signature"), configuration.EMAIL_WEBHOOK_SECRET)) {
        throw new AppError(401, "webhook_signature_invalid", "Webhook signature is invalid.");
      }
      const input = z.object({
        eventId: z.string().trim().min(1).max(500),
        providerMessageId: z.string().trim().max(500).nullable().optional(),
        messageId: uuidSchema.nullable().optional(),
        eventType: z.enum(["accepted", "delivered", "bounced", "complained", "replied", "opted_out"]),
        replyBody: z.string().max(100_000).nullable().optional()
      }).parse(JSON.parse(raw.toString("utf8")));
      const result = await processOutreachProviderEvent(database, {
        providerEventId: input.eventId,
        providerMessageId: input.providerMessageId,
        messageId: input.messageId,
        eventType: input.eventType,
        replyBody: input.replyBody,
        payloadDigest: publicDigest(raw.toString("utf8")),
        requestId: request.requestId
      });
      response.status(202).json(result);
    })
  );
}

const messageBody = z.object({
  placementId: uuidSchema,
  contactId: uuidSchema,
  channel: z.enum(["email", "social"]),
  senderAddress: z.string().trim().min(1).max(320),
  recipientAddress: z.string().trim().min(1).max(320),
  subject: z.string().trim().max(998).default(""),
  body: z.string().trim().min(1).max(100_000),
  productIds: z.array(uuidSchema).min(1).max(100),
  claimLinks: z.array(z.object({
    claimText: z.string().trim().min(1).max(4000),
    productId: uuidSchema.nullable().optional(),
    evidenceId: uuidSchema.nullable().optional()
  })).max(100).default([]),
  attachmentIds: z.array(uuidSchema).max(25).default([]),
  templateVersionId: uuidSchema.nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional()
});

export function registerPhase5Routes({
  app, database, configuration, authenticated, csrf, read, write
}: RouteDependencies): void {
  app.get("/api/outreach/config", authenticated, read, (request, response) => {
    response.json({
      senderAddress: configuration.EMAIL_FROM_ADDRESS || request.identity!.email,
      providerConfigured: Boolean(
        configuration.OUTREACH_SEND_ENABLED &&
        configuration.EMAIL_PROVIDER_URL &&
        configuration.EMAIL_PROVIDER_TOKEN
      )
    });
  });

  app.get("/api/outreach", authenticated, read, asyncRoute(async (request, response) => {
    const query = z.object({
      status: z.string().trim().max(80).optional(),
      channel: z.string().trim().max(80).optional(),
      placementId: uuidSchema.optional()
    }).parse(request.query);
    response.json({
      messages: await listOutreach(database, request.identity!.workspaceId, query)
    });
  }));

  app.get("/api/outreach/history", authenticated, read, asyncRoute(async (request, response) => {
    const query = z.object({ placementId: uuidSchema.optional() }).parse(request.query);
    response.json({
      history: await unifiedOutreachHistory(database, request.identity!.workspaceId, query.placementId)
    });
  }));

  app.post("/api/outreach", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = messageBody.parse(request.body);
    const permittedSender = configuration.EMAIL_FROM_ADDRESS || request.identity!.email;
    if (input.senderAddress.toLowerCase() !== permittedSender.toLowerCase()) {
      throw new AppError(422, "sender_identity_not_permitted", "Choose the configured verified sender identity.");
    }
    response.status(201).json({
      message: await createOutreachMessage(database, {
        ...input, workspaceId: request.identity!.workspaceId,
        actorUserId: request.identity!.userId, requestId: request.requestId
      })
    });
  }));

  app.patch("/api/outreach/:messageId", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      version: z.number().int().positive(),
      recipientAddress: z.string().trim().min(1).max(320),
      senderAddress: z.string().trim().min(1).max(320),
      subject: z.string().trim().max(998),
      body: z.string().trim().min(1).max(100_000),
      scheduledAt: z.string().datetime().nullable().optional()
    }).parse(request.body);
    response.json({
      message: await updateOutreachMessage(database, {
        ...input, workspaceId: request.identity!.workspaceId,
        actorUserId: request.identity!.userId, requestId: request.requestId,
        messageId: uuidSchema.parse(request.params.messageId)
      })
    });
  }));

  app.post("/api/outreach/:messageId/approval", authenticated, csrf, write, asyncRoute(async (request, response) => {
    response.status(201).json({
      approval: await requestOutreachApproval(database, {
        workspaceId: request.identity!.workspaceId, actorUserId: request.identity!.userId,
        requestId: request.requestId, messageId: uuidSchema.parse(request.params.messageId)
      })
    });
  }));

  app.post("/api/outreach/:messageId/approval/:approvalId", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      decision: z.enum(["approved", "rejected", "changes_required"]),
      conditions: z.string().trim().max(4000).default("")
    }).parse(request.body);
    response.json({
      message: await decideOutreachApproval(database, {
        ...input, workspaceId: request.identity!.workspaceId,
        actorUserId: request.identity!.userId, requestId: request.requestId,
        messageId: uuidSchema.parse(request.params.messageId),
        approvalId: uuidSchema.parse(request.params.approvalId)
      })
    });
  }));

  app.post("/api/outreach/:messageId/send", authenticated, csrf, write, asyncRoute(async (request, response) => {
    response.status(202).json({
      message: await queueOutreachMessage(database, {
        workspaceId: request.identity!.workspaceId, actorUserId: request.identity!.userId,
        requestId: request.requestId, messageId: uuidSchema.parse(request.params.messageId)
      })
    });
  }));

  app.post("/api/outreach/:messageId/confirm-manual-send", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      occurredAt: z.string().datetime(),
      confirmation: z.string().trim().min(10).max(2000)
    }).parse(request.body);
    response.json({
      message: await confirmManualOutreach(database, {
        ...input, workspaceId: request.identity!.workspaceId,
        actorUserId: request.identity!.userId, requestId: request.requestId,
        messageId: uuidSchema.parse(request.params.messageId)
      })
    });
  }));

  app.post("/api/outreach/:messageId/classify-response", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      classification: z.enum(["interested", "not_now", "objection", "question", "opt_out", "wrong_contact", "not_fit"]),
      notes: z.string().trim().min(1).max(10_000),
      nextActionTitle: z.string().trim().max(500).nullable().optional(),
      nextActionDueAt: z.string().datetime().nullable().optional()
    }).parse(request.body);
    response.json({
      response: await classifyOutreachResponse(database, {
        ...input, workspaceId: request.identity!.workspaceId,
        actorUserId: request.identity!.userId, requestId: request.requestId,
        messageId: uuidSchema.parse(request.params.messageId)
      })
    });
  }));

  app.get("/api/outreach/templates", authenticated, read, asyncRoute(async (request, response) => {
    response.json({ templates: await listOutreachTemplates(database, request.identity!.workspaceId) });
  }));

  app.post("/api/outreach/templates", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      name: z.string().trim().min(1).max(200),
      channel: z.enum(["email", "social", "call", "voicemail", "objection", "follow_up"]),
      purpose: z.string().trim().min(1).max(2000),
      subject: z.string().trim().max(998).default(""),
      body: z.string().trim().min(1).max(100_000),
      requiredVariables: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
      requiredComplianceBlocks: z.array(z.string().trim().min(1).max(100)).max(50).default([])
    }).parse(request.body);
    response.status(201).json({
      template: await createOutreachTemplate(database, {
        ...input, workspaceId: request.identity!.workspaceId,
        actorUserId: request.identity!.userId, requestId: request.requestId
      })
    });
  }));

  app.get("/api/outreach/sequences", authenticated, read, asyncRoute(async (request, response) => {
    response.json({ sequences: await listSequences(database, request.identity!.workspaceId) });
  }));

  app.post("/api/outreach/sequences", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      name: z.string().trim().min(1).max(200),
      purpose: z.string().trim().min(1).max(2000),
      steps: z.array(z.object({
        stepType: z.enum(["email", "social", "call", "task"]),
        delayMinutes: z.number().int().min(0).max(525_600),
        templateVersionId: uuidSchema.nullable().optional(),
        taskTitle: z.string().trim().max(500).nullable().optional(),
        instructions: z.string().trim().max(4000).default("")
      })).min(1).max(50)
    }).parse(request.body);
    response.status(201).json({
      sequence: await createSequence(database, {
        ...input, workspaceId: request.identity!.workspaceId,
        actorUserId: request.identity!.userId, requestId: request.requestId
      })
    });
  }));

  app.post("/api/outreach/sequences/:sequenceId/enroll", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({ placementId: uuidSchema, contactId: uuidSchema }).parse(request.body);
    response.status(201).json({
      enrollment: await enrollSequence(database, {
        ...input, sequenceId: uuidSchema.parse(request.params.sequenceId),
        workspaceId: request.identity!.workspaceId, actorUserId: request.identity!.userId,
        requestId: request.requestId
      })
    });
  }));

  app.post("/api/outreach/calls", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      placementId: uuidSchema, contactId: uuidSchema,
      status: z.enum(["planned", "completed", "no_answer", "voicemail", "canceled"]),
      objective: z.string().trim().min(1).max(4000),
      preparation: z.string().trim().max(10_000).default(""),
      questions: z.array(z.string().trim().min(1).max(2000)).max(50).default([]),
      objectionGuidance: z.array(z.record(z.string(), z.unknown())).max(50).default([]),
      authorityLimits: z.string().trim().max(4000).default(""),
      voicemailScript: z.string().trim().max(10_000).default(""),
      notes: z.string().trim().max(20_000).default(""),
      outcome: z.string().trim().max(4000).default(""),
      durationSeconds: z.number().int().nonnegative().nullable().optional(),
      occurredAt: z.string().datetime().nullable().optional(),
      nextActionTitle: z.string().trim().max(500).nullable().optional(),
      nextActionDueAt: z.string().datetime().nullable().optional()
    }).parse(request.body);
    response.status(201).json({
      call: await logOutreachCall(database, {
        ...input, workspaceId: request.identity!.workspaceId,
        actorUserId: request.identity!.userId, requestId: request.requestId
      })
    });
  }));

  app.post("/api/outreach/suppressions", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      contactId: uuidSchema, channel: z.enum(["email", "social", "call", "all"]),
      reason: z.enum(["opt_out", "complaint", "hard_bounce", "prohibited", "invalid_authority", "account_conflict", "manual"]),
      source: z.string().trim().min(1).max(500)
    }).parse(request.body);
    response.status(201).json({
      suppression: await addSuppression(database, {
        ...input, workspaceId: request.identity!.workspaceId,
        actorUserId: request.identity!.userId, requestId: request.requestId
      })
    });
  }));

  app.post("/api/outreach/suppressions/:suppressionId/correct", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      reason: z.string().trim().min(10).max(4000),
      evidence: z.string().trim().min(3).max(4000)
    }).parse(request.body);
    response.json({
      suppression: await correctSuppression(database, {
        ...input, suppressionId: uuidSchema.parse(request.params.suppressionId),
        workspaceId: request.identity!.workspaceId, actorUserId: request.identity!.userId,
        requestId: request.requestId
      })
    });
  }));

  app.post("/api/outreach/notes", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      placementId: uuidSchema, body: z.string().trim().min(1).max(20_000),
      visibility: z.enum(["private", "workspace", "restricted"]).default("workspace")
    }).parse(request.body);
    const id = newId();
    await database.query(
      `INSERT INTO notes
        (id,workspace_id,subject_type,subject_id,body,visibility,owner_user_id,status)
       VALUES($1,$2,'placement_opportunity',$3,$4,$5,$6,'active')`,
      [id, request.identity!.workspaceId, input.placementId, input.body,
        input.visibility, request.identity!.userId]
    );
    await recordAudit(database, {
      workspaceId: request.identity!.workspaceId, actorUserId: request.identity!.userId,
      actorType: "user", action: "outreach_note.created", targetType: "note", targetId: id,
      origin: "api", requestId: request.requestId, outcome: "succeeded",
      metadata: { placementId: input.placementId }
    });
    response.status(201).json({ note: { id, ...input } });
  }));

  app.post("/api/outreach/reminders", authenticated, csrf, write, asyncRoute(async (request, response) => {
    const input = z.object({
      placementId: uuidSchema, title: z.string().trim().min(1).max(500),
      dueAt: z.string().datetime(), priority: z.enum(["low", "medium", "high", "critical"]).default("medium")
    }).parse(request.body);
    const id = newId();
    await database.query(
      `INSERT INTO tasks
        (id,workspace_id,subject_type,subject_id,title,owner_user_id,status,priority,
         created_reason,due_at,mandatory_gate)
       VALUES($1,$2,'placement_opportunity',$3,$4,$5,'open',$6,'Outreach reminder',$7,false)`,
      [id, request.identity!.workspaceId, input.placementId, input.title,
        request.identity!.userId, input.priority, input.dueAt]
    );
    response.status(201).json({ reminder: { id, ...input, status: "open" } });
  }));

  // Keep this parameterized GET after every named Outreach sub-route so
  // "templates", "sequences", and "history" can never be parsed as record IDs.
  app.get("/api/outreach/:messageId", authenticated, read, asyncRoute(async (request, response) => {
    response.json(await getOutreachMessage(
      database, request.identity!.workspaceId, uuidSchema.parse(request.params.messageId)
    ));
  }));
}
