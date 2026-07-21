import { expect, test } from "@playwright/test";
import { navigateFromShell } from "./shell.js";

const password = "Synthetic!Passphrase2026";

test("eligible representative signs in and reaches the secure command surface", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("canceled-paid@synthetic.ryva.test");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
  await expect(page.getByText("full", { exact: true })).toBeVisible();
});

test("uncertified representative receives a clear access path", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("uncertified@synthetic.ryva.test");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/access$/);
  await expect(page.getByRole("heading", { name: "Your Ryva Pro access" })).toBeVisible();
  await expect(page.locator(".emphasis-panel .status")).toHaveText("certification required");
});

test("expired grace is visibly read-only on a mobile viewport", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("grace@synthetic.ryva.test");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("read only", { exact: true }).first()).toBeVisible();
  await navigateFromShell(page, "Profile");
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Read-only access" })).toBeDisabled();
});

test("representative creates and reviews a Brand Intelligence record", async ({ page }, testInfo) => {
  const recordName = `Synthetic Browser Brand ${testInfo.project.name}`;
  await page.goto("/login");
  await page.getByLabel("Email").fill("active@synthetic.ryva.test");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await navigateFromShell(page, "Brands");
  await expect(page.getByRole("heading", { name: "Brand Intelligence", exact: true })).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill(recordName);
  await page.getByRole("button", { name: "Create unqualified record" }).click();
  await expect(page.getByRole("heading", { name: recordName })).toBeVisible();
  await page.getByLabel("Exact claim or unknown").fill("Wholesale terms have not yet been supplied.");
  await page.getByRole("button", { name: "Add evidence" }).click();
  await expect(page.getByText("Wholesale terms have not yet been supplied.")).toBeVisible();
  await navigateFromShell(page, "Search");
  await page.getByLabel("Search workspace").fill(recordName);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText(recordName, { exact: true })).toBeVisible();
});

test("representative completes Product Intelligence research and comparison setup", async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  await page.goto("/login");
  await page.getByLabel("Email").fill("active@synthetic.ryva.test");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await navigateFromShell(page, "Brands");
  await page.getByLabel("Name", { exact: true }).fill(`Synthetic Product Parent ${suffix}`);
  await page.getByRole("button", { name: "Create unqualified record" }).click();
  await expect(page.getByRole("heading", {
    name: `Synthetic Product Parent ${suffix}`
  })).toBeVisible();
  await navigateFromShell(page, "Products");
  await expect(page.getByRole("heading", { name: "Product Intelligence" })).toBeVisible();
  const productCreate = page.getByRole("region", { name: "Create unqualified Product" });
  await productCreate.getByLabel("Name", { exact: true }).fill(`Synthetic Product A ${suffix}`);
  await productCreate.getByLabel("Brand").selectOption({ label: `Synthetic Product Parent ${suffix}` });
  await productCreate.getByLabel("Category").fill("Gift");
  await productCreate.getByRole("button", { name: "Create unqualified record" }).click();
  await expect(page.getByRole("heading", { name: `Synthetic Product A ${suffix}` })).toBeVisible();
  await page.getByRole("tab", { name: "Evidence" }).click();
  const evidencePanel = page.getByRole("tabpanel", { name: /Evidence/ });
  await evidencePanel.getByLabel("Exact claim or unknown").fill("Reorder evidence is not yet available.");
  await evidencePanel.getByRole("button", { name: "Add evidence" }).click();
  await expect(page.getByText("Evidence was recorded.", { exact: true })).toBeVisible();
  await expect(evidencePanel.getByRole("listitem").filter({ hasText: "Reorder evidence is not yet available." })).toBeVisible();
  await expect(evidencePanel.getByLabel("Exact claim or unknown")).toHaveValue("");
  await page.getByRole("tab", { name: "Qualification" }).click();
  const qualificationPanel = page.getByRole("tabpanel", { name: /Qualification/ });
  await expect(qualificationPanel.getByLabel("Metric")).toBeVisible();
  await qualificationPanel.getByLabel("Metric").fill("repeat_purchase");
  await qualificationPanel.getByLabel("Value", { exact: true }).fill("unknown");
  await qualificationPanel.getByRole("button", { name: "Record observation" }).click();
  await expect(page.getByText("Observation was recorded.", { exact: true })).toBeVisible();
  await expect(qualificationPanel.getByText("repeat_purchase")).toBeVisible();
  await page.goto("/products");
  await expect(page.getByRole("heading", { name: "Product Intelligence" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Product Intelligence results" }).getByRole("button", { name: `Synthetic Product A ${suffix}` })).toBeVisible();
  await expect(page.getByText(/Product Score/i)).toHaveCount(0);
});

test("representative creates a Buyer Intelligence record with visible qualification ownership", async ({ page }, testInfo) => {
  const name = `Synthetic Buyer Workspace ${testInfo.project.name}-${Date.now()}`;
  await page.goto("/login");
  await page.getByLabel("Email").fill("active@synthetic.ryva.test");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await navigateFromShell(page, "Businesses & Buyers");
  await expect(page.getByRole("heading", { name: "Buyer Intelligence" })).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Business type").fill("Independent gift shop");
  await page.getByRole("button", { name: "Create unqualified record" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Human decision gate" })).toBeVisible();
  await expect(page.getByText(/qualification and authority are human-owned/i)).toBeVisible();
  await page.getByLabel("Exact claim or unknown").fill("Decision-maker authority has not been verified.");
  await page.getByRole("button", { name: "Add evidence" }).click();
  await expect(page.getByText("Decision-maker authority has not been verified.")).toBeVisible();
});
