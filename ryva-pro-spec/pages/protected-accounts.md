# Page: Protected Accounts

## Purpose and user

Register, review, renew, dispute, release, and expire agreement-derived account protection without implying rights beyond supporting documents.

## Data displayed

Brand, Business, Representative, Agreement, origin/approval dates, approver, Product/channel/territory scope, protection term, commission/reorder rights, status, conflict notes, expiration/renewal, supporting documents, linked Account/Orders/Commissions.

## Actions

Primary: Register Protection / Review Expiring Record.  
Secondary: upload evidence, approve/reject, renew, release, open conflict/dispute, correct scope, export.

## Filters

Status, Brand, Business, territory, Product scope, expiration window, conflict/dispute, agreement, owner.

## States

- **Empty:** explain that protection requires agreement evidence; route to Account/Agreement.
- **Loading:** status/scope first.
- **Error:** conflict service failure blocks new outreach and registration.

## Permissions and responsive

Representative proposes; human approval by authorized role is required. Admin repairs only through audited process. Mobile supports lookup, evidence, approval, expiry action.

## Linked records and AI

Agreement, Territory, Business, Account, Opportunity, Orders, Reorders, Commissions, Documents, Decisions. AI may extract proposed fields and detect overlaps; cannot approve rights.

## Acceptance criteria

- active protection requires supporting Agreement and approval;
- overlap detection covers Brand, Business, Products, channel, territory and dates;
- expired/released status does not erase history or earned rights;
- renewal creates version/event;
- conflicts block affected outreach until resolved;
- UI states that record reflects documents, not independent legal rights.

