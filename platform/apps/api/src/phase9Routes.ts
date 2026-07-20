import { parse as parseCsv } from "csv-parse/sync";
import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { strToU8, zipSync } from "fflate";
import type { AppConfig } from "../../../packages/config/src/index.js";
import type { Database } from "../../../packages/database/src/index.js";
import { withTransaction } from "../../../packages/database/src/index.js";
import {
  approveAndCommitImport,
  confirmRecordMerge,
  createControlledImport,
  downloadWorkspaceExport,
  duplicateCandidates,
  exportScopes,
  generateWorkspaceExport,
  getWorkspaceExport,
  getControlledImport,
  importRecordTypes,
  previewRecordMerge,
  publicDigest,
  recordAudit,
  reverseRecordMerge
} from "../../../packages/domain/src/index.js";
import { AppError, newId, uuidSchema } from "../../../packages/shared/src/index.js";
import { asyncRoute } from "./middleware.js";
import "./types.js";

type Dependencies={
  app:Express;database:Database;configuration:AppConfig;
  authenticated:RequestHandler;csrf:RequestHandler;read:RequestHandler;write:RequestHandler;
  exportRequest:RequestHandler;mfa:RequestHandler;admin:RequestHandler;
};

const importType=z.enum(importRecordTypes);
const required:Record<string,string[]>={
  brand:["name"],product:["name","category","brandId"],
  business:["name","businessType","category"],
  contact:["name","role","parentType","parentId"],
  business_buyer:["contactId","businessId","buyerRole"],
  source:["sourceType","reference"],
  evidence:["subjectType","subjectId","exactClaim","evidenceClass"],
  task:["subjectType","subjectId","title"],
  representation_opportunity:["brandId"],
  placement_opportunity:["brandId","businessId","productIds"],
  protected_account:["brandId","businessId","agreementId"],
  order:["orderNumber","brandId","businessId","currency","wholesaleGross"],
  reorder:["accountId","priorOrderId"],
  commission:["orderId","agreementId","currency","expectedAmount"]
};
const allowed:Record<string,Set<string>>=Object.fromEntries(Object.entries({
  brand:["name","legalName","website"],
  product:["name","category","brandId","summary"],
  business:["name","legalName","businessType","category","website"],
  contact:["name","role","parentType","parentId","email","phone"],
  business_buyer:["contactId","businessId","buyerRole","decisionContext","authorityEvidence"],
  source:["sourceType","reference","url","ownerOrProvider"],
  evidence:["subjectType","subjectId","exactClaim","evidenceClass","sourceId","observedAt","limitations"],
  task:["subjectType","subjectId","title","priority","dueAt"],
  representation_opportunity:["brandId","productIds","brandContactId","proposedChannels","proposedTerritory"],
  placement_opportunity:["brandId","businessId","productIds","channel","territory","fitRationale"],
  protected_account:["brandId","businessId","agreementId","scopeSummary","protectionStartsOn","protectionEndsOn"],
  order:["orderNumber","brandId","businessId","agreementId","accountId","currency","wholesaleGross","orderDate","sourceReference"],
  reorder:["accountId","priorOrderId","expectedWindowStartsOn","expectedWindowEndsOn","nextAction"],
  commission:["orderId","agreementId","accountId","currency","expectedAmount","commissionRate","calculationBasis"]
}).map(([key,fields])=>[key,new Set(fields)]));

const mergeType=z.enum([
  "product","brand","business","contact","business_buyer",
  "representation_opportunity","placement_opportunity","protected_account","order"
]);

function providerReadiness(configuration:AppConfig){
  return [
    {key:"database_tls",configured:configuration.PGSSL!=="disable",required:true},
    {key:"certification",configured:Boolean(configuration.CREDENTIAL_API_URL&&configuration.CREDENTIAL_API_TOKEN),required:true},
    {key:"billing",configured:Boolean(configuration.STRIPE_SECRET_KEY&&configuration.STRIPE_WEBHOOK_SECRET&&configuration.STRIPE_PRICE_ID),required:true},
    {key:"email",configured:Boolean(configuration.EMAIL_PROVIDER_URL&&configuration.EMAIL_PROVIDER_TOKEN&&configuration.EMAIL_WEBHOOK_SECRET&&configuration.EMAIL_FROM_ADDRESS),required:true},
    {key:"object_storage",configured:configuration.STORAGE_DRIVER==="s3"&&Boolean(configuration.S3_BUCKET&&configuration.S3_REGION),required:true},
    {key:"malware_scanner",configured:Boolean(configuration.MALWARE_SCANNER_WEBHOOK_SECRET),required:true},
    {key:"ai",configured:Boolean(configuration.AI_GENERATION_ENABLED&&configuration.AI_PROVIDER_URL&&configuration.AI_PROVIDER_TOKEN),required:false},
    {key:"intelligence",configured:Boolean(configuration.INTELLIGENCE_API_URL&&configuration.INTELLIGENCE_API_TOKEN),required:false}
  ].map(item=>({...item,status:item.configured?"available":"not_configured"}));
}

