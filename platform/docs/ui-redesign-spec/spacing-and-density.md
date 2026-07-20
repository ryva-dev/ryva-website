# Spacing and Density

## Principle

Calm density keeps professional information visible while removing decorative enclosure and oversized whitespace.

## Page spacing

| Context | Wide desktop | Desktop | Tablet | Mobile |
|---|---:|---:|---:|---:|
| Horizontal gutter | 64 px | 48 px | 32 px | 16 px |
| Header to controls | 24 px | 24 px | 20 px | 16 px |
| Major section gap | 40 px | 32 px | 32 px | 24 px |
| Related subsection gap | 24 px | 24 px | 20 px | 16 px |
| Field vertical gap | 16 px | 16 px | 16 px | 16 px |

## Density modes

- **Comfortable:** 48 px table rows, 40 px controls; default.
- **Compact:** 40 px table rows, 32 px filters; user-selectable in data registers on desktop.
- **Touch:** minimum 44 px interactive height; required below 768 px.

Density is a per-user display preference, not a way to hide columns or information.

## Tables

- Cell horizontal padding: 12 px compact, 16 px comfortable.
- Header height: 40 px.
- Identity cell gets strongest weight; metadata stays close.
- Financial columns right-align.
- Row actions occupy one predictable trailing column.
- Groups use 24 px separation or a labelled group row, not independent cards.

## Forms

- Reading/editing width: 720 px.
- Two columns only when fields are short and logically paired.
- High-consequence fields use one column with help/evidence adjacent.
- Field groups use a heading and 24 px gap.
- Final approval has at least 32 px separation from ordinary editing controls.
- Long creation flows reveal sections according to existing prerequisite state rather than displaying unrelated fields at once.

## Cards

Cards are justified only for:

- Placement Kanban items;
- compact templates/sequences;
- Home exceptions requiring emphasis;
- optional summary selection where items are not naturally tabular.

Cards use 16 px padding, 8 px radius, and at most one subtle shadow. They never contain another routine card.

## Whitespace increases

- record identity and relationship line;
- legal ambiguity;
- authority and suppression blockers;
- human approval/disposition;
- commission/payment consequence;
- transition confirmation;
- empty setup explanation.

## Whitespace decreases

- register rows;
- timelines;
- comparison tables;
- audit histories;
- related-record lists;
- filter bars;
- metric definitions.

## Acceptance criteria

- No ordinary page begins with more than 120 px of title/description space.
- No register defaults to cards when rows are comparable.
- No high-consequence action is visually crowded into a dense table row.
- 200% zoom preserves reading order and does not overlap sticky elements.
- Mobile controls meet 44 px minimum target size.

