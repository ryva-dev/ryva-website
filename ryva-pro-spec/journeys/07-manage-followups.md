# Journey 7: Manage Follow-ups

**Trigger:** Outreach sent, conversation open, material sent, Buyer timing set, or user creates follow-up.

**Required records:** Contact, Opportunity, prior Activity, permission/opt-out, next action/task, stage, sequence if used.

## Flow

1. System creates or surfaces due follow-up based on approved rule or user date.
2. User reviews prior communication, Buyer context, current stage, risks, and whether follow-up remains appropriate.
3. AI may summarize history and propose new-value follow-up or recommend no follow-up.
4. User drafts/edits, selects channel, and approves exact action.
5. System sends/logs, updates task, monitors reply and stops sequence as appropriate.
6. User records response, next action, defer, close lost, or disqualify.

**Automation:** due/overdue reminders, sequence step preparation, reply/opt-out stop, stalled flag.

**Approvals:** Every external follow-up; human close/disqualify.

**Success:** relevant follow-up or defensible decision not to contact, with updated next action.

**Failure:** over-contact, opt-out, stale authority, generic sequence, provider failure, no response after cadence.

**Recovery:** stop sequence, correct permission, choose different channel only if lawful/appropriate, close loop, reconcile provider.

**Audit events:** task, draft/approval/send, sequence eligibility, reply, opt-out, defer/close decision.

