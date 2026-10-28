-- MYRYRA - Myka AI persistent conversations
-- User isolation through Supabase Row Level Security

create table if not exists public.myka_conversations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null default 'Nova conversa',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint myka_conversations_title_length
        check (char_length(title) between 1 and 200),

    constraint myka_conversations_id_user_unique
        unique (id, user_id)
);

create table if not exists public.myka_messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null,
    user_id uuid not null references auth.users(id) on delete cascade,
    role text not null,
    content text not null,
    proposed_task jsonb,
    proposed_event jsonb,
    created_at timestamptz not null default now(),

    constraint myka_messages_role_check
        check (role in ('user', 'assistant')),

    constraint myka_messages_content_check
        check (char_length(content) between 1 and 20000),

    constraint myka_messages_conversation_owner_fk
        foreign key (conversation_id, user_id)
        references public.myka_conversations(id, user_id)
        on delete cascade
);

create index if not exists myka_conversations_user_updated_idx
    on public.myka_conversations(user_id, updated_at desc);

create index if not exists myka_messages_conversation_created_idx
    on public.myka_messages(conversation_id, created_at, id);

alter table public.myka_conversations
    enable row level security;

alter table public.myka_messages
    enable row level security;

revoke all on table public.myka_conversations
    from public, anon;

revoke all on table public.myka_messages
    from public, anon;

grant select, insert, update, delete
    on table public.myka_conversations
    to authenticated;

grant select, insert, update, delete
    on table public.myka_messages
    to authenticated;

drop policy if exists "myka_conversations_select_own"
    on public.myka_conversations;

create policy "myka_conversations_select_own"
    on public.myka_conversations
    for select to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "myka_conversations_insert_own"
    on public.myka_conversations;

create policy "myka_conversations_insert_own"
    on public.myka_conversations
    for insert to authenticated
    with check ((select auth.uid()) = user_id);

drop policy if exists "myka_conversations_update_own"
    on public.myka_conversations;

create policy "myka_conversations_update_own"
    on public.myka_conversations
    for update to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

drop policy if exists "myka_conversations_delete_own"
    on public.myka_conversations;

create policy "myka_conversations_delete_own"
    on public.myka_conversations
    for delete to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "myka_messages_select_own"
    on public.myka_messages;

create policy "myka_messages_select_own"
    on public.myka_messages
    for select to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "myka_messages_insert_own"
    on public.myka_messages;

create policy "myka_messages_insert_own"
    on public.myka_messages
    for insert to authenticated
    with check ((select auth.uid()) = user_id);

drop policy if exists "myka_messages_update_own"
    on public.myka_messages;

create policy "myka_messages_update_own"
    on public.myka_messages
    for update to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

drop policy if exists "myka_messages_delete_own"
    on public.myka_messages;

create policy "myka_messages_delete_own"
    on public.myka_messages
    for delete to authenticated
    using ((select auth.uid()) = user_id);