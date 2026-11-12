#!/usr/bin/env bash
# Disposable PostgreSQL CI only. Never point PG* variables at production.
set -euo pipefail
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
psql -X -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
values ('00000000-0000-4000-8000-000000000111',
'00000000-0000-0000-0000-000000000000',
'authenticated','authenticated','parallel-local@example.invalid',now(),now());
insert into public.myryra_journeys(id,owner_id,title)
values ('00000000-0000-4000-8000-000000000211',
'00000000-0000-4000-8000-000000000111','Aprender italiano');
insert into public.myryra_journey_missions(id,journey_id,title)
values ('00000000-0000-4000-8000-000000000311',
'00000000-0000-4000-8000-000000000211','Aula concorrente');
SQL
cat >"$tmp/booking.sql" <<'SQL'
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000111',false);
select public.myryra_book_journey_lesson(
'00000000-0000-4000-8000-000000000211',
'00000000-0000-4000-8000-000000000311',
now()+interval '1 day');
SQL
set +e
psql -X -v ON_ERROR_STOP=1 -f "$tmp/booking.sql" >"$tmp/a.out" 2>"$tmp/a.err" &
a=$!
psql -X -v ON_ERROR_STOP=1 -f "$tmp/booking.sql" >"$tmp/b.out" 2>"$tmp/b.err" &
b=$!
wait "$a"; sa=$?
wait "$b"; sb=$?
set -e
if ! { { [[ $sa -eq 0 && $sb -ne 0 ]] || [[ $sb -eq 0 && $sa -ne 0 ]]; }; }; then
 echo "Expected exactly one successful booking; statuses: $sa $sb"
 cat "$tmp/a.err" "$tmp/b.err"
 exit 1
fi
if ! grep -q 'Mission already scheduled' "$tmp/a.err" "$tmp/b.err"; then
 echo 'Expected the rejected request to report duplicate booking'
 cat "$tmp/a.err" "$tmp/b.err"
 exit 1
fi
count="$(psql -X -At -c "select count(*) from public.events where user_id='00000000-0000-4000-8000-000000000111' and deleted_at is null")"
if [[ "$count" != 1 ]]; then
 echo "Expected exactly one persisted event, got $count"
 exit 1
fi
echo 'PASS: two concurrent bookings produce exactly one event and one duplicate rejection'
