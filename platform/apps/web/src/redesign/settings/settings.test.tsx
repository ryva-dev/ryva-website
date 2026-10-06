import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { formatSessionClient } from "./sessionPresentation.ts";

void describe("Ryva settings suite", () => {
  void it("preserves Settings IA, API, concurrency, AI, and session contracts", () => {
    const source = readFileSync(new URL("./SettingsWorkspace.tsx", import.meta.url), "utf8");
    assert.match(source, /title="Settings"/);
    assert.match(source, /Profile & account/);
    assert.match(source, /activeSection.*profile|"profile"/);
    assert.match(source, /Evidence-first assistance/);
    assert.match(source, /Manual workflows remain available/);
    assert.match(source, /What Ryva AI can do/);
    assert.match(source, /What remains manual/);
    assert.doesNotMatch(source, /Control remains independent/);
    assert.doesNotMatch(source, /className="eyebrow"/);
    assert.match(source, /version: settings\.data\.settings\.version/);
    assert.match(source, /Preferences saved\.|AI settings saved\./);
    assert.match(source, /Read-only access/);
    assert.match(source, /Sign out this session/);
    assert.match(source, /Request account closure review/);
    assert.match(source, /ConfirmationDialog/);
    assert.match(source, /\/api\/account-closure/);
    assert.match(source, /A confirmation email has been queued/);
    assert.match(source, /\/api\/workspaces\/\$\{workspaceId\}\/profile/);
    assert.match(source, /firstName/);
    assert.match(source, /displayName/);
    assert.match(source, /\/api\/auth\/password/);
    assert.match(source, /\/api\/auth\/email/);
    assert.match(source, /Change password/);
    assert.match(source, /Change email/);
    assert.match(source, /Update password/);
    assert.match(source, /Update email/);
    assert.doesNotMatch(source, /Ask your workspace administrator/);
    assert.doesNotMatch(source, /workspace administrator/);
    assert.match(source, /providerTrainingAllowed: false/);
    assert.match(source, /autonomousActionsAllowed: false/);
  });

  void it("persists account identity through the existing profile API", () => {
    const settings = readFileSync(new URL("./SettingsWorkspace.tsx", import.meta.url), "utf8");
    const profile = readFileSync(new URL("./ProfileWorkspace.tsx", import.meta.url), "utf8");
    assert.match(settings, /method: "PUT"/);
    assert.match(settings, /firstName,/);
    assert.match(settings, /lastName,/);
    assert.match(settings, /name: displayName/);
    assert.match(settings, /await refresh\(\)/);
    assert.match(profile, /firstName/);
    assert.match(profile, /lastName/);
    assert.match(profile, /Display name/);
    assert.match(profile, /version: state\.data\.profile\.version/);
    assert.match(profile, /Profile saved\./);
  });

  void it("formats session clients without exposing raw user agents as the primary label", () => {
    assert.equal(formatSessionClient("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36").label, "Chrome on macOS");
    assert.equal(formatSessionClient(null).label, "Unknown device");
    assert.match(formatSessionClient("TotallyCustomAgent/1.0").label, /Unrecognized|Custom|Unknown|client/i);
  });

  void it("preserves canonical product access, profile, and staff legacy contracts", () => {
    const access = readFileSync(new URL("./AccessWorkspace.tsx", import.meta.url), "utf8");
    const profile = readFileSync(new URL("./ProfileWorkspace.tsx", import.meta.url), "utf8");
    const certification = readFileSync(new URL("./CertificationWorkspace.tsx", import.meta.url), "utf8");
    assert.match(access, /Your Ryva access/);
    assert.match(access, /Program completion/);
    assert.doesNotMatch(access, /\/api\/certification/);
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
    assert.match(source, /Program completion required/);
    assert.match(source, /\$20 per month/);
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
    assert.match(css, new RegExp(["--length-52", "rem|48rem"].join("")));
    assert.match(css, /flex-wrap:\s*wrap/);
    assert.doesNotMatch(css, /overflow-x:\s*(auto|scroll|hidden)/);
  });
});
