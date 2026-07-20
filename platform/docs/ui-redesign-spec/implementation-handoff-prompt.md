# Exact Codex Prompt — Redesign Increment 1

Copy the prompt below verbatim when implementation is authorized.

---

You are continuing work inside the existing Ryva repository.

The Phase 1–9 product is complete. The UI/UX audit is in `platform/docs/ui-audit/`. The complete redesign specification is in `platform/docs/ui-redesign-spec/`.

Implement **Redesign Increment 1 — Visual tokens and shared foundations** only.

This is the first construction increment of the approved redesign. Do not migrate page layouts, navigation, routes, domain workflows, or product behavior yet.

Before editing:

1. Read `platform/docs/ui-redesign-spec/README.md`.
2. Read `design-direction.md`, `visual-tokens.md`, `typography.md`, `color-and-surfaces.md`, `spacing-and-density.md`, `accessibility-standard.md`, `interaction-and-motion.md`, `regression-protection.md`, `migration-plan.md`, and `founder-decisions.md`.
3. Read the current `apps/web/src/styles.css`, application entry, component module, test configuration, and package scripts.
4. Inspect the current worktree and preserve user-owned changes.
5. Update the implementation ledger with the exact Increment 1 scope, tests, and non-goals.

Use the recommended founder defaults unless a recorded founder decision supersedes them:

- Deep Juniper accent;
- light-only;
- comfortable default density;
- low motion.

Required outcomes:

1. Add the implementation-ready token layer exactly defined in `visual-tokens.md`, including fonts/fallbacks, type, spacing, widths, radii, neutral/accent/semantic colors, borders, shadows, icons, controls, table density, motion, and focus.
2. Establish token typing/naming appropriate to the existing TypeScript modular monolith.
3. Establish global base typography, tabular numeral utilities, focus-visible behavior, reduced-motion behavior, canvas/body defaults, and 320 px reflow foundations.
4. Add a development-only isolated token/reference page or existing test-harness stories only if it is not a production route and does not alter the application navigation.
5. Add automated tests or static checks that prevent unapproved one-off visual values in newly redesigned components while allowing legacy styling during migration.
6. Add rendered contrast checks for the specified text, accent, semantic, focus, disabled, and status combinations.
7. Preserve every existing page exactly as it behaves and is laid out today except for unavoidable globally inherited base fixes that are explicitly documented and visually regression-tested.
8. Do not delete or rename legacy CSS classes/components in this increment.

Do not:

- redesign any page;
- change the application shell or sidebar;
- migrate buttons, inputs, tables, panels, statuses, forms, or page headers yet;
- change routes, API calls, domain services, permissions, authority, evidence, AI, outreach, commerce, audit, or tests to make visual work easier;
- add dark mode;
- add a new product feature;
- use fake live data;
- copy a reference UI.

Validation:

- run the full available lint, type, unit, API, browser, and quality suite;
- run token/contrast/static-value tests;
- capture stable desktop and mobile visual baselines for the unchanged current shell and representative pages;
- verify 320 px reflow, 200% zoom, keyboard focus, and reduced motion for the base layer;
- fix all failures caused by the increment.

At completion report:

- files created and modified;
- exact tokens implemented;
- founder defaults applied;
- static/contrast/accessibility protections added;
- exact tests and results;
- any unavoidable visual differences to legacy pages;
- remaining risks;
- confirmation that no page redesign or behavior change began;
- the next increment: Shared components.

Do not stop at an outline or token list. Complete and verify Increment 1.

---

