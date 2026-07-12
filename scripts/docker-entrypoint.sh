#!/bin/sh
set -eu
# Idempotent schema migrate before listen when Postgres is configured.
if [ -n "${DATABASE_URL:-}" ] && [ "${MIGRATE_ON_BOOT:-1}" != "0" ]; then
  node server/migrate.mjs
fi
exec dumb-init node server/index.mjs
