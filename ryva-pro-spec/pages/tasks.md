# Page: Tasks

## Purpose and user

Manage owned next actions, commitments, evidence work, approvals, follow-ups, account support, reorders, and commission reconciliation.

## Data displayed

Title, parent record, owner, due date/time, priority, status, source/trigger, recurrence, blocker, required evidence, completion history, related stage/risk.

Views: My Day, Upcoming, Overdue, Blocked, Completed, All; list/table and grouped by date/record.

## Actions

Primary: Complete or Create Task.  
Secondary: assign, reprioritize, reschedule, block/unblock, recur, add evidence/note, cancel, reopen.

## Filters

Status, due date, priority, source, Brand/Product/Business/Opportunity/Account, task type, owner, blocked/overdue.

## States

- **Empty:** context-specific next action; not celebratory.
- **Loading:** group skeleton.
- **Error:** preserve edits; completion failure not shown as complete.

## Permissions and responsive

Representative; future assignments only within workspace. Fully supported mobile.

## Linked records and AI

Every professional object. AI may propose task/title/due rationale but cannot create unless user accepts or an approved deterministic automation applies.

## Acceptance criteria

- every active Opportunity has a valid next action or explicit blocker;
- completed task preserves evidence/time;
- recurring task creates occurrences, not silent due-date mutation;
- mandatory gate task cannot be canceled without resolving source condition;
- overdue and time-zone behavior correct;
- history audited.

