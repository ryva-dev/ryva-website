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

function safeTimeZone(value) {
  const candidate = String(value || "").trim();
  if (!candidate) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return null;
  }
}

function timezoneOffsetMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
  return Math.round((asUtc - date.getTime()) / 60_000);
}

function localParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, weekday: "long", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function zonedDate(year, month, day, hour, minute, timeZone) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return new Date(guess.getTime() - timezoneOffsetMinutes(guess, timeZone) * 60_000);
}

function dateKeyFromParts(parts) {
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function parseDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  return match ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) } : null;
}

export function inferWeeklyPlanRange(requestText, { now = new Date(), timeZone = "UTC" } = {}) {
  const text = String(requestText || "").toLowerCase();
  if (!/this week|weekly plan|until sunday|through sunday|up to sunday/.test(text)) return null;
  const zone = safeTimeZone(timeZone) || "UTC";
  const local = localParts(now, zone);
  const weekday = DAY_INDEX[local.weekday];
  const startToken = new Date(Date.UTC(Number(local.year), Number(local.month) - 1, Number(local.day)));
  const endToken = new Date(startToken);
  endToken.setUTCDate(endToken.getUTCDate() + ((7 - weekday) % 7));
  return {
    planStartDate: dateKeyFromParts(local),
    planEndDate: endToken.toISOString().slice(0, 10),
    timeZone: zone
  };
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

function requestedRangeDays(structured = {}) {
  const start = parseDateKey(structured.planStartDate);
  const end = parseDateKey(structured.planEndDate);
  if (!start || !end) return [];
  const cursor = new Date(Date.UTC(start.year, start.month - 1, start.day));
  const last = new Date(Date.UTC(end.year, end.month - 1, end.day));
  const days = [];
  while (cursor <= last && days.length < 14) {
    days.push(Object.keys(DAY_INDEX).find((day) => DAY_INDEX[day] === cursor.getUTCDay()));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days.filter(Boolean);
}

/**
 * Models sometimes return a sensible full-week plan for a midweek request.
 * Preserve the chosen work, but remap past-day actions into uncovered days so
 * the plan follows the manager's explicit date range.
 */
export function ensureWeeklyPlanRequestedRangeCoverage(structured = {}) {
  const ready = ensureWeeklyPlanCalendarReady(structured);
  const requestedDays = requestedRangeDays(ready);
  if (requestedDays.length === 0) return ready;

  const requestedSet = new Set(requestedDays);
  const actions = extractDayAnchoredActions(ready);
  const inRange = actions.filter((action) => requestedSet.has(action.day));
  const coveredDays = new Set(inRange.map((action) => action.day));
  const candidates = actions
    .filter((action) => !requestedSet.has(action.day))
    .map((action) => action.activity);
  for (const { activity } of fallbackDayActionsFromPlan(ready)) {
    if (!candidates.includes(activity) && !inRange.some((action) => action.activity === activity)) {
      candidates.push(activity);
    }
  }

  const fallbacks = [
    "Complete the highest-value unfinished action from this plan",
    "Review progress, clear blockers, and choose the next revenue move"
  ];
  for (const day of requestedDays) {
    if (coveredDays.has(day)) continue;
    const activity = candidates.shift() || fallbacks[coveredDays.size % fallbacks.length];
    inRange.push({ day, activity });
    coveredDays.add(day);
  }

  ready.dailySuggestedActions = inRange.map((action) => `${action.day}: ${action.activity}`);
  return ready;
}

export function formatWeeklyPlanForRequestedRange(structured = {}) {
  const ready = ensureWeeklyPlanRequestedRangeCoverage(structured);
  const requestedDays = requestedRangeDays(ready);
  if (requestedDays.length === 0) return "";
  const requestedSet = new Set(requestedDays);
  const seen = new Set();
  const actions = extractDayAnchoredActions(ready).filter((action) => {
    const key = `${action.day}:${action.activity}`;
    if (!requestedSet.has(action.day) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (actions.length === 0) return "";
  return [
    `Your plan from ${requestedDays[0]} through ${requestedDays.at(-1)}:`,
    "",
    ...actions.flatMap((action) => [`**${action.day}**`, `- ${action.activity}`, ""])
  ].join("\n").trim();
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
      goal: String(block?.goal ?? "").trim(),
      owner: String(block?.owner ?? "creator").trim().toLowerCase() === "mara" ? "mara" : "creator",
      kind: String(block?.kind ?? "focus").trim().toLowerCase()
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
    { day: "Monday", start: "18:30", end: "19:00", activity: "Review Mara's priorities", goal: "Approve the week's highest-value work", owner: "creator", kind: "review" },
    { day: "Tuesday", start: "19:00", end: "19:45", activity: "Filming prep", goal: "Confirm concepts, products, props, and locations", owner: "creator", kind: "prep" },
    { day: "Wednesday", start: "18:30", end: "19:00", activity: "Outreach review", goal: "Review personalized pitches Mara prepared", owner: "creator", kind: "review" },
    { day: "Thursday", start: "19:00", end: "19:45", activity: "Posting slot", goal: `Publish one ${label} piece`, owner: "creator", kind: "posting" },
    { day: "Saturday", start: "10:00", end: "12:00", activity: "Filming block", goal: "Capture approved concepts", owner: "creator", kind: "filming" },
    { day: "Sunday", start: "18:00", end: "18:30", activity: "Weekly review with Mara", goal: "Review results and adjust next week", owner: "creator", kind: "review" }
  ];
}

function inferWorkWindow(text) {
  const source = String(text || "");
  const match = source.match(/(?:work|job|shift)[^\n.]{0,40}?\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
    || source.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?[^\n.]{0,40}?(?:work|job|shift)/i);
  if (!match) return null;
  const toMinutes = (hourRaw, minuteRaw, suffix, isEnd = false) => {
    let hour = Number(hourRaw);
    if (suffix?.toLowerCase() === "pm" && hour < 12) hour += 12;
    if (suffix?.toLowerCase() === "am" && hour === 12) hour = 0;
    if (!suffix && isEnd && hour <= 7) hour += 12;
    return hour * 60 + Number(minuteRaw || 0);
  };
  const start = toMinutes(match[1], match[2], match[3]);
  const end = toMinutes(match[4], match[5], match[6], true);
  return end > start ? { start, end } : null;
}

function moveBlocksOutsideWorkHours(blocks, availabilityText) {
  const work = inferWorkWindow(availabilityText);
  if (!work) return blocks;
  return blocks.map((block) => {
    if (block.owner === "mara" || ["Saturday", "Sunday"].includes(block.day)) return block;
    const [startHour, startMinute] = block.start.split(":").map(Number);
    const [endHour, endMinute] = block.end.split(":").map(Number);
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    if (end <= work.start || start >= work.end) return block;
    const duration = Math.max(15, end - start);
    const shiftedStart = Math.min(work.end + 60, 21 * 60);
    const shiftedEnd = Math.min(shiftedStart + duration, 22 * 60 + 30);
    const clock = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    return { ...block, start: clock(shiftedStart), end: clock(shiftedEnd) };
  });
}

export function ensureWeeklyScheduleCalendarReady(structured = {}, { niche = "UGC", availabilityText = "", allowDefaults = true } = {}) {
  const next = { ...(structured && typeof structured === "object" ? structured : {}) };
  const blocks = normalizeScheduleBlocks(next);
  if (blocks.length > 0) {
    next.blocks = moveBlocksOutsideWorkHours(blocks, availabilityText);
    return next;
  }
  next.blocks = allowDefaults ? defaultWeeklyScheduleBlocks({ niche }) : [];
  if (!next.weekTheme) next.weekTheme = "Balanced outreach, filming, and posting";
  return next;
}

function nextOccurrenceForDay(now, targetDay, startHour, startMinute, timeZone = null) {
  const zone = safeTimeZone(timeZone);
  if (zone) {
    const local = localParts(now, zone);
    const currentDay = DAY_INDEX[local.weekday];
    let delta = (targetDay - currentDay + 7) % 7;
    let candidateToken = new Date(Date.UTC(Number(local.year), Number(local.month) - 1, Number(local.day)));
    candidateToken.setUTCDate(candidateToken.getUTCDate() + delta);
    let candidate = zonedDate(candidateToken.getUTCFullYear(), candidateToken.getUTCMonth() + 1, candidateToken.getUTCDate(), startHour, startMinute, zone);
    if (candidate <= now) {
      candidateToken.setUTCDate(candidateToken.getUTCDate() + 7);
      candidate = zonedDate(candidateToken.getUTCFullYear(), candidateToken.getUTCMonth() + 1, candidateToken.getUTCDate(), startHour, startMinute, zone);
    }
    return candidate;
  }
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

export function buildEventsFromWeeklyPlan(structured = {}, { now = new Date(), outputId = null, timeZone = null } = {}) {
  const ready = ensureWeeklyPlanRequestedRangeCoverage(structured);
  const actions = extractDayAnchoredActions(ready);
  const perDayCount = {};
  const events = [];
  const seenActions = new Set();
  const zone = safeTimeZone(timeZone || ready.timeZone);
  const rangeStart = parseDateKey(ready.planStartDate);
  const rangeEnd = parseDateKey(ready.planEndDate);
  const rangeStartToken = rangeStart ? new Date(Date.UTC(rangeStart.year, rangeStart.month - 1, rangeStart.day)) : null;
  const rangeEndToken = rangeEnd ? new Date(Date.UTC(rangeEnd.year, rangeEnd.month - 1, rangeEnd.day)) : null;

  for (const action of actions.slice(0, 20)) {
    const targetDay = DAY_INDEX[action.day];
    if (targetDay === undefined || !action.activity) continue;
    const actionKey = `${action.day}:${action.activity}`;
    if (seenActions.has(actionKey)) continue;
    seenActions.add(actionKey);
    const usedToday = perDayCount[action.day] ?? 0;
    const startHour = 9 + usedToday;
    let start;
    if (zone && rangeStartToken && rangeEndToken) {
      let dayToken = new Date(rangeStartToken);
      while (dayToken <= rangeEndToken && dayToken.getUTCDay() !== targetDay) {
        dayToken.setUTCDate(dayToken.getUTCDate() + 1);
      }
      if (dayToken > rangeEndToken) continue;
      start = zonedDate(dayToken.getUTCFullYear(), dayToken.getUTCMonth() + 1, dayToken.getUTCDate(), startHour, 0, zone);
      if (start <= now) {
        const nextSlot = new Date(now.getTime() + (45 + usedToday * 60) * 60_000);
        nextSlot.setMinutes(Math.ceil(nextSlot.getMinutes() / 15) * 15, 0, 0);
        start = nextSlot;
      }
    } else {
      start = nextOccurrenceForDay(now, targetDay, startHour, 0, zone);
    }
    const end = new Date(start);
    end.setTime(start.getTime() + 45 * 60_000);
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

export function buildEventsFromWeeklySchedule(structured = {}, { now = new Date(), outputId = null, niche = "UGC", timeZone = null } = {}) {
  const ready = ensureWeeklyScheduleCalendarReady(structured, { niche });
  const events = [];

  for (const block of ready.blocks.slice(0, 20)) {
    if (block.owner === "mara") continue;
    const targetDay = DAY_INDEX[block.day];
    const startMatch = TIME_RE.exec(block.start);
    const endMatch = TIME_RE.exec(block.end);
    if (targetDay === undefined || !startMatch || !endMatch) continue;

    const zone = safeTimeZone(timeZone || ready.timeZone);
    const start = nextOccurrenceForDay(now, targetDay, Number(startMatch[1]), Number(startMatch[2]), zone);
    const durationMinutes = (Number(endMatch[1]) * 60 + Number(endMatch[2])) - (Number(startMatch[1]) * 60 + Number(startMatch[2]));
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    if (end.getTime() <= start.getTime()) continue;

    events.push({
      title: block.activity.slice(0, 120),
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      eventType: block.kind === "review" || /review|approve|feedback/i.test(`${block.activity} ${block.goal}`) ? "Review" : "Focus",
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
  const taggedSources = new Set(
    events
      .filter((event) => event.sourceOutputId)
      .map((event) => `[mara:${event.sourceKind}:${event.sourceOutputId}]%`)
  );
  for (const prefix of taggedSources) {
    await store.execute(
      `DELETE FROM office_calendar_events
       WHERE user_id = ? AND worker_slug = ? AND notes LIKE ?`,
      userId,
      workerSlug,
      prefix
    );
  }
  for (const event of events) {
    const notes = event.sourceOutputId
      ? `[mara:${event.sourceKind}:${event.sourceOutputId}] ${event.notes || ""}`.trim()
      : event.notes || "";
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
 * A newly completed weekly plan/schedule supersedes Mara's older future blocks
 * in the same window. Only tagged Mara events are removed; creator-created
 * calendar events and past history are never touched.
 */
export async function clearSupersededWeeklyEvents(store, {
  userId,
  workerSlug,
  outputId,
  outputType,
  events,
  now = new Date()
}) {
  if (!Array.isArray(events) || events.length === 0) return 0;
  const latestEnd = events.reduce(
    (latest, event) => event.endsAt > latest ? event.endsAt : latest,
    events[0].endsAt
  );
  const sourceKind = outputType === "weekly_schedule" ? "weekly_schedule" : "weekly_plan";
  const currentPrefix = `[mara:${sourceKind}:${outputId}]%`;
  const result = await store.execute(
    `DELETE FROM office_calendar_events
     WHERE user_id = ? AND worker_slug = ?
       AND starts_at >= ? AND starts_at <= ?
       AND notes LIKE ? AND notes NOT LIKE ?`,
    userId,
    workerSlug,
    now.toISOString(),
    latestEnd,
    `[mara:${sourceKind}:%`,
    currentPrefix
  );
  return Number(result?.changes ?? result?.rowCount ?? 0);
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
  createActivityLog = null,
  timeZone = null
}) {
  if (isCalendarAlreadySynced(structured)) {
    return { structured, created: 0, skipped: true };
  }

  let planned;
  if (outputType === "weekly_schedule") {
    planned = buildEventsFromWeeklySchedule(structured, { now, outputId, niche, timeZone });
  } else if (outputType === "weekly_plan") {
    planned = buildEventsFromWeeklyPlan(structured, { now, outputId, timeZone });
  } else {
    return { structured, created: 0, skipped: true };
  }

  const ensuredHadContent =
    outputType === "weekly_schedule"
      ? normalizeScheduleBlocks(planned.structured).length > 0 ||
        (Array.isArray(planned.structured.blocks) && planned.structured.blocks.length > 0)
      : extractDayAnchoredActions(planned.structured).length > 0;

  await clearSupersededWeeklyEvents(store, {
    userId,
    workerSlug,
    outputId,
    outputType,
    events: planned.events,
    now
  });

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
