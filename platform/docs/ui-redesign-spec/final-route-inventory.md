# Final Route Inventory

**Scope:** every route declared in `apps/web/src/App.tsx` at the Increment 16
baseline, with the known Increment 17 Protected Account detail migration
recorded as its final canonical ownership.

**State key:** L = loading, E = dataset/record empty, N = filtered no-result,
R = restricted or read-only, Err = recoverable error. A dash means the route's
increment documentation does not establish that state as a route-level
contract. **Coverage key:** D/T/M = desktop, tablet, and mobile structural
coverage; Login remains intentionally legacy.

| Route | Canonical module | Pattern | Increment | Desktop/tablet/mobile coverage | States covered (L/E/N/R/Err where known) | Notes |
|---|---|---|---|---|---|---|
| `/login` | `pages/LoginPage.tsx` | Legacy authentication | Pre-redesign | Legacy | — | Authentication behavior is retained; this route is intentionally not brand-polished. |
| `/` | `pages/HomePage.tsx` | Command Center | 7 | D/T/M | L/E/R/Err | Route composes the Increment 7 home workspace within the shared shell. |
| `/access` | `redesign/settings/AccessWorkspace.tsx` | Access workspace | 16 | D/T/M | L/R/Err | Session mode and reason; no membership administration route exists. |
| `/certification` | `redesign/settings/CertificationWorkspace.tsx` | Certification workspace | 16 | D/T/M | L/R/Err | Existing certification behavior only. |
| `/subscription` | `redesign/settings/SubscriptionWorkspace.tsx` | Subscription workspace | 16 | D/T/M | L/R/Err | Subscription status and management surface. |
| `/subscription/activate` | `redesign/settings/SubscriptionWorkspace.tsx` | Subscription activation | 16 | D/T/M | L/R/Err | Same canonical module with the `activation` prop. |
| `/profile` | `redesign/settings/ProfileWorkspace.tsx` | Profile workspace | 16 | D/T/M | L/R/Err | Separate from Settings. |
| `/settings` | `redesign/settings/SettingsWorkspace.tsx` | Settings workspace | 16 | D/T/M | L/R/Err | Preferences, AI, Sessions, and Closure tabs. |
| `/admin` | `redesign/admin/OperationsWorkspace.tsx` | Operations workspace | 16 | D/T/M | L/E/R/Err | Capability-controlled system, AI, jobs, and audit views. |
| `/records/:type` | `pages/RecordsPage.tsx` | Compatibility adapter | 8–10 | D/T/M | L/E/N/R/Err | Adapter preserves generic deep links and directs Product, Brand, and Business semantics to canonical intelligence surfaces; Contact remains compatible. |
| `/records/:type/:id` | `pages/RecordsPage.tsx` (`RecordDetailPage`) | Compatibility detail adapter | 8–10 | D/T/M | L/E/R/Err | Preserves generic detail deep links for Product, Brand, Business, and Contact. |
| `/products` | `redesign/product/ProductRegister.tsx` | Split Intelligence Workspace | 8 | D/T/M | L/E/N/R/Err | Product register and inline create. |
| `/products/compare` | `redesign/product/ProductComparison.tsx` (`ProductComparisonCreatePage`) | Focused comparison creation | 8 | D/T/M | L/E/R/Err | Selects two to four Products. |
| `/products/comparisons/:comparisonId` | `redesign/product/ProductComparison.tsx` (`ProductComparisonDetailPage`) | Analytical comparison | 8 | D/T/M | L/E/R/Err | Desktop matrix; mobile focus/diff strategy. |
| `/products/:id` | `redesign/product/ProductDetail.tsx` | Standard Relationship Detail | 8 | D/T/M | L/E/R/Err | Identity, evidence, qualification, related records, and activity. |
| `/brands` | `redesign/brand/BrandRegister.tsx` | Split Intelligence Workspace | 9 | D/T/M | L/E/N/R/Err | Brand results and context rail. |
| `/brands/:id` | `redesign/brand/BrandDetail.tsx` | Standard Relationship Detail | 9 | D/T/M | L/E/R/Err | Products, evidence, qualification, representation, relationships, activity. |
| `/buyers` | `redesign/buyer/BuyerRegister.tsx` | Split Intelligence Workspace | 10 | D/T/M | L/E/N/R/Err | Business/Buyer register. |
| `/buyers/:id` | `redesign/buyer/BuyerDetail.tsx` | Standard Relationship Detail | 10 | D/T/M | L/E/R/Err | Business, Contacts, fit, evidence, qualification, and activity. |
| `/contacts/:id` | `redesign/contact/ContactDetail.tsx` | Standard Relationship Detail | 5 (extended 10) | D/T/M | L/E/R/Err | Increment 5 pilot, later extended with Buyer context and call preparation. |
| `/representation` | `redesign/representation/RepresentationRegister.tsx` | Standard Register | 11 | D/T/M | L/E/N/R/Err | Opportunities and Agreements list. |
| `/representation/:id` | `redesign/representation/RepresentationDetail.tsx` | Standard Relationship Detail | 11 | D/T/M | L/E/R/Err | Overview, Agreements/Documents, Scope, Activity. |
| `/agreements/:id` | `redesign/representation/AgreementDetail.tsx` | Consequential Review | 11 | D/T/M | L/E/R/Err | Exact-artifact terms, validation, and human approval activation. |
| `/placements` | `redesign/placement/PlacementRegister.tsx` | Pipeline / Standard Register | 12 | D/T/M | L/E/N/R/Err | Table/Kanban and mobile stage groups. |
| `/placements/:id` | `redesign/placement/PlacementDetail.tsx` | Relationship Detail + Consequential Review | 12 | D/T/M | L/E/R/Err | Stage review retains authority and conflict checks. |
| `/outreach` | `redesign/outreach/OutreachWorkspace.tsx` | Communication workspace + message register | 13 | D/T/M | L/E/N/R/Err | Supports existing `?placementId=` context. |
| `/outreach/templates` | `redesign/outreach/OutreachTemplates.tsx` | Library + create form | 13 | D/T/M | L/E/N/R/Err | A template is not an approved exact message. |
| `/outreach/sequences` | `redesign/outreach/OutreachSequences.tsx` | Library + create form | 13 | D/T/M | L/E/N/R/Err | Schedules reviewable work; never auto-sends. |
| `/outreach/:id` | `redesign/outreach/OutreachDetail.tsx` | Relationship Detail + Consequential Review | 13 | D/T/M | L/E/R/Err | Exact message, approval/send, activity, and response. |
| `/accounts` | `redesign/commerce/AccountRegister.tsx` | Standard Register | 14 | D/T/M | L/E/N/R/Err | Commercial continuity register. |
| `/accounts/:id` | `redesign/commerce/AccountDetail.tsx` | Relationship Detail + Consequential health review | 14 | D/T/M | L/E/R/Err | Protection, Orders, Reorders, activity, and Commission context remain distinct. |
| `/protected-accounts` | `redesign/commerce/ProtectedAccountRegister.tsx` | Standard Register + pending-basis create | 14 | D/T/M | L/E/N/R/Err | Creation makes a pending review, not protection. |
| `/protected-accounts/:id` | `redesign/commerce/ProtectedAccountDetail.tsx` | Consequential Review | 17 | D/T/M | L/E/R/Err | Final canonical ownership after the Inc 17 migration; proposal, exact digest, approval, and audit stay distinct. |
| `/orders` | `redesign/commerce/OrderRegister.tsx` | Standard Register + multi-line create | 14 | D/T/M | L/E/N/R/Err | Verification remains separate from entry. |
| `/orders/:id` | `redesign/commerce/OrderDetail.tsx` | Relationship Detail + Consequential confirmation | 14 | D/T/M | L/E/R/Err | Stored lines/totals and version concurrency. |
| `/reorders` | `redesign/commerce/ReorderRegister.tsx` | Standard Register + inline human review | 14 | D/T/M | L/E/N/R/Err | No `/reorders/:id` route exists. |
| `/commissions` | `redesign/commerce/CommissionRegister.tsx` | Standard Register | 15 | D/T/M | L/E/N/R/Err | Currency-separated stored amounts. |
| `/commissions/:id` | `redesign/commerce/CommissionDetail.tsx` | Relationship Detail + Consequential Review | 15 | D/T/M | L/E/R/Err | Calculation transparency and status transition review. |
| `/commission-disputes` | `redesign/commerce/DisputeRegister.tsx` | Standard Register | 15 | D/T/M | L/E/N/R/Err | Allegation-labeled claims. |
| `/commission-disputes/:id` | `redesign/commerce/DisputeDetail.tsx` | Relationship Detail + Consequential Review | 15 | D/T/M | L/E/R/Err | Evidence, verification, and final human resolution. |
| `/copilot` | `pages/AiPages.tsx` (`AiCopilotPage`) | Legacy Copilot | Pre-redesign | Legacy | — | Intentionally retained as legacy and not brand-polished. |
| `/copilot/:suggestionId` | `pages/AiPages.tsx` (`AiSuggestionPage`) | Consequential Review pilot | 6 | D/T/M | L/E/R/Err | Migrated review behavior remains in the legacy module pending a future source-location migration. |
| `/analytics` | `redesign/analytics/AnalyticsWorkspace.tsx` | Analytical Workspace | 16 | D/T/M | L/E/N/R/Err | Existing `?view=reports` and `?view=definitions` are views, not routes. |
| `/search` | `redesign/search/SearchWorkspace.tsx` | Search workspace | 16 | D/T/M | L/E/N/R/Err | Shell command search preserves the route. |
| `/tasks` | `pages/TasksPage.tsx` | Standard Register | 4 | D/T/M | L/E/N/R/Err | Intentionally remains under `pages/*` while composing `redesign/register`. |
| `/imports` | `redesign/transfer/ImportReview.tsx` | Consequential Review | 16 | D/T/M | L/E/R/Err | Staged preview and digest approval. |
| `/exports` | `redesign/transfer/ExportReview.tsx` | Consequential Review | 16 | D/T/M | L/E/R/Err | Queued, ready, and downloaded states are distinct. |
| `/notifications` | `pages/NotificationsPage.tsx` | Standard Register | 4 | D/T/M | L/E/N/R/Err | Intentionally remains under `pages/*` while composing `redesign/register`. |
| `/documents` | `pages/DocumentsPage.tsx` | Standard Register | 4 | D/T/M | L/E/N/R/Err | Intentionally remains under `pages/*` while composing `redesign/register`. |
| `/sources` | `pages/SourcesPage.tsx` | Standard Register | 4 | D/T/M | L/E/N/R/Err | Intentionally remains under `pages/*` while composing `redesign/register`. |
| `/territories` | `pages/TerritoriesPage.tsx` | Standard Register | 4 | D/T/M | L/E/N/R/Err | Intentionally remains under `pages/*` while composing `redesign/register`. |
| `*` | `react-router-dom` (`Navigate`) | Fallback redirect | Existing | D/T/M | — | Unknown paths redirect to `/` with `replace`. |

## Retained source history

The inventory records live route ownership, not deletion eligibility. Legacy
exports remain retained for history and caller-proof purposes:

- `pages/CommercePages.tsx` retains the earlier Account, Order, Reorder,
  Commission, Dispute, and Protected Account detail implementations. After
  Increment 17, none is intended to be wired by `App.tsx`.
- `pages/AiPages.tsx` remains the live module for the intentionally legacy
  Copilot list and the Increment 6 AI-suggestion review pilot.
- `pages/RecordsPage.tsx` remains the compatibility adapter rather than a new
  generic record product surface.
