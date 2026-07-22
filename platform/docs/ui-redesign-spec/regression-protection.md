# Regression Protection

## Non-negotiable boundaries

The redesign changes presentation and interaction structure only. It must preserve:

- routes and deep links;
- authentication/session/CSRF/rate-limit behavior;
- credential/subscription access modes;
- capabilities, roles and workspace isolation;
- immutable evidence/document provenance;
- human qualification and approval;
- authority and conflict validators;
- outreach suppression and exact-artifact approval;
- Orders, revisions, Accounts, protection, Reorders, Commissions and disputes;
- AI provenance/review boundaries;
- import/export scoping and audit;
- append-only audit events and job behavior.

## Test layers

### 1. Existing Phase 1–9 suite

The full current unit, API authorization, integration, browser journey and quality suite is the primary functional gate. No snapshot approval can override a failing domain test.

### 2. Component contracts

For every component:

- rendered variants/states;
- keyboard behavior;
- accessible name/description;
- loading/error/read-only;
- responsive sizes;
- token usage;
- no critical axe-equivalent violation.

### 3. Route state matrix

Each migrated route is tested in:

- populated;
- empty/no record;
- no filter result;
- loading;
- API error;
- read-only/grace;
- blocked/revoked where applicable;
- provider unavailable;
- stale/partial;
- unauthorized workspace/record;
- mobile and desktop.

### 4. Visual regression

Reference screenshots at 1440, 1024, 768, 390 and 320 px for stable synthetic fixtures. Snapshots include high-risk states, not just happy paths. Dynamic timestamps/IDs are stabilized only in test fixtures, never hidden in production.

### 5. Accessibility

Apply the gate in `accessibility-standard.md`, including keyboard, screen-reader smoke, 200% zoom, 320 px reflow, contrast, reduced motion, and Table/Kanban/chart alternatives.

## Security and behavior matrix

| Boundary | Required regression assertion |
|---|---|
| Login/session | Secure cookies, TOTP, expiry, CSRF, rate limit unchanged |
| Workspace isolation | Cross-workspace list/detail/search/export stays forbidden |
| Capabilities | Hidden/disabled UI does not affect API denial |
| Credential/subscription | All active/grace/expired/suspended/revoked/retry states match current policy |
| Agreement authority | Upload/extraction never activates; exact human approval/version required |
| Placement | Stage change rechecks decision, triangle, next action, authority and conflict |
| Outreach | Every external path rechecks authority/scope/conflict/suppression/approval; no auto-send |
| Evidence | Source/classification/freshness/unknowns preserved and editable under existing rules |
| AI | Evidence/limitations/classifications/history shown; no target action or hidden score |
| Order | Verification distinct from status/payment/fulfillment; revisions immutable |
| Account/protection | Account creation remains Order-derived; protection requires written basis and approval |
| Reorder | Forecast/likelihood remains labelled and human-reviewed |
| Commission | Exact Agreement rule/Order revision/formula/history; approval/payment distinct |
| Import | Preview/rationale/exact commit, provenance, duplicates and transactionality preserved |
| Export | Capability, holds, scope, expiry, encryption and audit preserved |
| Admin/support | Least privilege, MFA/step-up, ticket/reason/scope and audit preserved |
| Audit/jobs | Material actions still append events; job state/retry/dead-letter unchanged |

## Action-parity checklist

Before a legacy page is retired:

1. Enumerate every rendered action and conditional state from source.
2. Map each to the new page/component.
3. Assert the same endpoint/method/payload/version behavior.
4. Assert server denial for missing capability, wrong workspace, stale version and invalid state.
5. Assert success creates the same domain and audit events.
6. Assert recoverable error preserves input.
7. Assert mobile exposes all required urgent actions.
8. Search for remaining legacy component callers.

## Data quality and language

- Unknown remains Unknown; no em dash/zero substitution where meaningful.
- Draft/sent/delivered, proposed/approved, estimate/actual, expected/paid and active/stale stay visually and semantically distinct.
- Dates/currencies use one formatter while retaining stored UTC/currency truth.
- Status labels use a dictionary mapped to existing enums; data values are not migrated for visual wording alone.

## Release gate

A redesign increment may ship only when:

- existing tests pass exactly;
- new route/component/accessibility tests pass;
- no security/policy exception is open;
- migration ledger confirms action parity;
- synthetic fixtures are clearly synthetic;
- no product code outside the authorized increment changed;
- founder decisions required for that increment are resolved or recommended defaults are explicitly active.

## Increment 17 cross-product consolidation

Increment 17 adds whole-product route inventory, document-title coherence,
Protected Account detail canonical ownership, and
`tests/e2e/increment-17.spec.ts` continuity coverage. Final Claude-led brand
beautification remains outside this regression gate and must not weaken the
boundaries above.

