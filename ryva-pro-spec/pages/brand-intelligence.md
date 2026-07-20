# Page: Brand Intelligence

## Purpose and user

Research Brands, manage the representation pipeline, and make authority and relationship readiness visible.

## Data displayed

Pipeline/table views with Brand, identity, Products, stage, wholesale status, distribution, communication quality, representation status, agreement dates, commission-potential label, protected-account/conflict count, risk flags, last activity, next action.

Pipeline stages: Discovered, Researching, Contact Ready, Contacted, Conversation, Reviewing Terms, Authorized, Active, Paused, Ended, Rejected.

## Actions

Primary: Add Brand / Perform stage next action.  
Secondary: add Product/Contact/evidence, prepare outreach, create task, review terms, pause/end, export, merge.

## Filters

Stage, category, wholesale status, representation status, territory, communication condition, risk, Product count, physical retail presence, agreement expiry, last activity. Saved table/Kanban views.

Bulk actions: owner/tag/task/archive for non-consequential records; no bulk contact/send/stage authorization.

## States

- **Empty:** discover/import/add Brand.
- **Loading:** pipeline counts and visible columns skeleton.
- **Error:** retain saved records; provider/research failures localized.

## Permissions and responsive

Representative owns workspace. Mobile pipeline becomes grouped list with next action.

## Linked records and AI

Products, Contacts, evidence, Representation Opportunities/Agreements, Territories, Protected Accounts, Placement Opportunities, Activities, Tasks, Risks. AI summarizes, finds gaps, suggests Contacts, extracts terms; no agreement approval.

## Acceptance criteria

- pipeline transitions enforce criteria in `pipelines-and-stages.md`;
- Authorized/Active require current verified Agreement;
- Contact Ready requires contact purpose and no stop flag;
- conflict/protection is visible before outreach;
- all stage changes and reasons audited.

