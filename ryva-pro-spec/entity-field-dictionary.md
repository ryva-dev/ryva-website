# Entity Field Dictionary

## Origin codes

- **U:** user-entered or human-confirmed
- **S:** system-derived
- **A:** AI-suggested; requires review where material
- **E:** externally sourced
- **I:** imported

Every material field stores actual origin, updated time, and actor/source where applicable.

## Identity and access

### User

**Required:** id[S], email[U/E], verified_at[S], name[U], time_zone[U], locale[U], status[S].  
**Optional:** phone[U], avatar_document_id[U], MFA state[S], last_login_at[S].  
**Relationships:** credentials, memberships, subscription, approvals, audit.  
**Audit/retention:** email, role, status, MFA, and access changes; delete/anonymize under account policy.

### Certification Credential

**Required:** id[S], user_id[S], credential_type[E], credential_number[E], status[E/S], issued_at[E], expires_at[E], verified_at[S], provider_reference[E].  
**Optional:** suspension reason/code[E], revocation date[E], renewal link[E], metadata[E].  
**Relationships:** User, access decisions, Audit Events.  
**Ownership/status:** credential authority controls truth; Ryva caches verified state.  
**Retention:** full status history.

### Subscription

**Required:** user_id[S], provider_customer_id[E], provider_subscription_id[E], status[E/S], current_period_end[E].  
**Optional:** trial_end[E], cancel_at[E], price_id[E], past_due_since[S].  
**Audit/retention:** webhook receipt, state transition, portal action; financial schedule.

## Intelligence records

### Product

**Required:** workspace_id[S], brand_id[U/E/I], name[U/E/I/A], category[U/E/I/A], status[U], identity_status[U], summary[U/A].  
**Optional:** variants[U/E/I], images[E/I/U], source URLs[E/I], consumer price[E/I/U], review volume[E], review quality summary[U/A], sales evidence summary[U/A], trend direction[A/U], repeat-purchase hypothesis[A/U], differentiation[U/A], physical retail presence[E/I/U], packaging[U/E/I], retail/wholesale readiness[U], inventory/fulfillment notes[U/E], recommended Buyer categories[A/U], AI summary[A], notes[U], qualification decision_id[S].  
**Relationships:** Brand, Evidence, Documents, Risks, Opportunities, Orders.  
**Statuses:** discovered, watchlist, under_review, qualified, rejected, represented, archived.  
**Audit/retention:** qualification, human decision, source, status, merges, critical field changes.

### Brand

**Required:** workspace_id[S], public_name[U/E/I], identity_status[U], pipeline_stage[U], owner_user_id[S/U].  
**Optional:** legal_name[U/E/I], website[E/I], ownership[U/E], contacts, social profiles[E/I], wholesale status[U/E], distribution[U/E], physical retail presence[E], inventory capability[U/E], fulfillment notes[U/E], communication quality decision[U], commission potential estimate[U], representation status[S/U], risk summary[S], notes[U].  
**Relationships:** Products, Contacts, Representation Opportunities/Agreements, Protected Accounts, Placement Opportunities, Activities, Tasks, Risks.  
**Audit/retention:** identity, ownership, pipeline, agreement, communication-quality and risk changes.

### Business

**Required:** workspace_id[S], name[U/E/I], type[U/E/I/A], category[U/A], status[U], owner_user_id[U].  
**Optional:** legal name[U/E], locations[U/E/I], website[E/I], social profiles[E/I], assortment[U/E/A], target customer[U/A], price positioning[U/A], relevant Products[U/E], current vendors[U/E], geography[S/U], fit rationale[U/A], account ownership status[S/U], last activity[S], next action_id[S].  
**Relationships:** Contacts, Buyers, Opportunities, Protected Accounts, Account, Activities, Evidence, Risks.  
**Audit/retention:** qualification, owner, merge, conflict, status, Contact-purpose changes.

### Contact and Business Buyer

