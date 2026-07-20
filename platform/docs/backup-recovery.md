# Backup and Recovery

## Local recovery drill

Run:

```bash
DATABASE_URL=postgres://localhost/ryva_pro_test npm run drill:backup-restore
```

The drill:

1. creates a custom-format PostgreSQL dump;
2. creates a uniquely named temporary database;
3. restores without changing the source;
4. verifies migration history;
5. terminates temporary connections;
6. drops the temporary database and removes the archive.

## Production policy

Use managed encrypted backups plus point-in-time recovery. The initial target for Founder/operations confirmation is:

- recovery point objective: 15 minutes or better;
- recovery time objective: 4 hours or better;
- monthly isolated restore drill before general availability;
- restore evidence retained with operator, timestamps, source backup, result, and deviations.
- quarterly point-in-time recovery validation in addition to the monthly
  isolated full-restore drill;
- annual region/provider failure exercise, or before launch when the selected
  provider's recovery design materially changes.

Do not expose backup credentials to the application runtime. Restoration is an operator-controlled procedure.
Legal holds and append-only audit/authority histories must be verified after
restore. Compare record counts, migration ledger, latest audit timestamp,
document metadata digests, and durable-job state before reopening traffic.

## Migration recovery

Every migration runs transactionally under an advisory lock. If a migration fails, the transaction rolls back and the application must not be promoted. Applied migrations are immutable. Corrective schema work uses a new migration.
