# Certification Access Check

- **Route:** `/access`
- **Current purpose:** Explain eligibility, access mode, capabilities, and remediation.
- **Audit issues:** Access, certification, and subscription context is fragmented; reduced navigation lacks orientation.
- **Pattern:** Settings and Administration.
- **Proposed layout:** Centered 720 px account-status page with status summary, two-factor access inputs (credential/subscription), available capabilities, and ordered remediation.
- **Primary action:** The server-determined remediation: renew certification or activate/manage subscription.
- **Secondary actions:** View certification, view subscription, permitted export/support.
- **Hierarchy/sections:** Access outcome → reason → what remains available → required next step → credential/subscription detail.
- **Timeline/right rail/filters/list:** No timeline/filter/table; compact access-state stepper may show credential + subscription dependencies.
- **Dialogs/drawers:** None.
- **States:** Loading retains title; error offers retry; each active/grace/expired/suspended/revoked/subscription state has authored copy; permission scope is explicit.
- **Permission/restricted states:** The page is the canonical restricted-state surface and shows only server-permitted remediation, export/support, credential, and subscription actions for each access mode.
- **Mobile:** One column; remediation action sticky only when it does not obscure policy copy.
- **Accessibility:** Status heading, reason text, non-color state, ordered remediation, focus on outcome after redirect.
- **Components:** PageHeader, Banner, StatusLabel, Alert, Button, LoadingState.
- **Consolidates/removes:** Duplicate state prose while keeping Certification and Subscription as distinct records.
- **Complexity:** Medium.
- **Acceptance criteria:** Every existing access matrix outcome, capability, export/legal-hold restriction, and remediation route remains exact.
