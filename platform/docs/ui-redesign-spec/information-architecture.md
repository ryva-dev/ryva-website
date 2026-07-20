# Information Architecture

## Canonical domains

| Domain | Canonical entry | Included concepts |
|---|---|---|
| Operate | Home, Tasks, Representation, Placements, Outreach | attention, authority preparation, opportunity progression, communication |
| Intelligence | Products, Brands, Businesses & Buyers | research, qualification, evidence, contacts, fit, comparisons |
| Commercial | Accounts, Orders, Reorders, Commissions | continuity, protection, verification, calculations, disputes |
| Analyze | Analytics, Reports | explainable performance, pipeline, commercial and portfolio review |
| System | Documents, Data transfer, Settings | immutable files, imports/exports, preferences/account controls |

## Canonical record experience

Dedicated Intelligence routes are the canonical interface:

- Products: `/products`, `/products/:id`
- Brands: `/brands`, `/brands/:id`
- Businesses & Buyers: `/buyers`, `/buyers/:id`
- Contacts: `/contacts/:id`, reached from a Business/Buyer or Search

The generic `/records/:type` and `/records/:type/:id` routes remain valid throughout migration. They must resolve supported types to the canonical presentation or a compatibility wrapper with identical actions. Invalid `:type` values render a not-found/unsupported state; they never silently render Brands.

No data, audit history, saved view, or route is removed by consolidation.

## Entity relationship model in the interface

The visible relationship chain is:

`Brand → Product → Buyer → Representation authority → Placement → Outreach → Order → Account → Reorder → Commission`

The chain is not a forced hierarchy. Detail pages expose:

- identity and current state;
- upstream authority/evidence;
- downstream operational/commercial records;
- related-record switcher;
- timeline entries across the relationship where relevant.

Sources, Documents, Contacts, Tasks, Decisions, Risks, and AI Suggestions are supporting records accessible adjacent to the relationship rather than parallel global destinations.

## What is consolidated

- Generic and Intelligence record lists/details.
- Contacts inside Businesses & Buyers.
- Protected Accounts inside the Accounts workspace.
- Commission Disputes inside the Commissions workspace.
- Outreach Templates and Sequences as Outreach tabs.
- Reports inside Analytics while preserving `/analytics?view=reports`.
- Profile, Certification, Subscription, and Settings in one profile utility model.
- Import and Export under Data transfer while preserving routes and capability checks.
- One register, detail, timeline, evidence, status, and state-feedback system.

## What remains distinct

- Product, Brand, Business/Buyer, and Contact qualifications remain separate human decisions.
- Representation Opportunity and Agreement authority remain separate records and reviews.
- Agreement upload/extraction is not Agreement approval.
- Placement qualification is not authority approval.
- Outreach draft, approval, send, provider delivery, and response remain distinct.
- Order status, payment, fulfillment, and verification remain distinct.
- Account protection records do not create contractual rights.
- Commission estimate, verification, approval, payable, paid, and dispute remain distinct.
- AI suggestion review remains separate from the action or record it informs.
- Certification and subscription restrictions remain separate policy inputs.

## Page responsibility model

| Pattern | Responsibility |
|---|---|
| Command Center | Cross-domain attention and next responsible action |
| Register | Find, compare, filter, save, and enter records |
| Split Intelligence Workspace | Maintain list context while reviewing intelligence |
| Relationship Detail | Understand and act within a connected relationship |
| Pipeline | See and change stage with accessible alternative |
| Communication Workspace | Prepare, review, send/log, and understand communication |
| Analytical Workspace | Explain metrics, trends, definitions, and drill-downs |
| Consequential Review | Verify prerequisites and record explicit human disposition |
| Settings/Admin | Configure or operate without mimicking business workspaces |

The canonical pattern count in `page-patterns.md` is nine.

## Information placement rules

### Identity header

Record name/type, status, owner, last meaningful activity, critical conflict, and one primary action.

### Summary

Only decision-relevant facts: qualification, evidence freshness, authority, next action, relationship/commercial state. No decorative metrics.

### Tabs

Maximum seven visible tabs. Use stable ordering:

1. Overview
2. Activity
3. Evidence
4. Relationships
5. Commercial or Authority where applicable
6. Documents
7. History

Only show tabs applicable to the entity. Never use a tab solely for one field.

### Central timeline

Communication and operational events with type, actor, timestamp, outcome, source, and related record. Filters are available, but chronology is immutable.

### Context rail

Maximum three stacked modules:

1. next action/readiness;
2. authority/risk/evidence gap;
3. key relationship or commercial context.

The rail never becomes an arbitrary metadata column.

### Drawers

Evidence/source inspection, history, contextual task/note creation, relationship preview, AI suggestion review, and compact row detail. A drawer never hosts final agreement approval, outreach send, payment marking, or dispute resolution without the full consequential-review context.

## Density rules

- Dense tables: Products, Brands, Buyers, Orders, Accounts, Reorders, Commissions, audit/jobs, analytics drill-downs.
- Summaries: Home priorities, detail identity, account/commercial state, analytics topline.
- Cards: Kanban Placement cards, compact exception summaries, template/sequence previews only.
- Borderless sections: narrative context, labels/values, timeline groups, supporting metadata.
- Bordered surfaces: editable forms, selectable rows, documents, blockers, confirmations, data tables.
- Increased whitespace: human approval, legal ambiguity, authority blockers, suppression, payment/commission actions.
- Persistent context: selected record in split workspaces, identity header on detail, context rail on wide screens.

## Acceptance criteria

- Every entity has one canonical list/detail behavior.
- Every existing route remains valid.
- No relationship or audit history becomes less accessible.
- Supporting utilities are adjacent to the work that needs them.
- The interface never implies that one human decision satisfies another distinct decision.
- Cross-record context is visible without false breadcrumbs.
- Attention surfaces have explicit roles: Home prioritizes, Tasks owns work, Notifications reports change, Analytics explains outcomes, AI suggests.
