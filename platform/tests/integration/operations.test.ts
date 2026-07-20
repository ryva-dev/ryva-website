import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { generate } from "otplib";
import { strFromU8, unzipSync } from "fflate";
import request, { type Response } from "supertest";
import { createApp } from "../../apps/api/src/app.js";
import { loadConfig, resetConfigForTests } from "../../packages/config/src/index.js";
import { createDatabase } from "../../packages/database/src/index.js";
import { migrate } from "../../packages/database/src/migrate.js";
import { seedSynthetic, syntheticPassword } from "../../packages/database/src/seed.js";
import { decryptSecret, processWorkspaceExport } from "../../packages/domain/src/index.js";

const configuration=loadConfig(process.env);
const database=createDatabase(configuration);
let app:ReturnType<typeof createApp>;

function csrfFrom(response:Response):string{
  const values=response.headers["set-cookie"];
  const cookies=Array.isArray(values)?values:values?[values]:[];
  const csrf=cookies.find(value=>value.startsWith("ryva_csrf="));
  assert.ok(csrf);
  return decodeURIComponent(csrf.split(";")[0]!.slice("ryva_csrf=".length));
}
async function login(email="active@synthetic.ryva.test",mfaCode?:string){
  const agent=request.agent(app);
  const response=await agent.post("/api/auth/login")
    .send({email,password:syntheticPassword,...(mfaCode?{mfaCode}:{})});
  assert.equal(response.status,200,response.text);
  return {agent,csrf:csrfFrom(response)};
}
async function adminCode(){
  const result=await database.query<{mfa_secret_ciphertext:string}>(
    `SELECT mfa_secret_ciphertext FROM users WHERE email='admin@synthetic.ryva.test'`
  );
  return generate({secret:decryptSecret(result.rows[0]!.mfa_secret_ciphertext,
    configuration.FIELD_ENCRYPTION_KEY)});
}

before(async()=>{
  await database.query("DROP SCHEMA public CASCADE");
  await database.query("CREATE SCHEMA public");
  await migrate(database);
  resetConfigForTests();
  await seedSynthetic();
  app=createApp({database,configuration});
});
after(async()=>{await database.end();});

