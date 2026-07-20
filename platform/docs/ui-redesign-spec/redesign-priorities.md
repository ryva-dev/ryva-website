# Redesign Priorities and Audit Resolution

## P0-1 — Global navigation architecture

### Current problem

Up to 27 ungrouped destinations appear in one desktop rail and become a horizontally scrolling strip on small screens. Profile identity and Sign out disappear below 900 px.

### Affected pages/components

Every authenticated route; `ProtectedLayout`, sidebar, access banner, CommerceNav, Outreach header links, Analytics subnav, profile/session actions.

### Intended pattern

The grouped persistent sidebar and mobile bottom navigation defined in `navigation-redesign.md`: Operate, Intelligence, Commercial, Analyze, System, separated capability-controlled Operations, command search, Notifications, and profile menu.

### Consolidate

- Account destinations into profile utility.
- Commerce subnav into global siblings/local tabs.
- Outreach/Analytics contextual navigation into Tabs.
- Import/Export under Data transfer.
- supporting Sources/Territories/Contacts into contextual access.

### Keep distinct

Representation remains a visible workspace; Certification and Subscription remain distinct policy records; admin/support remains capability-controlled; every route remains valid.

### Migration risks

Capability omissions, loss of Sign out/export, broken deep links, inaccurate active states, context loss, and mobile focus trapping.

### Acceptance criteria

- All 51 routes remain reachable.
- Sign out is available at every width.
- No horizontal full-navigation strip.
- Current location and capability state are accessible.
- Server policy remains authoritative.

## P0-2 — Duplicate Generic Records and Intelligence

### Current problem

Brand, Product, Business, and Contact have generic and dedicated page families with different filters, views, actions, terminology, and detail layout. Invalid generic types silently become Brand.

### Affected pages/components

`/records/:type`, `/records/:type/:id`, Products/Brands/Buyers/Contacts, RecordsPage, IntelligencePages, saved-view implementations, tables/lists/cards.

### Intended pattern

Dedicated Intelligence pages are canonical. Generic routes are compatibility entries that render the same canonical register/detail contract. Invalid types show unsupported/not-found.

### Consolidate

Register controls, saved views, tables, creation, identity, evidence, risks, decisions, notes/tasks, relationships, and histories.

### Keep distinct

Entity fields and human qualifications remain separate; Contact verification remains a distinct decision; Product comparison and Buyer fit retain different business purposes.

### Migration risks

Saved-view schema mismatch, action loss, route-state loops, inconsistent record field mapping, optimistic version conflicts, and invalid-type behavior affecting tests.

### Acceptance criteria

- Supported generic and dedicated routes show equivalent truth/actions.
- No history/view/data loss.
- Invalid type never renders another entity.
- Qualification remains entity-specific and human-owned.

## P0-3 — Detail-page decision hierarchy

### Current problem

Long detail pages place identity, evidence, risk, forms, decisions, relations, and history in equally weighted panels. Next action, authority, and blockers can be visually remote from the action.

### Affected pages/components

Product, Brand, Buyer, Contact, Representation, Agreement, Placement, Account, Order, Protected Account, Commission, Dispute, AI Suggestion and Generic details; PageHeader, metrics, panels, timelines, StatusPill.

### Intended pattern

IdentityHeader → focused Tabs → central operational content/ActivityTimeline → ContextRail with next action, blocker, and relationship/commercial context. Consequential action enters ApprovalPanel/Consequential Review.

### Consolidate

Identity summaries, status language, timelines, evidence drawers, risk/authority indicators, action placement, history and relationship previews.

### Keep distinct

Agreement authority, Placement qualification, Outreach approval, Order verification, protection, Commission approval/payment, dispute resolution, and AI disposition remain separate reviewed decisions.

### Migration risks

Hiding required fields behind tabs, stale sticky context, cross-record data overfetch, changed focus order, and accidental coupling of independent decisions.

### Acceptance criteria

- Critical blockers are visible before governed actions.
- One primary next action is clear.
- Full evidence/history remains reachable.
- Independent human decisions remain independent.
- Mobile supports required urgent decisions.

## P0-4 — Standard registers, filters, saved views, and states

### Current problem

Registers use hand-built tables, lists, cards, three saved-view implementations, several filters, and three empty-state patterns. Responsive behavior is mostly horizontal scrolling.

### Affected pages/components

All list pages, Generic Records, Intelligence, Commerce, Analytics/Admin tables, Search, Tasks, Notifications, Documents, Sources, Territories; DataTable, SaveView, Empty, table-wrap, record lists/cards.

### Intended pattern

PageHeader → SavedViewSelector → FilterBar/chips → shared Table/DataRow → pagination/bulk bar. Split Intelligence embeds the same register. Mobile uses structured rows and filter sheet.

### Consolidate

Search, filters, chips, saved views, columns, sorting, density, pagination, selection, row actions, loading, no records, no results, partial/stale, error, archived, and merged state.

### Keep distinct

Kanban for Placement, timeline for communication/history, comparison table for aligned Products, and privacy/capability-specific bulk/export actions.

### Migration risks

Server pagination/filter semantics, saved-view compatibility, selection across pages, archived/merged behavior, performance, and row-action authorization.

### Acceptance criteria

- One register contract across domains.
- Filters/views persist.
- No-result differs from no-data.
- Responsive alternative is functional.
- Bulk/row actions never exceed permission.

## P0-5 — Multi-step consequential workflows

### Current problem

Agreement, Placement creation/stage, Outreach approval, Orders, imports, exports, AI review, protection, Commission and disputes expose many prerequisites and actions in long undifferentiated forms.

### Affected pages/components

Agreement, Representation/Placement details, Outreach detail, Orders/detail, protected account detail, Commission/detail/dispute, AI suggestion, Imports/Exports; Field/forms, warnings, document previews, timelines.

### Intended pattern

Consequence identity → readiness → evidence/authority and gaps → exact artifact/terms/content/calculation → human decision/rationale → confirmation → immutable outcome/history.

### Consolidate

Readiness summaries, ApprovalPanel, evidence/document drawers, exact consequence confirmation, validation summary, loading/error preservation, and AuditHistory.

### Keep distinct

Every domain decision and server validator. A visual step does not mark business completion. Upload/extraction does not approve; draft does not send; estimate does not become actual; approval does not equal payment.

### Migration risks

Accidental action enablement, stale approval scope, hidden blocker, form-state loss, version races, mobile omission, and audit gaps.

### Acceptance criteria

- No action bypasses existing validators.
- Exact reviewed artifact/version remains visible.
- Human intent is explicit and not preselected.
- Recoverable error preserves work.
- Result is auditable and announced.

## Priority tiers

- **P0:** the five resolutions above; foundational and required before broad page styling.
- **P1:** relationship context, account/access consolidation, attention model, evidence adjacency, responsive task model.
- **P2:** typography, surfaces, action hierarchy, table comprehension, state system, accessibility semantics.
- **P3:** terminology, utility placement, section deep links, populated-state density review.

