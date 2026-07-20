# RF-12: The Ryva Evidence Standard

## Purpose

The Evidence Standard governs how Ryva classifies information and limits claims. It prevents weak signals—especially social popularity—from becoming false commercial certainty.

## Use

Use for Product and Brand analytics, TikTok Shop and social analytics, scores, AI output, Opportunity recommendations, Certification cases, Marketing claims, and reporting. Do not use a label to make poor evidence appear rigorous.

## Inputs

- the exact claim or decision being supported;
- consequence and audience of the claim;
- source material and rights to use it;
- source, subject, context, geography, channel, and time period;
- collection and observation dates;
- known dependencies, incentives, limitations, and contrary evidence; and
- any estimate method, assumption, or model contribution.

## Evidence classes

| Class | Definition | Example | Permitted treatment |
|---|---|---|---|
| Verified fact | A material fact confirmed against an authoritative or independently verifiable source | Executed mandate; paid invoice; carrier delivery record | May be stated as fact within its scope and date |
| Direct evidence | Observation directly measuring the relevant condition, with adequate provenance | Verified reorder history for the same Product and channel | Supports the conclusion subject to representativeness and freshness |
| Strong proxy | Indirect evidence with a demonstrated or well-reasoned relationship to the condition | Comparable-channel sell-through from similar stores | Supports a qualified inference; proxy relationship must be explained |
| Weak proxy | Indirect signal with uncertain relevance or material confounding | Likes, views, or creator mentions as wholesale demand | May form a hypothesis; cannot independently support a material conclusion |
| Estimate | Calculated or judgmental approximation based on stated inputs | Expected Representative hours; projected opening-order value | Must show method, range or sensitivity, and never be labeled actual |
| Assumption | An unverified condition temporarily treated as true for analysis | Assumed 50% retailer margin pending price sheet | Must remain visible and be tested before reliance |
| Model-generated inference | A conclusion produced by an analytical or AI model | Suggested category fit derived from text and Product attributes | Must be labeled, explainable, reviewable, and subordinate to evidence |
| Unknown | Information not established by sufficient evidence | Unverified return rate | Must remain missing; not scored as average or favorable |

“Verified fact” describes verification quality, not permanent truth. Scope, source, and observation time remain required.

## Evidence record

Each material evidence item must include:

- claim or field supported;
- evidence class;
- source and source type;
- observation and capture dates;
- subject, context, channel, geography, and period where relevant;
- direct versus proxy relationship;
- rights, access, and confidentiality classification;
- known limitations or contradictory evidence;
- verifier or system; and
- expiry or reassessment condition.

## Confidence labels

Confidence describes how well the available evidence supports the stated conclusion.

| Label | Required condition | Appropriate action |
|---|---|---|
| Insufficient | Material unknowns, weak proxies, contradictions, or unverifiable source prevent a responsible conclusion | Do not rely; gather or verify evidence |
| Limited | Some relevant evidence exists, but important support is indirect, narrow, stale, or incomplete | Use only for prioritizing investigation; state limitations |
| Supported | Relevant direct evidence or multiple credible sources support the conclusion, with manageable limitations | Use for a bounded professional decision with review |
| Strong | Multiple relevant, credible, sufficiently fresh sources consistently support the conclusion and material contrary evidence is addressed | Use with documented scope; continue monitoring |

Confidence is not a percentage probability of placement, sales, or truth. An exact numeric confidence should not be displayed without a validated method.

**TODO (Founder Decision Required):** Approve minimum source, freshness, and corroboration rules for each confidence label and use case.

## Method

1. State the exact claim.
2. Identify the consequence of being wrong.
3. Collect only authorized, relevant evidence.
4. Classify each item independently.
5. Assess source credibility, directness, relevance, freshness, coverage, and conflict.
6. Separate estimates, assumptions, and model inferences from observations.
7. Assign confidence to the conclusion, not the source alone.
8. State limitations and missing evidence.
9. Define the permitted decision and expiry condition.
10. Preserve corrections and superseded evidence.

## Social and TikTok Shop evidence

Social metrics may describe observed attention or platform commerce within a specific account, period, geography, and attribution model. They do not independently establish:

- broad market demand;
- wholesale demand;
- repeat-purchase behavior;
- Product quality;
- Buyer fit;
- Retail Readiness;
- durable trend strength;
- Brand legitimacy; or
- expected revenue for a Representative.

Views and likes are normally weak proxies for wholesale demand. Verified TikTok Shop units, refunds, repeat orders, concentration, and period data may be direct evidence of performance on that platform, but transfer to another channel remains an inference. Bot activity, paid media, affiliate concentration, discounting, novelty, and viral outliers must be considered.

## AI output

AI output is a model-generated inference unless it reproduces a cited evidence item. A citation does not automatically verify the claim. Material claims require human verification against the source. AI must not manufacture missing values, silently upgrade evidence class, or suppress contrary evidence.

## Marketing and reporting

Claims must not exceed the evidence class:

- facts need verification and scope;
- estimates need labels and method;
- proxies need limitations;
- model inferences need disclosure;
- unknowns cannot be filled by persuasive language.

Certification case studies must identify synthetic, altered, or historical data and may not be presented as current market evidence.

## Output and action

The output is an evidence register, conclusion confidence, missing-evidence list, limitations, permitted use, and reassessment date. Insufficient evidence stops consequential reliance; Limited evidence may prioritize research; Supported or Strong evidence may inform a bounded decision.

## Guardrails

- More sources do not cure shared bias or dependence.
- First-party evidence may be direct but still incomplete or self-interested.
- Popularity is not credibility.
- Precision in a source does not make the underlying construct valid.
- Adverse evidence remains visible.
- Human reviewers decide whether evidence is sufficient for material recommendations.

## Implementation Across Ryva

### Certification

Make evidence classification and confidence Applied judgment competencies. Use exercises that distinguish TikTok attention from wholesale demand, estimates from actuals, and multiple dependent sources from corroboration. Require an evidence register in the final project.

### Ryva Pro

Store evidence class, source, dates, context, rights, limitations, contradictions, and verifier. Enforce unknown as null with a reason, never a midpoint. Show confidence labels, freshness alerts, source lineage, AI provenance, corrections, and supersession in audit trails.

### Closing Program

Teach Representatives to support claims, qualify proxies, avoid false certainty, and respond to objections with evidence or an honest unknown. Presentations must distinguish observed results from projections.

### Marketing

Require claim substantiation records. TikTok, trend, income, success, and score claims require explicit scope and qualification. Marketing must not turn model output or a case study into a general performance claim.

## Founder decisions and validation

**TODO (Founder Decision Required):** Approve evidence-retention rules, authoritative-source definitions by field, confidence thresholds, public disclosure language, and specialist review requirements.

Test classification consistency, freshness behavior, source dependency detection, and user comprehension before scores or Marketing use.
