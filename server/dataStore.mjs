// Ryva — async Postgres data-access layer (Phase 2, Stage A)
//
// This is the seam the whole migration turns on. Today the app calls the
// synchronous better-sqlite3 API directly:
//
//     db.prepare(sql).get(params)   -> row | undefined
//     db.prepare(sql).all(params)   -> row[]
//     db.prepare(sql).run(params)   -> { changes, lastInsertRowid }
//
// Postgres (node-postgres) is asynchronous. Stage B rewrites those call sites
// to the async helpers below. Keeping the SQL text almost identical — only the
// `?` placeholders change to `$1, $2, …`, which `toPgPlaceholders` does for us —
// keeps that mechanical rewrite low-risk.
//
// Nothing here runs unless DATABASE_URL is set, so importing this module on the
// still-SQLite main branch is inert.

import pg from "pg";

const { Pool } = pg;

let pool = null;

/**
 * Lazily construct the shared connection pool from DATABASE_URL.
 * SSL is enabled automatically for managed hosts (RDS/Aurora/most cloud PG);
 * disable by setting PGSSL=disable for a local database.
 */
export function getPool() {
  if (pool) return pool;

  const connectionString = String(process.env.DATABASE_URL ?? "").trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Postgres data layer is unavailable.");
  }

  const sslDisabled = String(process.env.PGSSL ?? "").trim().toLowerCase() === "disable";
  pool = new Pool({
    connectionString,
    // Managed Postgres terminates TLS with certs Node doesn't ship in its
    // trust store; rejectUnauthorized:false is standard for RDS/Aurora.
    ssl: sslDisabled ? false : { rejectUnauthorized: false },
    max: Number.parseInt(process.env.PG_POOL_MAX ?? "10", 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000
  });

  pool.on("error", (error) => {
    // A pooled client erroring while idle should never crash the process.
    console.error("Postgres pool error:", error);
  });

  return pool;
}

/**
 * Translate better-sqlite3 style `?` placeholders into Postgres `$1, $2, …`.
 * The codebase uses only positional `?` parameters (never literal question
 * marks inside SQL string literals), so a straight positional replace is safe.
 */
export function toPgPlaceholders(sql) {
  let index = 0;
  return String(sql).replace(/\?/g, () => `$${++index}`);
}

/** Normalize params: accept either run(a, b, c) or run([a, b, c]). */
function normalizeParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params;
}

/** Run a query and return all rows. Mirrors `.all(...)`. */
export async function query(sql, ...params) {
  const result = await getPool().query(toPgPlaceholders(sql), normalizeParams(params));
  return result.rows;
}

/** Run a query and return the first row or null. Mirrors `.get(...)`. */
export async function queryOne(sql, ...params) {
  const result = await getPool().query(toPgPlaceholders(sql), normalizeParams(params));
  return result.rows[0] ?? null;
}

/**
 * Run a write and return affected-row info. Mirrors `.run(...)`.
 * `.changes` is provided as an alias for better-sqlite3's return shape so call
 * sites that read `result.changes` keep working after the rewrite.
 */
export async function execute(sql, ...params) {
  const result = await getPool().query(toPgPlaceholders(sql), normalizeParams(params));
  return { rowCount: result.rowCount, changes: result.rowCount, rows: result.rows };
}

/**
 * Run a function inside a transaction on a single dedicated client.
 * The callback receives a `tx` object exposing the same query/queryOne/execute
 * helpers, all bound to that client.
 */
export async function tx(callback) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const scoped = {
      query: async (sql, ...params) => (await client.query(toPgPlaceholders(sql), normalizeParams(params))).rows,
      queryOne: async (sql, ...params) => (await client.query(toPgPlaceholders(sql), normalizeParams(params))).rows[0] ?? null,
      execute: async (sql, ...params) => {
        const r = await client.query(toPgPlaceholders(sql), normalizeParams(params));
        return { rowCount: r.rowCount, changes: r.rowCount, rows: r.rows };
      }
    };
    const value = await callback(scoped);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* ignore rollback failure */ }
    throw error;
  } finally {
    client.release();
  }
}

/** Liveness check for /readyz — resolves if the database answers. */
export async function ping() {
  await getPool().query("SELECT 1");
  return true;
}

/** Close the pool (tests / graceful shutdown). */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
