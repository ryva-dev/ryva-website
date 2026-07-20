# Page: Subscription Activation

## Purpose and user

Activate the Ryva Pro subscription after credential verification. Primary user is an eligible certified Representative.

## Data displayed

Selected plan, price, billing period, taxes/total supplied by billing provider, trial if approved, renewal behavior, cancellation terms, credential dependency, payment state.

## Actions

Primary: Continue to secure checkout / Confirm activation.  
Secondary: Change plan if multiple plans exist, return to credential status, contact billing support.

## Filters

None.

## States

- **Empty:** eligible plan and product access explanation.
- **Loading:** checkout creation or webhook reconciliation.
- **Error:** payment failure, abandoned checkout, webhook delay, or ineligible credential with recovery.

## Permissions and responsive

Only eligible authenticated user. Admin may issue policy-authorized access separately. Responsive single-column summary and provider-hosted checkout.

## Linked records and AI

Links Certification Status, Subscription, terms, privacy. No AI.

## Acceptance criteria

- checkout amount and plan determined server-side;
- signed webhook is source of billing activation;
- duplicate checkout/webhook cannot duplicate subscription;
- credential restriction overrides payment success;
- activation and failure are audited.

