# Journey 11: Register a Protected Account

**Trigger:** Opening Order or Agreement condition supports documented account protection.

**Required records:** Account, Brand, Business, Representative, active Agreement, protection clause/source, Product/channel/territory scope, dates, commission/reorder rights, approver.

## Flow

1. System creates draft from Agreement/Order or user starts registration.
2. AI may extract proposed fields from supporting documents.
3. User verifies source, scope, origin, term, rights, expiry/renewal/release.
4. System checks overlapping active/pending protection and territory/account rules.
5. Conflict opens review and blocks affected outreach.
6. Authorized human approves or rejects exact draft.
7. System activates protection, schedules expiry alerts, and links Account/Orders/Commissions.

**Automation:** extraction, overlap check, expiry reminders, expiry state.

**Approvals:** Required human approval; Admin only for policy-authorized conflict/repair.

**Success:** active scoped record accurately reflecting underlying agreement.

**Failure:** no supporting right, conflicting claim, unclear scope/date, expired agreement, unauthorized approver.

**Recovery:** request clarification/amendment, narrow scope, resolve dispute, reject draft, or retain ordinary Account without protection.

**Audit events:** source/version, extraction/edit, conflict inputs, approval/rejection, activation, renewal/expiry/release.

