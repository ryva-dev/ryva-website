import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { wrapSqliteHandle } from "./dataStore.mjs";
import {
  buildEventsFromWeeklyPlan,
  buildEventsFromWeeklySchedule,
  ensureWeeklyPlanCalendarReady,
  ensureWeeklyScheduleCalendarReady,
  extractDayAnchoredActions,
  harvestWeeklyOutputToCalendar,
  stampCalendarHarvest
} from "./maraCalendarSync.mjs";

function makeStore() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE office_calendar_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      worker_slug TEXT,
      title TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      event_type TEXT NOT NULL DEFAULT 'Focus',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return wrapSqliteHandle(db);
}

test("ensureWeeklyPlanCalendarReady maps LLM priorities onto weekdays", () => {
  const ready = ensureWeeklyPlanCalendarReady({
    focusForTheWeek: "Land first reply",
    topPriorities: ["Draft Glow Theory pitch", "Film demo angle", "Clear inbox"]
  });
  const actions = extractDayAnchoredActions(ready);
  assert.equal(actions.length, 3);
  assert.equal(actions[0].day, "Monday");
  assert.match(actions[0].activity, /Glow Theory/);
  assert.ok(ready.dailySuggestedActions.every((line) => /^(Monday|Tuesday|Wednesday|Thursday|Friday):/.test(line)));
});

test("buildEventsFromWeeklyPlan creates focus blocks for day-anchored lines", () => {
  const monday = new Date("2026-07-13T08:00:00"); // Monday morning
  const { events } = buildEventsFromWeeklyPlan(
    {
      dailySuggestedActions: [
        "Monday: pitch Brand A",
        "Wednesday: follow up Brand B"
      ],
      priority: "Outreach"
    },
    { now: monday, outputId: "out-1" }
  );
  assert.equal(events.length, 2);
  assert.equal(events[0].title, "pitch Brand A");
  assert.equal(new Date(events[0].startsAt).getDay(), 1);
  assert.equal(events[0].eventType, "Focus");
});

test("LLM weekly_plan without day prefixes still yields calendar events", () => {
  const { events, structured } = buildEventsFromWeeklyPlan(
    {
      topPriorities: ["Research 5 brands", "Write pitches"],
      contentPlan: ["Film two hooks"]
    },
    { now: new Date("2026-07-13T08:00:00"), outputId: "out-2" }
  );
  assert.ok(events.length >= 3);
  assert.ok(structured.calendarSyncedAt == null);
  assert.ok(structured.dailySuggestedActions.length >= 3);
});

test("ensureWeeklyScheduleCalendarReady fills default timed blocks when LLM omits them", () => {
  const ready = ensureWeeklyScheduleCalendarReady({ weekTheme: "Ship week" }, { niche: "skincare" });
  assert.ok(ready.blocks.length >= 5);
  assert.ok(ready.blocks.every((block) => block.day && block.start && block.end && block.activity));
});

test("buildEventsFromWeeklySchedule places timed blocks on calendar", () => {
  const { events } = buildEventsFromWeeklySchedule(
    {
      blocks: [
        { day: "Tuesday", start: "10:00", end: "12:00", activity: "Filming", goal: "3 concepts" }
      ]
    },
    { now: new Date("2026-07-13T08:00:00"), outputId: "out-3" }
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].title, "Filming");
  assert.equal(new Date(events[0].startsAt).getDay(), 2);
  assert.equal(new Date(events[0].startsAt).getHours(), 10);
});

test("stampCalendarHarvest only marks synced when events were created or content was empty", () => {
  const synced = stampCalendarHarvest({}, { created: 3, ensuredHadContent: true });
  assert.ok(synced.calendarSyncedAt);
  assert.equal(synced.calendarEventsCreated, 3);

  const failed = stampCalendarHarvest({}, { created: 0, ensuredHadContent: true });
  assert.equal(failed.calendarSyncedAt, undefined);
  assert.equal(failed.calendarSyncSkipReason, "build_failed");

  const empty = stampCalendarHarvest({}, { created: 0, ensuredHadContent: false });
  assert.ok(empty.calendarSyncedAt);
  assert.equal(empty.calendarSyncSkipReason, "no_calendar_content");
});

test("harvestWeeklyOutputToCalendar persists plan events idempotently", async () => {
  const store = makeStore();
  const first = await harvestWeeklyOutputToCalendar(store, {
    userId: "u1",
    workerSlug: "mara-vale",
    outputId: "plan-1",
    outputType: "weekly_plan",
    structured: {
      dailySuggestedActions: ["Monday: outreach", "Tuesday: film"]
    },
    now: new Date("2026-07-13T08:00:00")
  });
  assert.ok(first.created >= 2);
  assert.ok(first.structured.calendarSyncedAt);

  const rows = await store.query(`SELECT title FROM office_calendar_events WHERE user_id = ?`, "u1");
  assert.equal(rows.length, first.created);

  const second = await harvestWeeklyOutputToCalendar(store, {
    userId: "u1",
    workerSlug: "mara-vale",
    outputId: "plan-1",
    outputType: "weekly_plan",
    structured: first.structured,
    now: new Date("2026-07-13T08:00:00")
  });
  assert.equal(second.skipped, true);
  assert.equal(second.created, 0);
  const after = await store.query(`SELECT title FROM office_calendar_events WHERE user_id = ?`, "u1");
  assert.equal(after.length, rows.length);
});
