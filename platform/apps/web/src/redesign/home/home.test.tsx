import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  CommandCenter,
  CommandCenterBriefing,
  type CommandCenterData
} from "./CommandCenter";

const sampleData: CommandCenterData = {
  generatedAt: "2026-07-21T12:00:00.000Z",
  changedSince: "2026-07-20T12:00:00.000Z",
  priorities: [{
    key: "task:task-1",
    itemType: "task",
    itemId: "task-1",
    title: "Verify buyer route",
    reason: "Mandatory gate before outreach.",
    explanation: ["This is a mandatory human-controlled gate.", "Its due date is approaching."],
    priority: "critical",
    dueAt: "2026-07-21T18:00:00.000Z",
    href: "/tasks",
    nextAction: "Open or complete the task.",
    blocking: true
  }],
  today: [{
    key: "task:task-1",
    itemType: "task",
    itemId: "task-1",
    title: "Verify buyer route",
    reason: "Mandatory gate before outreach.",
    explanation: ["This is a mandatory human-controlled gate."],
    priority: "critical",
    dueAt: "2026-07-21T18:00:00.000Z",
    href: "/tasks",
    nextAction: "Open or complete the task.",
    blocking: true
  }],
  changes: [{
    targetId: "placement-1",
    targetType: "placement_opportunity",
    action: "stage_changed",
    occurredAt: "2026-07-21T10:00:00.000Z"
  }],
  pipeline: {
    stalled: 2,
    blocked: 1,
    lacking_next_action: 0,
    upcoming_reorders: 3
  },
  commercial: {
    orders: [{ currency: "USD", verified: "1200.00" }],
    commissions: [{ currency: "USD", expected: "120.00", approved: "100.00", payable: "80.00", paid: "20.00", disputed: "0.00", overdue: "0.00" }]
  },
  emptyWorkspace: false
};

const session = {
  access: { mode: "full", capabilities: ["operational:write"] },
  user: { name: "Avery Active" }
};

void describe("Ryva Command Center", () => {
  void it("renders ordered priority and change sections with explainable reasons", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <CommandCenter
          session={session}
          data={sampleData}
          loading={false}
          error=""
          saving=""
          briefing={{ available: false, error: "", creating: "" }}
          onReload={() => undefined}
          onAcknowledge={() => undefined}
          onPriorityAction={() => undefined}
          onBriefingGenerate={() => undefined}
        />
      </MemoryRouter>
    );
    assert.match(markup, /aria-label="Priority queue"/);
    assert.match(markup, /aria-label="Today/);
    assert.match(markup, /aria-label="Material changes since last visit"/);
    assert.match(markup, /Why this is prioritized/);
    assert.match(markup, /Rule-based · reasons visible · no scores/);
    assert.match(markup, /USD/);
    assert.match(markup, /Pipeline exceptions/);
  });

  void it("preserves honest empty and read-only states", () => {
    const emptyMarkup = renderToStaticMarkup(
      <MemoryRouter>
        <CommandCenter
          session={session}
          data={{
            ...sampleData,
            priorities: [],
            today: [],
            changes: [],
            commercial: { orders: [], commissions: [] },
            emptyWorkspace: true,
            pipeline: {}
          }}
          loading={false}
          error=""
          saving=""
          briefing={{ available: false, error: "", creating: "" }}
          onReload={() => undefined}
          onAcknowledge={() => undefined}
          onPriorityAction={() => undefined}
          onBriefingGenerate={() => undefined}
        />
      </MemoryRouter>
    );
    assert.match(emptyMarkup, /No operating records yet/);
    assert.match(emptyMarkup, /No verified commercial records/);
    assert.doesNotMatch(emptyMarkup, /Product Score/);

    const readOnlyMarkup = renderToStaticMarkup(
      <MemoryRouter>
        <CommandCenter
          session={{ access: { mode: "read_only", reason: "Credential grace is active.", capabilities: ["export:request"] }, user: { name: "Gale Grace" } }}
          data={sampleData}
          loading={false}
          error=""
          saving=""
          briefing={{ available: false, error: "", creating: "" }}
          onReload={() => undefined}
          onAcknowledge={() => undefined}
          onPriorityAction={() => undefined}
          onBriefingGenerate={() => undefined}
        />
      </MemoryRouter>
    );
    assert.match(readOnlyMarkup, /Read-only command center/);
    assert.match(readOnlyMarkup, /Credential grace is active/);
    assert.doesNotMatch(readOnlyMarkup, /Snooze 1 day/);
  });

  void it("keeps AI degradation visible without hiding deterministic priorities", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <CommandCenterBriefing
          canWrite
          available={false}
          error=""
          creating=""
          onGenerate={() => undefined}
        />
      </MemoryRouter>
    );
    assert.match(markup, /AI briefing is unavailable or disabled/);
    assert.match(markup, /Draft daily briefing/);
    assert.match(markup, /disabled/);
  });

  void it("keeps the command center stylesheet token-only", () => {
    const css = readFileSync(new URL("./home.css", import.meta.url), "utf8");
    assert.doesNotMatch(css, /#[\da-f]{3,8}\b/i);
    assert.doesNotMatch(css, /\b(?:rgb|rgba|hsl|hsla)\s*\(/i);
    assert.doesNotMatch(css, /\b(?:linear|radial|conic)-gradient\s*\(/i);
    assert.doesNotMatch(css, /backdrop-filter/i);
  });
});
