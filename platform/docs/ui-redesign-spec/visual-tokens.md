# Visual Tokens

These values are implementation defaults. They are intentionally small in number and must be expressed as CSS custom properties or typed theme constants. Component code may not introduce one-off colors, spacing, radii, or shadows without design review.

## Font

```css
--font-sans: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
```

Inter is the recommended application family. If it is not self-hosted, the system stack must remain fully usable without layout shift. No decorative display font is used inside the product.

## Type scale

| Token | Size / line | Weight | Use |
|---|---|---:|---|
| `--text-11` | 11 / 16 px | 600 | navigation group labels only |
| `--text-12` | 12 / 16 px | 500–650 | metadata, table headers |
| `--text-13` | 13 / 18 px | 400–600 | compact controls/table content |
| `--text-14` | 14 / 20 px | 400–650 | default UI body |
| `--text-16` | 16 / 24 px | 400–650 | emphasized body |
| `--text-18` | 18 / 26 px | 600 | subsection title |
| `--text-20` | 20 / 28 px | 600 | section title |
| `--text-24` | 24 / 32 px | 600 | compact page title |
| `--text-30` | 30 / 38 px | 600 | primary workspace title |
| `--text-36` | 36 / 44 px | 600 | login/exception-only title |

Weights: 400 regular, 500 medium, 600 semibold, 700 only for rare emphasis. Tabular numerals are required for dates, currency, percentages, counts, and durations.

## Spacing

`--space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-5: 24px; --space-6: 32px; --space-7: 40px; --space-8: 48px; --space-9: 64px;`

No 20 px token. Use 16 or 24 to maintain rhythm.

## Widths

| Token | Value |
|---|---:|
| expanded sidebar | 240 px |
| collapsed sidebar | 72 px |
| narrow drawer | 400 px |
| standard drawer | 520 px |
| wide drawer | 680 px |
| context rail | 320 px |
| reading/form width | 720 px |
| consequential review | 960 px |
| workspace maximum | 1440 px |

## Radii

| Token | Value | Use |
|---|---:|---|
| `--radius-1` | 4 px | compact labels, table selection |
| `--radius-2` | 6 px | controls, buttons |
| `--radius-3` | 8 px | menus, alerts, panels |
| `--radius-4` | 12 px | dialogs/drawers only where visually bounded |
| `--radius-pill` | 999 px | status labels and avatar only |

## Neutral surfaces and text

```css
--canvas: #F6F7F5;
--surface: #FFFFFF;
--surface-subtle: #F0F3F0;
--surface-hover: #EAEEEB;
--surface-selected: #E5EFEC;
--text-strong: #17211F;
--text-default: #2F3A37;
--text-muted: #5E6B67;
--text-subtle: #74807C;
--border: #DCE2DE;
--border-strong: #C5CEC8;
```

## Recommended accent: Deep Juniper

```css
--accent: #285B52;
--accent-hover: #214C45;
--accent-pressed: #1A403A;
--accent-subtle: #E4EFEC;
--accent-text: #1F5048;
```

This is the recommended founder default. Alternatives are logged in `founder-decisions.md`.

## Semantic colors

```css
--success: #287652;
--success-bg: #E8F4ED;
--warning: #8A6116;
--warning-bg: #FFF4D6;
--danger: #A83C3C;
--danger-bg: #FBEAEA;
--info: #365F88;
--info-bg: #EAF1F8;
--neutral-state: #56625E;
--neutral-state-bg: #EEF1EF;
```

All semantic combinations must meet WCAG 2.2 AA for their rendered text size. Icons/text always accompany color.

## Borders and shadows

```css
--border-width: 1px;
--shadow-menu: 0 8px 24px rgba(23, 33, 31, 0.10);
--shadow-dialog: 0 16px 48px rgba(23, 33, 31, 0.16);
--shadow-card: 0 1px 2px rgba(23, 33, 31, 0.06);
```

Routine panels use no shadow. `--shadow-card` is restricted to interactive summary/Kanban cards. Menus, drawers, and dialogs may use elevation.

## Icons and controls

| Token | Value |
|---|---:|
| icon small | 14 px |
| icon default | 18 px |
| icon large | 20 px |
| compact control | 32 px |
| default control | 40 px |
| touch control | 44 px minimum |
| default table row | 48 px |
| compact table row | 40 px |

Icon stroke is 1.75 px at 18 px. Consequential icon buttons require visible text or an adjacent label.

## Motion

```css
--duration-fast: 120ms;
--duration-standard: 180ms;
--duration-slow: 240ms;
--ease-standard: cubic-bezier(0.2, 0, 0, 1);
--ease-exit: cubic-bezier(0.4, 0, 1, 1);
```

No transition exceeds 240 ms for routine interaction.

## Focus

```css
--focus-color: #3B6E65;
--focus-ring: 0 0 0 2px #FFFFFF, 0 0 0 4px var(--focus-color);
```

Focus is never removed. On dark/accent surfaces the inner ring changes to the local surface color.

