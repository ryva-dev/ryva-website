# Mara unit economics & pricing analysis

**Pricing snapshot date:** 2026-07-12
**Code baseline:** `mara/outcome-flywheel` (Mara launch price `$79/mo` in [`data/workers.json`](../../data/workers.json))
**Model script:** [`scripts/mara-unit-economics.mjs`](../scripts/mara-unit-economics.mjs)
**CSV outputs:** [`docs/pricing/`](./)

**Confidence legend used below**

| Tag | Meaning |
|---|---|
| **Verified** | Confirmed in repo or official provider page |
| **Code estimate** | Derived from defaults/limits in code |
| **Provider price** | Official list price on the date above |
| **Behavioral assumption** | How often creators use Mara (not measured in prod) |
| **Unknown** | Needs production telemetry |

---

## 1. Executive conclusion

Mara’s launch price is now **$79/mo**, aligned with this analysis. Her default stack remains all Claude Sonnet with autonomy every 15 minutes and a 300 LLM-calls/day ceiling (count, not dollars). Under production-ready providers, expected cost-to-serve for a typical active user is ~$32–$40/mo and heavy users are ~$70–$135/mo. At $79, typical usage has viable contribution margin, while heavy usage still requires the enforced fair-use limits described below.

**Implemented decision:** launch at **$79** with enforced research and outreach limits. Model routing, video-minute accounting, enrichment caps, and dormant throttling remain margin-improvement work.

Greatest remaining margin risk: **Sonnet spend is capped by call count rather than measured tokens/dollars**, amplified by video multimodal outside the shared LLM budget and the absence of dormant-user throttling.

---

## 2. Recommended launch price

| Horizon | Price | Range | Why |
|---|---:|---|---|
| **Current launch** | **$79** | $69–$99 | Production typical CTS ~$40; $79 gives viable typical contribution margin with enforced limits. |
| **Production optimized** | **$99** | $79–$119 | Adds stronger margin headroom for real media/enrichment and heavy users. |
| **Future Senior Mara** | **$149** (or $99 + metered overages) | $119–$199 | Higher brand/day, live ads, more video minutes, denser autonomy. |

**Launch price:** **$79/mo** for production Mara, with the limits in §12. Any friends/soak discount should use a Stripe coupon rather than changing the public product price.

**Trial:** time-limited **7 days**, card required, **autonomy at interactive/light cadence**, **no real video QA**, **deep research capped at 2**, enrichment off unless free probes. Trial CTS estimate: **$3–$12** (behavioral).

---

## 3. Recommended pricing tiers

| Tier | Price | Includes | Caps (non-negotiable) |
|---|---:|---|---|
| **Mara** | **$79** | Gmail ops, brand research (5/day), outreach drafts (25/week), inbox classify, weekly plan, opportunity pipeline, approval-gated send | Soft: 150 Sonnet-equivalent calls/day; hard: deep research 8/week; video 30 min/mo; Hunter/Apollo 40 domains/mo |
| **Mara Plus** | **$119** | Everything above + 10 brands/day, deep research 20/week, video 90 min/mo, enrichment 150 domains/mo, denser autonomy | Hard ceilings still exist |
| **Mara Senior** (future) | **$149–$199** | Live Meta/TikTok observation, negotiation packs, higher concurrency | Metered overages for video + enrichment |

**Architecture choice:** **Tiered flat subscription + fair-use**, not revenue share. Optional later: metered overages only for video minutes and paid enrichment.

**API keys:** Ryva pays centrally for Anthropic/OpenAI/enrichment. Creators never BYOK for LLM. Ops-owned Meta/TikTok/X keys. Gmail is user OAuth (no Ryva API fee).

---

## 4. Cost per persona (USD / user / month)

### Current Mara (video mock; enrichment keys unset → $0)

| Persona | Low | Expected | High | Notes |
|---|---:|---:|---:|---|
| Dormant | 6.08 | **9.55** | 15.77 | Autonomy still burns Sonnet |
| Light | 11.68 | **17.54** | 27.66 | |
| Typical | 22.06 | **32.37** | 49.76 | |
| Heavy | 47.36 | **68.52** | 103.48 | |
| Abuse | 90.59 | **130.27** | 194.90 | Toward call ceiling |

### Production-ready (Whisper + multimodal + Hunter/Apollo assumptions)

| Persona | Low | Expected | High |
|---|---:|---:|---:|
| Dormant | 6.08 | **9.55** | 15.77 |
| Light | 12.84 | **19.20** | 30.15 |
| Typical | 27.19 | **39.70** | 60.75 |
| Heavy | 62.05 | **89.50** | 134.95 |
| Abuse | 135.11 | **193.87** | 290.30 |

### Production + Haiku routing (classification/extract cheap paths)

