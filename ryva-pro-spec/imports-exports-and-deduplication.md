# Imports, Exports, and Deduplication

## Import types

- CSV;
- contacts from authorized provider;
- Products;
- Brands;
- Business/Buyer lists;
- Placement Opportunities;
- accounts;
- historical orders;
- commissions.

## Import workflow

1. Select record type and upload/source.
2. Scan and parse.
3. Map columns with saved mapping option.
4. Identify origin, date, and source.
5. Validate type, required fields, currency, date, and status.
6. Preview normalized values.
7. Detect duplicates and conflicts.
8. Resolve blocking errors and select update/create behavior.
9. Confirm exact commit scope.
10. Commit idempotently.
11. Report created, updated, skipped, failed, and duplicate rows.
12. Allow error-file download and safe retry.

Imported assertions remain imported/user-provided; they are not verified facts automatically.

## Bulk updates

Permitted for owner, tags, category, non-consequential status, reminder, and bounded custom fields. Bulk changes to authority, approval, stage, protection, orders, commissions, opt-outs, evidence class, or credential state require dedicated reviewed workflows or are prohibited.

## Export

Permitted formats:

- CSV per entity/view;
- JSON archive for full workspace;
- document bundle with manifest;
- PDF/print-ready reports.

Exports enforce rights and redact provider secrets/internal security fields. Packages are time-limited, access-controlled, and audited.

## Duplicate rules

### Products

Candidate when Brand plus normalized Product name, SKU/barcode, or canonical URL match. Variants are reviewed, not auto-merged.

### Brands

Candidate by normalized legal/public name, verified domain, registry ID, and ownership. Same-name Brands remain separate when identity differs.

### Businesses

Candidate by legal/public name, domain, normalized address/location, and registry identifier. Locations may be child records, not duplicates.

### Contacts

Candidate by verified professional email, provider ID, or name+Business+role. Never merge solely on common name.

### Placement Opportunities

Warn when same active agreement, Business, Product scope, and overlapping time exist. Account/protection conflict may block.

### Accounts

Warn when same Brand–Business relationship and overlapping agreement/protection scope exist.

## Merge behavior

- choose survivor;
- compare every field;
- preserve alternate values and sources;
- reparent relationships transactionally;
- retain aliases/external IDs;
- never silently merge communications, opt-outs, agreements, protection, orders, or commissions;
- create merge audit event;
- allow admin-assisted unmerge only when technically safe.

## Validation

Imports do not create verified orders, active agreements, Protected Accounts, paid commissions, or approved outreach without human confirmation and source evidence.

