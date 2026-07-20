# Subscription Activation

- **Route:** `/subscription/activate`
- **Current purpose:** Activate an eligible subscription through the billing provider.
- **Audit issues:** Shares Subscription UI but route purpose is not visually distinct; provider handoff interrupts context.
- **Pattern:** Settings and Administration.
- **Proposed layout:** Focused 640 px activation state inside account shell; eligibility summary, plan/terms already defined by product, provider action, return outcome.
- **Primary action:** Activate/manage billing.
- **Secondary actions:** Return to Access, view Certification.
- **Hierarchy/sections:** Eligibility → access unlocked by activation (without promise) → provider state → action.
- **Timeline/right rail/filters/table:** None.
- **Dialogs/drawers:** External handoff confirmation if necessary.
- **States:** Ineligible explains credential prerequisite; already active links to Subscription; provider unavailable preserves eligibility; loading/error retain entered/session state.
- **Permission/restricted states:** Only eligible users see activation; ineligible, revoked, suspended, or already-active states expose the corresponding safe route and no unauthorized provider action.
- **Mobile:** One column, action near eligibility result.
- **Accessibility:** External action and return behavior described; outcome announced.
- **Components:** PageHeader, StatusLabel, Alert, Button, LoadingState.
- **Consolidates/removes:** Duplicate generic plan surface while reusing Subscription primitives.
- **Complexity:** Medium.
- **Acceptance criteria:** Route and billing adapter behavior remain; no activation appears successful before provider/server confirmation.
