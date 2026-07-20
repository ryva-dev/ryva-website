# Accessibility Audit

## Method and boundary

This is a code and browser-structure audit, not a formal WCAG conformance claim. It reviewed landmarks, headings, labels, roles, keyboard-visible focus, responsive focus burden, state announcements, control names, and likely contrast concerns. No assistive-technology user study or automated contrast suite was run.

## Existing strengths

- A visible-on-focus “Skip to content” link targets `#main-content`.
- Authenticated pages use an `aside`, a labelled primary `nav`, and `main`.
- A global `:focus-visible` outline is defined.
- `Field` wraps controls in real labels.
- Loading uses `role="status"` and `aria-live="polite"`.
- ErrorPanel uses `role="alert"`.
- Decorative spinner and audit dot are hidden from assistive technology.
- Buttons and links are generally native elements.
- Reduced-motion preference is respected.
- Status indicators include text, not color alone.
- Browser inspection of 36 representative routes found no unlabelled standard form controls using the basic label/ARIA heuristic.

## Findings

| ID | Severity | Area | Finding | Impact |
|---|---|---|---|---|
| A11Y-01 | High | Keyboard navigation | The 26+ item mobile/top navigation creates a long focus sequence before page content. | Skip link helps entry to main, but returning to or traversing navigation remains burdensome. |
| A11Y-02 | High | Focus/order | Horizontally off-screen navigation can receive focus without a strong scroll-position or menu context. | Keyboard and low-vision users may lose orientation as the strip scrolls. |
| A11Y-03 | High | Labels/help | `Field` hints are visual text but are not associated with controls through `aria-describedby`. | Screen-reader users may miss critical evidence, approval, and formatting instructions. |
| A11Y-04 | Medium | Accessible names | Repeated controls such as “Refresh,” “Revoke,” and “Mark read” have identical names without record/section context. | Control purpose is ambiguous in rotor/control lists. |
| A11Y-05 | Medium | Tables | Tables do not declare captions and headers do not explicitly use `scope`. | Complex operational tables lack an announced purpose and stronger header associations. |
| A11Y-06 | Medium | Tabs/navigation | Analytics view buttons visually act as tabs but do not expose tab semantics or `aria-pressed`/`aria-current`. | Current view state may not be announced. |
| A11Y-07 | High | Error handling | Most errors are page-level alerts; field-level invalid state, error association, and focus movement are not systematic. | Users may hear an error but not know which field must change. |
| A11Y-08 | Medium | Headings/landmarks | Full-detail loading/error returns can omit the normal page header and route context; long pages have no section navigation. | Heading-based navigation and orientation change between states. |
| A11Y-09 | Medium | Contrast | Muted small text, disabled text, quiet tags, and translucent sidebar text warrant measured contrast verification at their actual backgrounds/sizes. | Several essential metadata strings use small type and muted color close to normal-text thresholds. |
| A11Y-10 | High | Target size | Many nav links, text buttons, compact selects, and checkboxes are below 44 × 44 CSS px. | Motor and touch users have reduced accuracy, particularly on mobile. |
| A11Y-11 | Medium | Status announcements | Status changes after consequential actions are mostly represented by refreshed pills/content rather than a consistent live confirmation region. | Screen-reader users may not receive immediate confirmation after async actions. |
| A11Y-12 | Medium | Dialog accessibility | There are no dialogs, so no dialog defects exist; however, destructive and consequential inline actions lack a consistent confirmation/focus-return model. | Accidental activation risk and post-action orientation vary by page. |

## Keyboard navigation

Native controls provide baseline keyboard access. No custom keyboard handlers or non-semantic click targets were found in the inspected shared patterns. The main risks are quantity and order: a large global navigation, long forms, repeated action clusters, and deeply stacked panels create high Tab counts. Horizontal nav and tables also require two-dimensional visual orientation that is not explicitly conveyed.

## Focus order and management

DOM order generally follows visual order. There is no modal focus trap because there are no dialogs. Route changes and async state replacements do not visibly include a centralized focus-to-heading policy. Detail pages that replace their entire content with Loading/ErrorPanel can produce a different focus/heading structure from the resolved page.

## Labels and instructions

Most inputs are labelled through `Field`, explicit wrapping labels, or `aria-label`. Exceptions are avoided in most current routes, but label quality varies:

- generic “Reason,” “Status,” and “Name” labels depend heavily on surrounding visual context;
- placeholder text is used as supplementary instruction in saved-view and AI fields;
- hints are not programmatically connected;
- raw enum options are transformed mechanically rather than authored for comprehension.

## Landmarks and headings

The authenticated shell has useful primary landmarks. Pages consistently use one `h1` through PageHeader when loaded. Section headings are mostly `h2`, with occasional `h3` inside sections. There is no breadcrumb landmark, no section navigation on long operational pages, and no explicit current-page announcement beyond active-link styling.

## Contrast

The core dark forest on paper and white on forest combinations appear strong. Areas requiring formal measurement include:

- `--muted` at small sizes on paper and tinted panels;
- `rgba(255,255,255,.48)` sidebar footer metadata;
- disabled control text on gray;
- 0.68rem status text on pale fills;
- quiet tags and fine print;
- translucent navigation text in all hover/active states.

Contrast should be evaluated by rendered state and font size; this document does not assert a failure without measurement.

## Screen-reader and ARIA concerns

- Raw status text is readable, but its relationship to the record/metric is sometimes only visual.
- Repeated lists often use generic `div`/`article` structures without an announced list.
- Analytics view state is visual only.
- Table purpose and horizontal-overflow instructions are absent.
- Provider/authority blockers use alert/status roles inconsistently.
- No dialog ARIA is required today because no dialog exists.

