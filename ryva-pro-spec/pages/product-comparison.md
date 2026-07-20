# Page: Product Comparison

## Purpose and user

Compare up to four Products for an explicit investigation decision without producing false ranking precision.

## Data displayed

Aligned rows: identity/Brand/category, pricing, evidence confidence and coverage, review evidence, sales evidence, trend strength/durability, repeat potential, differentiation, physical retail/saturation, packaging, retail/wholesale readiness, fulfillment, returns, claims/risk, Buyer-category hypotheses, qualification, last review.

Every cell exposes source and date. Unknown, not applicable, and adverse evidence are distinct.

## Actions

Primary: Select Product for further investigation with recorded rationale.  
Secondary: add/remove/reorder Product, inspect evidence, create task, save comparison, export permitted comparison.

## Filters

Comparison context: category, geography, channel, Buyer type, period, evidence date.

## States

- **Empty:** choose two to four Products.
- **Loading:** load identity/qualification before evidence rows.
- **Error:** affected Product/field marked unavailable; comparison not silently rebalanced.

## Permissions and responsive

Representative only; read-only permitted. Desktop-first; tablet two-column; mobile shows one reference Product against one selected alternative.

## Linked records and AI

Product, Brand, Evidence, readiness, risks. AI may summarize differences and missing evidence, never declare a winner or invent a score.

## Acceptance criteria

- no unapproved numerical Product Score;
- comparison context is visible;
- source inspection works per cell;
- selecting further investigation requires human rationale;
- Products with missing evidence are not treated as average;
- exported comparison includes limitations.

