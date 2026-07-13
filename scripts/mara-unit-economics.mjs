#!/usr/bin/env node
/**
 * Mara unit-economics model (code-grounded + official provider list prices).
 * Pricing snapshot date: 2026-07-12.
 *
 * Run: node scripts/mara-unit-economics.mjs
 * Writes: docs/pricing/mara-unit-economics-*.csv
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "docs", "pricing");
fs.mkdirSync(OUT, { recursive: true });

/** Official list prices as of 2026-07-12 */
const PRICES = {
  pricingDate: "2026-07-12",
  // Anthropic Claude Sonnet 4.6 — repo default ANTHROPIC_*_MODEL=claude-sonnet-4-6
  // Source: https://platform.claude.com/docs/en/about-claude/pricing
  sonnet46InPerMTok: 3.0,
  sonnet46OutPerMTok: 15.0,
  // Haiku 4.5 for routing recommendation
  haiku45InPerMTok: 1.0,
  haiku45OutPerMTok: 5.0,
  // OpenAI whisper-1 — source: https://developers.openai.com/api/docs/models/whisper-1
  whisperPerMinute: 0.006,
  // Stripe US domestic card + Billing pay-as-you-go
  // Sources: https://stripe.com/pricing ; Stripe Billing 0.7% (pay-as-you-go)
  stripePercent: 0.029,
  stripeFixed: 0.3,
  stripeBillingPercent: 0.007,
  // S3 Standard us-east-1 first 50TB — https://aws.amazon.com/s3/pricing/
  s3PerGbMonth: 0.023,
  // Hunter: credit-based; Data Platform volume pricing varies. Model as $/successful domain search.
  // Source: https://help.hunter.io/en/articles/1970956-hunter-api (1 credit / 1–10 emails)
  // Assumed blended $ when buying credits at starter volumes (assumption, not a list $/call).
  hunterDomainSearchAssumed: 0.1,
  // Apollo people search / enrichment — credits; assumed $ when using Basic-plan equivalent
  // Source: https://docs.apollo.io/docs/api-pricing ; plan credit economics ~$0.05–0.20/email
  apolloContactAssumed: 0.12,
  // Hosting allocation (Fly/Render/ECS + Postgres) — platform assumption, not a vendor quote
  infraFixedPerUserLow: 1.5,
  infraFixedPerUserExp: 3.0,
  infraFixedPerUserHigh: 6.0,
  supportPerUserDormant: 0.5,
  supportPerUserLight: 1.5,
  supportPerUserTypical: 3.0,
  supportPerUserHeavy: 8.0,
  supportPerUserAbuse: 20.0,
  refundAllowancePct: 0.02
};

function llmCost(inTok, outTok, { inRate = PRICES.sonnet46InPerMTok, outRate = PRICES.sonnet46OutPerMTok } = {}) {
  return (inTok / 1e6) * inRate + (outTok / 1e6) * outRate;
}

function stripeFee(price) {
  return price * PRICES.stripePercent + PRICES.stripeFixed + price * PRICES.stripeBillingPercent;
}

function netRevenue(price) {
  return price - stripeFee(price);
}

/**
 * Workflow unit costs — token sizes are BEHAVIORAL ASSUMPTIONS calibrated to
 * typical Mara prompt sizes in maraLlm/workerEngine (not measured production telemetry).
 * Confidence: medium for structure (code), low-medium for token magnitudes.
 */
