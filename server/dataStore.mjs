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
// SQL conventions for call sites:
//   * Use `?` positional placeholders everywhere. The Postgres driver rewrites
//     them to `$1, $2, …`; SQLite uses them natively.
//   * Avoid dialect-only SQL in shared queries. Known exceptions to translate
//     during the cutover: `INSERT OR REPLACE/IGNORE` (-> ON CONFLICT),
//     `lower(hex(randomblob(16)))` (-> gen_random_uuid()), `strftime`/`datetime`.

let driver = null;
let driverKind = null;

function usePostgres() {
  return Boolean(String(process.env.DATABASE_URL ?? "").trim());
}

/** Translate better-sqlite3 style `?` placeholders into Postgres `$1, $2, …`. */
export function toPgPlaceholders(sql) {
  let index = 0;
  return String(sql).replace(/\?/g, () => `$${++index}`);
}

function normalizeParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params;
}

/* ---------------------------------------------------------------- Postgres */

async function createPostgresDriver() {
  const pg = (await import("pg")).default;
  const { Pool } = pg;

  const sslDisabled = String(process.env.PGSSL ?? "").trim().toLowerCase() === "disable";
  const pool = new Pool({
    connectionString: String(process.env.DATABASE_URL).trim(),
    // Managed Postgres (RDS/Aurora) presents certs Node won't validate by
    // default; rejectUnauthorized:false is the standard posture there.
    ssl: sslDisabled ? false : { rejectUnauthorized: false },
    max: Number.parseInt(process.env.PG_POOL_MAX ?? "10", 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000
  });
  pool.on("error", (error) => console.error("Postgres pool error:", error));

  const run = async (sql, params) => pool.query(toPgPlaceholders(sql), normalizeParams(params));

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

async function createSqliteDriver() {
  const Database = (await import("better-sqlite3")).default;
  const path = await import("node:path");
  const fs = await import("node:fs");
  const { fileURLToPath } = await import("node:url");

  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const defaultRoot = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(rootDir, "data");
  const configured = process.env.DATABASE_PATH;
  const dbPath = configured
    ? (path.isAbsolute(configured) ? configured : path.resolve(rootDir, configured))
    : path.join(defaultRoot, "app.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

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
      // better-sqlite3's own db.transaction() requires a synchronous fn, but our
      // callbacks await sync-wrapped calls (which resolve immediately on one
      // connection). Manage the transaction explicitly to allow the async shape.
      db.exec("BEGIN");
      try {
        const scoped = {
          query: async (sql, ...p) => db.prepare(sql).all(...normalizeParams(p)),
          queryOne: async (sql, ...p) => db.prepare(sql).get(...normalizeParams(p)) ?? null,
          execute: async (sql, ...p) => {
            const info = db.prepare(sql).run(...normalizeParams(p));
            return { rowCount: info.changes, changes: info.changes, rows: [] };
          }
        };
        const value = await callback(scoped);
        db.exec("COMMIT");
        return value;
      } catch (error) {
        try { db.exec("ROLLBACK"); } catch { /* ignore */ }
        throw error;
      }
    },
    ping: async () => { db.prepare("SELECT 1").get(); return true; },
    close: async () => { db.close(); }
  };
}

/* ------------------------------------------------------------------ public */

/** Initialize (once) and return the active driver. */
export async function initStore() {
  if (driver) return driver;
  driver = usePostgres() ? await createPostgresDriver() : await createSqliteDriver();
  driverKind = driver.kind;
  return driver;
}

async function ensureDriver() {
  return driver ?? (await initStore());
}

export function activeDriver() {
  return driverKind;
}

export async function query(sql, ...params) {
  return (await ensureDriver()).query(sql, params);
}

export async function queryOne(sql, ...params) {
  return (await ensureDriver()).queryOne(sql, params);
}

export async function execute(sql, ...params) {
  return (await ensureDriver()).execute(sql, params);
}

export async function tx(callback) {
  return (await ensureDriver()).tx(callback);
}

export async function ping() {
  return (await ensureDriver()).ping();
}

/** Underlying better-sqlite3 handle when on SQLite (schema bootstrap only). */
export async function sqliteHandle() {
  const active = await ensureDriver();
  return active.kind === "sqlite" ? active.raw : null;
}

export async function closeStore() {
  if (driver) { await driver.close(); driver = null; driverKind = null; }
}
