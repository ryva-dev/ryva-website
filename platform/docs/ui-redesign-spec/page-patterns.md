# Standard Page Patterns

Every current route is assigned to exactly one primary pattern in `pages/README.md`. A page may embed a secondary pattern—for example, a Register can open a record drawer—but its page-level anatomy remains predictable.

## Shared rules

- One `h1`, one primary action, and one clear next action or outcome.
- Compact header; no internal hero sections.
- 1440 px maximum workspace width, except authentication which uses its own centered composition.
- Filters and tabs remain below the page/identity header.
- Critical blockers appear before or adjacent to the governed action.
- Empty, loading, error, permission, restricted, stale, and provider-unavailable states preserve page identity.
- Drawers hold contextual review; dialogs hold short confirmation; routes hold durable work.
- Desktop supports dense data. Mobile restructures around task completion.

## 1. Command Center

**Used by:** Home.

### Anatomy and hierarchy

1. Compact greeting/date and access/freshness line.
2. Today: owned tasks and due commitments.
3. What changed since last acknowledged visit.
4. Priority queue ordered by authority/trust blockers, due work, replies, commercial deadlines, stalled work, then evidence review.
5. Pipeline exceptions.
6. Commercial continuity by currency.
7. Explainable AI briefing.

Use one 720–840 px primary column and a 320 px supporting rail on wide screens. Do not use a uniform metric-card grid.

### Header and actions

Primary action is the highest-priority safe next action when one exists; otherwise “Review tasks.” Analytics and AI history are secondary links.

### Content behavior

- Today and changes use structured lists.
- Pipeline/commercial summaries use compact metrics with drill-down and definitions.
- AI briefing is visually subordinate and evidence-labelled.
- No page-level filters. Time/freshness controls are contextual.

### States

- Empty: explain the first professional setup action without presenting false zeros.
- Loading: stable skeleton for priorities and summaries.
- Error: deterministic tasks remain visible when AI or analytics fails.
- Mobile: single column; sticky next action; priority reasons expandable.
- Accessibility: ordered list semantics, descriptive links, live update only on explicit recalculate/acknowledge.

## 2. Register

**Used by:** structured list pages such as Orders, Accounts, Commissions, documents, sources, territories, generic compatibility lists, and utility registers.

### Anatomy and hierarchy

1. Compact PageHeader and one create/import/export action as appropriate.
2. Saved view selector.
3. Search and FilterBar.
4. Active filter chips and result count.
5. Table/list.
6. Pagination and bulk-action bar when selection exists.

Full-width workspace. Standard desktop row height 48 px; optional compact 40 px. Identity column pins on horizontal scroll.

### Actions and controls

- Primary action: create the page’s record or the most relevant existing commit.
- Secondary: import/export, column control, density, saved view.
- Row click opens a preview drawer when it does not conceal a required full review; Enter/open action navigates to detail.
- Row menu contains existing safe actions only.

### States

- Empty records: outcome-oriented setup action.
- No results: retain filters; clear-filter action.
- Loading: header and column skeletons; no layout jump.
- Partial/stale/provider unavailable: label scope and freshness.
- Error: preserve query, filters, columns, selection, and saved view.
- Mobile: prioritized structured rows; filters in full-screen sheet; no squeezed table.
- Accessibility: caption/label, scoped headers, sortable state, selection names, table alternative for any non-table view.

## 3. Split Intelligence Workspace

**Used by:** Products, Brands, Businesses & Buyers, Search results where persistent selection is useful.

### Anatomy and width

- Left results pane: 320–380 px.
- Center record pane: min 560 px, flexible.
- Optional right ContextRail: 300–320 px.
- Pane separators are subtle; avoid three boxed cards.

Header spans the workspace. Filters may collapse into the left pane. Selecting a record updates the center while retaining query, saved view, sort, scroll, and selection.

### Center hierarchy

Identity summary → qualification/evidence freshness → relevant overview → activity/relationships. Full editing or consequential decisions navigate to canonical detail or open an appropriate drawer.

### States

- No selection: purposeful selection prompt, not an empty card.
- No records/no result/provider unavailable are distinct.
- Mobile: list is full-screen; selection navigates to full-screen record with explicit Back preserving context.
- Accessibility: panes are labelled regions; selection uses `aria-current`; focus moves to record heading only when user activates a row, not on arrow preview.

## 4. Relationship Detail

**Used by:** Product, Brand, Buyer/Business, Contact, Representation Opportunity, Placement, Account, Order, Reorder context, Commission.

### Anatomy

1. True breadcrumb or relationship trail.
2. IdentityHeader with status, owner, critical indicator, last activity, and primary action.
3. Focused tabs.
4. Main operational content or ActivityTimeline.
5. ContextRail with next action, blockers, and key relationship/commercial context.

Tabs use entity-appropriate subsets of Overview, Activity, Evidence, Relationships, Authority, Commercial, Documents, History.

### Action placement

- Primary next action in IdentityHeader and repeated as sticky mobile action.
- Actions close to their relationship/timeline item.
- Consequential action launches the Consequential Review pattern.

### States

