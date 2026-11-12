create table if not exists public.support_email_outbox (
 id uuid primary key default gen_random_uuid(),
 event_type text not null check (event_type in ('feedback_created','ticket_created')),
 source_id uuid not null,
 recipient text not null default 'support@myryra.com',
 subject text not null,
 payload jsonb not null default '{}'::jsonb,
 status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
 attempts integer not null default 0 check (attempts >= 0),
 last_error text,
 created_at timestamptz not null default now(),
 sent_at timestamptz,
 unique(event_type,source_id)
);
alter table public.support_email_outbox enable row level security;
revoke all on public.support_email_outbox from anon, authenticated;
create or replace function public.enqueue_beta_feedback_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.support_email_outbox(event_type,source_id,recipient,subject,payload)
 values ('feedback_created',new.id,'support@myryra.com',
 '[MYRYRA] Novo feedback: ' || new.category,
 jsonb_build_object('feedback_id',new.id,'user_id',new.user_id,'category',new.category,'message',new.message,'created_at',new.created_at))
 on conflict (event_type,source_id) do nothing;
 return new;
end; $$;
revoke all on function public.enqueue_beta_feedback_notification() from public, anon, authenticated;
drop trigger if exists trg_enqueue_beta_feedback_notification on public.beta_feedback;
create trigger trg_enqueue_beta_feedback_notification after insert on public.beta_feedback
for each row execute function public.enqueue_beta_feedback_notification();