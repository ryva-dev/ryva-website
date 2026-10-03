import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { navigateFromShell } from "./shell.js";

const password="Synthetic!Passphrase2026";

async function login(page:Page){
  await page.goto("/login");
  await page.getByLabel("Email").fill("active@synthetic.ryva.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button",{name:"Sign in"}).click();
  await expect(page.getByRole("heading",{name:/Good (morning|afternoon|evening)/})).toBeVisible();
}

test("controlled import requires preview and exact approval",async({page},testInfo)=>{
  await login(page);
  await navigateFromShell(page, "Import");
  await expect(page.getByRole("heading",{name:"Import data"})).toBeVisible();
  const name=testInfo.project.name.includes("mobile")
    ?`OpalMobileImport${Date.now()}`
    :`QuartzDesktopImport${Date.now()}`;
  await page.locator("textarea").first().fill(`name\n${name}`);
  await page.getByRole("button",{name:"Preview import"}).click();
  await expect(page.getByRole("heading",{name:"Preview result"})).toBeVisible();
  await expect(page.getByText("awaiting explicit approval")).toBeVisible();
  await page.getByLabel("Approval rationale").fill(
    "I reviewed this synthetic row, its mapping, duplicate result, and authority boundaries."
  );
  await page.getByRole("button",{name:"Approve exact preview and commit"}).click();
  await page.getByRole("alertdialog").getByRole("button",{name:"Approve exact preview and commit"}).click();
  await expect(page.getByText("Import committed.")).toBeVisible();
  if (!testInfo.project.name.includes("mobile")) {
    await page.getByLabel("Search workspace").fill(name);
    await expect(page.getByRole("listbox", { name: "Search suggestions" })).toBeVisible();
    await expect(page.getByRole("option").filter({ hasText: name })).toBeVisible();
  }
});

test("workspace export is queued for durable generation",async({page})=>{
  await login(page);
  await navigateFromShell(page, "Export");
  await expect(page.getByRole("heading",{name:"Secure exports"})).toBeVisible();
  await page.getByRole("checkbox", { name: "Brands" }).check();
  await page.getByRole("checkbox", { name: "Evidence" }).check();
  await page.getByRole("button",{name:"Generate export"}).click();
  await page.getByRole("alertdialog").getByRole("button",{name:"Generate export"}).click();
  await expect(page.getByRole("heading",{name:"Export queued"})).toBeVisible();
  await expect(page.getByText(/durable worker will generate/i)).toBeVisible();
});
