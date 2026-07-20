import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import pg from "pg";

const sourceValue = process.env.DATABASE_URL;
if (!sourceValue) throw new Error("DATABASE_URL is required for the backup/restore drill.");
const source = new URL(sourceValue);
const sourceDatabase = source.pathname.slice(1);
if (!sourceDatabase) throw new Error("DATABASE_URL must include a database name.");
const restoreDatabase = `ryva_restore_drill_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
const admin = new URL(source);
admin.pathname = "/postgres";
const restore = new URL(source);
restore.pathname = `/${restoreDatabase}`;
const archive = path.join(tmpdir(), `${restoreDatabase}.dump`);
const { Pool } = pg;
const adminPool = new Pool({ connectionString: admin.toString(), ssl: false });

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code ?? "no status"}`));
    });
  });
}

try {
  await run("pg_dump", ["--format=custom", "--file", archive, source.toString()]);
  await adminPool.query(`CREATE DATABASE "${restoreDatabase}"`);
  await run("pg_restore", ["--no-owner", "--dbname", restore.toString(), archive]);
  const sourcePool = new Pool({ connectionString: source.toString(), ssl: false });
  const restorePool = new Pool({ connectionString: restore.toString(), ssl: false });
  const sourceResult = await sourcePool.query(
    "SELECT count(*)::int AS count FROM schema_migrations"
  );
  const restoreResult = await restorePool.query(
    "SELECT count(*)::int AS count FROM schema_migrations"
  );
  await sourcePool.end();
  await restorePool.end();
  if (sourceResult.rows[0]?.count !== restoreResult.rows[0]?.count) {
    throw new Error("Restored migration history does not match the source.");
  }
  process.stdout.write(
    `Backup/restore drill passed for ${sourceDatabase}; restored ${restoreResult.rows[0]?.count ?? 0} migrations.\n`
  );
} finally {
  await adminPool.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1`,
    [restoreDatabase]
  );
  await adminPool.query(`DROP DATABASE IF EXISTS "${restoreDatabase}"`);
  await adminPool.end();
  await rm(archive, { force: true });
}
