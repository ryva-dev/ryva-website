# Journey 1: Discover a Product and Decide Whether to Investigate

**Trigger:** Representative finds a Product through a source, import, referral, public research, or approved provider signal.

**Required records:** User/workspace, Product candidate, Brand candidate, Source, Evidence Records, Next Action.

## Flow

1. User saves URL/imports/creates Product.
2. System normalizes identity, checks duplicates, captures source/date, sets Discover/discovered.
3. User confirms Product/Brand identity and exact research question.
4. AI optionally extracts candidate facts, social indicators, claims, gaps, risks, and Buyer-category hypotheses.
5. User classifies material evidence and unknowns; social indicators remain contextual proxies.
6. User makes scoped decision: investigate, watch, reject, or merge.
7. System creates next evidence task or archives with rationale.

**Automation:** duplicate suggestion; document/page extraction; missing-evidence list; freshness date.

**Approvals:** Human decision required to start formal review or reject. No external action.

**Success:** Product is on Watchlist/Under Review with sources, unknowns, owner, and next action, or rejected with reason.

**Failure:** identity unclear, source inaccessible, unsupported claim, duplicate, or no legitimate research purpose.

**Recovery:** hold as unverified, request evidence, merge, correct source, or close. AI/provider failure falls back to manual entry.

**Audit events:** create/import, source capture, AI suggestion/disposition, merge, status, decision, task.

