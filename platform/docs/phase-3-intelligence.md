# Phase 3 intelligence operations

Phase 3 adds production Product, Brand, Business, Contact, and Business Buyer diligence to the connected-record kernel. It does not add numerical Product scoring, representation authority, outreach, or autonomous AI decisions.

## Evidence and qualification rules

- Every material intelligence-field update must link one or more current Evidence Records for the same subject. An explicit `Unknown` Evidence Record is valid and remains visible.
- Sources retain reference, rights, confidentiality, and observation dates. Time-bound observations retain acquisition context, limitations, origin, and supersession history.
- Imports are previews only in this increment. They report prospective creates, mapping errors, duplicate candidates, provenance, and authority implications. They never qualify, verify, authorize, or merge.
- Product, Brand, Product–Business match, Business, Contact, and Buyer decisions are server-enforced human actions. Issued Decision Records and linked next-action Tasks are required at consequential gates.
- Brand `Authorized` and `Active` and Product `represented` fail closed until a verified Representation Agreement exists in Phase 4.
- A fully qualified Business requires a sourced professional Contact, a verified Buyer with evidence-linked decision authority, a reviewed Product match, a complete profile, and a human Decision.
- Comparisons align two to four Products in an explicit context. Unknowns are not averaged and no score or rank is produced.

## External intelligence

`INTELLIGENCE_API_URL` and `INTELLIGENCE_API_TOKEN` configure the bounded provider adapter. Provider results are candidate observations only; they must pass schema validation and then be recorded with a Source and human review before affecting intelligence fields. With no provider configured, all manual and imported research workflows remain available and current records are preserved.

## Migration and verification

Apply migrations in order:

```bash
PGSSL=disable npm run migrate
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Production must use verified PostgreSQL TLS settings. Synthetic fixtures are explicitly labeled and must never be represented as externally sourced intelligence.