**Contact required:** parent Brand/Business[S/U], name[U/E/I], role[U/E/I/A], verification_status[U/S], source_id[U/E/I], permission_status[U].  
**Contact optional:** email/phone/social professional handle[U/E/I], seniority[A/U], location[U/E], opt-out[E/U], freshness[S].  
**Buyer required:** contact_id[S/U], business_id[S], buyer_role[U/E], decision_context[U].  
**Buyer optional:** authority evidence[U/E], stated needs[E/U], buying window[E/U], decision process[E/U].  
**Audit/retention:** source, verification, role, opt-out, use purpose, deletion and merge.

### Source and Evidence Record

**Source required:** type[U/S], reference[U/E/I], captured_at[S], owner/provider[U/E], rights_classification[U/S].  
**Source optional:** URL[E], observed period[E/U], confidentiality[S/U], parent_source_id[S].  
**Evidence required:** subject_type/id[S/U], exact claim[U/A], evidence_class[U], verification_status[U], source_id[U/S] or unknown_reason[U], supports[U/A], does_not_support[U/A], confidence[U], reviewed_by[U], reviewed_at[S].  
**Evidence optional:** context[U/E], limitation[U/A], contrary evidence[U], freshness date[S/U], permitted use[U], prohibited inference[U], supersedes_id[S].  
**Statuses:** current, stale, disputed, superseded.  
**Audit/retention:** append-only revisions and source deletion consequences.

## Representation and Placement

### Representation Opportunity

**Required:** brand_id[U], stage[U], owner[U], next_action_id[U].  
**Optional:** Product scope[U], proposed territory/channel[U], Contact[U], terms summary[U/A], missing terms[A/U], rejection reason[U].  
**Relationships:** Brand, Products, Contacts, Agreement, Evidence, Activities, Tasks, Decisions.  
**Audit:** stage, owner, contact, conversion, rejection.

### Representation Agreement and Territory

**Agreement required:** Brand, Representative, status, effective/end dates, Product scope, territory/channel, authority scope, commission basis/timing, source document.  
**Optional:** exclusivity, restrictions, house accounts, protected-account rules, reorder rights, approved claims, support/escalation, post-termination terms.  
**Territory required:** agreement, type, geography/channel/account scope, dates, status.  
**Origins:** U/E/I with AI extraction allowed only as A until confirmed.  
**Audit/retention:** every term version, human approval, dates, document hash; contractual schedule.

### Placement Opportunity

**Required:** agreement_id[U], Brand[S], Business[U], Products[U], owner[U], stage[U], match thesis[U/A], evidence confidence[U], next action[U].  
**Optional:** Buyers/Contacts[U], expected order range[U], expected commission range[S/U], likelihood qualitative[U], target date[U], account conflict[S], risks[S], loss/disqualification reason[U].  
**Relationships:** all core records, Activities, Tasks, Approvals, Account, Orders, Commissions.  
**Audit:** stage event, drag source, required-field validation, estimates, owner, reopen.

### Placement Stage

**Required:** code[S], display name[S], sequence[S], allowed transitions[S], required-field rule[S], stale-day default[S].  
**Optional:** automation rules[S], help text[S].  
**Ownership:** Ryva configuration; not workspace editable in first version.  
**Audit:** configuration versions.

## Activities and outreach

### Activity

**Required:** workspace, type, actor, occurred_at, parent links, summary.  
**Optional:** provider reference, outcome, direction, duration, attachment, AI provenance.  
**Statuses:** planned, completed, failed, canceled.  
**Audit:** immutable original plus correction event.

### Task

**Required:** title[U/A/S], owner[U/S], status[U], priority[U], parent record[U], created reason[S/U].  
**Optional:** due date[U/S], recurrence[U], blocker[U], completion evidence[U/E], stage trigger[S].  
**Audit:** assignment, due date, status, completion, reopen.

### Email

**Required:** Contact, from identity, direction, subject, body/version, status, parent record.  
**Optional:** template, sequence, scheduled time, provider ids, reply classification, attachments, opt-out.  
**Origins:** U/A for draft; E for received/provider state; S for status.  
**Audit:** draft versions, exact approved version, approver, send attempt/result.  
**Retention:** communications policy and provider terms.

### Call

**Required:** Contact, owner, status, direction, date/time or occurred_at, parent record.  
**Optional:** preparation brief[A/U], script, duration[E/U], outcome[U], notes[U], voicemail version[U/A], recording only if law/policy permits.  
**Audit:** prep, completion, outcome, note edits.