const WORKFLOWS = {
  pitch_generation: { inTok: 9000, outTok: 2200, notes: "personalized_pitch / pitch_template" },
  content_ideas: { inTok: 8000, outTok: 2500, notes: "brand_content_ideas" },
  deep_research_synth: { inTok: 28000, outTok: 4500, notes: "deep_brand_research LLM pass after scrape" },
  brand_research_light: { inTok: 6000, outTok: 1500, notes: "scoring/packaging light" },
  opportunity_package: { inTok: 10000, outTok: 2800, notes: "prepare_opportunity_packages" },
  inbox_parse: { inTok: 7000, outTok: 1600, notes: "maraInboxParser per thread; cap 5/sync" },
  reply_classify: { inTok: 5000, outTok: 800, notes: "infer_commercial_outcomes / reply classifier" },
  ops_brief: { inTok: 9000, outTok: 2200, notes: "daily/weekly ops brief" },
  weekly_plan: { inTok: 11000, outTok: 3000, notes: "weekly_plan / schedule" },
  positioning: { inTok: 10000, outTok: 2800, notes: "creator positioning maintain" },
  ugc_strategy: { inTok: 12000, outTok: 3000, notes: "multi-platform strategy brief" },
  chat_turn: { inTok: 14000, outTok: 1800, notes: "office chat" },
  followup_draft: { inTok: 7000, outTok: 1400, notes: "prepare_due_followups" },
  video_multimodal: { inTok: 8000, outTok: 1200, notes: "max_tokens 1200 multimodal path" }
};

for (const [k, w] of Object.entries(WORKFLOWS)) {
  w.unitCostSonnet = llmCost(w.inTok, w.outTok);
  w.unitCostHaiku = llmCost(w.inTok, w.outTok, {
    inRate: PRICES.haiku45InPerMTok,
    outRate: PRICES.haiku45OutPerMTok
  });
}

/**
 * Persona monthly activity — BEHAVIORAL ASSUMPTIONS.
 * Autonomy interval default 15m; brand research cap 5/day; outreach drafts 25/week;
 * AGENT_DAILY_LLM_CALL_LIMIT=300 (call count, not tokens).
 */
const PERSONAS = {
  dormant: {
    label: "Dormant",
    pitch: 8,
    content_ideas: 4,
    deep_research_synth: 2,
    brand_research_light: 40,
    opportunity_package: 4,
    inbox_parse: 12,
    reply_classify: 8,
    ops_brief: 20,
    weekly_plan: 4,
    positioning: 2,
    ugc_strategy: 8,
    chat_turn: 4,
    followup_draft: 6,
    video_minutes: 0,
    video_analyses: 0,
    hunter_searches: 0,
    apollo_contacts: 0,
    storage_gb: 0.05,
    support: PRICES.supportPerUserDormant
  },
  light: {
    label: "Light",
    pitch: 20,
    content_ideas: 12,
    deep_research_synth: 6,
    brand_research_light: 80,
    opportunity_package: 15,
    inbox_parse: 40,
    reply_classify: 25,
    ops_brief: 22,
    weekly_plan: 4,
    positioning: 2,
    ugc_strategy: 10,
    chat_turn: 20,
    followup_draft: 15,
    video_minutes: 3,
    video_analyses: 1,
    hunter_searches: 10,
    apollo_contacts: 5,
    storage_gb: 0.2,
    support: PRICES.supportPerUserLight
  },
  typical: {
    label: "Typical active",
    pitch: 45,
    content_ideas: 30,
    deep_research_synth: 15,
    brand_research_light: 110,
    opportunity_package: 35,
    inbox_parse: 90,
    reply_classify: 60,
    ops_brief: 22,
    weekly_plan: 4,
    positioning: 2,
    ugc_strategy: 10,
    chat_turn: 80,
    followup_draft: 35,
    video_minutes: 20,
    video_analyses: 5,
    hunter_searches: 40,
    apollo_contacts: 25,
    storage_gb: 1.5,
    support: PRICES.supportPerUserTypical
  },
  heavy: {
    label: "Heavy",
    pitch: 90,
    content_ideas: 60,
    deep_research_synth: 40,
    brand_research_light: 150,
    opportunity_package: 70,
    inbox_parse: 200,
    reply_classify: 140,
    ops_brief: 25,
    weekly_plan: 5,
    positioning: 3,
    ugc_strategy: 12,
    chat_turn: 250,
    followup_draft: 80,
    video_minutes: 90,
    video_analyses: 20,
    hunter_searches: 100,
    apollo_contacts: 80,
    storage_gb: 8,
    support: PRICES.supportPerUserHeavy
  },
  abuse: {
    label: "Abuse / worst-reasonable",
    // Hits daily LLM call ceiling most days: ~250 calls/day × 30 ≈ 7500 call-equivalents
    // Modeled by scaling expensive workflows toward cap.
    pitch: 100, // weekly outreach cap 25×4
    content_ideas: 80,
    deep_research_synth: 80, // weekly deep not enforced → risk
    brand_research_light: 150,
    opportunity_package: 100,
    inbox_parse: 400,
    reply_classify: 300,
    ops_brief: 30,
    weekly_plan: 8,
    positioning: 4,
    ugc_strategy: 20,
    chat_turn: 600,
    followup_draft: 100,
    video_minutes: 180, // 60 uploads × 3 min avg at duration cap
    video_analyses: 60,
    hunter_searches: 300,
    apollo_contacts: 250,
    storage_gb: 40,
    support: PRICES.supportPerUserAbuse
  }
};

