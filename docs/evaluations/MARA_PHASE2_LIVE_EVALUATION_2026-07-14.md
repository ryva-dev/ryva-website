# Mara Phase 2 Live Evaluation — 2026-07-14

## Verdict

The corrected Phase 2 shadow planner clears the 16-scenario live behavioral gate as a composite evaluation: one frozen 16-scenario run, deterministic revalidation of one saved plan after a scheduling-validator correction, and two targeted live replacements after layer-specific defects were fixed. No result was accepted merely for valid JSON.

- 16 materially different plan signatures
- 16/16 commercially relevant final scenario verdicts
- Strong portfolios left alone
- Limited-time creator reduced to one Mara research task and one 20-minute creator decision
- Twenty-item unsent backlog stopped new discovery
- Active $1,800 deadline and overdue $800 payment prioritized
- Repeatedly ignored work entered dormant mode with one five-minute re-entry action and no research
- No premium call on unchanged state
- No external communication by Mara and no Gmail drafts
- Final composite estimated cost: **$0.390267**
- Final composite tokens: **37,594 input; 18,499 output; 56,093 total**

## Scenario results

| Scenario | Final behavior | Cost |
|---|---|---:|
| No niche and no portfolio | Mara researches 2–3 positioning directions; creator chooses; portfolio and pipeline deferred until choice | $0.023457 |
| Strong existing portfolio | Portfolio explicitly skipped; Mara researches qualified targets; creator gets one 15-minute shortlist review | $0.022113 |
| Strong content, no replies | Diagnoses targeting, contact quality, deliverability, and pitch framing before further sends | $0.022965 |
| Twenty unsent opportunities | No new discovery; ranks/prepares the top five from existing backlog for creator decision | $0.028062 |
| Active deals and deadline | Protects the $1,800 deliverable, interprets brand question, and anticipates invoice preparation | $0.032589 |
| Very limited time | Mara prepares 3–5 targets; creator gets one 20-minute Sunday approval task; portfolio and generic drafting skipped | $0.021342 |
| Suspicious outreach | Investigates risk first, gives creator a five-minute block/report decision, preserves unrelated pipeline work afterward | $0.025401 |
| Gifted preference | Separates $120 product value from cash, investigates rights, creator decides, and filming brief is conditional | $0.027522 |
| Historical import | Deduplicates and synthesizes history, diagnoses low replies, then requests one corrective-direction decision | $0.031371 |
| Repeatedly ignored tasks | No speculative work; one five-minute re-entry task and explicit pipeline pause | $0.015552 |
| International/multilingual | Assesses Germany/EU eligibility, EUR payment, bilingual audience fit, then builds market-qualified prospects | $0.030564 |
| Conflicting preferences | Preserves alcohol exclusion, asks creator to resolve conflict, and researches only non-alcohol nightlife meanwhile | $0.026430 |
| Overdue payment | Mara prepares internal reminder from known state; creator reviews/sends; all speculative work skipped | $0.019647 |
| Poor contacts | Validates/suppresses weak contacts before replacing them with verified alternatives | $0.022548 |
| Low response rate | Diagnoses 60-pitch performance before a diagnosis-dependent, limited target experiment | $0.024000 |
| Portfolio should be left alone | Portfolio explicitly skipped; one code-tier active-deal monitor only | $0.016704 |

## Differentiation proof

The strong-portfolio and limited-time creators no longer collapse to the same plan:

- Strong portfolio: 8–12 qualified targets plus a 15-minute creator preference review; no portfolio or generic outreach drafting.
- Limited time: only 3–5 targets plus one 20-minute Sunday approval; no optional questions, generic template, or extra artifact.

Other distinct behavior includes positioning-first for a beginner, dormant mode for inactivity, collection-first for overdue payment, safety-first for suspicious outreach, deadline-first for active paid work, backlog reduction instead of discovery, and international eligibility assessment before Germany outreach.

## Failure-layer analysis and corrections

No prompts were blindly tuned. Each change followed an observed layer diagnosis:

1. **Scenario state:** “strong portfolio” fixtures lacked evidence and readiness provenance, causing unnecessary intake/portfolio work. Frozen states now include evidence appropriate to their scenario.
2. **Evaluator:** no-niche incorrectly required immediate portfolio work. The accepted behavior is positioning selection first, then portfolio reassessment.
3. **Workload playbook:** limited-time and inactive creators sometimes received extra research/drafts. Version 1.0.2 enforces minimum preparation, one creator decision under temporary capacity constraints, and no speculative dormant-mode work.
4. **Approval playbook and validator:** Mara-owned tasks could hide creator effort. The plan now fails validation unless Mara-owned work has zero creator minutes; human work must be explicit.
5. **Commercial mission playbook:** overdue payment generated redundant contact “research.” Known invoice/contact state must now be used directly.
6. **Identity state/playbook:** missing creator identity caused “Mara’s profile” wording. Canonical state now distinguishes Mara from the creator.
7. **Scheduling code:** model-calculated calendar dates were unreliable. Code accepts supplied deadlines, verifies bounded intermediate dates, strips other untrusted dates, and retains relative scheduling windows for deterministic resolution.
8. **Failed-run observability:** validation failures previously appeared as $0 and discarded raw output. Failed runs now retain raw shadow output and actual tokens/cost for diagnosis.

## Credit usage

- Final composite evaluation: $0.390267 estimated.
- All successful diagnostic, frozen, and targeted calls recorded after credits were added: $0.967008 estimated.
- One early urgent-deal validation call occurred before failed-run usage was exposed; based on adjacent identical calls it is estimated at $0.02–$0.03.
- Total evaluation spend is therefore approximately **$0.99–$1.00**, leaving approximately **$4.00** of the added $5 credit, subject to provider billing rounding and pricing.
- Failed calls made before credits were added were rejected before inference and cost $0.
- A later repository regression run was stopped when it became clear legacy integration tests could see the funded `.env` key. Any provider spend from that interrupted run was not recorded by the Phase 2 evaluator and is not included in the $0.99–$1.00 figure; consult Anthropic billing for the exact remaining balance. The repository `npm test` command now explicitly clears Anthropic and OpenAI keys so future test runs cannot spend API credit accidentally.

## Remaining cautions

- This proves scenario behavior in shadow mode, not production execution reliability.
- Plans remain unexposed and cannot execute.
- Production event producers and the legacy-to-V2 state adapter still need incremental expansion before Phase 3 execution.
- Optional creator questions should be monitored in shadow review; the playbook forbids questions that do not block useful preparation, but semantic enforcement remains an evaluation responsibility.
- Provider quality is stochastic. These scenarios must remain a release regression suite for model or playbook changes.
