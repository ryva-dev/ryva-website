# Journey 14: Resolve a Commission Dispute

**Trigger:** Expected/approved/paid amount, eligibility, due date, account protection, or clawback differs from evidence.

**Required records:** Commission, Order, Agreement, Protection if relevant, calculation revisions, statements/payment, communications, dispute owner/action.

## Flow

1. User opens dispute with reason, amount and initial evidence.
2. System sets Commission Disputed and preserves prior state.
3. AI may compare documents and summarize differences with citations.
4. User verifies term interpretation and prepares factual request.
5. User approves/sends/logs communication.
6. Evidence and responses append to chronology.
7. Authorized parties agree, reject, withdraw, or escalate outside Ryva.
8. User records resolution amount/rationale/source; system updates Commission through versioned event.

**Automation:** evidence-needed tasks, response deadlines, overdue alerts, case export.

**Approvals:** Human claim, communication, and resolution. Specialist legal/financial review if genuinely required.

**Success:** traceable resolution or complete evidence package for external escalation.

**Failure:** missing agreement/source, no response, ambiguous term, access/relationship ended.

**Recovery:** request evidence, correct Order/rule, use specialist route, preserve unresolved status, export case.

**Audit events:** opening, evidence, AI output, communications, status, resolution/withdrawal, amount revisions.

