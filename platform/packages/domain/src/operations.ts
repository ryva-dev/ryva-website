import type { Database, Transaction } from "../../database/src/index.js";
import { oneOrNone, withTransaction } from "../../database/src/index.js";
import { AppError, newId } from "../../shared/src/index.js";
import { publicDigest } from "./crypto.js";
import { recordAudit } from "./audit.js";
import { enqueueJob } from "./jobs.js";

export const importRecordTypes = [
  "product","brand","business","contact","business_buyer","source","evidence","task",
  "representation_opportunity","placement_opportunity","protected_account","order","reorder","commission"
] as const;
export type ImportRecordType = (typeof importRecordTypes)[number];

type PreparedImportRow = {
  rowNumber: number;
  raw: Record<string,string>;
  normalized: Record<string,string>;
  errors: string[];
  duplicateCandidates: unknown[];
};

export async function createControlledImport(
  database: Database,
  input: {
    workspaceId: string;
    userId: string;
    requestId: string;
    recordType: ImportRecordType;
    sourceName: string;
    sourceId?: string | null;
    observedAt?: string | null;
    sourceDigest: string;
    mapping: Record<string,string>;
    rows: PreparedImportRow[];
    idempotencyKey: string;
  }
) {
  const counts = input.rows.reduce(
    (summary,row) => {
      if (row.errors.length) summary.errors += 1;
      else if (row.duplicateCandidates.length) summary.duplicates += 1;
      else summary.creates += 1;
      return summary;
    },
    {total:input.rows.length,errors:0,duplicates:0,creates:0}
  );
  const id = newId();
  return withTransaction(database,async(transaction)=>{
    const existing=await oneOrNone<{id:string;summary:Record<string,unknown>}>(
      transaction,
      `SELECT id,summary FROM import_previews
       WHERE workspace_id=$1 AND idempotency_key=$2`,
      [input.workspaceId,input.idempotencyKey]
    );
    if(existing) return {id:existing.id,summary:existing.summary,replayed:true};
    const summary={
      ...counts,
      valid:counts.total-counts.errors,
      prospectiveCreates:counts.creates,
      duplicateReviewRequired:counts.duplicates,
      reviewOnly:!["brand","product","business","contact","source","task"].includes(input.recordType),
      provenance:{
        sourceId:input.sourceId??null,observedAt:input.observedAt??null,
        origin:"imported",verificationStatus:"unverified"
      },
      authorityImplications:[
        "Imported claims remain unverified until separately reviewed against their Source.",
        "Imports cannot qualify Products or Buyers, approve authority, create protected rights, verify orders, or approve commissions.",
        "Consequential record types enter a human review queue and do not become operational authority."
      ]
    };
    await transaction.query(
      `INSERT INTO import_previews
       (id,workspace_id,user_id,record_type,source_name,source_digest,mapping,rows,summary,
        status,expires_at,source_id,observed_at,idempotency_key)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'approval_required',now()+interval '24 hours',
              $10,$11,$12)`,
      [id,input.workspaceId,input.userId,input.recordType,input.sourceName,input.sourceDigest,
       input.mapping,JSON.stringify(input.rows),summary,input.sourceId??null,input.observedAt??null,
       input.idempotencyKey]
    );
    for(const row of input.rows){
      await transaction.query(
        `INSERT INTO import_rows
         (id,workspace_id,import_id,row_number,raw,normalized,validation_errors,
          duplicate_candidates,proposed_action)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [newId(),input.workspaceId,id,row.rowNumber,row.raw,row.normalized,row.errors,
         JSON.stringify(row.duplicateCandidates),
         row.errors.length?"reject":row.duplicateCandidates.length?"review_duplicate":"create"]
      );
    }
    await recordAudit(transaction,{
      workspaceId:input.workspaceId,actorUserId:input.userId,actorType:"user",
      action:"controlled_import.preview_created",targetType:"import_preview",targetId:id,
      origin:"api",requestId:input.requestId,outcome:"succeeded",metadata:summary
    });
    return {id,summary,rows:input.rows,replayed:false};
  });
}

async function createSafeImportedRecord(
  transaction:Transaction,
  input:{workspaceId:string;userId:string;recordType:ImportRecordType;values:Record<string,string>}
):Promise<string>{
  const id=newId();
  const value=input.values;
  if(input.recordType==="brand"){
    await transaction.query(
      `INSERT INTO brands(id,workspace_id,public_name,legal_name,website,identity_status,status,owner_user_id,custom_fields)
       VALUES($1,$2,$3,$4,$5,'unverified','discovered',$6,$7)`,
      [id,input.workspaceId,value.name,value.legalName||null,value.website||null,input.userId,
       {imported:true,reviewRequired:true}]
    );
  }else if(input.recordType==="product"){
    await transaction.query(
      `INSERT INTO products(id,workspace_id,brand_id,name,category,summary,identity_status,status,owner_user_id,custom_fields)
       VALUES($1,$2,$3,$4,$5,$6,'unverified','discovered',$7,$8)`,
      [id,input.workspaceId,value.brandId,value.name,value.category,value.summary||"",input.userId,
       {imported:true,reviewRequired:true}]
    );
  }else if(input.recordType==="business"){
    await transaction.query(
      `INSERT INTO businesses(id,workspace_id,name,legal_name,business_type,category,website,status,owner_user_id,custom_fields)
       VALUES($1,$2,$3,$4,$5,$6,$7,'research',$8,$9)`,
      [id,input.workspaceId,value.name,value.legalName||null,value.businessType,value.category,
       value.website||null,input.userId,{imported:true,reviewRequired:true}]
    );
  }else if(input.recordType==="contact"){
    const brandId=value.parentType==="brand"?value.parentId:null;
    const businessId=value.parentType==="business"?value.parentId:null;
    await transaction.query(
      `INSERT INTO contacts
       (id,workspace_id,brand_id,business_id,name,role,email,phone,verification_status,
        permission_status,owner_user_id,custom_fields)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,'unverified','unknown',$9,$10)`,
      [id,input.workspaceId,brandId,businessId,value.name,value.role,value.email||null,
       value.phone||null,input.userId,{imported:true,reviewRequired:true}]
    );
  }else if(input.recordType==="source"){
    await transaction.query(
      `INSERT INTO sources
       (id,workspace_id,source_type,reference,url,owner_or_provider,rights_classification,
        confidentiality,status,created_by)
       VALUES($1,$2,$3,$4,$5,$6,'unknown','normal','active',$7)`,
      [id,input.workspaceId,value.sourceType,value.reference,value.url||null,
       value.ownerOrProvider||"Unknown",input.userId]
    );
  }else if(input.recordType==="task"){
    await transaction.query(
      `INSERT INTO tasks
       (id,workspace_id,subject_type,subject_id,title,owner_user_id,status,priority,created_reason,due_at)
       VALUES($1,$2,$3,$4,$5,$6,'open',$7,'Imported task; human review required',$8)`,
      [id,input.workspaceId,value.subjectType,value.subjectId,value.title,input.userId,
       value.priority||"medium",value.dueAt||null]
    );
  }else{
    throw new AppError(422,"import_requires_review","This imported record requires human review.");
  }
  return id;
}

export async function approveAndCommitImport(
  database:Database,
  input:{
    workspaceId:string;userId:string;requestId:string;importId:string;reason:string;
    sourceDigest:string;expectedRowCount:number;expectedCreateCount:number;expectedReviewCount:number;
  }
){
  return withTransaction(database,async(transaction)=>{
    const preview=await oneOrNone<{
      id:string;record_type:ImportRecordType;source_digest:string;status:string;summary:{
        total:number;errors:number;creates:number;duplicates:number;reviewOnly:boolean;
      }
    }>(transaction,
      `SELECT id,record_type,source_digest,status,summary FROM import_previews
       WHERE workspace_id=$1 AND id=$2 FOR UPDATE`,
      [input.workspaceId,input.importId]
    );
    if(!preview) throw new AppError(404,"import_not_found","Import preview not found.");
    if(preview.status==="completed"){
      const prior=await oneOrNone<{result:Record<string,unknown>}>(
        transaction,`SELECT result FROM import_previews WHERE id=$1`,[input.importId]
      );
      return {result:prior?.result??{},replayed:true};
    }
    if(preview.status!=="approval_required"){
      throw new AppError(409,"import_not_approvable","This import is not awaiting approval.");
    }
    const expected=preview.summary;
    if(
      preview.source_digest!==input.sourceDigest||expected.total!==input.expectedRowCount||
      expected.creates!==input.expectedCreateCount||expected.duplicates!==input.expectedReviewCount
    ){
      throw new AppError(409,"import_preview_changed","The import preview changed. Review it again before approval.");
    }
    if(expected.errors>0){
      throw new AppError(422,"import_has_errors","Correct all validation errors before approval.");
    }
    const approvalId=newId();
    await transaction.query(
      `INSERT INTO import_approvals
       (id,workspace_id,import_id,approver_user_id,source_digest,expected_row_count,
        expected_create_count,expected_review_count,decision,reason)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,'approved',$9)`,
      [approvalId,input.workspaceId,input.importId,input.userId,input.sourceDigest,input.expectedRowCount,
       input.expectedCreateCount,input.expectedReviewCount,input.reason]
    );
    await transaction.query(
      `UPDATE import_previews SET status='committing',approved_by=$2,approved_at=now()
       WHERE id=$1`,[input.importId,input.userId]
    );
    const rows=await transaction.query<{
      id:string;normalized:Record<string,string>;proposed_action:string
    }>(
      `SELECT id,normalized,proposed_action FROM import_rows
       WHERE workspace_id=$1 AND import_id=$2 ORDER BY row_number FOR UPDATE`,
      [input.workspaceId,input.importId]
    );
    const result={created:0,stagedForReview:0,skippedDuplicates:0,rejected:0};
    for(const row of rows.rows){
      if(row.proposed_action==="review_duplicate"){
        result.skippedDuplicates+=1;
        await transaction.query(
          `UPDATE import_rows SET committed_action='skipped_duplicate' WHERE id=$1`,[row.id]
        );
        continue;
      }
      if(row.proposed_action==="reject"){
        result.rejected+=1;
        await transaction.query(`UPDATE import_rows SET committed_action='rejected' WHERE id=$1`,[row.id]);
        continue;
      }
      if(preview.summary.reviewOnly){
        const reviewId=newId();
        await transaction.query(
          `INSERT INTO import_review_items
           (id,workspace_id,import_id,import_row_id,record_type,candidate,authority_effect,status)
           VALUES($1,$2,$3,$4,$5,$6,'none_until_human_adoption','pending')`,
          [reviewId,input.workspaceId,input.importId,row.id,preview.record_type,row.normalized]
        );
        await transaction.query(
          `UPDATE import_rows SET committed_action='staged_for_review',target_type='import_review_item',
            target_id=$2 WHERE id=$1`,[row.id,reviewId]
        );
        result.stagedForReview+=1;
      }else{
        const targetId=await createSafeImportedRecord(transaction,{
          workspaceId:input.workspaceId,userId:input.userId,recordType:preview.record_type,values:row.normalized
        });
        await transaction.query(
          `UPDATE import_rows SET committed_action='created',target_type=$2,target_id=$3 WHERE id=$1`,
          [row.id,preview.record_type,targetId]
        );
        result.created+=1;
      }
    }
    await transaction.query(
      `UPDATE import_previews SET status='completed',committed_at=now(),result=$2 WHERE id=$1`,
      [input.importId,result]
    );
    const notificationId=newId();
    await transaction.query(
      `INSERT INTO notifications
       (id,workspace_id,user_id,notification_type,severity,title,reason,subject_type,
        subject_id,grouping_key,status,blocking)
       VALUES($1,$2,$3,'import_completed','informational','Import completed',
        $4,'import_preview',$5,$6,'unread',false)`,
      [notificationId,input.workspaceId,input.userId,
       `${result.created} created, ${result.stagedForReview} staged for review, ${result.skippedDuplicates} duplicate rows skipped.`,
       input.importId,`import:${input.importId}`]
    );
    await transaction.query(
      `INSERT INTO notification_events
       (id,workspace_id,notification_id,source_event_type,source_event_id,reason)
       VALUES($1,$2,$3,'controlled_import',$4,$5)`,
      [newId(),input.workspaceId,notificationId,input.importId,"Transactional import commit completed."]
    );
    await recordAudit(transaction,{
      workspaceId:input.workspaceId,actorUserId:input.userId,actorType:"user",
      action:"controlled_import.committed",targetType:"import_preview",targetId:input.importId,
      origin:"api",requestId:input.requestId,outcome:"succeeded",
      metadata:{approvalId,...result,recordType:preview.record_type}
    });
    return {result,replayed:false};
  });
}

export async function getControlledImport(database:Database,workspaceId:string,importId:string){
  const preview=await oneOrNone<Record<string,unknown>>(database,
    `SELECT id,record_type AS "recordType",source_name AS "sourceName",source_digest AS "sourceDigest",
            summary,status,expires_at AS "expiresAt",approved_at AS "approvedAt",
            committed_at AS "committedAt",result,failure_code AS "failureCode"
       FROM import_previews WHERE workspace_id=$1 AND id=$2`,[workspaceId,importId]
  );
  if(!preview) throw new AppError(404,"import_not_found","Import preview not found.");
  const rows=await database.query(
    `SELECT id,row_number AS "rowNumber",normalized,validation_errors AS errors,
            duplicate_candidates AS "duplicateCandidates",proposed_action AS "proposedAction",
            committed_action AS "committedAction",target_type AS "targetType",target_id AS "targetId",
            safe_error AS "safeError"
       FROM import_rows WHERE workspace_id=$1 AND import_id=$2 ORDER BY row_number`,
    [workspaceId,importId]
  );
  return {preview,rows:rows.rows};
}

const mergeTables={
  product:"products",brand:"brands",business:"businesses",contact:"contacts",
  business_buyer:"business_buyers",representation_opportunity:"representation_opportunities",
  placement_opportunity:"placement_opportunities",protected_account:"protected_accounts",order:"orders"
} as const;
export type MergeRecordType=keyof typeof mergeTables;

export async function previewRecordMerge(
  database:Database,input:{workspaceId:string;recordType:MergeRecordType;survivorId:string;duplicateId:string}
){
  const table=mergeTables[input.recordType];
  const records=await database.query<Record<string,unknown>>(
    `SELECT row_to_json(candidate) AS record FROM ${table} candidate
      WHERE workspace_id=$1 AND id=ANY($2::uuid[])`,[input.workspaceId,[input.survivorId,input.duplicateId]]
  );
  if(records.rowCount!==2) throw new AppError(404,"merge_record_not_found","Both records must exist in this workspace.");
  const byId=new Map(records.rows.map(item=>[String((item.record as {id:string}).id),item.record]));
  const survivor=byId.get(input.survivorId)! as Record<string,unknown>;
  const duplicate=byId.get(input.duplicateId)! as Record<string,unknown>;
  const fields=[...new Set([...Object.keys(survivor),...Object.keys(duplicate)])]
    .filter(key=>!["workspace_id","created_at","updated_at"].includes(key));
  const fieldDiff=Object.fromEntries(fields.map(key=>[key,{
    survivor:survivor[key]??null,duplicate:duplicate[key]??null,
    differs:JSON.stringify(survivor[key]??null)!==JSON.stringify(duplicate[key]??null)
  }]));
  return {
    recordType:input.recordType,survivorId:input.survivorId,duplicateId:input.duplicateId,fieldDiff,
    preservationPlan:{
      mode:"canonical_alias",
      relationships:"Preserved on their original immutable records and resolved through the canonical alias.",
      evidence:"Preserved without reclassification.",
      documents:"Preserved with original digests and ownership.",
      authority:"Never combined or expanded by merge.",
      commercialHistory:"Orders and commissions remain immutable and separately auditable.",
      recovery:"The canonical alias can be reversed by an authorized human."
    }
  };
}

export async function confirmRecordMerge(
  database:Database,
  input:{workspaceId:string;userId:string;requestId:string;recordType:MergeRecordType;
    survivorId:string;duplicateId:string;reason:string}
){
  const preview=await previewRecordMerge(database,input);
  return withTransaction(database,async(transaction)=>{
    const id=newId();
    await transaction.query(
      `INSERT INTO record_merge_reviews
       (id,workspace_id,record_type,survivor_id,duplicate_id,field_diff,preservation_plan,
        status,reason,requested_by,confirmed_by,confirmed_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,'confirmed',$8,$9,$9,now())`,
      [id,input.workspaceId,input.recordType,input.survivorId,input.duplicateId,
       preview.fieldDiff,preview.preservationPlan,input.reason,input.userId]
    );
    await transaction.query(
      `INSERT INTO record_aliases(workspace_id,record_type,alias_id,canonical_id,merge_review_id)
       VALUES($1,$2,$3,$4,$5)`,
      [input.workspaceId,input.recordType,input.duplicateId,input.survivorId,id]
    );
    await recordAudit(transaction,{
      workspaceId:input.workspaceId,actorUserId:input.userId,actorType:"user",
      action:"duplicate_merge.confirmed",targetType:input.recordType,targetId:input.duplicateId,
      origin:"api",requestId:input.requestId,outcome:"succeeded",
      metadata:{mergeReviewId:id,canonicalId:input.survivorId,mode:"canonical_alias"}
    });
    return {id,...preview};
  });
}

export async function reverseRecordMerge(
  database:Database,input:{workspaceId:string;userId:string;requestId:string;mergeReviewId:string;reason:string}
){
  return withTransaction(database,async(transaction)=>{
    const review=await oneOrNone<{id:string;record_type:string;duplicate_id:string;survivor_id:string;status:string}>(
      transaction,
      `SELECT id,record_type,duplicate_id,survivor_id,status FROM record_merge_reviews
       WHERE workspace_id=$1 AND id=$2 FOR UPDATE`,[input.workspaceId,input.mergeReviewId]
    );
    if(!review) throw new AppError(404,"merge_review_not_found","Merge review not found.");
    if(review.status!=="confirmed") throw new AppError(409,"merge_not_reversible","Only a confirmed merge can be reversed.");
    await transaction.query(
      `DELETE FROM record_aliases WHERE workspace_id=$1 AND merge_review_id=$2`,
      [input.workspaceId,input.mergeReviewId]
    );
    await transaction.query(
      `UPDATE record_merge_reviews SET status='reversed',reversed_by=$2,reversed_at=now(),
       reversal_reason=$3 WHERE id=$1`,
      [input.mergeReviewId,input.userId,input.reason]
    );
    await recordAudit(transaction,{
      workspaceId:input.workspaceId,actorUserId:input.userId,actorType:"user",
      action:"duplicate_merge.reversed",targetType:review.record_type,targetId:review.duplicate_id,
      origin:"api",requestId:input.requestId,outcome:"succeeded",
      metadata:{mergeReviewId:review.id,formerCanonicalId:review.survivor_id,reason:input.reason}
    });
    return {id:review.id,status:"reversed"};
  });
}

const exportTables:Record<string,string>={
  profile:"user_profiles",products:"products",brands:"brands",businesses:"businesses",
  contacts:"contacts",sources:"sources",evidence:"evidence_records",tasks:"tasks",
  representation_opportunities:"representation_opportunities",
  placement_opportunities:"placement_opportunities",activity:"activities",
  accounts:"accounts",protected_accounts:"protected_accounts",orders:"orders",
  reorders:"reorders",commissions:"commissions",analytics:"analytics_report_runs",
  audit:"audit_events",documents:"documents"
};
export const exportScopes=Object.keys(exportTables);

export async function generateWorkspaceExport(
  database:Database,
  input:{workspaceId:string;userId:string;requestId:string;scopes:string[];
    format:"json"|"csv_bundle";includeDocuments:boolean}
){
  const selected=[...new Set(input.scopes)];
  if(!selected.length||selected.some(scope=>!(scope in exportTables))){
    throw new AppError(422,"export_scope_invalid","Select one or more supported export scopes.");
  }
  const id=newId();
  return withTransaction(database,async(transaction)=>{
    await transaction.query(
      `INSERT INTO data_export_requests
       (id,workspace_id,requested_by,export_scope,export_format,include_documents,status)
       VALUES($1,$2,$3,$4,$5,$6,'queued')`,
      [id,input.workspaceId,input.userId,selected,input.format,input.includeDocuments]
    );
    const job=await enqueueJob(transaction,{
      workspaceId:input.workspaceId,kind:"data_export.generate",
      payload:{exportId:id},idempotencyKey:`data-export:${id}`,maxAttempts:5
    });
    await recordAudit(transaction,{
      workspaceId:input.workspaceId,actorUserId:input.userId,actorType:"user",
      action:"data_export.requested",targetType:"data_export",targetId:id,origin:"api",
      requestId:input.requestId,outcome:"succeeded",
      metadata:{scopes:selected,format:input.format,includeDocuments:input.includeDocuments,jobId:job.id}
    });
    return {id,status:"queued",jobId:job.id};
  });
}

export async function processWorkspaceExport(database:Database,exportId:string){
  return withTransaction(database,async(transaction)=>{
    const request=await oneOrNone<{
      id:string;workspace_id:string;requested_by:string;export_scope:string[];
      export_format:"json"|"csv_bundle";include_documents:boolean;status:string;
    }>(transaction,
      `SELECT id,workspace_id,requested_by,export_scope,export_format,include_documents,status
       FROM data_export_requests WHERE id=$1 FOR UPDATE`,[exportId]
    );
    if(!request) throw new Error("Export request was not found.");
    if(request.status==="ready") return {id:request.id,status:"ready",replayed:true};
    if(!["queued","generating"].includes(request.status)) throw new Error("Export request is not processable.");
    await transaction.query(
      `UPDATE data_export_requests SET status='generating',safe_error=NULL WHERE id=$1`,[exportId]
    );
    const data:Record<string,unknown[]|Record<string,unknown>>={};
    let rowCount=0;
    for(const scope of request.export_scope){
      const table=exportTables[scope]!;
      const conditions=scope==="profile"
        ? {sql:"workspace_id=$1 AND user_id=$2",values:[request.workspace_id,request.requested_by]}
        : {sql:"workspace_id=$1",values:[request.workspace_id]};
      const result=await transaction.query<Record<string,unknown>>(
        `SELECT * FROM ${table} WHERE ${conditions.sql} ORDER BY 1`,
        conditions.values
      );
      const rows=scope==="documents"
        ? result.rows.map(({storage_key:storageKey,...record})=>({
            ...record,storage_key_redacted:Boolean(storageKey),
            content_included:false,
            export_note:request.include_documents
              ?"Document bytes require a separately authorized object-storage export."
              :"Document metadata only."
          }))
        : result.rows;
      data[scope]=rows;
      rowCount+=rows.length;
    }
    data._manifest={
      schemaVersion:"ryva-portable-export-v1",exportId:request.id,workspaceId:request.workspace_id,
      generatedAt:new Date().toISOString(),format:request.export_format,scopes:request.export_scope,rowCount,
      redactionPolicy:"workspace_authorized_v1",currencies:"Preserved per source record",
      evidenceAndSources:"Included only when selected; record identifiers are stable.",
      documentBytesIncluded:false
    };
    const digest=publicDigest(JSON.stringify(data));
    const manifest=data._manifest;
    await transaction.query(
      `UPDATE data_export_requests SET status='ready',manifest=$2,payload=$3,payload_digest=$4,
       row_count=$5,completed_at=now(),expires_at=now()+interval '24 hours' WHERE id=$1`,
      [request.id,manifest,data,digest,rowCount]
    );
    const notificationId=newId();
    await transaction.query(
      `INSERT INTO notifications
       (id,workspace_id,user_id,notification_type,severity,title,reason,subject_type,
        subject_id,grouping_key,status,blocking,expires_at)
       VALUES($1,$2,$3,'export_ready','informational','Data export ready',$4,
        'data_export',$5,$6,'unread',false,now()+interval '24 hours')`,
      [notificationId,request.workspace_id,request.requested_by,
       `${rowCount} rows are ready to download for 24 hours.`,request.id,`export:${request.id}`]
    );
    await transaction.query(
      `INSERT INTO notification_events
       (id,workspace_id,notification_id,source_event_type,source_event_id,reason)
       VALUES($1,$2,$3,'data_export',$4,$5)`,
      [newId(),request.workspace_id,notificationId,request.id,"Durable export generation completed."]
    );
    await recordAudit(transaction,{
      workspaceId:request.workspace_id,actorType:"job",
      action:"data_export.generated",targetType:"data_export",targetId:request.id,origin:"worker",
      requestId:request.id,outcome:"succeeded",
      metadata:{scopes:request.export_scope,rowCount,digest,documentBytesIncluded:false}
    });
    return {id:request.id,status:"ready",manifest,digest,replayed:false};
  });
}

export async function getWorkspaceExport(
  database:Database,input:{workspaceId:string;userId:string;exportId:string}
){
  const result=await oneOrNone<Record<string,unknown>>(database,
    `SELECT id,status,export_scope AS scopes,export_format AS format,
            include_documents AS "includeDocuments",manifest,payload_digest AS digest,
            row_count AS "rowCount",safe_error AS "safeError",expires_at AS "expiresAt",
            created_at AS "createdAt",completed_at AS "completedAt"
       FROM data_export_requests WHERE workspace_id=$1 AND requested_by=$2 AND id=$3`,
    [input.workspaceId,input.userId,input.exportId]
  );
  if(!result) throw new AppError(404,"export_not_found","Export not found.");
  return result;
}

export async function downloadWorkspaceExport(
  database:Database,input:{workspaceId:string;userId:string;exportId:string}
){
  const result=await oneOrNone<{payload:Record<string,unknown>;manifest:Record<string,unknown>;
    payload_digest:string;status:string;expires_at:Date;export_format:"json"|"csv_bundle"}>(database,
    `SELECT payload,manifest,payload_digest,status,expires_at,export_format FROM data_export_requests
     WHERE workspace_id=$1 AND requested_by=$2 AND id=$3`,
    [input.workspaceId,input.userId,input.exportId]
  );
  if(!result) throw new AppError(404,"export_not_found","Export not found.");
  if(result.status!=="ready"||result.expires_at<=new Date()){
    throw new AppError(410,"export_unavailable","This export is not ready or has expired.");
  }
  return {payload:result.payload,manifest:result.manifest,digest:result.payload_digest,
    format:result.export_format};
}
