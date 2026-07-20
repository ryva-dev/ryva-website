# Page: Order Detail

## Purpose and user

Show one Order's evidence, line items, adjustments, fulfillment, payment, Account relationship, reorder link, and commission calculation.

## Data displayed

Header: number, status, type, dates, Account, Brand/Business, gross/net values.  
Sections: line items; pricing/discounts; returns/cancellations; commissionable calculation; fulfillment; payment; source documents; linked Opportunity/Protection/Reorder/Commission; activity/history.

## Actions

Primary: Verify/Update Order State.  
Secondary: add source, record return/cancellation, correct with reason, link records, create reorder review, inspect Commission.

## Filters

Line items/Product; documents; activity; revisions.

## States

- **Empty:** missing source or required calculation input.
- **Loading:** identity/status then line/calculation.
- **Error:** calculation unavailable blocks commission advancement.

## Permissions and responsive

Representative; financial corrections audited. Mobile provides full read, source upload, status and return entry.

## Linked records and AI

All order relations. AI extracts and compares documents; no verification/payment conclusion.

## Acceptance criteria

- formula shows gross, discounts, returns/cancellations, net;
- Order and payment status separate;
- source documentation available;
- correction creates revision;
- Commission references exact Order revision;
- canceled/returned behavior updates downstream transparently.

