import type { Page } from "@playwright/test";

const bottomNavigation = new Set(["Home", "Tasks", "Placements", "Search"]);

export async function navigateFromShell(page: Page, label: string): Promise<void> {
  const mobile = (page.viewportSize()?.width ?? 1440) <= 768;

  if (mobile && bottomNavigation.has(label)) {
    await page.getByRole("navigation", { name: "Mobile primary" })
      .getByRole("link", { name: label, exact: true })
      .click();
    return;
  }

  if (mobile) {
    await page.getByRole("button", { name: "More", exact: true }).click();
  } else if (label === "Profile") {
    await page.locator('summary[aria-label^="Profile:"]').click();
  }

  if (label === "Import" || label === "Export") {
    await page.locator("summary", { hasText: "Data transfer" }).filter({ visible: true }).click();
  }

  await page.getByRole("link", { name: label, exact: true }).filter({ visible: true }).click();
}
