-- Event categories with a consistent palette.
-- Apply to staging and verify before production.
alter table public.events add column if not exists category text not null default 'personal';
alter table public.events drop constraint if exists events_category_check;
alter table public.events add constraint events_category_check
check (category in ('work', 'family', 'leisure', 'health', 'personal', 'study'));
create index if not exists events_user_category_idx
on public.events (user_id, category, starts_at) where deleted_at is null;
