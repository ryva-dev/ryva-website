import assert from "node:assert/strict";
import test from "node:test";
import { createStore } from "./dataStore.mjs";
import { createDueCalendarNotifications, deliverOfficeNotification, initOfficeNotifications, reminderLeadMinutes } from "./officeNotifications.mjs";

async function setup() {
  const store = createStore({ databasePath: ":memory:" });
  await store.init();
  await store.execute(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL, name TEXT NOT NULL)`);
  await store.execute(`CREATE TABLE office_global_settings (user_id TEXT PRIMARY KEY, settings_json TEXT NOT NULL, updated_at TEXT NOT NULL)`);
  await store.execute(`CREATE TABLE office_calendar_events (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, worker_slug TEXT, title TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, event_type TEXT NOT NULL, notes TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
  await initOfficeNotifications(store);
  return store;
}

test("calendar reminder lead accepts minute, hour, and day settings", () => {
  assert.equal(reminderLeadMinutes("30 minutes before"), 30);
  assert.equal(reminderLeadMinutes("2 hours before"), 120);
  assert.equal(reminderLeadMinutes("1 day before"), 1440);
});

test("creator calendar reminders are idempotent and Mara-owned work is excluded", async () => {
  const store = await setup();
  const now = new Date("2026-07-16T12:00:00.000Z");
  await store.execute(`INSERT INTO users VALUES (?, ?, ?)`, "u1", "creator@example.com", "Creator One");
  await store.execute(`INSERT INTO office_global_settings VALUES (?, ?, ?)`, "u1", JSON.stringify({ digestDelivery: "Email and in-office", reviewReminderLead: "2 hours before" }), now.toISOString());
  for (const [id, eventType] of [["creator-event", "Creator work"], ["mara-event", "Mara"]]) {
    await store.execute(
      `INSERT INTO office_calendar_events VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?)`,
      id, "u1", "mara-vale", id, "2026-07-16T13:00:00.000Z", "2026-07-16T14:00:00.000Z", eventType, now.toISOString(), now.toISOString()
    );
  }
  assert.equal((await createDueCalendarNotifications(store, { now })).length, 1);
  assert.equal((await createDueCalendarNotifications(store, { now })).length, 0);
  assert.equal((await store.queryOne(`SELECT COUNT(*) AS count FROM office_notifications`)).count, 1);
  await store.close();
});

test("notification delivery sends email once and preserves an in-office record", async () => {
  const store = await setup();
  const now = new Date("2026-07-16T12:00:00.000Z");
  await store.execute(`INSERT INTO users VALUES (?, ?, ?)`, "u1", "creator@example.com", "Creator One");
  await store.execute(`INSERT INTO office_global_settings VALUES (?, ?, ?)`, "u1", JSON.stringify({ digestDelivery: "Email and in-office", reviewReminderLead: "2 hours before" }), now.toISOString());
  await store.execute(`INSERT INTO office_calendar_events VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?)`, "event", "u1", "mara-vale", "Review concepts", "2026-07-16T13:00:00.000Z", "2026-07-16T14:00:00.000Z", "Creator work", now.toISOString(), now.toISOString());
  const [notification] = await createDueCalendarNotifications(store, { now });
  const sent = [];
  assert.equal(await deliverOfficeNotification(store, notification.id, { appUrl: "https://ryvaforge.com", sendEmail: async (message) => sent.push(message) }), true);
  assert.equal(await deliverOfficeNotification(store, notification.id, { appUrl: "https://ryvaforge.com", sendEmail: async (message) => sent.push(message) }), false);
  assert.equal(sent.length, 1);
  assert.equal((await store.queryOne(`SELECT status FROM office_notifications WHERE id = ?`, notification.id)).status, "sent");
  await store.close();
});
