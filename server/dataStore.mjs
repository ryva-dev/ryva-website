// Ryva — async data-access layer (Phase 2)
//
// One async API, two interchangeable drivers:
//   * Postgres (node-postgres)  — used when DATABASE_URL is set (production).
//   * SQLite   (better-sqlite3) — used otherwise (local dev / today's data).
//
// Why dual-driver: it makes the SQLite -> Postgres cutover a *config flag*, not
// a rewrite. Every call site becomes `await store.query(...)` and behaves the
// same on both backends, so the app stays runnable and reversible at every step
// of the migration. Prod never loads better-sqlite3; dev never loads pg — both
// are dynamically imported only for the driver actually in use.
//
// Injectability: `createStore(options)` returns an isolated store instance. The
// app uses one shared default instance; tests create their own (pointed at a
// temp SQLite path) so the threaded-dependency pattern keeps working during the
// Stage B cutover — pass a store where a `db` used to be threaded.
//
// SQL conventions for call sites:
//   * Use `?` positional placeholders everywhere. The Postgres driver rewrites
//     them to `$1, $2, …`; SQLite uses them natively.
//   * Avoid dialect-only SQL in shared queries. Known exceptions to translate
//     during the cutover: `INSERT OR REPLACE/IGNORE` (-> ON CONFLICT),
//     `lower(hex(randomblob(16)))` (-> gen_random_uuid()), `strftime`/`datetime`.

import { resolvePostgresSsl } from "./postgresSsl.mjs";

/** Translate better-sqlite3 style `?` placeholders into Postgres `$1, $2, …`. */
export function toPgPlaceholders(sql) {
  const source = String(sql);
  let index = 0;
  let output = "";
  let quote = null;
  let lineComment = false;
  let blockComment = false;
  for (let cursor = 0; cursor < source.length; cursor += 1) {
    const char = source[cursor];
    const next = source[cursor + 1];
    if (lineComment) {
      output += char;
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      output += char;
      if (char === "*" && next === "/") { output += next; cursor += 1; blockComment = false; }
      continue;
    }
    if (quote) {
      output += char;
      if (char === quote) {
        if (next === quote) { output += next; cursor += 1; }
        else quote = null;
      }
      continue;
    }
    if (char === "-" && next === "-") { output += char + next; cursor += 1; lineComment = true; continue; }
    if (char === "/" && next === "*") { output += char + next; cursor += 1; blockComment = true; continue; }
    if (char === "'" || char === '"') { quote = char; output += char; continue; }
    output += char === "?" ? `$${++index}` : char;
  }
  return output;
}

function normalizeParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params;
}

// Async callbacks can yield even when better-sqlite3 queries themselves are
// synchronous. Serialize transactions per connection so an API request and an
// autonomy job cannot issue overlapping BEGIN statements on the same handle.
const sqliteTransactionTails = new WeakMap();

async function runSerializedSqliteTransaction(db, scoped, callback) {
  const previous = sqliteTransactionTails.get(db) ?? Promise.resolve();
  const current = previous.catch(() => {}).then(async () => {
    db.exec("BEGIN");
    try {
      const value = await callback(scoped);
      db.exec("COMMIT");
      return value;
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch { /* ignore */ }
      throw error;
    }
  });
  sqliteTransactionTails.set(db, current);
  try {
    return await current;
  } finally {
    if (sqliteTransactionTails.get(db) === current) sqliteTransactionTails.delete(db);
  }
}

function resolveUsesPostgres(options) {
  if (options.databaseUrl !== undefined) return Boolean(String(options.databaseUrl).trim());
  if (options.databasePath !== undefined) return false;
  return Boolean(String(process.env.DATABASE_URL ?? "").trim());
}

/* ---------------------------------------------------------------- Postgres */

async function createPostgresDriver(options) {
  const pg = (await import("pg")).default;
  const { Pool } = pg;

  const connectionString = String(options.databaseUrl ?? process.env.DATABASE_URL ?? "").trim();
  const pool = new Pool({
    connectionString,
    ssl: resolvePostgresSsl(),
    max: Number.parseInt(process.env.PG_POOL_MAX ?? "10", 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000
  });
  pool.on("error", (error) => console.error("Postgres pool error:", error));

  const run = async (sql, params) => {
    const translated = toPgPlaceholders(sql);
    try {
      return await pool.query(translated, normalizeParams(params));
    } catch (error) {
      // Keep values and tenant data out of logs, but identify the failed SQL
      // shape so a background job cannot die as an opaque provider error.
      const fingerprint = String(sql).replace(/\s+/g, " ").trim().slice(0, 500);
      if (error instanceof Error && !error.message.includes("[SQL:")) {
        error.message = `${error.message} [SQL: ${fingerprint}]`;
      }
      throw error;
    }
  };

  return {
    kind: "postgres",
    query: async (sql, params) => (await run(sql, params)).rows,
    queryOne: async (sql, params) => (await run(sql, params)).rows[0] ?? null,
    execute: async (sql, params) => {
      const r = await run(sql, params);
      return { rowCount: r.rowCount, changes: r.rowCount, rows: r.rows };
    },
    tx: async (callback) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const scoped = {
          query: async (sql, ...p) => (await client.query(toPgPlaceholders(sql), normalizeParams(p))).rows,
          queryOne: async (sql, ...p) => (await client.query(toPgPlaceholders(sql), normalizeParams(p))).rows[0] ?? null,
          execute: async (sql, ...p) => {
            const r = await client.query(toPgPlaceholders(sql), normalizeParams(p));
            return { rowCount: r.rowCount, changes: r.rowCount, rows: r.rows };
          }
        };
        const value = await callback(scoped);
        await client.query("COMMIT");
        return value;
      } catch (error) {
        try { await client.query("ROLLBACK"); } catch { /* ignore */ }
        throw error;
      } finally {
        client.release();
      }
    },
    ping: async () => { await pool.query("SELECT 1"); return true; },
    close: async () => { await pool.end(); }
  };
}

