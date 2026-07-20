# Automation Catalog

## Automation contract

Every automation has a versioned rule, trigger, conditions, action, visible activity, override policy, audit event, idempotency key, bounded retry, and failure owner. Automation never grants authority or creates external side effects without the required approval.

| ID | Trigger | Conditions | Action and user visibility | Override | Audit and error handling |
|---|---|---|---|---|---|
| AU-01 Follow-up task | Approved outreach sent | Contact not opted out; Opportunity open | Create task using approved delay; show on timeline/Home | User edits/cancels | Rule/version and source send; retry idempotently, notify if task creation fails |
| AU-02 Stalled Opportunity | Daily evaluation | Open stage exceeds rule, missing/overdue action, or expired evidence | Flag stalled; Home alert; suggest next action | Snooze with reason/date | Inputs and snooze logged; failed evaluation retried |
| AU-03 Evidence freshness | Evidence reaches reassessment date | Evidence supports active decision | Mark stale; alert owner; downgrade dependent view to review required | User may replace or document exception | Preserve prior evidence; never silently delete decision |
| AU-04 Missing critical evidence | Record/transition validation | Required evidence unknown or absent | Block consequential transition; create evidence task option | Authorized exception only where Framework permits | Failed rule visible; no partial transition |
| AU-05 Representation gate | User prepares Buyer outreach | Active agreement covers Product, channel, territory, date | Permit preparation/approval | No ordinary override | Denial audited; policy failure fails closed |
| AU-06 Account conflict | Business/Opportunity/protection created or changed | Scope overlaps active/pending protected claim or agreement restriction | Blocking conflict alert and review task | Founder/Admin only after documented resolution | Conflict inputs, decision, actor; if check unavailable, block |
| AU-07 Human outreach approval | User clicks send/enroll | Exact version approved; Contact permitted; no blocking risk | Queue send and display pending/sent state | User may cancel before provider accepts | Exact content hash, approval, provider result; failed send visible and retry user-controlled |
| AU-08 Reply tracking | Provider event or sync | Message maps confidently to Contact/thread | Record email/reply; stop sequence; create review task | User corrects mapping | Provider receipt/idempotency; ambiguous messages require review |
| AU-09 Opt-out | Recipient opt-out detected or entered | Valid professional identity match | Mark channel prohibited; stop sequence/future sends | No send override; correction requires evidence | Source, scope, stops logged; provider failure alert |
| AU-10 Stage-triggered task | Human stage transition | Transition committed | Create required next-action task/checklist | User assigns/edits, cannot remove mandatory gate | Same transaction or compensating repair; visible if failure |
| AU-11 Opening order conversion | Order confirmed | Verified source, active Opportunity, authority, no duplicate | Create/update Account; draft Protected Account if agreement supports; generate estimated Commission | Human reviews all created records | Transactional, idempotent; rollback on core failure |
| AU-12 Estimated Commission | Order net commissionable amount or agreement rule changes | Active applicable agreement/rule | Calculate Estimated commission with explanation | User cannot overwrite formula; may correct source inputs | Formula version and inputs; calculation errors block status |
| AU-13 Commission due | Daily | Approved/Payable and past due unpaid | Home/notification alert; create task | Snooze with reason; cannot mark Paid without evidence | Due basis and actions logged |
| AU-14 Protected Account expiry | 60/30/14/7/1 days before expiry | Active protection | Alert; create renewal/release review | User changes reminder, not expiry term without authority | Dates/source/renewal approval audited |
| AU-15 Protection expired | Expiry passes | No approved renewal | Set Expired; remove active-conflict blocking according to policy; preserve history | Only corrected agreement evidence | State event, dependent records notified |
| AU-16 Reorder window | Window opens | Active Account, not opted out, no unresolved blocking issue | Create reorder-review task and suggestion | User defers/not expected with reason | Method/source and action logged |
| AU-17 Reorder created | Subsequent verified Order | Prior Account/Order matched | Link Reorder, recalc account actuals and Commission | User corrects linkage with history | Idempotent external reference |
| AU-18 Commission payment overdue | Due date passes | Not Paid/Canceled/Clawed Back; no active resolved state | Alert, task, dispute option | Snooze with reason | Status/source changes audited |
| AU-19 Dispute opened | User opens dispute | Commission and disputed amount/evidence exist | Set Commission Disputed; create case and next action | Withdraw with reason | Immutable dispute history |
| AU-20 Credential expiring | Daily/provider event | 60/30/14/7/1 days | Warning and renewal action | Dismiss current notice only | Provider state recorded |
| AU-21 Credential state change | Verified event | State differs and event valid | Recalculate access immediately; cancel queued external actions | Admin correction only with source | High-severity audit; failure fails closed |
| AU-22 Subscription state | Stripe event | Valid signed/idempotent webhook | Update billing access and notify | Billing portal/admin repair | Receipt and transition audited |
| AU-23 AI missing-data suggestion | User opens/reviews record or requests analysis | Authorized evidence available | Generate reviewable gap list | Accept/edit/reject | Prompt template/model/evidence/output and feedback logged |
| AU-24 Weekly priorities | Weekly schedule or user request | Active credential; sufficient records | Draft prioritized actions with evidence and uncertainty | User accepts/edits/rejects individually | No tasks created until acceptance |
| AU-25 Duplicate suggestion | Create/import/enrichment | Similarity threshold met | Show candidates and fields; block exact duplicate | User keeps separate with reason or merges | Match factors and merge history |
| AU-26 Document extraction | Upload scan passes | Supported document type | Suggest fields/evidence links | Human confirms material fields | Document hash, model/parser version, edits |
| AU-27 Notification grouping | Repeated same issue | Same user, target, grouping key | Update one notification count/state | User expands/dismisses | Individual underlying events retained |
| AU-28 Sequence next step | Prior step completed and delay elapsed | Sequence active, no reply/opt-out, Opportunity valid | Prepare next draft or task; never auto-send | User changes/stops | Step/version and eligibility snapshot |
| AU-29 Import commit | User confirms validated preview | No blocking errors; duplicates resolved | Commit in transaction/batches; show results | User cancels before commit | Row provenance, errors, idempotency |
| AU-30 Export package | User requests export | Access and rights permit | Generate encrypted/time-limited package | User may cancel before ready | Scope, files, access/download audited |

## Automation administration

Representatives may configure reminder delays, quiet hours, stale thresholds within allowed bounds, notification channels, and whether suggestions create draft tasks. They cannot disable authority, conflict, opt-out, credential, audit, or human-approval controls.

## Failure categories

- transient provider failure: retry with backoff;
- invalid data: stop and create visible correction task;
- permission/credential failure: fail closed;
- partial external success: reconcile using provider idempotency/reference;
- rule defect: feature flag off, preserve events, alert operator;
- dead letter: visible admin job with user-facing plain-language status when their work is affected.

