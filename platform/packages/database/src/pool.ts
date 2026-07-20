import pg from "pg";
import type { PoolClient, QueryResultRow } from "pg";
import type { AppConfig } from "../../config/src/index.js";

const { Pool } = pg;

export type Database = pg.Pool;
export type Transaction = PoolClient;

export function postgresSsl(mode: AppConfig["PGSSL"]): false | { rejectUnauthorized: boolean } {
  if (mode === "disable") return false;
  if (mode === "require") return { rejectUnauthorized: false };
  return { rejectUnauthorized: true };
}

export function createDatabase(configuration: AppConfig): Database {
  return new Pool({
    connectionString: configuration.DATABASE_URL,
    max: configuration.PG_POOL_MAX,
    ssl: postgresSsl(configuration.PGSSL),
    application_name: "ryva-pro"
  });
}

export async function withTransaction<T>(
  database: Database,
  work: (transaction: Transaction) => Promise<T>
): Promise<T> {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function oneOrNone<T extends QueryResultRow>(
  client: Database | Transaction,
  text: string,
  values: readonly unknown[] = []
): Promise<T | null> {
  const result = await client.query<T>(text, [...values]);
  return result.rows[0] ?? null;
}
