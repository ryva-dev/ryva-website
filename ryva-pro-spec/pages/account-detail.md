# Page: Account Detail

## Purpose and user

Manage the ongoing Brand–Business commercial relationship after an opening order.

## Data displayed

Header: Brand, Business, Representative, status/health, protection, opening date, last Order, reorder window, commission summary, next action, risks.  
Tabs: Overview; Contacts; Products; Orders/returns; Reorders; Commissions/disputes; support/issues; outreach/activity; protection/agreement; documents; notes/tasks/history.

## Actions

Primary: Perform next account action / Review Reorder.  
Secondary: log support, add Contact/task/note, record Order, update health with rationale, open dispute, renew/release protection, pause/end relationship.

## Filters

Activity type/date; Product; Order/commission state; Contact; issue; document.

## States

- **Empty:** missing Contact, protection, order documentation, or next action.
- **Loading:** relationship/protection/next action first.
- **Error:** financial/protection failure labeled and consequential action blocked.

## Permissions and responsive

Representative. Mobile supports lookup, calls, notes, tasks, health, reorder and commission review.

## Linked records and AI

Business, Brand, Agreement, Protection, Products, Orders, Reorders, Commissions, Contacts. AI summarizes relationship and suggests reorder/support actions with actual/estimate separation.

## Acceptance criteria

- Account created only from verified opening Order or approved historical import;
- one opening Order identified;
- health changes have rationale;
- account end does not cancel earned commissions;
- protection expiry visible;
- all relationship activity retained.

