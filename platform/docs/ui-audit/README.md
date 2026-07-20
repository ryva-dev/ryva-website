# Ryva Pro UI/UX Audit

Status: complete  
Audit date: 2026-07-20  
Product state: Phase 1–9 implementation  
Change boundary: documentation only; no product code, layout, component, route, or style was changed

## Purpose

This directory is the factual blueprint for a later redesign. It describes what exists now, how it is connected, where users encounter friction, and which visual and structural debts should inform future design work. It does not prescribe a new interface or add unimplemented product features.

## Audit basis

The audit combined:

- all 51 route patterns declared in `apps/web/src/App.tsx`;
- all 24 page source files, the shared component module, authentication shell, and 626-line stylesheet;
- browser inspection of the authenticated synthetic representative workspace;
- desktop route inspection at 1440 px;
- responsive inspection at 900 px and 390 px across Home, Products, Placements, Outreach, Orders, Analytics, Settings, and Imports;
- loading, empty, error, restricted-access, and role-gated behavior visible in code;
- the current synthetic database only. Empty datasets were not treated as proof that populated states work visually.

The Admin page was audited from its implemented source and route contract; it was not exercised as an administrator in the browser. Most detail pages had no corresponding synthetic record available, so their complete populated structure was audited from source and their loading/error contracts were inspected. These are audit limitations, not missing pages.

## Headline inventory

| Measure | Total | Counting rule |
|---|---:|---|
| Pages | **51** | Distinct navigable route patterns; parameterized record instances count as one page pattern |
| Reusable UI components/building blocks | **43** | 19 React components plus 24 implemented reusable CSS/markup patterns |
| Major workflows | **20** | End-to-end user goals, not individual form submissions |
| Identified issues | **70** | Unique IDs across Navigation (12), Information Architecture (10), Design (16), Responsive (10), Accessibility (12), and Visual Debt (10) |

## Completion language

- **Implemented** — a routed page with live API-backed behavior.
- **Implemented, conditional** — requires a role, capability, configured provider, eligible access state, or an existing record.
- **Implemented, data-dependent** — complete UI exists, but the inspected synthetic workspace did not contain a populated example.
- **Defective fallback** — a route resolves, but unsupported parameters silently render the wrong record type.

All 51 route patterns are implemented. None is a placeholder route. Two generic record routes have a defective fallback for unsupported `:type` values; see NAV-12 and IA-09.

## Issue register

The issue count is intentionally non-duplicative. A concern may be discussed in several documents, but it is counted once under its canonical ID.

| Range | Owner document | Count |
|---|---|---:|
| NAV-01–NAV-12 | `navigation-audit.md` | 12 |
| IA-01–IA-10 | `information-architecture.md` | 10 |
| DES-01–DES-16 | `design-inconsistencies.md` | 16 |
| RESP-01–RESP-10 | `responsive-audit.md` | 10 |
| A11Y-01–A11Y-12 | `accessibility-audit.md` | 12 |
| VD-01–VD-10 | `visual-debt.md` | 10 |
| **Total** |  | **70** |

## Highest-priority redesign opportunities

1. Establish task- and domain-oriented global navigation with a usable small-screen access pattern.
2. Unify the duplicate generic-record and Intelligence record experiences.
3. Create a coherent detail-page information architecture for evidence, decisions, risks, authority, work, and history.
4. Standardize list, table, filter, saved-view, empty, loading, and error patterns.
5. Make consequential workflows progressive and state-aware instead of presenting long creation/review forms in a single surface.

The complete opportunity register, including current state, impact, complexity, and priority, is in `redesign-opportunities.md`.

## Technically difficult areas for a later redesign

- The navigation shell is capability- and access-state-dependent. Reworking it affects full, read-only, blocked, admin, support, certification-only, subscription-only, desktop, and mobile states.
- Product, Brand, Business, and Contact concepts have two UI families (`/records/:type` and dedicated Intelligence routes) backed by overlapping but non-identical workflows.
- Detail pages couple many server-enforced transitions, evidence requirements, authority checks, optimistic versions, and audit events. A redesign must preserve exact action preconditions and failure reasons.
- Commerce pages share a local shell and navigation while other domains implement contextual navigation independently.
- Tables, lists, cards, timelines, metric grids, and saved views are mostly page-local compositions rather than a shared component contract.
- Responsive behavior is driven by two broad global breakpoints and long horizontal navigation; changing the shell will touch every authenticated page.
- AI, agreement, outreach, order, commission, import, export, and admin actions expose consequential review states. Their visual hierarchy cannot be changed safely without mapping server policy responses to consistent UI states.

## Documents

- `application-map.md` — every route, purpose, actor, actions, relationships, path, and completion status
- `navigation-audit.md` — global, nested, contextual, settings, and admin navigation
- `page-inventory.md` — page structure, actions, components, data displays, and states
- `component-inventory.md` — 43 implemented reusable building blocks and absent categories
- `workflow-inventory.md` — 20 major workflows and current friction
- `information-architecture.md` — placement, grouping, nesting, and relationship analysis
- `design-inconsistencies.md` — visual and terminology inconsistencies
- `responsive-audit.md` — desktop, tablet, and mobile findings
- `accessibility-audit.md` — keyboard, semantics, labels, contrast, and assistive-technology findings
- `visual-debt.md` — the unfinished qualities of the current product
- `redesign-opportunities.md` — prioritized opportunity register without implementation proposals

