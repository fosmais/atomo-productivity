-- MYRYRA Journey: private achievement memories and optional photo uploads.
-- Photos stay private; a user-initiated share should export a rendered card, not a public storage URL.
create table if not exists public.myryra_journey_achievements (
 id uuid primary key default gen_random_uuid(),
 journey_id uuid not null references public.myryra_journeys(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(btrim(title)) between 1 and 120),
 message text check (message is null or char_length(message)<=500),
 photo_path text,
 achieved_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint achievement_photo_owner_path check (
  photo_path is null or (photo_path like owner_id::text || '/%' and
  photo_path !~ '[[:space:]]' and length(photo_path)<=400)
 )
);
create index if not exists myryra_journey_achievements_owner_idx
 on public.myryra_journey_achievements(owner_id,achieved_at desc);
alter table public.myryra_journey_achievements enable row level security;
create policy "achievement_owner_select" on public.myryra_journey_achievements
 for select to authenticated using (owner_id=(select auth.uid()));
create policy "achievement_owner_insert" on public.myryra_journey_achievements
 for insert to authenticated with check (
 owner_id=(select auth.uid()) and exists(
 select 1 from public.myryra_journeys j where j.id=journey_id
 and j.owner_id=(select auth.uid()) and j.status='completed'));
create policy "achievement_owner_update" on public.myryra_journey_achievements
 for update to authenticated using(owner_id=(select auth.uid()))
 with check(owner_id=(select auth.uid()) and exists(
 select 1 from public.myryra_journeys j where j.id=journey_id
 and j.owner_id=(select auth.uid()) and j.status='completed'));
create policy "achievement_owner_delete" on public.myryra_journey_achievements
 for delete to authenticated using(owner_id=(select auth.uid()));
grant select,insert,update,delete on public.myryra_journey_achievements to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('journey-achievements','journey-achievements',false,5242880,
 array['image/jpeg','image/png','image/webp'])
 on conflict (id) do nothing;
create policy "achievement_photo_read_own" on storage.objects
 for select to authenticated using(bucket_id='journey-achievements'
 and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "achievement_photo_upload_own" on storage.objects
 for insert to authenticated with check(bucket_id='journey-achievements'
 and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "achievement_photo_update_own" on storage.objects
 for update to authenticated using(bucket_id='journey-achievements'
 and (storage.foldername(name))[1]=(select auth.uid())::text)
 with check(bucket_id='journey-achievements'
 and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "achievement_photo_delete_own" on storage.objects
 for delete to authenticated using(bucket_id='journey-achievements'
 and (storage.foldername(name))[1]=(select auth.uid())::text);
