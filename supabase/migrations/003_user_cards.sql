-- User card inventory: stars (rank) + extras per card
create table if not exists public.user_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id text not null,
  stars integer not null default 0 check (stars >= 0 and stars <= 7),
  extras integer not null default 0 check (extras >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, card_id)
);

create index if not exists user_cards_user_id_idx on public.user_cards (user_id);

alter table public.user_cards enable row level security;

create policy "Users can select own cards"
  on public.user_cards for select
  using (auth.uid() = user_id);

create policy "Users can insert own cards"
  on public.user_cards for insert
  with check (auth.uid() = user_id);

create policy "Users can update own cards"
  on public.user_cards for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own cards"
  on public.user_cards for delete
  using (auth.uid() = user_id);

drop trigger if exists user_cards_set_updated_at on public.user_cards;
create trigger user_cards_set_updated_at
  before update on public.user_cards
  for each row execute function public.set_updated_at();
