#!/usr/bin/env bash
# Applies the migrations to a throwaway local Postgres and checks the ids-only migration.
# Phases: stub + fixtures -> existing migrations -> mid fixtures -> new migration (twice) -> assertions.
# Uses whatever local Postgres PGBIN points at (Homebrew may be older than production PG 17); nothing in the migration is version-specific.
set -euo pipefail

PGBIN="${PGBIN:-/opt/homebrew/bin}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NEW=20261122150000_expenses_ids_only.sql
SAME=20261122170000_expenses_same_account_refs.sql
DIR="$(mktemp -d)"
PORT=54329

cleanup() {
  "$PGBIN/pg_ctl" -D "$DIR/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$DIR"
}
trap cleanup EXIT

"$PGBIN/initdb" -D "$DIR/data" -U postgres --auth=trust >/dev/null
"$PGBIN/pg_ctl" -D "$DIR/data" -l "$DIR/log" -w -o "-p $PORT -k $DIR -c listen_addresses=''" start >/dev/null
"$PGBIN/createdb" -h "$DIR" -p "$PORT" -U postgres test

export PGOPTIONS="-c client_min_messages=warning"
run() { "$PGBIN/psql" -h "$DIR" -p "$PORT" -U postgres -d test -v ON_ERROR_STOP=1 -q -f "$1" >/dev/null; }

run "$ROOT/supabase/tests/stub_schema.sql"
run "$ROOT/supabase/tests/expenses_ids_only_fixtures.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  [ "$(basename "$f")" = "$NEW" ] && continue
  [ "$(basename "$f")" = "$SAME" ] && continue
  run "$f"
done
run "$ROOT/supabase/tests/expenses_ids_only_mid_fixtures.sql"
run "$ROOT/supabase/migrations/$NEW"
run "$ROOT/supabase/migrations/$NEW"
"$PGBIN/psql" -h "$DIR" -p "$PORT" -U postgres -d test -v ON_ERROR_STOP=1 -q -t -f "$ROOT/supabase/tests/expenses_ids_only_assert.sql"
# Same-account reference check: applied last, twice (idempotent), then asserted.
run "$ROOT/supabase/migrations/$SAME"
run "$ROOT/supabase/migrations/$SAME"
"$PGBIN/psql" -h "$DIR" -p "$PORT" -U postgres -d test -v ON_ERROR_STOP=1 -q -t -f "$ROOT/supabase/tests/expenses_same_account_assert.sql"

echo "ALL MIGRATION TESTS PASSED"
