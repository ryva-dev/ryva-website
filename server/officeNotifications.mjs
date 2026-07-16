import { randomUUID } from "node:crypto";

function parseJson(value, fallback = {}) {
  if (value && typeof value === "object") return value;
  try { return JSON.parse(String(value || "")); } catch { return fallback; }
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

export function reminderLeadMinutes(value) {
  const text = String(value || "2 hours before").toLowerCase();
  const amount = Math.max(1, Number(text.match(/\d+(?:\.\d+)?/)?.[0] || 2));
  if (/day/.test(text)) return Math.round(amount * 24 * 60);
  if (/min/.test(text)) return Math.round(amount);
  return Math.round(amount * 60);
}

export async function initOfficeNotifications(store) {
  await store.execute(`CREATE TABLE IF NOT EXISTS office_notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    worker_slug TEXT,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    action_url TEXT NOT NULL,
    delivery TEXT NOT NULL,
    status TEXT NOT NULL,
    scheduled_for TEXT,
    sent_at TEXT,
    read_at TEXT,
    dedupe_key TEXT NOT NULL UNIQUE,
    metadata_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  await store.execute(`CREATE INDEX IF NOT EXISTS idx_office_notifications_user ON office_notifications(user_id, created_at)`);
}

export async function createDueCalendarNotifications(store, { now = new Date() } = {}) {
  await initOfficeNotifications(store);
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const rows = await store.query(
    `SELECT e.id, e.user_id AS "userId", e.worker_slug AS "workerSlug", e.title, e.starts_at AS "startsAt",
            e.event_type AS "eventType", u.email, u.name, s.settings_json AS "settingsJson"
     FROM office_calendar_events e
     INNER JOIN users u ON u.id = e.user_id
     LEFT JOIN office_global_settings s ON s.user_id = e.user_id
     WHERE e.starts_at > ? AND e.starts_at <= ?
     ORDER BY e.starts_at ASC`,
    now.toISOString(),
    horizon
  );
  const created = [];
  for (const row of rows) {
    if (String(row.eventType || "").toLowerCase() === "mara") continue;
    const settings = parseJson(row.settingsJson, {});
    const delivery = String(settings.digestDelivery || "Email and in-office");
    if (/^(off|none|disabled)$/i.test(delivery)) continue;
    const leadMinutes = reminderLeadMinutes(settings.reviewReminderLead);
    const startsAt = new Date(row.startsAt);
    if (startsAt.getTime() - now.getTime() > leadMinutes * 60 * 1000) continue;
    const dedupeKey = `calendar:${row.id}:${row.startsAt}`;
    const id = randomUUID();
    const timestamp = now.toISOString();
    const result = await store.execute(
      `INSERT INTO office_notifications
       (id, user_id, worker_slug, kind, title, body, action_url, delivery, status, scheduled_for, sent_at, read_at, dedupe_key, metadata_json, created_at, updated_at)
       VALUES (?, ?, ?, 'calendar_reminder', ?, ?, ?, ?, 'pending', ?, NULL, NULL, ?, ?, ?, ?)
       ON CONFLICT(dedupe_key) DO NOTHING`,
      id,
      row.userId,
      row.workerSlug || null,
      `Coming up: ${row.title}`,
      `This is on your calendar at ${startsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.`,
      `#app/office/calendar?focus=${encodeURIComponent(row.id)}`,
      delivery,
      row.startsAt,
      dedupeKey,
      JSON.stringify({ calendarEventId: row.id, startsAt: row.startsAt }),
      timestamp,
      timestamp
    );
    if (Number(result?.rowCount ?? result?.changes ?? 0) > 0) created.push({ ...row, id, delivery });
  }
  return created;
}

export async function deliverOfficeNotification(store, notificationId, { sendEmail, appUrl }) {
  const row = await store.queryOne(
    `SELECT n.*, u.email, u.name FROM office_notifications n INNER JOIN users u ON u.id = n.user_id WHERE n.id = ?`,
    notificationId
  );
  if (!row || row.status === "sent") return false;
  if (/email/i.test(String(row.delivery || ""))) {
    const firstName = String(row.name || "there").split(" ")[0];
    const url = `${String(appUrl || "").replace(/\/$/, "")}/${String(row.action_url || "#app/office/today")}`;
    const text = `Hi ${firstName},\n\n${row.title}\n${row.body}\n\nOpen your office: ${url}`;
    await sendEmail({
      to: row.email,
      subject: row.title,
      text,
      html: `<p>Hi ${escapeHtml(firstName)},</p><p><strong>${escapeHtml(row.title)}</strong><br>${escapeHtml(row.body)}</p><p><a href="${escapeHtml(url)}">Open your calendar</a></p>`
    });
  }
  const now = new Date().toISOString();
  await store.execute(`UPDATE office_notifications SET status = 'sent', sent_at = ?, updated_at = ? WHERE id = ?`, now, now, notificationId);
  return true;
}
