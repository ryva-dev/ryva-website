import assert from "node:assert/strict";
import test from "node:test";
import { createStore, toPgPlaceholders } from "./dataStore.mjs";

test("Postgres placeholder conversion ignores literals and comments", () => {
  assert.equal(
    toPgPlaceholders("SELECT '?' AS literal, value FROM items WHERE a = ? AND note = 'it''s ?' -- ?\nAND b = ? /* ? */"),
    "SELECT '?' AS literal, value FROM items WHERE a = $1 AND note = 'it''s ?' -- ?\nAND b = $2 /* ? */"
  );
});

test("async store provides one transaction API on SQLite", async () => {
  const store = createStore({ databasePath: ":memory:" });
  await store.execute("CREATE TABLE records (id TEXT PRIMARY KEY, value TEXT NOT NULL)");
  await store.tx(async (transaction) => {
    await transaction.execute("INSERT INTO records (id, value) VALUES (?, ?)", "1", "private");
  });
  assert.deepEqual(await store.queryOne("SELECT value FROM records WHERE id = ?", "1"), { value: "private" });
  await store.close();
});

test("SQLite fallback serializes concurrent async transactions", async () => {
  const store = createStore({ databasePath: ":memory:" });
  await store.execute("CREATE TABLE counters (id TEXT PRIMARY KEY, value INTEGER NOT NULL)");
  await store.execute("INSERT INTO counters (id, value) VALUES (?, ?)", "shared", 0);

  await Promise.all(
    Array.from({ length: 8 }, () =>
      store.tx(async (transaction) => {
        const row = await transaction.queryOne("SELECT value FROM counters WHERE id = ?", "shared");
        await new Promise((resolve) => setImmediate(resolve));
        await transaction.execute("UPDATE counters SET value = ? WHERE id = ?", row.value + 1, "shared");
      })
    )
  );

  assert.deepEqual(await store.queryOne("SELECT value FROM counters WHERE id = ?", "shared"), { value: 8 });
  await store.close();
});
