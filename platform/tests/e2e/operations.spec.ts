import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { navigateFromShell } from "./shell.js";

const password="Synthetic!Passphrase2026";

async function login(page:Page){
  await page.goto("/login");
  await page.getByLabel("Email").fill("active@synthetic.ryva.test");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button",{name:"Sign in"}).click();
  await expect(page.getByRole("heading",{name:/Good (morning|afternoon|evening)/})).toBeVisible();
}

test("controlled import requires preview and exact human approval",async({page},testInfo)=>{
  await login(page);
  await navigateFromShell(page, "Import");
  await expect(page.getByRole("heading",{name:"Import and review"})).toBeVisible();
  const name=testInfo.project.name.includes("mobile")
    ?`OpalMobileImport${Date.now()}`
    :`QuartzDesktopImport${Date.now()}`;
  await page.locator("textarea").first().fill(`name\n${name}`);
  await page.getByRole("button",{name:"Validate preview"}).click();
  await expect(page.getByRole("heading",{name:"Validation result"})).toBeVisible();
  await expect(page.getByText("awaiting explicit approval")).toBeVisible();
  await page.getByLabel("Approval rationale").fill(
    "I reviewed this synthetic row, its mapping, duplicate result, and authority boundaries."
  );
  await page.getByRole("button",{name:"Approve exact preview and commit"}).click();
  await page.getByRole("alertdialog").getByRole("button",{name:"Approve exact preview and commit"}).click();
  await expect(page.getByText("Import committed.")).toBeVisible();
  await navigateFromShell(page, "Search");
  await page.getByLabel("Search workspace").fill(name);
  await page.getByRole("button",{name:"Search",exact:true}).click();
  await expect(page.getByText(name,{exact:true})).toBeVisible();
});

test("workspace export is queued for durable generation",async({page})=>{
  await login(page);
  await navigateFromShell(page, "Export");
  await expect(page.getByRole("heading",{name:"Secure exports"})).toBeVisible();
  await page.getByText("brands",{exact:true}).click();
  await page.getByText("evidence",{exact:true}).click();
  await page.getByRole("button",{name:"Generate audited export"}).click();
  await page.getByRole("alertdialog").getByRole("button",{name:"Generate audited export"}).click();
  await expect(page.getByRole("heading",{name:"Export queued"})).toBeVisible();
  await expect(page.getByText(/durable worker will generate/i)).toBeVisible();
});
