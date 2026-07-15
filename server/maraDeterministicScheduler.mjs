import { createHash, randomUUID } from "node:crypto";
import { ensureMaraRuntimeTables } from "./maraRuntimeStorage.mjs";
import { appendTaskAudit } from "./maraTaskGraph.mjs";

const DAY = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function addMinutes(date, minutes) { return new Date(date.getTime() + minutes * 60_000); }
function nextDayOfWeek(from, target, { includeToday = false } = {}) {
  const date = new Date(from);
  let delta = (target - date.getUTCDay() + 7) % 7;
  if (delta === 0 && !includeToday) delta = 7;
  date.setUTCDate(date.getUTCDate() + delta);
  return date;
}
function parseClock(text, fallbackHour = 18) {
  const match = String(text).match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!match) return { hour: fallbackHour, minute: 0 };
  let hour = Number(match[1]); const minute = Number(match[2] || 0);
  if (match[3]?.toLowerCase() === "pm" && hour < 12) hour += 12;
  if (match[3]?.toLowerCase() === "am" && hour === 12) hour = 0;
  return { hour, minute };
}
function timezoneOffsetMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
  return Math.round((asUtc - date.getTime()) / 60_000);
}
function localParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}
function zonedDate(year, month, day, hour, minute, timeZone) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return new Date(guess.getTime() - timezoneOffsetMinutes(guess, timeZone) * 60_000);
}
function setLocalClock(date, hour, minute, timeZone) {
  const p = localParts(date, timeZone);
  return zonedDate(Number(p.year), Number(p.month), Number(p.day), hour, minute, timeZone);
}
function nextNamedDay(from, name, timeZone, clock) {
  for (let offset = 0; offset <= 8; offset += 1) {
    const candidate = addMinutes(from, offset * 24 * 60);
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(candidate).toLowerCase();
    if (weekday === name && (offset > 0 || setLocalClock(candidate, clock.hour, clock.minute, timeZone) > from)) return setLocalClock(candidate, clock.hour, clock.minute, timeZone);
  }
  return addMinutes(from, 24 * 60);
}

function deadlineFromState(state) {
  const dates = [...(state?.upcomingDeadlines || [])].map((item) => new Date(item.dueAt || item.deadline || 0)).filter((date) => Number.isFinite(date.getTime()));
  return dates.sort((a, b) => a - b)[0] || null;
}

