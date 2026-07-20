# Component Inventory

## Counting rule

The application has **43 implemented reusable UI building blocks**:

- **19 React components** reused directly or within a domain module.
- **24 CSS/markup patterns** repeated across pages but not encapsulated as React components.

Absent categories are documented separately and are not included in the total.

## React components

| # | Component | Where used | Current variants | Duplication / standardization opportunity | Styling inconsistency |
|---:|---|---|---|---|---|
| 1 | `ProtectedLayout` | Every authenticated route | Full, read-only, blocked; representative/admin nav | Sole shell; domain grouping and responsive behavior are embedded here | Sidebar becomes top strip; footer disappears |
| 2 | `PageHeader` | Nearly every page | Optional action; dynamic title/eyebrow | Strong candidate for consistent parent/context metadata later | Actions vary between links, status pills, and button rows |
| 3 | `Field` | Forms across all domains | Label, optional hint, arbitrary child | Bare/ARIA-labelled controls still occur outside it | Hint has no programmatic control association |
| 4 | `Loading` | API-backed pages/sections | Custom label | Some detail pages return it outside the normal page shell | Spinner panel spacing varies by surrounding container |
| 5 | `ErrorPanel` | API and action failures | Message only | Inline warnings and field errors use separate patterns | Alert treatment is visually stronger than some consequential blockers |
| 6 | `StatusPill` | Access, lifecycle, risk, jobs, AI, commerce | Unlimited value-derived class | Central renderer, but semantic vocabulary/color mapping is incomplete | Unknown statuses receive generic styling; raw labels vary |
| 7 | `CommerceNav` | Six commerce lists/details | Active route | Only fully encapsulated domain navigation | Different from Outreach and Analytics context navigation |
| 8 | `Shell` | Commerce pages | Children only | Repeats page + CommerceNav wrapper | Other domains hand-compose shells |
| 9 | `Empty` | Commerce registers | Message children | Other domains use `.empty` or `.empty-state` directly | Different spacing/tone by domain |
| 10 | `SaveView` | Commerce registers | Entity type and current query | Generic Records and Intelligence implement separate saved-view controls | Different labels, fields, and layouts |
| 11 | `DataTable` | Analytics | Rows, empty text, optional link base | Other tables are hand-authored | Generic JSON-derived columns versus domain-specific tables |
| 12 | `MetricGrid` | Analytics views | Selected metric codes | Home and Admin hand-compose metric cards | Density and explanation affordances differ |
| 13 | `PipelineView` | Analytics | One view | View components share page data but no common view contract | Fragment-level layout |
| 14 | `CommercialView` | Analytics | One view | Same as above | Fragment-level layout |
| 15 | `PortfolioView` | Analytics | One view | Same as above | Fragment-level layout |
| 16 | `ForecastPanel` | Analytics pipeline | Forecast rows | Could align with table/empty conventions | Table-only projection display |
| 17 | `DefinitionsView` | Analytics | Definition cards | No shared definition/metadata pattern elsewhere | Panel repetition |
| 18 | `ReportsView` | Analytics | Save/list reports | Saved reports and saved views use separate interaction models | Inline form differs from other form grids |
| 19 | `AiBriefingPanel` | Home | Daily and weekly actions | AI request/status pattern is otherwise implemented in Copilot | Home-specific policy and disabled-state presentation |

## Repeated CSS/markup patterns

