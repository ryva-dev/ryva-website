// Ryva — Postgres migration runner (Phase 2)
//
// Applies every *.sql file in server/db/migrations in filename order, exactly
// once, tracked in schema_migrations. Postgres-only (migrations don't apply to
// the SQLite dev backend). Run with:  npm run migrate   (requires DATABASE_URL)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "db", "migrations");

function makePool() {
  const connectionString = String(process.env.DATABASE_URL ?? "").trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — nothing to migrate. (SQLite dev needs no migrations.)");
  }
  const sslDisabled = String(process.env.PGSSL ?? "").trim().toLowerCase() === "disable";
  return new Pool({
    connectionString,
    ssl: sslDisabled ? false : { rejectUnauthorized: false }
  });
}

export async function runMigrations() {
  const pool = makePool();
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    const applied = new Set((await pool.query("SELECT filename FROM schema_migrations")).rows.map((r) => r.filename));
    const files = fs.readdirSync(migrationsDir).filter((n) => n.endsWith(".sql")).sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      const client = await pool.connect();
      try {
        // One transaction per file: a failure rolls the whole file back rather
        // than leaving a half-applied schema.
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`Applied migration: ${file}`);
        count += 1;
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${error.message}`);
      } finally {
        client.release();
      }
    }
    console.log(count === 0 ? "No pending migrations." : `Applied ${count} migration(s).`);
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((error) => { console.error(error.message); process.exit(1); });
}
