# Page: Certification Status

## Purpose and user

Show credential standing, term, access effect, renewal, and historical verification.

## Data displayed

Credential type, masked identifier, issue/expiry, status, last verification, renewal requirement/link, grace/access state, program capability flags if approved.

## Actions

Primary: Renew / Refresh Verification.  
Secondary: view requirements, contact certification support, download permitted status record.

## Filters

Credential history period/status.

## States

- **Empty:** link credential.
- **Loading:** verification.
- **Error:** trusted cached state and expiry; safe retry.

## Permissions and responsive

User sees own record; Admin separate. Fully responsive.

## Linked records and AI

User, access events, Subscription. No AI decides status.

## Acceptance criteria

- active/expired/suspended/revoked treatment exact;
- certification not called licensing;
- grace date explicit;
- renewal restoration does not auto-send overdue work;
- provider events/history audited.

