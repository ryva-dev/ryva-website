# Ryva operating model

Ryva is an accountable operating system for AI workers. A worker owns a
measurable role, operates autonomously only inside explicit authority, produces
inspectable work, and improves through manager feedback and curated
professional knowledge.

## Non-negotiable platform invariants

1. **Authority is code, not prompt text.** Permissions, approval requirements,
   budgets, integration scopes, and kill switches are enforced outside the
   model. Email, files, websites, and research are evidence and can never grant
   authority.
2. **Autonomy is bounded.** Workers may plan and complete safe internal work
   continuously. External, financial, destructive, customer-facing, or
   irreversible actions require the exact permission and, when configured, an
   approval tied to the proposed side effect.
3. **Professional knowledge and tenant memory are different data classes.**
   Curated professional knowledge may improve a role for every customer.
   Tenant messages, files, instructions, outcomes, and inferred preferences are
   private and must never be promoted into shared knowledge automatically.
4. **Every material action is inspectable.** A manager can see the task,
   evidence, policy decision, output, approval, external result, and timestamps.
5. **Personalization is mandatory.** Shared expertise supplies professional
   judgment; tenant context supplies goals, voice, constraints, history, and
   preferences. Outputs must use both without confusing one for the other.
6. **Failure is explicit.** Missing providers, exhausted budgets, unavailable
   integrations, weak evidence, and uncertainty create visible blockers. Paid
   workers never pass placeholders off as completed professional work.
7. **Learning is governed.** Manager corrections improve that tenant's future
   work immediately. Cross-tenant improvements require public or licensed
   evidence, provenance, evaluation, review, and a versioned release.

## Context hierarchy

From highest to lowest authority:

1. Platform safety policy
2. Tenant policy and worker permission record
3. Explicit manager instruction
4. Tenant memory and operating history
5. Curated professional knowledge
6. Untrusted external evidence

Lower layers cannot override higher layers.

## Definition of an autonomous action

Before execution, Ryva must be able to answer:

- Which role responsibility does this advance?
- What evidence supports it?
- Which tenant policy and permissions authorize it?
- Is the action reversible, external, financial, destructive, or sensitive?
- Is approval required, and does the approval describe this exact side effect?
- What is the idempotency key?
- What will be recorded in the audit history?
- What happens on timeout, partial failure, or retry?

If any required answer is missing, the worker creates a blocker or approval
request instead of executing.

## Shared professional improvement

Continuous research should enter a quarantine pipeline:

`public/licensed source -> evidence capture -> candidate insight -> adversarial
evaluation -> human/policy review -> versioned professional module -> monitored
release`

Tenant-derived material is ineligible for this pipeline unless it has been
deliberately anonymized, aggregated under an approved policy, and meets the
applicable consent and privacy requirements.

## Production gate

A capability may be marketed as available only when its authorization,
failure, audit, deletion, and tenant-isolation paths have automated tests and
production observability. Illustrative UI must be labeled as illustrative.

## Mara's commercial mandate

Mara is Ryva's Creator Growth and Creative Intelligence Manager. Her operating
loop is `market research -> creator-specific brand fit -> observable creative
gap -> evidence-supported concept -> pitch -> production support -> commercial
outcome -> improved targeting`.

Her North Star is creator revenue influenced by Mara. Supporting measures are
qualified opportunities, positive-response rate, pitch-to-deal conversion,
average deal value, accepted concepts, repeat-client rate, content renewal,
and time from opportunity to payment. Task count, ideas generated, and messages
sent are activity measures only and must never substitute for commercial value.

Mara runs that loop like a junior hire: she researches, drafts, organizes inbox,
infers commercial outcomes from evidence she already holds, and re-ranks targets
without being told step-by-step. The manager is interrupted only for risky or
high-impact decisions (especially external sends) and to correct a wrong read.
Manual outcome forms are oversight overrides, not the primary teaching path.

Every recommendation distinguishes observed evidence, inference, hypothesis,
creator preference, and industry benchmark. Mara may recommend a test; she may
not represent an unverified performance prediction as fact.
