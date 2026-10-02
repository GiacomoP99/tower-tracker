-- Tower Tracker: runs table with RLS
create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tier integer not null check (tier >= 1),
  wave_reached integer not null check (wave_reached >= 1),
  duration_seconds integer not null check (duration_seconds > 0),
  ran_at timestamptz not null,
  play_mode text not null check (play_mode in ('manual', 'afk')),
  coins numeric not null check (coins >= 0),
  cells numeric not null check (cells >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists runs_user_id_ran_at_idx on public.runs (user_id, ran_at desc);

alter table public.runs enable row level security;

create policy "Users can select own runs"
  on public.runs for select
  using (auth.uid() = user_id);

create policy "Users can insert own runs"
  on public.runs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own runs"
  on public.runs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own runs"
  on public.runs for delete
  using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists runs_set_updated_at on public.runs;
create trigger runs_set_updated_at
  before update on public.runs
  for each row execute function public.set_updated_at();
