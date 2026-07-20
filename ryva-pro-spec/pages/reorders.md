# Page: Reorders

## Purpose and user

Identify, prepare, track, and record responsible reorder activity for active accounts.

## Data displayed

Account, Brand, Business, Products, prior Order, last date, average verified size, expected window, qualitative likelihood, reminder, recommended follow-up, health, status, last/next action, blocking issues.

## Actions

Primary: Review Reorder / Prepare Follow-up.  
Secondary: set/defer window, mark not expected, log Contact, link new Order, update health, add task/note.

## Filters

Due/overdue/window, status, Brand, Business, Product, account health, protection state, likelihood, owner.

## States

- **Empty:** no eligible active accounts or no windows; route to Accounts/Orders.
- **Loading:** actual Order data before projections.
- **Error:** recommendation unavailable; manual review remains.

## Permissions and responsive

Representative. Mobile fully supports reorder queue, calls, notes, reminders, and linkage.

## Linked records and AI

Account, prior/new Orders, Contacts, Protection, Commissions, Tasks. AI suggests window/follow-up from actual history and labels estimates.

## Acceptance criteria

- projected window not represented as committed Order;
- unresolved service issue can block/qualify follow-up;
- opt-out and authority apply;
- new verified Order links and closes review;
- actual versus average/projected values distinct;
- all deferrals and “not expected” reasons retained.

