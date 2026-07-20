# Increment 1 Implementation — Visual Foundations

Status: implemented  
Scope: design tokens and global visual foundations only

## Implemented

- Canonical CSS token layer at `apps/web/src/design/tokens.css`.
- Typed TypeScript token contract at `apps/web/src/design/tokens.ts`.
- Deep Juniper light-theme palette with neutral, semantic, analytical, and focus colors.
- Typography, spacing, sizing, widths, radii, borders, elevation, icons, controls, motion, z-index, breakpoints, and responsive-spacing tokens.
- Global base font, canvas, text, tabular numeral, focus-visible, and reduced-motion foundations.
- Compatibility aliases for the existing Phase 1–9 stylesheet.
- Static guard for future redesign-system files.
- Unit coverage for token synchronization, contrast, and visual anti-pattern exclusions.

## Explicitly not implemented

- Shared redesigned components.
- Navigation or application-shell changes.
- Page, layout, workspace, form, table, status, or interaction migration.
- Dark mode.
- New routes or product behavior.

## Legacy boundary

`apps/web/src/styles.css` remains the Phase 1–9 page/component stylesheet. Its existing arbitrary values and historical gradient remain migration debt and are intentionally outside the new static guard. New redesign work must live in `apps/web/src/design-system/` or `apps/web/src/redesign/` and consume approved tokens.

## Founder defaults applied

- Accent: Deep Juniper.
- Theme: light-only.
- Density: comfortable foundation, with compact and touch tokens available.
- Motion: low, capped at 240 ms and reduced to near-instant by user preference.

