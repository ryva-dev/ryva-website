# Ryva Pro UI/UX Redesign Specification

Version: 1.0  
Status: implementation-ready design specification  
Prepared: 2026-07-20  
Scope: redesign of the existing Phase 1–9 application without changing product behavior

## Authority and inputs

This specification reconciles, in order:

1. the security, authority, evidence, human-approval, audit, and commercial-continuity requirements in `/ryva-pro-spec/`;
2. the 51-route implementation and the completed audit in `platform/docs/ui-audit/`;
3. the Ryva Design Bible v0.1;
4. the founder direction of 60% Venture CRM, 30% relationship-centered CRM, and 10% Stratus-style workflow thinking.

It defines the design direction closely enough that implementation should not invent new visual patterns. It does not authorize new product functionality, route changes, weaker permissions, new scoring, autonomous AI, or changes to business policy.

## Design outcome

Ryva Pro becomes a premium operating system for Brand Placement Representatives:

- neutral, calm, analytical, and professionally dense;
- relationship context visible without crowding the main task;
- one clear next action on consequential work;
- evidence, authority, risks, and human ownership adjacent to decisions;
- dense data in registers, not a gallery of cards;
- workflow visualization only where dependencies materially aid understanding;
- fully operational on mobile for time-sensitive representative work.

The product must not resemble a generic administration dashboard, social network, course platform, AI chat product, neon fintech interface, or card-and-pill template.

## Resolved audit priorities

| Priority | Resolution | Canonical specification |
|---|---|---|
| Global navigation | Grouped persistent sidebar, compact mode, command search, profile/notification utilities, mobile bottom nav and More sheet | `navigation-redesign.md`, `application-shell.md` |
| Duplicate records | Dedicated Intelligence routes become canonical; generic record routes remain route-compatible transitional aliases/surfaces | `information-architecture.md`, `migration-plan.md` |
| Detail hierarchy | Identity header + focused tabs + operational center + contextual rail + visible next action | `page-patterns.md` |
| Registers | One table/register contract for search, filters, saved views, columns, sorting, pagination, actions, and states | `page-patterns.md`, `component-system.md` |
| Consequential workflows | Readiness summary, evidence/authority blockers, focused review, explicit confirmation, and immutable outcome | `page-patterns.md`, `workflows/` |

## Inventory

- **51** page redesign specifications in `pages/`
- **9** standard page patterns
- **48** consolidated component contracts
- **7** selected workflow-visualization specifications
- **3** architecture/anatomy diagrams
- **17** implementation increments that preserve working behavior

## Specification index

### Direction and system

- `design-direction.md`
- `visual-tokens.md`
- `typography.md`
- `color-and-surfaces.md`
- `spacing-and-density.md`
- `interaction-and-motion.md`
- `accessibility-standard.md`
- `responsive-system.md`

### Structure

- `navigation-redesign.md`
- `information-architecture.md`
- `application-shell.md`
- `page-patterns.md`
- `component-system.md`

### Delivery

- `redesign-priorities.md`
- `migration-plan.md`
- `regression-protection.md`
- `founder-decisions.md`
- `implementation-handoff-prompt.md`

### Detailed specifications

- `pages/README.md` and 51 route files
- `workflows/README.md` and seven lifecycle files
- `diagrams/navigation-architecture.md`
- `diagrams/detail-page-anatomy.md`
- `diagrams/redesign-dependencies.md`

## Non-negotiable implementation rules

- Preserve every current route and valid deep link.
- Preserve server-side authorization as the authority; visual availability never grants permission.
- Do not merge conceptually distinct approval, authority, qualification, payment, or outreach actions.
- Do not hide evidence gaps, legal ambiguity, suppression, stale data, unknowns, or provider degradation.
- Do not convert qualitative judgments into scores.
- Do not make AI the dominant surface or permit it to execute consequential actions.
- Do not redesign with fake live data.
- Maintain all Phase 1–9 tests and add visual/accessibility coverage as pages migrate.
