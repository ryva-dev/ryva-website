# Component System

## Architecture

The redesign consolidates the current 19 React components and 24 repeated markup patterns into **48 named contracts**. Components are presentation/state primitives; server domain services remain the source of permission, authority, validation, and audit truth.

All components share:

- token-only styling;
- visible hover, focus, active, disabled, loading, error, and read-only states where applicable;
- 40 px default controls, 32 px desktop-compact controls, and 44 px mobile targets;
- sentence-case labels;
- input preservation after recoverable errors;
- semantic HTML first, ARIA only when necessary;
- no product action inferred from component visibility.

## Actions and inputs

| # | Component | Purpose and variants | States, size, spacing, responsive | Accessibility | Used by / replaces |
|---:|---|---|---|---|---|
| 1 | Button | Primary, secondary, tertiary, destructive; text+optional leading/trailing icon | sm 32, md 40, touch 44; default/hover/pressed/focus/disabled/loading/success | Native button; type explicit; loading name retained | All forms/actions; replaces `.primary-button`, `.secondary-button`, `.text-button`, `.danger-button` |
| 2 | IconButton | Compact non-consequential utility; tooltip required | 32 desktop, 44 touch; circular or 6 px radius | Accessible name; tooltip; no icon-only final approval/destructive action | Shell, tables, drawers; new consolidation |
| 3 | Input | Text, email, number, URL, identifier, read-only | 40/32/44; default/focus/error/disabled/read-only/loading | Visible label, description/error IDs, autocomplete/inputmode | All forms; replaces bare inputs and `Field` child inconsistency |
| 4 | SearchInput | Search with clear, shortcut, loading | 40 shell, 32 filter, 44 mobile | `searchbox`, labelled scope, Escape clears only when focus is inside | Shell, registers, Search; consolidates inline search |
| 5 | Select | Single bounded choice | 40/32/44; empty/selected/error/disabled/loading | Native select where practical; label and current value | Filters/forms; replaces raw selects |
| 6 | MultiSelect | Multiple bounded values with summary | 40; sheet on mobile; chips only for selected values | Keyboard listbox; count announced; remove controls named | Filters, source/category/product scope |
| 7 | Combobox | Search/select a related record | 40; results popover desktop, full-screen mobile | WAI-ARIA combobox; result count; active descendant | Brand/Product/Buyer/Contact/task selectors; replaces ID fields where records exist |
| 8 | Checkbox | Independent binary or row selection | 18 px visual inside 40/44 target; indeterminate | Native input, associated label, mixed state | Tables, exports, comparisons |
| 9 | Radio | One consequential choice among few options | 44 px row; error/disabled/read-only | Fieldset/legend; never default approval if user intent required | Decisions, outcomes, review dispositions |
| 10 | Switch | Immediate preference toggle only | 36×20 visual, 44 target; on/off/disabled/loading | `role=switch` or native checkbox; state in name | Settings; not used for irreversible actions |
| 11 | DatePicker | Single user-local date with calendar/text entry | 40; full-width mobile | Keyboard calendar, typed ISO-safe input, announced format | Tasks, dates, renewals |
| 12 | DateRangePicker | From/to with presets only where already meaningful | 40; stacked mobile | Two labelled dates, invalid-range error | Analytics and date filters |
| 13 | FileUpload | Immutable upload selection, progress, validation, scan status | Drop zone desktop plus button; button-first mobile | Keyboard file input, accepted types/size, progress/status announcement | Documents, Agreements, imports; replaces raw file input |

## Data, navigation, and structure

