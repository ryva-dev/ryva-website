# Journey 13: Handle a Reorder

**Trigger:** Reorder window opens, Buyer requests reorder, or account review identifies replenishment need.

**Required records:** active Account, prior Order(s), Products, Contacts/Buyer, Agreement/protection, current readiness/terms, Account health, Reorder record.

## Flow

1. System creates/surfaces reorder review from historical dates and user-approved window.
2. User reviews actual orders, returns/issues, inventory, Product/Brand changes, Buyer need, protection and Contact permission.
3. AI may summarize history and draft follow-up; labels projected cadence/value.
4. User chooses contact, defer, not expected, repair issue first, or close account.
5. Approved outreach follows normal send controls.
6. Buyer response is recorded.
7. Verified subsequent Order links to Reorder, recalculates Commission and account actuals.

**Automation:** window reminder, task, current-term/evidence freshness, follow-up, new Order linkage.

**Approvals:** Human suitability and outreach; Order verification.

**Success:** responsible reorder, justified deferral/not expected, or account action with complete evidence.

**Failure:** pressure without need, unresolved issue, stale terms, expired authority/protection, opt-out, unavailable inventory.

**Recovery:** repair service, update terms/evidence, reschedule, change Product mix, end relationship, or record no reorder.

**Audit events:** window method, review decision, outreach, response, Order link, Commission, health.

