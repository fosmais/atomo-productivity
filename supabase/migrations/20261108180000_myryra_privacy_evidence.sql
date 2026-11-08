-- MYRYRA privacy evidence schema. Apply to staging first, after review.
create table if not exists public.myryra_privacy_document_versions (
 id uuid primary key default gen_random_uuid(),
 document_type text not null check (document_type in ('terms','privacy_notice')),
 version text not null,
 public_url text not null,
 status text not null default 'draft' check (status in ('draft','published','retired')),
 effective_at timestamptz not null,
 published_at timestamptz,
 created_at timestamptz not null default now(),
 unique(document_type,version),
 constraint published_document_requires_date check (status <> 'published' or published_at is not null)
);
create table if not exists public.myryra_privacy_acceptances (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 document_version_id uuid not null references public.myryra_privacy_document_versions(id),
 action text not null check(action in ('accepted','acknowledged')),
 evidence_source text not null check(evidence_source in ('registration','google_onboarding','settings')),
 request_id uuid not null,
 ui_locale text not null default 'pt-BR',
 occurred_at timestamptz not null default now(),
 unique(user_id,request_id)
);
create index if not exists myryra_privacy_acceptances_user_doc_idx on public.myryra_privacy_acceptances(user_id,document_version_id);
create table if not exists public.myryra_privacy_purposes (
 purpose_key text not null check(purpose_key ~ '^[a-z][a-z0-9_]{1,63}$'),
 purpose_version integer not null check(purpose_version > 0),
 display_name text not null,
 description text not null,
 required boolean not null default false,
 legal_basis text not null,
 active boolean not null default false,
 primary key(purpose_key,purpose_version)
);
create table if not exists public.myryra_privacy_choices (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 purpose_key text not null,
 purpose_version integer not null,
 notice_version_id uuid not null references public.myryra_privacy_document_versions(id),
 granted boolean not null,
 source text not null check(source in ('registration','google_onboarding','settings')),
 request_id uuid not null,
 occurred_at timestamptz not null default now(),
 foreign key(purpose_key,purpose_version) references public.myryra_privacy_purposes(purpose_key,purpose_version),
 unique(user_id,request_id)
);
create index if not exists myryra_privacy_choices_user_purpose_idx on public.myryra_privacy_choices(user_id,purpose_key,purpose_version,occurred_at desc);
alter table public.myryra_privacy_document_versions enable row level security;
alter table public.myryra_privacy_acceptances enable row level security;
alter table public.myryra_privacy_purposes enable row level security;
alter table public.myryra_privacy_choices enable row level security;
revoke all on public.myryra_privacy_document_versions,public.myryra_privacy_acceptances,public.myryra_privacy_purposes,public.myryra_privacy_choices from anon;
grant select on public.myryra_privacy_document_versions,public.myryra_privacy_acceptances,public.myryra_privacy_purposes,public.myryra_privacy_choices to authenticated;
create policy privacy_docs_read on public.myryra_privacy_document_versions for select to authenticated using (status='published' and published_at is not null and effective_at<=now());
create policy privacy_purposes_read on public.myryra_privacy_purposes for select to authenticated using (active);
create policy privacy_acceptances_own_read on public.myryra_privacy_acceptances for select to authenticated using (user_id=(select auth.uid()));
create policy privacy_choices_own_read on public.myryra_privacy_choices for select to authenticated using (user_id=(select auth.uid()));
-- Inserts only via authenticated server endpoints using service role, after document validation.
-- No default published documents, purposes, or synthetic user acceptances.
