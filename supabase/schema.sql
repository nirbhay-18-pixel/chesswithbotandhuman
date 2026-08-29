-- ============================================================
-- ChessMaster — production database schema (Supabase / Postgres)
-- ============================================================
-- Run this once in the Supabase SQL editor. It creates the two
-- app tables (auth.users is managed by Supabase Auth itself)
-- and row-level-security policies so every user can only read
-- or write their own rows. The frontend connects with the anon
-- key only; security is enforced here, server-side.
-- ============================================================

-- ---------------- profiles ----------------
-- One row per authenticated user, keyed by auth.users.id.
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  username   text not null unique,
  rating     integer not null default 1200,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own row"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: insert own row"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles: update own row"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------- games ----------------
-- Full game history for every mode (bot / friend / online).
-- `sans` stores the game in Standard Algebraic Notation so the
-- client can replay it exactly with chess.js.
create table if not exists public.games (
  id            text primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  mode          text not null check (mode in ('bot', 'friend', 'online')),
  my_color      text not null check (my_color in ('w', 'b')),
  my_name       text not null,
  opponent      text not null,
  bot_rating    integer,
  result        text not null check (result in ('win', 'loss', 'draw')),
  score         text not null,
  sans          jsonb not null default '[]'::jsonb,
  rating_before integer,
  rating_after  integer,
  played_at     timestamptz not null default now()
);

create index if not exists games_user_played_idx
  on public.games (user_id, played_at desc);

alter table public.games enable row level security;

create policy "games: read own rows"
  on public.games for select
  using (auth.uid() = user_id);

create policy "games: insert own rows"
  on public.games for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- Supabase Auth settings (dashboard → Authentication):
--   * Email provider enabled.
--   * For instant sign-up in development you may disable
--     "Confirm email"; with confirmation on, the app tells the
--     user to verify their inbox before logging in.
-- ============================================================
