# Ryva Pro Implementation Ledger

**Construction model:** One complete production product built in the documented order. Increments are durable parts of the final system, not separate launches or disposable experiments.  
**Completed increment:** Phase 9 — Data portability, administration, operational hardening, and launch readiness  
**Completed redesign increment:** UI Redesign Increment 2 — Shared component system  
**Active construction increment:** UI Redesign Increment 3 — Application shell and global navigation  
**Last updated:** 2026-07-20

## UI Redesign Increment 3 scope ledger

| Requirement | Status | Implementation evidence |
|---|---|---|
| Approved global navigation hierarchy | Implemented; validation active | Operate, Intelligence, Commercial, Analyze, and System groups with capability-controlled Operations |
| Desktop application shell | Implemented; validation active | Persistent 240/72 token-driven sidebar, expanded/collapsed states, active routes, tooltips, utility footer and profile menu |
| Tablet navigation | Implemented; validation active | 72-wide collapsed rail at the approved tablet breakpoint with temporary overlay expansion, scrim dismissal and route-close behavior |
| Mobile navigation | Implemented; validation active | Fixed top context bar, Home/Tasks/Placements/Search/More bottom navigation and full-height More sheet |
| Shell utilities | Implemented; validation active | Search and keyboard shortcut, unread Notifications, status-aware profile menu, Certification, Subscription, Settings and sign out |
| Capability and access behavior | Implemented; validation active | Restricted access navigation is derived from server-issued capabilities; Operations remains Admin/Support only |
| Accessibility behavior | Implemented; validation active | Navigation landmarks, active-page semantics, focus trap/restore, Escape close, body scroll lock, live menu state, tooltips and reduced motion |
| Contextual route preservation | Implemented; validation active | Contacts, Sources, Territories and AI Copilot remain valid contextual routes without global-navigation promotion |
| Route/workflow/business logic preservation | Implemented; validation active | Existing protected route boundary now composes the shared shell; APIs, domain logic, page markup and all 51 route declarations remain unchanged |
| Increment 3 regression coverage | Implemented; validation active | Navigation contract unit tests plus desktop/mobile shell, focus and overflow browser journeys |
| Home/workspace/page redesign | Not started by design | Explicitly reserved for Increment 4 and later |

## UI Redesign Increment 2 scope ledger

| Requirement | Status | Implementation evidence |
|---|---|---|
| Token-driven component architecture | Complete | 41 current-scope contracts exported from `apps/web/src/design-system`; component CSS passes the Increment 1 raw-value policy |
| Actions and form controls | Complete | Shared Button/ButtonGroup and current-scope input controls with compact/default/touch, disabled, loading, read-only, error, keyboard, and label contracts |
| Structural components | Complete | PageHeader, SectionHeader, Toolbar, FilterBar, SavedViewSelector, and Tabs with legacy-compatible markup/classes |
| Data and state components | Complete | Table/DataRow, Empty/Error/Loading/Skeleton, StatusLabel/Badge, Metric, CurrencyValue, and ForecastRange |
| Relationship/workflow components | Complete | Identity, timeline, risk, authority, evidence, notification, task, AI, and approval contracts for existing workflows |
| Feedback components | Complete | Shared persistent Banner and scoped Alert severity contracts |
| Existing shared primitive consolidation | Complete | `components.tsx` delegates Field, PageHeader, Loading, ErrorPanel, and StatusPill to the design system |
| Domain duplicate consolidation | Complete | Commerce saved views/empty states/tabs and Analytics tables/rows/empty states/metrics/tabs consume shared contracts |
| Compatibility styling | Complete | Existing button/field/table/state/status/metric/banner classes resolve through one shared token-driven stylesheet |
| Component contract tests | Complete | Server-rendered unit tests cover loading actions, field associations, semantic statuses, states, table naming, and token-only CSS |
| Absent future interactions | Not started by design | IconButton, MultiSelect, Combobox, overlays, ContextRail/EvidenceDrawer, charts, Kanban, and PipelineCard are absent from the current application and were not invented |
| Shell/navigation/pages/layouts | Not started by design | Explicitly reserved for later redesign increments |

### Increment 2 validation results

- `npm run lint`: passed, including the token-only component policy.
- `npm run typecheck`: passed for strict server and web projects.
- `npm run test:unit`: 19 passed, including 6 shared-component contract tests.
- `npm run test:integration`: 62 passed against PostgreSQL; all Phase 1–9 domain, security, authority, provenance, and audit behavior remained intact.
- `npm run test:e2e`: 42 passed across desktop Chrome and Pixel 7 profiles.
- `npm run build`: passed; Vite transformed 79 modules and emitted the production client/server build.
- Rendered inspection: Products, Commerce, and Analytics verified with shared fields, statuses, tabs, table caption/header semantics, tokenized states, and no component-originated document overflow.

## UI Redesign Increment 1 scope ledger

| Requirement | Status | Implementation evidence |
|---|---|---|
| Canonical design tokens | Complete | CSS variables and typed TypeScript contract cover typography, spacing, sizing, widths, radii, palette, semantics, borders, elevation, icons, controls, motion, focus, z-index and breakpoints |
| Deep Juniper light theme | Complete | Approved default accent and restrained neutral/surface hierarchy; no dark theme, neon, glass, or gradient in the new foundation |
| Global typography and canvas | Complete | Tokenized sans/mono stacks, professional 11–36 px scale, base 14/20 text, tabular numerals, canvas/text foundations |
| Responsive foundation | Complete | 1440/1024/768 breakpoint contract and responsive gutter/section variables; 320 px minimum reflow foundation |
| Focus and reduced motion | Complete | Tokenized 2+2 px focus ring and near-instant reduced-motion override |
| Legacy compatibility | Complete | Existing Phase 1–9 aliases map to canonical tokens; no class/component/route/layout migration |
| Static value protection | Complete | `lint:tokens` rejects raw values, gradients and glass effects in future redesign-system directories while allowing legacy migration debt |
| Contrast and contract tests | Complete | Unit tests verify WCAG AA text pairs, CSS/TypeScript contract, breakpoints and anti-pattern exclusions |
| Documentation | Complete | `docs/ui-redesign-spec/increment-1-implementation.md` records scope, defaults and migration boundary |
| Regression validation | Passing | ESLint/token policy, strict server/web TypeScript, 13 unit tests, 62 PostgreSQL integration tests, 42 desktop/mobile browser tests, and production build |
| Live visual inspection | Passing | Authenticated Home inspected at 1440 × 900 and 390 × 844; canonical palette/font/focus/motion/gutter tokens loaded and neither viewport produced document overflow |
| Shared components/navigation/pages | Not started by design | Explicitly reserved for later redesign increments |

### Increment 1 validation results

