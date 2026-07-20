import assert from "node:assert/strict";
import { after,before,describe,it } from "node:test";
import request,{type Response} from "supertest";
import { createApp } from "../../apps/api/src/app.js";
import { loadConfig,resetConfigForTests } from "../../packages/config/src/index.js";
import { createDatabase } from "../../packages/database/src/index.js";
import { migrate } from "../../packages/database/src/migrate.js";
import { seedSynthetic,syntheticPassword } from "../../packages/database/src/seed.js";
import { metricDictionary } from "../../packages/domain/src/index.js";
import { newId } from "../../packages/shared/src/index.js";

const configuration=loadConfig(process.env);
const database=createDatabase(configuration);
let app:ReturnType<typeof createApp>;
const ids:Record<string,string>={};

function csrfFrom(response:Response):string {
  const values=response.headers["set-cookie"];
  const cookies=Array.isArray(values)?values:values?[values]:[];
  const csrf=cookies.find(value=>value.startsWith("ryva_csrf="));
  assert.ok(csrf);
  return decodeURIComponent(csrf.split(";")[0]!.slice("ryva_csrf=".length));
}
async function login(email="active@synthetic.ryva.test"){
  const agent=request.agent(app);
  const response=await agent.post("/api/auth/login").send({email,password:syntheticPassword});
  assert.equal(response.status,200,response.text);
  return {agent,csrf:csrfFrom(response),workspaceId:response.body.user.workspaceId as string,userId:response.body.user.id as string};
}
async function core(agent:ReturnType<typeof request.agent>,csrf:string,type:string,body:Record<string,unknown>){
  const response=await agent.post(`/api/records/${type}`).set("x-csrf-token",csrf).send(body);
  assert.equal(response.status,201,response.text);
  return response.body.record as {id:string};
}

