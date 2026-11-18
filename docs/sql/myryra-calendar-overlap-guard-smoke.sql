-- Disposable PostgreSQL only. Exercise the candidate overlap guard.
create table public.events(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null,
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 blocks_time boolean not null default false,
 deleted_at timestamptz,
 notes text
);
-- Seed two legacy overlaps before installing the guard.
insert into public.events(user_id,starts_at,ends_at,blocks_time,notes) values
 ('11111111-1111-4111-8111-111111111111','2026-12-01 09:00+00','2026-12-01 10:00+00',true,'legacy A'),
 ('11111111-1111-4111-8111-111111111111','2026-12-01 09:30+00','2026-12-01 10:30+00',true,'legacy B');
\i docs/sql/myryra-calendar-overlap-guard-candidate.sql

do $test$
declare uid uuid := '11111111-1111-4111-8111-111111111111';
begin
  -- Newly overlapping blocking event must fail with exclusion-like SQLSTATE.
  begin
    insert into public.events(user_id,starts_at,ends_at,blocks_time)
    values(uid,'2026-12-01 09:45+00','2026-12-01 10:15+00',true);
    raise exception 'Expected calendar overlap rejection';
  exception when sqlstate '23P01' then null;
  end;
  -- Non-blocking event may overlap.
  insert into public.events(user_id,starts_at,ends_at,blocks_time)
  values(uid,'2026-12-01 09:45+00','2026-12-01 10:15+00',false);
  -- Soft-deleted blocking event may overlap.
  insert into public.events(user_id,starts_at,ends_at,blocks_time,deleted_at)
  values(uid,'2026-12-01 09:45+00','2026-12-01 10:15+00',true,now());
  -- Unchanged legacy interval may be edited without blocking historical repair.
  update public.events set notes='legacy A edited'
   where notes='legacy A';
  -- Newly invalid interval is rejected.
  begin
    insert into public.events(user_id,starts_at,ends_at,blocks_time)
    values(uid,'2026-12-01 12:00+00','2026-12-01 11:00+00',true);
    raise exception 'Expected invalid interval rejection';
  exception when sqlstate '22023' then null;
  end;
end $test$;
