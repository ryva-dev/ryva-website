# Notifications

## Purpose

Notifications surface time-sensitive changes, blockers, risks, and commitments. They do not duplicate every activity.

## Types

### Critical

- credential suspended/revoked;
- unauthorized or conflicting outreach blocked;
- provider/security incident affecting user;
- active Protected Account dispute;
- confirmed send with uncertain provider result;
- commission or order data integrity failure.

### Action required

- approval request;
- critical evidence missing/stale;
- Representation Agreement expiring;
- Protected Account expiring;
- commission overdue/disputed;
- import rows need correction;
- failed integration requiring reconnection;
- specialist review due.

### Time-sensitive

- follow-up due/overdue;
- Opportunity stalled;
- Buyer decision date;
- reorder window;
- task/calendar reminder;
- credential renewal milestone.

### Informational

- import/export completed;
- order/commission state update;
- AI suggestion ready;
- duplicate candidate;
- weekly priority summary.

## Channels

- in-app notification center;
- email digest;
- critical transactional email;
- optional browser notification after explicit permission.

No SMS or mobile push in first version.

## Notification object

Type, severity, title, concise reason, target link, created time, due/expiry, source event, grouping key, status, and available action.

## Behavior

- group repeated same-target notifications;
- preserve underlying events;
- read does not equal resolved;
- dismiss permitted only for non-blocking notices;
- blocking notifications resolve only when source condition resolves;
- quiet hours defer non-critical delivery;
- users configure categories, not mandatory security/credential notices;
- stale notices auto-close with reason.

## Empty state

“No action-required notifications” with links to Tasks and recent Activity. Avoid celebratory language.

## Audit

Critical and action-required notification generation, delivery, dismissal, resolution, and link target are audited.

