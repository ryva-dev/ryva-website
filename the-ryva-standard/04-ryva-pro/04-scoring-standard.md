# Product and Brand Scoring Standard

## 1. Purpose

Scoring creates consistent, explainable comparisons. Products and Brands should be scored rather than arbitrarily accepted or rejected, but a score must remain subordinate to evidence, context, professional judgment, and mandatory risk controls.

## 2. Required score components

Every score must identify:

- the object and context being scored;
- criteria and definitions;
- criterion weights;
- evidence used and observation dates;
- criterion-level results;
- evidence confidence and missingness;
- material warnings or disqualifying conditions;
- model or rubric version;
- scorer or system;
- overall result; and
- a plain-language explanation.

## 3. Scoring method

Unless a category-specific approved model applies, each applicable criterion is rated on a five-point evidence-anchored scale:

| Rating | Meaning |
|---|---|
| 1 | Material weakness or credible adverse evidence |
| 2 | Below the required or expected condition |
| 3 | Adequate evidence of a workable condition |
| 4 | Strong evidence relative to the context |
| 5 | Exceptional, sustained, and relevant evidence |

“Unknown” is not a rating of 3. Missing evidence must be recorded separately.

A normalized score may be calculated as:

`score = Σ(rating ÷ 5 × weight) for applicable criteria`

The displayed result must also include a confidence or coverage measure. A high score with low evidence coverage must not be presented as equivalent to a high score with strong coverage.

## 4. Baseline Product model

The founding criteria are:

| Criterion | Required interpretation |
|---|---|
| Review quality | Credibility, relevance, consistency, volume context, and signs of manipulation |
| Sales evidence | Verified demand, channel comparability, period, and concentration |
| Repeat-purchase potential | Replenishment logic, observed repeats where available, and category behavior |
| Retail readiness | Packaging, information, ordering, fulfillment, returns, support, and channel requirements |
| Margin quality | Viable economics for the parties under the target arrangement |
| Business fit | Customer, assortment, price, channel, operational, timing, and positioning alignment |
| Trend strength | Current momentum, durability, source quality, saturation, and relevance |

**TODO (Founder Decision Required):** Approve baseline weights, category variants, minimum evidence, score bands, and whether Product risk criteria are weighted or handled as gates.

## 5. Baseline Brand model

Brand scoring should include the dimensions defined in [Product and Brand intelligence](03-product-and-brand-intelligence.md), including mandate clarity, economics, operational readiness, support, channel strategy, compliance, reputation, data quality, and relationship orientation.

**TODO (Founder Decision Required):** Approve Brand criteria, weights, evidence anchors, score bands, and mandatory gates.

## 6. Gates

Some conditions should prevent recommendation regardless of numeric score. Potential gates include unlawful Products or claims, unresolved material safety risk, fraudulent evidence, inability to fulfill, unacceptable commercial authority, or a material ethics conflict.

**TODO (Founder Decision Required):** Approve the exhaustive gate list and escalation process with appropriate legal and category expertise.

## 7. Small and emerging Brands

Ryva must not treat business size as a proxy for quality. Emerging Brands may have less historical evidence. The model should:

- show missing evidence transparently;
- accept credible alternative evidence where relevant;
- separate potential from proven performance;
- avoid converting absence of scale into automatic rejection; and
- require stronger monitoring where uncertainty is higher.

## 8. Overrides

An authorized Representative may depart from a model recommendation only by recording the reason, supporting evidence, risk, and follow-up condition. An override must not erase the original score.

## 9. Validation and change

Scores must be tested against later outcomes without allowing one outcome to prove causation. Ryva should review calibration, bias against legitimate Brand or Business types, gaming, stale inputs, and whether the score drives intended professional behavior.

Material model changes require versioning, impact analysis, and an explanation to affected users.

