# Color and Surfaces

## Palette intent

Ryva uses a warm-neutral, low-chroma workspace with one controlled accent. The recommended Deep Juniper accent connects to the existing brand without preserving the current dark-panel-heavy treatment.

## Surface hierarchy

1. **Canvas** — application background.
2. **Surface** — tables, editable forms, menus, document previews.
3. **Subtle surface** — selected rows, grouped metadata, filters, read-only areas.
4. **Overlay surface** — drawers/dialogs with elevation.

Do not create additional tinted surface families by domain.

## Border rules

Use borders for:

- table structure;
- form controls;
- editable/selectable regions;
- alert/blocker boundaries;
- document/artifact boundaries;
- drawer/dialog separation.

Do not border:

- every section;
- every metric;
- ordinary page copy;
- each timeline event unless separation is needed;
- a surface already separated by whitespace and hierarchy.

Nested bordered containers are prohibited unless the inner boundary is an actual document, selectable record, or editable form.

## Accent use

Accent is reserved for:

- primary action;
- selected navigation/tab/row;
- focus ring;
- active analytical series;
- links requiring emphasis.

Accent is not used for every icon, status, metric, or decorative background.

## Semantic state

| State | Treatment |
|---|---|
| Success/completed | success icon + authored label; pale background only in alert/label |
| Warning/review | warning icon + reason; reserved amber |
| Danger/blocked | danger icon + explicit blocker; red reserved for actual block/destructive action |
| Information | info icon + scoped explanation |
| Neutral/draft/unknown | neutral label, not gray-on-gray faint text |
| AI-generated | neutral/indigo-adjacent outline treatment plus “AI suggestion”; not a semantic truth color |
| Evidence classification | text label with restrained category marker; never confidence-by-color alone |

## Records and timelines

Selected records use `accent-subtle` and a leading marker. Timeline events use neutral separators and small type-specific icons. Communication channels do not receive saturated brand colors.

## Charts

- Default series begins with accent, then neutral slate, muted blue, muted amber, muted plum.
- No neon or rainbow palette.
- Grid lines use `border`.
- Every series has a direct label or accessible legend.
- Warning/danger colors are not reused for ordinary series if that could imply state.

## Dark mode

The recommended first redesign is light-only. Do not implement an incomplete dark theme. Founder decision FD-UI-002 records the future option.

## Acceptance criteria

- All text/control/state combinations pass WCAG 2.2 AA.
- No meaning depends on color.
- Routine content does not use shadows.
- Accent appears selectively and consistently.
- Provider unavailable, unknown, zero, and blocked remain visually distinct.

