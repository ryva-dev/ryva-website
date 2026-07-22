# Redesign Migration Plan

## Migration strategy

The redesign is an incremental replacement inside the existing modular monolith. Every increment is production-quality, tested, and retained. Old and new components may coexist temporarily behind route-local migration boundaries, but a route never ships as a nonfunctional mockup.

No database or API change is required merely to restyle a surface. If a UI requirement reveals missing server data, implementation must first prove it already exists in current domain/API contracts or log a separate product decision; the redesign does not invent it.

## Exact implementation order

### 1. Tokens and shared foundations

Implement token stylesheet/theme typing, font loading/fallback, focus, reduced motion, base typography, icon contract, and isolated examples. No page layout migration.

**Exit:** token-use checks, contrast, focus and visual snapshots pass.

### 2. Shared components

Implement the 48 contracts in dependency order: actions/inputs → states → overlays → navigation/data → domain indicators. Adapt legacy APIs where needed.

**Exit:** isolated state/accessibility tests; no legacy caller broken.

### 3. Application shell and navigation

Migrate ProtectedLayout, grouped sidebar, search command, notifications panel, profile/account menu, access banners, tablet rail, mobile bottom nav/More sheet.

**Exit:** all roles/access states and all 51 routes reachable; login/access tests pass.

### 4. Standard Register

Migrate shared Table/DataRow, FilterBar, SavedViewSelector, columns/density/pagination, state model, preview drawer.

Pilot on Sources and Territories, then Documents/Tasks/Notifications.

**Exit:** saved views, filters, responsive rows, empty/error/loading and permission tests pass.

### 5. Standard Relationship Detail

Implement IdentityHeader, Tabs, ActivityTimeline, ContextRail, relationship trail, drawers, mobile context.

Pilot on Contact detail, then expand.

**Exit:** detail state and focus model proven without lost action/history.

### 6. Consequential Review

Implement ApprovalPanel, readiness/blockers, exact-artifact summary, validation summary, confirmation and audit outcome. Pilot on AI suggestion (no external side effect), then protected account.

**Exit:** no enablement/policy regression; input preservation and version-conflict tests pass.

### 7. Home

Migrate Command Center and attention roles.

**Exit:** priority ordering/reasons, currency separation, AI degradation and empty truth pass.

### 8. Product Intelligence

Migrate Product register/split view/detail/comparison and generic Product compatibility.

**Exit:** evidence/qualification/comparison/no-score tests pass.

### 9. Brand Intelligence

Migrate Brand register/detail and generic Brand compatibility.

**Exit:** identity/qualification/representation prerequisites pass.

### 10. Businesses, Buyers, and Contacts

Migrate Buyer/Business split/detail, Contact detail/register compatibility, Buyer lookup mobile.

**Exit:** Contact verification, fit, workspace isolation and mobile call-prep tests pass.

### 11. Representation and Agreement authority

Migrate register/detail, Agreement Consequential Review, authority/readiness visualization.

**Exit:** all Phase 4 authority, immutable document, conflict, ambiguity and approval tests pass.

### 12. Placement CRM and detail

Migrate Kanban/Table, stage-grouped mobile list, Placement relationship detail and transition review.

**Exit:** stage/triangle/decision/next-action/authority tests and accessible alternative pass.

### 13. Outreach Center

Migrate communication workspace, Templates, Sequences, exact artifact review, call workflow and responsive actions.

**Exit:** all Phase 5 authority/scope/conflict/suppression/approval/provider/audit tests pass.

### 14. Accounts, Orders, Reorders, and Protection

Migrate commercial registers/details, Order creation/revision/verification, protection, account health and continuity.

**Exit:** Order → Account, protection separation, reorder honesty, currency and audit tests pass.

### 15. Commissions and Disputes

Migrate register/detail, formula/explanation, approval/payment and dispute review.

**Exit:** calculation reproducibility, state separation, payment/dispute human controls pass.

### 16. Analytics, Reports, Data transfer, Settings, and Operations

Migrate Analytics/Reports, Imports, Exports, Profile/Certification/Subscription/Settings/Access/Admin and remaining utilities.

**Exit:** Phase 1, 7, 8, 9 and all applicable quality tests pass.

### 17. Responsive, accessibility, and final consistency consolidation

Run all routes with populated, empty, loading, error, read-only, blocked, provider-degraded and role states. Remove unused legacy components only after caller proof.

**Status:** Structurally complete in Increment 17. Route inventory, document titles, Protected Account detail canonical ownership, cross-product e2e, and structural QA checklist are recorded under `docs/ui-redesign-spec/`. Final Claude-led brand beautification remains a separate post-redesign pass.

**Exit:** full Phase 1–9 suite, WCAG gate, visual snapshots, performance targets, terminology and token audit pass.

## Preservation rules

- One route/workflow migrates at a time.
- No production route uses static mock records.
- New components call existing APIs/domain services.
- Existing forms remain available until migrated action parity is proven.
- No component removal in the same commit that first introduces its replacement across many domains.
- Each increment updates a migration ledger with routes, states, tests, deviations and unresolved decisions.

## Rollback

Use route-local component boundaries or short-lived UI flags only when they preserve both implementations against the same live APIs. Flags cannot weaken policy or persist as permanent product variants. Database rollback is not expected for visual increments; any schema change requires its own reversible migration.

## Migration risk register

| Risk | Control |
|---|---|
| Hidden action during tab migration | Route action-parity checklist |
| Stale approval state in drawer | Version included in action; server revalidation |
| Permission inferred from component | API authorization tests for every action |
| Saved-view incompatibility | Adapter + round-trip fixtures |
| Lost list context | navigation-state browser tests |
| Mobile missing action | required mobile journey suite |
| Focus regression | component + journey keyboard tests |
| Visual-only stage change | Table/form equivalence and server audit assertion |
| Old/new state vocabulary mismatch | authored status dictionary |
| Legacy component removed early | caller search and migration ledger gate |

