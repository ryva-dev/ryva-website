import type { Express, RequestHandler } from "express";
import { z } from "zod";
import type { Database } from "../../../packages/database/src/index.js";
import {
  acknowledgeHome,
  actOnPriority,
  createAnalyticsForecast,
  createReportDefinition,
  exportAnalyticsReport,
  getAnalyticsDashboard,
  getHomeCommandCenter,
  metricDictionary,
  refreshAnalyticsAlerts,
  selectOutreachAnalyticsClaim
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
  exportRequest: RequestHandler;
};

const filters = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  brandId: uuidSchema.optional(),
  productId: uuidSchema.optional(),
  businessId: uuidSchema.optional(),
  stage: z.string().trim().max(100).optional(),
  channel: z.enum(["email","social"]).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional()
});

const reportTypes = z.enum([
  "representative_activity","pipeline","product_performance","brand_performance",
  "buyer_performance","accounts","orders","reorders","commissions","disputes",
  "portfolio_health","outreach_health"
]);

export function registerPhase8Routes({
  app,database,authenticated,csrf,read,write,exportRequest
}:RouteDependencies):void {
  app.get("/api/home-command-center",authenticated,read,asyncRoute(async(request,response)=>{
    response.json(await getHomeCommandCenter(
      database,request.identity!.workspaceId,request.identity!.userId
    ));
  }));

  app.post("/api/home/acknowledge",authenticated,csrf,write,asyncRoute(async(request,response)=>{
    await acknowledgeHome(database,{
      workspaceId:request.identity!.workspaceId,userId:request.identity!.userId,
      requestId:request.requestId
    });
    response.status(204).end();
  }));

  app.post("/api/home/priorities/:itemType/:itemId/actions",authenticated,csrf,write,
    asyncRoute(async(request,response)=>{
      const input=z.object({
        action:z.enum(["completed","snoozed","dismissed","reprioritized","restored"]),
        reason:z.string().trim().min(3).max(2000),
        snoozedUntil:z.string().datetime().nullable().optional(),
        manualPriority:z.enum(["low","medium","high","critical"]).nullable().optional()
      }).parse(request.body);
      await actOnPriority(database,{
        workspaceId:request.identity!.workspaceId,userId:request.identity!.userId,
        requestId:request.requestId,itemType:z.string().trim().min(1).max(100).parse(request.params.itemType),
        itemId:z.string().trim().min(1).max(200).parse(request.params.itemId),...input
      });
      response.json(await getHomeCommandCenter(
        database,request.identity!.workspaceId,request.identity!.userId
      ));
    })
  );

  app.get("/api/analytics/definitions",authenticated,read,(_request,response)=>{
    response.json({definitions:metricDictionary});
  });

  app.get("/api/analytics",authenticated,read,asyncRoute(async(request,response)=>{
    response.json(await getAnalyticsDashboard(
      database,request.identity!.workspaceId,filters.parse(request.query)
    ));
  }));

  app.post("/api/analytics/forecasts",authenticated,csrf,write,asyncRoute(async(request,response)=>{
    const input=z.object({
      targetType:z.enum(["placement_opportunity","account","reorder"]),
      targetId:uuidSchema,currency:z.string().regex(/^[A-Z]{3}$/),
      lowAmount:z.string().regex(/^\d+(?:\.\d{1,2})?$/),
      baseAmount:z.string().regex(/^\d+(?:\.\d{1,2})?$/),
      highAmount:z.string().regex(/^\d+(?:\.\d{1,2})?$/),
      qualitativeLikelihood:z.enum(["early","possible","supported","strong"]),
      horizonStartsOn:z.string().date(),horizonEndsOn:z.string().date(),
      evidenceIds:z.array(uuidSchema).min(1).max(100),
      assumptions:z.array(z.string().trim().min(1).max(1000)).min(1).max(30),
      limitations:z.array(z.string().trim().min(1).max(1000)).min(1).max(30)
    }).parse(request.body);
    response.status(201).json({forecast:await createAnalyticsForecast(database,{
      workspaceId:request.identity!.workspaceId,userId:request.identity!.userId,
      requestId:request.requestId,...input
    })});
  }));

  app.post("/api/analytics/alerts/refresh",authenticated,csrf,write,asyncRoute(async(request,response)=>{
    response.json(await refreshAnalyticsAlerts(database,{
      workspaceId:request.identity!.workspaceId,userId:request.identity!.userId,
      requestId:request.requestId
    }));
  }));

  app.get("/api/analytics/reports",authenticated,read,asyncRoute(async(request,response)=>{
    const result=await database.query(
      `SELECT id,name,report_type AS "reportType",filters,columns,schedule,status,version,
              updated_at AS "updatedAt"
         FROM analytics_report_definitions
        WHERE workspace_id=$1 AND owner_user_id=$2 AND status='active' ORDER BY name`,
      [request.identity!.workspaceId,request.identity!.userId]
    );
    response.json({reports:result.rows});
  }));

  app.post("/api/analytics/reports",authenticated,csrf,write,asyncRoute(async(request,response)=>{
    const input=z.object({
      name:z.string().trim().min(1).max(200),reportType:reportTypes,
      filters:z.record(z.string(),z.unknown()).default({}),
      columns:z.array(z.string().trim().min(1).max(100)).max(100).default([])
    }).parse(request.body);
    response.status(201).json({report:await createReportDefinition(database,{
      workspaceId:request.identity!.workspaceId,userId:request.identity!.userId,
      requestId:request.requestId,...input
    })});
  }));

  app.get("/api/analytics/export",authenticated,exportRequest,asyncRoute(async(request,response)=>{
    const input=z.object({reportType:reportTypes}).merge(filters).parse(request.query);
    const result=await exportAnalyticsReport(database,{
      workspaceId:request.identity!.workspaceId,userId:request.identity!.userId,
      requestId:request.requestId,reportType:input.reportType,filters:input
    });
    response.setHeader("content-type","text/csv; charset=utf-8");
    response.setHeader("content-disposition",`attachment; filename="ryva-${input.reportType}-${result.runId}.csv"`);
    response.send(result.csv);
  }));

  app.post("/api/outreach/:messageId/analytics-claims",authenticated,csrf,write,
    asyncRoute(async(request,response)=>{
      const input=z.object({
        metricCode:z.string().trim().min(1).max(120),
        claimText:z.string().trim().min(1).max(5000),
        sourceRecordType:z.string().trim().min(1).max(120),
        sourceRecordId:uuidSchema,
        evidenceId:uuidSchema.nullable().optional(),
        externalObservationId:uuidSchema.nullable().optional()
      }).parse(request.body);
      response.status(201).json({claim:await selectOutreachAnalyticsClaim(database,{
        workspaceId:request.identity!.workspaceId,userId:request.identity!.userId,
        requestId:request.requestId,messageId:uuidSchema.parse(request.params.messageId),...input
      })});
    })
  );

  app.get("/api/analytics/future-model-contract",authenticated,read,(_request,response)=>{
    response.json({
      status:"interfaces_only",
      executionEnabled:false,
      predictions:[],
      contract:{
        input:["authorized records","evidence IDs","source freshness","data-lineage versions"],
        output:["model version","model inference classification","confidence","explanation","limitations"],
        governance:["human review status","monitoring references","rollback control","training-data permitted use"]
      }
    });
  });
}
