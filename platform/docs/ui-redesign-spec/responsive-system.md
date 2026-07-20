# Responsive System

## Breakpoints

| Name | Width | Primary model |
|---|---:|---|
| Wide desktop | ≥1440 px | expanded sidebar, split workspace, visible ContextRail |
| Desktop | 1024–1439 px | expanded/collapsed sidebar; two panes; rail may collapse |
| Tablet | 768–1023 px | collapsed rail; one/two pane; full-screen drawers |
| Mobile | <768 px | bottom navigation; full-screen task views; no squeezed desktop tables |

Breakpoints are layout thresholds, not device detection.

## Wide desktop

- 240 px sidebar by default.
- Up to three content panes: 360 px list, flexible center, 320 px context.
- Tables support full density and pinned identity.
- Page gutters 64 px, except edge-to-edge data workspaces with 32 px internal padding.
- Drawers overlay rather than compress a three-pane layout.

## Desktop

- Sidebar user preference 240/72 px.
- Split list + detail supported.
- Context rail visible only when at least 320 px center width remains; otherwise drawer.
- Dense tables, comparison, document review, sequence construction, extraction review, disputes, and analytics configuration fully supported.

## Tablet

- 72 px rail; temporary labelled expansion overlays canvas.
- Two panes only when each preserves its minimum width.
- Context always drawer.
- Tables expose prioritized columns and column control; horizontal scrolling is secondary.
- Consequential review is single central column with readiness summary first.

## Mobile navigation and canvas

- Bottom nav: Home, Tasks, Placements, Search, More.
- More is a full-height accessible sheet with grouped destinations and Sign out.
- Canvas uses 16 px gutters.
- Sticky page action sits above bottom nav, respects safe area, and does not obscure content.
- Page identity and blockers precede tabs/content.
- Drawers become full-screen routes/sheets with explicit Back/Close.

## Fully supported mobile tasks

| Task | Mobile presentation |
|---|---|
| Buyer/Contact lookup | Search → structured result → relationship summary |
| Call preparation | Contact/Placement summary + authority/risk + call action |
| Call logging | One-column outcome, notes, next action; preserved draft |
| Notes/tasks | Context drawer/sheet with origin visible |
| Stage change | Current stage, requirements, new stage, rationale, confirmation |
| Outreach approval | Exact recipient/content/claims/attachments/authority, then sticky approval |
| Reorder reminder | Account need, service history, authority, next action |
| Commission review | Currency, status, formula explanation, agreement/order links |
| Notifications/access | Full detail and required remediation |

## Desktop-first behavior on mobile

The existing product permits inspection but not an inferior miniature editor for:

- multi-record comparison;
- bulk import mapping;
- advanced saved-view/column configuration;
- sequence construction;
- agreement extraction review;
- large dispute evidence packages;
- operational audit investigation;
- dense analytics configuration.

Mobile shows a truthful read-only/limited state and the available urgent action. It never silently hides requirements.

## Pattern adaptations

- Register → structured row list with prioritized fields; filter sheet.
- Split Intelligence → list route then full-screen selected record; Back restores context.
- Relationship Detail → identity summary, tabs, inline next-action summary; ContextRail becomes sheet.
- Pipeline → stage-grouped list with Change stage action.
- Communication → conversation list then full-screen timeline/draft.
- Analytics → topline values, one chart/table at a time, definitions on demand.
- Consequential Review → one column; readiness and blockers before artifact; sticky final action.

## Reflow and touch

- No document-level horizontal overflow at 320 CSS px.
- Data artifacts may scroll only inside a labelled region with an alternative structured view.
- Minimum target 44×44 CSS px.
- Text supports 200% zoom and browser text-size changes.
- Sticky elements cannot overlap focused controls or error summaries.
- Virtual keyboard does not cover final actions.

## Performance expectations

- Shell and route identity render before deferred analytics/document preview.
- Large registers use server pagination and virtualization when needed.
- Skeletons are stable and non-animated under reduced motion.
- Images use bounded thumbnails and meaningful alt text or empty alt when decorative.

## Acceptance criteria

- All listed mobile tasks can be completed without requesting desktop mode.
- Sign out and access remediation are always reachable.
- No horizontal global nav.
- Kanban has stage-grouped list/table equivalent.
- Filters, selected view, and list position survive mobile detail navigation.
- 320 px reflow, 200% zoom, and touch-target tests pass.