| # | Pattern | Where used | Variants | Duplication / standardization opportunity | Styling inconsistency |
|---:|---|---|---|---|---|
| 20 | Primary button | Forms and consequential actions | Standard, inline, emphasis-panel | Normalize loading, destructive, and full-width behavior | Some native buttons rely on default type behavior |
| 21 | Secondary button | Filters, navigation, lower-emphasis actions | Link or button; emphasis-panel | Clarify action versus navigation semantics | Header mobile full-width rule only targets secondary buttons |
| 22 | Text button | Refresh, mark read, revoke, save view | Normal and danger text | Consolidate icon/text/action treatment | Often below 44 px touch height |
| 23 | Danger button | Account/session/destructive actions | Filled danger; danger text elsewhere | One destructive-action model | Filled and text-only danger actions compete |
| 24 | Text input | Every form | text, date, datetime, number, file, disabled | Shared sizing exists; validation and prefix/suffix do not | Bare inputs and `Field` inputs mix |
| 25 | Textarea | Notes, rationale, descriptions, AI content | 3–10 rows; document-like editor | Shared validation/help contract | Large editors and short notes share base styling |
| 26 | Select/dropdown | Filters, statuses, relationships, workflow stages | Normal and compact view-control | Establish consistent selected/empty/disabled display | Labels use title case, sentence case, and raw enums |
| 27 | Checkbox/check row | Export datasets, consent/flags, comparison selection | `.check-row`, `.checkbox-group`, table checkbox | One accessible checkbox pattern | 16 px boxes are below recommended touch size |
| 28 | Table + table wrapper | Intelligence, Generic Records, Admin, Analytics, Outreach, Commerce | Static, dynamic-column, selectable | Major opportunity for one table contract | Captions, empty rows, actions, density, and responsive behavior vary |
| 29 | Panel | Almost every page section | Standard, emphasis, warning, success, external readiness | Core surface primitive already widespread | Extensive use makes unrelated content look equal |
| 30 | Metric card | Home, Admin, details, Analytics | Standard, analytics, status/action | Consolidate definitions/freshness/drill-down | Min-heights differ; many empty metrics consume space |
| 31 | Record card | Intelligence, templates, sequences, generic card layout | Linked and static article | Align actions/status/metadata positions | Hover behavior exists only for some linked cards |
| 32 | Access/status cluster | AI and multi-state records | One or several pills | Define ordering and overflow behavior | Pill combinations can become dense |
| 33 | Access banner | Authenticated shell | Read-only and blocked colors | Preserve a global account-state pattern | Text uses raw transformed enums |
| 34 | Alert/callout | Provider, authority, formula, warnings | Error, warning, inline warning, callout, formula | Unify severity and required action | Border, fill, icon absence, and spacing vary |
| 35 | Empty state | Lists, tables, panels | `.empty`, `.empty-state`, `Empty` component | One empty-state contract with contextual next action | Italic line, centered block, and component versions differ |
| 36 | Record list | Generic records and related entities | Rows or card mode | Align with data table/list selection | Status position and metadata vary |
| 37 | Plain list | Sources, territories, simple registers | `ul/li` with status | Reuse for simple non-tabular registers | Empty behavior differs |
| 38 | List row | Agreement restrictions, relationships, connected records | Link or non-link | Define affordance for clickable rows | Clickability is not always visually obvious |
| 39 | Timeline item | Stage histories, claims, attachments, audit-like events | Three-column row | One chronology/audit pattern | Dense three-column layout differs from Admin audit list |
| 40 | Detail grid/definition list | Nearly every detail page | 2–4 columns, detail list | Shared field metadata and unknown display | Breakpoints and label capitalization vary |
| 41 | Subnav/tabs | Commerce and Analytics | Links or buttons | One semantic context-navigation pattern | Active state semantics and URL behavior differ |
| 42 | Form grid/actions | Creation and review forms | one/two columns; span-2; inline form | Align validation, required state, and action placement | Forms are often embedded beside list content |
| 43 | Session/document preview utility surface | Settings and Outreach/Agreements | Session rows; preformatted document/body | Both are specialized scrollable/read-only surfaces | Monospace, borders, and action placement are page-specific |

## Requested categories that are absent

These are not counted as reusable components because no implemented component exists:

- dialogs and modal dialogs;
- drawers and mobile drawers;
- persistent side panels beyond the global sidebar;
- pagination controls;
- avatars;
- toast notifications;
- skeleton loaders;
- icon buttons or a shared icon system;
- removable filter chips;
- popovers/menus.

“Pills,” “badges,” and status indicators are all currently represented by `StatusPill` or `.quiet-tag`. Search is a form composition rather than a reusable component. Notifications are page rows, not toasts.

## Duplication hotspots

1. Saved views are independently implemented in Generic Records, Intelligence lists, and Commerce.
2. Empty states have three implementations.
3. Tables are hand-authored across most domains, while Analytics alone has `DataTable`.
4. Context navigation uses three separate patterns.
5. Metrics are shared only inside Analytics; Home and Admin repeat the markup.
6. Record/detail summaries use several combinations of metric cards, definition lists, record summaries, and panels.
7. Warning, blocker, provider-unavailable, error, and policy messages use overlapping but uncoordinated treatments.

