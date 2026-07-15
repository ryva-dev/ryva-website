import assert from "node:assert/strict";
import Database from "better-sqlite3";
import test from "node:test";
import { appendActionAuditEvent, evaluateActionPolicy, initActionAudit } from "./actionPolicy.mjs";
import { wrapSqliteHandle } from "./dataStore.mjs";

test("external work requires integration authority and exact approval", () => {
  const denied = evaluateActionPolicy({ actionType: "send_email", integrationConnected: true, permissions: { canUseConnectedIntegrations: true, canSendEmailsWithApproval: true, approvalRequiredForExternalActions: true } });
  assert.equal(denied.allowed, false);
  assert.equal(denied.approvalRequired, true);
  const allowed = evaluateActionPolicy({ actionType: "send_email", integrationConnected: true, approvalId: "approval-1", permissions: { canUseConnectedIntegrations: true, canSendEmailsWithApproval: true, approvalRequiredForExternalActions: true } });
  assert.equal(allowed.allowed, true);
});

test("Mara can never receive email-send authority", () => {
  const result = evaluateActionPolicy({ actionType: "send_email", workerId: "mara-vale", integrationConnected: true, approvalId: "approval-1", permissions: { canUseConnectedIntegrations: true, canSendEmailsWithApproval: true, approvalRequiredForExternalActions: true } });
  assert.equal(result.allowed, false);
  assert.match(result.reasons.join(" "), /never sends external communication/);
});

test("external actions require action-specific authority", () => {
  const base = { canUseConnectedIntegrations: true, approvalRequiredForExternalActions: true };
  assert.equal(evaluateActionPolicy({ actionType: "send_email", permissions: base, integrationConnected: true, approvalId: "a1" }).allowed, false);
  assert.equal(evaluateActionPolicy({ actionType: "spend_money", permissions: { ...base, canSendEmailsWithApproval: true }, integrationConnected: true, approvalId: "a1" }).allowed, false);
  assert.equal(evaluateActionPolicy({ actionType: "update_external_record", permissions: { ...base, canUpdateExternalTrackers: true }, integrationConnected: true, approvalId: "a1" }).allowed, true);
});

test("audit events are hash-chained and append-only", async () => {
  const db = new Database(":memory:");
  const store = wrapSqliteHandle(db);
  await initActionAudit(store);
  const first = await appendActionAuditEvent(store, { userId: "u1", workerId: "w1", actionType: "research", decision: "allowed", policyVersion: "1" });
  await appendActionAuditEvent(store, { userId: "u1", workerId: "w1", actionType: "research", decision: "allowed", policyVersion: "1" });
  const second = db.prepare("SELECT previous_event_hash AS previousHash FROM action_audit_events ORDER BY created_at DESC, id DESC LIMIT 1").get();
  assert.equal(second.previousHash, first.eventHash);
  assert.throws(() => db.prepare("UPDATE action_audit_events SET decision = 'denied'").run(), /append-only/);
  db.close();
});
