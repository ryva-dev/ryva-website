# Page: Documents

## Purpose and user

Store and relate agreements, catalogs, line sheets, Product images, sales materials, invoices, commission statements, sample records, and evidence files.

## Data displayed

Name, type, linked records, owner, source, version, upload date, size, scan status, confidentiality, extraction state, expiry, hash.

## Actions

Primary: Upload Document.  
Secondary: preview/download, link/unlink, version, classify, request extraction, archive/delete where allowed.

## Filters

Type, parent record, Brand/Business, status, upload date, owner, scan/extraction, expiring.

## States

- **Empty:** upload relevant document with examples.
- **Loading:** upload/scan/extraction progress separately.
- **Error:** quarantine unsafe files; preserve retry metadata.

## Permissions and responsive

Workspace access with field/document sensitivity. Mobile supports upload/photo, preview metadata, and link; complex extraction review desktop-first.

## Linked records and AI

All core records. AI/parser may extract candidate fields and evidence; user confirms.

## Acceptance criteria

- malware scan before normal access;
- original immutable and hashed;
- versions linked;
- extraction never writes material fields without review;
- download uses short-lived authorization;
- delete/retention behavior audited.

