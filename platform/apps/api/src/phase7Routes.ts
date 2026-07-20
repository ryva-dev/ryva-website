import { createHash } from "node:crypto";
import type { Express, RequestHandler } from "express";
import { z } from "zod";
import type { AppConfig } from "../../../packages/config/src/index.js";
import type { Database } from "../../../packages/database/src/index.js";
import {
  aiUseCases,
  disposeAiSuggestion,
  generateAiSuggestion,
  getAiOperationalStatus,
  getAiSuggestion,
  listAiSuggestions,
  setAiOperationalStatus,
  type AiProvider
} from "../../../packages/domain/src/index.js";
import { AppError, uuidSchema } from "../../../packages/shared/src/index.js";
import { asyncRoute } from "./middleware.js";
import type { ObjectStorage } from "./providers.js";
import "./types.js";

type RouteDependencies = {
  app: Express;
  database: Database;
  configuration: AppConfig;
  aiProvider: AiProvider;
  objectStorage: ObjectStorage;
  authenticated: RequestHandler;
  csrf: RequestHandler;
  read: RequestHandler;
  write: RequestHandler;
  mfa: RequestHandler;
  adminManage: RequestHandler;
};

const useCaseSchema = z.enum(aiUseCases);
const generationSchema = z.object({
  useCase: useCaseSchema,
  targetType: z.string().trim().min(1).max(120),
  targetId: uuidSchema,
  instruction: z.string().trim().max(4_000).default("")
});

const actionSchema = z.object({
  version: z.number().int().positive(),
  action: z.enum(["accepted","edited","rejected","feedback","reported_problem"]),
  finalContent: z.string().trim().min(1).max(50_000).nullable().optional(),
  reasonCategory: z.string().trim().max(120).nullable().optional(),
  note: z.string().trim().max(4_000).default(""),
  selectedFields: z.array(z.string().trim().min(1).max(200)).max(100).default([])
});

export async function loadDocumentAiAttachment(
  database: Database,
  storage: ObjectStorage,
  workspaceId: string,
  documentId: string
) {
  const result = await database.query<{
    name: string;
    mediaType: string;
    byteSize: string;
    storageKey: string;
    sha256: string;
    status: string;
    scanStatus: string;
  }>(
    `SELECT name,media_type AS "mediaType",byte_size::text AS "byteSize",
            storage_key AS "storageKey",sha256,status,scan_status AS "scanStatus"
       FROM documents WHERE workspace_id=$1 AND id=$2`,
    [workspaceId, documentId]
  );
  const document = result.rows[0];
  if (!document) throw new AppError(404, "document_not_found", "Document not found.");
  if (document.status !== "active" || document.scanStatus !== "clean") {
    throw new AppError(409, "document_not_safe", "Only an active, clean document can be processed.");
  }
  if (Number(document.byteSize) > 15 * 1024 * 1024) {
    throw new AppError(
      413,
      "ai_document_too_large",
      "This document exceeds the AI processing limit. Manual extraction remains available."
    );
  }
  const content = await storage.readForProcessing(document.storageKey);
  const actualHash = createHash("sha256").update(content).digest("hex");
  if (actualHash !== document.sha256) {
    throw new AppError(409, "document_integrity_failed", "Document integrity verification failed.");
  }
  return {
    name: document.name,
    mediaType: document.mediaType,
    sha256: document.sha256,
    contentBase64: content.toString("base64")
  };
}