- `npm run lint`: passed, including the design-token policy.
- `npm run typecheck`: passed for strict server and web projects.
- `npm test`: 75 passed (13 unit and 62 PostgreSQL integration), 0 failed.
- `npm run test:e2e`: 42 passed across desktop Chrome and Pixel 7 profiles, 0 failed.
- `npm run build`: passed; Vite transformed 70 modules and emitted the production client/server build.

## Phase 1 requirement ledger

| Requirement | Status | Implementation evidence |
|---|---|---|
| TypeScript modular-monolith workspace | Complete | `apps/`, `packages/`, strict TypeScript, ESLint, Vite, Express |
| Environment validation | Complete | `packages/config`; production fail-fast rules |
| PostgreSQL-only connection and transactions | Complete | `packages/database`; pool, SSL policy, `withTransaction` |
| Controlled migrations | Complete | advisory lock, transactional ordered SQL, migration history |
| Stable identifiers and UTC timestamps | Complete | UUID application IDs; PostgreSQL `timestamptz` |
| Optimistic concurrency | Complete | versioned User/Profile/Workspace/Settings; conflict response |
| Structured secret-safe logging and correlation IDs | Complete | redacting logger and `x-request-id` |
| Workspace/User/Membership | Complete | typed relational tables and tenant-derived session identity |
| Certification Credential | Complete | signed webhook, provider refresh adapter, status history fields |
| Subscription Entitlement | Complete | Stripe Checkout/Portal and signed subscription reconciliation |
| Secure sessions | Complete | salted scrypt, keyed token digests, HttpOnly cookies, revocation |
| Roles and server policy | Complete | Representative/Mentor/Instructor/Admin/Support capability policy |
| Credential and billing access states | Complete | active, grace, expired, suspended, revoked, paid-through, read-only |
| Login | Complete | generic errors, shared rate limit, staff TOTP, audit |
| Certification Access Check and Status | Complete | responsive UI with trusted-state explanation and refresh recovery |
| Subscription Activation and Status | Complete | provider-backed UI; unavailable provider fails visibly and safely |
| Profile | Complete | persisted professional/regional fields and concurrency |
| Settings | Complete | persisted attention defaults, mandatory AI-off state, session review |
| Minimal Admin | Complete | MFA, job/dead-letter view/retry, audit view, scoped support grants |
| Append-only Audit Event | Complete | service plus PostgreSQL mutation-prevention trigger |
| Durable jobs | Complete | idempotent enqueue, SKIP LOCKED lease, retry/dead state, ownership |
| Security controls | Complete | CSP/headers, CSRF, origin, rate limit, validation, tenant isolation |
| Staff least privilege | Complete | no impersonation; time/record/field-scoped Support access |
| Synthetic fixtures | Complete | explicit synthetic-only seed, production refusal |
| Local/deployment/recovery documentation | Complete | `README.md` and `docs/` |
| CI workflow | Complete | PostgreSQL, audit, lint, typecheck, tests, build, container smoke |

## Acceptance and validation ledger

| Acceptance | Status | Automated coverage |
|---|---|---|
| ACC-001 uncertified blocked | Passing | PostgreSQL API integration + browser journey |
| ACC-002 eligible access | Passing | PostgreSQL API integration + browser journey |
| ACC-003 credential grace read-only/export capability | Passing | Policy unit + API integration + mobile/desktop browser |
| ACC-004 grace-ended restriction | Passing | Policy unit + API integration |
| ACC-005 suspension behavior | Passing | Policy unit + API integration |
| ACC-006 revocation/session invalidation | Passing | API/provider reconciliation integration |
| ACC-007 canceled paid-through and ended behavior | Passing | Policy unit + API integration |
| ACC-008 workspace isolation | Passing | API integration returning concealed 404 |
| ACC-009 ticket/time/field-scoped Support access | Passing | Staff TOTP + API integration + audit |
| ACC-010 Representative denied Admin actions | Passing | API integration |
| QLT-001 material audit events | Passing for Phase 1 entities | API integration and audit assertions |
| QLT-002 immutable audit | Passing | PostgreSQL trigger test |
| QLT-003 optimistic concurrency | Passing | API integration |
| QLT-004 idempotent durable jobs | Passing | PostgreSQL integration |
| QLT-005 safe recoverable errors | Passing for Phase 1 providers/forms | API/UI behavior |
| QLT-006 session/CSRF/injection/authorization controls | Passing for Phase 1 scope | Unit and integration |
| QLT-007 responsive core access workflows | Passing | Desktop and mobile Chromium journeys |
| QLT-008 accessibility target | Partially automated | Semantic UI/keyboard/focus/reduced-motion built; formal audit remains pre-launch |
| QLT-010 migration and restore | Passing locally | Fresh migration plus backup/restore drill |

## Validation results

