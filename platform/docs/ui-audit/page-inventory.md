# Page Inventory

## Reading the inventory

Each of the **51 routed page patterns** is listed. “Overlays” reports dialogs, drawers, and side panels; there are no dialogs or drawers anywhere in the current application. “States” covers explicit empty, loading, and error handling. Tables may only render when data exists.

## Access, identity, and administration

| Route | Purpose; primary and secondary actions | Information hierarchy and major sections | Reusable components and data surfaces | Forms / overlays | Empty, loading, error |
|---|---|---|---|---|---|
| `/login` | Authenticate; secondary conditional TOTP | Brand/context panel → Welcome → credential form → eligibility note | Brand mark, Field, primary button | Login form; conditional code input; no overlay | Session check; inline safe error; TOTP conditional |
| `/` | Prioritize work; open tasks/analytics/records, acknowledge changes, request briefings | Header → freshness → Priority queue → changes → pipeline → commercial → AI briefing | PageHeader, StatusPill, metric cards, priority list, AiBriefingPanel | No form/overlay; inline selects/actions can appear in priorities | Loading and ErrorPanel; explicit empty copy in each section |
| `/access` | Explain access; remediate via certification/subscription | Header → access-status emphasis panel → capabilities/remediation | PageHeader, StatusPill, panel, action list | No form/overlay | Auth loading; safe access explanation; no generic empty |
| `/certification` | Display credential; refresh/open renewal | Header/action → verified credential card → identifiers and dates | PageHeader, StatusPill, definition grid | No form/overlay | Loading/error through data request; status-specific content |
| `/subscription` | Display entitlement; manage billing | Header → plan/status card → provider and renewal details | PageHeader, StatusPill, definition grid | External provider action; no overlay | Loading/error; provider-unavailable handling |
| `/subscription/activate` | Activate entitlement; manage billing | Activation header → plan/status card → provider state | Same Subscription component | External provider action; no overlay | Conditional eligibility/provider states |
| `/profile` | Maintain identity/business/locale; save | Header → one panel → two-column field grid → actions | PageHeader, Field, ErrorPanel | 12-control profile form; no overlay | Load-before-form; action error/success |
| `/settings` | Maintain preferences/sessions/closure; save/revoke/request | Header → Working preferences → Active sessions → Account closure | PageHeader, Field, locked setting, session list, danger actions | 8-control preferences form plus direct buttons; no overlay | Loading/error; session and request state messages |
| `/admin` | Operate providers/jobs/audit/AI; refresh/retry/toggle | Header → Provider/safety → AI kill switch → Job health → Audit events | PageHeader, Loading, ErrorPanel, StatusPill, metrics, tables, audit list | AI reason textarea and direct actions; no overlay | Independent loading/error per section; empty jobs |

## Generic records and Intelligence

| Route | Purpose; primary and secondary actions | Information hierarchy and major sections | Reusable components and data surfaces | Forms / overlays | Empty, loading, error |
|---|---|---|---|---|---|
| `/records/:type` | List/filter/create a Brand, Product, Business, or Contact; save/switch view | Header → split: Records/search/views/list + Create form | PageHeader, Field, Loading, ErrorPanel, StatusPill; list/card/table variants | Filter form + creation form; no overlay | Spinner; ErrorPanel; type-specific empty state |
| `/records/:type/:id` | Review connected context; add notes/tasks/evidence/risks/decisions/relationships | Header/status → summary → action forms → related evidence, risks, decisions, notes, activity, tasks, documents | PageHeader, StatusPill, panels, detail grid, lists/timelines | Multiple inline forms; no overlay | Full loading; safe error; empty copy per collection |
| `/products` | Research/filter/create Product; compare selected Products | Header → filters/saved view → Working records → Create research record | PageHeader, Field, StatusPill, cards/table, checkbox selection | Filter/save controls + creation form; no overlay | Loading/ErrorPanel; empty working-record state |
| `/products/compare` | Create comparison context | Header → one form panel | PageHeader, Field | Six-control form; no overlay | Action error; no loading/empty |
| `/products/comparisons/:comparisonId` | Explain aligned Products without ranking; open Product | Header → comparison table → Interpretation limits | PageHeader, table, lists | No form/overlay | Loading/error from comparison requests; empty rows/limits possible |
| `/products/:id` | Review/edit/qualify Product; add evidence/risk/decision; compare/match | Header → record summary → identity/details → evidence → risks → qualification → comparisons/matches → activity | PageHeader, StatusPill, Field, panels, detail grid, lists/tables/timelines | Several inline forms; no overlay | Full loading/error; explicit empties for connected collections |
| `/brands` | Research/filter/create Brand | Header → filters/saved view → records → Create research record | Same Intelligence list family; optional table | Filter/save controls + creation form; no overlay | Loading/ErrorPanel; empty state |
| `/brands/:id` | Review/edit/qualify Brand; manage evidence, risk, contacts, Products | Header → summary → identity → evidence/risk → human decision → connected records/activity | Intelligence detail components, tables/lists | Several inline forms; no overlay | Full loading/error; collection empties |
| `/buyers` | Research/filter/create Business Buyer | Header → filters/saved view → records → Create research record | Intelligence list family | Filter/save controls + creation form; no overlay | Loading/ErrorPanel; empty state |
| `/buyers/:id` | Review/edit/qualify Buyer; manage contacts, fit, evidence, risks, matches | Header → summary → business details → evidence/risk → decision → contacts/matches/activity | Intelligence detail components, lists/tables | Several inline forms; no overlay | Full loading/error; collection empties |
| `/contacts/:id` | Verify professional route; record source/freshness/notes | Header/status → contact detail grid → verification form | PageHeader, StatusPill, Field, detail grid | Three-control verification form; no overlay | Full loading/error; missing source options handled by empty select |

