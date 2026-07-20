# Page: Calendar

## Purpose and user

Show time-bound tasks, calls, meetings, follow-ups, Buyer decisions, agreement/protection expiries, reorder windows, and commission due dates.

## Data displayed

Day/week/month/list views; event type, linked record, owner, time zone, status, source, preparation, conflict, reminder.

## Actions

Primary: Create Event / Open due action.  
Secondary: reschedule, complete/log, link record, set reminder, connect calendar, resolve sync conflict.

## Filters

Event type, record type, Brand/Business, owner, status, source, date.

## States

- **Empty:** connect calendar or schedule next professional action.
- **Loading:** local events first; sync status visible.
- **Error:** preserve Ryva events; explain provider degradation.

## Permissions and responsive

Representative. Mobile supports agenda/day, call/meeting prep, completion, reschedule. Month configuration desktop-first.

## Linked records and AI

Tasks, Opportunities, Contacts, Accounts, Agreements, Protection, Reorders, Commissions. AI may suggest timing; user confirms.

## Acceptance criteria

- provider sync is idempotent and time-zone safe;
- reschedule updates linked reminder without duplicating;
- external calendar event does not grant authority;
- private provider content minimized;
- expired credential disables action but preserves read-only schedule;
- activity/history audited.

