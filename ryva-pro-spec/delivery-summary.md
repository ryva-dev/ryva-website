# Delivery Summary

## Specification delivered

This directory is the complete first draft of the Ryva Pro first-production specification. It contains 38 detailed page specifications, 16 end-to-end journeys, five Mermaid diagram documents, eight Founder decision records, a connected entity model and field dictionary, 30 specified automations, AI and analytics contracts, access/security rules, release-gating acceptance tests, and a phased build sequence.

No files in The Ryva Standard, The Ryva Frameworks, or the Framework Pilot were changed while preparing this specification.

## Architecture proposed

A TypeScript modular monolith:

- React and Vite web client;
- Express 5 TypeScript API with domain modules;
- PostgreSQL as the sole operational record system;
- PostgreSQL full-text/trigram search;
- PostgreSQL-backed durable jobs;
- S3-compatible object storage;
- secure cookie sessions;
- provider adapters for credential verification, Stripe, email, storage, enrichment, and AI;
- one deployable application and worker process, with clear module boundaries that allow later separation only when measured need exists.

The model is relational and typed, with junction tables for real many-to-many relationships and limited JSONB for versioned source payloads, evidence snapshots, and safe extension data. It does not use generic EAV objects, microservices, Kafka, Elasticsearch, or a separate analytics warehouse in the first version.

## Key product decisions

- Active eligible certification and an active entitlement gate full use.
- Credential expiry receives a provisional 30-day read-only grace; suspension/revocation blocks external action and access as specified.
- Protected Account status records documentary rights; the platform does not create the right.
- Brand representation authorization is validated against Product, territory, channel, dates, and status before Buyer outreach.
- Exact external content, recipient, attachments, sender, and timing require human approval; material edits invalidate approval.
- AI is inspectable assistance with evidence, confidence, classification, and edit history—not an autonomous actor or final decision-maker.
- No production numerical Product Score or system-generated weighted pipeline launches in version one.
- An opening Order converts the Placement into an operational Account, protection review, Reorder basis, and explainable Commission history.
- Commercial continuity persists after an Opportunity closes or a Brand relationship ends.
- Certified Closer is not a separate permission role initially.
- Brand-side access is excluded from the first version.

## Founder decisions requiring ratification

All are implemented as reversible defaults in [Founder decisions](founder-decisions/README.md):

1. exact Protected Account review and conflict authority;
2. 30-day credential-expiry read-only grace;
3. no separate Certified Closer role;
4. qualitative/range forecast without system weighting;
5. no production numerical Product Score;
6. no Brand portal;
7. ticket-scoped, time-boxed Support access without impersonation;
8. retention categories now, exact periods only after specialist review.

The only default that cannot safely become final through product preference alone is the exact retention/deletion schedule. It needs applicable legal, tax, contractual, privacy, dispute, and backup-recovery review before launch.

## Principal delivery risks

- Credential authority and subscription events may arrive late or conflict; access must fail safely without destroying data.
- Representation scope and Protected Account rights may be ambiguous in source agreements; extraction cannot replace human review.
- Contact, buyer, social, review, and commerce data availability, licensing, freshness, and accuracy vary by provider.
- Email deliverability, opt-out obligations, identity matching, and provider webhook replay require operational monitoring.
- Commission bases, returns, clawbacks, currencies, taxes, and survival rights vary by agreement; formulas must be versioned and sourced.
- Duplicate Businesses and account conflicts can create trust and rights disputes if matching is overconfident.
- AI can hallucinate, misclassify evidence, or ingest adversarial content; manual paths and human gates are required.
- Analytics can become misleading before source records are complete and metric definitions stabilize.
- The current repository contains broad user-owned deletions; implementation must inspect and preserve that work rather than casually restoring historical code.

## Features intentionally excluded

- autonomous external sending or negotiation;
- production numerical intelligence scores and opaque rankings;
- system-weighted pipeline forecast before validation;
- Brand-side portal;
- Opportunity marketplace or automatic allocation;
- native mobile application;
- social feed, community, badges, and gamification;
- generic no-code custom-object builder;
- payroll, accounting, invoicing, tax, or legal-opinion system;
- separate data warehouse, search cluster, event bus, or microservices;
- automatic agreement approval, protected-right creation, commission dispute resolution, or consequential close/reject decisions.

## Recommended build order

1. Founder sign-off and delivery baseline.
2. Secure certification-gated platform foundation.
3. Connected record/evidence/activity kernel.
4. Product, Brand, and Buyer Intelligence.
5. Representation authority and Placement CRM.
6. Outreach Center.
7. Accounts, Orders, Reorders, and Commissions.
8. AI assistance on top of provenance and approvals.
9. Analytics, Home completion, and notifications.
10. Portability, administration, and operational hardening.
11. Controlled production launch.

See [Build sequence](build-sequence.md) for deliverables and gates.

## Next implementation instruction

Use [Exact Next Codex Prompt](implementation-handoff-prompt.md). It begins with Phase 1 only and requires repository inspection, implementation, automated validation, and a complete handoff rather than an outline.
