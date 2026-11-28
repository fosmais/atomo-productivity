#!/usr/bin/env bash
set -euo pipefail
: "${MVP3_TEST_DATABASE_URL:?Dedicated homologation database URL required}"
[[ "$MVP3_TEST_DATABASE_URL" == *sdwguqyjuvuamfiingsp* ]] || { echo 'Refusing non-MVP3 database'; exit 1; }
export PGDATABASE="$MVP3_TEST_DATABASE_URL"
key=874215903
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
psql -X -v ON_ERROR_STOP=1 -At >"$work/holder" <<SQL &
begin;
select pg_advisory_xact_lock($key);
\\echo LOCK_READY
select pg_sleep(15);
rollback;
SQL
holder=$!
for i in $(seq 1 100); do
  grep -q LOCK_READY "$work/holder" && break
  sleep 0.1
done
grep -q LOCK_READY "$work/holder" || { wait "$holder"; exit 1; }
result=$(psql -X -v ON_ERROR_STOP=1 -Atc "select pg_try_advisory_xact_lock($key)")
wait "$holder"
[[ "$result" == f ]] || { echo 'FAIL: competing session acquired held lock'; exit 1; }
[[ $(psql -X -v ON_ERROR_STOP=1 -Atc "select pg_try_advisory_xact_lock($key)") == t ]]
echo 'PASS: independent sessions respect transaction lock and release'