function personaLlmCost(persona, routing = "all_sonnet") {
  let total = 0;
  const detail = {};
  for (const [wf, count] of Object.entries(persona)) {
    if (!WORKFLOWS[wf] || !count) continue;
    const unit =
      routing === "optimized" && ["inbox_parse", "reply_classify", "brand_research_light", "followup_draft"].includes(wf)
        ? WORKFLOWS[wf].unitCostHaiku
        : WORKFLOWS[wf].unitCostSonnet;
    const cost = unit * count;
    detail[wf] = { count, unit, cost };
    total += cost;
  }
  return { total, detail };
}

function personaVariableCost(persona, { productionReady = false, routing = "all_sonnet" } = {}) {
  const llm = personaLlmCost(persona, routing);
  const whisper = productionReady ? persona.video_minutes * PRICES.whisperPerMinute : 0;
  const multimodal =
    productionReady && persona.video_analyses
      ? persona.video_analyses * WORKFLOWS.video_multimodal.unitCostSonnet
      : 0;
  const hunter = productionReady ? persona.hunter_searches * PRICES.hunterDomainSearchAssumed : 0;
  const apollo = productionReady ? persona.apollo_contacts * PRICES.apolloContactAssumed : 0;
  const storage = persona.storage_gb * PRICES.s3PerGbMonth;
  const variable = llm.total + whisper + multimodal + hunter + apollo + storage;
  return {
    llm: llm.total,
    whisper,
    multimodal,
    hunter,
    apollo,
    storage,
    variable,
    llmDetail: llm.detail
  };
}

function costToServe(persona, opts) {
  const v = personaVariableCost(persona, opts);
  const fixedLow = PRICES.infraFixedPerUserLow;
  const fixedExp = PRICES.infraFixedPerUserExp;
  const fixedHigh = PRICES.infraFixedPerUserHigh;
  const support = persona.support;
  return {
    ...v,
    support,
    ctsLow: v.variable * 0.7 + fixedLow + support * 0.7,
    ctsExp: v.variable + fixedExp + support,
    ctsHigh: v.variable * 1.5 + fixedHigh + support * 1.4
  };
}

const CANDIDATE_PRICES = [29, 39, 40, 49, 59, 69, 79, 89, 99, 119, 149, 199];
const MARGINS = [0.6, 0.7, 0.75, 0.8, 0.85, 0.9];

function minPriceForMargin(cts, margin) {
  // revenue - cts = margin * revenue => revenue = cts / (1 - margin)
  // also need to cover stripe on that revenue — iterate
  let price = cts / (1 - margin);
  for (let i = 0; i < 8; i++) {
    const fee = stripeFee(price);
    const neededNet = cts / (1 - margin); // approximate contribution after fee differently
    // Gross after stripe: (price - fee - cts) / price = margin
    // price - fee - cts = margin * price
    // price*(1-margin) - fee = cts
    // price*(1-margin) - (p*sp + sf + p*sb) = cts
    // price * (1 - margin - sp - sb) = cts + sf
    price = (cts + PRICES.stripeFixed) / (1 - margin - PRICES.stripePercent - PRICES.stripeBillingPercent);
  }
  return price;
}

