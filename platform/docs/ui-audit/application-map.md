# Application Map

## Global route model

`/login` is public. Every other page is inside `ProtectedLayout`, which checks session state and renders capability-dependent navigation. The default authenticated route is Home. Unknown routes redirect to Home. Dynamic detail routes require a workspace-owned record and otherwise show a loading transition followed by a safe error.

“Clicks” and paths below begin after authentication. “Sidebar” means the persistent left rail on desktop and the horizontally scrolling top rail at 900 px and below.

## Access, account, and operations

| # | Page | Route | Purpose | Primary user | Major actions | Related pages | Current navigation path | Status |
|---:|---|---|---|---|---|---|---|---|
| 1 | Login | `/login` | Authenticate and complete conditional TOTP verification | All users | Sign in; submit verification code | Access, Home | Direct/public | Implemented |
| 2 | Home command center | `/` | Prioritize commitments, exceptions, changes, commercial continuity, and AI briefings | Representative | Open tasks/analytics; acknowledge change; request briefing | Tasks, Analytics, Copilot, domain records | Login → default; Sidebar → Home | Implemented |
| 3 | Certification access check | `/access` | Explain eligibility, access mode, and required remediation | Restricted user | Open certification or subscription remediation | Certification, Subscription | Redirect after login when ineligible; Sidebar → Access | Implemented, conditional |
| 4 | Certification status | `/certification` | Display trusted credential state and verification dates | All authenticated users | Refresh verification; open renewal | Access, Subscription | Sidebar → Certification | Implemented |
| 5 | Subscription | `/subscription` | Display entitlement and billing-provider state | All authenticated users | Manage billing | Access, Activation | Sidebar → Subscription | Implemented |
| 6 | Subscription activation | `/subscription/activate` | Present activation-specific subscription state | Eligible unsubscribed user | Manage/activate billing | Access, Subscription | Access remediation or direct route | Implemented, conditional |
| 7 | Profile | `/profile` | Maintain representative identity, business, locale, and contact details | User | Save profile | Settings, Certification | Sidebar → Profile | Implemented |
| 8 | Settings | `/settings` | Maintain preferences, AI controls, sessions, and closure request | User | Save preferences; revoke sessions; request closure | Profile, Copilot | Sidebar → Settings | Implemented |
| 9 | Platform operations | `/admin` | Inspect provider safety, jobs, audit events, and AI kill switch | Admin/support | Refresh; retry dead job; enable/disable AI with reason | Imports, Exports, Copilot | Sidebar → Operations (role-gated) | Implemented, conditional |

## Connected record kernel and intelligence

| # | Page | Route | Purpose | Primary user | Major actions | Related pages | Current navigation path | Status |
|---:|---|---|---|---|---|---|---|---|
| 10 | Generic records list | `/records/:type` | List/create Brand, Product, Business, or Contact records with saved views | Representative | Search/filter; switch layout; save view; create | Generic detail; dedicated Intelligence pages | Sidebar → Contacts for `contact`; other variants are contextual/direct | Implemented; defective fallback for invalid type |
| 11 | Generic record detail | `/records/:type/:id` | Show connected evidence, risks, decisions, notes, activities, tasks, documents, and relationships | Representative | Add note/task/evidence/risk/decision; relate buyer | Generic list; dedicated detail pages | Generic list → record | Implemented, data-dependent; defective fallback for invalid type |
| 12 | Product Intelligence | `/products` | Research, filter, compare, and create unqualified Products | Representative | Apply/save filters; select comparison items; create record | Product detail, Comparison | Sidebar → Products | Implemented |
| 13 | Create Product comparison | `/products/compare` | Define a two-to-four-product comparison context without scoring | Representative | Enter comparison context; create comparison | Products, Comparison detail | Products → Compare selected/direct | Implemented |
| 14 | Product comparison detail | `/products/comparisons/:comparisonId` | Compare aligned Products with evidence, unknowns, risk, and limitations | Representative/reviewer | Open Product; review limitations | Products, Product detail | Products → saved comparison | Implemented, data-dependent |
| 15 | Product detail | `/products/:id` | Review Product evidence, risks, qualification, comparisons, matches, and activity | Representative/reviewer | Edit; add evidence/risk; issue human decision; qualify; compare/match | Brand detail, Buyer detail, Placement | Products → Product | Implemented, data-dependent |
| 16 | Brand Intelligence | `/brands` | Research, filter, and create unqualified Brands | Representative | Apply/save filters; create record | Brand detail, Representation | Sidebar → Brands | Implemented |
| 17 | Brand detail | `/brands/:id` | Review Brand identity, evidence, risk, qualification, contacts, Products, and activity | Representative/reviewer | Edit; add evidence/risk; issue decision; qualify | Products, Representation, Contacts | Brands → Brand | Implemented |
| 18 | Buyer Intelligence | `/buyers` | Research, filter, and create prospective Business Buyers | Representative | Apply/save filters; create record | Buyer detail, Contact detail, Placement | Sidebar → Buyers | Implemented |
| 19 | Buyer detail | `/buyers/:id` | Review Business fit, evidence, risk, qualification, contacts, Products, and activity | Representative/reviewer | Edit; add evidence/risk; issue decision; qualify/match | Product detail, Contact detail, Placement | Buyers → Buyer | Implemented, data-dependent |
| 20 | Contact Intelligence | `/contacts/:id` | Verify a professional contact route and its freshness | Representative/reviewer | Select source; record observed date/notes; verify | Buyer detail, Sources | Buyer/record context → Contact | Implemented, data-dependent |

