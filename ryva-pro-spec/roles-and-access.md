# Roles and Access

## Access model

Every request is authorized by:

`identity × workspace membership × credential status × subscription status × role capability × record ownership × action policy`

UI visibility does not grant authority. Policies are enforced in the API and job worker.

## Product roles

### Certified Representative

The primary production user. Full access requires:

- verified identity;
- active eligible Ryva Brand Placement Certification;
- active or permitted payment-retry subscription;
- accepted current terms and security requirements.

Owns their personal workspace, professional records, human decisions, and approved external communications.

### Certified Closer

Not a separate role in the first version. The Standard does not establish this credential. If the Founder later approves a Closing Program credential, it becomes a profile capability and training entitlement; it does not replace Representative permissions.

### Mentor

Accesses only an approved training/sandbox workspace and learner-shared artifacts. No default access to production Buyer, Brand, outreach, order, commission, or private evidence records.

### Instructor

Accesses curriculum and assessment environments, not Representative production workspaces. Any support review uses the Support access workflow and is separately audited.

### Ryva Admin

Manages credential integration, access exceptions, system configuration, support authorization, audit investigations, jobs, and policy-controlled data operations. Admin does not receive blanket routine access to user content.

### Support

Sees account metadata, provider health, non-sensitive diagnostics, and user-submitted support context. Content access requires a ticket, user consent where appropriate, time-boxed scope, stated reason, and immutable audit.

### Brand User

Excluded from the first production version. Brands communicate and exchange documents through the Representative's ordinary channels. A later portal requires separate product and data governance.

## Capability matrix

| Capability | Representative | Mentor | Instructor | Admin | Support |
|---|---:|---:|---:|---:|---:|
| Own workspace records | Yes | Sandbox only | Sandbox only | No | No |
| External outreach | Yes, explicit approval | No | No | No | No |
| Human decision/qualification | Own workspace | Training only | Assessment only | No | No |
| Order/commission records | Yes | No | No | Controlled repair only | Metadata/diagnostics |
| Credential administration | No | No | No | Yes | Read status |
| Support content access | N/A | No | No | Authorized only | Authorized only |
| Audit investigation | Own activity | Own training | Own training | Yes | Ticket-scoped |
| Export | Own permitted records | Training only | Training only | Policy operation | User-request assistance |

## Credential states

| State | Access behavior |
|---|---|
| Active | Full entitled functionality |
| Expiring | Full access; warnings at 60, 30, 14, 7, and 1 day; renewal action |
| Expired — grace | 30 days read-only, export, certification and subscription settings; no AI generation or external action |
| Expired — grace ended | Login permitted only to certification, subscription, export request, and support |
| Suspended | Immediate action block; read-only only if suspension record permits; no export if investigation hold applies |
| Revoked | Ryva Pro blocked; credential and appeal/support screen only; controlled data request subject to retention/hold |
| Surrendered | Same as expired after access end, unless agreement requires another treatment |

Credential events are externally verified, signed or otherwise trusted, idempotent, and audited.

## Renewal

Successful renewal:

- verifies new credential term;
- restores access if subscription and security are valid;
- preserves all records and history;
- creates a credential audit event;
- does not silently execute overdue automations or sends.

After restoration, tasks and reminders are recalculated and shown for user review.

## Subscription states

| State | Behavior |
|---|---|
| Trial/Active | Credential-permitted access |
| Past due | Seven-day payment-retry window with full access and persistent warning |
| Payment retry failed | 30-day read-only access, export, billing, and renewal |
| Canceled at period end | Full access until paid-through date, then 30-day read-only |
| Canceled immediately by policy | Read-only or blocked according to reason; audited |

Subscription does not override credential restrictions.

## Export rights

Representatives may export their permitted professional records, excluding:

- provider secrets;
- internal security data;
- restricted third-party data without export rights;
- other users' private data;
- materials under legal or investigation hold.

Exports are asynchronous, encrypted in transit, time-limited, and audited.

## Admin and support controls

- least-privilege roles;
- MFA required;
- step-up authentication for credential, export, deletion, and support-content actions;
- no shared accounts;
- time-limited support grants;
- reason and ticket required;
- field-level redaction;
- immutable access logs;
- user-visible support-access history where safe;
- quarterly access review.

## Founder default and revisit trigger

The 30-day read-only grace period is a reversible default. Revisit based on renewal behavior, contractual commitments, support volume, credential policy, and data-protection review.