## Representation, placement, and outreach

| Route | Purpose; primary and secondary actions | Information hierarchy and major sections | Reusable components and data surfaces | Forms / overlays | Empty, loading, error |
|---|---|---|---|---|---|
| `/representation` | Review opportunities/agreements; open opportunity | Header → Opportunities → Agreements → creation form | PageHeader, Loading, ErrorPanel, StatusPill, lists | Eight-control creation form; no overlay | Loading/error; empty lists |
| `/representation/:id` | Review/transition opportunity; select human decision and task | Header → stage metrics → agreements/documents → transition → history | PageHeader, StatusPill, Field, metric cards, timeline | Stage-confirmation form; no overlay | Full loading/error; empty agreements/documents/history |
| `/agreements/:id` | Review authority; edit terms/extraction/restrictions/conflicts; approve | Header → authority metrics → immutable original → material terms → extraction candidates → restrictions → conflicts → approval/history | PageHeader, StatusPill, Field, document preview, lists/timelines, warnings | Multiple review/action forms; no overlay | Full loading/error; empty candidates/restrictions/conflicts; scan/ambiguity states |
| `/placements` | Filter pipeline; create Placement | Header → Pipeline → creation form | PageHeader, Loading, ErrorPanel, StatusPill, record list | Fifteen-control creation form; no overlay | Loading/error; empty pipeline and prerequisite options |
| `/placements/:id` | Review authority and triangle; transition stage; open Outreach | Header/action → authority blocker → basis → Relationship Triangle → stage confirmation → history | PageHeader, StatusPill, ErrorPanel, detail grid, timeline | Stage form; no overlay | Full loading/error; explicit authority blocker; history empty |
| `/outreach` | Review activity; draft message; log call | Header/actions → provider status → unified history → Prepare outreach → Log call → Messages | PageHeader, Field, StatusPill, table/list, state panel | Two forms with 13 controls total; no overlay | Loading/error; provider-unavailable; empty history/messages/prerequisites |
| `/outreach/templates` | Review/create versioned template | Header/back → split Template library + Create template | PageHeader, StatusPill, record cards, Field | Six-control form; no overlay | ErrorPanel; empty library |
| `/outreach/sequences` | Review/create human-controlled sequence | Header/back → split Sequences + Create two-step sequence | PageHeader, StatusPill, record cards, Field | Four-control form; no overlay | ErrorPanel; empty sequences/templates |
| `/outreach/:id` | Review exact artifact; approve/send; classify response | Header → status metrics → delivery scope/content → claims/attachments → human approval/send → conditional response | PageHeader, StatusPill, detail grid, document preview, timelines | Approval/send actions + conditional response form; no overlay | Full loading/error; empty claims/attachments; provider/authority/suppression blockers |

## Commerce

