import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

void describe("Ryva settings suite", () => {
  void it("preserves Settings API, concurrency, AI, and session contracts", () => {
    const source = readFileSync(new URL("./SettingsWorkspace.tsx", import.meta.url), "utf8");
    assert.match(source, /title="Settings"/);
    assert.match(source, /Evidence-first AI assistance/);
    assert.match(source, /Manual workflows remain available/);
    assert.match(source, /version: settings\.data\.settings\.version/);
    assert.match(source, /Settings saved\./);
    assert.match(source, /Read-only access/);
    assert.match(source, /Sign out this session/);
    assert.match(source, /Request account closure review/);
    assert.match(source, /ConfirmationDialog/);
    assert.match(source, /\/api\/account-closure/);
  });

  void it("preserves access, profile, and certification contracts", () => {
    const access = readFileSync(new URL("./AccessWorkspace.tsx", import.meta.url), "utf8");
    const profile = readFileSync(new URL("./ProfileWorkspace.tsx", import.meta.url), "utf8");
    const certification = readFileSync(new URL("./CertificationWorkspace.tsx", import.meta.url), "utf8");
    assert.match(access, /Your Ryva Pro access/);
    assert.match(access, /\/api\/certification/);
    assert.match(profile, /title="Profile"/);
    assert.match(profile, /version: state\.data\.profile\.version/);
    assert.match(profile, /Profile saved\./);
    assert.match(profile, /Read-only access/);
    assert.match(certification, /title="Certification"/);
    assert.match(certification, /\/api\/certification\/refresh/);
  });

  void it("preserves activation and secure billing redirects", () => {
    const source = readFileSync(new URL("./SubscriptionWorkspace.tsx", import.meta.url), "utf8");
    assert.match(source, /title=\{activation \? "Ryva Pro subscription" : "Subscription"\}/);
    assert.match(source, /\/api\/subscription\/\$\{kind\}/);
    assert.match(source, /window\.location\.assign/);
    assert.doesNotMatch(source, /Stripe/);
  });

  void it("exports settings workspace pages and uses responsive token CSS", () => {
    const index = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    const css = readFileSync(new URL("./settings.css", import.meta.url), "utf8");
    assert.match(index, /SettingsWorkspacePage/);
    assert.match(index, /AccessWorkspacePage/);
    assert.match(index, /ProfileWorkspacePage/);
    assert.match(index, /CertificationWorkspacePage/);
    assert.match(index, /SubscriptionWorkspacePage/);
    assert.match(css, /64rem/);
    assert.match(css, /48rem/);
    assert.doesNotMatch(css, /overflow-x:\s*hidden/);
  });
});
