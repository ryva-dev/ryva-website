# Page: Admin Areas

## Purpose and user

Provide the minimum operational controls needed for credentials, access, support cases, audit investigations, imports/jobs, and policy repair. Primary users are Ryva Admin and scoped Support.

## Data displayed

Sections:

- credential event/reconciliation;
- access decisions and exceptions;
- support tickets/grants;
- audit search;
- job/dead-letter health;
- provider health;
- export/deletion requests;
- feature kill switches.

No general user-content browser.

## Actions

Primary depends on authorized case: reconcile event, grant scoped support access, retry/repair job, fulfill request, activate kill switch.  
Secondary: view safe metadata, revoke grant, export audit evidence.

## Filters

User/workspace ID, ticket, event type, provider, job state, date, severity, actor.

## States

- **Empty:** no active operational cases.
- **Loading:** sensitive metadata redacted until authorized.
- **Error:** high-risk action fails closed and alerts operator.

## Permissions and responsive

Admin/Support only, MFA and step-up. Desktop-first; mobile permits critical kill switch/read-only incident status only.

## Linked records and AI

Credential, access, support grant, Audit, Jobs, Integrations. AI may summarize sanitized incident data; never grants access or repairs state.

## Acceptance criteria

- no impersonation;
- every content access requires scoped grant/reason;
- changes are append-only/audited;
- support scope expires automatically;
- kill switches safe and observable;
- tenant data cannot be queried outside approved case.

