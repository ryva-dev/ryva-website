/**
 * Turn Mara weekly_plan / weekly_schedule outputs into office_calendar_events.
 * Pure planners are testable; persist helpers write through the async store.
 */

import { randomUUID } from "node:crypto";

const DAY_INDEX = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6
};

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const WEEKDAY_LINE =
  /^\s*(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\s*[:\-–—]\s*(.+)$/i;

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

function nowIso() {
  return new Date().toISOString();
}

function asStringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry ?? "").trim()).filter(Boolean);
}

/**
 * Pull "Monday: do X" lines from every string array on the structured payload.
 */
export function extractDayAnchoredActions(structured = {}) {
  const actions = [];
  for (const value of Object.values(structured || {})) {
    if (!Array.isArray(value)) continue;
    for (const entry of value) {
      if (entry && typeof entry === "object") {
        const day = String(entry.day ?? "").trim();
        const activity = String(entry.activity ?? entry.action ?? entry.task ?? "").trim();
        if (DAY_INDEX[day] !== undefined && activity) {
          actions.push({ day, activity });
        }
        continue;
      }
      const match = WEEKDAY_LINE.exec(String(entry ?? ""));
      if (!match) continue;
      const day = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
      actions.push({ day, activity: match[2].trim() });
    }
  }
  return actions;
}

/**
 * If the plan has priorities/tasks but no day anchors, map them onto Mon–Fri
 * so the calendar is never empty for a real plan.
 */
export function fallbackDayActionsFromPlan(structured = {}) {
  const pools = [
    ...asStringList(structured.dailySuggestedActions),
    ...asStringList(structured.topPriorities),
    ...asStringList(structured.outreachPlan),
    ...asStringList(structured.contentPlan),
    ...asStringList(structured.outreachTasks),
    ...asStringList(structured.contentTasks),
    ...asStringList(structured.adminTasks),
    ...asStringList(structured.followUpTasks)
  ].filter((line) => !WEEKDAY_LINE.test(line));

  return pools.slice(0, 10).map((activity, index) => ({
    day: WEEKDAYS[index % WEEKDAYS.length],
    activity
  }));
}

/**
 * Ensure weekly_plan structured content always has calendar-ready day lines.
 * Safe to call on template and LLM outputs.
 */
export function ensureWeeklyPlanCalendarReady(structured = {}) {
  const next = { ...(structured && typeof structured === "object" ? structured : {}) };
  const existing = extractDayAnchoredActions(next);
  if (existing.length > 0) {
    if (!Array.isArray(next.dailySuggestedActions) || next.dailySuggestedActions.length === 0) {
      next.dailySuggestedActions = existing.map((item) => `${item.day}: ${item.activity}`);
    }
    return next;
  }

  const fallback = fallbackDayActionsFromPlan(next);
  if (fallback.length === 0) {
    next.dailySuggestedActions = [
      "Monday: tighten outreach assets",
      "Tuesday: draft creator content concepts",
      "Wednesday: review follow-ups and open blockers",
      "Thursday: refine pitches or replies",
      "Friday: package next-week priorities"
    ];
    return next;
  }

  next.dailySuggestedActions = fallback.map((item) => `${item.day}: ${item.activity}`);
  return next;
}

export function normalizeScheduleBlocks(structured = {}) {
  const raw = Array.isArray(structured?.blocks) ? structured.blocks : [];
  const blocks = [];
  for (const block of raw.slice(0, 20)) {
    const dayRaw = String(block?.day ?? "").trim();
    const day =
      dayRaw.charAt(0).toUpperCase() + dayRaw.slice(1).toLowerCase();
    const start = String(block?.start ?? "").trim();
    const end = String(block?.end ?? "").trim();
    const activity = String(block?.activity ?? "").trim();
    if (DAY_INDEX[day] === undefined || !TIME_RE.test(start) || !TIME_RE.test(end) || !activity) {
      continue;
    }
    blocks.push({
      day,
      start,
      end,
      activity,
      goal: String(block?.goal ?? "").trim()
    });
  }
  return blocks;
}

/**
 * Default realistic creator week when LLM/template omitted valid blocks.
 */
