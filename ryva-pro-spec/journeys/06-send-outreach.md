# Journey 6: Prepare and Send Outreach

**Trigger:** Qualified Opportunity is ready for a professional Buyer approach.

**Required records:** Opportunity, active Agreement, qualified Business, Contact/channel/permission, Products, approved claims/materials, match thesis, no blocking conflict/risk, Prepared checklist.

## Flow

1. User opens Prepare action.
2. System assembles Buyer, Brand, Product, fit, authority, history, and risk context.
3. AI may draft personalized email/social draft/call option with evidence links and unknowns.
4. User edits and owns final content.
5. System validates recipient, permission, agreement, claims, attachments, conflict, credential, and exact version.
6. User explicitly approves and sends/schedules.
7. System queues provider send idempotently, logs result, sets Contacted only on accepted send/logged action, and creates follow-up.

**Automation:** approval request, send, provider reconciliation, follow-up, opt-out handling.

**Approvals:** Explicit final user approval of exact recipient/content/attachments/time.

**Success:** one correctly logged approved communication with next action.

**Failure:** provider failure, uncertain send, opt-out, stale Contact, expired authority/credential, conflict, invalid attachment.

**Recovery:** reconcile provider before retry; correct Contact/authority/content; manual log if sent externally; never duplicate.

**Audit events:** AI draft, edits, validation, approval hash, queue/send/provider result, stage, follow-up.