## Representation, placement, and outreach

| # | Page | Route | Purpose | Primary user | Major actions | Related pages | Current navigation path | Status |
|---:|---|---|---|---|---|---|---|---|
| 21 | Representation | `/representation` | Manage opportunities and agreements; open a new authority review | Representative | Open opportunity; open agreement | Brand detail, Opportunity detail, Agreement detail | Sidebar → Representation | Implemented |
| 22 | Representation opportunity detail | `/representation/:id` | Advance or reject a representation opportunity with human decision and next action | Representative/approver | Change stage; select decision/task; record rationale | Brand, Agreement, Documents | Representation → Opportunity | Implemented, data-dependent |
| 23 | Agreement detail | `/agreements/:id` | Review immutable originals, extracted terms, restrictions, conflicts, and authority | Representative/approver | Edit material terms; review extraction; add restriction; approve/activate | Representation, Documents, Products | Representation/Opportunity → Agreement | Implemented, data-dependent |
| 24 | Placement Opportunities | `/placements` | Manage qualitative Product-to-Business pipeline | Representative | Filter pipeline; create Placement | Product, Buyer, Representation | Sidebar → Placement CRM | Implemented |
| 25 | Placement detail | `/placements/:id` | Review three-party value, authority, conflict state, stage, and history | Representative/approver | Advance stage with decision and next action; open Outreach | Product, Buyer, Agreement, Outreach | Placement CRM → Placement | Implemented, data-dependent |
| 26 | Outreach Center | `/outreach` | Prepare human-approved messages and log calls in unified history | Representative | Draft message; log call; open template/sequence/message | Placement, Templates, Sequences | Sidebar → Outreach | Implemented |
| 27 | Outreach templates | `/outreach/templates` | Maintain versioned reusable communication starting points | Representative | Create template | Outreach, Sequences | Outreach → Templates | Implemented |
| 28 | Outreach sequences | `/outreach/sequences` | Create human-controlled review-task sequences | Representative | Create two-step sequence | Outreach, Templates | Outreach → Sequences | Implemented |
| 29 | Outreach message detail | `/outreach/:id` | Review exact content, claims, attachments, approval, send state, and response | Representative/approver | Approve/send; classify response | Placement, Contact, Evidence | Outreach → Message | Implemented, data-dependent |

## Commerce

