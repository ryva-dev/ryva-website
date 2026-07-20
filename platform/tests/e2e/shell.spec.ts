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

test("authenticated shell fits true narrow CSS viewports", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Exact CSS widths run once in desktop Chromium.");
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("401 (Unauthorized)")) {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await signIn(page);

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 375, height: 812 },
    { width: 320, height: 568 }
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole("navigation", { name: "Mobile primary" })).toBeVisible();

    const geometry = await page.evaluate(`(() => {
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      const visibleElements = [...document.querySelectorAll("#main-content *, .ry-mobile-bottom-nav > *")]
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName,
            className: String(element.className),
            text: String(element.textContent || "").trim().slice(0, 60),
            left: rect.left,
            right: rect.right,
            width: rect.width,
            height: rect.height
          };
        })
        .filter((item) => item.width > 0 && item.height > 0);
      const bottomItems = [...document.querySelectorAll(".ry-mobile-bottom-nav > *")].map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          label: String(element.textContent || "").trim(),
          left: rect.left,
          right: rect.right
        };
      });
      return {
        viewportWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        offenders: visibleElements.filter((item) => item.left < -0.5 || item.right > viewportWidth + 0.5),
        bottomItems
      };
    })()`) as {
      viewportWidth: number;
      clientWidth: number;
      scrollWidth: number;
      offenders: Array<Record<string, unknown>>;
      bottomItems: Array<{ label: string; left: number; right: number }>;
    };

    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
    expect(geometry.offenders).toEqual([]);
    expect(geometry.bottomItems.map((item: { label: string }) => item.label)).toEqual([
      "Home", "Tasks", "Placements", "Search", "More"
    ]);
    expect(geometry.bottomItems.every((item: { left: number; right: number }) =>
      item.left >= 0 && item.right <= geometry.viewportWidth
    )).toBe(true);

    const more = page.getByRole("button", { name: "More", exact: true });
    await more.click();
    const menu = page.getByRole("dialog", { name: "Home" });
    await expect(menu).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(more).toBeFocused();
  }

  expect(consoleErrors).toEqual([]);
});
