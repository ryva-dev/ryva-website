# RF-04: The Ryva Product Score

## Purpose

The Product Score determines whether a Product deserves further investigation for Brand Placement. It organizes evidence about potential, readiness, and risk. It does not approve representation, establish Business Fit, or replace the Standard of Recommendation.

## Use

Use during Discover, Evaluate, periodic review, and material Product change. Do not use to declare a Product universally good, predict revenue, imply legal or regulatory clearance, or rank unlike categories without documented comparability.

## Inputs

Product identity and category; verified performance and order data; reviews; trend data; Product specifications; packaging and pricing; wholesale and fulfillment information; returns and complaints; claims and compliance information; distribution; Brand evidence; target market context; and missing evidence.

## Shared rating and confidence rules

Each applicable dimension uses the Standard's five-point scale:

- **1:** material weakness or credible adverse evidence;
- **2:** below the required or expected condition;
- **3:** adequate evidence of a workable condition;
- **4:** strong evidence relative to context;
- **5:** exceptional, sustained, relevant evidence;
- **Unknown:** insufficient evidence; never scored as 3.

Evidence confidence is **Insufficient, Limited, Supported, or Strong** under RF-12. Each dimension records its own confidence. “Not applicable” requires a reason and is excluded from calculation.

## Dimensions

| Dimension | Meaning and evidence | Scoring guidance | Missing data and placement effect |
|---|---|---|---|
| Demand Evidence | Evidence of actual customer or Business demand. Direct: verified sales, orders, waitlists with conversion, comparable-channel sell-through. Proxy: search, social attention, stated interest. | 1: adverse or fabricated demand; 3: credible but limited demand; 5: sustained, relevant, diversified direct demand. | Unknown remains missing. Low/unknown narrows claims and prioritizes validation. |
| Review Quality | Credibility, relevance, recency, distribution, content, and integrity of reviews. Direct: verified purchasers and returns-linked feedback. Proxy: unverified public ratings. | 1: manipulation or material recurring defect; 3: credible adequate pattern; 5: sustained credible evidence with resolved issues. | Lack of reviews is not poor quality, but lowers confidence. Investigate by category-appropriate evidence. |
| Trend Strength | Current rate and breadth of relevant attention or adoption. Direct: comparable-channel velocity. Proxy: social/search velocity. | 1: declining or artificial signal; 3: current credible movement; 5: strong multi-source relevant momentum. | Unknown cannot be inferred from one viral post. Affects timing, not fundamental suitability. |
| Trend Durability | Likelihood that demand persists beyond a short spike. Direct: multi-period performance and repeat cohorts. Proxy: category history, search persistence. | 1: isolated novelty spike; 3: evidence across a meaningful period; 5: sustained, repeat-supported demand. | Unknown limits inventory and revenue assumptions. |
| Product Differentiation | Meaningful distinction buyers or customers can understand. Direct: comparative performance or buyer evidence. Proxy: feature comparison and positioning. | 1: indistinguishable with weaker value; 3: clear relevant distinction; 5: durable, evidenced distinction difficult to substitute. | Unknown requires competitor and Buyer research. Affects pitch rationale and saturation resilience. |
| Repeat-Purchase Potential | Evidence that customers or Businesses may reorder. Direct: verified cohort or account reorders. Proxy: consumability and category cadence. | 1: little repeat logic or adverse repeat history; 3: credible repeat mechanism; 5: sustained verified repeat behavior. | Category logic is a proxy, not actual reorders. Influences relationship and portfolio value. |
| Retail Readiness | Overall operational ability to serve the intended Business channel. Direct: completed RF-07 evidence and past fulfillment. Proxy: Brand assertion. | 1: material required elements absent; 3: workable readiness; 5: proven, reliable readiness. | Unknown required elements normally prevent presentation. Use RF-07 for the decision. |
| Packaging Readiness | Protection, information, shelf/use suitability, case handling, and presentation. Direct: current samples/specifications and damage data. Proxy: images or mockups. | 1: unusable, misleading, or unsafe; 3: adequate for context; 5: proven, clear, durable, operationally efficient. | Unknown requires sample or specification review. Category requirements may gate readiness. |
| Wholesale Margin Potential | Capacity for sustainable Brand, Business, and Representative economics. Direct: current price sheet, costs/terms, actual discounts. Proxy: public retail-price comparison. | 1: structurally unworkable; 3: workable under stated terms; 5: strong and resilient across realistic scenarios. | Never invent costs. Missing current terms blocks a confident result. |
| Fulfillment Reliability | Ability to deliver complete, accurate orders within commitments. Direct: service levels, order history, inventory records. Proxy: Brand statements. | 1: repeated material failure; 3: adequate capacity/evidence; 5: sustained reliable performance with recovery. | New Brands may be Unknown; use controlled volume and monitoring. |
| Return Risk | Likelihood, causes, cost, and manageability of returns. Direct: verified rate and reason codes. Proxy: review complaints or category benchmark. | 1: high/unmanaged material returns; 3: understood and manageable; 5: low, stable, well-managed returns. | No data is not low risk. Missingness lowers confidence and may require a trial. |
| Regulatory or Claims Risk | Risk arising from Product category, labeling, claims, restrictions, or required review. Direct: qualified review and authoritative records. Proxy: Brand assurances. | 1: credible unlawful/material unresolved issue; 3: requirements identified and managed; 5: strong documented control. | Unknown high-consequence issues trigger specialist review, not a guessed rating. |
| Current Retail Saturation | Existing distribution and substitute density in target markets. Direct: verified account/distribution data. Proxy: store checks and listings. | 1: excessive conflict with little differentiation; 3: workable whitespace; 5: strong relevant whitespace with demand. | Unknown requires market-specific research. More distribution is not automatically better. |
| Buyer-Market Breadth | Number and diversity of genuinely suitable Business types. Direct: verified placements across contexts. Proxy: use-case analysis. | 1: very narrow or unsupported; 3: several credible segments; 5: broad supported fit without dilution. | Breadth is not prospect count. Unknown requires fit testing. |
| Demonstrability | Ease of communicating and experiencing value accurately. Direct: Buyer/sample response. Proxy: visual or functional assessment. | 1: value difficult to show or claims misleading; 3: clear demonstration with support; 5: immediate, accurate, repeatable demonstration. | Affects presentation method, not Product quality by itself. |
| Brand Trust | Product-level reliance on the Brand's legitimacy, conduct, consistency, and support. Direct: verified Brand evidence. Proxy: reputation signals. | 1: material integrity concern; 3: adequate trust evidence; 5: sustained transparent conduct and support. | Use RF-05 for the Brand decision; do not duplicate its aggregate score. |
| Placement Potential | Synthesis of whether further Brand Placement investigation is warranted across likely contexts. Direct: prior comparable placements. Proxy: fit hypotheses. | 1: little defensible potential; 3: credible bounded potential; 5: broad, strong, evidence-supported potential. | This is an explained synthesis, not an extra vote that double-counts every dimension. |

