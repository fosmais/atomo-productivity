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

# Unrelated users must not be blocked by a Journey booking transaction.
# A user-scoped advisory lock is acceptable; a table-wide events lock is not.
if grep -Eiq 'lock[[:space:]]+table[[:space:]]+public[.]events' supabase/migrations/20261112000100_myryra_journey_lesson_atomic.sql; then
 echo 'FAIL: booking RPC must not lock the global events table'
 exit 1
fi
echo 'PASS: booking RPC does not acquire a global events table lock'

# Hold an uncommitted Agenda write for another user. Journey booking must
# proceed without waiting for this unrelated transaction to commit.
psql -X -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
values ('00000000-0000-4000-8000-000000000112',
'00000000-0000-0000-0000-000000000000',
'authenticated','authenticated','other-local@example.invalid',now(),now());
insert into public.myryra_journey_missions(id,journey_id,title)
values ('00000000-0000-4000-8000-000000000312',
'00000000-0000-4000-8000-000000000211','Outra aula');
SQL
cat >"$tmp/unrelated-write.sql" <<'SQL'
begin;
insert into public.events(user_id,title,starts_at,ends_at,blocks_time)
values ('00000000-0000-4000-8000-000000000112',
'Unrelated pending write',now()+interval '2 days',now()+interval '2 days 20 minutes',true);
select pg_sleep(3);
commit;
SQL
psql -X -v ON_ERROR_STOP=1 -f "$tmp/unrelated-write.sql" >"$tmp/writer.out" 2>"$tmp/writer.err" &
writer=$!
sleep 1
cat >"$tmp/independent-booking.sql" <<'SQL'
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000111',false);
set statement_timeout = '1500ms';
select public.myryra_book_journey_lesson(
'00000000-0000-4000-8000-000000000211',
'00000000-0000-4000-8000-000000000312',
now()+interval '3 days');
SQL
set +e
psql -X -v ON_ERROR_STOP=1 -f "$tmp/independent-booking.sql" >"$tmp/independent.out" 2>"$tmp/independent.err"
booking_status=$?
wait "$writer"; writer_status=$?
set -e
if [[ $booking_status -ne 0 || $writer_status -ne 0 ]]; then
 echo "FAIL: unrelated Agenda write blocked Journey booking (booking=$booking_status, writer=$writer_status)"
 cat "$tmp/independent.err" "$tmp/writer.err"
 exit 1
fi
echo 'PASS: unrelated pending Agenda write does not block Journey booking'
