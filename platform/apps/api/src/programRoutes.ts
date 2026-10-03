import type { Express, RequestHandler } from "express";
import { z } from "zod";
import type { AppConfig } from "../../../packages/config/src/index.js";
import type { Database } from "../../../packages/database/src/index.js";
import {
  getAccessDecision,
  getProgramDashboard,
  getProgramItem,
  getProgramModule,
  startProgramItem,
  completeProgramItem,
  submitProgramActivity
} from "../../../packages/domain/src/index.js";
import { brandPlacementLibrary, type ProgramDefinition } from "../../../packages/program-content/src/index.js";
import { asyncRoute } from "./middleware.js";

const identifierSchema = z.string().trim().min(1).max(160).regex(/^[a-z0-9-]+$/);
const responseValueSchema = z.union([
  z.string().max(10_000),
  z.array(z.string().max(200)).max(100)
]);
const submissionSchema = z.object({
  steps: z.record(
    z.string().max(120),
    z.record(z.string().max(120), responseValueSchema)
  )
});

type ProgramRouteDependencies = {
  app: Express;
  database: Database;
  configuration: AppConfig;
  program: ProgramDefinition;
  authenticated: RequestHandler;
  csrf: RequestHandler;
  read: RequestHandler;
  write: RequestHandler;
  mutationRateLimit: RequestHandler;
};

export function registerProgramRoutes({
  app,
  database,
  configuration,
  program,
  authenticated,
  csrf,
  read,
  write,
  mutationRateLimit
}: ProgramRouteDependencies): void {
  app.get(
    "/api/program",
    authenticated,
    read,
    asyncRoute(async (request, response) => {
      response.json(await getProgramDashboard(database, program, request.identity!.userId));
    })
  );

  app.get(
    "/api/program/progress",
    authenticated,
    read,
    asyncRoute(async (request, response) => {
      const dashboard = await getProgramDashboard(database, program, request.identity!.userId);
      response.json({
        progress: dashboard.progress,
        modules: dashboard.modules.map(({ id, slug, state, requiredItems, completedRequiredItems }) => ({
          id,
          slug,
          state,
          requiredItems,
          completedRequiredItems
        })),
        finalSimulation: dashboard.finalSimulation,
        programCompletedAt: dashboard.programCompletedAt
      });
    })
  );

  app.get(
    "/api/program/library",
    authenticated,
    read,
    (_request, response) => {
      response.json({ resources: brandPlacementLibrary });
    }
  );

  app.get(
    "/api/program/modules/:moduleId",
    authenticated,
    read,
    asyncRoute(async (request, response) => {
      response.json(await getProgramModule(
        database,
        program,
        request.identity!.userId,
        identifierSchema.parse(request.params.moduleId)
      ));
    })
  );

  app.get(
    "/api/program/items/:itemId",
    authenticated,
    read,
    asyncRoute(async (request, response) => {
      response.json(await getProgramItem(
        database,
        program,
        request.identity!.userId,
        identifierSchema.parse(request.params.itemId)
      ));
    })
  );

  app.post(
    "/api/program/items/:itemId/start",
    authenticated,
    mutationRateLimit,
    read,
    write,
    csrf,
    asyncRoute(async (request, response) => {
      const progress = await startProgramItem(database, program, {
        userId: request.identity!.userId,
        workspaceId: request.identity!.workspaceId,
        requestId: request.requestId
      }, identifierSchema.parse(request.params.itemId));
      response.json({ progress });
    })
  );

  app.post(
    "/api/program/items/:itemId/complete",
    authenticated,
    mutationRateLimit,
    read,
    write,
    csrf,
    asyncRoute(async (request, response) => {
      const result = await completeProgramItem(database, configuration, program, {
        userId: request.identity!.userId,
        workspaceId: request.identity!.workspaceId,
        requestId: request.requestId
      }, identifierSchema.parse(request.params.itemId));
      response.json({
        ...result,
        access: await getAccessDecision(
          database,
          request.identity!.userId,
          request.identity!.workspaceId
        )
      });
    })
  );

  app.post(
    "/api/program/items/:itemId/submissions",
    authenticated,
    mutationRateLimit,
    read,
    write,
    csrf,
    asyncRoute(async (request, response) => {
      const result = await submitProgramActivity(database, configuration, program, {
        userId: request.identity!.userId,
        workspaceId: request.identity!.workspaceId,
        requestId: request.requestId
      }, identifierSchema.parse(request.params.itemId), submissionSchema.parse(request.body));
      response.status(201).json({
        ...result,
        access: await getAccessDecision(
          database,
          request.identity!.userId,
          request.identity!.workspaceId
        )
      });
    })
  );
}
