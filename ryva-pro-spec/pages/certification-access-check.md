# Page: Certification Access Check

## Purpose and user

Verify that an authenticated person holds an eligible active Ryva certification and explain any restriction. Primary user is a certified or certification-seeking Representative.

## Data displayed

Credential type, masked number, provider, verification time, issue/expiry, status, access consequence, renewal link, and support reference.

## Actions

Primary: Verify credential or Continue to subscription/Home.  
Secondary: Correct identifier, refresh status, renew, request support, access permitted export during grace.

## Filters

None.

## States

- **Empty:** enter credential identifier or link verified certification account.
- **Loading:** provider verification in progress with no access assumption.
- **Error:** provider unavailable preserves prior trusted state until its expiry; unverified new user remains blocked; explain retry/support.

## Permissions and responsive

Authenticated user sees only own credential. Admin uses separate console. Mobile-first single flow.

## Linked records and AI

Links to Certification Status, renewal, Subscription activation, and support. No AI decides status.

## Acceptance criteria

- only trusted provider response/state activates access;
- expired, suspended, and revoked behavior matches roles-and-access;
- repeated provider events are idempotent;
- status and access decisions are audited;
- page never represents certification as government licensing.

