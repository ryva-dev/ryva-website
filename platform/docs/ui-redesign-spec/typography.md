# Typography

## Family

Use Inter as the application sans-serif, with the system stack defined in `visual-tokens.md`. Use the mono stack only for immutable identifiers, hashes, formulas, and code-like provider references.

## Hierarchy

| Element | Token | Rules |
|---|---|---|
| Login title | 36/44 | Maximum large title; never used for ordinary app pages |
| Page title | 24/32 or 30/38 | 30 for primary workspaces; 24 for registers/settings |
| Record name | 24/32 | May wrap to two lines; status remains adjacent but separate |
| Section title | 20/28 | Compact and functional |
| Subsection title | 18/26 | Use sparingly |
| Body | 14/20 | Default product copy |
| Dense body | 13/18 | Tables, compact timelines |
| Metadata | 12/16 | Never lighter than accessible muted text |
| Group label | 11/16 | Sidebar groups only |

## Usage rules

- Sentence case for page titles, tabs, buttons, fields, statuses, and table headers.
- Entity proper names retain their authored capitalization.
- Do not capitalize Product, Brand, Buyer, Order, or Commission as generic nouns within sentences.
- One `h1` per route state; loaded, loading, error, and restricted variants retain it.
- Heading levels reflect structure, not desired size.
- Supporting descriptions are one or two lines; longer policy text belongs in a callout or help drawer.
- Avoid negative tracking except `-0.01em` on 24 px+ titles if Inter rendering requires it.
- Body text uses normal tracking.

## Numerical and commercial content

- Use `font-variant-numeric: tabular-nums lining-nums`.
- Currency includes ISO currency when ambiguity is possible.
- Never combine currencies in a single total.
- Percentages specify period/source in adjacent metadata.
- Estimated/forecast values include a visible label and, for ranges, lower–upper values.
- Dates use the user locale; precise audit timestamps include timezone on demand.
- Identifiers truncate visually with full value available to copy and to assistive technology.

## Editorial voice

Text is direct, professional, and accountable:

- “Approve exact agreement authority,” not “Looks good!”
- “No records match these filters,” not “Nothing here yet!”
- “Provider unavailable; approved email remains queued,” not “Oops.”
- “Unknown,” not an em dash when the distinction matters.
- “AI suggestion,” not “Insight” when model-generated.

## Acceptance criteria

- No app `h1` exceeds 36 px.
- Metadata meets contrast requirements and remains legible at 200% zoom.
- All financial columns align using tabular numerals.
- Statuses and enum values use authored user language, not raw underscore replacement.
- Pages do not use typography as a substitute for semantic heading structure.

