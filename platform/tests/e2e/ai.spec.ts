import { expect, test, type Page } from "@playwright/test";

const password = "Synthetic!Passphrase2026";

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill("active@synthetic.ryva.test");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
}

test("AI Copilot preserves a complete manual workflow when generation is unavailable", async ({ page }) => {
  await signIn(page);
  await page.goto("/copilot");

  await expect(page.getByRole("heading", { name: "Responsible AI Assistance" })).toBeVisible();
  await expect(page.getByLabel("AI operating boundary")).toContainText("Manual workflow available");
  await expect(page.getByLabel("AI operating boundary")).toContainText("No training · no tools · no hidden scores");
  await expect(page.getByRole("button", { name: "Generate suggestion" })).toBeDisabled();
  await expect(page.getByLabel("AI assistance type").locator("option")).toHaveCount(28);
  await expect(page.getByText("Synthetic daily briefing", { exact: true })).toBeVisible();
});

test("reviewer can inspect evidence, freshness, classifications, and human boundaries", async ({ page }) => {
  await signIn(page);
  await page.goto("/copilot");
  await page.getByText("Synthetic daily briefing", { exact: true }).click();

  await expect(page.getByRole("heading", { name: "Synthetic daily briefing" })).toBeVisible();
  await expect(page.getByText("No target state changed")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Classification and citations" })).toBeVisible();
  await expect(page.getByText("direct evidence", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "[1] Synthetic workspace fixture" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Missing evidence" })).toBeVisible();
  await expect(page.getByText("Current qualified opportunities")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Known limitations" })).toBeVisible();
  await expect(page.getByText(/internal synthetic browser fixture/i)).toBeVisible();
  await expect(page.getByText("No provider training, tools, or external actions")).toBeVisible();

  const overflowElements = await page.evaluate(`[
    ...document.querySelectorAll("#main-content *")
  ].filter((element) => {
    const box = element.getBoundingClientRect();
    return box.right > document.documentElement.clientWidth + 1 || box.left < -1;
  }).map((element) => ({
    tag: element.tagName,
    className: String(element.className),
    text: String(element.textContent || "").trim().slice(0, 80),
    left: element.getBoundingClientRect().left,
    right: element.getBoundingClientRect().right
  })).slice(0, 20)`);
  expect(overflowElements).toEqual([]);
});
