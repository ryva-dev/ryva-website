# Existing State, Constraints, and Architecture Recommendation

## Files reviewed

### Governing documentation

- all documents in `the-ryva-standard/`;
- all documents in `ryva-frameworks/`;
- all documents in `framework-pilot/`, including the MVP data model and initial findings.

### Active repository state

The active worktree contains the governing documentation and packaged archives. The prior application, server, migrations, and product documents are deleted in the working tree. Those deletions are treated as intentional user-owned changes and are not restored or modified.

### Historical technical precedent inspected from Git

- `package.json` and `package-lock.json`;
- `vite.config.ts` and TypeScript configurations;
- `src/App.tsx` and frontend entry;
- `server/index.mjs`;
- `server/db.mjs`;
- `server/db/migrations/001_initial_schema.sql`;
- historical role, authorization, encryption, integration, billing, upload, audit, and test modules.

The historical system used React 18, Vite, TypeScript, Express 5, PostgreSQL/SQLite adapters, cookie sessions, Stripe, S3-compatible storage, background jobs, Google OAuth, rate limiting, encryption, Playwright, and Node tests. It is precedent, not an active codebase or product model.

## Current product assumptions

1. Ryva Pro is a certification-gated operating system for individual Brand Placement Representatives.
2. The first production version is a complete coherent product, not a disposable prototype.
3. Product, Brand, Business, Contact, representation mandate, Placement Opportunity, account, order, reorder, and commission records remain distinct but connected.
4. The Placement Cycle is the lifecycle backbone. Workspace-specific pipelines map to it without replacing it.
5. External outreach always requires explicit user approval of the exact final communication.
6. Production numerical Product, Brand, Business Fit, and Opportunity scores are excluded until pilot validation supports them.
7. Evidence confidence and qualification states are allowed because they are explainable categorical decisions.
8. Forecasts are estimates and remain visually and structurally separate from orders, earned commissions, and paid commissions.
9. Brand-side access is excluded from the first version.
10. One user receives one personal workspace at launch. The schema uses `workspace_id` to permit future teams without exposing team administration now.

## Conflicts and defaults

### Certified Closer

The Standard establishes Certified Representative, not Certified Closer. The product does not create a separate credential or role. “Closing capability” may be an optional program completion flag after Founder approval.

### Protected Account

The Frameworks previously deferred Protected Account policy. This product brief now requires the record. The specification implements it as a documented, agreement-derived protection claim requiring human approval, scope, evidence, dates, conflict handling, and expiry. It never creates rights beyond the underlying agreement.

### Certification expiry and grace

Default: active credential is required for normal use. Expiry starts a 30-day read-only renewal grace period with export and renewal access but no outreach, stage advancement, new Opportunities, or AI generation. Suspension immediately removes action rights but permits read-only access when allowed by the suspension record. Revocation immediately blocks Ryva Pro; personal-data export is handled through a controlled account request.

### Forecast probability

No system-generated stage probability is used initially. Users may enter a low/base/high order estimate and a qualitative likelihood with evidence. Weighted pipeline remains disabled until forecasting behavior is validated.

### Product scoring

Qualification state, critical evidence, confidence, and human decision are displayed. A numerical score field is reserved but hidden and unused.

## Recommended architecture

Use a TypeScript modular monolith:

- React and TypeScript web client;
- Express 5 TypeScript API;
- PostgreSQL as the single system of record;
- Postgres full-text and trigram search;
- Postgres-backed durable job queue;
- S3-compatible object storage for documents;
- encrypted provider credentials and sensitive fields;
- Stripe for subscription lifecycle;
- email/calendar provider adapters behind narrow interfaces;
- AI provider abstraction with evidence, approval, and audit enforcement outside prompts;
- REST endpoints with transactional domain services;
- Playwright end-to-end and Node integration/unit tests.

Do not introduce microservices, Kafka, Elasticsearch, a generic EAV database, a separate data warehouse, or a native mobile application for the first production version.

## Module boundaries

1. Identity, credentials, subscription, and access.
2. Workspace, profile, onboarding, and preferences.
3. Product and Brand intelligence.
4. Business and Contact intelligence.
5. Representation mandates and account protection.
6. Placement CRM and lifecycle.
7. Outreach, tasks, calendar, and activities.
8. Accounts, orders, reorders, and commissions.
9. Evidence, decisions, risks, human approvals, and AI suggestions.
10. Search, views, documents, import/export, and deduplication.
11. Analytics, forecasting, notifications, and audit.
12. Administration and support access.

Modules share one database but may access another module's data only through exported service functions or read models. Cross-module writes execute through explicit domain commands and transactions.

## Deployment shape

- one web/API service;
- one job-worker process built from the same repository and domain modules;
- one managed PostgreSQL database;
- one object-storage bucket;
- managed email, billing, observability, and AI providers;
- separate development, staging, and production environments.

The API and worker may scale independently without becoming separate products.

## Quality posture

Critical authorization, evidence, approval, commission, account-protection, deletion, export, and audit behavior must be enforced in code and covered by automated tests. Prompt text and UI hiding are not security controls.

