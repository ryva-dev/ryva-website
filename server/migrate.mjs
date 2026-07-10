// Ryva — Postgres migration runner (Phase 2, Stage A)
//
// Applies every *.sql file in server/db/migrations in filename order, exactly
// once, tracked in a schema_migrations table. Idempotent: already-applied files
// are skipped. Run with:  node server/migrate.mjs   (requires DATABASE_URL)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool, closePool } from "./dataStore.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "db", "migrations");

async function ensureMigrationsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function appliedMigrations(pool) {
  const result = await pool.query("SELECT filename FROM schema_migrations");
  return new Set(result.rows.map((row) => row.filename));
}

export async function runMigrations() {
  const pool = getPool();
  await ensureMigrationsTable(pool);
  const applied = await appliedMigrations(pool);

  const files = fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    const client = await pool.connect();
    try {
      // Each migration file runs in its own transaction so a failure rolls the
      // whole file back rather than leaving a half-applied schema.
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

  if (count === 0) console.log("No pending migrations.");
  else console.log(`Applied ${count} migration(s).`);
}

// Allow `node server/migrate.mjs` as well as programmatic import.
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
