# Create Product Comparison

- **Route:** `/products/compare`
- **Current purpose:** Define an aligned comparison context without scoring.
- **Audit issues:** Sparse dedicated form with weak return context; six fields appear without selected Product orientation.
- **Pattern:** Register — focused form.
- **Proposed layout:** 720 px form with selected Products summary above comparison context; explicit Back to preserved Product view.
- **Primary action:** Create comparison.
- **Secondary actions:** Change selected Products, cancel/back.
- **Hierarchy/sections:** Selected Products (2–4) → required context (channel/period) → optional context → limits statement → create.
- **Timeline/right rail/filters/table:** Compact selected-record table; no timeline/right rail/filter.
- **Dialogs/drawers:** Product selection drawer may reuse current selection data; no confirmation dialog.
- **States:** Missing/invalid selection explains requirement; loading selected records; validation preserves context; read-only blocks creation with reason.
- **Permission/restricted states:** All selected Products must be workspace-visible; comparison creation requires the existing mutation capability, while read-only/restricted users may return without losing selection.
- **Mobile:** Two-record summary and one-column context; multi-product analysis remains desktop-first but creation can be completed.
- **Accessibility:** Selected list announced; required fields and no-ranking limitation associated.
- **Components:** PageHeader, Table/DataRow, Input, Combobox/MultiSelect, Alert, Button, ErrorState.
- **Consolidates/removes:** Unoriented standalone panel.
- **Complexity:** Medium.
- **Acceptance criteria:** Context requirements and 2–4 limit stay exact; comparison never generates ranking/score; Product list context returns intact.
