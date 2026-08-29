/**
 * Account & game-history API.
 *
 * All account data lives in a real database — never in localStorage:
 *  - Production: Supabase (Postgres + Supabase Auth) when
 *    VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are configured.
 *    See supabase/schema.sql for the tables and row-level security.
 *  - Otherwise: an embedded IndexedDB database with PBKDF2-hashed
 *    passwords, unique UUIDs, 30-day sessions and full game history —
 *    persistent across browser restarts.
 *
 * Every function here is async and keyed by the user's unique ID, so a
 * login always restores exactly that account's profile, rating, history
 * and opponent records.
 */

import { AuthError, getDb, type AuthUser } from "./auth/db";
import type { GameRecord, PlayerStats } from "./account-types";

export { AuthError };
export type { AuthUser, GameRecord, PlayerStats };
export type { Mode, ResultKind } from "./account-types";

/* ---------------- auth ---------------- */

export async function signup(email: string, password: string, username: string): Promise<AuthUser> {
  return getDb().signup(email, password, username);
}

export async function login(email: string, password: string): Promise<AuthUser> {
  return getDb().login(email, password);
}

export async function logout(): Promise<void> {
  return getDb().logout();
}

export async function restoreSession(): Promise<AuthUser | null> {
  return getDb().restoreSession();
}

/* ---------------- rating ---------------- */

export function eloDelta(
  myRating: number,
  opponentRating: number,
  score: 0 | 0.5 | 1,
  k = 32,
): number {
  const expected = 1 / (1 + Math.pow(10, (opponentRating - myRating) / 400));
  return Math.round(k * (score - expected));
}

export async function applyRatingChange(userId: string, newRating: number): Promise<void> {
  return getDb().updateRating(userId, newRating);
}

/* ---------------- history ---------------- */

export function makeGameId(): string {
  return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function saveGame(userId: string, record: GameRecord): Promise<void> {
  return getDb().saveGame(userId, record);
}

export async function getHistory(userId: string): Promise<GameRecord[]> {
  return getDb().getGames(userId);
}

export function computeStats(rating: number, history: GameRecord[]): PlayerStats {
  const perMode: PlayerStats["perMode"] = {
    bot: { games: 0, wins: 0, losses: 0, draws: 0 },
    friend: { games: 0, wins: 0, losses: 0, draws: 0 },
    online: { games: 0, wins: 0, losses: 0, draws: 0 },
  };
  let wins = 0;
  let losses = 0;
  let draws = 0;
  for (const g of history) {
    const bucket = perMode[g.mode];
    bucket.games += 1;
    if (g.result === "win") {
      wins += 1;
      bucket.wins += 1;
    } else if (g.result === "loss") {
      losses += 1;
      bucket.losses += 1;
    } else {
      draws += 1;
      bucket.draws += 1;
    }
  }
  return { rating, games: history.length, wins, losses, draws, perMode };
}

export async function getStats(userId: string, rating: number): Promise<PlayerStats> {
  const history = await getHistory(userId);
  return computeStats(rating, history);
}
