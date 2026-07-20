# Page: Subscription

## Purpose and user

Show billing entitlement and provide safe billing management.

## Data displayed

Plan, price/currency, state, current period, payment-retry/cancel date, billing provider customer reference, invoice links from provider, access consequence.

## Actions

Primary: Manage Billing in provider portal / Resolve payment.  
Secondary: cancel at period end, resume, download provider invoice, contact support.

## Filters

Invoice period/status where provider supports.

## States

- **Empty:** no subscription and eligible activation.
- **Loading:** reconcile provider state.
- **Error:** last verified state and retry; no assumed cancellation/payment.

## Permissions and responsive

User own subscription; Admin repair separately. Fully responsive.

## Linked records and AI

User and Credential. No AI.

## Acceptance criteria

- signed webhook is state source;
- cancel consequence clear;
- credential restriction remains independent;
- payment states match roles-and-access;
- portal uses server-created short-lived session;
- billing changes audited.

