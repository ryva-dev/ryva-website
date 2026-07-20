# Framework-to-Ryva-Pro Matrix

The matrix defines product implications, not committed functionality. Ryva Pro must follow the product, data, scoring, and AI philosophy in The Ryva Standard.

| Framework | Core fields and statuses | Dashboard, alerts, workflow, and score | AI and audit requirements |
|---|---|---|---|
| RF-01 Placement Cycle | Stage, evidence state, owner, next action, blocker, transition reason | Cycle distribution, stale evidence, backward transition, gate workflow | Propose next action; human approval for material transition; full stage history |
| RF-02 Relationship Triangle | Party value, obligation, risk, condition, evidence | Weak-side warning and conditional review | Summarize evidence; human owns condition and proceed decision |
| RF-03 Recommendation | Test states, stop/caution conditions, scope, result, expiry | Recommendation gate and evidence-change alert | Prefill and flag conflict; human final result; preserve superseded reviews |
| RF-04 Product Score | 17 ratings, Unknown reasons, source, model, coverage, confidence | Product comparison, freshness, sensitivity, risk gate | Propose ratings with citations; deterministic calculation; override history |
| RF-05 Brand Score | 17 ratings, red flags, mandate, risk, coverage, confidence | Brand readiness, conflict, payment/support and expiry alerts | Extract evidence; human red-flag disposition and suitability |
| RF-06 Business Fit | Product–Brand–Business context, dimensions, class, match thesis | Fit-ranked research queue, conflict and timing alerts | Suggest candidates; no auto-outreach; human qualification and thesis |
| RF-07 Retail Readiness | Element class/status, evidence, owner, scope, condition, expiry | Readiness checklist, missing required item, change alerts | Document extraction only; human readiness and claims approval |
| RF-08 Opportunity Score | Component references, estimates, effort, strategy, risk, priority | Priority queue, stale component and sensitivity view | Calculate and propose; human priority/action; estimate provenance |
| RF-09 Portfolio | Brand/account classifications, capacity, concentration, conflict, activity | Portfolio health, dependency, overload, inactivity, payment alerts | Detect concentration and conflicts; human acceptance, exit, ownership |
| RF-10 Relationship Value | Historical/current/potential fields, ranges, burden, condition | Reorder, repair, expansion, payment and relationship-health view | Summaries and scenarios; human relationship action; snapshot history |
| RF-11 Decision Filter | Decision, tests, authority, alternatives, owner, conditions | Escalation workflow and review-date alerts | Identify conflict; accountable human decision and approval record |
| RF-12 Evidence Standard | Class, source, context, dates, rights, limits, confidence, supersession | Freshness, contradiction, missingness, source-lineage views | Never upgrade evidence silently; model provenance and corrections |
| RF-13 Human Judgment | Automation level, permissions, human decision, failure and stop behavior | Approval queue, external-action and high-risk alerts | Model/version, input, output, approval, correction, and stop audit |

## Cross-product requirements

- One professional record links objects without merging their distinct decisions.
- Scores are deterministic from stored approved inputs.
- Unknown is null with a reason.
- Every consequential result shows model version, evidence coverage, confidence, warnings, and human owner.
- Estimates and actuals use separate fields and visual treatment.
- Stage, score, or confidence changes preserve history.
- AI cannot create authority, fabricate input, or silently issue a final material decision.
- Product interfaces must distinguish current capability from planned capability.

**TODO (Founder Decision Required):** Approve minimum viable scope, permissions, data model, retention, access after certification lapse, automation levels, service commitments, and which framework results may be shared.