export function resolveTaskSchedule(task, { planningTime = new Date().toISOString(), state = {}, existingEntries = [], dependencyEndTimes = [] } = {}) {
  const now = new Date(planningTime);
  const timeZone = task.timezone || "UTC";
  const window = String(task.scheduledWindow || "next available work block").toLowerCase();
  const duration = Math.max(5, Number(task.durationMinutes || (task.owner === "creator" ? task.creatorEffortMinutes : 30) || 30));
  let start = addMinutes(now, task.urgency === "critical" ? 15 : 60);
  const deadline = deadlineFromState(state);
  const provided = task.scheduledAt ? new Date(task.scheduledAt) : null;
  if (provided && Number.isFinite(provided.getTime()) && provided >= now && (!deadline || provided < deadline)) start = provided;
  else if (/immediately|as soon|today/.test(window)) start = addMinutes(now, 15);
  else if (/before .*deadline|before deadline/.test(window) && deadline) start = addMinutes(deadline, -(duration + 60));
  else {
    const dayName = DAY.find((day) => window.includes(day));
    if (dayName) start = nextNamedDay(now, dayName, timeZone, parseClock(window, task.owner === "creator" ? 18 : 9));
    else if (/evening/.test(window)) {
      start = setLocalClock(now, 18, 0, timeZone);
      if (start <= now) start = nextNamedDay(now, DAY[(now.getUTCDay() + 1) % 7], timeZone, { hour: 18, minute: 0 });
    } else if (/weekend/.test(window)) start = nextNamedDay(now, "saturday", timeZone, parseClock(window, 10));
    else if (task.owner === "creator" && state.capacity?.availableWindows?.length) {
      const availability = state.capacity.availableWindows[0];
      const named = DAY.find((day) => String(availability).toLowerCase().includes(day));
      if (named) start = nextNamedDay(now, named, timeZone, parseClock(availability, 18));
    } else start = setLocalClock(addMinutes(now, task.owner === "mara" ? 60 : 24 * 60), task.owner === "mara" ? 9 : 18, 0, timeZone);
  }
  const latestDependency = dependencyEndTimes.map((value) => new Date(value)).filter((date) => Number.isFinite(date.getTime())).sort((a, b) => b - a)[0];
  if (latestDependency && start <= latestDependency) start = addMinutes(latestDependency, 15);
  let end = addMinutes(start, duration);
  const conflicts = [...existingEntries].sort((a, b) => new Date(a.startsAt || a.starts_at) - new Date(b.startsAt || b.starts_at));
  for (const conflict of conflicts) {
    const conflictStart = new Date(conflict.startsAt || conflict.starts_at); const conflictEnd = new Date(conflict.endsAt || conflict.ends_at);
    if (start < conflictEnd && end > conflictStart) { start = addMinutes(conflictEnd, 15); end = addMinutes(start, duration); }
  }
  if (deadline && end > deadline) { start = addMinutes(deadline, -duration); end = deadline; }
  if (start < now) { start = addMinutes(now, 15); end = addMinutes(start, duration); }
  return { startsAt: start.toISOString(), endsAt: end.toISOString(), timezone: timeZone, durationMinutes: duration };
}

export async function persistCalendarEntry(store, { userId, workerId, task, schedule }) {
  await ensureMaraRuntimeTables(store);
  const key = createHash("sha256").update(JSON.stringify([userId, workerId, task.id, task.owner, schedule.startsAt])).digest("hex");
  const now = new Date().toISOString();
  const existing = await store.queryOne("SELECT id FROM agent_task_calendar_entries WHERE user_id = ? AND worker_id = ? AND idempotency_key = ?", userId, workerId, key);
  if (existing) {
    await store.execute("UPDATE agent_task_calendar_entries SET status = 'scheduled', ends_at = ?, timezone = ?, updated_at = ? WHERE id = ?", schedule.endsAt, schedule.timezone, now, existing.id);
    return { id: existing.id, duplicate: true, ...schedule };
  }
  const id = randomUUID();
  await store.execute(
    `INSERT INTO agent_task_calendar_entries (id,user_id,worker_id,task_id,calendar_owner,starts_at,ends_at,timezone,status,idempotency_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, userId, workerId, task.id, task.owner === "mara" ? "mara" : "creator", schedule.startsAt, schedule.endsAt, schedule.timezone, "scheduled", key, now, now
  );
  await store.execute("UPDATE agent_tasks_v2 SET scheduled_at = ?, duration_minutes = ?, status = CASE WHEN status = 'proposed' THEN 'scheduled' ELSE status END, updated_at = ? WHERE id = ? AND user_id = ? AND worker_id = ?", schedule.startsAt, schedule.durationMinutes, now, task.id, userId, workerId);
  await appendTaskAudit(store,{userId,workerId,taskId:task.id,eventType:"scheduled",fromStatus:task.status,toStatus:task.status==="proposed"?"scheduled":task.status,reason:"Deterministic scheduling resolved the task window.",metadata:{calendarOwner:task.owner==="mara"?"mara":"creator",...schedule}});
  return { id, duplicate: false, ...schedule };
}

export async function listCalendar(store, { userId, workerId, calendarOwner }) {
  await ensureMaraRuntimeTables(store);
  return store.query("SELECT * FROM agent_task_calendar_entries WHERE user_id = ? AND worker_id = ? AND calendar_owner = ? AND status = 'scheduled' ORDER BY starts_at ASC", userId, workerId, calendarOwner);
}
