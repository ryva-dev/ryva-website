# Initial Findings and Recommendations

These are design findings from constructing the pilot and completing five synthetic worked reviews. They are not measured pilot outcomes. Actual reviewer agreement and usability conclusions must be recorded through the [Pilot Results Template](pilot-results-template.md).

## 1. Files created

The pack contains:

- operating README and pilot instructions;
- six reusable review, evidence, decision, result, case, and revision templates;
- 15 synthetic case briefs;
- expected-answer guidance for 10 practice cases;
- five fully completed examples;
- an MVP data model; and
- this initial findings record.

## 2. Five completed-case conclusions

| Case | Conclusion | Bounded meaning |
|---|---|---|
| FP-001 Viral pet toy | Investigate Further | Verify Product, Brand, wholesale, safety, and operational evidence; no Buyer contact |
| FP-002 Beauty claims | Do Not Proceed | Stop current representation and salon path until claims/materials are corrected and specialist review is complete |
| FP-003 Home-gift Product | Proceed | Proceed to mandate discussion and capacity verification; no Buyer outreach before authority |
| FP-011 Vague commission | Proceed With Conditions | Negotiate complete written mandate and economics; internal research only |
| FP-014 Average Product / strong Buyer | Proceed With Conditions, with Investigate Further also reasonable | Complete a bounded custom-sample and term-validation step |

## 3. Common areas of ambiguity

1. **Verified Fact versus Direct Evidence.** A record can be verified as existing and also be direct evidence for one claim. The pilot should test whether one label is sufficient or whether Ryva Pro needs separate verification and directness attributes.
2. **Proceed With Conditions versus Investigate Further.** Reviewers may select different labels while prescribing the same bounded evidence-gathering step.
3. **Placement Cycle object scope.** Product/Brand evaluation can coexist with an identified possible Buyer, but the active case must not enter Target before representation authority.
4. **Conditional Triangle sides.** The Framework needs clearer guidance on when unresolved Representative economics permits negotiation but prohibits external work.
5. **Specialist review status.** A review requirement needs an owner, scope, and blocking status rather than a narrative note.
6. **Confidence subject.** Reviewers must say whether confidence applies to an evidence item, a conclusion, or the final bounded decision.
7. **One-time value.** Weak reorder potential does not automatically make a legitimate one-time relationship unsuccessful, but it limits long-term value claims.

## 4. Framework contradictions found

No foundational contradiction prevents the pilot. Three interface conflicts require explicit handling:

- The Decision Filter's formal outputs do not include Investigate Further. The pilot tests it as a user-facing translation when evidence is insufficient and diligence is the action.
- Placement Cycle stages are singular, while real work may have Product, Brand, representation, and Buyer sub-states. The MVP should store one active workflow stage plus object-level readiness and authority states.
- The terminology system treats Representation Opportunity and Protected Account as unresolved. They may appear in a pilot data model only with explicit non-authority boundaries; Protected Account is deferred.

## 5. Missing rules

- exact distinction between evidence verification and evidence directness;
- deterministic translation from Decision Filter results to the four pilot decisions;
- stage ownership when Product/Brand diligence and a pre-mandate fit hypothesis coexist;
- when Conditional Triangle status permits negotiation, research, approach, or placement;
- specialist-review workflow and blocking behavior;
- expiry rules for evidence, decisions, Triangle reviews, and stage gates;
- minimum evidence required to call a Brand, Product, or Business “qualified”;
- representation-account attribution and Protected Account policy;
- public-use and sharing rules for review records;
- correction, disagreement, and override rules for pilot decisions.

## 6. Recommended Framework revisions

1. Separate `verification_status` from `evidence_relationship` in the Evidence Standard and product model.
2. Add a Decision Filter translation table for Proceed, Proceed With Conditions, Investigate Further, and Do Not Proceed, or retain formal outcomes and make “Next action: investigate” the primary UI.
3. Add object-level state guidance to the Placement Cycle.
4. Define action permissions for Supported, Conditional, and Unsupported Triangle sides.
5. Add Specialist Review Required as a risk/next-action workflow field.
6. Require every decision to state its scope, because “Proceed” is otherwise easily overread.
7. Require confidence to name its subject.
8. Clarify that one-time Buyer value can be legitimate without being recurring relationship value.

All proposed changes must be tested before updating the governing Frameworks.

## 7. Fields required in Ryva Pro MVP

- exact claim, source, dates, evidence class, verification/directness, limitations, contrary evidence, permitted use, and unknown reason;
- evidence and decision confidence with named subject;
- AI suggestion and human affirmation;
- Product, Brand, Account, Contact, Buyer role, and authority;
- Representation Opportunity, mandate status, agreement terms, and authority scope;
- Placement Opportunity definition and match thesis;
- stage, entry evidence, missing exit criteria, next action, prohibited action, and history;
- Brand, Business, and Representative value, obligations, risks, and conditions;
- ten Decision Filter results;
- final decision, scope, rationale, owner, conditions, confidence, and review trigger;
- risk/gate, specialist-review type, owner, and disposition;
- Human Approval before external outreach;
- actual versus estimated order, reorder, and commission values; and
- immutable decision history.

## 8. Fields and capabilities not to build yet

- numerical scores or score bands;
- expected opening probability;
- guaranteed or single-value revenue projections;
- autonomous outreach;
- public rankings or badges;
- Protected Account rights;
- automated legal/regulatory conclusions;
- cross-customer intelligence;
- commission-first Opportunity ranking;
- inferred personal Buyer profiles;
- advanced territory optimization; and
- automated Certification or disciplinary outcomes.

## 9. Production scoring readiness

**Production scoring is not ready.**

The foundational labels, stage behavior, decision translation, Triangle permissions, reviewer agreement, data availability, and human approval workflow must be piloted first. Numerical scoring would currently hide rather than resolve these ambiguities.

## 10. Recommended next development step

Run a two-reviewer pilot on all 15 cases using the worksheets and timebox. Enter the process into a lightweight, non-production prototype with:

- claim-level Evidence Records;
- Product, Brand, Account, Buyer, and authority records;
- Placement Cycle state;
- Relationship Triangle review;
- Decision Review;
- Risk Flags and specialist-review task;
- scoped Next Action; and
- Human Approval.

Do not automate external outreach or add numerical scoring. Revise and rerun the cases with the highest disagreement before expanding the model.

