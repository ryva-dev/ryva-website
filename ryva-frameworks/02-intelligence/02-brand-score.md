# RF-05: The Ryva Brand Score

## Purpose

The Brand Score evaluates whether a company is suitable for independent Brand Placement representation. It separates organizational readiness and trust from Product merit.

## Use

Use during Evaluate, before accepting representation, at mandate renewal, and after material operational, ownership, claims, complaint, or distribution change. Do not use it as a legal due-diligence opinion, credit rating, or substitute for Product and Business Fit evaluation.

## Inputs and method

Use verified identity and ownership records; Product authenticity evidence; operations, inventory, fulfillment, pricing, commissions, materials, distribution, complaints, claims, support, and relationship records; mandate terms; and missing evidence. Apply RF-12, rate each applicable dimension 1–5 under the Standard anchors, record Unknown separately, and apply red flags before totals.

## Dimensions

| Dimension | Direct evidence and proxies | Rating anchors | Decision effect of missing or weak evidence |
|---|---|---|---|
| Ownership legitimacy | Direct: authoritative registration, ownership/authorized officer evidence, payment identity. Proxy: website and social identity. | 1: deceptive/unverifiable material identity; 3: reasonably verified; 5: transparent, stable, fully documented. | Material unknown blocks representation authority. |
| Product authenticity | Direct: manufacturing/source records, authorization, IP or supply documentation as relevant. Proxy: Brand assertion. | 1: credible counterfeit/deception concern; 3: adequate provenance; 5: transparent, consistent provenance. | Unknown may require specialist diligence. |
| Operational maturity | Direct: processes, owners, service history, capacity records. Proxy: team-size or funding claims. | 1: unable to support commitments; 3: workable operations; 5: proven scalable control. | Emerging status is not failure; bound volume to evidence. |
| Wholesale readiness | Direct: complete wholesale program and prior Business service. Proxy: stated intention. | 1: material requirements absent; 3: workable; 5: proven and adaptable. | Use RF-07; missing required elements limits approach. |
| Inventory reliability | Direct: inventory history, stockouts, forecasts, allocations. Proxy: current snapshot. | 1: repeated unmanaged failure; 3: adequate reliability; 5: strong visibility and recovery. | Snapshot alone gives Limited confidence. |
| Fulfillment capability | Direct: complete/on-time orders, lead times, error and damage data. Proxy: logistics claims. | 1: material inability; 3: adequate; 5: sustained reliable service. | Unknown suggests trial and capacity limit. |
| Communication quality | Direct: timely, accurate, complete interactions and corrections. Proxy: polished materials. | 1: deceptive/unreliable; 3: workable; 5: consistently clear and proactive. | Slow diligence responses may be evidence, not mere inconvenience. |
| Pricing discipline | Direct: controlled price lists, channel policy, change records. Proxy: public listings. | 1: chaotic or misleading pricing; 3: consistent workable policy; 5: disciplined, transparent channel economics. | Unclear current price blocks confident economics. |
| Commission viability | Direct: executed terms, basis, timing, adjustments, payment history. Proxy: verbal rate. | 1: structurally unfair/unreliable; 3: workable; 5: fair, clear, durable, reliably paid. | Attractive rate cannot cure unclear basis or payment risk. |
| Sales-material readiness | Direct: current authorized claims, images, line sheets, specifications. Proxy: consumer content. | 1: misleading/unusable; 3: adequate; 5: accurate, complete, channel-ready. | Gaps limit presentation; AI must not invent. |
| Current distribution | Direct: account/channel/territory records. Proxy: public stockists. | 1: undisclosed conflict or uncontrolled overlap; 3: understood distribution; 5: clear strategic whitespace and controls. | Missing distribution increases conflict risk. |
| Conflict risk | Direct: mandates, territories, existing Representatives/accounts, exclusivity. Proxy: informal assurance. | 1: material unmanaged conflict; 3: disclosed/manageable; 5: clear ownership and resolution rules. | Unknown may block targeting. |
| Claims risk | Direct: approved claim substantiation and qualified review. Proxy: Brand copy. | 1: material unsupported/unlawful concern; 3: controlled claims; 5: strong substantiation governance. | High-consequence unknown escalates. |
| Return and complaint patterns | Direct: rates, reasons, outcomes, corrections. Proxy: public complaints. | 1: serious repeated unresolved pattern; 3: manageable with response; 5: low/stable and well resolved. | No data is not no complaints. |
| Representative support | Direct: samples, training, data, issue support, contact performance. Proxy: promises. | 1: refusal/inability to support; 3: adequate; 5: proactive, reliable enablement. | Support burden must enter Portfolio health. |
| Reorder potential | Direct: Brand-wide comparable repeat history. Proxy: consumability/category. | 1: weak/adverse repeat evidence; 3: credible mechanism; 5: sustained relevant reorders. | Keep projected and actual separate. |
| Long-term partnership potential | Direct: sustained conduct, adaptation, fair dealing, retention. Proxy: stated values. | 1: transactional or trust-damaging; 3: credible working partnership; 5: sustained aligned behavior. | This synthesis must explain evidence and avoid double counting. |

