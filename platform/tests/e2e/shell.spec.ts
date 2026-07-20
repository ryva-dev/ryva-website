import { expect, test, type Page } from "@playwright/test";

const password = "Synthetic!Passphrase2026";

async function signIn(page: Page, email = "active@synthetic.ryva.test"): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)|Your Ryva Pro access/ })).toBeVisible();
}

test("approved shell navigation remains complete and capability-aware", async ({ page }, testInfo) => {
  await signIn(page);
  const mobile = testInfo.project.name.includes("mobile");

  if (mobile) {
    await expect(page.getByRole("navigation", { name: "Mobile primary" })).toBeVisible();
    await page.getByRole("button", { name: "More", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Home" })).toBeVisible();
  } else {
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  }

  for (const group of ["Operate", "Intelligence", "Commercial", "Analyze", "System"]) {
    await expect(page.getByRole("heading", { name: group, exact: true }).filter({ visible: true })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Businesses & Buyers", exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "AI Copilot", exact: true })).toHaveCount(0);
});

test("responsive shell controls preserve focus, escape, and compact navigation behavior", async ({ page }, testInfo) => {
  await signIn(page);
  const mobile = testInfo.project.name.includes("mobile");

  if (mobile) {
    const more = page.getByRole("button", { name: "More", exact: true });
    await more.click();
    await expect(page.getByRole("button", { name: "Close navigation menu" }).last()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(more).toBeFocused();
  } else {
    const collapse = page.getByRole("button", { name: "Collapse navigation" });
    await collapse.click();
    await expect(page.locator(".ry-shell")).toHaveClass(/ry-shell-collapsed/);
    await expect(page.getByRole("button", { name: "Expand navigation" })).toBeVisible();
  }

  const overflows = await page.evaluate(
    "document.documentElement.scrollWidth > document.documentElement.clientWidth"
  );
  expect(overflows).toBe(false);
});