async function setupFixture(){
  const {agent,csrf,workspaceId,userId}=await login();
  ids.workspace=workspaceId;ids.user=userId;
  const brand=await core(agent,csrf,"brand",{name:"Synthetic Analytics Brand"});
  const product=await core(agent,csrf,"product",{brandId:brand.id,name:"Synthetic Analytics Product",category:"Gift"});
  const business=await core(agent,csrf,"business",{name:"Synthetic Analytics Buyer",businessType:"gift_shop",category:"Gift"});
  const contact=await core(agent,csrf,"contact",{parentType:"business",parentId:business.id,name:"Synthetic Buyer",role:"Buyer"});
  Object.assign(ids,{brand:brand.id,product:product.id,business:business.id,contact:contact.id});
  const source=newId();const evidence=newId();const document=newId();const agreement=newId();
  const approval=newId();const decision=newId();const placement=newId();
  Object.assign(ids,{source,evidence,document,agreement,placement});
  await database.query(
    `INSERT INTO sources(id,workspace_id,source_type,reference,owner_or_provider,
       rights_classification,confidentiality,status,created_by)
     VALUES($1,$2,'first_party_document','Synthetic verified sales statement',
       'Synthetic brand','owned','normal','active',$3)`,[source,workspaceId,userId]
  );
  await database.query(
    `INSERT INTO evidence_records
      (id,workspace_id,subject_type,subject_id,exact_claim,evidence_class,
       verification_status,source_id,supports,confidence,limitations,permitted_use,
       prohibited_inference,observed_at,reassess_at,reviewed_by,status)
     VALUES($1,$2,'product',$3,'Verified 25 units sold during 2026-06-01 to 2026-06-30.',
       'verified_fact','verified',$4,'June first-party units','strong',
       'One first-party period only.','Use only with period and source.',
       'Do not infer future demand.',now()-interval '20 days',now()+interval '40 days',$5,'current')`,
    [evidence,workspaceId,product.id,source,userId]
  );
  await database.query(
    `INSERT INTO documents(id,workspace_id,subject_type,subject_id,owner_user_id,name,
       document_type,media_type,byte_size,storage_key,sha256,scan_status,confidentiality,status)
     VALUES($1,$2,'representation_agreement',$3,$4,'synthetic-agreement.pdf',
       'representation_agreement_original','application/pdf',10,$5,$6,'clean','restricted','active')`,
    [document,workspaceId,agreement,userId,`${workspaceId}/${document}`, "d".repeat(64)]
  );
  await database.query(
    `INSERT INTO human_approvals(id,workspace_id,subject_type,subject_id,action_type,
       artifact_digest,approver_user_id,status,scope,decided_at)
     VALUES($1,$2,'representation_agreement',$3,'activate_authority','synthetic-authority',
       $4,'approved','Synthetic exact scope',now())`,[approval,workspaceId,agreement,userId]
  );
  await database.query(
    `INSERT INTO representation_agreements
      (id,workspace_id,brand_id,representative_user_id,status,source_document_id,
       effective_at,expires_at,channels,authority_summary,commission_basis,
       commission_rate,commission_currency,commission_timing,opening_order_rights,
       reorder_rights,protected_account_rules,house_account_rules,termination_terms,
       post_termination_commission_rights,legal_ambiguity_status,approval_id,
       authority_digest,approved_by,approved_at)
     VALUES($1,$2,$3,$4,'active',$5,'2026-01-01','2027-01-01',ARRAY['independent_retail'],
       'Synthetic authority','Net',0.1,'USD','30 days','Opening','Reorders','Written only',
       'Written only','30 days','Recorded rights','none',$6,'synthetic-authority',$4,now())`,
    [agreement,workspaceId,brand.id,userId,document,approval]
  );
  await database.query(
    `INSERT INTO decision_records(id,workspace_id,subject_type,subject_id,question,scope,
       outcome,rationale,confidence,owner_user_id,decided_at,next_action,status)
     VALUES($1,$2,'business',$3,'Proceed?','Synthetic','Proceed','Supported synthetic fixture',
       'supported',$4,now(),'Review order','issued')`,[decision,workspaceId,business.id,userId]
  );
  await database.query(
    `INSERT INTO placement_opportunities
      (id,workspace_id,agreement_id,brand_id,business_id,owner_user_id,stage,
       match_thesis,buyer_value_basis,evidence_confidence,decision_id,conflict_status,
       authority_channel,last_meaningful_action_at)
     VALUES($1,$2,$3,$4,$5,$6,'contacted','Synthetic match','Synthetic buyer value',
       'supported',$7,'clear','independent_retail',now()-interval '20 days')`,
    [placement,workspaceId,agreement,brand.id,business.id,userId,decision]
  );
  await database.query(
    `INSERT INTO placement_opportunity_products(placement_opportunity_id,workspace_id,product_id)
     VALUES($1,$2,$3)`,[placement,workspaceId,product.id]
  );
  const task=newId();
  await database.query(
    `INSERT INTO tasks(id,workspace_id,subject_type,subject_id,title,owner_user_id,status,
       priority,created_reason,due_at,mandatory_gate)
     VALUES($1,$2,'placement_opportunity',$3,'Synthetic overdue buyer follow-up',$4,
       'open','high','Buyer reply commitment',now()-interval '3 days',false)`,
    [task,workspaceId,placement,userId]
  );
  ids.task=task;
  let sharedAccount="";
  for(const [currency,gross,suffix] of [["USD","100.00","usd"],["EUR","200.00","eur"]] as const){
    const order=newId();const account=sharedAccount||newId();const commission=newId();
    await database.query(
      `INSERT INTO orders
        (id,workspace_id,placement_opportunity_id,agreement_id,brand_id,business_id,
         representative_user_id,order_number,idempotency_key,order_type,order_date,currency,
         wholesale_gross,discounts,returns,cancellations,net_commissionable,status,
         payment_status,fulfillment_status,source_type,source_document_id,
         verification_status,verified_by,verified_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'opening_order',current_date,$10,$11,0,0,0,$11,
         'confirmed','paid','fulfilled','document',$12,'verified',$7,now())`,
      [order,workspaceId,placement,agreement,brand.id,business.id,userId,
        `SYN-${suffix}`,`analytics-${suffix}`,currency,gross,document]
    );
    if(!sharedAccount) {
      await database.query(
        `INSERT INTO accounts(id,workspace_id,brand_id,business_id,representative_user_id,
           owner_user_id,agreement_id,placement_opportunity_id,opening_order_id,status,
           health,health_rationale,opened_at)
         VALUES($1,$2,$3,$4,$5,$5,$6,$7,$8,'active','healthy',
           'Verified synthetic opening order.',now())`,
        [account,workspaceId,brand.id,business.id,userId,agreement,placement,order]
      );
      sharedAccount=account;
    }
    await database.query("UPDATE orders SET account_id=$1 WHERE id=$2",[account,order]);
    await database.query(
      `INSERT INTO commissions
        (id,workspace_id,representative_user_id,brand_id,account_id,agreement_id,order_id,
         calculation_basis,commission_rate,basis_type,term_type,currency,expected_amount,
         verified_amount,approved_amount,paid_amount,payment_due_date,payment_date,status,
         dispute_status,clawback_status,source_document_id,current_order_revision,
         calculation_explanation,human_verified_by,human_verified_at,approved_by,approved_at,
         payment_confirmed_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,'Synthetic net',0.1,'net','opening_order',$8,$9,$9,$9,$9,
         current_date-1,current_date,'paid','none','none',$10,1,'100 × 10%',$3,now(),$3,now(),$3)`,
      [commission,workspaceId,userId,brand.id,account,agreement,order,currency,
        currency==="USD"?"10.00":"20.00",document]
    );
  }
  const message=newId();ids.message=message;
  await database.query(
    `INSERT INTO outreach_messages
      (id,workspace_id,placement_opportunity_id,agreement_id,brand_id,business_id,
       contact_id,owner_user_id,channel,direction,sender_address,recipient_address,
       subject,body,status,origin)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,'email','outbound','rep@synthetic.test',
       'buyer@synthetic.test','Synthetic draft','Draft','draft','user_entered')`,
    [message,workspaceId,placement,agreement,brand.id,business.id,contact.id,userId]
  );
}

