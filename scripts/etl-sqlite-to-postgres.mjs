#!/usr/bin/env node
/**
 * Stage C — SQLite → Postgres ETL
 *
 * Copies rows from a Ryva SQLite database into a migrated Postgres database
 * in FK-safe order. Common columns only (schema drift is skipped with a warning).
 *
 * Usage:
 *   DATABASE_URL=postgres://… PGSSL=disable \
 *     node scripts/etl-sqlite-to-postgres.mjs [--dry-run] [--sqlite path/to/app.db]
 *
 * Prerequisites:
 *   1. `npm run migrate` against DATABASE_URL (empty or already-migrated schema)
 *   2. Back up both databases before a live cutover
 *
 * Exit codes: 0 success, 1 failure / row-count mismatch (unless --force)
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import pg from "pg";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");
const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

/** FK-safe copy order. Parents before children. Unknown SQLite-only tables are skipped. */
const TABLE_ORDER = [
  "users",
  "sessions",
  "email_verification_tokens",
  "password_reset_tokens",
  "checkout_sessions",
  "hired_workers",
  "user_onboarding",
  "user_digest_log",
  "office_global_settings",
  "office_onboarding_sessions",
  "office_chat_messages",
  "office_custom_tasks",
  "office_activity_logs",
  "office_worker_settings",
  "office_worker_knowledge",
  "office_uploaded_files",
  "office_custom_briefings",
  "office_calendar_events",
  "office_worker_integrations",
  "office_email_threads",
  "office_campaigns",
  "office_leads",
  "office_suggested_actions",
  "office_assignments",
  "office_deliverables",
  "office_handbook_entries",
  "office_brand_opportunities",
  "office_trend_signals",
  "office_sync_jobs",
  "agent_llm_usage",
  "worker_permissions",
  "worker_tasks",
  "worker_activity_log",
  "worker_recurring_responsibilities",
  "worker_research_items",
  "worker_approval_requests",
  "worker_outputs",
  "worker_knowledge_modules",
  "worker_brands",
  "worker_trend_snapshots",
  "stripe_webhook_events",
  "durable_jobs",
  "professional_research_candidates",
  "action_audit_events",
  "external_action_executions",
  "mara_brand_profiles",
  "mara_creator_performance_profiles",
  "mara_creator_brand_opportunities",
  "mara_creative_analyses",
  "mara_commercial_outcomes"
];

function parseArgs(argv) {
  const args = { dryRun: false, force: false, sqlitePath: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--force") args.force = true;
    else if (arg === "--sqlite") args.sqlitePath = argv[++i];
    else if (arg.startsWith("--sqlite=")) args.sqlitePath = arg.slice("--sqlite=".length);
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/etl-sqlite-to-postgres.mjs [--dry-run] [--force] [--sqlite path]

Copies SQLite app data into Postgres (DATABASE_URL). Run migrations first.
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function resolveSqlitePath(configured) {
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(repoRoot, configured);
  }
  if (process.env.DATABASE_PATH) {
    const p = process.env.DATABASE_PATH;
    return path.isAbsolute(p) ? p : path.resolve(repoRoot, p);
  }
  const storageRoot =
    process.env.STORAGE_ROOT ||
    process.env.RAILWAY_VOLUME_MOUNT_PATH ||
    path.join(repoRoot, "data");
  return path.join(storageRoot, "app.db");
}

function makePgPool() {
  const connectionString = String(process.env.DATABASE_URL ?? "").trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }
  const sslDisabled = String(process.env.PGSSL ?? "").trim().toLowerCase() === "disable";
  return new Pool({
    connectionString,
    ssl: sslDisabled ? false : { rejectUnauthorized: true }
  });
}

function sqliteTables(db) {
  return new Set(
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map((row) => row.name)
  );
}

function sqliteColumns(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name);
}

