# Page: Import Center

## Purpose and user

Import structured records with mapping, validation, provenance, duplicate resolution, and controlled commit.

## Data displayed

Import type/source, file, mapping, row preview, validation errors/warnings, duplicate candidates, create/update/skip action, progress, final results.

## Actions

Primary: Validate / Commit Import.  
Secondary: save mapping, fix mapping, exclude row, resolve duplicate, download errors, retry, cancel.

## Filters

Rows by valid/warning/error/duplicate/action; source column; target field.

## States

- **Empty:** choose record type and template.
- **Loading:** scan/parse/validate/commit progress.
- **Error:** preserve mapping; row-level errors; commit failure reconciles idempotently.

## Permissions and responsive

Representative; read-only cannot import. Desktop-first; mobile shows job results only.

## Linked records and AI

All importable entities and Sources. AI may suggest column mapping/normalization, always reviewed.

## Acceptance criteria

- preview before write;
- imports preserve source/origin;
- no active Agreement, verified Order, Paid Commission, Protected Account, or approved outreach created without human workflow;
- duplicate choices explicit;
- commit idempotent;
- result and errors exportable/audited.

