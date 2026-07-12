import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { wrapSqliteHandle } from "./dataStore.mjs";
import { initMaraIntelligence } from "./maraIntelligence.mjs";
import { initMaraBrandArchitecture, savePublicBrand } from "./maraBrandCanonical.mjs";
import {
  extractContactsFromHtml,
  discoverAndPersistBrandContacts,
  assessContactUsability,
  CONTACT_TYPES,
  findBestOutreachContact,
  upsertBrandContact
} from "./maraContactDiscovery.mjs";
import { buildAutonomyPlannerContext, planMaraAutonomyActions } from "./maraAutonomyPlanner.mjs";

function makeStore() {
  return wrapSqliteHandle(new Database(":memory:"));
}

test("extractContactsFromHtml finds mailto and program links without inventing emails", () => {
  const html = `
    <a href="mailto:creators@glowtheory.example">Creators</a>
    <a href="/pages/creators">Creator program</a>
    <p>Email support@glowtheory.example for help</p>
    <a href="https://evil.example/cdn@tracker">noise</a>
  `;
  const extracted = extractContactsFromHtml(html, "https://glowtheory.example");
  assert.ok(extracted.emails.includes("creators@glowtheory.example"));
  assert.ok(extracted.emails.includes("support@glowtheory.example"));
  assert.ok(extracted.partnershipEmails.includes("creators@glowtheory.example"));
  assert.match(String(extracted.creatorProgramUrl), /creators/i);
});

test("discoverAndPersistBrandContacts crawls contact page via mock fetch", async () => {
  const store = makeStore();
  await initMaraIntelligence(store);
  await initMaraBrandArchitecture(store);
  const brand = await savePublicBrand(store, {
    brandName: "Glow Theory",
    website: "https://glowtheory.example",
    brandKey: "glow-theory"
  });

  const pages = {
    "https://glowtheory.example/": `
      <title>Glow Theory</title>
      <a href="/pages/contact">Contact</a>
      <a href="/pages/creators">Creators</a>
    `,
    "https://glowtheory.example/pages/contact": `
      <a href="mailto:partners@glowtheory.example">Partners</a>
      <form>partnership inquiry</form>
    `,
    "https://glowtheory.example/pages/creators": `
      <p>Apply at creators@glowtheory.example</p>
    `
  };

  const fetchImpl = async (url) => {
    const key = String(url).replace(/\/?$/, "/") === "https://glowtheory.example/"
      ? "https://glowtheory.example/"
      : String(url);
    const normalized = key.endsWith("/") && key !== "https://glowtheory.example/" ? key.slice(0, -1) : key;
    const body = pages[normalized] || pages[`${normalized}/`] || "";
    if (!body && normalized === "https://glowtheory.example") {
      return { ok: true, text: async () => pages["https://glowtheory.example/"] };
    }
    if (!body) throw new Error(`unexpected fetch ${url}`);
    return { ok: true, text: async () => body };
  };

  // Homepage URL without trailing slash
  const result = await discoverAndPersistBrandContacts(store, {
    userId: "u1",
    workerId: "mara-vale",
    publicBrandId: brand.id,
    brandName: "Glow Theory",
    website: "https://glowtheory.example",
    fetchImpl: async (url) => {
      const href = String(url);
      if (href === "https://glowtheory.example" || href === "https://glowtheory.example/") {
        return { ok: true, async text() { return pages["https://glowtheory.example/"]; } };
      }
      if (href.includes("/pages/contact")) {
        return { ok: true, async text() { return pages["https://glowtheory.example/pages/contact"]; } };
      }
      if (href.includes("/pages/creators")) {
        return { ok: true, async text() { return pages["https://glowtheory.example/pages/creators"]; } };
      }
      throw new Error(`unexpected ${href}`);
    }
  });

  assert.equal(result.outreachReady, true);
  assert.match(result.bestContact.value, /partners@glowtheory\.example|creators@glowtheory\.example/);
  const best = await findBestOutreachContact(store, "u1", "mara-vale", brand.id);
  assert.ok(best?.value.includes("@"));
});

test("inferred emails stay blocked until confirmed", () => {
  assert.equal(
    assessContactUsability({
      contactType: CONTACT_TYPES.INFERRED_PATTERN,
      inferred: true,
      verificationState: "unverified",
      source: "pattern"
    }).mayUseForOutreach,
    false
  );
});

test("planner prefers outreach-ready brands for pitches", () => {
  const context = buildAutonomyPlannerContext({
    onboarding: { status: "completed" },
    permissions: { canRunResearch: true },
    brandResearchRemaining: 2,
    brands: [
      { id: "b1", brandName: "No Contact Co", lastPitchAt: null, contactEmail: "" },
      { id: "b2", brandName: "Ready Co", lastPitchAt: null, contactEmail: "hi@ready.example" }
    ],
    growthPitchTargets: [
      { id: "o1", brandName: "No Contact Co", scoreTotal: 80, status: "qualified" },
      { id: "o2", brandName: "Ready Co", scoreTotal: 70, status: "qualified" }
    ],
    outputs: [{ outputType: "creator_positioning", createdAt: new Date().toISOString() }, { outputType: "brand_criteria", createdAt: new Date().toISOString() }],
    tasks: [],
    integrations: [],
    approvals: [],
    blockedTasks: [],
    dueRecurring: []
  });
  const actions = planMaraAutonomyActions(context);
  const pitches = actions.filter((action) => action.kind === "personalized_pitch");
  assert.equal(pitches[0].brandName, "Ready Co");
  assert.equal(pitches[0].outreachReady, true);
});

test("user-provided contact is immediately outreach-ready", async () => {
  const store = makeStore();
  await initMaraBrandArchitecture(store);
  const brand = await savePublicBrand(store, { brandName: "Serum Co", website: "https://serum.example", brandKey: "serum-co" });
  await upsertBrandContact(store, {
    userId: "u1",
    workerId: "mara-vale",
    publicBrandId: brand.id,
    contactType: CONTACT_TYPES.USER_PROVIDED,
    value: "ugc@serum.example",
    source: "user",
    forceAllow: true,
    confidence: 95
  });
  const best = await findBestOutreachContact(store, "u1", "mara-vale", brand.id);
  assert.equal(best.value, "ugc@serum.example");
});