describe("Phase 9 controlled data operations",()=>{
  it("DAT-001/002 previews and transactionally commits only the approved exact import",async()=>{
    const {agent,csrf}=await login();
    const preview=await agent.post("/api/data-imports/preview").set("x-csrf-token",csrf).send({
      recordType:"brand",sourceName:"Synthetic test CSV",csv:"name,website\nPhase Nine Brand,https://example.test",
      mapping:{name:"name",website:"website"},idempotencyKey:"dat-001-brand-import"
    });
    assert.equal(preview.status,201,preview.text);
    assert.equal(preview.body.summary.creates,1);
    const wrong=await agent.post(`/api/data-imports/${preview.body.id}/approve`)
      .set("x-csrf-token",csrf).send({
        reason:"Approval after reviewing the exact preview.",
        sourceDigest:"0".repeat(64),expectedRowCount:1,expectedCreateCount:1,
        expectedReviewCount:0,confirmation:"APPROVE IMPORT"
      });
    assert.equal(wrong.status,409);
    const detail=await agent.get(`/api/data-imports/${preview.body.id}`);
    const approved=await agent.post(`/api/data-imports/${preview.body.id}/approve`)
      .set("x-csrf-token",csrf).send({
        reason:"Approval after reviewing the exact preview.",
        sourceDigest:detail.body.preview.sourceDigest,expectedRowCount:1,expectedCreateCount:1,
        expectedReviewCount:0,confirmation:"APPROVE IMPORT"
      });
    assert.equal(approved.status,200,approved.text);
    assert.equal(approved.body.result.created,1);
    const record=await database.query(
      `SELECT identity_status,status,custom_fields FROM brands WHERE public_name='Phase Nine Brand'`
    );
    assert.equal(record.rows[0].identity_status,"unverified");
    assert.equal(record.rows[0].status,"discovered");
    assert.equal(record.rows[0].custom_fields.reviewRequired,true);
  });

  it("DAT-003 stages consequential imports without creating authority",async()=>{
    const {agent,csrf}=await login();
    const existing=await database.query(`SELECT id FROM brands ORDER BY created_at LIMIT 1`);
    const preview=await agent.post("/api/data-imports/preview").set("x-csrf-token",csrf).send({
      recordType:"representation_opportunity",sourceName:"Synthetic authority candidate",
      csv:`brandId\n${existing.rows[0].id}`,mapping:{brandId:"brandId"},
      idempotencyKey:"dat-003-authority-import"
    });
    assert.equal(preview.status,201,preview.text);
    assert.equal(preview.body.summary.reviewOnly,true);
    const detail=await agent.get(`/api/data-imports/${preview.body.id}`);
    const approved=await agent.post(`/api/data-imports/${preview.body.id}/approve`)
      .set("x-csrf-token",csrf).send({
        reason:"Reviewed as a candidate only with no authority effect.",
        sourceDigest:detail.body.preview.sourceDigest,expectedRowCount:1,expectedCreateCount:1,
        expectedReviewCount:0,confirmation:"APPROVE IMPORT"
      });
    assert.equal(approved.status,200,approved.text);
    assert.equal(approved.body.result.stagedForReview,1);
    const queue=await database.query(
      `SELECT authority_effect,status FROM import_review_items WHERE import_id=$1`,[preview.body.id]
    );
    assert.deepEqual(queue.rows[0],{authority_effect:"none_until_human_adoption",status:"pending"});
  });

  it("DAT-004 requires an explicit canonical merge and preserves the source record",async()=>{
    const {agent,csrf}=await login();
    const created=await agent.post("/api/records/brand").set("x-csrf-token",csrf)
      .send({name:"Phase Nine Brand Duplicate"});
    assert.equal(created.status,201,created.text);
    const records=await database.query(`SELECT id FROM brands ORDER BY created_at LIMIT 2`);
    assert.equal(records.rowCount,2);
    const preview=await agent.post("/api/duplicate-merges/preview").set("x-csrf-token",csrf).send({
      recordType:"brand",survivorId:records.rows[0].id,duplicateId:records.rows[1].id
    });
    assert.equal(preview.status,200,preview.text);
    assert.equal(preview.body.preservationPlan.mode,"canonical_alias");
    const confirmed=await agent.post("/api/duplicate-merges/confirm").set("x-csrf-token",csrf).send({
      recordType:"brand",survivorId:records.rows[0].id,duplicateId:records.rows[1].id,
      reason:"These records were manually compared and refer to one Brand.",confirmation:"MERGE RECORDS"
    });
    assert.equal(confirmed.status,201,confirmed.text);
    const preserved=await database.query(`SELECT id FROM brands WHERE id=$1`,[records.rows[1].id]);
    assert.equal(preserved.rowCount,1);
    const alias=await agent.get(`/api/record-aliases/brand/${records.rows[1].id}`);
    assert.equal(alias.body.canonicalId,records.rows[0].id);
    const reversed=await agent.post(`/api/duplicate-merges/${confirmed.body.id}/reverse`)
      .set("x-csrf-token",csrf).send({
        reason:"The duplicate determination was incorrect after additional human review.",
        confirmation:"REVERSE MERGE"
      });
    assert.equal(reversed.status,200,reversed.text);
    const restored=await agent.get(`/api/record-aliases/brand/${records.rows[1].id}`);
    assert.equal(restored.body.canonicalId,records.rows[1].id);
  });

  it("DAT-005/006 exports only the requesting workspace with a manifest and audit digest",async()=>{
    const {agent,csrf}=await login();
    const formula=await agent.post("/api/records/brand").set("x-csrf-token",csrf)
      .send({name:"=2+2"});
    assert.equal(formula.status,201,formula.text);
    const generated=await agent.post("/api/data-exports").set("x-csrf-token",csrf).send({
      scopes:["brands","products","evidence","audit","documents"],format:"json",includeDocuments:false
    });
    assert.equal(generated.status,202,generated.text);
    assert.equal(generated.body.status,"queued");
    await processWorkspaceExport(database,generated.body.id);
    const downloaded=await agent.get(`/api/data-exports/${generated.body.id}/download`);
    assert.equal(downloaded.status,200,downloaded.text);
    assert.equal(downloaded.body._manifest.workspaceId,downloaded.body.brands[0].workspace_id);
    assert.equal(downloaded.body._manifest.documentBytesIncluded,false);
    assert.ok(downloaded.headers["x-content-sha256"]);
    const csvRequest=await agent.post("/api/data-exports").set("x-csrf-token",csrf).send({
      scopes:["brands"],format:"csv_bundle",includeDocuments:false
    });
    await processWorkspaceExport(database,csvRequest.body.id);
    const zipped=await agent.get(`/api/data-exports/${csvRequest.body.id}/download`)
      .buffer(true).parse((response,callback)=>{
        const chunks:Buffer[]=[];
        response.on("data",(chunk:Buffer)=>chunks.push(chunk));
        response.on("end",()=>callback(null,Buffer.concat(chunks)));
      });
    assert.ok(zipped.headers["content-type"]);
    assert.match(zipped.headers["content-type"],/application\/zip/);
    const files=unzipSync(new Uint8Array(zipped.body as Buffer));
    assert.match(strFromU8(files["brands.csv"]!),/"'=2\+2"/);
  });

  it("DAT-007/008 reports honest launch blockers and requires staff MFA for operations",async()=>{
    const {agent,csrf}=await login("admin@synthetic.ryva.test",await adminCode());
    const operational=await agent.get("/api/admin/operational-status");
    assert.equal(operational.status,200,operational.text);
    assert.equal(operational.body.controls.supportImpersonation,false);
    const directory=await agent.get("/api/admin/access-directory")
      .query({email:"uncertified@synthetic.ryva.test"});
    assert.equal(directory.status,200,directory.text);
    const userId=directory.body.users[0].id;
    const disabled=await agent.patch(`/api/admin/users/${userId}/status`)
      .set("x-csrf-token",csrf).send({
        status:"disabled",reason:"Synthetic Phase 9 administrative control verification."
      });
    assert.equal(disabled.status,200,disabled.text);
    const restored=await agent.patch(`/api/admin/users/${userId}/status`)
      .set("x-csrf-token",csrf).send({
        status:"active",reason:"Restore synthetic user after administrative control verification."
      });
    assert.equal(restored.status,200,restored.text);
    const readiness=await agent.get("/api/launch-readiness");
    assert.equal(readiness.status,200,readiness.text);
    assert.equal(readiness.body.status,"Not Ready");
    assert.ok(readiness.body.blockers.length>0);
  });
});