## Red flags

The following override an otherwise high score until resolved:

- fraudulent or materially unverifiable ownership, authority, authenticity, or evidence;
- unlawful Product or proposed claim identified by qualified authority;
- unresolved material safety risk;
- instruction to fabricate demand, Buyer interest, reviews, scarcity, or outcomes;
- known inability or refusal to fulfill material commitments;
- undisclosed territory, account, Representative, or exclusivity conflict;
- commission terms dependent on deception or materially unclear calculation;
- repeated nonpayment or improper withholding supported by credible evidence;
- deliberate concealment of material returns, complaints, or channel conflict; or
- refusal to permit accurate disclosure of limitations.

The list requires founder and specialist approval before it becomes exhaustive.

## Calculation

Provisional unweighted:

`Brand Score = sum of known applicable ratings ÷ (5 × known applicable dimensions) × 100`

Configurable weighted:

`Brand Score = Σ(rating ÷ 5 × approved weight) ÷ Σ(included approved weights) × 100`

Always display coverage and confidence. Unknown is excluded from the numeric calculation but lowers coverage and may prevent a result. Red flags override totals.

**TODO (Founder Decision Required):** Approve weights, bands, minimum evidence, red flags, review cadence, and whether long-term partnership potential is scored or reported as a synthesis.

## Output

- **Brand Score**
- **Confidence**
- **Critical Risks**
- **Missing Evidence**
- **Recommended Next Action**

Recommended actions are: **Decline**, **Hold for Evidence**, **Conduct Controlled Validation**, or **Advance to Recommendation Review**. These labels are provisional.

## Synthetic example

Synthetic Brand B has 14 known applicable ratings totaling 52, three Unknown dimensions, and no confirmed red flag.

`52 ÷ (5 × 14) × 100 = 74.3`

Output: **Brand Score 74.3; Coverage 82.4%; Confidence Limited; Critical Risk: inventory visibility; Missing Evidence: complaint history, Representative payment history, distribution map; Next Action: Hold for Evidence.**

The number does not establish suitability until material unknowns are resolved.

## Guardrails

- A strong Product cannot rescue an untrustworthy Brand.
- A small or new Brand may use credible alternative evidence and controlled validation.
- Funding, fame, polished materials, and social followers are not operational maturity.
- A score does not create representation authority.
- AI may extract and compare evidence; a qualified person decides red flags and representation suitability.

## Implementation Across Ryva

### Certification

Teach separation of Brand and Product, mandate diligence, red flags, emerging-Brand evidence, and confidence. Assess a case with a strong Product and weak Brand.

### Ryva Pro

Create versioned dimension fields, evidence lineage, mandate and conflict records, red-flag workflow, confidence, coverage, review expiry, human approval, and change alerts. Keep Brand Score separate from Product and Opportunity records.

### Closing Program

Use Brand evidence to prepare accurate Brand representation, operational answers, and escalation. Do not use a high Brand Score as a persuasion claim to Buyers.

### Marketing

Ryva may state that Brand readiness and trust are evaluated separately from Product popularity. It must not call the score a credit rating, legal clearance, or guarantee.

## Validation

Test dimensions across emerging and established Brands, categories, fulfillment models, and mandate structures. Measure reviewer agreement, bias, red-flag recall, gaming, and later operational outcomes.