## Method

1. Define the Product, variant, category, geography, channel, period, and investigation decision.
2. Confirm Product identity and link the correct Brand record.
3. Gather authorized evidence and classify it under RF-12.
4. Identify applicable, category-specific, and non-applicable dimensions.
5. Apply risk gates before calculating a total.
6. Rate each known applicable dimension against its evidence anchors.
7. Record Unknowns, contrary evidence, confidence, and freshness.
8. Calculate the provisional unweighted result and evidence coverage.
9. Review the result for double counting, social-signal distortion, and sensitivity.
10. Assign the investigation action, owner, and reassessment trigger through human review.

## Provisional unweighted version

For exploratory use:

`unweighted score = (sum of known applicable ratings ÷ (5 × number of known applicable dimensions)) × 100`

Display:

- criterion ratings;
- unweighted Product Score;
- evidence coverage: known applicable dimensions ÷ all applicable dimensions;
- overall confidence;
- critical risks;
- missing evidence; and
- recommended investigation action.

No outcome bands are approved. A total must not override a gate or hide low coverage.

## Configurable weighted version

When validated weights exist:

`weighted score = Σ(rating ÷ 5 × approved weight) ÷ Σ(included approved weights) × 100`

Weights must be versioned by category and decision context. The system must show excluded dimensions, coverage, sensitivity to major assumptions, and both weighted and unweighted results during validation.

**TODO (Founder Decision Required):** Approve category-specific weights, score bands, minimum evidence, mandatory gates, and whether Placement Potential remains a scored dimension or becomes an output synthesis.

## Synthetic example

Synthetic Product A has known ratings totaling 58 across 15 applicable known dimensions. Two dimensions are Unknown.

`58 ÷ (5 × 15) × 100 = 77.3`

Evidence coverage is `15 ÷ 17 = 88.2%`.

The output is **Unweighted Product Score: 77.3; Coverage: 88.2%; Confidence: Limited** because fulfillment and return data are Unknown and social attention supplies much of the demand evidence. The appropriate action is **verify operations and returns**, not “Qualified to Represent.”

If a provisional weighted model gives social Trend Strength a large weight, the software must also show the unweighted result and sensitivity excluding that signal.

## TikTok safeguards

- TikTok views, likes, saves, and creator count are weak proxies for wholesale demand.
- Verified TikTok Shop performance describes that platform, period, geography, pricing, promotion, and attribution context.
- Separate paid, affiliate, organic, and concentrated creator effects where data permits.
- Examine refunds, repeat orders, discounting, cohort durability, and viral outliers.
- Never allow Trend Strength to override claims risk, fulfillment, returns, margin, or readiness gates.
- Display trend and durability separately.

## Output and action

The Product Score produces score, coverage, confidence, critical risks, missing evidence, and one action: **Close**, **Gather Evidence**, or **Advance to Brand and Readiness Evaluation**. Labels remain provisional until approved.

## Software rules

- Store dimension definition and model version.
- Require evidence links and dates for every rating.
- Store Unknown as null plus reason.
- Compute deterministically from approved inputs.
- Prevent totals when a required gate is unresolved.
- Show confidence and coverage beside the score.
- Preserve overrides, prior values, and recalculation history.
- Prohibit AI from inventing missing inputs or final approval.
- Support category variants without silently changing historical scores.

## Guardrails

The Product Score is not the Brand Score, Business Fit Score, Retail Readiness result, Opportunity Score, or Recommendation result. It measures investigation merit, not universal quality or guaranteed sales.

## Implementation Across Ryva

### Certification

Teach dimension definitions, direct versus proxy evidence, Unknown behavior, five-point anchors, confidence, social-metric limitations, and score interpretation. Assess a synthetic scoring exercise and require a defensible next action in the final project.

### Ryva Pro

Build dimension fields, evidence lineage, category model version, confidence, coverage, gates, sensitivity, missing-data alerts, explanation, and audit history. AI may locate evidence and propose ratings with reasons; a person approves consequential use.

### Closing Program

Use the score to prepare Product knowledge, proof, limitations, and questions. Do not teach Representatives to quote the internal score as a Buyer-facing quality claim.

### Marketing

Ryva may state that Products are evaluated through a structured, evidence-based process. It must not publish a score as scientific proof or imply that a high score predicts sales.

## Validation

Test content validity by category, reviewer agreement, missing-data behavior, gaming, bias against emerging Brands, calibration to later outcomes, and whether the score improves investigation choices.
