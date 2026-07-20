# Page: Contact Detail

## Purpose and user

Manage a professional Contact's identity, role, authority, communication permission, activity, and relationship context.

## Data displayed

Name, Business/Brand, professional channels, source, verification, role and Buyer authority, freshness, opt-out/preferences, active Opportunities/accounts, last/next activity, full communication timeline, notes and tasks.

## Actions

Primary: Verify Contact / Prepare approved communication.  
Secondary: edit role, log call/email/note, set opt-out, add task, link Opportunity, merge duplicate, mark stale/inactive.

## Filters

Timeline type/date/direction; linked Opportunity; channel; task status.

## States

- **Empty:** no verified channel or authority with next verification step.
- **Loading:** identity and permission state first.
- **Error:** if permission/opt-out state unavailable, sending is blocked.

## Permissions and responsive

Representative; support access ticket-scoped. Mobile fully supports lookup, call, note, task, and final outreach review.

## Linked records and AI

Business/Brand, Buyer role, Opportunities, Accounts, Emails, Calls, Tasks, Evidence. AI may suggest role, verification steps, call prep, draft and summary; user confirms.

## Acceptance criteria

- source and freshness visible;
- AI/enrichment cannot mark Contact verified;
- opt-out immediately blocks affected channel and sequences;
- authority is context-specific;
- all messages/calls log against correct Contact and parent record;
- duplicate merge preserves opt-out and history.