| # | Page | Route | Purpose | Primary user | Major actions | Related pages | Current navigation path | Status |
|---:|---|---|---|---|---|---|---|---|
| 30 | Accounts | `/accounts` | Monitor Brand–Business commercial relationships without inventing rights | Representative | Filter/save view; export; open account | Protection, Orders, Reorders | Sidebar → Accounts; Commerce subnav | Implemented |
| 31 | Account detail | `/accounts/:id` | Show account status, human health judgment, order/reorder history, and protection | Representative | Update health/rationale; open related records | Orders, Reorders, Protection | Accounts → Account | Implemented, data-dependent |
| 32 | Protected Accounts | `/protected-accounts` | Register and review document-derived account-rights bases | Representative/approver | Filter/save view; create pending review | Account, Agreement | Commerce subnav → Protection | Implemented |
| 33 | Protected Account detail | `/protected-accounts/:id` | Review written basis, scope, status, evidence, and human decision | Representative/approver | Approve/reject/change status with rationale | Account, Agreement, Commission | Protection → record | Implemented, data-dependent |
| 34 | Orders | `/orders` | Record opening Orders and distinguish draft, verification, payment, and fulfillment | Representative | Filter/save view; add line; save review-required order; export | Account, Commission | Sidebar → Orders; Commerce subnav | Implemented |
| 35 | Order detail | `/orders/:id` | Review immutable revisions, line items, status, and verification | Representative/approver | Correct/revise; verify; change fulfillment/payment | Account, Commission | Orders → Order | Implemented, data-dependent |
| 36 | Reorders | `/reorders` | Monitor responsible reorder windows and account health | Representative | Filter/save view; export; open account/order | Account, Orders | Sidebar → Reorders; Commerce subnav | Implemented |
| 37 | Commissions | `/commissions` | Reconcile expected through paid commission states | Representative/approver | Filter/save view; export; open calculation | Order, Agreement, Dispute | Sidebar → Commissions; Commerce subnav | Implemented |
| 38 | Commission detail | `/commissions/:id` | Explain current and prior calculations and capture human approval/payment actions | Representative/approver | Review formula/history; approve; mark payable/paid; dispute | Order, Agreement, Dispute | Commissions → Commission | Implemented, data-dependent |
| 39 | Commission Disputes | `/commission-disputes` | Manage evidence-preserving commission cases | Representative/approver | Filter/save view; export; open case | Commission, Order | Commerce subnav → Disputes | Implemented |
| 40 | Commission Dispute detail | `/commission-disputes/:id` | Resolve or withdraw a dispute with evidence, amount, decision, and rationale | Representative/approver | Add chronology/evidence; resolve/withdraw | Commission, Order, Agreement | Disputes → Case | Implemented, data-dependent |

## AI, analytics, and utilities

| # | Page | Route | Purpose | Primary user | Major actions | Related pages | Current navigation path | Status |
|---:|---|---|---|---|---|---|---|---|
| 41 | AI Copilot | `/copilot` | Request bounded, evidence-first assistance and review suggestion history | Representative | Choose use case/record; generate suggestion; open history item | Suggestion detail, Settings | Sidebar → AI Copilot | Implemented, provider-conditional |
| 42 | AI suggestion detail | `/copilot/:suggestionId` | Inspect statements, classifications, evidence, freshness, limitations, edits, and dispositions | Representative/reviewer | Edit; accept/reject/flag; request revision | Copilot, source records | Copilot/Home → Suggestion | Implemented |
| 43 | Analytics Command Center | `/analytics` | Show explainable operational, pipeline, commercial, portfolio, report, and definition views | Representative/founder | Switch view; filter dates/currency; recalculate; save report | Home, domain records, Exports | Sidebar/Home → Analytics | Implemented |
| 44 | Search | `/search` | Find workspace-authorized connected records | Representative | Enter query/type; search; open result | All record details | Sidebar → Search | Implemented |
| 45 | Tasks | `/tasks` | List owned work linked to originating records | Representative | Open task/related record | Home, record details | Sidebar/Home → Tasks | Implemented |
| 46 | Import and review | `/imports` | Map, validate, preview, and explicitly approve CSV ingestion | Representative/approver | Map fields; validate; approve commit | Sources, Documents, Admin | Sidebar → Import | Implemented |
| 47 | Secure exports | `/exports` | Generate audited, scoped data exports | Authorized user | Select datasets; generate export | Admin, Analytics | Sidebar → Export (capability-gated) | Implemented |
| 48 | Notifications | `/notifications` | Present critical/action-required notifications with related context | Representative | Mark read; open related record | Home, Tasks, records | Sidebar → Notifications | Implemented |
| 49 | Documents | `/documents` | Register immutable, quarantined files and scan state | Representative | Upload to quarantine; inspect register | Agreements, Imports | Sidebar → Documents | Implemented, scanner-conditional |
| 50 | Sources | `/sources` | Register evidence provenance and usage rights | Representative/reviewer | Register source | Intelligence, Contact, Import | Sidebar → Sources | Implemented |
| 51 | Territories | `/territories` | Define proposed geographic, channel, account-list, or hybrid scope | Representative | Save proposal | Representation, Agreement, Placement | Sidebar → Territories | Implemented |

