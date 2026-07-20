# Page: Orders

## Purpose and user

List and reconcile verified opening and subsequent orders that drive accounts, actual wholesale value, reorders, and commissions.

## Data displayed

Order number, type, Account, Brand, Business, Products/quantity, order date, gross wholesale value, discounts, returns/cancellations, net commissionable amount, order/payment/fulfillment status, source, linked commission, owner.

## Actions

Primary: Record Order.  
Secondary: import, verify, correct through revision, attach source, update fulfillment/payment, link Account/Opportunity, export.

## Filters

Period, type, status, payment/fulfillment, Brand, Business, Product, Account, source, value range, missing documentation.

## States

- **Empty:** record/import first verified order; explain estimate exclusion.
- **Loading:** totals after rows; freshness visible.
- **Error:** partial data does not enter totals; retry.

## Permissions and responsive

Representative; financial exports require active/read-only permitted access and step-up where configured. Mobile supports lookup and status/source review; bulk reconciliation desktop-first.

## Linked records and AI

Opportunity, Account, Agreement, Protection, Reorder, Commission, Documents. AI extracts candidate fields; human verifies.

## Acceptance criteria

- external order reference idempotent;
- net commissionable amount explanation visible;
- estimates cannot create Order;
- corrections preserve original;
- opening Order triggers transactional account/commission workflow;
- dashboard totals exclude unverified drafts.

