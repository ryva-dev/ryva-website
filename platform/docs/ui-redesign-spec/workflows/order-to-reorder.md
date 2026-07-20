# Opening Order to Reorder Continuity

- **Purpose:** Explain how verified commercial records connect without conflating order, account, protection, commission, and reorder decisions.
- **Used on:** Order, Account, Reorder, Commission details and commercial summaries.
- **Nodes:** Opening Order recorded → Exact revision human verified → Account created → Protection reviewed separately if written basis exists → Estimated Commission calculated → Commission human-reviewed/approved/payable/paid → Reorder review scheduled → Subsequent Order verified → New Commission/adjustments.
- **Completed state:** Each record-specific event is complete and linked; one completion never auto-completes another human decision.
- **Current state:** Earliest actionable incomplete continuity step for this relationship.
- **Blocked state:** Missing evidence/revision, no Agreement rule, invalid authority, payment/fulfillment uncertainty, protection ambiguity, missing human decision.
- **Required next action:** Verify Order, review Protection, review Commission, support Account, or review Reorder need.
- **Visual form:** Connected linear continuity with independent branch labels for Protection and Commission.
- **Accessibility alternative:** Relationship table with record, status, evidence, owner, date, next action.
- **Mobile alternative:** Vertical continuity summary with amounts/currency and current action.
- **Acceptance criteria:** Idempotent/transactional links, immutable revisions, currency separation, separate human approvals and audit remain.

