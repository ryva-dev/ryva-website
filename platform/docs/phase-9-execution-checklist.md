# Phase 9 Execution Checklist

Status values are `pending`, `passing`, `blocked_external`, or
`specialist_review_required`. This checklist is implementation evidence, not a
launch declaration.

## Data operations

- passing — bounded CSV validation, allowlisted mapping and durable row preview;
- passing — exact-digest import approval and idempotent transactional commit;
- passing — row-level outcome/error CSV, target links and safe retry result;
- passing — duplicate field comparison, explicit canonical merge and reversal;
- passing — non-destructive relationship/history preservation, aliases and search resolution;
- passing — durable-job JSON/CSV-bundle export with manifest, digest and expiry.

## Administration and policy

- passing — safe user, access, credential, subscription and workspace metadata;
- passing — safe provider configuration, job, feature-control and launch status;
- passing — reasoned MFA/CSRF/capability-protected administrative commands;
- passing — ticket/time/record/field-scoped support access, revocation and no impersonation;
- passing — grouped notification history, lifecycle/expiry, settings and import/export notices;
- passing — null-duration retention classes, legal holds and reviewed account closure.

## Production hardening

- passing — PostgreSQL search filters, stable offset pagination, aliases and indexes;
- passing — bounded workload controls and documented measurable performance budgets;
- passing — `otplib` v13 migration and zero-vulnerability production audit;
- passing — privilege, tenant, authority, export and CSV-formula injection tests;
- specialist_review_required — WCAG 2.2 AA implementation/browser coverage passes;
  final manual assistive-technology review remains a launch gate;
- passing — structured operational status, alert definitions and incident runbooks;
- passing — 11-migration isolated backup/restore and migration recovery drill;
- passing — staged deployment/rollback runbook, release preflight and container smoke;
- passing — configuration/policy-derived launch checklist reports **Not Ready**.

## Current external state

- blocked_external — production PostgreSQL configuration;
- blocked_external — S3-compatible object storage;
- blocked_external — malware scanner;
- blocked_external — email delivery/webhooks and verified sender;
- blocked_external — Stripe and approved price;
- blocked_external — certification provider API/webhooks;
- blocked_external — AI provider and approved terms;
- blocked_external — external intelligence provider;
- specialist_review_required — privacy, terms, refund, retention and outreach
  compliance policies.

Current launch status: **Not Ready**. Application construction may proceed, but
the status cannot advance until required provider and policy checks are real.
