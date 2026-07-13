import fs from "node:fs";

const databasePath = "/tmp/ryva-playwright.db";
for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(`${databasePath}${suffix}`, { force: true });

process.env.NODE_ENV = "development";
process.env.HOST = "127.0.0.1";
process.env.PORT = "8799";
process.env.DATABASE_PATH = databasePath;
process.env.MARA_AUTONOMY_INTERVAL_MINUTES = "0";
process.env.ADMIN_EMAILS = ["desktop", "mobile"].flatMap((device) => [0, 1, 2].map((retry) => `e2e-${device}-${retry}@ryva.test`)).join(",");
process.env.SUPPORT_EMAIL = "support@ryva.test";

await import("../server/index.mjs");
