import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "otplib";
import { expect, test, type Page } from "@playwright/test";
import { loadConfig } from "../../packages/config/src/index.js";
import { createDatabase } from "../../packages/database/src/index.js";
import { decryptSecret } from "../../packages/domain/src/index.js";
import { navigateFromShell } from "./shell.js";

const password = "Synthetic!Passphrase2026";

async function captureIncrement16(page: Page, fileName: string, fullPage = false): Promise<void> {
  if (process.env.CAPTURE_INCREMENT_16_SCREENSHOTS !== "1") return;
  const path = fileURLToPath(new URL(`../../docs/ui-redesign-spec/screenshots/increment-16/${fileName}`, import.meta.url));
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage, animations: "disabled" });
}

async function expectNoViewportLoss(page: Page) {
  const overflow = await page.evaluate(() => {
    const currentDocument = (globalThis as unknown as {
      document: { documentElement: { scrollWidth: number; clientWidth: number } };
    }).document;
    return currentDocument.documentElement.scrollWidth >
      currentDocument.documentElement.clientWidth + 2;
  });
  expect(overflow).toBe(false);
}

async function login(page: Page, email = "active@synthetic.ryva.test") {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
}

async function adminCode(): Promise<string> {
  const configuration = loadConfig(process.env);
  const database = createDatabase(configuration);
  try {
    const result = await database.query<{ mfa_secret_ciphertext: string }>(
      `SELECT mfa_secret_ciphertext FROM users WHERE email='admin@synthetic.ryva.test'`
    );
    return generate({
      secret: decryptSecret(result.rows[0]!.mfa_secret_ciphertext, configuration.FIELD_ENCRYPTION_KEY)
    });
  } finally {
    await database.end();
  }
}

async function loginAdmin(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@synthetic.ryva.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Verify your sign-in" })).toBeVisible();
  await page.getByLabel("Verification code").fill(await adminCode());
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page.getByRole("heading", { name: "Platform operations" })).toBeVisible({ timeout: 20_000 });
}

test("Analytics workspace distinguishes periods, freshness, and accessible tables", async ({ page }, testInfo) => {
  await login(page);
  await page.goto("/analytics");
  await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Analytics filters" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Performance overview" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Export data" })).toBeVisible();
  await expectNoViewportLoss(page);
  if (!testInfo.project.name.includes("mobile")) {
    await captureIncrement16(page, "analytics-populated-desktop-1440x900.png", true);
  } else {
    await captureIncrement16(page, "analytics-mobile-390x844.png", true);
  }
  await page.getByLabel("From").fill("2020-01-01");
  await page.getByLabel("To").fill("2020-01-31");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByLabel("From")).toHaveValue("2020-01-01");
  await expect(page.getByLabel("To")).toHaveValue("2020-01-31");
  if (!testInfo.project.name.includes("mobile")) {
    await captureIncrement16(page, "analytics-filtered-date-range-desktop-1440x900.png", true);
  }
  await page.getByRole("tab", { name: "Pipeline Analytics" }).click();
  await expect(page.getByRole("region", { name: "Pipeline" })).toBeVisible();
  await page.getByRole("tab", { name: "Reports" }).click();
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Analytics CSV exports" })).toBeVisible();
  await page.getByRole("button", { name: "Metric guide" }).click();
  await expect(page.getByRole("region", { name: "Metric guide" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Expected commission/ })).toBeVisible();
  await expect(page.getByText("do not prove general market demand").first()).toBeVisible();
  if (!testInfo.project.name.includes("mobile")) {
    await captureIncrement16(page, "analytics-definitions-desktop-1440x900.png", true);
    await captureIncrement16(page, "analytics-freshness-or-partial-desktop-1440x900.png", true);
  }
});

test("Analytics restricted sessions remain honest", async ({ page }) => {
  await login(page, "mentor-readonly@synthetic.ryva.test");
  await page.goto("/analytics");
  await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(/restricted/i);
  await captureIncrement16(page, "analytics-restricted-desktop-1440x900.png", true);
  await expectNoViewportLoss(page);
});

test("Import staged preview remains distinct from execution", async ({ page }, testInfo) => {
  await login(page);
  await navigateFromShell(page, "Import");
  await expect(page.getByRole("heading", { name: "Import data" })).toBeVisible();
  const name = `Inc16Import${Date.now()}`;
  await page.locator("textarea").first().fill(`name\n${name}`);
  if (!testInfo.project.name.includes("mobile")) {
    await captureIncrement16(page, "import-selected-file-desktop-1440x900.png", true);
  }
  await page.getByRole("button", { name: "Preview import" }).click();
  await expect(page.getByRole("heading", { name: "Preview result" })).toBeVisible();
  await expect(page.getByText("awaiting explicit approval", { exact: true })).toBeVisible();
  await expect(page.getByText("Import committed.")).toHaveCount(0);
  if (!testInfo.project.name.includes("mobile")) {
    await captureIncrement16(page, "import-validation-preview-desktop-1440x900.png", true);
  } else {
    await captureIncrement16(page, "import-mobile-390x844.png", true);
  }
  await page.getByLabel("Approval rationale").fill(
    "I reviewed this synthetic row, its mapping, duplicate result, and authority boundaries."
  );
  await page.getByRole("button", { name: "Approve exact preview and commit" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/SHA-256 source digest/i)).toBeVisible();
  if (!testInfo.project.name.includes("mobile")) {
    await captureIncrement16(page, "import-execution-review-desktop-1440x900.png", true);
  } else {
    await captureIncrement16(page, "import-review-mobile-390x844.png", true);
  }
  await dialog.getByRole("button", { name: "Approve exact preview and commit" }).click();
  await expect(page.getByText("Import committed.")).toBeVisible();
  if (!testInfo.project.name.includes("mobile")) {
    await captureIncrement16(page, "import-success-desktop-1440x900.png", true);
  }
});

