-- Online rooms for Quantum Ludo.
-- The `rooms` Edge Function is the only writer (service role). Browsers can read rooms
-- (public game state) and receive live updates through Realtime, but can't change them.

create table public.rooms (
  code text primary key check (code ~ '^[A-HJKMNP-Z2-9]{5}$'),
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'over')),
  match jsonb not null,
  state jsonb,
  version integer not null default 0,
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.rooms is 'Public state of each online room. Written only by the rooms Edge Function.';

-- Server-only: the dice generator position. Never readable by clients.
create table public.room_secrets (
  code text primary key references public.rooms (code) on delete cascade,
  rng bigint not null
);

-- Server-only: who holds which seat. Tokens are stored as SHA-256 hashes.
create table public.room_players (
  code text not null references public.rooms (code) on delete cascade,
  seat integer not null check (seat between 0 and 3),
  name text not null,
  token_hash text not null,
  is_host boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (code, seat)
);

create unique index room_players_token on public.room_players (token_hash);
create index rooms_updated_at on public.rooms (updated_at);

alter table public.rooms enable row level security;
alter table public.room_secrets enable row level security;
alter table public.room_players enable row level security;

-- Anyone may read rooms; nobody but the service role may write them.
create policy "Rooms are public to read" on public.rooms for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.rooms from anon, authenticated;
-- No policies on room_secrets / room_players: with RLS on, clients can't touch them at all.
revoke all on public.room_secrets, public.room_players from anon, authenticated;

-- Live updates for room rows.
alter publication supabase_realtime add table public.rooms;
