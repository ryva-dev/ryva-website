import http from "node:http";
import { config } from "../../../packages/config/src/index.js";
import { createDatabase } from "../../../packages/database/src/index.js";
import { migrate } from "../../../packages/database/src/migrate.js";
import { createLogger } from "../../../packages/domain/src/index.js";
import { createApp } from "./app.js";

const configuration = config();
const logger = createLogger(configuration);
const database = createDatabase(configuration);

await migrate(database);
const app = createApp({ database, configuration, logger });
const server = http.createServer(app);

server.listen(configuration.PORT, "0.0.0.0", () => {
  logger.info("server.started", {
    port: configuration.PORT,
    environment: configuration.NODE_ENV
  });
});

let stopping = false;
function shutdown(signal: string): void {
  if (stopping) return;
  stopping = true;
  logger.info("server.stopping", { signal });
  const timeout = setTimeout(() => process.exit(1), 15_000);
  timeout.unref();
  server.close(() => {
    void database.end().then(() => {
      clearTimeout(timeout);
      logger.info("server.stopped", { signal });
      process.exit(0);
    });
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.error("process.unhandled_rejection", { reason: String(reason) });
});
process.on("uncaughtException", (error) => {
  logger.error("process.uncaught_exception", { error: error.message });
  shutdown("uncaughtException");
});
