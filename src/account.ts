/**
 * ChessMaster accounts — a fully local identity + history layer.
 * Games from every mode (bot, friend, online) are saved per user and
 * survive reloads. No server is involved; data lives in this browser.
 */

export type Mode = "bot" | "friend" | "online";
export type ResultKind = "win" | "loss" | "draw";

export interface StoredUser {
  username: string;
  passHash: string | null;
  rating: number;
  createdAt: number;
}

export interface GameRecord {
  id: string;
  mode: Mode;
  date: number;
  myColor: "w" | "b";
  myName: string;
  opponent: string;
  botRating?: number;
  result: ResultKind;
  score: string;
  /** full game in SAN — replayed with chess.js */
  sans: string[];
  ratingBefore?: number;
  ratingAfter?: number;
}

const USERS_KEY = "cm_users_v1";
const SESSION_KEY = "cm_session_v1";
const START_RATING = 1200;

function readUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as StoredUser[]) : [];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(`cm::${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalize(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

/* ---------------- session ---------------- */

export function getSessionUser(): StoredUser | null {
  const name = localStorage.getItem(SESSION_KEY);
  if (!name) return null;
  return readUsers().find((u) => u.username.toLowerCase() === name.toLowerCase()) ?? null;
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
}

/* ---------------- auth ---------------- */

export async function signup(
  username: string,
  password: string,
): Promise<{ ok: boolean; error?: string; user?: StoredUser }> {
  const name = normalize(username);
  if (name.length < 3) return { ok: false, error: "Name needs at least 3 characters." };
  if (name.length > 18) return { ok: false, error: "Keep it under 18 characters." };
  if (password.length < 4) return { ok: false, error: "Password needs at least 4 characters." };
  const users = readUsers();
  if (users.some((u) => u.username.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: "That name is already taken on this device." };
  }
  const user: StoredUser = {
    username: name,
    passHash: await hashPassword(password),
    rating: START_RATING,
    createdAt: Date.now(),
  };
  users.push(user);
  writeUsers(users);
  localStorage.setItem(SESSION_KEY, user.username);
  return { ok: true, user };
}

/** Passwordless account — handy for quick play on a shared device. */
export function quickCreate(username: string): { ok: boolean; error?: string; user?: StoredUser } {
  const name = normalize(username);
  if (name.length < 3) return { ok: false, error: "Name needs at least 3 characters." };
  if (name.length > 18) return { ok: false, error: "Keep it under 18 characters." };
  const users = readUsers();
  if (users.some((u) => u.username.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: "That name is taken — log in instead." };
  }
  const user: StoredUser = { username: name, passHash: null, rating: START_RATING, createdAt: Date.now() };
  users.push(user);
  writeUsers(users);
  localStorage.setItem(SESSION_KEY, user.username);
  return { ok: true, user };
}

export async function login(
  username: string,
  password: string,
): Promise<{ ok: boolean; error?: string; user?: StoredUser }> {
  const name = normalize(username);
  const user = readUsers().find((u) => u.username.toLowerCase() === name.toLowerCase());
  if (!user) return { ok: false, error: "No player with that name on this device." };
  if (user.passHash === null) {
    // passwordless account — accept any password
    localStorage.setItem(SESSION_KEY, user.username);
    return { ok: true, user };
  }
  const hash = await hashPassword(password);
  if (hash !== user.passHash) return { ok: false, error: "Wrong password — try again." };
  localStorage.setItem(SESSION_KEY, user.username);
  return { ok: true, user };
}

/* ---------------- rating ---------------- */

export function eloDelta(myRating: number, opponentRating: number, score: 0 | 0.5 | 1, k = 32): number {
  const expected = 1 / (1 + Math.pow(10, (opponentRating - myRating) / 400));
  return Math.round(k * (score - expected));
}

export function applyRatingChange(username: string, newRating: number) {
  const users = readUsers();
  const user = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return;
  user.rating = Math.max(100, newRating);
  writeUsers(users);
}

/* ---------------- history ---------------- */

function historyKey(username: string) {
  return `cm_history_v1_${username.toLowerCase()}`;
}

export function saveGame(username: string, record: GameRecord) {
  const key = historyKey(username);
  let list: GameRecord[] = [];
  try {
    list = JSON.parse(localStorage.getItem(key) ?? "[]") as GameRecord[];
  } catch {
    list = [];
  }
  list.unshift(record);
  localStorage.setItem(key, JSON.stringify(list.slice(0, 200)));
}

export function getHistory(username: string): GameRecord[] {
  try {
    return JSON.parse(localStorage.getItem(historyKey(username)) ?? "[]") as GameRecord[];
  } catch {
    return [];
  }
}

export interface PlayerStats {
  rating: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  perMode: Record<Mode, { games: number; wins: number; losses: number; draws: number }>;
}

export function getStats(username: string): PlayerStats {
  const user = readUsers().find((u) => u.username.toLowerCase() === username.toLowerCase());
  const history = getHistory(username);
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
  return { rating: user?.rating ?? START_RATING, games: history.length, wins, losses, draws, perMode };
}

export function makeGameId(): string {
  return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