Blended expected CTS drops from **$32.06 → $26.15** under the assumed mix (25% dormant / 35% light / 30% typical / 8% heavy / 2% abuse).

**Blend (production):** expected **~$32**, high **~$49** per subscriber.

---

## 5. Current provider & infrastructure cost inventory

| Component | Status | Cost class | Price basis (2026-07-12) |
|---|---|---|---|
| Anthropic Claude (default `claude-sonnet-4-6`) | **Active** | Variable / token | **$3 / MTok in, $15 / MTok out** — [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| Haiku 4.5 | **Not used** (recommended) | Variable / token | **$1 / $5** — same page |
| OpenAI Whisper | **Implemented, mock default** | Variable / minute | **$0.006 / min** (`whisper-1`) — [OpenAI Whisper model](https://developers.openai.com/api/docs/models/whisper-1) |
| Anthropic multimodal video | **Implemented, mock default** | Variable / token | Sonnet rates; `max_tokens: 1200` in code |
| Reddit public JSON | Active free | Quota risk | Free; rate limits unknown at scale |
| Site crawl / DuckDuckGo-style search | Active free | Bandwidth / block risk | Treat as ~$0 + proxy risk |
| Meta Ad Library / IG / X / TikTok live | Optional keyed | Quota / sometimes paid | Fail-closed without keys |
| Hunter domain search | Optional | Per credit | 1 credit / 1–10 emails — [Hunter API](https://help.hunter.io/en/articles/1970956-hunter-api); **$0.10/search modeled** (assumption) |
| Apollo people search | Optional | Credits | [Apollo API pricing](https://docs.apollo.io/docs/api-pricing); **$0.12/contact modeled** (assumption) |
| Gmail API | Active via user OAuth | User Google quota | $0 to Ryva |
| Postgres | Required prod | Fixed + storage | Platform allocation **$1.50–$6 / user** (assumption) |
| S3 | Required prod | Per GB | **$0.023 / GB-mo** us-east-1 Standard — [S3 pricing](https://aws.amazon.com/s3/pricing/) |
| Job workers / hosting | Active | Fixed | Included in infra allocation |
| SMTP | Optional/required for email signup | Per email | Negligible at Mara volume |
| Stripe Payments | Active | % + fixed | **2.9% + $0.30** — [stripe.com/pricing](https://stripe.com/pricing) |
| Stripe Billing | Used (Checkout subscriptions) | % of volume | **~0.7%** pay-as-you-go (Billing product) |
| Sentry / metrics | Optional | Fixed | Small; not modeled per-user |
| Vector DB / embeddings | **Not implemented** | — | $0 today |
| Outlook | UI “coming soon” | — | $0 |
| CAPTCHA / anti-bot proxies | **Not implemented** | Future risk | Unknown |

---

## 6. Cost by Mara workflow (unit)

Token sizes are **behavioral assumptions** calibrated to prompt shapes in `maraLlm.mjs` / autonomy tasks — **not** production telemetry.

| Workflow | Assumed in/out tokens | Sonnet unit $ | Haiku unit $ |
|---|---|---:|---:|
| Pitch generation | 9k / 2.2k | 0.060 | 0.020 |
| Content ideas | 8k / 2.5k | 0.062 | 0.021 |
| Deep research synth | 28k / 4.5k | 0.152 | 0.051 |
| Brand research light | 6k / 1.5k | 0.041 | 0.014 |
| Opportunity package | 10k / 2.8k | 0.072 | 0.024 |
| Inbox parse (per thread) | 7k / 1.6k | 0.045 | 0.015 |
| Reply classify | 5k / 0.8k | 0.027 | 0.009 |
| Ops brief | 9k / 2.2k | 0.060 | 0.020 |
| Weekly plan | 11k / 3k | 0.078 | 0.026 |
| Positioning | 10k / 2.8k | 0.072 | 0.024 |
| UGC strategy | 12k / 3k | 0.081 | 0.027 |
| Chat turn | 14k / 1.8k | 0.069 | 0.023 |
| Follow-up draft | 7k / 1.4k | 0.042 | 0.014 |
| Video multimodal | 8k / 1.2k | 0.042 | 0.014 |

Full table: [`mara-unit-economics-workflows.csv`](./mara-unit-economics-workflows.csv).

**Frequency drivers (code):** autonomy every **15m** ([`MARA_AUTONOMY_INTERVAL_MINUTES`](../../.env.example)); brand research **5/day**; outreach drafts **25/week**; deep research **20/week**; inbox parses **5/sync**; LLM calls **300/day**; video **180s / 80MB**. Research and follow-up limits are backend-enforced.

---

## 7. Fixed vs variable costs

| Fixed-ish (allocate per user) | Variable |
|---|---|
| App replicas, Postgres baseline, observability | Anthropic tokens |
| Stripe fixed $0.30 / charge | Whisper minutes |
| Support baseline | Hunter/Apollo credits |
| | S3 GB + egress |
| | Meta/X/TikTok when keyed |

**Minimum keep-alive cost (onboarded + Gmail + full autonomy, almost no login):** ~**$6–$16/mo** expected (~$9.55 model). Autonomy does **not** sleep for dormant tenants today.

---

## 8. Current vs production-ready vs senior

| | Current | Production-ready | Senior (future) |
|---|---|---|---|
| LLM | Sonnet all paths | Sonnet + Haiku routing | Same + more volume |
| Video | Mock ($0) | Whisper + multimodal | 90–180 min/mo included |
| Enrichment | Free probes | Hunter/Apollo | Higher caps |
| Ads | Fail-closed without keys | Ops keys | Near-live observation |
| Typical CTS | ~$32 | ~$40 | ~$55–$90 (assumption) |
| Safe list price | $49–$69 | **$79–$99** | **$149+** |

---

## 9. Gross-margin table (production-ready, expected CTS)

Formula used: list GM ≈ `(net_after_stripe − CTS) / list_price`. Stripe modeled as `2.9% + $0.30 + 0.7% Billing`.

| List price | Stripe fee | Net | Typical GM | Heavy GM | Notes |
|---:|---:|---:|---:|---:|---|
| $39 | $1.70 | $37.30 | **−6%** | −134% | Unsafe |
| $40 | $1.74 | $38.26 | **−4%** | −128% | Current list — unsafe for production |
| $59 | $2.42 | $56.58 | **29%** | −56% | OK only with heavy caps |
| $79 | $3.14 | $75.86 | **46%** | −17% | Launch target; need heavy caps |
| $99 | $3.86 | $95.14 | **56%** | **6%** | Comfortable typical; heavy thin |
| $149 | $5.66 | $143.34 | ~70% | ~36% | Plus/Senior territory |

Minimum list price for **70% GM** on typical production CTS (~$39.70): about **~$145** before mix effects — **unrealistic for creators**, so **do not chase 70–90% GM** without metering or cheap-model routing. Target **45–60% on typical** after controls.

Full floors: [`mara-unit-economics-margin-floors.csv`](./mara-unit-economics-margin-floors.csv).

---

## 10. Candidate-price comparison (production)

| Price | Net | Typical contrib | Heavy contrib | Headroom vs typical high CTS |
|---:|---:|---:|---:|---|
| 29 | 27.66 | −12.0 | −61.8 | Negative |
| 39 | 37.30 | −2.4 | −52.2 | Negative |
| 49 | 46.94 | +7.2 | −42.6 | Thin |
| 59 | 56.58 | +16.9 | −32.9 | Borderline |
| **79** | **75.86** | **+36.2** | **−13.6** | OK if heavy capped |
| 99 | 95.14 | +55.4 | +5.6 | Good |
| 119 | 114.42 | +74.7 | +24.9 | Strong |
| 149 | 143.34 | +103.6 | +53.8 | Plus tier |
| 199 | 191.54 | +151.8 | +102.0 | Senior |

Value check: Mara promises an always-on junior hire. **$40 underprices** that promise relative to Rowan ($490) optics and relative to CTS. **$79–$99** matches “serious ops hire” without agency %, if limits are honest.

---

## 11. Sensitivity analysis

| Shock | Directional impact on typical production CTS |
|---|---|
| LLM prices +25% | CTS ≈ +$7–$9 |
| LLM prices −50% | CTS ≈ −$14–$18 |
| Hunter $0.02 → $0.50 / search | CTS +~$0–$19 at 40 searches |
| Brands/day 5 → 30 | Research LLM + scrape load up sharply; CTS can +$15–$40 if synthesis scales |
| Video 0 → 60 min | Whisper ~$0.36 + multimodal analyses; modest vs LLM unless many long files |
| Gmail 100 → 10k msgs | Parse cap 5/sync protects; cost rises mainly via more syncs + classify |
| Approval rate 10% vs 70% | Low approval still pays for drafts (cost without revenue value) |
| Mix 80% light vs 20% heavy | Blend CTS can swing **~$20–$45** |

CSV: [`mara-unit-economics-sensitivity.csv`](./mara-unit-economics-sensitivity.csv).

---

## 12. Required usage limits (non-negotiable at $79)

| Feature | Included | Cap type | Overage |
|---|---|---|---|
| Brand research | 5/day | Hard (already) | Upgrade Plus |
| Outreach drafts | 25/week | Hard (already) | Upgrade |
| Deep research | **8/week** | **Hard — must enforce** | Plus 20 |
| Inbox LLM parses | 5/sync | Hard (already) | Queue |
| Chat | Fair use ~100 turns/day | Soft then slow | Plus |
| Video analysis | **30 min / mo** | Hard | Meter $0.50/min or Plus |
| Paid enrichment | **40 domains / mo** | Hard | Meter or Plus |
| Autonomy cadence | 15m when active; **6–24h when dormant 7d** | Adaptive | — |
| Daily LLM $ budget | **$3–$5 / day** soft | Soft alert + degrade to Haiku | — |
| Concurrent heavy jobs | 2 | Hard | Queue |

**Market as unlimited:** viewing pipeline, task board, approvals UI, campaign tracker, memory inspection.
**Never market as unlimited:** deep research, video QA, paid enrichment, “infinite regenerations.”

---

## 13. Recommended model-routing changes

| Workflow | Preferred | Fallback | Why |
|---|---|---|---|
| Inbox classify / parse | **Haiku 4.5** | Sonnet | Structured extraction |
| Reply / outcome classify | Haiku | Sonnet | Cheap, frequent |
| Brand scoring light | Haiku | Sonnet | |
| Pitch writing | **Sonnet** | — | Quality = product |
| Deep research synth | Sonnet | — | Judgment |
| Opportunity packaging | Sonnet | — | |
| Content concepts | Sonnet | Haiku draft | |
| Negotiation / contract risk | Sonnet | — | High stakes |
| User chat | Sonnet | Haiku for short FAQ | |
| Video multimodal | Sonnet | — | Already bounded |
| Return briefings | Haiku assemble + Sonnet polish | | |

**Impact:** production optimized blend CTS **~$26** vs **~$32** all-Sonnet (~20% save) — CSV scenarios.

---

## 14. Cost-control implementation priorities

Completed in this release: weekly deep-research enforcement, environment-driven brand-research planning, weekly outreach limits, and removal of double `noteSpend` accounting on the shared agent path.

Remaining priorities:

1. **Token + $ ledger** (not only call counts); alert at tenant & fleet level.
2. **Include video multimodal in LLM budget.**
3. **Dormant throttle:** if no login/approval 7 days → autonomy daily/weekly.
4. **Haiku routing** for classify/extract.
5. **Deduplicate** research for brands already packaged this week.
6. **Extend idempotent provider caps** to enrichment.
7. **Provider spend caps** on Anthropic/OpenAI/Hunter accounts.

---

## 15. Assumptions & confidence

| Item | Confidence |
|---|---|
| Provider list prices | High (official pages, 2026-07-12) |
| Code limits & loops | High |
| Token sizes per workflow | **Low–medium** (assumption) |
| Persona frequencies | **Low–medium** (assumption) |
| Hunter/Apollo $ per call | **Low** (credit plans vary) |
| Infra $/user | **Low** (allocation) |
| Stripe Billing 0.7% | Medium–high (product pricing; confirm account plan) |

---

## 16. Production data still needed

1. Actual Anthropic **input/output tokens per call type** (log `usage`).
2. Autonomy cycles that **no-op vs LLM**.
3. True **dormant** population share.
4. **Pitch draft rate** vs approvals.
5. Enrichment hit-rate and credits burned.
6. Video upload minutes distribution.
7. Gmail sync frequency vs parse spend.
8. Support tickets / hours per 100 users.
9. Stripe effective fee mix (international, disputes).
10. Hosting bill / MAU.

---

## Blunt answers

| Question | Answer |
|---|---|
| Is **$39** financially safe? | **No** for production-ready Mara. Typical ≈ break-even/negative; heavy catastrophic. |
| Is **$59** financially safe? | **Only with** Haiku routing + dormant throttle + hard deep/video/enrichment caps. Marginal. |
| Is **$99** financially safe? | **Yes** for typical/light mix; still need caps so abuse ≠ −$100. |
| What would I launch at? | **$79/mo** (or $99 if you want margin cushion before telemetry). |
| Non-negotiable limits at that price? | Enforce deep-research weekly; video minutes; enrichment domains; dormant autonomy throttle; daily $ budget; no unlimited regen. |
| Greatest margin risk? | **Always-on Sonnet autonomy + chat**, especially unenforced deep research and video multimodal outside budgets. |
| Instrumentation before strangers? | Per-tenant token/$ ledger, workflow tags, autonomy no-op rate, enrichment/video meters, fleet burn alerts. |

---

## Final pricing table (easy compare)

| Price | Current typical GM | Production typical GM | Production heavy GM | Launch stance |
|---:|---:|---:|---:|---|
| $40 (today’s list) | ~15% | **~−4%** | **≪0** | Friends/soak only |
| $59 | ~41% | ~29% | ≪0 | Possible with harsh caps |
| **$79** | ~55% | **~46%** | ≲0 | **Recommended launch** |
| $99 | ~63% | ~56% | ~6% | Safer default |
| $149 | ~70%+ | ~70% | ~36% | Plus/Senior |

---

*Generated by `node scripts/mara-unit-economics.mjs`. Re-run after changing assumptions or when official prices move.*