### Note

**Required:** author, parent, body, created_at.  
**Optional:** note type, pinned flag, mentions.  
**Audit:** version history; no silent edit.

### Outreach Sequence

**Required:** name, owner, status, ordered steps, stop conditions, approval mode.  
**Optional:** Business type/category scope, default delays, template links, task steps.  
**Statuses:** draft, active, paused, completed, stopped, archived.  
**Audit:** version used by each enrollment, human approvals, stop reason.

### Template

**Required:** name, channel, owner, body, status.  
**Optional:** subject, variables, category/Buyer context, approved claim references.  
**Audit:** versions, use count, archive; AI generation labeled.

## Accounts and money

### Protected Account

**Required:** Brand, Business, Representative, agreement, origin date, approval date/approver, scope, protection term, territory, commission rights, reorder rights, status, expiration.  
**Optional:** renewal date, conflict notes, supporting documents, release terms.  
**Statuses:** pending, active, expiring, expired, disputed, released, ended.  
**Audit/retention:** grant, overlap check, approval, renewal, expiry, dispute, release; contractual/dispute schedule.

### Account

**Required:** Brand, Business, Representative, opening Order, status, owner, opened_at.  
**Optional:** Protected Account, Contacts, health[U], next action, support owner, ended_at/reason.  
**Statuses:** onboarding, active, at_risk, paused, ended.  
**Audit:** creation, owner, health, status, relationship end.

### Order

**Required:** order number/reference, Account, Brand, Products/quantities, order date, wholesale gross value, discounts, returns/cancellations, net commissionable amount, status, payment status, source document.  
**Optional:** taxes/freight informational fields, fulfillment dates, notes.  
**Origins:** U/E/I; calculations S and explainable.  
**Audit/retention:** source hash, calculation inputs, revisions, fulfillment/payment state; financial schedule.

### Reorder

**Required:** Account, prior Order, last order date[S], status, owner.  
**Optional:** expected window[U/S], average order size[S], likelihood qualitative[U], reminder, recommended follow-up[A/U], health[U], notes.  
**Statuses:** projected, due, contacted, ordered, deferred, not_expected, closed.  
**Audit:** window method, reminders, actions, linked new order.

### Commission

**Required:** Representative, Brand, Account, Order, calculation basis, rate or rule, expected amount[S], status, source documentation.  
**Optional:** approved amount, paid amount/date, due date, clawback amount/status, notes.  
**Statuses:** Estimated, Pending Verification, Approved, Payable, Paid, Disputed, Canceled, Clawed Back.  
**Audit/retention:** formula version, inputs, every amount/status, source, human verification; financial schedule.

### Commission Dispute

**Required:** Commission, opened_by, reason, disputed amount, status, evidence, next action.  
**Optional:** Brand response, resolution amount, resolution note/date.  
**Statuses:** opened, evidence_needed, submitted, under_review, resolved, rejected, withdrawn.  
**Audit/retention:** immutable communication and resolution trail.

## Governance and platform

### Risk Flag

Required: subject, type, severity, status, owner, description. Optional: gate, evidence, mitigation, specialist review, due date. Audit all changes.

### Decision Record

Required: subject, question, scope, outcome, rationale, confidence subject/label, owner, date, next action. Optional: conditions, alternatives, Triangle result, evidence. Issued versions immutable.

### Human Approval

Required: exact artifact/action version, approver, status, scope, time. Optional: conditions, evidence viewed, expiry. Cannot be reused for changed content.

### AI Suggestion

Required: suggestion type, target, content/structured payload, model/provider/version, evidence links, classification, confidence, status. Optional: user edit, feedback, regeneration parent. Full review audit.

### Audit Event

Required: actor, workspace, action, target, timestamp, before/after references or digest, request/correlation id, origin. Append-only; long security retention.

### Saved View

Required: owner/scope, record type, name, filter/sort/column definition, status. Optional sharing. No arbitrary code.

### Notification

Required: user, type, severity, title, target, status, created_at. Optional: due/expiry, grouping key, resolution. Short operational retention.

### Document

Required: owner, name, type, parent, storage key, size, hash, scan status. Optional: extracted fields, expiry, confidentiality. Originals immutable; versions linked.

