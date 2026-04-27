create table if not exists public.seed_guidance_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  problem_fingerprint text not null,
  language text not null check (language in ('cpp', 'python')),
  settings_key text not null,
  steps jsonb not null check (jsonb_typeof(steps) = 'array'),
  frontier_step integer not null default 1 check (frontier_step >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, problem_fingerprint, language, settings_key)
);

create index if not exists seed_guidance_sessions_user_idx on public.seed_guidance_sessions (user_id);

drop trigger if exists trg_seed_guidance_sessions_updated_at on public.seed_guidance_sessions;
create trigger trg_seed_guidance_sessions_updated_at
before update on public.seed_guidance_sessions
for each row execute function public.set_updated_at();

alter table public.seed_guidance_sessions enable row level security;

drop policy if exists "seed_guidance_select_own" on public.seed_guidance_sessions;
create policy "seed_guidance_select_own" on public.seed_guidance_sessions
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "seed_guidance_insert_own" on public.seed_guidance_sessions;
create policy "seed_guidance_insert_own" on public.seed_guidance_sessions
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "seed_guidance_update_own" on public.seed_guidance_sessions;
create policy "seed_guidance_update_own" on public.seed_guidance_sessions
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "seed_guidance_delete_own" on public.seed_guidance_sessions;
create policy "seed_guidance_delete_own" on public.seed_guidance_sessions
for delete to authenticated using (auth.uid() = user_id);
