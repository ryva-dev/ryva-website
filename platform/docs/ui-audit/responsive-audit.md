# Responsive Audit

## Coverage

Browser checks were performed at:

- **Desktop:** 1440 × 900 across 36 list/static routes.
- **Tablet:** 900 × 1000 across representative dense workflows.
- **Mobile:** 390 × 844 across Home, Products, Placements, Outreach, Orders, Analytics, Settings, and Imports.

The application avoids document-level horizontal overflow on the inspected routes. This is largely achieved through grid collapse and local horizontal scrollers, not through mobile-specific task restructuring.

## Current breakpoint behavior

| Width | Shell | Content behavior |
|---|---|---|
| Above 900 px | 248 px sticky left sidebar, full-height scrollable nav, visible user footer | Multi-column grids and wide forms/tables |
| 621–900 px | Sticky top bar with brand and horizontally scrolling full nav; footer hidden | Major grids collapse; some two-column form/detail grids remain |
| 320–620 px | Brand row plus horizontal nav row; footer hidden | Most grids become one column; tables remain horizontal scrollers |

## Findings

| ID | Severity | Finding | Observed consequence |
|---|---|---|---|
| RESP-01 | Critical | Mobile/tablet navigation exposes the entire global hierarchy as a horizontal strip. | Destinations are off-screen with no menu, grouping, or scroll-position affordance. |
| RESP-02 | Critical | Account identity and Sign out are hidden at 900 px and below. | A core security/account action disappears from the responsive shell. |
| RESP-03 | High | Many small-screen navigation targets are below 44 px high. | At 390 px, primary links measured about 32 px high; desktop/tablet rail links are about 40 px. |
| RESP-04 | High | Dense tables remain desktop tables inside horizontal scrollers. | Users must pan to compare cells; row identity and actions can leave the viewport. |
| RESP-05 | High | Long consequential forms become very tall single-column pages. | Placement (15 controls), Orders (17+), Outreach (13 across two forms), and Export (21) require extensive scrolling with weak progress context. |
| RESP-06 | Medium | The sticky two-row mobile shell consumes persistent vertical space. | The brand row plus navigation reduces usable height on already long screens. |
| RESP-07 | Medium | Page actions adapt inconsistently. | Only `.page-action .secondary-button` becomes full width; primary buttons, status clusters, and button rows use their own behavior. |
| RESP-08 | Medium | Timelines, audit rows, metrics, and definition lists rely on generic grid collapse. | Dense metadata can wrap unpredictably; chronological scanning is not optimized for narrow screens. |
| RESP-09 | Medium | Horizontal scrollers have no visible cue that more content is available. | Navigation, subnav, and tables can appear truncated rather than scrollable. |
| RESP-10 | Medium | Touch sizing is not consistently applied to text buttons, checkboxes, links, and compact view controls. | Representative screens contained many targets below 44 px; checkboxes are approximately 16–18 px. |

## Screen-class assessment

### Desktop

Strengths:

- no observed global overflow;
- stable sidebar and main content columns;
- page width cap prevents uncontrolled line length;
- large data forms and multi-column summaries fit.

Risks:

- the sidebar itself scrolls because the link count exceeds comfortable height;
- large headings and panel padding reduce information density;
- long pages still require substantial vertical travel.

### Tablet

Strengths:

- shell becomes one column;
- split grids and metric grids generally collapse;
- filters and line items retain useful two-column arrangements where space permits.

Risks:

- 26+ links move into one horizontal strip;
- account footer disappears;
- the exact 900 px threshold creates an abrupt shell change;
- table and subnav scrolling have no explicit affordance.

### Mobile

Strengths:

- inspected pages held the 390 px document width;
- forms and detail grids collapse to one column;
- page padding reduces to 16 px;
- reduced-motion preference is respected.

Risks:

- core navigation and sign-out are not practically resolved;
- forms preserve desktop information order rather than mobile task order;
- compact controls and checkboxes miss comfortable touch sizing;
- wide data comparisons remain pan-based;
- status clusters and long enum labels can dominate narrow rows.

## State behavior

- Loading and error panels fit narrow widths, but full-page detail loading removes the page header and parent context.
- Empty states fit but often leave large visually blank panels.
- Access banners wrap, but raw access/reason strings can become long.
- Provider and authority blockers are inline sections; on long pages they may scroll away from the action they govern.

