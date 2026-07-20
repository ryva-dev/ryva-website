import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const outputDirectory = new URL("../docs/ui-redesign-spec/screenshots/increment-3/", import.meta.url);
await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on("console", (message) => {
  const location = message.location();
  const expectedSignedOutSessionCheck =
    message.type() === "error" &&
    message.text().includes("401 (Unauthorized)") &&
    location.url.includes("/api/session");
  if (message.type() === "error" && !expectedSignedOutSessionCheck) {
    consoleErrors.push(`${message.text()}${location.url ? ` · ${location.url}` : ""}`);
  }
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

await page.goto("http://127.0.0.1:5173/login");
await page.getByLabel("Email").fill("active@synthetic.ryva.test");
await page.getByLabel("Password").fill("Synthetic!Passphrase2026");
await page.getByRole("button", { name: "Sign in" }).click();
await page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ }).waitFor();

await page.evaluate(() => {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("ryva.sidebar.")) localStorage.removeItem(key);
  }
});
await page.reload();
await page.getByRole("button", { name: "Collapse navigation" }).waitFor();

const results = [];
async function inspect(name, width, height, screenshot = false) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    visualWidth: window.visualViewport?.width ?? window.innerWidth,
    offenders: [...document.querySelectorAll("#main-content *, .ry-mobile-bottom-nav > *")]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          className: String(element.className),
          text: String(element.textContent ?? "").trim().slice(0, 60),
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height
        };
      })
      .filter((item) => item.width > 0 && item.height > 0)
      .filter((item) => item.left < -0.5 || item.right > (window.visualViewport?.width ?? window.innerWidth) + 0.5),
    bottomItems: [...document.querySelectorAll(".ry-mobile-bottom-nav > *")].map((element) => {
      const rect = element.getBoundingClientRect();
      return { label: element.textContent?.trim(), left: rect.left, right: rect.right };
    })
  }));
  results.push({ name, width, height, ...dimensions });
  if (screenshot) {
    await page.screenshot({
      path: new URL(`${name}.png`, outputDirectory).pathname,
      fullPage: false
    });
  }
}

await inspect("desktop-expanded-1440x900", 1440, 900, true);
await page.getByRole("button", { name: "Collapse navigation" }).click();
await page.waitForTimeout(300);
await inspect("desktop-collapsed-1440x900", 1440, 900, true);

await page.setViewportSize({ width: 1024, height: 768 });
await page.getByRole("button", { name: "Expand navigation" }).click();
await page.locator(".ry-shell-tablet-open").waitFor();
await page.waitForTimeout(300);
await inspect("tablet-navigation-1024x768", 1024, 768, true);

await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole("navigation", { name: "Mobile primary" }).waitFor();
await page.waitForTimeout(300);
await inspect("mobile-navigation-closed-390x844", 390, 844, true);
await page.getByRole("button", { name: "More", exact: true }).click();
await page.getByRole("dialog", { name: "Home" }).waitFor();
await page.waitForTimeout(300);
await inspect("mobile-navigation-open-390x844", 390, 844, true);
await page.getByRole("button", { name: "Sign out" }).scrollIntoViewIfNeeded();
await page.getByRole("button", { name: "Sign out" }).waitFor();
await page.keyboard.press("Escape");

for (const viewport of [
  { name: "mobile-375x812", width: 375, height: 812 },
  { name: "mobile-320x568", width: 320, height: 568 }
]) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.getByRole("navigation", { name: "Mobile primary" }).waitFor();
  await inspect(viewport.name, viewport.width, viewport.height);
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("dialog", { name: "Home" }).waitFor();
  await page.getByRole("button", { name: "Sign out" }).scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Sign out" }).waitFor();
  await page.keyboard.press("Escape");
}

await browser.close();

if (consoleErrors.length) {
  throw new Error(`Console errors during Increment 3 capture:\n${consoleErrors.join("\n")}`);
}
if (results.some((result) =>
  result.scrollWidth > result.clientWidth ||
  result.offenders.length > 0 ||
  result.bottomItems.some((item) => item.left < 0 || item.right > result.visualWidth)
)) {
  throw new Error(`Responsive clipping found:\n${JSON.stringify(results, null, 2)}`);
}

console.log(JSON.stringify({ screenshots: results, consoleErrors }, null, 2));
