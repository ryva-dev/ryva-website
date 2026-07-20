# Profile

- **Route:** `/profile`
- **Current purpose:** Maintain representative identity, business, contact, locale, and time zone.
- **Audit issues:** Twelve-field generic panel; account controls split across global navigation.
- **Pattern:** Settings and Administration.
- **Proposed layout:** Account local nav; 720 px form grouped as Identity, Business, Contact, Regional settings.
- **Primary action:** Save profile.
- **Secondary actions:** None; account destinations remain local nav.
- **Hierarchy/sections:** Identity → professional/business → contact → locale/time zone → save status.
- **Timeline/right rail/filters/table:** None.
- **Dialogs/drawers:** Unsaved-change confirmation on route exit.
- **States:** Stable loaded form; inline + summary validation; save success; error preserves all fields; read-only explains reason.
- **Permission/restricted states:** Profile fields render according to profile capability; read-only/restricted modes allow only policy-permitted inspection and explain why Save is unavailable.
- **Mobile:** One column; sticky Save only when dirty.
- **Accessibility:** Autocomplete, correct input types, help associations, first-error focus.
- **Components:** PageHeader, local Tabs, Input, Select/Combobox where existing values allow, Button, Alert, Toast.
- **Consolidates/removes:** Single undifferentiated form panel and current Field inconsistencies.
- **Complexity:** Low.
- **Acceptance criteria:** Every current field and validation persists; optimistic concurrency and audit behavior remain.