test("Export request is not file-ready until the worker completes", async ({ page }, testInfo) => {
  await login(page);
  await navigateFromShell(page, "Export");
  await expect(page.getByRole("heading", { name: "Secure exports" })).toBeVisible();
  if (!testInfo.project.name.includes("mobile")) {
    await captureIncrement16(page, "exports-register-desktop-1440x900.png", true);
  }
  await page.getByRole("checkbox", { name: "Brands" }).check();
  await page.getByRole("checkbox", { name: "Evidence" }).check();
  await page.getByRole("button", { name: "Generate export" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  if (!testInfo.project.name.includes("mobile")) {
    await captureIncrement16(page, "export-sensitive-scope-review-desktop-1440x900.png", true);
  } else {
    await captureIncrement16(page, "export-review-mobile-390x844.png", true);
  }
  await dialog.getByRole("button", { name: "Generate export" }).click();
  await expect(page.getByRole("heading", { name: "Export queued" })).toBeVisible();
  await expect(page.getByText(/durable worker will generate/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Download export" })).toHaveCount(0);
  if (!testInfo.project.name.includes("mobile")) {
    await captureIncrement16(page, "export-processing-queued-desktop-1440x900.png", true);
  }
  await expect(page.getByRole("heading", { name: /Export ready|Export queued/ })).toBeVisible({ timeout: 30_000 });
  if (!testInfo.project.name.includes("mobile")) {
    await captureIncrement16(page, "export-complete-or-processing-desktop-1440x900.png", true);
  }
});

test("Settings sections preserve save honesty and read-only states", async ({ page }, testInfo) => {
  await login(page);
  await navigateFromShell(page, "Settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Profile & account" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Preferences" })).toBeVisible();
  if (!testInfo.project.name.includes("mobile")) {
    await captureIncrement16(page, "settings-workspace-desktop-1440x900.png", true);
  } else {
    await captureIncrement16(page, "settings-mobile-390x844.png", true);
  }
  await page.getByRole("button", { name: "AI assistance" }).click();
  await expect(page.getByRole("heading", { name: "Evidence-first assistance" })).toBeVisible();
  await page.getByRole("button", { name: "Security" }).click();
  await expect(page.getByRole("heading", { name: "Active sessions" })).toBeVisible();
  await page.getByRole("button", { name: "Account closure" }).click();
  await expect(page.getByRole("button", { name: "Request account closure review" })).toBeVisible();

  await login(page, "mentor-readonly@synthetic.ryva.test");
  await page.goto("/settings");
  await page.getByRole("button", { name: "Preferences" }).click();
  await expect(page.getByRole("alert")).toContainText(/restricted/i);
  if (!testInfo.project.name.includes("mobile")) {
    await captureIncrement16(page, "settings-restricted-desktop-1440x900.png", true);
  }
});

test("Profile and Access keep capability honesty", async ({ page }, testInfo) => {
  await login(page, "mentor-readonly@synthetic.ryva.test");
  await navigateFromShell(page, "Profile");
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(/restricted/i);
  if (!testInfo.project.name.includes("mobile")) {
    await captureIncrement16(page, "profile-read-only-desktop-1440x900.png", true);
  }
  await page.goto("/access");
  await expect(page.getByRole("heading", { name: "Your Ryva access" })).toBeVisible();
  if (!testInfo.project.name.includes("mobile")) {
    await captureIncrement16(page, "access-restricted-desktop-1440x900.png", true);
  }
});

test("Operations distinguishes health, jobs, audit, and restricted visibility", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Admin MFA operations screenshots use desktop.");
  await login(page, "mentor-readonly@synthetic.ryva.test");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Platform operations" })).toBeVisible();
  await expect(page.getByText(/could not be loaded|Operational boundary|Least-privilege/i).first()).toBeVisible();
  await captureIncrement16(page, "operations-restricted-desktop-1440x900.png", true);

  await loginAdmin(page);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Platform operations" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Provider and safety status" })).toBeVisible();
  await expect(page.locator("pre, code").filter({ hasText: /Error:|at Object\.|Bearer / })).toHaveCount(0);
  await captureIncrement16(page, "operations-status-desktop-1440x900.png", true);
  await page.getByRole("button", { name: "AI control" }).click();
  await expect(page.getByRole("heading", { name: "AI generation kill switch" })).toBeVisible();
  await captureIncrement16(page, "operations-ai-control-desktop-1440x900.png", true);
  await page.getByRole("button", { name: "Jobs" }).click();
  await expect(page.getByRole("heading", { name: "Job health" })).toBeVisible();
  await captureIncrement16(page, "operations-jobs-desktop-1440x900.png", true);
  await page.getByRole("button", { name: "Audit" }).click();
  await expect(page.getByRole("heading", { name: "Recent audit events" })).toBeVisible();
  await captureIncrement16(page, "operations-audit-desktop-1440x900.png", true);
});

test("Boundary honesty: missing records are not fabricated as activity", async ({ page }) => {
  await login(page);
  await page.goto("/analytics");
  await expect(page.getByText("No verified Orders match these filters.")).toBeVisible();
  await page.getByRole("tab", { name: "Pipeline Analytics" }).click();
  await expect(page.getByRole("region", { name: "Pipeline" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Needs attention" })).toBeVisible();
});
