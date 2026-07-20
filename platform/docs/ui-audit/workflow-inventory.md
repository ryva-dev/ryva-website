# Workflow Inventory

## Counting method

The inventory contains **20 major workflows**. Click counts are minimum pointer/keyboard activations from the current entry screen to the first consequential commit, excluding typing, scrolling, selecting values, and provider-hosted steps. A range indicates state-dependent actions. The counts describe the present UI, not desired behavior.

| # | Workflow | Screens involved | Minimum activations | Friction points | Duplication / context switches |
|---:|---|---|---:|---|---|
| 1 | Login and conditional TOTP | Login → Home or Access | 1–2 | TOTP appears after the first submission; access outcome is only known after authentication | None; appropriate single surface |
| 2 | Certification access/remediation | Access → Certification → external renewal | 2+ | Eligibility, credential state, subscription state, and access mode live on separate pages | Access summary duplicates state shown on Certification/Subscription |
| 3 | Subscription activation/management | Access or Subscription Activation → provider → Subscription | 2+ | Provider handoff interrupts context; activation and standard subscription share a component but separate routes | Subscription state appears in Access and Subscription |
| 4 | Profile and working-preference setup | Profile → Settings | 2 commits | Identity/business details and work preferences are split; no explicit onboarding progress | Four global account destinations cause context changes |
| 5 | Product qualification | Products → Product detail → evidence/risk/decision → qualification | 4–7 | Creation, evidence, risk, decision, and stage are dense; populated detail has many equal-weight panels | Generic Product records overlap dedicated Product Intelligence |
| 6 | Brand qualification | Brands → Brand detail → evidence/risk/decision → qualification | 4–7 | Identity and qualification work share one long detail page | Generic Brand records overlap Brand Intelligence |
| 7 | Buyer/contact qualification | Buyers → Buyer detail → Contact detail → source verification → Buyer detail | 5–8 | Verifying a contact requires leaving Buyer context; terminology alternates Buyer/Business | Generic Business/Contact records overlap Intelligence routes |
| 8 | Evidence, source, and document preparation | Sources/Documents → record detail → attach evidence | 3–6 | Sources and Documents are separate top-level utilities; user must carry IDs/context between pages in some forms | Evidence forms repeat across record types |
| 9 | Representation opportunity | Brand → Representation → create → Opportunity detail → stage decision | 4–6 | Long creation form requires pre-existing contact, decision, and task; list and form share the page | Brand context is left to work in a separate domain |
| 10 | Agreement upload, extraction, and authority approval | Opportunity/Representation → Agreement → Documents/extraction review → approval | 5–9 | Material terms, document state, extraction candidates, restrictions, conflicts, and approval occupy one long page | Documents has a separate global register; approval ID is manually entered |
| 11 | Placement qualification and pipeline transition | Product/Buyer → Placements → create → Placement detail → stage confirmation | 4–7 | Creation has 15 controls; authority and relationship review are separated from source records | Product–Buyer fit, relationship triangle, and authority require several contexts |
| 12 | Human-approved outreach | Placement → Outreach → create draft → Message detail → approve/send → response classification | 5–9 | Draft, approval, provider state, claims, attachments, and response are split between center/detail; no wizard/state summary | Templates and sequences are separate pages with custom back links |
| 13 | Account and opening Order | Orders → create review-required Order → Order detail → verify → Account | 4–7 | Seventeen controls plus repeatable lines on one page; account appears only after verified order | Commerce subnav helps, but record context is not preserved |
| 14 | Reorder and account-health review | Reorders → Account detail → related Order/outreach | 3–6 | Projections, health, authority, and buyer need must be reconciled across pages | Reorder list is read-oriented; action occurs elsewhere |
| 15 | Commission approval and dispute | Commissions → detail → approve/pay or open dispute → Dispute detail → resolve | 4–8 | Formula history, agreement basis, order revision, adjustments, and decision are separated vertically/across pages | Commission and dispute have separate registers and detail conventions |
| 16 | AI suggestion review | Copilot → generate → Suggestion detail → edit/disposition/revision | 3–6 | Record IDs can be manually supplied; dense provenance makes primary review action hard to locate | Home briefings and Copilot use separate request presentations |
| 17 | Home prioritization and task execution | Home → priority/task/record → return | 2–4 | Empty workspace makes Home sparse; populated priorities can send users into many domains without return context | Tasks and Notifications duplicate attention surfaces |
| 18 | Analytics and report review | Home/Sidebar → Analytics → choose view/filter → drill down/save report | 2–5 | Nine view buttons, date/currency filters, metrics, tables, definitions, and external readiness compete | Home duplicates selected analytics summaries |
| 19 | Import and export | Import → validate → approve; Export → select → generate | 2–4 | Import mapping and raw CSV occupy one form; approval appears only after preview; exports expose 21 controls | Sources/Documents/Admin may be required in separate contexts |
| 20 | Administration and operational recovery | Operations → provider/jobs/audit/AI control | 1–3 | Four operational concerns are stacked on one page; no section navigation; repeated Refresh controls | Imports/Exports/AI settings have separate user-facing surfaces |

## Workflow-wide observations

- Consequential flows correctly preserve human action, but the UI often exposes every prerequisite and downstream field simultaneously.
- The most frequent unnecessary context switches are between a record and Source/Document, Buyer and Contact, Placement and Outreach, Order and Account/Commission, and Copilot suggestions and their supporting records.
- Creation forms commonly sit beside live registers. This reduces navigation but overloads list pages and makes the primary task ambiguous.
- No dialogs or drawers means even short subordinate actions require inline expansion or a full route.
- There is no consistent workflow progress, prerequisite checklist, saved-draft indicator, or parent context header across domains.
- Exact click counts are less significant than scrolling and orientation cost: several workflows are nominally low-click but high-effort because all sections are vertically stacked.