- Loading: identity and tab skeleton remain.
- Error: retain relation trail and return path.
- Permission/restricted: show permitted metadata and explicit scope, never leaked hidden fields.
- Mobile: summary precedes tabs; rail becomes Context drawer; timeline remains primary.
- Accessibility: tabs follow WAI-ARIA behavior; timeline is a semantic list with actor/action/time; sticky action never obscures content.

## 5. Pipeline

**Used by:** Placement CRM; limited stage portions of Representation.

### Anatomy

Header → view switcher (Kanban/Table) → saved view/filters → stage summary → board/table → selection detail drawer.

Kanban columns reflect existing Placement stages. Cards show only Product, Brand, Buyer, stage, last activity, next action, days in stage, expected value when already stored, and critical risk. No score is introduced.

### Movement

- Drag is optional enhancement, never the only method.
- Every move invokes the same existing stage-transition review and validation.
- Blocked cards cannot be moved past the block; reason and required action are available.
- Successful movement is announced and audited by existing behavior.

### States and accessibility

- Table alternative is always available and functionally equivalent.
- Keyboard “Change stage” action opens stage selector and confirmation.
- Mobile uses stage-grouped list; no horizontal board.
- Loading uses column/row skeleton; no-result retains filters; errors revert visual movement and preserve server truth.

## 6. Communication Workspace

**Used by:** Outreach, message review, Templates, Sequences.

### Anatomy

- Left: conversations/activity list and filters.
- Center: selected relationship timeline, draft/call preparation, or exact message.
- Right: Buyer/Brand/Placement context, authority, suppression, evidence, next action.

Header tabs: Activity, Drafts, Templates, Sequences. Existing routes synchronize with tabs.

### Actions

Primary action follows state: prepare draft, review exact artifact, approve/send, classify response, or log call. AI suggestions appear inline as editable, evidence-labelled assistance.

### States

- Authority, conflict, suppression, missing approval, and provider availability remain separate.
- Draft is never visually confused with sent.
- Empty: guide to a prepared Placement/verified Contact; do not imply permission.
- Mobile: selected activity full-screen, sticky approve/log action, context full-screen drawer.
- Accessibility: communication chronology as list; exact content is readable text; approval names recipient/channel/artifact; call links are explicit.

## 7. Analytical Workspace

**Used by:** Analytics and Reports.

### Anatomy

Header → view tabs → date/currency/filter bar → freshness/data-scope line → topline summary → primary chart/table → drill-down table → definitions.

Full-width. Charts may use a maximum 840 px analysis column with adjacent definitions only when helpful. Currency groups never combine.

### Actions and states

- Primary action: Recalculate/refresh current analysis or save report in Reports.
- Every metric exposes definition, source scope, freshness, and drill-down.
- No data differs from zero.
- Provider-unavailable does not suppress verified internal data.
- Mobile shows summary, then accessible table/list; advanced configuration remains desktop-first.
- Accessibility: chart has title, description, data table, keyboard-readable values, and no color-only series.

## 8. Consequential Review

**Used by:** Agreement/authority approval, AI suggestion review, Commission dispute resolution, import commit, protected-account decision, commission/payment approval, order verification, exact outreach approval.

### Anatomy

1. Review identity and consequence.
2. Readiness summary: Ready, Blocked, or Requires review.
3. Required evidence/authority and known gaps.
4. Exact artifact/terms/content/calculation.
5. Human decision inputs and rationale.
6. Confirmation summary.
7. Immutable history/outcome.

Recommended max-width 960 px, with a 280–320 px readiness rail on wide screens. Increase spacing around the final decision.

### Rules

- Never hide a blocker behind a tab.
- AI extraction/suggestion remains visually distinct from verified/human-owned values.
- A final confirmation dialog may summarize the exact consequence; it cannot replace the review.
- Recoverable errors preserve every input.
- Mobile supports urgent approvals only when the exact artifact and blockers remain reviewable; complex extraction/merge evidence is read-only or desktop-first as already specified.
- Accessibility: focusable error summary, field associations, explicit consequence, no default-selected approval, and announced outcome.

## 9. Settings and Administration

**Used by:** Access, Certification, Subscription, Profile, Settings, Operations.

### Anatomy

Compact header → local section navigation where needed → grouped settings/operational section → explanatory/status content → actions.

No imitation of Intelligence or relationship pages. Settings groups are separated by headings/rules, not a card per setting.

### Behavior

- Account settings use a local nav: Profile, Certification, Subscription, Preferences/Security.
- Admin uses local anchors/tabs for System status, AI control, Jobs, and Audit.
- Destructive/security actions are separated and confirmed.
- Permission scope is always visible in Operations.
- Mobile uses a section selector and one-column forms.
- Accessibility: settings label/control relation, session action names, current section semantics, and explicit saved state.

## Pattern acceptance criteria

- Every route has one primary pattern in `pages/README.md`.
- No page invents a tenth page-level pattern without founder/design review.
- Embedded patterns reuse the same component contracts.
- All nine patterns define desktop, mobile, state, and accessibility behavior.
- Existing business actions remain distinct even when their visual treatment is consolidated.