before(async()=>{
  await database.query("DROP SCHEMA public CASCADE");await database.query("CREATE SCHEMA public");
  await migrate(database);resetConfigForTests();await seedSynthetic();
  app=createApp({database,configuration});await setupFixture();
});
after(async()=>{await database.end();});

describe("Phase 8 Home and Analytics Command Center",()=>{
  it("ANA-001 keeps Home authorized, explained, actionable, and blocker-aware",async()=>{
    const {agent,csrf}=await login();
    const home=await agent.get("/api/home-command-center");
    assert.equal(home.status,200,home.text);
    assert.ok(home.body.priorities.length>0);
    assert.ok(home.body.priorities.every((item:Record<string,unknown>)=>
      typeof item.reason==="string" && Array.isArray(item.explanation) && typeof item.nextAction==="string"
    ));
    const other=await login("canceled-paid@synthetic.ryva.test");
    const isolated=await other.agent.get("/api/home-command-center");
    assert.equal(isolated.status,200);
    assert.equal(isolated.body.priorities.length,0);
    const action=await agent.post(`/api/home/priorities/task/${ids.task}/actions`)
      .set("x-csrf-token",csrf).send({action:"snoozed",reason:"Review tomorrow.",snoozedUntil:new Date(Date.now()+86_400_000).toISOString()});
    assert.equal(action.status,200,action.text);
    assert.ok(!action.body.priorities.some((item:Record<string,unknown>)=>item.itemId===ids.task));
  });

  it("ANA-002 reconciles source records and never combines currencies or value states",async()=>{
    const {agent}=await login();
    const response=await agent.get("/api/analytics");
    assert.equal(response.status,200,response.text);
    const orders=response.body.currencyTotals.orders as Array<Record<string,string>>;
    assert.deepEqual(orders.map(row=>row.currency),["EUR","USD"]);
    assert.equal(orders.find(row=>row.currency==="USD")?.verified,"100.00");
    assert.equal(orders.find(row=>row.currency==="EUR")?.verified,"200.00");
    const commissions=response.body.currencyTotals.commissions as Array<Record<string,string>>;
    assert.equal(commissions.find(row=>row.currency==="USD")?.paid,"10.00");
    assert.equal(response.body.externalIntelligence.status,"not_connected");
    assert.equal(response.body.externalIntelligence.observationCount,0);
    assert.ok(metricDictionary.length>=50);
  });

  it("ANA-003 exposes definitions, drill-down tables, and audited permission-controlled exports",async()=>{
    const {agent}=await login();
    const definitions=await agent.get("/api/analytics/definitions");
    assert.equal(definitions.status,200);
    const expected=definitions.body.definitions.find((item:Record<string,unknown>)=>item.code==="expected_commission");
    assert.equal(expected.currencyBehavior,"Grouped by ISO currency; currencies are never combined.");
    assert.equal(expected.valueStatus,"estimated");
    const exported=await agent.get("/api/analytics/export?reportType=commissions&from=2026-01-01&to=2026-12-31");
    assert.equal(exported.status,200,exported.text);
    assert.match(exported.text,/currencies_are_separate=true/);
    assert.match(exported.text,/"commissions","EUR"/);
    const audit=await database.query(
      `SELECT id FROM audit_events WHERE workspace_id=$1 AND action='analytics.export_generated'`,
      [ids.workspace]
    );
    assert.ok(audit.rowCount);
  });

  it("ANA-004 permits only evidence-linked user ranges and disallows weighted forecasts",async()=>{
    const {agent,csrf}=await login();
    const missing=await agent.post("/api/analytics/forecasts").set("x-csrf-token",csrf).send({
      targetType:"placement_opportunity",targetId:ids.placement,currency:"USD",
      lowAmount:"100",baseAmount:"200",highAmount:"300",qualitativeLikelihood:"possible",
      horizonStartsOn:"2026-08-01",horizonEndsOn:"2026-09-01",evidenceIds:[],
      assumptions:["Buyer timing remains unchanged."],limitations:["Not guaranteed income."]
    });
    assert.equal(missing.status,422);
    const created=await agent.post("/api/analytics/forecasts").set("x-csrf-token",csrf).send({
      targetType:"placement_opportunity",targetId:ids.placement,currency:"USD",
      lowAmount:"100",baseAmount:"200",highAmount:"300",qualitativeLikelihood:"possible",
      horizonStartsOn:"2026-08-01",horizonEndsOn:"2026-09-01",evidenceIds:[ids.evidence],
      assumptions:["Buyer timing remains unchanged."],limitations:["Not guaranteed income."]
    });
    assert.equal(created.status,201,created.text);
    assert.equal(created.body.forecast.method,"user_entered_range");
    assert.equal("probability" in created.body.forecast,false);
  });

  it("ANA-005 blocks unsupported or stale numerical draft claims and preserves exact evidence",async()=>{
    const {agent,csrf}=await login();
    const unsupported=await agent.post(`/api/outreach/${ids.message}/analytics-claims`)
      .set("x-csrf-token",csrf).send({
        metricCode:"units_sold",claimText:"Verified 99 units sold.",
        sourceRecordType:"product",sourceRecordId:ids.product,evidenceId:ids.evidence
      });
    assert.equal(unsupported.status,422,unsupported.text);
    const supported=await agent.post(`/api/outreach/${ids.message}/analytics-claims`)
      .set("x-csrf-token",csrf).send({
        metricCode:"units_sold",claimText:"Verified 25 units sold during 2026-06-01 to 2026-06-30.",
        sourceRecordType:"product",sourceRecordId:ids.product,evidenceId:ids.evidence
      });
    assert.equal(supported.status,201,supported.text);
    assert.equal(supported.body.claim.freshness_status,"current");
    await database.query("UPDATE evidence_records SET reassess_at=now()-interval '1 day' WHERE id=$1",[ids.evidence]);
    const stale=await agent.post(`/api/outreach/${ids.message}/analytics-claims`)
      .set("x-csrf-token",csrf).send({
        metricCode:"units_sold",claimText:"Verified 25 units sold during 2026-06-01 to 2026-06-30.",
        sourceRecordType:"product",sourceRecordId:ids.product,evidenceId:ids.evidence
      });
    assert.equal(stale.status,409,stale.text);
  });

  it("ANA-006 refreshes alerts idempotently and leaves empty workspaces unmanufactured",async()=>{
    const {agent,csrf}=await login();
    const first=await agent.post("/api/analytics/alerts/refresh").set("x-csrf-token",csrf).send({});
    const second=await agent.post("/api/analytics/alerts/refresh").set("x-csrf-token",csrf).send({});
    assert.equal(first.status,200,first.text);assert.equal(second.status,200,second.text);
    assert.ok(first.body.created>0);assert.equal(second.body.created,0);
    const empty=await login("canceled-paid@synthetic.ryva.test");
    const analytics=await empty.agent.get("/api/analytics");
    assert.equal(analytics.status,200);
    assert.equal(analytics.body.externalIntelligence.status,"not_connected");
    assert.deepEqual(analytics.body.currencyTotals.orders,[]);
    assert.deepEqual(analytics.body.forecasts,[]);
  });
});
