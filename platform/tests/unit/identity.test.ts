import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { ConfiguredTransactionalIdentityEmailProvider } from "../../apps/api/src/providers.js";
import { loadConfig } from "../../packages/config/src/index.js";
import { AppError } from "../../packages/shared/src/index.js";

void describe("Identity P0A security contracts", () => {
  void it("fails safely when the transactional provider is not configured", async () => {
    const provider = new ConfiguredTransactionalIdentityEmailProvider(loadConfig({
      NODE_ENV: "test",
      DATABASE_URL: "postgres://localhost/unused",
      PGSSL: "disable"
    }));
    await assert.rejects(
      provider.send({
        kind: "password_reset",
        to: "person@example.test",
        subject: "Reset",
        text: "Reset message",
        idempotencyKey: "identity-test"
      }),
      (error: unknown) => error instanceof AppError && error.type === "transactional_email_unavailable"
    );
  });

  void it("does not print generated staff TOTP secrets from the synthetic seed", () => {
    const source = readFileSync(new URL("../../packages/database/src/seed.ts", import.meta.url), "utf8");
    assert.doesNotMatch(source, /TOTP secret:\s*\$\{/);
    assert.doesNotMatch(source, /console\.log\([^)]*(secret|token)/i);
  });
});
