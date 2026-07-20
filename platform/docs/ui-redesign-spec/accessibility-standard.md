# Accessibility Standard

Ryva targets WCAG 2.2 AA as a release requirement, not a later enhancement.

## Keyboard

- Every action is operable without pointer or drag.
- Logical Tab order follows visual reading order.
- Skip link moves to main content; additional skip links may target register results on dense pages.
- Command dialog uses arrows for results, Enter to open, Escape to close.
- Tabs implement correct arrow/Home/End behavior when true in-page tabs.
- Kanban stage movement has a menu/form alternative and an equivalent table.
- Drawers/dialogs trap focus; close restores the invoking control.

## Focus

- Use the tokenized 2+2 px focus ring.
- Do not suppress focus because mouse users also see hover.
- Opening a route focuses the `h1` only when navigation was user initiated and doing so does not interrupt typing.
- Validation focuses an error summary; following links move to the invalid field.
- Async success does not unexpectedly move focus.

## Landmarks and headings

- One `main`, one primary `nav`, optional labelled complementary ContextRail.
- One `h1` in loaded, loading, error, empty, restricted, and permission states.
- Headings do not skip levels.
- Breadcrumbs use a labelled navigation landmark.
- Long Settings/Admin pages include a labelled local navigation.

## Forms and errors

- Every control has a persistent visible label.
- Help and errors use `aria-describedby`.
- Required state is conveyed in text/semantics.
- Long forms provide a focusable error summary.
- Recoverable errors preserve all data and selected files when technically safe.
- Consequential approval is never preselected.
- Disabled actions expose their prerequisite in adjacent text; tooltips are supplemental.

## Tables and registers

- Table caption or accessible label names the dataset.
- Column headers use scope and sort state.
- Selection header announces none/some/all current-result selection.
- Row action names include record identity.
- Pagination exposes current page and total when known.
- Responsive structured rows retain all priority data and a full detail route.

## Overlays

- Dialog/drawer title is referenced by `aria-labelledby`.
- Description/consequence is referenced when needed.
- Background is inert.
- Escape closes unless a non-interruptible server commit is in progress; in that case status is announced.
- Unsaved-close confirmation is itself accessible.
- Mobile full-screen sheets retain equivalent semantics and focus return.

## Status and announcements

- Color never carries meaning alone.
- Status changes include authored text.
- Loading uses `aria-busy` on the affected region.
- Non-critical success uses polite announcement.
- New blocker, permission failure, or destructive failure uses assertive alert only when immediate.
- Toasts never contain the only record of an important change.

## Charts and workflow views

- Every chart has a title, plain-language summary, data table, sources/freshness, and keyboard-accessible values.
- Series are distinguished by labels/pattern/shape as well as color.
- Kanban has an equivalent Table.
- Lifecycle visualization has an ordered step list with the same current/completed/blocked/next information.

## Content and media

- Entity images have meaningful alt text when they convey identity; decorative images use empty alt.
- Icons have accessible names only when interactive or semantically necessary.
- Dates, currency, and percentages have unambiguous accessible text.
- Status abbreviations are expanded.

## Zoom, reflow, and motion

- Reflow at 320 CSS px.
- Text resize to 200% without loss.
- Target size minimum 24×24 per WCAG, with Ryva product target 44×44 for touch.
- `prefers-reduced-motion` removes movement and shortens fades to near-instant.
- No continuously moving content.

## Verification gate

Every migrated page requires:

1. automated axe-equivalent test with no serious/critical violation;
2. keyboard-only journey;
3. screen-reader smoke test for headings, labels, states, and primary action;
4. 200% zoom and 320 px reflow;
5. contrast verification from rendered values;
6. reduced-motion test;
7. table/Kanban/chart alternative verification where applicable.

