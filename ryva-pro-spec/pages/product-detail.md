# Page: Product Detail

## Purpose and user

Provide the complete decision record for one Product and its relationship to Brand, readiness, Buyers, Opportunities, and outcomes.

## Data displayed

Header: identity, Brand, category, status, evidence confidence, last review, next action, critical risks.  
Tabs:

- Overview and AI summary;
- Evidence;
- Reviews and sales evidence;
- Trend and physical retail;
- Pricing and wholesale;
- Packaging and readiness;
- Inventory/fulfillment/returns;
- Buyer-category matches;
- Opportunities and accounts;
- Notes, tasks, documents, history.

No production Product Score is shown.

## Actions

Primary depends on state: Add Evidence, Begin Review, Complete Human Decision, Resolve Condition, Create Representation Opportunity.  
Secondary: edit, compare, watch, add note/task/document, link/merge, archive.

## Filters

Evidence class/status/date; Opportunity stage; activity type; document type.

## States

- **Empty:** tab-specific missing evidence with responsible next action.
- **Loading:** header identity first; tab skeleton.
- **Error:** preserve last verified data with stale/error notice.

## Permissions and responsive

Representative can edit workspace record; consequential status requires decision workflow. Mobile prioritizes header, next action, risks, evidence and notes.

## Linked records and AI

Brand, Sources/Evidence, readiness decision, Risks, Businesses, Opportunities, Accounts, Orders. AI provides sourced summary, gap list, change explanation, comparison and draft tasks; sources inspectable.

## Acceptance criteria

- qualification displays decision owner, date, scope, evidence, and conditions;
- Brand risk is linked, not copied as Product fact;
- estimates and observations are distinct;
- status changes audited;
- AI failure leaves manual page complete;
- represented status requires active agreement coverage.