export function registerPhase7Routes(dependencies: RouteDependencies): void {
  const {
    app, database, configuration, aiProvider, objectStorage,
    authenticated, csrf, read, write, mfa, adminManage
  } = dependencies;

  app.get("/api/ai/status", authenticated, read, asyncRoute(async (request, response) => {
    const status = await getAiOperationalStatus(database, aiProvider);
    const settings = await database.query<{ aiPreferences: Record<string, unknown> }>(
      `SELECT ai_preferences AS "aiPreferences" FROM workspace_settings WHERE workspace_id=$1`,
      [request.identity!.workspaceId]
    );
    response.json({
      ...status,
      workspacePreferences: settings.rows[0]?.aiPreferences ?? { enabled: false }
    });
  }));

  app.get("/api/ai/suggestions", authenticated, read, asyncRoute(async (request, response) => {
    const filters = z.object({
      status: z.enum(["generated","accepted","edited","rejected","expired"]).optional(),
      targetType: z.string().trim().max(120).optional(),
      targetId: uuidSchema.optional(),
      useCase: useCaseSchema.optional(),
      limit: z.coerce.number().int().min(1).max(200).default(100)
    }).parse(request.query);
    response.json({
      suggestions: await listAiSuggestions(database, request.identity!.workspaceId, filters)
    });
  }));

  app.get("/api/ai/suggestions/:suggestionId", authenticated, read, asyncRoute(async (request, response) => {
    const suggestionId = uuidSchema.parse(request.params.suggestionId);
    response.json(await getAiSuggestion(database, request.identity!.workspaceId, suggestionId));
  }));

  app.post("/api/ai/generate", authenticated, write, csrf, asyncRoute(async (request, response) => {
    const input = generationSchema.parse(request.body);
    const attachment = input.useCase === "document_extraction"
      ? await loadDocumentAiAttachment(
          database, objectStorage, request.identity!.workspaceId, input.targetId
        )
      : undefined;
    const suggestion = await generateAiSuggestion(database, aiProvider, {
      workspaceId: request.identity!.workspaceId,
      actorUserId: request.identity!.userId,
      requestId: request.requestId,
      useCase: input.useCase,
      targetType: input.targetType,
      targetId: input.targetId,
      instruction: input.instruction,
      maxContextItems: configuration.AI_MAX_CONTEXT_ITEMS,
      attachment
    });
    response.status(201).json(suggestion);
  }));

  app.post(
    "/api/ai/suggestions/:suggestionId/actions",
    authenticated,
    write,
    csrf,
    asyncRoute(async (request, response) => {
      const suggestionId = uuidSchema.parse(request.params.suggestionId);
      const input = actionSchema.parse(request.body);
      response.json(await disposeAiSuggestion(database, {
        workspaceId: request.identity!.workspaceId,
        actorUserId: request.identity!.userId,
        requestId: request.requestId,
        suggestionId,
        ...input
      }));
    })
  );

  app.post(
    "/api/ai/suggestions/:suggestionId/regenerate",
    authenticated,
    write,
    csrf,
    asyncRoute(async (request, response) => {
      const suggestionId = uuidSchema.parse(request.params.suggestionId);
      const input = z.object({
        instruction: z.string().trim().min(1).max(4_000)
      }).parse(request.body);
      const current = await getAiSuggestion(
        database, request.identity!.workspaceId, suggestionId
      );
      const suggestion = current.suggestion as Record<string, unknown>;
      const regenerated = await generateAiSuggestion(database, aiProvider, {
        workspaceId: request.identity!.workspaceId,
        actorUserId: request.identity!.userId,
        requestId: request.requestId,
        useCase: useCaseSchema.parse(suggestion.suggestionType),
        targetType: z.string().parse(suggestion.targetType),
        targetId: uuidSchema.parse(suggestion.targetId),
        instruction: input.instruction,
        maxContextItems: configuration.AI_MAX_CONTEXT_ITEMS,
        regenerationParentId: suggestionId,
        attachment: suggestion.suggestionType === "document_extraction"
          ? await loadDocumentAiAttachment(
              database, objectStorage, request.identity!.workspaceId,
              uuidSchema.parse(suggestion.targetId)
            )
          : undefined
      });
      response.status(201).json(regenerated);
    })
  );

  app.post(
    "/api/admin/ai-control",
    authenticated,
    mfa,
    adminManage,
    csrf,
    asyncRoute(async (request, response) => {
      const input = z.object({
        enabled: z.boolean(),
        reason: z.string().trim().min(10).max(2_000)
      }).parse(request.body);
      response.json(await setAiOperationalStatus(database, {
        actorUserId: request.identity!.userId,
        requestId: request.requestId,
        ...input
      }));
    })
  );
}