// --- Build tables ---
const scenarios = [
  { id: "current", productionReady: false, routing: "all_sonnet", label: "Current Mara (mocks off cost path)" },
  { id: "production", productionReady: true, routing: "all_sonnet", label: "Production-ready (real video+enrichment, all Sonnet)" },
  { id: "production_optimized", productionReady: true, routing: "optimized", label: "Production + Haiku routing for cheap workflows" }
];

const personaRows = [];
for (const sc of scenarios) {
  for (const [key, persona] of Object.entries(PERSONAS)) {
    const c = costToServe(persona, sc);
    personaRows.push({
      scenario: sc.id,
      scenario_label: sc.label,
      persona: key,
      persona_label: persona.label,
      llm: round(c.llm),
      whisper: round(c.whisper),
      multimodal: round(c.multimodal),
      hunter: round(c.hunter),
      apollo: round(c.apollo),
      storage: round(c.storage),
      variable: round(c.variable),
      support: round(c.support),
      cts_low: round(c.ctsLow),
      cts_exp: round(c.ctsExp),
      cts_high: round(c.ctsHigh)
    });
  }
}

const priceRows = [];
for (const price of CANDIDATE_PRICES) {
  const fee = stripeFee(price);
  const net = price - fee;
  for (const sc of scenarios.filter((s) => s.id !== "current" || true)) {
    if (sc.id === "current" && price !== 40 && price !== 39 && price !== 79) {
      // still compute all for production scenarios; include current for all prices too
    }
    const row = {
      price,
      stripe_fee: round(fee),
      net_revenue: round(net),
      scenario: sc.id
    };
    for (const [key, persona] of Object.entries(PERSONAS)) {
      const c = costToServe(persona, sc);
      const contrib = net - c.ctsExp;
      const gm = net > 0 ? (net - c.ctsExp) / price : 0; // vs list price
      const gmNet = net > 0 ? (net - c.ctsExp) / net : 0;
      row[`${key}_cts`] = round(c.ctsExp);
      row[`${key}_contrib`] = round(contrib);
      row[`${key}_gm_list`] = round(gm, 3);
      row[`${key}_gm_net`] = round(gmNet, 3);
      row[`${key}_headroom`] = round(net - c.ctsHigh);
    }
    priceRows.push(row);
  }
}

const marginRequirementRows = [];
for (const sc of scenarios) {
  for (const [key, persona] of Object.entries(PERSONAS)) {
    const c = costToServe(persona, sc);
    for (const m of MARGINS) {
      marginRequirementRows.push({
        scenario: sc.id,
        persona: key,
        cts_exp: round(c.ctsExp),
        target_gross_margin: m,
        min_list_price: round(minPriceForMargin(c.ctsExp, m), 2)
      });
    }
  }
}

const workflowRows = Object.entries(WORKFLOWS).map(([id, w]) => ({
  workflow: id,
  in_tokens_assumed: w.inTok,
  out_tokens_assumed: w.outTok,
  unit_cost_sonnet46_usd: round(w.unitCostSonnet, 4),
  unit_cost_haiku45_usd: round(w.unitCostHaiku, 4),
  notes: w.notes
}));

// Blend: 25% dormant, 35% light, 30% typical, 8% heavy, 2% abuse
const BLEND = { dormant: 0.25, light: 0.35, typical: 0.3, heavy: 0.08, abuse: 0.02 };
const blendRows = scenarios.map((sc) => {
  let exp = 0;
  let high = 0;
  for (const [k, w] of Object.entries(BLEND)) {
    const c = costToServe(PERSONAS[k], sc);
    exp += w * c.ctsExp;
    high += w * c.ctsHigh;
  }
  return {
    scenario: sc.id,
    blended_cts_exp: round(exp),
    blended_cts_high: round(high),
    distribution: JSON.stringify(BLEND)
  };
});