Record exact command results after each complete run:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run test:e2e`
- `npm run build`
- `npm audit --omit=dev --audit-level=high`
- `npm run drill:backup-restore`
- Docker image build and health/readiness smoke

## Deviations and external setup

- The intentionally deleted historical application was not restored. New product code is isolated under `/platform/`.
- The user-modified root `.env.example` was not overwritten. `/platform/.env.example` is canonical for Ryva Pro.
- Live certification authority and Stripe credentials are unavailable locally. Production adapters and signed webhooks are implemented; live sandbox verification requires provider access.
- OAuth login is not advertised in the UI because no approved OAuth provider is configured. Password plus mandatory staff TOTP is operational.
- Exact legal retention periods remain unresolved under RPD-008. Tables support retention categories and audit, but destructive retention automation is intentionally absent.
- A formal human WCAG 2.2 AA audit and production threat-model review remain launch controls, not substitutes for implemented semantics and automated checks.

## Remaining product construction

### Phase 2 ledger

| Requirement | Status | Implementation evidence |
|---|---|---|
| Core connected entities | Complete | Migration `0002`; Brand, Product, Business Buyer, Contact, Source, Evidence, Risk, Decision, Approval, Note, Activity, Task, Document, Territory, Saved View, Notification |
| Core record API and relationships | Complete | Workspace-scoped create/list/read/update and relationship context |
| Evidence provenance | Complete | Required categorical class, source for known evidence, reason for Unknown; evidence is immutable |
| Notes, history, tasks, risks, decisions | Complete | Versioned notes, task gate rules, activity timeline, audited artifacts |
| Documents | Complete for kernel | Local-development and S3 adapters, signed uploads, hash/size verification, quarantine, signed scan callback, clean-only download |
| Responsive record surfaces | Complete | Index/detail, relationship and Buyer context, evidence, task, note, decision/risk/document/timeline panels, filters, table/card/list layouts |
| Global search | Complete | PostgreSQL trigram/full-text indexes with workspace predicate before ranking |
| Import preview | Complete | Mapping, row validation, duplicate candidates, expiring preview; no premature commit |
| Duplicate suggestions | Complete | Explainable candidates; exact duplicate requires review; no auto-merge |
| Saved views and notifications | Kernel complete | Authorized saved definitions; ordered notification register and blocking-resolution rule |
| Business Buyer and Territory services | Complete | Authority-aware Buyer roles; proposed scope register that does not create representation authority |
| Phase 2 browser and accessibility gate | Passing | Connected Brand/evidence/search journey passes desktop and mobile Chromium; semantic labels and keyboard paths present |

### Latest verified results

- ESLint: clean.
- Strict server and web TypeScript: clean.
- Unit tests: 10 passed.
- PostgreSQL integration tests: 21 passed, including ACC-001 through ACC-010.
- Playwright: 8 passed across desktop and mobile Chromium.
- Production client/server build: passed.
- Production dependency audit: 0 vulnerabilities.
- Backup/restore drill: passed with 2 migrations restored.
- Docker image `ryva-pro:phase2`: built; `/healthz` and `/readyz` passed from the container.

Phase 2 is complete. Phase 3 is the active construction increment; no Phase 3 intelligence views have been represented as complete yet.

## Phase 3 scope ledger

| Requirement | Status | Planned implementation and acceptance evidence |
|---|---|---|
| Product Intelligence views | Complete | Discover, Watchlist, Under Review, Qualified, Rejected, Represented, Recently Updated; workspace-scoped server filters, saved views, freshness, unknown and risk context |
| Product diligence and qualification | Complete | Typed readiness/market fields, evidence links, unsupported claims, observations, human Decision/Task gates, optimistic concurrency and audit |
| Product comparison | Complete | Two-to-four aligned Products, explicit context, evidence/risk/unknown/last-reviewed cells and explicit no-score/no-ranking limits |
| Buyer-category recommendations | Complete | Categorical recommendation, rationale, evidence, missing data, confidence, origin and human confirm/reject disposition |
| Brand Intelligence pipeline | Complete for Phase 3 boundary | Evidence-gated Discovered, Researching, Contact Ready and Rejected; later outreach stages fail closed until their construction increments |
| Representation authority boundary | Complete | `Authorized`, `Active`, and Product `represented` remain server-blocked until Phase 4 supplies a current verified Agreement |
| Business and Buyer Intelligence | Complete | Qualification fields, geography list filters, saved views, human Contact verification and evidence-linked Buyer authority |
| Product–Business match review | Complete | Context digest, classified material statements, evidence, unknowns, contrary evidence, confidence, human decision, next action and audit |
| Source freshness and adapters | Complete for Phase 3 | Supersedable observations retain acquisition context and history; provider adapter is bounded; manual operation remains complete when unavailable |
| Imports and duplicates | Complete for Phase 3 boundary | Phase 3 mappings, validation, prospective counts, provenance and authority implications; no commit before the Phase 9 controlled workflow |
| Responsive and accessible journeys | Passing | Product, Brand and Buyer journeys pass desktop and mobile Chromium with empty/loading/error states and semantic controls |
| INT-001 through INT-008 | Passing for applicable Phase 3 behavior | PostgreSQL tests cover INT-001 and INT-003–007; INT-002 unsupported-claim visibility/AI-origin rejection; existing duplicate test covers INT-008 |

### Phase 3 construction decisions

- **No numerical scoring:** RPD-005 remains controlling. Qualification uses categorical evidence confidence, readiness, risk, a named human decision and next action.
- **No premature AI layer:** Phase 7 owns model execution. Phase 3 records origin and supports reviewable AI-origin recommendations if introduced later, but ships a complete manual workflow and makes no synthetic AI claims.
- **Brand pipeline boundary:** Phase 3 implements diligence and pre-authority transitions. `Authorized` and `Active` fail closed until Phase 4 introduces a verified Representation Agreement and shared authority validator.
- **No map vendor:** Structured addresses/geography and list filters are implemented. A map is deferred because geography list filtering is sufficient and no vendor decision is required.
- **No import commit expansion:** Controlled Phase 3 previews expose mapping, errors, duplicates and authority implications. Idempotent commit/report/merge remains Phase 9 per the documented sequence.

### Data-model conflicts and resolutions

- Existing Phase 2 `brands.status` used Product-like values. A forward migration will add a dedicated `pipeline_stage`; the legacy column remains compatible during rollout and is no longer authoritative for Brand diligence.
- Product/Brand/Business summaries alone cannot prove provenance. Typed intelligence fields will be paired with field-to-Evidence links and origin metadata; values will not be hidden in a generic EAV model.
- Representation Agreement does not yet exist by construction order. Authority-requiring Brand transitions remain impossible rather than being simulated.

No material Founder decision beyond the existing RPD defaults was required for Phase 3.

### Phase 3 migrations

- `0003_phase3_intelligence.sql`: typed intelligence fields, field–Evidence provenance,
  immutable observations and supersession, Buyer-category recommendations,
  Product–Business match reviews, comparisons, and append-only Brand stage events.
- `0004_phase3_buyer_authority.sql`: evidence-linked Business Buyer authority.

### Phase 3 verified results

- ESLint: clean.
- Strict server and web TypeScript: clean.
- Unit tests: 10 passed.
- PostgreSQL integration tests: 27 passed; 0 failed.
- Playwright: 12 passed across desktop and mobile Chromium; 0 failed.
- Production client/server build: passed.
- Production dependency audit: 0 vulnerabilities.
- Backup/restore drill: passed with 4 migrations restored.
- Docker image `ryva-pro:phase3`: built; `/healthz` and `/readyz` passed from the container.

### Phase 3 deviations and pending integrations

- Live external intelligence credentials are unavailable. The schema-validated HTTP
  adapter and complete manual/provenance workflow exist; no provider candidate is
  represented as live intelligence.
- Model execution remains Phase 7. Phase 3 rejects `ai_suggested` public writes while
  retaining typed origin fields for the later reviewed-suggestion workflow.
- Map rendering was not added because the specification allows list-based geography
  and no map-vendor decision exists. Structured geography remains filterable.
- Import commit/report and merge remain Phase 9 by the documented build order.
- INT-002’s future draft-use blocking will receive additional end-to-end coverage when
  draft content exists; Phase 3 already exposes unsupported claims and prevents AI
  output from promoting them to Verified Fact.

Phase 3 is complete. Phase 4 — Representation Workspace and Agreement authority — is
the next active construction increment. Phase 3 authority-dependent states are already
fail-closed for that increment.

## Phase 4 scope ledger

| Requirement | Status | Planned implementation and acceptance evidence |
|---|---|---|
| Representation Opportunities | Complete | Workspace-scoped opportunity lifecycle, scoped Products, Contact, proposed channels/territory, next action, Decision, optimistic concurrency and append-only event history |
| Representation Agreements | Complete | Draft/review/pending/active/suspended/expired/ended records with effective/expiration/renewal, territory, channel and Product scope; commission, opening/reorder, termination and post-termination terms |
| Immutable Agreement originals | Complete | Opportunity-linked Document upload through the hash-verified, quarantine-first object-storage boundary; Agreement activation requires an active clean original |
| Evidence-linked extraction | Complete | Field candidates retain Document/page/location, origin, evidence class, confidence and ambiguity; editable human confirmation is required before application |
| Human authority approval | Complete | Canonical material-scope digest, exact-artifact Human Approval, human-only activation, fresh validation and append-only authority decision history |
| Brand and Product authority gates | Complete | Shared server validator replaces Phase 3 placeholders for Brand Authorized/Active and Product represented |
| Placement Opportunities | Complete for Phase 4 boundary | Product/Business/Agreement junctions, Relationship Triangle, Decision Review, stage events, backward/loss/reopen rules, next actions and computed stalled state |
| Agreement/account conflicts | Complete | Explicit written house-account/protected-basis restrictions; exact conflicts block and uncertain normalized-name matches require human review |
| Buyer-outreach gate | Complete | Shared authority evaluation controls preparation/approval/send eligibility; actual Outreach execution remains Phase 5 |
| Home and responsive workspaces | Complete | Representation, Agreement and Placement list/detail surfaces; empty/loading/error/conflict states; next-action, stalled and authority-risk Home data |
| Imports | Complete for Phase 4 boundary | Representation Opportunity and Agreement term preview mappings, validation and authority warnings; controlled commit remains Phase 9 |
| PLC-001 through PLC-010 and journeys 03/05 | Passing for applicable Phase 4 behavior | PostgreSQL API coverage plus desktop/mobile browser coverage; actual send continuation remains Phase 5 |

### Phase 4 construction decisions

- **Written rights are not platform-created rights:** Phase 4 stores Agreement-derived
  protected-account bases and house-account exclusions as scoped restrictions with
  Document locations. It does not create the operational `Protected Account` entity,
  which remains Phase 6.
- **Outreach execution stays in Phase 5:** Phase 4 supplies the mandatory shared
  authority decision service and blocks approval/send when authority is absent or
  invalid. It does not add a skeletal sender or imply that preparation is outreach.
- **AI execution stays in Phase 7:** Phase 4 provides reviewable extraction-candidate
  storage. Public writes cannot claim AI origin, and no candidate becomes a term or
  authority without human confirmation.
- **Legal ambiguity is never interpreted by the system:** Ambiguous material terms
  require a flag and may require specialist review. Activation fails while a material
  ambiguity remains unresolved.
- **No numerical scoring:** Placement and authority decisions remain categorical,
  evidence-linked and human-owned under RPD-005.

### Phase 4 data-model and architecture resolutions

- Existing Documents support immutable originals but only recognized core-record
  subjects at request validation. The Agreement upload route will preserve the same
  storage and scanning controls while authorizing an Agreement subject explicitly.
- Existing Evidence records only recognize core subjects. Agreement term provenance
  will use a dedicated typed extraction/evidence link rather than weakening core
  subject referential behavior or introducing EAV.
- The Phase 3 Brand/Product state transitions already fail closed. They will call the
  same current-authority validator used by Placement and future Outreach paths.
- Existing Territories are proposals, not authority. Agreement scope remains distinct;
  a proposed Territory cannot activate or expand representation rights.

No material Founder decision beyond existing RPD defaults is required for Phase 4.

### Phase 4 migrations

- `0005_phase4_representation_authority.sql`: Representation Opportunities and events;
  Agreements, scoped Products, reviewed term candidates, written account restrictions
  and immutable versions; authority evaluations; Placement Opportunities, Products,
  Relationship Triangle reviews, stage events and conflicts; append-only triggers.
- `0006_phase4_import_preview.sql`: non-committing Representation Opportunity and
  Agreement term preview types.

### Phase 4 verified results

- ESLint: clean.
- Strict server and web TypeScript: clean.
- Unit tests: 10 passed; 0 failed.
- PostgreSQL integration tests: 31 passed; 0 failed, including all prior Phase 1–3
  regression suites and the Phase 4 PLC/Journey authority suite.
- Playwright: 16 passed; 0 failed across desktop and mobile Chromium. Four are
  Phase 4 Representation/Placement responsive journeys.
- Production client/server build: passed.
- Production dependency audit: 0 vulnerabilities.
- Backup/restore drill: passed with 6 migrations restored.
- Docker image `ryva-pro:phase4`: built; `/healthz` and `/readyz` passed from the
  container.

### Phase 4 contractual and integration boundaries

- The platform records written Agreement scope and conflict evidence; it does not
  interpret ambiguous legal language. `review_required` and `specialist_required`
  remain blocking until a human records resolution.
- Protected-account bases and house-account exclusions are Agreement-derived
  restrictions only. They do not create operational Protected Account records or
  platform-generated rights; those records remain Phase 6.
- The local and S3 Document adapters, hash verification, quarantine, and signed scan
  callback are implemented. Live object-storage and malware-scanner credentials are
  still required for a deployed environment.
- Agreement extraction is complete as a manual/imported reviewed-candidate workflow.
  Model execution remains Phase 7 and the public API cannot submit `ai_suggested`
  candidates.
- Future Outreach approval/send must call the Phase 4 shared authority validator.
  Phase 4 intentionally contains no sender or UI that claims contact occurred.
- Exact commission payment calculation, Orders, Reorders, operational Accounts and
  Protected Accounts remain their documented later increments.

Phase 4 is complete. Phase 5 — Outreach Center — is the next active construction
increment.

## Phase 5 scope ledger

| Requirement | Status | Planned implementation and acceptance evidence |
|---|---|---|
| Unified communication and activity history | Complete | Workspace-scoped message, call, note, task and material-action timeline with Buyer, Brand, Placement and Product context |
| Exact-artifact outreach approval | Complete | Canonical recipient/channel/sender/content/attachment/timing digest; any material edit expires approval |
| Shared authority enforcement | Complete | Phase 4 validator at draft approval, queue time, worker execution and manual external-action logging |
| Email drafts and delivery | Complete | Versioned drafts, evidence-linked claims and attachments, explicit approval, durable idempotent send job, provider receipt states |
| Templates and versions | Complete | Email, social, call, voicemail, objection and follow-up templates; immutable used versions, required variables and compliance content |
| Sequences and scheduled follow-up | Complete | Versioned human-controlled steps, enrollments, due work and stop conditions; external steps create approval-required work and never auto-send |
| Calls, voicemail and social workflows | Complete | Buyer/Brand preparation, scripts, objection limits, human call logging, social drafts and manual-send confirmation |
| Notes, reminders and response tracking | Complete | Contextual notes/tasks, provider reply capture, human response classification, next action and Home/Tasks visibility |
| Suppression and compliance | Complete | Channel-specific suppression, opt-out, bounce/complaint handling, quiet hours, recipient permission and evidence-required correction |
| Provider webhooks and recovery | Complete | Signed, replay-safe delivery/reply/opt-out events; uncertain results remain recoverable without duplicate sends |
| Responsive workspace | Complete | Outreach, Templates and Sequences desktop/mobile routes with empty/loading/error/provider/conflict states |
| OUT-001 through OUT-009 | Passing | PostgreSQL tests cover exact approval, suppression, provider acceptance/idempotency, mobile call persistence, response stop rules, evidence revalidation and task visibility |

### Phase 5 construction decisions

- **No autonomous external action:** Sequences orchestrate reviewable work. Every
  external message has its own current exact-artifact approval; calls remain
  human-placed and social sends require human confirmation.
- **No synthetic intelligence:** Research, personalization and objection fields retain
  origin and evidence metadata. Phase 5 provides complete human-authored workflows;
  model execution remains Phase 7.
- **Provider acceptance is the contact boundary:** A Placement is not marked Contacted
  when an email is merely queued. It advances only after one provider-accepted send
  or a human-confirmed external call/social action.
- **Suppression is fail-closed:** Opt-out, complaint, prohibited permission, unresolved
  account conflict, invalid authority or restricted credential suppresses due work.
  Corrections require an explicit human reason and evidence reference.
- **Phase boundary for negotiation:** Phase 5 may record Buyer interest, questions and
  open commercial conditions. It cannot approve binding terms or advance into Opening
  Order, Account or Reorder stages, which remain Phase 6.

### Phase 5 data-model and architecture resolutions

- Phase 2 Activities remain the unified immutable history kernel. Typed Outreach
  Message, Call and Sequence records link to it instead of duplicating canonical
  timeline semantics.
- Phase 4 authority already validates Product, channel and written account
  restrictions. Phase 5 adds structured territory comparison for execution while
  preserving pre-existing authority behavior where geography is not needed.
- Durable Jobs are the only provider-send execution path. A dedicated email adapter,
  exact idempotency key and replay-safe provider event receipts extend the existing
  job foundation.
- Generic Human Approval remains authoritative. Communication digests and material
  versions are typed Phase 5 records; no EAV approval payload is introduced.

No material Founder decision beyond the existing RPD defaults is required for Phase 5.

### Phase 5 migrations

- `0007_phase5_outreach_center.sql`: Placement authority-channel persistence;
  versioned Templates and Sequence steps; Outreach Messages, Product/claim/evidence
  links and immutable attachment hashes; Calls; channel suppressions; Sequence
  enrollments; provider event receipts; append-only template/provider-event history.

### Phase 5 verified results

- ESLint: clean.
- Strict server and web TypeScript: clean.
- Unit tests: 10 passed; 0 failed.
- PostgreSQL integration tests: 37 passed; 0 failed, including OUT-001 through
  OUT-009 coverage and all Phase 1–4 regression suites.
- Playwright: 22 passed; 0 failed across desktop and mobile Chromium. Six are
  Phase 5 Outreach, Template and Sequence responsive journeys.
- Production client/server build: passed.
- Production dependency audit: 0 vulnerabilities.
- Backup/restore drill: passed with 7 migrations restored.
- Docker image `ryva-pro:phase5`: built; `/healthz` and `/readyz` returned 200
  from the container.

### Phase 5 provider, compliance, and operational boundaries

- The provider-neutral transactional email adapter, durable worker handler,
  exact idempotency key, signed webhook and replay receipts are implemented.
  Live provider URL/token, verified sender, webhook secret and DNS/domain
  authentication are not available locally and remain deployment setup.
- Legal outreach basis, jurisdiction-specific consent, required postal identity,
  retention periods and template language require Founder/legal confirmation
  before live use. The system already fails closed on permission, opt-out,
  suppression, authority, territory, Product/channel scope and account conflict.
- Provider reputation, bounce thresholds, complaint monitoring, SPF/DKIM/DMARC,
  warm-up and mailbox placement are operational deliverability controls outside
  the repository.
- Phase 5 records Buyer interest and open conditions but cannot negotiate or
  advance into Opening Order. Orders, operational Accounts, Protected Accounts,
  Reorders and Commissions remain Phase 6.
- Model execution remains Phase 7. Human-authored research, personalization,
  call preparation and objection guidance are complete; no UI represents
  synthetic text as live AI intelligence.

Phase 5 is complete. Phase 6 — Accounts, orders, reorders, and commissions — is
the next active construction increment.

## Phase 6 scope ledger

| Requirement | Status | Planned implementation and acceptance evidence |
|---|---|---|
| Opening Order conversion | Complete | One idempotent transaction verifies source and authority, records the Order and lines, creates/links Account, creates review-required protection basis where documented, generates Estimated Commission and Reorder review, advances Placement, and audits every result |
| Protected Accounts | Complete | Agreement-derived scoped records with supporting evidence, overlap checks, exact human approval, activation/renewal/release/expiry, surviving-right visibility, immutable events, and conflict blocking |
| Operational Accounts | Complete | Brand–Business relationship record linked to Representative, Agreement, Placement, opening Order, protection, health rationale, next action, lifecycle and full relationship history |
| Orders and corrections | Complete | Fixed-precision lines and totals; separate verification, fulfillment and payment state; source documents; duplicate/idempotency checks; immutable revisions and transparent adjustments |
| Explainable Commissions | Complete | Decimal formula snapshots, agreement/order revision basis, exact rounding and currency, expected/approved/paid separation, human-owned lifecycle, due/payment evidence, cancellation and clawback history |
| Reorders and account health | Complete | Prior-Order linkage, factual averages, explicitly labeled projected window/likelihood, health observations, reminders, missed/closed handling and verified subsequent-Order conversion |
| Commission Disputes | Complete | Amount/reason/evidence/owner/next action, chronology, comments/documents, human resolution, adjustment version and Commission-state synchronization |
| Relationship-ending continuity | Complete | Ended Agreement blocks new authority and pending outreach while preserving Accounts, Orders, earned/surviving rights, Commissions, disputes, documents and audit history |
| Financial automations | Complete | Durable idempotent opening conversion, recalculation, protection expiry alerts, reorder reminders, overdue payment alerts and duplicate prevention |
| Responsive operations UI | Complete | Accounts, Account detail, Orders, Order detail, Reorders, Commissions, Commission detail and Disputes with filters, saved views, export, linked timelines and complete states |
| COM-001 through COM-011 | Passing | Exact reconciliation fixtures, workspace/API policy coverage and cohesive desktop/mobile journeys 10–15 |

### Phase 6 construction decisions

- **Rights remain documentary:** Protected Accounts record only approved agreement
  or supporting-document terms. Account creation alone never manufactures
  protection, commission, reorder, house-account, or post-termination rights.
- **One transactional conversion:** Account and opening Order have a circular
  business relationship. The conversion service creates both stable identifiers
  and links them inside one database transaction; no partial Account is visible.
- **Immutable financial truth:** Order corrections, Commission calculations and
  dispute adjustments create append-only versions/events. Current projections may
  change, but previously approved or paid values are never silently overwritten.
- **Fixed-precision money:** Amounts use PostgreSQL `NUMERIC`, ISO currency and
  explicit half-away-from-zero rounding to currency minor units. Currencies are
  never silently aggregated.
- **Human-owned consequential states:** Order verification, protection activation,
  Commission approval/payability/payment, dispute resolution and account
  reactivation require named human actions and evidence where specified.
- **Projection labels:** Reorder likelihood/window and Estimated Commission remain
  visibly provisional and are excluded from verified/paid actuals.

### Phase 6 data-model and architecture resolutions

- Phase 4 Agreement terms are immutable authority inputs; Phase 6 snapshots the
  exact applicable agreement and Order revision in each calculation without
  interpreting ambiguous text.
- Typed Account, Protected Account, Order, Reorder, Commission and Dispute tables
  extend the modular monolith. Bounded JSON is used only for territory/formula
  snapshots, not core money, rights, status or relationship fields.
- Phase 2 Documents, Tasks, Notifications, Activities, Saved Views and Audit Events
  remain shared platform kernels and are linked rather than duplicated.
- Background jobs evaluate expiry, reminders and overdue state. They may create
  review work and notifications, but cannot approve rights, verify Orders, mark
  payment, resolve disputes or initiate external outreach.

No material Founder decision beyond RPD-001 and the existing specification defaults
is required for Phase 6.

### Phase 6 migration

- `0008_phase6_commercial_continuity.sql`: typed Accounts, Protected Accounts,
  Orders and line items, immutable Order revisions, Reorders, Commissions,
  immutable calculation versions, Commission Disputes, document links and
  append-only commercial events; workspace foreign keys, fixed-precision checks,
  duplicate constraints and lifecycle indexes.

### Phase 6 verified results

- ESLint: clean.
- Strict server and web TypeScript: clean.
- Unit tests: 10 passed; 0 failed.
- PostgreSQL integration tests: 44 passed; 0 failed, including COM-001 through
  COM-011 and all Phase 1–5 regression suites.
- Playwright: 30 passed; 0 failed across desktop and mobile Chromium. Eight are
  Phase 6 Account, Protection, Order, Reorder, Commission and Dispute journeys.
- Production client/server build: passed.
- Production dependency audit: 0 vulnerabilities.
- Backup/restore drill: passed with 8 migrations restored.
- Docker image `ryva-pro:phase6`: built; `/healthz` and `/readyz` returned 200
  from the container.

### Phase 6 calculation and authority rules

- Order money is calculated from fixed-precision line amounts. Eligible net is
  gross less discounts, returns and cancellations, floored at zero.
- Commission basis and rate come only from the linked approved Agreement.
  Calculations snapshot the Agreement, Order revision, adjustments, currency,
  basis, rate, formula and exact result.
- Multiplication uses integer minor units and rate micros with explicit
  half-away-from-zero rounding. Cross-currency aggregation and implicit currency
  conversion are prohibited.
- Estimated, pending verification, approved, payable and paid values remain
  separate. Payment, clawback and dispute resolution require named human action
  and the specified evidence.
- Opening-Order verification cannot manufacture protection. Protection is
  review-required only when a written basis exists, and activation requires a
  digest-bound Human Approval of the exact scoped rights.

### Phase 6 contractual, data-quality, and integration boundaries

- Ryva records documentary rights and human decisions; it does not interpret
  ambiguous legal language, infer unwritten protection, or decide whether
  post-termination rights legally survive. Ambiguity remains a blocking human or
  specialist review.
- Live order, payment and accounting provider credentials are not configured.
  Source-backed manual entry and evidence-preserving external-reference entry are
  complete; provider synchronization remains a deployment integration.
- Phase 9 retains ownership of controlled bulk import commit/report/merge. Phase
  6 accepts imported provenance without adding a second import architecture.
- Exact statutory tax, accounting, currency-conversion, record-retention and
  commission-payment rules remain jurisdiction/provider configuration and legal
  review items. The platform neither calculates tax nor silently converts money.
- Relationship termination suppresses unsent outreach and stops sequences, but
  preserves all financial and documentary history and creates mandatory human
  review work for potentially surviving rights.

Phase 6 remains complete. Phase 7 — Responsible AI Assistance — is implemented
as the next durable construction increment.

## Phase 7 scope ledger

| Requirement | Status | Planned implementation and acceptance evidence |
|---|---|---|
| Provider-neutral AI service | Complete | Bounded adapter, 28-use-case registry, structured response validation, timeout/failure isolation, MFA-protected kill switch, retention/training declarations and no tool or external-action surface |
| Authorized source packaging | Complete | Workspace-scoped target/evidence/source/document/commercial context, data minimization, permitted-use metadata, freshness, adverse evidence, secret exclusion and deterministic context digest |
| AI Run history and telemetry | Complete | Provider/model/template version, request/context digests, status, latency, token/cost telemetry, safe error, generated time and audit |
| Reviewable AI Suggestions | Complete | Immutable original output, material statement classifications, source/evidence citations, confidence subject/label, missing and contrary evidence, limitations, review state and regeneration lineage |
| Human disposition workflow | Complete | Accept content, edit, reject, regenerate, feedback and problem report with original/final values, actor, reason, timestamp and audit; no direct consequential transition |
| Research and comparison assistance | Complete | Product, Brand, Business, evidence, Product comparison, Brand comparison and fit explanations use stored authorized records only |
| Outreach and meeting assistance | Complete | Personalization, email/follow-up drafts, call/meeting preparation and objection suggestions; external send and binding language remain separately blocked |
| Pipeline and commercial assistance | Complete | Pipeline/stalled explanations, next action, Account/Reorder summaries, Commission explanations and dispute/closure summaries with actual/estimate separation |
| Document and duplicate assistance | Complete | Agreement/commission/document extraction candidates with source locations and duplicate explanations; proposed fields remain uncommitted; clean opt-in uploads use a durable job |
| Daily and weekly briefings | Complete | Explainable, evidence-linked priority suggestions from a workspace context; no Task/state creation on generation or acceptance |
| Responsive AI interfaces | Complete | Copilot workbench, inspectable source package, statement classifications, edit/disposition/regeneration controls, provider/manual states, Settings/Admin controls and Home briefing entry point |
| AI-001 through AI-007 | Passing | Seven PostgreSQL API acceptance scenarios, injection/red-team fixture, failure isolation, workspace/read-only authorization and four desktop/mobile browser journeys |

### Phase 7 construction decisions

- **Suggestion boundary:** AI output is stored in a dedicated immutable Suggestion
  layer. It does not bypass the existing evidence, authority, approval, outreach,
  Order, protection, Commission, dispute or stage services.
- **No autonomous tools:** The AI provider receives a compact data package and returns
  schema-validated text/field candidates. It receives no credentials, database
  connection, URL fetcher, sender, job control or state-changing tool.
- **Human-owned adoption:** Accepting a suggestion records human disposition and may
  copy only non-consequential draft content. Consequential changes still require the
  existing named-human workflow and exact validation.
- **No hidden precision:** Confidence remains Insufficient, Limited, Supported or
  Strong for a named conclusion. No model percentage, Product Score, weighted
  pipeline probability or predictive revenue is introduced.
- **Manual completeness:** Provider absence or failure creates a visible failed Run
  without changing the target record. All Phase 1–6 manual workflows remain usable.

### Phase 7 data-model and architecture resolutions

- Phase 3 intentionally rejects public `ai_suggested` intelligence writes. Phase 7
  retains that protection and adds reviewable Suggestions; accepted edits become
  human-confirmed only through existing typed APIs.
- Existing Evidence and Source records carry factual provenance. Phase 7 adds
  immutable source snapshots and statement-to-evidence links rather than copying
  claims into opaque JSON.
- Existing Human Approval remains authoritative for consequential actions. AI
  disposition is separate and never creates an Agreement, rights, send, stage,
  qualification, payment or dispute approval.
- Phase 8 owns the final analytics/Home command center. Phase 7 supplies daily and
  weekly briefing Suggestions and a Home entry point without adding predictive
  analytics or replacing Phase 8 prioritization.

No material Founder decision beyond existing RPD-004 and RPD-005 defaults is
required for Phase 7.

### Phase 7 verified results

- ESLint and strict server/web TypeScript: clean.
- Unit tests: 10 passed.
- PostgreSQL integration tests: 51 passed across Phases 1–7; AI-001 through
  AI-007 passed.
- Playwright: 34 passed across desktop and mobile Chromium, including four
  Phase 7 journeys.
- Production client/server build: passed.
- Production dependency audit: 0 vulnerabilities.
- Backup/restore drill: passed with 9 migrations restored.
- Docker image `ryva-pro:phase7`: built; `/healthz` and `/readyz` passed from
  the container.

Phase 7 contains no autonomous agent, provider tool access, hidden score,
predictive retail model, statistical forecast, automatic send, or automatic
consequential approval. Phase 8 is the next documented construction increment.

## Phase 8 scope ledger

| Requirement | Status | Planned implementation and acceptance evidence |
|---|---|---|
| Shared metric dictionary and calculation service | Complete | One versioned domain registry supplies meaning, formula, inclusions/exclusions, date/currency/actual-estimate/freshness behavior, limitations and source types to Home, Analytics, reports, exports and AI context |
| Home Today and What Changed | Complete | Workspace/user-scoped commitments, approvals, replies, authority/evidence/protection/reorder/commission/dispute/access warnings and material changes since the prior acknowledged Home visit |
| Transparent priority queue | Complete | Maximum seven rule-ranked items with factor explanation; complete/snooze/dismiss/reprioritize actions append history and preserve source-owned blockers |
| Pipeline and commercial snapshots | Complete | Stage/aging/next-action/account/reorder/block/loss summaries plus currency-separated verified, estimated, approved, payable, paid, disputed and overdue financial values |
| Analytics workspaces | Complete | Representative, Product, Brand, Buyer, Pipeline, Commercial and Portfolio views with date/currency filters, accessible tables, freshness, definitions and connected-record paths |
| Transparent forecasting | Complete | Evidence-linked user-entered low/base/high ranges, qualitative likelihood, assumptions and limitations only; database constraints reject invalid ranges and no probability field exists |
| External intelligence readiness | Complete | Provenance-first verified-observation schema and explicit not-connected state; no synthetic, inferred or placeholder production value |
| Verified numerical draft support | Complete | Current reviewed/verified Evidence or verified external observations only; every draft number must match the source; stale/unsupported claims are rejected and Phase 5 approval remains mandatory |
| Saved and exportable reports | Complete | Authorized definitions and audited CSV exports carry filters, definition versions, separate currencies and value-state labels; restricted/security data is excluded |
| Notifications and Phase 8 alerts | Complete | Durable daily idempotent refresh covers Home priorities, outreach health and certification access; duplicate groups, notification lifecycle and audit are enforced |
| Future model contracts | Complete | Provider-neutral typed lineage/version/evidence/review/monitoring/rollback interface is present with no model execution, hidden score or placeholder prediction |
| Phase 8 acceptance and responsive journeys | Passing | ANA-001–006 PostgreSQL reconciliation/isolation/export/forecast/claim/alert scenarios and four desktop/mobile Home/Analytics journeys pass with all Phase 1–7 regression suites |

### Phase 8 architecture resolutions

- **Single source of metric truth:** metric definitions and SQL calculations live
  in `packages/domain/src/analytics.ts`; API routes, exports, Home and AI context
  consume that service rather than reproducing formulas.
- **Forecasting default:** RPD-004 controls. Weighted pipeline and stage probability
  are disabled. Only user-entered low/base/high values, qualitative likelihood,
  recorded dates and historical actual summaries are permitted.
- **No scores:** RPD-005 continues to exclude numerical Product, Brand, fit,
  Opportunity, relationship and portfolio scores.
- **External data state:** no verified external analytics provider is configured.
  The schema and UI distinguish “not connected” from zero and contain no live
  external values.
- **Priority rules, not prediction:** urgency factors are visible categorical
  rules. Manual reprioritization is explicit history, not a hidden learned weight.
- **Notification repair:** the Phase 2 notification constraint lacks the API's
  `archived` state. Phase 8 will reconcile the constraint while preserving all
  notification history.

No new material Founder decision is required. Exact weighted-pipeline behavior is
already decided by RPD-004 and remains disabled.

### Phase 8 data model and implementation

- Migration `0010_phase8_analytics_command_center.sql` adds per-user Home
  acknowledgement, append-only priority actions, evidence-linked user forecast
  ranges, provenance-linked external metric observations, report definitions,
  append-only report runs, and append-only numerical outreach claims. It also
  reconciles the Notification status constraint with the existing archived API
  state.
- The domain metric service is the shared source for `/api/analytics`, the Home
  command center, CSV exports, worker alerts, and Phase 7 workspace briefing
  context. The legacy `/api/home` response contract remains compatible and
  includes the new command center as an additive field.
- Expected Commission totals use the current immutable Phase 6 calculation
  result when present. Monetary totals never cross currencies; verified,
  expected, approved, payable, paid, disputed, overdue, and clawback values
  remain distinct.
- No external intelligence credential is configured. The adapter-ready
  observation boundary is complete, while live provider ingestion remains an
  external deployment integration.
- The login redirect race found during responsive regression testing is fixed:
  a completed access evaluation can no longer overwrite a user's immediate
  post-login navigation.

### Phase 8 verified results

- ESLint and strict server/web TypeScript: clean.
- Unit tests: 10 passed.
- PostgreSQL integration tests: 57 passed across Phases 1–8; ANA-001 through
  ANA-006 passed.
- Playwright: 38 passed across desktop and mobile Chromium, including four
  Phase 8 Home and Analytics journeys.
- Production client/server build: passed.
- Production dependency audit: 0 vulnerabilities.
- Backup/restore drill: passed with 10 migrations restored.
- Docker image `ryva-pro:phase8`: built; `/healthz` and `/readyz` returned 200
  from the container.

Phase 8 contains no Product Score, hidden weight, stage probability, predictive
retail model, statistical forecast, automatic outreach, automatic approval,
currency conversion, or fabricated external intelligence. Phase 9 — Data
portability, administration, and operational hardening — is the next documented
construction increment.

Phase 8 remains complete. Phase 9 — Data Portability, Administration,
Operational Hardening, and Launch Readiness — is active.

## Phase 9 scope ledger

| Requirement | Status | Planned implementation and acceptance evidence |
|---|---|---|
| Controlled import batches | Complete | Bounded CSV mapping/validation, durable rows, exact digest/count approval, transactional idempotent commit, conservative states, review queue, notifications and outcome CSV |
| Duplicate review and merge | Complete | Typed field diff, explicit survivor/reason/phrase, reversible canonical aliases, preserved original history and search resolution; no autonomous merge |
| Data portability exports | Complete | Leased/retryable durable workspace/account JSON and CSV ZIP packages with manifest, digest, formula defense, redaction, expiry and requester scope |
| Administration and support | Complete | Least-privilege access directory/provider/job/support/feature/launch state; MFA+reasoned commands; ticket-scoped support and no impersonation |
| Notification completion | Complete | Underlying notification events, grouping metadata, lifecycle/expiry, preferences and import/export notices |
| Search and saved-view hardening | Complete | PostgreSQL trigram search, bounded stable pagination, type/status filtering, placement results, alias resolution, ownership and workspace filtering |
| Retention, closure and legal hold | Complete | Central null-duration retention classes, specialist-review flags, legal holds, export-aware reversible closure request |
| Performance and operational controls | Complete | Query/index review, bounded file/row/page limits, leased job backpressure, provider status and production budgets |
| Security and dependency hardening | Complete | Threat model, capability/tenant/authority/export/CSV injection tests, secret-safe status and `otplib` 13.4.1 migration |
| Accessibility and UX consistency | Complete with launch condition | Semantic/keyboard/reflow responsive surfaces and 42 desktop/mobile journeys; manual assistive-technology WCAG 2.2 AA sign-off remains required |
| Observability and incident operations | Complete | Structured request correlation, safe operational status, alert definitions and founder-friendly incident runbook |
| Backup, deployment and release | Complete | 11-migration restore drill, staged release/rollback, release preflight, dependency/container build and health/readiness smoke |
| Controlled launch readiness | Complete | Configuration/policy-derived blockers with owner/action, optional fail-closed allowlist, and honest `Not Ready` status |
| DAT/QLT and regression acceptance | Verified | 10 unit + 62 PostgreSQL integration + 42 desktop/mobile browser tests pass; lint, typecheck, build, audit, restore and container smoke pass |

### Phase 9 architecture conflicts and resolutions

- The existing Import Center deliberately stops after preview. Phase 9 will
  preserve that parser boundary and add durable batches/rows/approval/commit
  services rather than permitting the preview route to write records.
- Existing duplicate detection covers core records but has no consequential
  merge service. A typed merge registry will allow only reviewed relationship
  rewrites; contractual, protection, Order and Commission records will never be
  coalesced by a generic field merge.
- Existing entity exports are synchronous. Full portability requires a durable
  export request/package with expiry and audit; small view CSV endpoints remain
  compatible.
- Admin currently exposes jobs, audit and support grants. Phase 9 adds safe
  metadata and explicit commands without granting blanket Representative
  content access.
- RPD-008 intentionally leaves exact legal durations unresolved. Retention
  classes and legal holds will be implemented with reversible defaults marked
  `specialist_review_required`; no legal conclusion will be encoded.
- `otplib` v12 is deprecated. Phase 9 will migrate to the current async v13 API
  while preserving TOTP verification and MFA-required staff behavior.
- No live provider credentials are available locally. Provider status and launch
  readiness will report unavailable configuration honestly; no connected state
  will be fabricated.

No new material Founder decision is required to begin implementation. Exact
retention periods, production launch market/legal policies, launch allowlist,
and final provider contracts remain founder/specialist launch decisions already
identified by RPD-008 and the deployment specification.

### Phase 9 verified results

- Migration `0011_phase9_operational_readiness.sql` applies cleanly after all
  ten prior migrations and adds controlled import rows/approvals/review items,
  reversible merge decisions/aliases, durable export requests, feature and
  launch controls, retention/legal-hold/closure records, provider checks,
  notification history, and query indexes.
- ESLint and strict server/web TypeScript: clean.
- Unit tests: 10 passed.
- PostgreSQL integration tests: 62 passed across Phases 1–9. DAT-001 through
  DAT-008 cover exact import approval, conservative imported states,
  consequential review staging, reversible duplicate resolution, durable
  workspace export, CSV formula defense, MFA administration, and honest launch
  blockers.
- Playwright: 42 passed across desktop and Pixel 7 Chromium, including Phase 9
  controlled-import and durable-export journeys.
- Production client/server build: passed.
- Production dependency audit: 0 vulnerabilities. `otplib` is 13.4.1.
- Backup/restore drill: passed with all 11 migrations restored.
- Docker image `ryva-pro:phase9`: built; `/healthz` and `/readyz` returned 200
  from the container.
- Release preflight: correctly returned **Not Ready** and named missing
  database/TLS, certification, Stripe, email, object storage, and malware
  scanner configuration without printing values.

### Remaining launch conditions

Phase 9 application construction is complete, but production launch is **Not
Ready**. Required provider credentials and target-environment verification are
absent. Exact retention periods and related privacy/legal policy remain under
RPD-008 specialist review. Manual assistive-technology WCAG 2.2 AA sign-off,
production-scale performance measurement, managed backup/PITR evidence, sender
reputation warm-up, webhook replay drills, and final founder launch approval
must be completed in the real environment. Optional AI and intelligence
providers may remain unavailable only if the manual workflows and public
availability labels remain accurate.

No later construction phase is documented. The next active increment is
production-environment integration and launch-gate closure, not a new product
workspace or scoring system.
