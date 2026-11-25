-- watermusic account store (Supabase / Postgres)
-- Run this once in the Supabase SQL editor.
-- Then, in Authentication > Providers > Email, turn OFF "Confirm email",
-- otherwise username sign-ups never get a session back.

create table if not exists public.wm_state (
    user_id uuid primary key references auth.users (id) on delete cascade,
    data jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

alter table public.wm_state enable row level security;

drop policy if exists "wm_state read own" on public.wm_state;
drop policy if exists "wm_state insert own" on public.wm_state;
drop policy if exists "wm_state update own" on public.wm_state;

create policy "wm_state read own" on public.wm_state
    for select using (auth.uid() = user_id);

create policy "wm_state insert own" on public.wm_state
    for insert with check (auth.uid() = user_id);

create policy "wm_state update own" on public.wm_state
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
