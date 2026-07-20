# Page: Commission Detail

## Purpose and user

Explain one commission's source, calculation, approval, payment, variance, dispute, and history.

## Data displayed

Header: status, expected/approved/paid, due date, Brand/Account/Order.  
Calculation: gross Order, eligible lines, discounts, returns/cancellations, net commissionable amount, rule/rate, expected amount, adjustments.  
Sections: Agreement/protection rights, source documents, approval/payment, dispute/clawback, tasks/notes, audit timeline.

## Actions

Primary by state: Verify, Approve evidence, Mark Paid with source, Open/Respond to Dispute.  
Secondary: upload document, correct input through source record, add note/task, export explanation.

## Filters

Documents, activity/history, calculation revisions.

## States

- **Empty:** identify missing rule/source.
- **Loading:** status and source first.
- **Error:** no stale calculation represented as current.

## Permissions and responsive

Representative manages own record; Admin repair requires audited authority. Mobile full explanation and dispute action.

## Linked records and AI

Order, Agreement, Protection, Account, Dispute, Documents. AI extracts and compares; does not approve or resolve.

## Acceptance criteria

- calculation reproducible;
- amount changes show cause;
- paid amount/date/evidence required;
- dispute and clawback never erase prior approval/payment;
- source rights visible;
- every state audited.

