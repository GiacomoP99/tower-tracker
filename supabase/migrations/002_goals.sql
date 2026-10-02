-- Goals table for personal targets with progress tracked from runs
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  metric text not null check (
    metric in (
      'avg_coins_per_hour',
      'avg_cells_per_hour',
      'best_coins_per_hour',
      'best_cells_per_hour',
      'best_wave',
      'total_coins',
      'total_cells',
      'run_count'
    )
  ),
  target numeric not null check (target > 0),
  period text not null check (period in ('day', 'week', 'month', 'all')),
  tier integer check (tier is null or tier >= 1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists goals_user_id_active_idx on public.goals (user_id, active);

alter table public.goals enable row level security;

create policy "Users can select own goals"
  on public.goals for select
  using (auth.uid() = user_id);

create policy "Users can insert own goals"
  on public.goals for insert
  with check (auth.uid() = user_id);

create policy "Users can update own goals"
  on public.goals for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own goals"
  on public.goals for delete
  using (auth.uid() = user_id);

drop trigger if exists goals_set_updated_at on public.goals;
create trigger goals_set_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();
