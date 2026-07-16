import assert from "node:assert/strict";
import test from "node:test";
import {
  assertIntegrationCatalogIntegrity,
  getIntegrationDefinition,
  INTEGRATION_CAPABILITIES,
  listIntegrationCatalog
} from "./integrationCatalog.mjs";

test("integration catalog has unique, valid provider contracts", () => {
  const entries = listIntegrationCatalog();
  assert.equal(assertIntegrationCatalogIntegrity(entries), true);
  assert.equal(new Set(entries.map((entry) => entry.id)).size, entries.length);
});

test("Gmail grants Mara read context but no provider write capability", () => {
  const gmail = getIntegrationDefinition("gmail");
  assert.deepEqual(gmail.capabilities, [INTEGRATION_CAPABILITIES.INBOX_READ]);
  assert.equal(gmail.limitations.some((item) => /never creates Gmail drafts/i.test(item)), true);
});

test("social connectors distinguish owned data from public discovery and trends", () => {
  const tiktok = getIntegrationDefinition("tiktok");
  assert.equal(tiktok.capabilities.includes(INTEGRATION_CAPABILITIES.OWN_CONTENT_READ), true);
  assert.equal(tiktok.capabilities.includes(INTEGRATION_CAPABILITIES.TREND_SIGNALS_READ), false);

  const youtube = getIntegrationDefinition("youtube");
  assert.equal(youtube.capabilities.includes(INTEGRATION_CAPABILITIES.PUBLIC_CONTENT_DISCOVERY), true);
  assert.equal(youtube.capabilities.includes(INTEGRATION_CAPABILITIES.TREND_SIGNALS_READ), true);
});

test("Obsidian is represented truthfully as a companion integration", () => {
  const obsidian = getIntegrationDefinition("obsidian");
  assert.equal(obsidian.implementationStatus, "companion_required");
  assert.equal(obsidian.authorization, "desktop_companion");
});
