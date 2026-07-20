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
async function capture(name, width, height) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight
  }));
  results.push({ name, width, height, ...dimensions });
  await page.screenshot({
    path: new URL(`${name}.png`, outputDirectory).pathname,
    fullPage: false
  });
}

await capture("desktop-expanded-1440x900", 1440, 900);
await page.getByRole("button", { name: "Collapse navigation" }).click();
await page.waitForTimeout(300);
await capture("desktop-collapsed-1440x900", 1440, 900);

await page.setViewportSize({ width: 1024, height: 768 });
await page.getByRole("button", { name: "Expand navigation" }).click();
await page.locator(".ry-shell-tablet-open").waitFor();
await page.waitForTimeout(300);
await capture("tablet-navigation-1024x768", 1024, 768);

await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole("navigation", { name: "Mobile primary" }).waitFor();
await page.waitForTimeout(300);
await capture("mobile-navigation-closed-390x844", 390, 844);
await page.getByRole("button", { name: "More", exact: true }).click();
await page.getByRole("dialog", { name: "Home" }).waitFor();
await page.waitForTimeout(300);
await capture("mobile-navigation-open-390x844", 390, 844);

await browser.close();

if (consoleErrors.length) {
  throw new Error(`Console errors during Increment 3 capture:\n${consoleErrors.join("\n")}`);
}
if (results.some((result) => result.scrollWidth > result.clientWidth)) {
  throw new Error(`Horizontal overflow found:\n${JSON.stringify(results, null, 2)}`);
}

console.log(JSON.stringify({ screenshots: results, consoleErrors }, null, 2));