| Route | Purpose; primary and secondary actions | Information hierarchy and major sections | Reusable components and data surfaces | Forms / overlays | Empty, loading, error |
|---|---|---|---|---|---|
| `/accounts` | Filter/open/export Accounts; save view | Commerce subnav → header/export → filters/saved view → account register | Shell, CommerceNav, SaveView, Empty, StatusPill, list/table | Filter controls; no overlay | Loading/error; Empty component |
| `/accounts/:id` | Review Account; update health/rationale; open related records | Commerce subnav → header/status → summary → health review → orders/reorders/protection/history | Shell, StatusPill, metrics/detail lists/timelines | Health form; no overlay | Full loading/error; collection empties |
| `/protected-accounts` | Filter/create pending rights review | Commerce subnav → header → filters/view → register → creation panel | Shell, SaveView, Empty, Field, StatusPill | Ten-control creation form; no overlay | Loading/error; empty register/prerequisites |
| `/protected-accounts/:id` | Review written basis; approve/reject/change protection | Commerce subnav → header/status → basis/scope → evidence/decision/history → action | Shell, StatusPill, detail grids/timeline | Consequential decision form; no overlay | Full loading/error; missing basis warnings |
| `/orders` | Filter/create/export Order | Commerce subnav → header/export → filters/view → register → opening-order form | Shell, SaveView, Empty, Field, line-item grids | Seventeen controls plus repeatable line items; no overlay | Loading/error; empty register/prerequisites |
| `/orders/:id` | Review revisions/lines; correct and verify statuses | Commerce subnav → header/status → summary → line items → revision history → verification/actions | Shell, StatusPill, tables/timelines, Field | Revision/status forms; no overlay | Full loading/error; empty lines/history |
| `/reorders` | Filter/open/export reorder/account-health items | Commerce subnav → header/export → filters/view → register | Shell, SaveView, Empty, StatusPill, list/table | Filter controls; no overlay | Loading/error; empty register |
| `/commissions` | Filter/open/export commission records | Commerce subnav → header/export → filters/view → register | Shell, SaveView, Empty, StatusPill, list/table | Filter controls; no overlay | Loading/error; empty register |
| `/commissions/:id` | Explain calculation/history; approve/pay/dispute | Commerce subnav → header/status → amount metrics → formula/basis → history/adjustments → actions | Shell, StatusPill, metric cards, formula, tables/timelines | Human approval/payment/dispute forms; no overlay | Full loading/error; missing evidence/basis blockers |
| `/commission-disputes` | Filter/open/export dispute cases | Commerce subnav → header/export → filters/view → register | Shell, SaveView, Empty, StatusPill | Filter controls; no overlay | Loading/error; empty register |
| `/commission-disputes/:id` | Review chronology/evidence; resolve or withdraw | Commerce subnav → header/status → claim/basis → evidence/chronology → decision/action | Shell, StatusPill, detail grid, timeline | Resolution/withdrawal forms; no overlay | Full loading/error; empty evidence/history; consequential blockers |

## AI, analytics, and utilities

| Route | Purpose; primary and secondary actions | Information hierarchy and major sections | Reusable components and data surfaces | Forms / overlays | Empty, loading, error |
|---|---|---|---|---|---|
| `/copilot` | Generate bounded suggestion; inspect history/settings | Policy banner → header/settings action → purpose form → suggestions/history | PageHeader, Field, StatusPill, record list/cards, policy callout | Four-control generation form; no overlay | Provider disabled/unavailable; Loading/ErrorPanel; empty history |
| `/copilot/:suggestionId` | Review/edit/dispose suggestion with provenance | Header → review/confidence metrics → content/reason → statements → evidence/freshness/limitations → revisions/actions | PageHeader, Field, StatusPill, metrics, editor, tables/lists | Review, edit, revision forms; no overlay | Full loading/error; empty evidence/statements/limitations |
| `/analytics` | Explore explainable metrics/views; filter/recalculate/save report | Header → freshness → nine-view subnav → filters → selected metrics/tables → external readiness | PageHeader, Field, MetricGrid, DataTable, view components, StatusPill | Date/currency filters and conditional report form; no overlay | Loading/ErrorPanel; per-table empty; external Not Connected |
| `/search` | Search authorized records; open result | Header → inline search → result list | PageHeader, Field/ARIA controls, record list | Query/type form; no overlay | Loading/error; no-results state |
| `/tasks` | Show owned work; open originating context | Header → task list | PageHeader, StatusPill, task rows | No form/overlay | Loading/error; explicit empty |
| `/imports` | Map/validate/preview/approve CSV | Header → mapping/CSV form → conditional preview/errors → conditional approval | PageHeader, Field, ErrorPanel, table/preformatted preview | Seven+ control form; post-preview approval form; no overlay | Validation errors; preview empty/invalid rows; commit success/failure |
| `/exports` | Select scoped datasets and generate audited export | Header → Select data → confirmation/controls → result/history | PageHeader, checkbox groups, alerts | 21 selectable controls/actions; no overlay | Loading/error; unavailable types; generated-result state |
| `/notifications` | Review attention items; mark read/open context | Header → ordered notification list | PageHeader, StatusPill/list rows | Direct Mark read actions; no overlay | Loading/error; empty notification state |
| `/documents` | Review register; upload immutable original to quarantine | Header → split Document register + Upload document | PageHeader, Field, StatusPill, plain list | File upload form; no overlay | Loading/error; empty register; scanner/quarantine states |
| `/sources` | Review/register provenance | Header → split Source register + Register source | PageHeader, Field, StatusPill, plain list | Three-control form; no overlay | Loading/error; empty register |
| `/territories` | Review/propose commercial scope | Header → split Territory register + Propose territory | PageHeader, Field, StatusPill, plain list | Three-control form; no overlay | Loading/error; explicit empty register |

## Cross-page state assessment

- **Dialogs/drawers:** none. All subordinate actions are inline or routed.
- **Timelines:** implemented for opportunity stages, placement stages, agreement events, message claims/attachments, account/order/commission/dispute histories, generic activities, and AI review history.
- **Charts:** no graphical chart component is implemented. Analytics uses metric cards and tables; Home uses metric cards and lists.
- **Loading:** shared spinner exists, but full-detail loading often replaces the whole page header and context.
- **Errors:** shared `role="alert"` panel is common. Field-level errors and warnings are not consistently placed or associated.
- **Empty states:** present widely, with three visual/markup variants and inconsistent next-action guidance.

