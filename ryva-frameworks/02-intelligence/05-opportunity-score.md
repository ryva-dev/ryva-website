# RF-08: The Ryva Opportunity Score

## Purpose

The Opportunity Score prioritizes a specific representation or placement Opportunity. It combines distinct Product, Brand, Business, economic, effort, conflict, territory, and strategic evidence without collapsing their underlying records.

It answers: **Given fit, evidence, risk, effort, and strategic value, what should the Representative do next and when?**

## Use

Use after an Opportunity meets the Standard's definition: a documented potential Brand–Business relationship with a credible match thesis, identifiable next step, and sufficient authority to pursue evaluation. Use for work prioritization and reassessment. Do not use for generic Products, lists, contacts, or guaranteed revenue forecasts.

## Inputs

- current Product Score and critical Product evidence;
- Brand Score and mandate;
- Business Fit result and Buyer qualification;
- Retail Readiness;
- Relationship Triangle;
- account value estimate and method;
- opening probability estimate and basis;
- reorder potential;
- commission terms;
- estimated effort and service burden;
- relationship complexity;
- account, territory, and portfolio conflicts;
- strategic portfolio fit;
- reputation and claims risk; and
- evidence confidence and freshness.

## Dimensions

| Dimension | Required treatment |
|---|---|
| Product quality | Reference Product evidence; do not copy the entire Product Score as multiple votes. |
| Brand quality | Reference Brand readiness, trust, support, and red flags. |
| Buyer fit | Use the current Business Fit class and match thesis. |
| Expected account value | Label as estimate; state time horizon, range, inputs, and exclusions. |
| Probability of opening | Label as estimate; base on Opportunity-specific evidence, not generic optimism. |
| Reorder potential | Separate actual comparable reorders from category or model inference. |
| Commission economics | Use current written basis, timing, adjustments, risk, and expected support cost. |
| Time required | Estimate research, approach, negotiation, implementation, and stewardship effort. |
| Relationship complexity | Consider stakeholders, locations, process, customization, service, and issue burden. |
| Account conflict | Check existing relationships, exclusivity, ownership, overlap, and contact rights. |
| Territory | Confirm authority and geographic/channel restrictions. |
| Strategic portfolio fit | Assess complementarity, concentration, capability, learning, and relationship value. |
| Reputational risk | Preserve Product, Brand, Business, claims, and conduct concerns as gates or warnings. |
| Information confidence | Apply RF-12 across the Opportunity conclusion. |

## Method

1. Confirm the record meets the Opportunity definition.
2. Confirm current mandate, territory, account status, and conflict checks.
3. Reference—not duplicate—the current component evaluations.
4. Estimate account value, probability, effort, and commission with ranges and assumptions.
5. Rate applicable dimensions using approved anchors.
6. Apply gates before total: authority failure, material conflict, Recommendation failure, Retail Not Ready for the proposed action, or unresolved ethics/safety issue.
7. Calculate provisional score and coverage.
8. Report effort and strategic value separately so a total does not hide their meaning.
9. Assign priority and next action through human review.
10. Set reassessment trigger.

## Provisional score

For testing only:

`Opportunity Score = sum of known applicable ratings ÷ (5 × known applicable dimensions) × 100`

This unweighted score does not convert expected account value into guaranteed value. Estimated value, probability, and effort must remain visible as separate fields and must not be multiplied into a currency forecast without clear labels and sensitivity.

A configurable weighted version may be used only after weights and thresholds are validated and approved.

**TODO (Founder Decision Required):** Approve weights, gates, priority bands, estimation methods, value horizon, effort scale, strategic-value rubric, and reassessment cadence.

## Required output

- **Opportunity Score**
- **Opportunity Confidence**
- **Estimated Effort**
- **Strategic Value**
- **Risks**
- **Recommended Priority**
- **Recommended Next Action**

Provisional priorities:

- **Do Not Pursue**
- **Hold / Gather Evidence**
- **Routine**
- **High**
- **Immediate**

“Immediate” means a time-sensitive, well-supported action—not necessarily the largest estimated revenue.

## Synthetic example

Synthetic Opportunity E has Strong Fit, supported Product and Brand evidence, clear territory, and estimated opening value of `$4,000–$7,000`, explicitly not guaranteed. Probability is a Limited-confidence estimate because the Buyer has accepted discovery but has not reviewed terms. Effort is High due to three-location onboarding. Strategic value is High because the account fits the portfolio and may produce credible learning.

The provisional score is 81 with 93% coverage, but a current packaging condition prevents presentation. Output: **Priority High; Next Action: resolve packaging evidence; do not approach as Retail Ready.**

## Guardrails

- No score before an actual Opportunity exists.
- Expected revenue, probability, and reorder potential remain estimates.
- Commission cannot dominate priority.
- High value cannot override poor fit, conflict, authority, or reputational gates.
- Low-effort mass pitching is not automatically efficient.
- AI may calculate and suggest priority; the Representative owns the action.

## Implementation Across Ryva

### Certification

Teach Opportunity definition, component separation, value and effort estimation, conflict, priority, and next-action judgment. Assess cases where large estimated revenue should not receive highest priority.

### Ryva Pro

Reference source evaluations, retain estimates and assumptions, calculate deterministically, expose coverage and confidence, support scenario sensitivity, flag stale components, and record human priority and overrides. Never display estimated revenue as booked or actual.

### Closing Program

Use priority to allocate preparation and follow-up, not to pressure closing. Teach Representatives to reassess when Buyer evidence, terms, effort, or risk changes.

### Marketing

Ryva may state that Opportunities are prioritized using fit, evidence, effort, strategic value, and risk. It must not claim the score predicts account opening, revenue, or commission.

## Validation

Compare priorities with later qualified progression, relationship quality, effort accuracy, and sustainable outcomes. Test whether the model favors large or high-commission accounts at the expense of fit.