export function defaultWeeklyScheduleBlocks({ niche = "UGC" } = {}) {
  const label = String(niche || "UGC").trim() || "UGC";
  return [
    { day: "Monday", start: "09:00", end: "10:30", activity: "Outreach block", goal: "Draft or send 3–5 brand pitches" },
    { day: "Monday", start: "19:00", end: "19:45", activity: "Posting slot", goal: `Publish one ${label} piece` },
    { day: "Tuesday", start: "10:00", end: "12:00", activity: "Filming block", goal: "Capture 2–3 concepts" },
    { day: "Wednesday", start: "09:00", end: "10:00", activity: "Follow-ups + inbox", goal: "Clear replies and next touches" },
    { day: "Wednesday", start: "19:00", end: "19:30", activity: "TikTok Stories", goal: "Keep account warm" },
    { day: "Thursday", start: "10:00", end: "12:00", activity: "Filming / edits", goal: "Finish drafts for review" },
    { day: "Thursday", start: "19:00", end: "19:45", activity: "Posting slot", goal: "Second weekly post" },
    { day: "Friday", start: "09:00", end: "10:00", activity: "Admin + pipeline", goal: "Tracker, rates, next-week plan" }
  ];
}

export function ensureWeeklyScheduleCalendarReady(structured = {}, { niche = "UGC" } = {}) {
  const next = { ...(structured && typeof structured === "object" ? structured : {}) };
  const blocks = normalizeScheduleBlocks(next);
  if (blocks.length > 0) {
    next.blocks = blocks;
    return next;
  }
  next.blocks = defaultWeeklyScheduleBlocks({ niche });
  if (!next.weekTheme) next.weekTheme = "Balanced outreach, filming, and posting";
  return next;
}

function nextOccurrenceForDay(now, targetDay, startHour, startMinute) {
  const start = new Date(now);
  let delta = (targetDay - start.getDay() + 7) % 7;
  if (
    delta === 0 &&
    (start.getHours() > startHour ||
      (start.getHours() === startHour && start.getMinutes() > startMinute))
  ) {
    delta = 7;
  }
  start.setDate(start.getDate() + delta);
  start.setHours(startHour, startMinute, 0, 0);
  return start;
}

export function buildEventsFromWeeklyPlan(structured = {}, { now = new Date(), outputId = null } = {}) {
  const ready = ensureWeeklyPlanCalendarReady(structured);
  const actions = extractDayAnchoredActions(ready);
  const perDayCount = {};
  const events = [];

  for (const action of actions.slice(0, 20)) {
    const targetDay = DAY_INDEX[action.day];
    if (targetDay === undefined || !action.activity) continue;
    const usedToday = perDayCount[action.day] ?? 0;
    const startHour = 9 + usedToday;
    const start = nextOccurrenceForDay(now, targetDay, startHour, 0);
    // If today rolled because the slot passed, nextOccurrence already +7.
    const end = new Date(start);
    end.setHours(startHour, 45, 0, 0);
    perDayCount[action.day] = usedToday + 1;
    events.push({
      title: action.activity.slice(0, 120),
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      eventType: "Focus",
      notes: String(ready.priority || ready.focusForTheWeek || "").slice(0, 240),
      sourceOutputId: outputId,
      sourceKind: "weekly_plan"
    });
  }

  return { events, structured: ready };
}

export function buildEventsFromWeeklySchedule(structured = {}, { now = new Date(), outputId = null, niche = "UGC" } = {}) {
  const ready = ensureWeeklyScheduleCalendarReady(structured, { niche });
  const events = [];

  for (const block of ready.blocks.slice(0, 20)) {
    const targetDay = DAY_INDEX[block.day];
    const startMatch = TIME_RE.exec(block.start);
    const endMatch = TIME_RE.exec(block.end);
    if (targetDay === undefined || !startMatch || !endMatch) continue;

    const start = nextOccurrenceForDay(now, targetDay, Number(startMatch[1]), Number(startMatch[2]));
    const end = new Date(start);
    end.setHours(Number(endMatch[1]), Number(endMatch[2]), 0, 0);
    if (end.getTime() <= start.getTime()) continue;

    events.push({
      title: block.activity.slice(0, 120),
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      eventType: "Focus",
      notes: String(block.goal || ready.weekTheme || "").slice(0, 240),
      sourceOutputId: outputId,
      sourceKind: "weekly_schedule"
    });
  }

  return { events, structured: ready };
}

/**
 * Decide how to stamp harvest metadata after attempting calendar placement.
 * - created > 0 → synced
 * - zero events after ensure → skip (nothing to place; don't thrash)
 * Never mark synced when we expected events but failed to build any.
 */
