import { loadConfig, resetConfigForTests } from "../../packages/config/src/index.js";
import { createDatabase } from "../../packages/database/src/index.js";
import { migrate } from "../../packages/database/src/migrate.js";
import { seedSynthetic } from "../../packages/database/src/seed.js";

export default async function globalSetup(): Promise<void> {
  const configuration = loadConfig(process.env);
  const database = createDatabase(configuration);
  await database.query("DROP SCHEMA public CASCADE");
  await database.query("CREATE SCHEMA public");
  await migrate(database);
  await database.end();
  resetConfigForTests();
  await seedSynthetic();
}
