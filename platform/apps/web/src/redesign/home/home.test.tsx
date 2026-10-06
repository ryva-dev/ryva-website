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
    explanation: ["This is a mandatory controlled gate.", "Its due date is approaching."],
    priority: "critical",
    dueAt: "2026-07-21T18:00:00.000Z",
    href: "/tasks",
    nextAction: "Open or complete the task.",
    blocking: true
  }],
  today: [{
    key: "reorder:reorder-1",
    itemType: "reorder",
    itemId: "reorder-1",
    title: "Reorder review: Increment14 Business acct-chromium-desktop-1784734596469",
    reason: "The recorded reorder window is approaching.",
    explanation: ["This is a recorded window, not a predicted purchase."],
    priority: "high",
    dueAt: "2026-07-21T18:00:00.000Z",
    href: "/reorders",
    nextAction: "Review Account and reorder evidence.",
    blocking: false
  }],
  changes: [{
    targetId: "placement-1",
    targetType: "placement_opportunity",
    action: "stage_changed",
    occurredAt: "2026-07-21T10:00:00.000Z"
  }, {
    targetId: "eval-1",
    targetType: "authority_evaluation",
    action: "authority.placement_stage.authorized",
    occurredAt: "2026-07-21T09:00:00.000Z"
  }],
  pipeline: {
    stalled: 2,
    blocked: 1,
    lacking_next_action: 0,
    upcoming_reorders: 3,
    active_accounts: 28,
    at_risk_accounts: 0,
    overdue_reorders: 2
  },
  stageDistribution: [
    { stage: "identified", count: 8 },
    { stage: "qualified", count: 4 },
    { stage: "prepared", count: 2 },
    { stage: "contacted", count: 9 },
    { stage: "engaged", count: 5 },
    { stage: "information_sample_sent", count: 2 },
    { stage: "buyer_review", count: 3 },
    { stage: "terms_order_discussion", count: 2 },
    { stage: "opening_order", count: 2 },
    { stage: "active_account", count: 2 },
    { stage: "reorder_management", count: 3 }
  ],
  pipelineComparison: {
    month: 12,
    quarter: null,
    ytd: -4
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
  void it("offers a complete platform guide from a quiet Home action", () => {
    const home = readFileSync(new URL("./CommandCenter.tsx", import.meta.url), "utf8");
    const guide = readFileSync(new URL("./PlatformGuide.tsx", import.meta.url), "utf8");
    assert.match(home, />\s*Platform guide\s*<\/Button>/);
    assert.match(guide, /How to use the Ryva platform/);
    assert.match(guide, /Build your commercial foundation/);
    assert.match(guide, /Establish representation authority/);
    assert.match(guide, /Prepare and record outreach/);
    assert.match(guide, /Preserve orders and commercial continuity/);
    assert.match(guide, /Account, access, and getting unstuck/);
    assert.match(guide, /support@ryvaforge\.com/);
  });

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
    assert.match(markup, /View priority queue/);
    assert.match(markup, /ry-command-queue-row/);
    assert.match(markup, /ry-command-preview-footer/);
    assert.match(markup, /aria-label="Upcoming activities"/);
    assert.match(markup, /View today’s tasks/);
    assert.match(markup, /href="\/tasks"/);
    assert.match(markup, /ry-command-activity-row/);
    assert.match(markup, /Increment14 Business/);
    assert.doesNotMatch(markup, /acct-chromium-desktop-1784734596469/);
    assert.match(markup, /ry-command-row-mark/);
    assert.match(markup, /aria-label="Material changes since last visit"/);
    assert.match(markup, /href="\/placements\/placement-1"/);
    assert.match(markup, /href="\/placements"/);
    assert.match(markup, /Authority Placement Stage Authorized/);
    assert.doesNotMatch(markup, /View activity/);
    assert.doesNotMatch(markup, /Why this is prioritized/);
    assert.doesNotMatch(markup, /Snooze 1 day/);
    assert.doesNotMatch(markup, /Dismiss with reason/);
    assert.doesNotMatch(markup, /ry-command-urgency|is-blocking|ry-command-reprioritize|ry-select|PriorityQueueItem|ry-command-today-list|ry-command-priority-item/);
    assert.doesNotMatch(markup, /All tasks/);
    assert.match(markup, /42 opportunities across 6 stages/);
    assert.match(markup, /Placement pipeline/);
    assert.match(markup, /View analytics/);
    assert.match(markup, /Prospects/);
    assert.match(markup, /\+12% vs last month/);
    assert.match(markup, />14</);
    assert.match(markup, />9</);
    assert.match(markup, />7</);
    assert.match(markup, />5</);
    assert.match(markup, />4</);
    assert.match(markup, />3</);
    assert.doesNotMatch(markup, /active placements/);
    assert.doesNotMatch(markup, /No next action 28|Stalled 28/);
    assert.match(markup, /USD/);
    assert.match(markup, /Verified revenue/);
    assert.match(markup, /View commissions/);
    assert.doesNotMatch(markup, /Verified wholesale actual|Expected estimate|Paid actual/);
    assert.match(markup, /At a glance/);
    assert.match(markup, /Stalled opportunities/);
    assert.match(markup, /Account relationships/);
    assert.match(markup, /View accounts/);
    assert.match(markup, /Needs attention/);
    assert.doesNotMatch(markup, /All accounts/);
    assert.doesNotMatch(markup, /Rule-based/);
    assert.doesNotMatch(markup, /moving your business forward/);
    assert.doesNotMatch(markup, /quiet-tag|ry-status-label/);

    const multiCurrencyMarkup = renderToStaticMarkup(
      <MemoryRouter>
        <CommandCenter
          session={session}
          data={{
            ...sampleData,
            commercial: {
              orders: [
                { currency: "USD", verified: "100.00" },
                { currency: "EUR", verified: "0.00" }
              ],
              commissions: [
                { currency: "USD", expected: "10.00", approved: "10.00", payable: "0.00", paid: "10.00", disputed: "0.00", overdue: "0.00" },
                { currency: "EUR", expected: "0.00", approved: "0.00", payable: "0.00", paid: "0.00", disputed: "0.00", overdue: "0.00" }
              ]
            }
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
    assert.match(multiCurrencyMarkup, /aria-labelledby="commercial-USD"/);
    assert.doesNotMatch(multiCurrencyMarkup, /aria-labelledby="commercial-EUR"/);

    const euroSalesMarkup = renderToStaticMarkup(
      <MemoryRouter>
        <CommandCenter
          session={session}
          data={{
            ...sampleData,
            commercial: {
              orders: [
                { currency: "USD", verified: "100.00" },
                { currency: "EUR", verified: "200.00" }
              ],
              commissions: [
                { currency: "USD", expected: "10.00", approved: "10.00", payable: "0.00", paid: "10.00", disputed: "0.00", overdue: "0.00" },
                { currency: "EUR", expected: "20.00", approved: "20.00", payable: "0.00", paid: "20.00", disputed: "0.00", overdue: "0.00" }
              ]
            }
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
    assert.match(euroSalesMarkup, /aria-labelledby="commercial-USD"/);
    assert.match(euroSalesMarkup, /aria-labelledby="commercial-EUR"/);
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
            pipeline: {},
            stageDistribution: [],
            pipelineComparison: { month: null, quarter: null, ytd: null }
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
    assert.match(emptyMarkup, /No opportunities have entered the pipeline yet/);
    assert.match(emptyMarkup, /Add opportunity/);
    assert.match(emptyMarkup, /No new activity since your last visit/);
    assert.match(emptyMarkup, /ry-command-activity-empty/);
    assert.doesNotMatch(emptyMarkup, /View analytics/);
    assert.doesNotMatch(emptyMarkup, /vs last month/);
    assert.doesNotMatch(emptyMarkup, /Product Score/);
    assert.doesNotMatch(emptyMarkup, /No material changes since the last acknowledged visit/);

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

  void it("hides AI briefing on Home when the feature is unavailable", () => {
    const homeMarkup = renderToStaticMarkup(
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
    assert.match(homeMarkup, /Priority queue/);
    assert.doesNotMatch(homeMarkup, /AI priority review|AI briefing is unavailable|deterministic Home actions|evidence-labelled|Known limitations|Copilot history|Draft daily briefing/);

    const briefingMarkup = renderToStaticMarkup(
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
    assert.equal(briefingMarkup, "");
  });

  void it("keeps the command center stylesheet token-only", () => {
    const css = readFileSync(new URL("./home.css", import.meta.url), "utf8");
    assert.doesNotMatch(css, /#[\da-f]{3,8}\b/i);
    assert.doesNotMatch(css, /\b(?:rgb|rgba|hsl|hsla)\s*\(/i);
    assert.doesNotMatch(css, /\b(?:linear|radial|conic)-gradient\s*\(/i);
    assert.doesNotMatch(css, /backdrop-filter/i);
  });
});