| # | Component | Purpose and variants | States, size, spacing, responsive | Accessibility | Used by / replaces |
|---:|---|---|---|---|---|
| 14 | Table | Comparable structured data; comfortable/compact, selectable | 48/40 rows; loading/partial/empty/error/stale | Caption, scoped headers, sort state, keyboard row actions | Registers, Admin, Analytics; consolidates all hand tables |
| 15 | DataRow | Stable row identity, metadata, status, quick/overflow actions | selected/hover/archived/merged/stale/blocked | Row link/action semantics do not conflict; action names include record | Table/list mobile rows |
| 16 | StatusLabel | Authored neutral/success/warning/danger/info state | compact 24 px; icon+text; no arbitrary color class | Text conveys meaning; full term available | Replaces `StatusPill` and `.quiet-tag` for states |
| 17 | FilterBar | Search, common filters, More filters, clear | 32 desktop; full-screen sheet mobile; sticky optional | Labelled region; result changes announced after apply | All registers/analytics |
| 18 | SavedViewSelector | Select/save/duplicate/manage personal view | 32/40; dirty indicator; unavailable state | Current view announced; save name labelled | Generic, Intelligence, Commerce; replaces three implementations |
| 19 | Tabs | Focused local navigation; route/query synchronized | 40 px; scroll only with visible affordance; menu after seven | WAI-ARIA tabs for in-page panels, links for routes; arrow keys | Details, Outreach, Analytics, Settings |
| 20 | PageHeader | Compact page identity and one primary action | 72–104 px; stacks actions mobile | One `h1`; breadcrumb/relation label; action names | Replaces current oversized `PageHeader` treatment |
| 21 | IdentityHeader | Record identity, relationship, status, owner, warning, next action | 112–160 px; compact mobile summary | `h1`, status association, logical action order | All detail pages |
| 22 | ActivityTimeline | Immutable communication/operational chronology | comfortable/compact; filters; virtualize large sets | Semantic ordered list; actor/action/time text; filter status | Relationships, Outreach, commerce; consolidates timeline/audit rows |
| 23 | ContextRail | Up to three decision-relevant modules | 320 px sticky; drawer <1280; inline summary mobile | Labelled complementary region; reading order preserved | Relationship/Consequential pages |
| 24 | Drawer | Contextual review/edit without losing page state | 400/520/680; full-screen mobile; loading/error/dirty | Focus trap, Escape, labelled title, restore focus | Evidence, history, notes/tasks, row preview, AI review |
| 25 | Dialog | Short focused interaction | 440 default, 720 command; mobile inset 16 | Modal semantics, focus trap, Escape, restore focus | Search/command and short decisions |
| 26 | ConfirmationDialog | Exact consequence confirmation | 440; default focus on safe action; processing | Names object/consequence; destructive action explicit | Send, activate, resolve, mark paid, commit import |
| 27 | Toast | Non-critical feedback | success/info, optional real Undo; 5 s | Polite live region; pause on hover/focus | Save/copy/note feedback; new shared pattern |
| 28 | Banner | Persistent global/access/provider state | info/warning/danger/read-only; one action | Landmark/status or alert by urgency; dismiss only if safe | Access shell/provider degradation; replaces access banner variants |
| 29 | Alert | Page/section scoped warning or blocker | info/success/warning/danger; inline or bordered | Role alert only for urgent dynamic errors; heading + recovery | Replaces error/warning/callout variants |

## States, evidence, analytics, and domain primitives