export function stampCalendarHarvest(structured, { created, ensuredHadContent }) {
  const next = { ...(structured || {}) };
  next.calendarHarvestAttemptedAt = nowIso();
  if (created > 0) {
    next.calendarSyncedAt = nowIso();
    next.calendarEventsCreated = created;
    delete next.calendarSyncSkippedAt;
    delete next.calendarSyncSkipReason;
    return next;
  }
  if (!ensuredHadContent) {
    next.calendarSyncSkippedAt = nowIso();
    next.calendarSyncSkipReason = "no_calendar_content";
    // Treat empty as done so we don't retry forever on blank outputs.
    next.calendarSyncedAt = nowIso();
    next.calendarEventsCreated = 0;
    return next;
  }
  // Had content but built 0 events — leave unsynced for a later retry.
  delete next.calendarSyncedAt;
  next.calendarSyncSkipReason = "build_failed";
  return next;
}

export function isCalendarAlreadySynced(structured = {}) {
  return Boolean(structured?.calendarSyncedAt);
}

/**
 * Persist planned events for one output. Idempotent per output: removes prior
 * events tagged with this output id in notes metadata prefix, then inserts.
 */
export async function persistCalendarEvents(store, {
  userId,
  workerSlug,
  events,
  randomId = () => randomUUID()
}) {
  let created = 0;
  for (const event of events) {
    const notes = event.sourceOutputId
      ? `[mara:${event.sourceKind}:${event.sourceOutputId}] ${event.notes || ""}`.trim()
      : event.notes || "";
    // Drop prior copies for this output+title+start so re-harvest is safe.
    if (event.sourceOutputId) {
      await store.execute(
        `DELETE FROM office_calendar_events
         WHERE user_id = ? AND worker_slug = ? AND starts_at = ? AND notes LIKE ?`,
        userId,
        workerSlug,
        event.startsAt,
        `[mara:${event.sourceKind}:${event.sourceOutputId}]%`
      );
    }
    await store.execute(
      `INSERT INTO office_calendar_events
        (id, user_id, worker_slug, title, starts_at, ends_at, event_type, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      randomId(),
      userId,
      workerSlug,
      event.title,
      event.startsAt,
      event.endsAt,
      event.eventType || "Focus",
      notes.slice(0, 500),
      nowIso(),
      nowIso()
    );
    created += 1;
  }
  return created;
}

/**
 * Harvest one weekly output into the calendar. Returns updated structured JSON.
 */
export async function harvestWeeklyOutputToCalendar(store, {
  userId,
  workerSlug,
  outputId,
  outputType,
  structured,
  niche = "UGC",
  now = new Date(),
  createActivityLog = null
}) {
  if (isCalendarAlreadySynced(structured)) {
    return { structured, created: 0, skipped: true };
  }

  let planned;
  if (outputType === "weekly_schedule") {
    planned = buildEventsFromWeeklySchedule(structured, { now, outputId, niche });
  } else if (outputType === "weekly_plan") {
    planned = buildEventsFromWeeklyPlan(structured, { now, outputId });
  } else {
    return { structured, created: 0, skipped: true };
  }

  const ensuredHadContent =
    outputType === "weekly_schedule"
      ? normalizeScheduleBlocks(planned.structured).length > 0 ||
        (Array.isArray(planned.structured.blocks) && planned.structured.blocks.length > 0)
      : extractDayAnchoredActions(planned.structured).length > 0;

  const created = await persistCalendarEvents(store, {
    userId,
    workerSlug,
    events: planned.events
  });

  const stamped = stampCalendarHarvest(planned.structured, { created, ensuredHadContent });

  if (created > 0 && typeof createActivityLog === "function") {
    await createActivityLog({
      description:
        outputType === "weekly_schedule"
          ? `Placed ${created} time block${created === 1 ? "" : "s"} on your calendar for the week.`
          : `Placed ${created} focus block${created === 1 ? "" : "s"} from the weekly plan on your calendar.`,
      eventType: "task_completed",
      metadata: { outputId, outputType, created },
      title: outputType === "weekly_schedule" ? "Weekly schedule on calendar" : "Weekly plan on calendar",
      userId,
      workerId: workerSlug
    });
  }

  return { structured: stamped, created, skipped: false };
}