function csvCell(value:unknown):string{
  let text:string;
  if(value===null||value===undefined) text="";
  else if(typeof value==="string") text=value;
  else if(typeof value==="number"||typeof value==="boolean"||typeof value==="bigint") text=`${value}`;
  else if(typeof value==="object") text=JSON.stringify(value);
  else text="";
  if(/^[=+\-@]/.test(text)) text=`'${text}`;
  return `"${text.replaceAll('"','""')}"`;
}
function rowsToCsv(rows:unknown[]):string{
  const records=rows.filter((row):row is Record<string,unknown>=>Boolean(row)&&typeof row==="object"&&!Array.isArray(row));
  const headers=[...new Set(records.flatMap(record=>Object.keys(record)))];
  return [headers.map(csvCell).join(","),...records.map(record=>headers.map(key=>csvCell(record[key])).join(","))].join("\r\n");
}

export function registerPhase9Routes({
  app,database,configuration,authenticated,csrf,read,write,exportRequest,mfa,admin
}:Dependencies):void{
  app.post("/api/data-imports/preview",authenticated,csrf,write,asyncRoute(async(request,response)=>{
    const input=z.object({
      recordType:importType,sourceName:z.string().trim().min(1).max(240),
      sourceId:uuidSchema.nullable().optional(),observedAt:z.string().datetime().nullable().optional(),
      csv:z.string().min(1).max(1_000_000),mapping:z.record(z.string(),z.string()),
      idempotencyKey:z.string().trim().min(8).max(200)
    }).parse(request.body);
    if(input.observedAt&&new Date(input.observedAt).getTime()>Date.now()+300_000){
      throw new AppError(422,"import_observed_time_invalid","Import observation time cannot be in the future.");
    }
    if(input.sourceId){
      const source=await database.query(
        `SELECT id FROM sources WHERE workspace_id=$1 AND id=$2 AND status='active'`,
        [request.identity!.workspaceId,input.sourceId]
      );
      if(!source.rowCount) throw new AppError(422,"import_source_invalid","The selected Source is unavailable.");
    }
    const unsupported=Object.values(input.mapping).filter(field=>!allowed[input.recordType]!.has(field));
    if(unsupported.length){
      throw new AppError(422,"import_mapping_invalid",`Unsupported mapped fields: ${[...new Set(unsupported)].join(", ")}.`);
    }
    const parsed=parseCsv<Record<string,string>>(input.csv,{
      columns:true,skip_empty_lines:true,trim:true,bom:true,relax_column_count:false,to:5001
    });
    if(parsed.length>5000) throw new AppError(413,"import_too_large","An import may contain at most 5,000 rows.");
    const rows=[];
    for(const [index,raw] of parsed.entries()){
      const normalized:Record<string,string>={};
      for(const [sourceColumn,targetField] of Object.entries(input.mapping)){
        normalized[targetField]=raw[sourceColumn]??"";
      }
      const errors=required[input.recordType]!
        .filter(field=>!normalized[field]).map(field=>`${field} is required`);
      if(normalized.website&&!z.string().url().safeParse(normalized.website).success) errors.push("website must be a valid URL");
      if(normalized.url&&!z.string().url().safeParse(normalized.url).success) errors.push("url must be a valid URL");
      if(input.recordType==="contact"&&!["brand","business"].includes(normalized.parentType??"")){
        errors.push("parentType must be brand or business");
      }
      if(normalized.currency&&!/^[A-Z]{3}$/.test(normalized.currency)) errors.push("currency must be an uppercase ISO code");
      const candidates=["brand","product","business","contact"].includes(input.recordType)&&normalized.name&&index<500
        ?await duplicateCandidates(database,request.identity!.workspaceId,
          input.recordType as "brand"|"product"|"business"|"contact",normalized.name)
        :[];
      rows.push({rowNumber:index+2,raw,normalized,errors,duplicateCandidates:candidates});
    }
    const result=await createControlledImport(database,{
      workspaceId:request.identity!.workspaceId,userId:request.identity!.userId,
      requestId:request.requestId,recordType:input.recordType,sourceName:input.sourceName,
      sourceId:input.sourceId??null,observedAt:input.observedAt??null,sourceDigest:publicDigest(input.csv),
      mapping:input.mapping,rows,idempotencyKey:input.idempotencyKey
    });
    response.status(result.replayed?200:201).json(result);
  }));

  app.get("/api/data-imports/:importId",authenticated,read,asyncRoute(async(request,response)=>{
    response.json(await getControlledImport(database,request.identity!.workspaceId,
      uuidSchema.parse(request.params.importId)));
  }));
  app.get("/api/data-imports/:importId/report",authenticated,read,asyncRoute(async(request,response)=>{
    const importId=uuidSchema.parse(request.params.importId);
    const detail=await getControlledImport(database,request.identity!.workspaceId,importId);
    const csv=rowsToCsv(detail.rows.map(row=>{
      const item=row as Record<string,unknown>;
      return {
        rowNumber:item.rowNumber,proposedAction:item.proposedAction,
        committedAction:item.committedAction,targetType:item.targetType,targetId:item.targetId,
        errors:Array.isArray(item.errors)?item.errors.join("; "):item.errors,
        safeError:item.safeError
      };
    }));
    response.setHeader("content-type","text/csv; charset=utf-8");
    response.setHeader("content-disposition",`attachment; filename="ryva-import-${importId}-report.csv"`);
    response.send(csv);
  }));

  app.post("/api/data-imports/:importId/approve",authenticated,csrf,write,asyncRoute(async(request,response)=>{
    const input=z.object({
      reason:z.string().trim().min(10).max(2000),sourceDigest:z.string().length(64),
      expectedRowCount:z.number().int().nonnegative(),expectedCreateCount:z.number().int().nonnegative(),
      expectedReviewCount:z.number().int().nonnegative(),
      confirmation:z.literal("APPROVE IMPORT")
    }).parse(request.body);
    response.json(await approveAndCommitImport(database,{
      workspaceId:request.identity!.workspaceId,userId:request.identity!.userId,
      requestId:request.requestId,importId:uuidSchema.parse(request.params.importId),...input
    }));
  }));

  app.post("/api/duplicate-merges/preview",authenticated,csrf,write,asyncRoute(async(request,response)=>{
    const input=z.object({recordType:mergeType,survivorId:uuidSchema,duplicateId:uuidSchema}).parse(request.body);
    response.json(await previewRecordMerge(database,{workspaceId:request.identity!.workspaceId,...input}));
  }));
  app.post("/api/duplicate-merges/confirm",authenticated,csrf,write,asyncRoute(async(request,response)=>{
    const input=z.object({
      recordType:mergeType,survivorId:uuidSchema,duplicateId:uuidSchema,
      reason:z.string().trim().min(10).max(2000),confirmation:z.literal("MERGE RECORDS")
    }).parse(request.body);
    response.status(201).json(await confirmRecordMerge(database,{
      workspaceId:request.identity!.workspaceId,userId:request.identity!.userId,
      requestId:request.requestId,recordType:input.recordType,
      survivorId:input.survivorId,duplicateId:input.duplicateId,reason:input.reason
    }));
  }));
  app.get("/api/record-aliases/:recordType/:recordId",authenticated,read,asyncRoute(async(request,response)=>{
    const type=mergeType.parse(request.params.recordType);
    const id=uuidSchema.parse(request.params.recordId);
    const result=await database.query(
      `SELECT canonical_id AS "canonicalId",merge_review_id AS "mergeReviewId"
       FROM record_aliases WHERE workspace_id=$1 AND record_type=$2 AND alias_id=$3`,
      [request.identity!.workspaceId,type,id]
    );
    response.json(result.rows[0]??{canonicalId:id,mergeReviewId:null});
  }));
  app.post("/api/duplicate-merges/:mergeReviewId/reverse",authenticated,csrf,write,
    asyncRoute(async(request,response)=>{
      const input=z.object({
        reason:z.string().trim().min(10).max(2000),confirmation:z.literal("REVERSE MERGE")
      }).parse(request.body);
      response.json(await reverseRecordMerge(database,{
        workspaceId:request.identity!.workspaceId,userId:request.identity!.userId,
        requestId:request.requestId,mergeReviewId:uuidSchema.parse(request.params.mergeReviewId),
        reason:input.reason
      }));
    })
  );

  app.get("/api/data-exports/capabilities",authenticated,exportRequest,(_request,response)=>{
    response.json({scopes:exportScopes,formats:["json","csv_bundle"],
      documentPolicy:"Metadata is exportable. Document bytes require a separately authorized object-storage package."});
  });
  app.post("/api/data-exports",authenticated,csrf,exportRequest,asyncRoute(async(request,response)=>{
    const input=z.object({
      scopes:z.array(z.enum(exportScopes as [string,...string[]])).min(1).max(exportScopes.length),
      format:z.enum(["json","csv_bundle"]),includeDocuments:z.boolean().default(false)
    }).parse(request.body);
    response.status(202).json(await generateWorkspaceExport(database,{
      workspaceId:request.identity!.workspaceId,userId:request.identity!.userId,
      requestId:request.requestId,...input
    }));
  }));
  app.get("/api/data-exports/:exportId/download",authenticated,exportRequest,asyncRoute(async(request,response)=>{
    const exportId=uuidSchema.parse(request.params.exportId);
    const result=await downloadWorkspaceExport(database,{
      workspaceId:request.identity!.workspaceId,userId:request.identity!.userId,
      exportId
    });
    response.setHeader("x-content-sha256",result.digest);
    if(result.format==="csv_bundle"){
      const files:Record<string,Uint8Array>={
        "manifest.json":strToU8(JSON.stringify(result.manifest,null,2))
      };
      for(const [scope,value] of Object.entries(result.payload)){
        if(scope==="_manifest"||!Array.isArray(value)) continue;
        files[`${scope}.csv`]=strToU8(rowsToCsv(value));
      }
      response.setHeader("content-type","application/zip");
      response.setHeader("content-disposition",`attachment; filename="ryva-export-${exportId}.zip"`);
      response.send(Buffer.from(zipSync(files,{level:6})));
    }else{
      response.setHeader("content-type","application/json; charset=utf-8");
      response.setHeader("content-disposition",`attachment; filename="ryva-export-${exportId}.json"`);
      response.send(JSON.stringify(result.payload,null,2));
    }
  }));
  app.get("/api/data-exports/:exportId",authenticated,exportRequest,asyncRoute(async(request,response)=>{
    response.json(await getWorkspaceExport(database,{
      workspaceId:request.identity!.workspaceId,userId:request.identity!.userId,
      exportId:uuidSchema.parse(request.params.exportId)
    }));
  }));

  app.get("/api/admin/operational-status",authenticated,mfa,admin,asyncRoute(async(_request,response)=>{
    const providers=providerReadiness(configuration);
    const [jobs,users,holds,imports,exports]=await Promise.all([
      database.query<{status:string;count:number}>(`SELECT status,count(*)::int AS count FROM durable_jobs GROUP BY status`),
      database.query<{status:string;count:number}>(`SELECT status,count(*)::int AS count FROM users GROUP BY status`),
      database.query<{count:number}>(`SELECT count(*)::int AS count FROM legal_holds WHERE status='active'`),
      database.query<{status:string;count:number}>(`SELECT status,count(*)::int AS count FROM import_previews GROUP BY status`),
      database.query<{status:string;count:number}>(`SELECT status,count(*)::int AS count FROM data_export_requests GROUP BY status`)
    ]);
    response.json({providers,jobs:jobs.rows,users:users.rows,activeLegalHolds:holds.rows[0]?.count??0,
      imports:imports.rows,exports:exports.rows,
      controls:{supportImpersonation:false,autonomousSend:false,autonomousApproval:false}});
  }));

  app.post("/api/admin/feature-controls",authenticated,mfa,csrf,admin,asyncRoute(async(request,response)=>{
    const input=z.object({
      workspaceId:uuidSchema.nullable().optional(),controlKey:z.string().regex(/^[a-z0-9_.-]{3,120}$/),
      enabled:z.boolean(),reason:z.string().trim().min(10).max(2000)
    }).parse(request.body);
    const id=newId();
    await database.query(
      `INSERT INTO feature_controls(id,workspace_id,control_key,enabled,reason,changed_by)
       VALUES($1,$2,$3,$4,$5,$6)
       ON CONFLICT(workspace_id,control_key) DO UPDATE SET enabled=excluded.enabled,
       reason=excluded.reason,changed_by=excluded.changed_by,changed_at=now()`,
      [id,input.workspaceId??null,input.controlKey,input.enabled,input.reason,request.identity!.userId]
    );
    await recordAudit(database,{
      workspaceId:input.workspaceId??request.identity!.workspaceId,actorUserId:request.identity!.userId,
      actorType:"user",action:"feature_control.changed",targetType:"feature_control",
      targetId:input.controlKey,origin:"admin_api",requestId:request.requestId,outcome:"succeeded",
      metadata:{enabled:input.enabled,reason:input.reason}
    });
    response.status(201).json({controlKey:input.controlKey,enabled:input.enabled});
  }));

  app.get("/api/admin/access-directory",authenticated,mfa,admin,asyncRoute(async(request,response)=>{
    const email=z.string().email().parse(request.query.email);
    const result=await database.query(
      `SELECT u.id,u.email,u.name,u.status,u.email_verified_at AS "emailVerifiedAt",
              wm.id AS "membershipId",wm.workspace_id AS "workspaceId",
              w.name AS "workspaceName",w.status AS "workspaceStatus",
              wm.role,wm.status AS "membershipStatus",
              cc.status AS "credentialStatus",cc.expires_at AS "credentialExpiresAt",
              se.status AS "subscriptionStatus",se.current_period_end AS "subscriptionPeriodEnd"
         FROM users u
         LEFT JOIN workspace_memberships wm ON wm.user_id=u.id
         LEFT JOIN workspaces w ON w.id=wm.workspace_id
         LEFT JOIN LATERAL (
           SELECT status,expires_at FROM certification_credentials
           WHERE user_id=u.id ORDER BY verified_at DESC LIMIT 1
         ) cc ON true
         LEFT JOIN subscription_entitlements se ON se.user_id=u.id
        WHERE lower(u.email)=lower($1) ORDER BY wm.created_at`,
      [email]
    );
    response.json({users:result.rows});
  }));

  app.patch("/api/admin/users/:userId/status",authenticated,mfa,csrf,admin,
    asyncRoute(async(request,response)=>{
      const userId=uuidSchema.parse(request.params.userId);
      const input=z.object({
        status:z.enum(["active","disabled"]),reason:z.string().trim().min(10).max(2000)
      }).parse(request.body);
      if(userId===request.identity!.userId&&input.status==="disabled"){
        throw new AppError(409,"admin_self_disable_denied","Use a second authorized administrator for this action.");
      }
      await withTransaction(database,async(transaction)=>{
        const result=await transaction.query(
          `UPDATE users SET status=$2,version=version+1,updated_at=now()
           WHERE id=$1 AND status<>'deleted'`,[userId,input.status]
        );
        if(!result.rowCount) throw new AppError(404,"user_not_found","User not found.");
        if(input.status==="disabled"){
          await transaction.query(
            `UPDATE sessions SET revoked_at=now(),revoked_reason='admin_user_disabled'
             WHERE user_id=$1 AND revoked_at IS NULL`,[userId]
          );
        }
        await recordAudit(transaction,{
          workspaceId:request.identity!.workspaceId,actorUserId:request.identity!.userId,
          actorType:"user",action:"admin.user_status_changed",targetType:"user",targetId:userId,
          origin:"admin_api",requestId:request.requestId,outcome:"succeeded",
          metadata:{status:input.status,reason:input.reason}
        });
      });
      response.json({id:userId,status:input.status});
    })
  );

  app.patch("/api/admin/workspaces/:workspaceId/status",authenticated,mfa,csrf,admin,
    asyncRoute(async(request,response)=>{
      const workspaceId=uuidSchema.parse(request.params.workspaceId);
      const input=z.object({
        status:z.enum(["active","read_only","closed"]),reason:z.string().trim().min(10).max(2000)
      }).parse(request.body);
      await withTransaction(database,async(transaction)=>{
        const result=await transaction.query(
          `UPDATE workspaces SET status=$2,version=version+1,updated_at=now() WHERE id=$1`,
          [workspaceId,input.status]
        );
        if(!result.rowCount) throw new AppError(404,"workspace_not_found","Workspace not found.");
        await recordAudit(transaction,{
          workspaceId,actorUserId:request.identity!.userId,actorType:"user",
          action:"admin.workspace_status_changed",targetType:"workspace",targetId:workspaceId,
          origin:"admin_api",requestId:request.requestId,outcome:"succeeded",
          metadata:{status:input.status,reason:input.reason}
        });
      });
      response.json({id:workspaceId,status:input.status});
    })
  );

  app.patch("/api/admin/memberships/:membershipId/status",authenticated,mfa,csrf,admin,
    asyncRoute(async(request,response)=>{
      const membershipId=uuidSchema.parse(request.params.membershipId);
      const input=z.object({
        status:z.enum(["active","suspended","ended"]),reason:z.string().trim().min(10).max(2000)
      }).parse(request.body);
      await withTransaction(database,async(transaction)=>{
        const current=await transaction.query<{workspace_id:string;user_id:string}>(
          `SELECT workspace_id,user_id FROM workspace_memberships WHERE id=$1 FOR UPDATE`,[membershipId]
        );
        if(!current.rows[0]) throw new AppError(404,"membership_not_found","Membership not found.");
        if(current.rows[0].user_id===request.identity!.userId&&input.status!=="active"){
          throw new AppError(409,"admin_self_membership_change_denied",
            "Use a second authorized administrator for this action.");
        }
        await transaction.query(
          `UPDATE workspace_memberships SET status=$2,updated_at=now() WHERE id=$1`,
          [membershipId,input.status]
        );
        if(input.status!=="active"){
          await transaction.query(
            `UPDATE sessions SET revoked_at=now(),revoked_reason='admin_membership_changed'
             WHERE user_id=$1 AND revoked_at IS NULL`,[current.rows[0].user_id]
          );
        }
        await recordAudit(transaction,{
          workspaceId:current.rows[0].workspace_id,actorUserId:request.identity!.userId,
          actorType:"user",action:"admin.membership_status_changed",
          targetType:"workspace_membership",targetId:membershipId,origin:"admin_api",
          requestId:request.requestId,outcome:"succeeded",
          metadata:{status:input.status,reason:input.reason}
        });
      });
      response.json({id:membershipId,status:input.status});
    })
  );

  app.post("/api/admin/launch-access",authenticated,mfa,csrf,admin,asyncRoute(async(request,response)=>{
    const input=z.object({
      workspaceId:uuidSchema,userId:uuidSchema,status:z.enum(["allowed","paused","ended"]),
      reason:z.string().trim().min(10).max(2000),expiresAt:z.string().datetime().nullable().optional()
    }).parse(request.body);
    const id=newId();
    await database.query(
      `INSERT INTO launch_access_entries
       (id,workspace_id,user_id,status,reason,approved_by,expires_at)
       VALUES($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT(workspace_id,user_id) DO UPDATE SET status=excluded.status,
       reason=excluded.reason,approved_by=excluded.approved_by,expires_at=excluded.expires_at,
       updated_at=now()`,
      [id,input.workspaceId,input.userId,input.status,input.reason,request.identity!.userId,input.expiresAt??null]
    );
    await recordAudit(database,{
      workspaceId:input.workspaceId,actorUserId:request.identity!.userId,actorType:"user",
      action:"launch_access.changed",targetType:"user",targetId:input.userId,
      origin:"admin_api",requestId:request.requestId,outcome:"succeeded",
      metadata:{status:input.status,reason:input.reason,expiresAt:input.expiresAt??null}
    });
    response.status(201).json({userId:input.userId,status:input.status});
  }));

  app.post("/api/admin/support-grants/:grantId/revoke",authenticated,mfa,csrf,admin,
    asyncRoute(async(request,response)=>{
      const input=z.object({reason:z.string().trim().min(10).max(2000)}).parse(request.body);
      const grantId=uuidSchema.parse(request.params.grantId);
      const result=await database.query<{workspace_id:string}>(
        `UPDATE support_grants SET revoked_at=now() WHERE id=$1 AND revoked_at IS NULL
         RETURNING workspace_id`,[grantId]
      );
      if(!result.rows[0]) throw new AppError(409,"support_grant_not_active","Support grant is not active.");
      await recordAudit(database,{
        workspaceId:result.rows[0].workspace_id,actorUserId:request.identity!.userId,actorType:"user",
        action:"support_grant.revoked",targetType:"support_grant",targetId:grantId,
        origin:"admin_api",requestId:request.requestId,outcome:"succeeded",
        metadata:{reason:input.reason}
      });
      response.json({id:grantId,status:"revoked"});
    })
  );

  app.post("/api/admin/legal-holds",authenticated,mfa,csrf,admin,asyncRoute(async(request,response)=>{
    const input=z.object({
      workspaceId:uuidSchema,subjectType:z.string().trim().min(1).max(100),
      subjectId:uuidSchema.nullable().optional(),reason:z.string().trim().min(10).max(2000),
      ticketReference:z.string().trim().min(3).max(120)
    }).parse(request.body);
    const id=newId();
    await database.query(
      `INSERT INTO legal_holds(id,workspace_id,subject_type,subject_id,reason,ticket_reference,status,placed_by)
       VALUES($1,$2,$3,$4,$5,$6,'active',$7)`,
      [id,input.workspaceId,input.subjectType,input.subjectId??null,input.reason,input.ticketReference,
       request.identity!.userId]
    );
    await recordAudit(database,{
      workspaceId:input.workspaceId,actorUserId:request.identity!.userId,actorType:"user",
      action:"legal_hold.placed",targetType:input.subjectType,targetId:input.subjectId??id,
      origin:"admin_api",requestId:request.requestId,outcome:"succeeded",
      metadata:{holdId:id,ticketReference:input.ticketReference,reason:input.reason}
    });
    response.status(201).json({id,status:"active"});
  }));

  app.post("/api/account-closure",authenticated,csrf,write,asyncRoute(async(request,response)=>{
    const input=z.object({
      reason:z.string().trim().min(10).max(2000),requestExport:z.boolean()
    }).parse(request.body);
    const hold=await database.query(
      `SELECT id FROM legal_holds WHERE workspace_id=$1 AND status='active'
       AND (subject_id IS NULL OR subject_id=$2) LIMIT 1`,
      [request.identity!.workspaceId,request.identity!.userId]
    );
    const id=newId();
    const legalHoldStatus=hold.rowCount?"active":"clear";
    await database.query(
      `INSERT INTO account_closure_requests
       (id,workspace_id,user_id,reason,export_requested,legal_hold_status,status)
       VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [id,request.identity!.workspaceId,request.identity!.userId,input.reason,input.requestExport,
       legalHoldStatus,legalHoldStatus==="active"?"hold":input.requestExport?"export_pending":"identity_review"]
    );
    await recordAudit(database,{
      workspaceId:request.identity!.workspaceId,actorUserId:request.identity!.userId,actorType:"user",
      action:"account_closure.requested",targetType:"account_closure_request",targetId:id,
      origin:"api",requestId:request.requestId,outcome:"succeeded",
      metadata:{exportRequested:input.requestExport,legalHoldStatus}
    });
    response.status(202).json({id,status:legalHoldStatus==="active"?"hold":input.requestExport?"export_pending":"identity_review"});
  }));

  app.get("/api/launch-readiness",authenticated,asyncRoute(async(_request,response)=>{
    const providers=providerReadiness(configuration);
    const retention=await database.query<{recordClass:string;specialistReviewStatus:string}>(
      `SELECT record_class AS "recordClass",specialist_review_status AS "specialistReviewStatus"
       FROM retention_policies WHERE workspace_id IS NULL OR workspace_id=$1`,
      [_request.identity!.workspaceId]
    );
    const blockers=[
      ...providers.filter(item=>item.required&&!item.configured).map(item=>({
        code:`provider.${item.key}`,severity:"blocker",owner:"Founder / deployment operator",
        action:`Configure and verify ${item.key}.`
      })),
      ...(retention.rows.some(row=>row.specialistReviewStatus!=="approved")?[{
        code:"privacy.retention_specialist_review",severity:"blocker",owner:"Founder",
        action:"Obtain specialist approval for retention periods before automated disposition."
      }]:[])
    ];
    response.json({
      status:blockers.length?"Not Ready":"Ready with Conditions",blockers,
      providers,checkedAt:new Date().toISOString(),
      statement:"Readiness is derived from observable configuration and recorded reviews; it is not a self-certified claim."
    });
  }));
}
