# Page: Notifications

## Purpose and user

Provide one triaged list of critical, action-required, time-sensitive, and informational events.

## Data displayed

Severity, type, title, reason, linked record, created/due time, source, grouped count, status, available action.

## Actions

Primary: Open/Resolve source action.  
Secondary: mark read, dismiss permitted item, adjust non-mandatory preferences, view underlying events.

## Filters

Unread, severity, type, due, record type, resolved/dismissed, period.

## States

- **Empty:** no action-required notices; link Tasks/recent Activity.
- **Loading:** grouped skeleton.
- **Error:** critical delivery issue shown through fallback banner/email where possible.

## Permissions and responsive

User-specific; fully mobile supported.

## Linked records and AI

All source records. AI may summarize grouped events but cannot change source status.

## Acceptance criteria

- read and resolved distinct;
- blocking notice cannot be dismissed;
- groups preserve underlying events;
- quiet hours exclude critical security/access;
- links obey permissions;
- state audited where material.