| # | Component | Purpose and variants | States, size, spacing, responsive | Accessibility | Used by / replaces |
|---:|---|---|---|---|---|
| 30 | EmptyState | No records, no results, setup required, unavailable | compact table or full section; optional safe action | Heading, reason, next action; no decorative-only meaning | All pages; replaces three empty implementations |
| 31 | ErrorState | Route, section, or action failure with recovery | inline/section/full; retry and safe return | Focusable summary for forms; error association; alert policy | Replaces `ErrorPanel` variants |
| 32 | LoadingState | Stable busy region | inline spinner or content skeleton; no whole-page blanking | `aria-busy`, polite status; label retained | Replaces `Loading` full replacement behavior |
| 33 | Skeleton | Shape-preserving placeholder | row, text, identity, timeline, chart | Hidden from AT; region has loading name; reduced motion | Registers/details/analytics |
| 34 | Metric | Value, label, definition, freshness, drill-down | compact, emphasis, exception; no decorative card default | Tabular value; complete accessible label | Home/Analytics/Admin; consolidates metric markup |
| 35 | ChartContainer | Explainable chart plus legend/table/definition | line/bar only where data supports; loading/no data/error | Title, description, data table, keyboard values, patterns/text | Analytics; no current chart component |
| 36 | EvidenceLabel | Evidence class, confidence, freshness | verified/direct/proxy/estimate/inference/unknown; restrained | Full authored label, not color-only | Intelligence, AI, decisions |
| 37 | EvidenceDrawer | Inspect claim, source, observed date, freshness, limits, history | 520/680; missing/stale/conflicting | Drawer requirements; source links named | Intelligence, Agreement, AI, Outreach |
| 38 | RiskIndicator | Risk severity/type/status with rationale link | compact/header/rail; open/resolved/accepted | Icon+text+severity; reason accessible | Intelligence, Placement, commerce |
| 39 | AuthorityIndicator | Current authority outcome and scope | authorized/conditional/blocked/expired/suspended/unknown | Reason and governing agreement; no color-only | Representation, Placement, Outreach |
| 40 | CurrencyValue | Currency-separated actual/estimate value | actual/estimated/range/unknown; right aligned | ISO currency in accessible name; tabular numerals | Orders, Accounts, Commissions, Analytics |
| 41 | ForecastRange | User-entered range and assumptions | low/base/high if stored; stale/unknown | Range read as lower to upper with source | Reorders/Analytics; never fabricates forecast |
| 42 | KanbanBoard | Placement stages with table alternative | loading/empty/error; permitted stage movement | Keyboard change-stage, equivalent Table always available | Placement |
| 43 | PipelineCard | Concise Placement summary | default/selected/blocked/stale; 16 px padding | Heading and labelled fields; actions named | Kanban only |
| 44 | TaskItem | Owned work, due state, origin, completion | due/overdue/blocked/completed/mandatory | Checkbox/button has task name; status announced | Home, Tasks, context rail |
| 45 | NotificationItem | Reason, related record, severity, read state | unread/read/critical/action/info | Mark-read includes subject; timestamp semantic | Notification panel/page |
| 46 | AIRecommendation | Labelled editable AI output with evidence/limits | draft/reviewed/edited/accepted/rejected/flagged/unavailable | AI origin announced; evidence/limitations reachable; actions explicit | Home, Copilot, contextual drafting |
| 47 | ApprovalPanel | Readiness, exact consequence, human choice/rationale | ready/blocked/review; processing/success/error | No preselected approval; error summary; consequence text | Agreements, Outreach, orders, commissions, imports |
| 48 | AuditHistory | Immutable actor/action/outcome chronology | compact/full; filter; large-list pagination | Semantic list/table, precise timestamp, outcome text | Agreement, AI, commerce, Admin; consolidates audit list/timelines |

## Consolidation rules

- `Field` becomes the shared form-control wrapper used by Input/Select/etc.; its hint/error association is mandatory.
- `StatusPill` becomes StatusLabel, EvidenceLabel, RiskIndicator, or AuthorityIndicator according to meaning.
- `Loading` and `ErrorPanel` become stable scoped state components.
- `CommerceNav`, Analytics subnav, and Outreach header links use Tabs/context navigation.
- `SaveView` and both independent saved-view implementations become SavedViewSelector.
- `DataTable` and hand-authored tables use Table/DataRow.
- `MetricGrid` and hand-authored metrics use Metric.
- `Empty`, `.empty`, and `.empty-state` use EmptyState.
- Local timeline/list/audit markup uses ActivityTimeline or AuditHistory.

## Component acceptance criteria

- All 48 contracts have Storybook or equivalent isolated examples before broad page migration.
- Every interactive state is keyboard and screen-reader tested.
- All components pass automated accessibility and token-use checks.
- Components do not contain domain authorization logic.
- Existing actions retain exact API preconditions and audit behavior.
- No legacy component is removed until every caller is migrated and regression tests pass.

