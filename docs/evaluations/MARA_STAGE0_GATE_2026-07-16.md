# Mara Stage 0 gate evaluation — 2026-07-16

| Field | Value |
|---|---|
| Status | **Stage 0A FAIL (regression) — Stage 0B blocked** |
| Environment | Production `ryvaforge.com` |
| Overnight re-check | 2026-07-17 ~08:20 ET |
| Branch policy | All future Stage work pushes to `mara/outcome-flywheel` (not `main`) |

## Hard rule applied

Do not begin Stage 0B overnight 70% scoring, or Stage 1, until Stage 0A exits hold on the live product.

## Overnight failure (2026-07-17)

Overnight output was essentially one **Daily brand research digest** that:

- Treated dream-brand preference as niche (`aligned with Gymshark would be a DREAM for me`)
- Shipped Gymshark / Gymshark Athlete / Gymshark-about OEM article noise as researched brands
- Landed in Deliverables **Other** instead of Strategy
- Showed a false “Working draft — AI connected” banner on a research digest

## Stage 0A exits

| Exit | Live result | Evidence |
|---|---|---|
| Dream brands not overnight primary | **FAIL** | Digest led with Gymshark / Athlete / Gymshark article OEM |
| No placeholder pitches | **PASS** (hold) | No Mad Libs overnight |
| No empty / fake market pulses as shipped | **PASS** (hold) | — |
| No “I shipped X” when X hidden/unusable | **FAIL** | Preference-echo digest was customer-facing |
| Completed real work visible in Deliverables | **WEAK** | Only the bad digest overnight; setup docs remain |
| Honest blockers / Gmail UX layout | **PASS** (hold) | — |
| No calendar filler as Mara work | **PASS** (hold) | Founder confirmed earlier |
| Deliverable categorization | **FAIL** | `brand_research_digest` → Other |

## Stage 0B — blocked again

Do not score 70% until overnight research stops chasing dream brands and ships reachable targets.

## Fix in flight / shipped

- Exclude desired/dream brands from overnight discovery
- Reject support/help hosts and “how brand scaled” article URLs for outreach
- Never use preference-echo text as niche / content-gap evidence
- Hide preference-echo digests from publication
- Map `brand_research_digest` → Strategy / Brand research
- Stop false “AI draft” banner on `generatedBy: research`
- **Learn from research:** athlete/creator pages → `learned.brandDiscoveryRoutes` (no pitch; tag @Brand / #Brand in captions)
