import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { wrapSqliteHandle } from "./dataStore.mjs";
import {
  buildEventsFromWeeklyPlan,
  buildEventsFromWeeklySchedule,
  ensureWeeklyPlanCalendarReady,
  formatWeeklyPlanForRequestedRange,
  ensureWeeklyScheduleCalendarReady,
  extractDayAnchoredActions,
  harvestWeeklyOutputToCalendar,
  inferWeeklyPlanRange,
  stampCalendarHarvest
} from "./maraCalendarSync.mjs";

function localClock(date, timeZone) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date).map((part) => [part.type, part.value]));
}

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

test("a midweek through-Sunday request stays in the current week and uses the creator timezone", () => {
  const now = new Date("2026-07-15T18:50:00.000Z"); // Wednesday 2:50 PM in New York
  const range = inferWeeklyPlanRange("Create a weekly plan for this week up until Sunday", {
    now,
    timeZone: "America/New_York"
  });
  assert.deepEqual(range, {
    planStartDate: "2026-07-15",
    planEndDate: "2026-07-19",
    timeZone: "America/New_York"
  });
  const { events } = buildEventsFromWeeklyPlan({
    ...range,
    dailySuggestedActions: [
      "Wednesday: choose this week's revenue priority",
      "Thursday: prepare two reachable-brand pitches",
      "Friday: film one portfolio proof piece",
      "Saturday: edit and review the proof piece",
      "Sunday: review outcomes and set next steps"
    ]
  }, { now, outputId: "range-1", timeZone: range.timeZone });
  assert.equal(events.length, 5);
  assert.deepEqual(events.map((event) => localClock(new Date(event.startsAt), range.timeZone).day), ["15", "16", "17", "18", "19"]);
  assert.equal(localClock(new Date(events[1].startsAt), range.timeZone).hour, "09");
});

test("a full-week response is rendered and scheduled only inside a midweek requested range", () => {
  const structured = {
    planStartDate: "2026-07-15",
    planEndDate: "2026-07-19",
    timeZone: "America/New_York",
    dailySuggestedActions: [
      "Monday: define the revenue goal",
      "Tuesday: prepare outreach assets",
      "Wednesday: send three pitches",
      "Thursday: film a proof piece",
      "Friday: follow up"
    ]
  };
  const content = formatWeeklyPlanForRequestedRange(structured);
  assert.match(content, /from Wednesday through Sunday/);
  assert.doesNotMatch(content, /\*\*Monday\*\*|\*\*Tuesday\*\*/);
  for (const day of ["Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]) {
    assert.match(content, new RegExp(`\\*\\*${day}\\*\\*`));
  }
  const { events } = buildEventsFromWeeklyPlan(structured, {
    now: new Date("2026-07-15T18:50:00.000Z"),
    outputId: "remapped-1",
    timeZone: "America/New_York"
  });
  assert.equal(events.length, 5);
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

test("weekly schedule times are interpreted in the creator timezone", () => {
  const { events } = buildEventsFromWeeklySchedule({
    blocks: [{ day: "Thursday", start: "10:00", end: "12:00", activity: "Film" }]
  }, {
    now: new Date("2026-07-15T18:50:00.000Z"),
    outputId: "tz-1",
    timeZone: "America/New_York"
  });
  assert.equal(localClock(new Date(events[0].startsAt), "America/New_York").hour, "10");
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

test("a new weekly plan replaces only Mara's older future plan blocks", async () => {
  const store = makeStore();
  const now = new Date("2026-07-15T18:50:00.000Z");
  const oldEvents = buildEventsFromWeeklyPlan({
    planStartDate: "2026-07-15",
    planEndDate: "2026-07-19",
    timeZone: "America/New_York",
    dailySuggestedActions: ["Thursday: old pitch block", "Friday: old filming block"]
  }, { now, outputId: "old-plan", timeZone: "America/New_York" }).events;
  await harvestWeeklyOutputToCalendar(store, {
    userId: "u1",
    workerSlug: "mara-vale",
    outputId: "old-plan",
    outputType: "weekly_plan",
    structured: {
      planStartDate: "2026-07-15",
      planEndDate: "2026-07-19",
      timeZone: "America/New_York",
      dailySuggestedActions: ["Thursday: old pitch block", "Friday: old filming block"]
    },
    now,
    timeZone: "America/New_York"
  });
  await store.execute(
    `INSERT INTO office_calendar_events
      (id, user_id, worker_slug, title, starts_at, ends_at, event_type, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    "manual-1", "u1", "mara-vale", "Creator meeting", oldEvents[0].startsAt,
    oldEvents[0].endsAt, "Meeting", "Added by creator", now.toISOString(), now.toISOString()
  );

  await harvestWeeklyOutputToCalendar(store, {
    userId: "u1",
    workerSlug: "mara-vale",
    outputId: "new-plan",
    outputType: "weekly_plan",
    structured: {
      planStartDate: "2026-07-15",
      planEndDate: "2026-07-19",
      timeZone: "America/New_York",
      dailySuggestedActions: ["Thursday: new revenue block", "Sunday: review outcomes"]
    },
    now,
    timeZone: "America/New_York"
  });

  const rows = await store.query(`SELECT title, notes FROM office_calendar_events WHERE user_id = ? ORDER BY title`, "u1");
  assert.ok(rows.some((row) => row.title === "Creator meeting"));
  assert.ok(rows.some((row) => row.title === "new revenue block"));
  assert.ok(rows.some((row) => row.title === "review outcomes"));
  assert.ok(rows.some((row) => row.notes === "Added by creator"));
  assert.ok(rows.every((row) => !String(row.notes).includes("old-plan")));
});
