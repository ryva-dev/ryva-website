import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { Session } from "../../api";
import { buildShellNavigation, mobileBottomNavigation, shellDocumentTitle, shellItemIsActive, shellRouteLabel } from "./navigation";

function session(capabilities: string[], role = "representative"): Session {
  const hasProgram = capabilities.includes("program:read") || capabilities.includes("operational:read");
  return {
    user: {
      id: "00000000-0000-4000-8000-000000000001",
      email: "synthetic@ryva.test",
      name: "Synthetic Representative",
      role,
      workspaceId: "00000000-0000-4000-8000-000000000002"
    },
    access: {
      mode: capabilities.includes("operational:read") ? "full" : capabilities.includes("program:read") ? "program_only" : "account_only",
      reason: "synthetic_test",
      canAccessProgram: hasProgram,
      isProgramCompleted: capabilities.includes("operational:read"),
      canAccessOperatingPlatform: capabilities.includes("operational:read"),
      isProTrialActive: false,
      isProActive: capabilities.includes("operational:read"),
      programStatus: hasProgram ? "active" : null,
      programCompletedAt: capabilities.includes("operational:read") ? "2026-08-01T00:00:00.000Z" : null,
      proTrialStartedAt: null,
      proTrialEndsAt: null,
      proAccessState: capabilities.includes("operational:read") ? "subscription_active" : "not_eligible",
      subscriptionStatus: "active",
      capabilities
    }
  };
}

void describe("Ryva application shell", () => {
  void it("implements the approved navigation groups and labels in order", () => {
    const groups = buildShellNavigation(session([
      "program:read",
      "operational:read",
      "export:request",
      "settings:read"
    ]));
    assert.deepEqual(groups.map((group) => group.label), [
      "Learn",
      "Operate",
      "Intelligence",
      "Commercial",
      "Analyze",
      "System"
    ]);
    assert.deepEqual(groups[0]!.items.map((item) => item.label), ["The Ryva Program"]);
    assert.deepEqual(groups[1]!.items.map((item) => item.label), [
      "Home",
      "Tasks",
      "Representation",
      "Placements",
      "Outreach"
    ]);
    assert.deepEqual(groups[2]!.items.map((item) => item.label), [
      "Products",
      "Brands",
      "Businesses & Buyers"
    ]);
    assert.deepEqual(groups[3]!.items.map((item) => item.label), [
      "Accounts",
      "Orders",
      "Reorders",
      "Commissions"
    ]);
    assert.deepEqual(groups[4]!.items.map((item) => item.label), ["Analytics"]);
    assert.deepEqual(groups[5]!.items.map((item) => item.label), ["Documents", "Data transfer", "Settings"]);
  });

  void it("does not imply operational access for a restricted session", () => {
    const groups = buildShellNavigation(session(["export:request", "settings:read"]));
    assert.deepEqual(groups.map((group) => group.label), ["Access", "System"]);
    assert.deepEqual(groups.flatMap((group) => group.items.map((item) => item.label)), [
      "Product access",
      "Export",
      "Settings"
    ]);
  });

  void it("shows Program navigation without implying operating access", () => {
    const groups = buildShellNavigation(session(["program:read", "settings:read"]));
    assert.deepEqual(groups.map((group) => group.label), ["Program", "System"]);
    assert.equal(groups[0]!.items[0]!.to, "/app/program");
    assert.equal(groups.flatMap((group) => group.items).some((item) => item.to === "/app/access"), false);
  });

  void it("keeps contextual routes available without promoting them into global navigation", () => {
    assert.equal(shellRouteLabel("/copilot"), "AI Copilot");
    assert.equal(shellRouteLabel("/territories"), "Territories");
    assert.equal(shellRouteLabel("/records/contact"), "Contacts");
  });

  void it("derives document titles and mobile bottom destinations from shared metadata", () => {
    assert.equal(shellDocumentTitle("/app"), "Home · Ryva Pro");
    assert.equal(shellDocumentTitle("/app/analytics", "?view=reports"), "Analytics · Ryva Pro");
    assert.equal(shellDocumentTitle("/app/analytics", "?view=definitions"), "Metric guide · Ryva Pro");
    assert.equal(shellDocumentTitle("/login"), "Sign in · Ryva");
    assert.deepEqual(mobileBottomNavigation.map((item) => item.to), ["/app", "/app/tasks", "/app/placements"]);
  });

  void it("keeps Analytics active across Analytics tabs including Reports", () => {
    const analytics = { label: "Analytics", to: "/app/analytics", icon: "analytics" as const };
    assert.equal(shellItemIsActive(analytics, "/app/analytics", ""), true);
    assert.equal(shellItemIsActive(analytics, "/app/analytics", "?view=reports"), true);
    assert.equal(shellItemIsActive(analytics, "/app/analytics", "?view=pipeline"), true);
    assert.equal(shellItemIsActive(analytics, "/app/orders", ""), false);
  });

  void it("uses only the approved token system in shell styling", () => {
    const css = readFileSync(new URL("./shell.css", import.meta.url), "utf8");
    assert.doesNotMatch(css, /#[\da-f]{3,8}\b/i);
    assert.doesNotMatch(css, /\b(?:rgb|rgba|hsl|hsla)\s*\(/i);
    assert.doesNotMatch(css, /\b(?:linear|radial|conic)-gradient\s*\(/i);
    assert.doesNotMatch(css, /backdrop-filter/i);
  });
});