async function pgColumns(client, table) {
  const result = await client.query(
    `SELECT column_name AS name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table]
  );
  return result.rows.map((row) => row.name);
}

async function pgTableExists(client, table) {
  const result = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return result.rowCount > 0;
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function normalizeCell(value) {
  if (value === undefined) return null;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) return value.toString("utf8");
  return value;
}

async function copyTable(db, client, table, { dryRun }) {
  const sourceCols = sqliteColumns(db, table);
  const destCols = await pgColumns(client, table);
  const shared = sourceCols.filter((col) => destCols.includes(col));
  const skippedSource = sourceCols.filter((col) => !destCols.includes(col));
  const skippedDest = destCols.filter((col) => !sourceCols.includes(col));

  if (shared.length === 0) {
    return {
      table,
      sqliteCount: 0,
      copied: 0,
      skipped: true,
      reason: "no shared columns",
      skippedSource,
      skippedDest
    };
  }

  const rows = db.prepare(`SELECT ${shared.map(quoteIdent).join(", ")} FROM ${quoteIdent(table)}`).all();
  if (dryRun) {
    return {
      table,
      sqliteCount: rows.length,
      copied: 0,
      dryRun: true,
      skippedSource,
      skippedDest
    };
  }

  if (rows.length === 0) {
    return { table, sqliteCount: 0, copied: 0, skippedSource, skippedDest };
  }

  const placeholders = shared.map((_, index) => `$${index + 1}`).join(", ");
  const insertSql = `INSERT INTO ${quoteIdent(table)} (${shared.map(quoteIdent).join(", ")})
    VALUES (${placeholders})
    ON CONFLICT DO NOTHING`;

  let copied = 0;
  for (const row of rows) {
    const values = shared.map((col) => normalizeCell(row[col]));
    const result = await client.query(insertSql, values);
    copied += result.rowCount ?? 0;
  }

  const countResult = await client.query(`SELECT COUNT(*)::int AS count FROM ${quoteIdent(table)}`);
  return {
    table,
    sqliteCount: rows.length,
    copied,
    postgresCount: countResult.rows[0].count,
    skippedSource,
    skippedDest
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sqlitePath = resolveSqlitePath(args.sqlitePath);
  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`SQLite database not found: ${sqlitePath}`);
  }

  console.log(`Source SQLite: ${sqlitePath}`);
  console.log(`Target Postgres: ${String(process.env.DATABASE_URL).replace(/:[^:@/]+@/, ":***@")}`);
  console.log(args.dryRun ? "Mode: dry-run (no writes)" : "Mode: live copy (ON CONFLICT DO NOTHING)");

  const db = new Database(sqlitePath, { readonly: true, fileMustExist: true });
  const pool = makePgPool();
  const client = await pool.connect();
  const present = sqliteTables(db);
  const report = [];

  try {
    await client.query("BEGIN");
    for (const table of TABLE_ORDER) {
      if (!present.has(table)) {
        report.push({ table, skipped: true, reason: "missing in SQLite" });
        continue;
      }
      if (!(await pgTableExists(client, table))) {
        report.push({ table, skipped: true, reason: "missing in Postgres (run npm run migrate)" });
        continue;
      }
      const result = await copyTable(db, client, table, { dryRun: args.dryRun });
      report.push(result);
      const note = result.skipped
        ? `skip (${result.reason})`
        : args.dryRun
          ? `${result.sqliteCount} rows would copy`
          : `${result.copied}/${result.sqliteCount} inserted (pg now ${result.postgresCount})`;
      console.log(`  ${table}: ${note}`);
      if (result.skippedSource?.length) {
        console.log(`    sqlite-only columns ignored: ${result.skippedSource.join(", ")}`);
      }
      if (result.skippedDest?.length) {
        console.log(`    postgres-only columns left default/null: ${result.skippedDest.join(", ")}`);
      }
    }

    // Extra SQLite tables not in the ordered list
    for (const table of present) {
      if (TABLE_ORDER.includes(table) || table === "schema_migrations") continue;
      report.push({ table, skipped: true, reason: "not in ETL table order — inspect manually" });
      console.log(`  ${table}: skip (not in ETL order)`);
    }

    if (args.dryRun) {
      await client.query("ROLLBACK");
    } else {
      await client.query("COMMIT");
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
    db.close();
  }

  const mismatches = report.filter(
    (row) =>
      !row.skipped &&
      !row.dryRun &&
      Number.isFinite(row.postgresCount) &&
      row.postgresCount < row.sqliteCount &&
      row.copied < row.sqliteCount
  );

  console.log("\nReconciliation:");
  for (const row of report.filter((entry) => !entry.skipped && entry.sqliteCount > 0)) {
    if (args.dryRun) {
      console.log(`  ${row.table}: sqlite=${row.sqliteCount}`);
    } else {
      console.log(`  ${row.table}: sqlite=${row.sqliteCount} inserted=${row.copied} postgres_total=${row.postgresCount}`);
    }
  }

  if (mismatches.length > 0 && !args.force) {
    console.error("\nRow-count mismatches (duplicates or constraint skips). Re-run with --force to ignore.");
    for (const row of mismatches) {
      console.error(`  ${row.table}: sqlite=${row.sqliteCount} inserted=${row.copied} postgres_total=${row.postgresCount}`);
    }
    process.exit(1);
  }

  console.log(args.dryRun ? "\nDry-run complete." : "\nETL complete.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