/* ------------------------------------------------------------------ SQLite */

async function createSqliteDriver(options) {
  const Database = (await import("better-sqlite3")).default;
  const path = await import("node:path");
  const fs = await import("node:fs");
  const { fileURLToPath } = await import("node:url");

  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const defaultRoot = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(rootDir, "data");
  const configured = options.databasePath ?? process.env.DATABASE_PATH;
  const dbPath = configured
    ? (configured === ":memory:" || path.isAbsolute(configured) ? configured : path.resolve(rootDir, configured))
    : path.join(defaultRoot, "app.db");
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  // better-sqlite3 is synchronous; wrap each call so the API is async on both
  // backends. Awaiting an already-resolved value is a no-op microtask.
  return {
    kind: "sqlite",
    raw: db,
    query: async (sql, params) => db.prepare(sql).all(...normalizeParams(params)),
    queryOne: async (sql, params) => db.prepare(sql).get(...normalizeParams(params)) ?? null,
    execute: async (sql, params) => {
      const info = db.prepare(sql).run(...normalizeParams(params));
      return { rowCount: info.changes, changes: info.changes, rows: [] };
    },
    tx: async (callback) => {
      const scoped = {
        query: async (sql, ...p) => db.prepare(sql).all(...normalizeParams(p)),
        queryOne: async (sql, ...p) => db.prepare(sql).get(...normalizeParams(p)) ?? null,
        execute: async (sql, ...p) => {
          const info = db.prepare(sql).run(...normalizeParams(p));
          return { rowCount: info.changes, changes: info.changes, rows: [] };
        }
      };
      return runSerializedSqliteTransaction(db, scoped, callback);
    },
    ping: async () => { db.prepare("SELECT 1").get(); return true; },
    close: async () => { db.close(); }
  };
}

/* ------------------------------------------------------------------ factory */

/**
 * Create an isolated store instance. Options:
 *   - databaseUrl: force Postgres against this connection string.
 *   - databasePath: force SQLite at this path (":memory:" supported for tests).
 * With no options it mirrors the process env (DATABASE_URL -> Postgres, else SQLite).
 */
export function createStore(options = {}) {
  const kind = resolveUsesPostgres(options) ? "postgres" : "sqlite";
  let d = null;
  const ensure = async () => {
    if (d) return d;
    d = kind === "postgres" ? await createPostgresDriver(options) : await createSqliteDriver(options);
    return d;
  };
  return {
    kind,
    init: ensure,
    activeDriver: () => kind,
    query: async (sql, ...params) => (await ensure()).query(sql, params),
    queryOne: async (sql, ...params) => (await ensure()).queryOne(sql, params),
    execute: async (sql, ...params) => (await ensure()).execute(sql, params),
    tx: async (callback) => (await ensure()).tx(callback),
    ping: async () => (await ensure()).ping(),
    sqliteHandle: async () => {
      const active = await ensure();
      return active.kind === "sqlite" ? active.raw : null;
    },
    close: async () => {
      if (d) { await d.close(); d = null; }
    }
  };
}

/**
 * Wrap an existing better-sqlite3 handle in the async store interface. This is
 * the Stage B bridge: a function converted to the async store API can be called
 * with `wrapSqliteHandle(db)` at sites that still thread a raw `db`, so the same
 * connection is used (no duplication) and injected test databases keep working.
 * Removed per call site as the app finishes migrating to a threaded store.
 */
export function wrapSqliteHandle(db) {
  const scoped = {
    query: async (sql, ...p) => db.prepare(sql).all(...normalizeParams(p)),
    queryOne: async (sql, ...p) => db.prepare(sql).get(...normalizeParams(p)) ?? null,
    execute: async (sql, ...p) => {
      const info = db.prepare(sql).run(...normalizeParams(p));
      return { rowCount: info.changes, changes: info.changes, rows: [] };
    }
  };
  return {
    kind: "sqlite",
    activeDriver: () => "sqlite",
    ...scoped,
    tx: async (callback) => runSerializedSqliteTransaction(db, scoped, callback),
    ping: async () => { db.prepare("SELECT 1").get(); return true; }
  };
}

/* ------------------------------------------------------------------ default */

// Shared instance for the app. Module-level exports delegate here so existing
// `import * as store from "./dataStore.mjs"` call sites keep working unchanged.
const defaultStore = createStore();

export function initStore() { return defaultStore.init(); }
export function activeDriver() { return defaultStore.activeDriver(); }
export async function query(sql, ...params) { return defaultStore.query(sql, ...params); }
export async function queryOne(sql, ...params) { return defaultStore.queryOne(sql, ...params); }
export async function execute(sql, ...params) { return defaultStore.execute(sql, ...params); }
export async function tx(callback) { return defaultStore.tx(callback); }
export async function ping() { return defaultStore.ping(); }
export async function sqliteHandle() { return defaultStore.sqliteHandle(); }
export async function closeStore() { return defaultStore.close(); }
