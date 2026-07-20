import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { Session } from "../../api";
import { buildShellNavigation, shellRouteLabel } from "./navigation";

function session(capabilities: string[], role = "representative"): Session {
  return {
    user: {
      id: "00000000-0000-4000-8000-000000000001",
      email: "synthetic@ryva.test",
      name: "Synthetic Representative",
      role,
      workspaceId: "00000000-0000-4000-8000-000000000002"
    },
    access: {
      mode: capabilities.includes("operational:read") ? "full" : "restricted",
      reason: "synthetic_test",
      credentialStatus: "active",
      subscriptionStatus: "active",
      graceEndsAt: null,
      capabilities
    }
  };
}

void describe("Ryva application shell", () => {
  void it("implements the approved navigation groups and labels in order", () => {
    const groups = buildShellNavigation(session([
      "operational:read",
      "export:request",
      "settings:read"
    ]));
    assert.deepEqual(groups.map((group) => group.label), [
      "Operate",
      "Intelligence",
      "Commercial",
      "Analyze",
      "System"
    ]);
    assert.deepEqual(groups[0]!.items.map((item) => item.label), [
      "Home",
      "Tasks",
      "Representation",
      "Placements",
      "Outreach"
    ]);
    assert.deepEqual(groups[1]!.items.map((item) => item.label), [
      "Products",
      "Brands",
      "Businesses & Buyers"
    ]);
    assert.deepEqual(groups[2]!.items.map((item) => item.label), [
      "Accounts",
      "Orders",
      "Reorders",
      "Commissions"
    ]);
    assert.deepEqual(groups[3]!.items.map((item) => item.label), ["Analytics", "Reports"]);
    assert.deepEqual(groups[4]!.items.map((item) => item.label), ["Documents", "Data transfer", "Settings"]);
  });

  void it("does not imply operational access for a restricted session", () => {
    const groups = buildShellNavigation(session(["export:request", "settings:read"]));
    assert.deepEqual(groups.map((group) => group.label), ["Access", "System"]);
    assert.deepEqual(groups.flatMap((group) => group.items.map((item) => item.label)), [
      "Access check",
      "Export",
      "Settings"
    ]);
  });

  void it("keeps contextual routes available without promoting them into global navigation", () => {
    assert.equal(shellRouteLabel("/copilot"), "AI Copilot");
    assert.equal(shellRouteLabel("/territories"), "Territories");
    assert.equal(shellRouteLabel("/records/contact"), "Contacts");
  });

  void it("uses only the approved token system in shell styling", () => {
    const css = readFileSync(new URL("./shell.css", import.meta.url), "utf8");
    assert.doesNotMatch(css, /#[\da-f]{3,8}\b/i);
    assert.doesNotMatch(css, /\b(?:rgb|rgba|hsl|hsla)\s*\(/i);
    assert.doesNotMatch(css, /\b(?:linear|radial|conic)-gradient\s*\(/i);
    assert.doesNotMatch(css, /backdrop-filter/i);
  });
});
