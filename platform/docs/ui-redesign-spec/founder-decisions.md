# Founder Decisions

Reversible implementation details use the recommended defaults below and do not block specification. Only decisions materially affecting identity or navigation are logged.

## FD-UI-001 — Accent direction

**Decision required:** Confirm the single Ryva accent family.

**Recommended default:** **Deep Juniper** — accent `#285B52`, hover `#214C45`, subtle `#E4EFEC`. It supports trust, restraint, the current Brand lineage, and white-text contrast.

**Alternatives (maximum three total):**

1. Deep Juniper — calm, distinctive, relationship-oriented. **Recommended.**
2. Slate Blue — `#405B7A`, analytical and neutral, less connected to current identity.
3. Deep Aubergine — `#604A63`, premium/editorial, greater risk of feeling lifestyle-oriented.

Do not combine directions or add a secondary decorative accent.

## FD-UI-002 — Light-only versus dark mode

**Recommended default:** Light-only for the first redesign.

**Alternative:** Full light and dark systems built and tested together.

**Reason:** A partial dark theme doubles semantic/contrast/surface testing and is not required by current functionality. Do not infer dark mode from OS until a complete theme exists.

## FD-UI-003 — Sidebar logo treatment

**Recommended default:** Expanded rail uses the Ryva wordmark plus small “Pro”; collapsed rail uses the existing R brand mark, redrawn only as a production asset under separate brand approval.

**Alternative:** Wordmark-only expanded and monogram collapsed.

No animated logo and no reference-derived mark.

## FD-UI-004 — Default density

**Recommended default:** Comfortable 48 px rows and 40 px controls; optional compact 40/32 mode in data registers on desktop.

**Alternative:** Compact as default for experienced operators.

Density affects display only and persists per user.

## FD-UI-005 — Motion intensity

**Recommended default:** Low motion using 120/180/240 ms tokens.

**Alternative:** Near-zero motion except overlays and loading.

No expressive/bouncy mode.

## FD-UI-006 — Process visualization

**Recommended default:** Use compact lifecycle/stepper views for the seven workflows in `workflows/`, always paired with an ordered/table alternative.

**Alternative:** Structured step lists only.

Freeform visual canvases are not an option for this release.

## FD-UI-007 — Representation placement in navigation

**Recommended default:** Representation is a first-level item in Operate, ordered before Placements.

**Alternative:** Representation as a Brand contextual workspace plus command-search destination.

**Reason for recommendation:** Authority is a daily cross-Brand prerequisite and should not become hard to discover.

## Decision recording

When the founder decides, record:

- decision ID and selected option;
- date and decision owner;
- rationale;
- affected tokens/pages;
- whether existing implementation increments must change.

Do not add committees or approval bureaucracy.

