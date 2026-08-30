-- ============================================================================
-- ChessMaster — production database schema (PostgreSQL on Supabase)
--
-- Run this file ONCE in the Supabase SQL editor (Dashboard → SQL → New query).
--
-- Security model:
--   * The Vite frontend ONLY ever uses the public anon/publishable key
--     (VITE_SUPABASE_ANON_KEY). A service-role key is NEVER shipped to the
--     browser and is not required by this schema.
--   * Every table has Row Level Security enabled, and every policy is
--     scoped to auth.uid() — a user can read/write exactly their own rows
--     and nothing else, regardless of what a client sends.
--   * Passwords are handled exclusively by Supabase Auth (bcrypt,
--     server-side). This schema stores no password material at all.
--
-- Note on sign-up: if "Confirm email" is enabled in Supabase Auth settings,
-- new users must verify their inbox before login — the app surfaces this
-- case with a friendly message.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles — one row per authenticated user
--    Persistent home of: username, rating, highest (peak) rating, join date.
--    Games played / wins / losses / draws / win % are derived from the games
--    table so they are always consistent with the stored history.
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid        primary key references auth.users (id) on delete cascade,
  email       text        not null,
  username    text        not null unique,
  rating      integer     not null default 1200 check (rating >= 100),
  peak_rating integer     not null default 1200 check (peak_rating >= 100),
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: read own"      on public.profiles;
drop policy if exists "profiles: create own"    on public.profiles;
drop policy if exists "profiles: update own"    on public.profiles;
drop policy if exists "profiles: delete own"    on public.profiles;

create policy "profiles: read own"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: create own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: update own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles: delete own" on public.profiles for delete using (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- 2. games — complete, permanent history for every mode
--    Stores: mode (bot / friend / online), colours, names, opponent,
--    bot rating, result, score, the full move list (SAN), rating before/after
--    and the exact timestamp. This is the source of truth for history,
--    statistics, opponent history and replays.
-- ----------------------------------------------------------------------------
create table if not exists public.games (
  id            text        primary key,
  user_id       uuid        not null references auth.users (id) on delete cascade,
  mode          text        not null check (mode in ('bot', 'friend', 'online')),
  my_color      text        not null check (my_color in ('w', 'b')),
  my_name       text        not null,
  opponent      text        not null,
  bot_rating    integer,
  result        text        not null check (result in ('win', 'loss', 'draw')),
  score         text        not null,
  sans          jsonb       not null default '[]'::jsonb,
  rating_before integer,
  rating_after  integer,
  played_at     timestamptz not null default now()
);

create index if not exists games_by_user_date on public.games (user_id, played_at desc);

alter table public.games enable row level security;

drop policy if exists "games: read own"   on public.games;
drop policy if exists "games: create own" on public.games;
drop policy if exists "games: update own" on public.games;
drop policy if exists "games: delete own" on public.games;

create policy "games: read own"   on public.games for select using (auth.uid() = user_id);
create policy "games: create own" on public.games for insert with check (auth.uid() = user_id);
create policy "games: update own" on public.games for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "games: delete own" on public.games for delete using (auth.uid() = user_id);

-- ============================================================================
-- Done. The frontend needs only:
--   VITE_SUPABASE_URL       = your project URL
--   VITE_SUPABASE_ANON_KEY  = the public anon/publishable key
-- ============================================================================
