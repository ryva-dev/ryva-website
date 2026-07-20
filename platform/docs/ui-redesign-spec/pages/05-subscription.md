# Subscription

- **Route:** `/subscription`
- **Current purpose:** Display entitlement, billing provider state, renewal/paid-through dates, and management action.
- **Audit issues:** Fragmented account area; plan card visually mirrors Certification despite different policy.
- **Pattern:** Settings and Administration.
- **Proposed layout:** Account local nav + 720 px subscription section; entitlement state and access consequence first; billing details second.
- **Primary action:** Manage billing when provider configured.
- **Secondary actions:** View Access and Certification.
- **Hierarchy/sections:** Entitlement/status → access consequence → billing/period details → provider state.
- **Timeline/right rail/filters/table:** None; billing events may open AuditHistory drawer.
- **Dialogs/drawers:** Provider handoff confirmation only when required.
- **States:** Active/trial/past due/retry failed/cancel states authored separately; unavailable provider does not imply inactive entitlement; loading/error preserve status shell.
- **Permission/restricted states:** Subscription inspection/remediation remains available in permitted restricted modes; billing actions require the existing capability and never override credential restrictions.
- **Mobile:** One column, 44 px provider action.
- **Accessibility:** Status and consequence associated; external handoff clearly named.
- **Components:** PageHeader, local Tabs, StatusLabel, Alert, Button, LoadingState.
- **Consolidates/removes:** Oversized plan card; retains certification/subscription distinction.
- **Complexity:** Medium.
- **Acceptance criteria:** Subscription never overrides credential policy; all entitlement-state tests and provider-safe errors pass.