const sensitivityRows = [];
const base = costToServe(PERSONAS.typical, { productionReady: true, routing: "all_sonnet" });
for (const mult of [0.75, 1.0, 1.25]) {
  sensitivityRows.push({
    factor: "llm_price_multiplier",
    value: mult,
    typical_cts: round(base.ctsExp - base.llm + base.llm * mult)
  });
}
for (const brands of [5, 10, 30]) {
  // scale brand_research_light roughly with brands/day * 22
  const p = { ...PERSONAS.typical, brand_research_light: brands * 22 };
  sensitivityRows.push({
    factor: "brands_per_weekday",
    value: brands,
    typical_cts: round(costToServe(p, { productionReady: true }).ctsExp)
  });
}
for (const mins of [0, 5, 20, 60]) {
  const p = { ...PERSONAS.typical, video_minutes: mins, video_analyses: Math.max(1, Math.ceil(mins / 4)) };
  sensitivityRows.push({
    factor: "video_minutes",
    value: mins,
    typical_cts: round(costToServe(p, { productionReady: true }).ctsExp)
  });
}
for (const h of [0.02, 0.1, 0.25, 0.5]) {
  const saved = PRICES.hunterDomainSearchAssumed;
  PRICES.hunterDomainSearchAssumed = h;
  sensitivityRows.push({
    factor: "hunter_cost_per_search",
    value: h,
    typical_cts: round(costToServe(PERSONAS.typical, { productionReady: true }).ctsExp)
  });
  PRICES.hunterDomainSearchAssumed = saved;
}

writeCsv(path.join(OUT, "mara-unit-economics-personas.csv"), personaRows);
writeCsv(path.join(OUT, "mara-unit-economics-prices.csv"), priceRows);
writeCsv(path.join(OUT, "mara-unit-economics-margin-floors.csv"), marginRequirementRows);
writeCsv(path.join(OUT, "mara-unit-economics-workflows.csv"), workflowRows);
writeCsv(path.join(OUT, "mara-unit-economics-blend.csv"), blendRows);
writeCsv(path.join(OUT, "mara-unit-economics-sensitivity.csv"), sensitivityRows);

const summary = {
  pricingDate: PRICES.pricingDate,
  sources: {
    anthropic: "https://platform.claude.com/docs/en/about-claude/pricing",
    whisper: "https://developers.openai.com/api/docs/models/whisper-1",
    stripe: "https://stripe.com/pricing",
    hunterApi: "https://help.hunter.io/en/articles/1970956-hunter-api",
    apolloApi: "https://docs.apollo.io/docs/api-pricing",
    s3: "https://aws.amazon.com/s3/pricing/"
  },
  codeDefaults: {
    maraListPrice: 79,
    autonomyIntervalMinutes: 15,
    dailyBrandResearch: 5,
    weeklyOutreachDrafts: 25,
    weeklyDeepResearchLimit: 20,
    dailyLlmCallLimit: 300,
    videoMaxSeconds: 180,
    videoMaxBytes: 83886080,
    defaultModel: "claude-sonnet-4-6"
  },
  blend: BLEND,
  keyFindings: personaRows.filter((r) => r.scenario === "production" || r.scenario === "current")
};

fs.writeFileSync(path.join(OUT, "mara-unit-economics-summary.json"), JSON.stringify(summary, null, 2));

console.log("Wrote CSVs to", OUT);
console.log("\n=== CURRENT (mocks; LLM only) expected CTS ===");
for (const r of personaRows.filter((x) => x.scenario === "current")) {
  console.log(`${r.persona_label}: $${r.cts_low}–$${r.cts_exp}–$${r.cts_high}`);
}
console.log("\n=== PRODUCTION expected CTS ===");
for (const r of personaRows.filter((x) => x.scenario === "production")) {
  console.log(`${r.persona_label}: $${r.cts_low}–$${r.cts_exp}–$${r.cts_high}`);
}
console.log("\n=== BLENDED ===");
console.log(blendRows);

function round(n, d = 2) {
  const f = 10 ** d;
  return Math.round(Number(n) * f) / f;
}

function writeCsv(file, rows) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const lines = [keys.join(",")];
  for (const row of rows) {
    lines.push(keys.map((k) => csvEscape(row[k])).join(","));
  }
  fs.writeFileSync(file, lines.join("\n") + "\n");
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
