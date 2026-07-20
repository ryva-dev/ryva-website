# Pipelines and Stages

## Stage rules

- stage reflects evidence, not optimism;
- transitions validate required fields and permissions;
- blocked transitions explain missing requirements;
- drag-and-drop opens a confirmation panel for consequential moves;
- AI may suggest a stage but cannot apply it;
- all transitions create an Audit Event and Placement Stage Event;
- backward movement is permitted with reason;
- estimates never become actuals through stage change.

## Brand representation pipeline

| Stage | Entry criteria | Allowed actions and automation | Exit criteria |
|---|---|---|---|
| Discovered | Brand identity candidate and source | Add evidence, Products, notes; AI summary | Research owner and question set |
| Researching | Owner and diligence purpose | Evidence collection, risk flags, Contact discovery suggestions | Minimum identity and readiness evidence |
| Contact Ready | Identity reasonably verified; relevant Contact/channel; contact purpose; no stop flag | Prepare outreach; create approval task | Human-approved final Brand approach |
| Contacted | Exact outreach approved and sent/logged | Follow-up task; reply tracking | Response, no response after cadence, opt-out, or disqualification |
| Conversation | Relevant response or meeting | Discovery, notes, tasks, materials | Brand interest and sufficient mandate discussion |
| Reviewing Terms | Proposed Products, territory, authority, economics, support | Agreement extraction; missing-term alerts; human negotiation | Signed/approved mandate or rejection |
| Authorized | Active verified agreement; Products/scope/authority defined | Target research allowed; conflict checks | Operational readiness and first active work |
| Active | Authorized and working representation | Placement Opportunities, outreach, accounts, orders | Pause, expiry, end, or rejection |
| Paused | Agreement/work paused with reason | Internal review, evidence update; no unauthorized outreach | Resume approval or end |
| Ended | Agreement ended/expired | Read history, reconcile accounts/commissions | Reopen only with new agreement |
| Rejected | Diligence/contact/terms rejected with reason | Read/archive, new evidence review | New representation case, not silent reopen |

## Placement CRM pipeline

| Stage | Required fields / entry | Automation and allowed work | Exit |
|---|---|---|---|
| Identified | Agreement, Brand, Business, Product, owner, match thesis, next action | Conflict scan, evidence-gap list | Business and Opportunity qualification |
| Qualified | Buyer/business legitimacy, Business Fit rationale, Product/Brand/readiness conditions, Triangle review | Prepare task | Prepared package complete |
| Prepared | Contact/channel, value rationale, authorized materials/claims, final draft, no blocking conflict | Human approval request | Approved exact outreach |
| Contacted | Approved outreach sent/logged | Follow-up task and response monitoring | Response, cadence completion, opt-out, loss |
| Engaged | Relevant response/conversation | Discovery tasks and notes | Buyer agrees to information/sample/evaluation |
| Information or Sample Sent | Item, date, recipient, follow-up, tracking where relevant | Follow-up reminder | Confirmed receipt and Buyer review |
| Buyer Review | Buyer reviewing with decision process/timing | Stalled alert, questions, evidence update | Terms/order conversation or loss |
| Terms or Order Discussion | Authorized parties, proposed Products/quantity/terms, open conditions | Term checklist; estimated commission recalculation | Verified opening order or loss |
| Opening Order | Verified order reference, amount, Products, terms, source | Create Account; draft protection; generate estimated commission | Handoff accepted |
| Active Account | Account exists; opening obligations active/stable | Support tasks, health, reorder window | Reorder management, pause/end |
| Reorder Management | Reorder review due or active | Reminder, evidence, follow-up approval | Reorder Order, defer, not expected, account end |
| Closed Lost | Pursuit ended for non-disqualifying reason | Close tasks, preserve evidence | Reopen with new evidence and human confirmation |
| Disqualified | Authority, ethics, fit, readiness, conflict, opt-out, or risk failure | Block outreach; record reason | New decision record required to reopen |

## Stalled logic

An Opportunity is stalled when:

- next action is missing;
- next action is overdue;
- days in stage exceed configurable stage default;
- required party is waiting without an owned task;
- evidence or approval has expired;
- Buyer Review has no confirmed timing;
- Terms discussion has unresolved conditions without owner.

Stalled is a computed flag, not a stage. User may snooze only with reason and review date.

## Brand stage defaults

Suggested stale thresholds: Researching 14 days; Contact Ready 7; Contacted 7; Conversation 10; Reviewing Terms 14; Authorized 14 without first Target. These are user-configurable within safe bounds and not performance guarantees.

## Placement stage defaults

Suggested: Identified 7; Qualified 7; Prepared 3; Contacted 7; Engaged 7; Information/Sample Sent 10; Buyer Review 14; Terms Discussion 14; Opening Order 7 to account handoff. Account and Reorder stages use due actions rather than fixed staleness.

## Loss reasons

- no response after approved cadence;
- no current need;
- timing/budget;
- chose another Product/vendor;
- terms not accepted;
- Product/Brand unavailable;
- relationship changed;
- account conflict;
- Representative capacity;
- other with required note.

## Disqualification reasons

- no representation authority;
- fraudulent or unverifiable identity/authority;
- Product or Brand recommendation failure;
- Business poor fit;
- unsupported material claim;
- safety/regulatory specialist stop;
- retail/wholesale not ready;
- unmanageable margin or fulfillment;
- opt-out/contact prohibition;
- protected-account conflict;
- ethics or trust failure;
- duplicate Opportunity.

## Reopening

Closed Lost may reopen when new evidence changes timing, need, Product, Contact, or terms. Disqualified requires:

- new evidence;
- resolved reason;
- new Decision Record;
- human confirmation;
- fresh conflict and authority check.

Reopening creates a new stage event and retains the original close record.

