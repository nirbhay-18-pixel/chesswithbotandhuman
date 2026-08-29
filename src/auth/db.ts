import type { GameRecord, ResultKind } from "../account-types";
import { hashPassword, makeSessionToken, makeUserId, verifyPassword } from "./crypto";

export type { GameRecord, ResultKind };

/* ------------------------------------------------------------------ */
/* Shared contracts                                                    */
/* ------------------------------------------------------------------ */

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  rating: number;
  createdAt: number;
}

/** Thrown for expected auth failures — `message` is safe to show the user. */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export interface AuthDb {
  readonly kind: "local" | "supabase";
  signup(email: string, password: string, username: string): Promise<AuthUser>;
  login(email: string, password: string): Promise<AuthUser>;
  restoreSession(): Promise<AuthUser | null>;
  logout(): Promise<void>;
  updateRating(userId: string, rating: number): Promise<void>;
  saveGame(userId: string, record: GameRecord): Promise<void>;
  getGames(userId: string): Promise<GameRecord[]>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateEmail(email: string) {
  if (!EMAIL_RE.test(email.trim())) throw new AuthError("Enter a valid email address.");
}
function validatePassword(password: string) {
  if (password.length < 8) throw new AuthError("Password needs at least 8 characters.");
}
function validateUsername(username: string) {
  const name = username.trim();
  if (name.length < 3) throw new AuthError("Username needs at least 3 characters.");
  if (name.length > 18) throw new AuthError("Keep the username under 18 characters.");
  if (!/^[a-zA-Z0-9 _-]+$/.test(name))
    throw new AuthError("Letters, numbers, spaces, - and _ only.");
}

/* ------------------------------------------------------------------ */
/* Local adapter — embedded IndexedDB database                         */
/*                                                                     */
/* Used when no Supabase credentials are configured. IndexedDB is a    */
/* real, structured, transactional browser database: accounts,         */
/* sessions and every game record persist across browser restarts.     */
/* ------------------------------------------------------------------ */

interface LocalUserRow {
  id: string;
  email: string; // stored lowercase
  username: string; // stored lowercase for uniqueness
  displayName: string;
  hash: string;
  salt: string;
  iterations: number;
  rating: number;
  createdAt: number;
}

interface LocalSessionRow {
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

interface LocalGameRow extends GameRecord {
  userId: string;
}

const DB_NAME = "chessmaster_db";
const DB_VERSION = 1;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function openLocalDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new AuthError("This browser does not support the local database."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("users")) {
        const users = db.createObjectStore("users", { keyPath: "id" });
        users.createIndex("email", "email", { unique: true });
        users.createIndex("username", "username", { unique: true });
      }
      if (!db.objectStoreNames.contains("sessions")) {
        db.createObjectStore("sessions", { keyPath: "token" });
      }
      if (!db.objectStoreNames.contains("games")) {
        const games = db.createObjectStore("games", { keyPath: "id" });
        games.createIndex("userId", "userId");
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new AuthError("Could not open the local database."));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new AuthError("Database write failed."));
    tx.onabort = () => reject(tx.error ?? new AuthError("Database transaction aborted."));
  });
}

function reqAsPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new AuthError("Database read failed."));
  });
}

class LocalDb implements AuthDb {
  readonly kind = "local" as const;
  private dbPromise: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) this.dbPromise = openLocalDb();
    return this.dbPromise;
  }

  private toAuthUser(row: LocalUserRow): AuthUser {
    return {
      id: row.id,
      email: row.email,
      username: row.displayName,
      rating: row.rating,
      createdAt: row.createdAt,
    };
  }

  async signup(email: string, password: string, username: string): Promise<AuthUser> {
    validateEmail(email);
    validatePassword(password);
    validateUsername(username);
    const db = await this.db();
    const emailKey = email.trim().toLowerCase();
    const usernameKey = username.trim().toLowerCase();

    const existing = await reqAsPromise(
      db.transaction("users").objectStore("users").index("email").get(emailKey),
    );
    if (existing) throw new AuthError("An account with this email already exists — log in instead.");
    const taken = await reqAsPromise(
      db.transaction("users").objectStore("users").index("username").get(usernameKey),
    );
    if (taken) throw new AuthError("That username is taken — pick another.");

    const digest = await hashPassword(password);
    const row: LocalUserRow = {
      id: makeUserId(),
      email: emailKey,
      username: usernameKey,
      displayName: username.trim(),
      hash: digest.hash,
      salt: digest.salt,
      iterations: digest.iterations,
      rating: 1200,
      createdAt: Date.now(),
    };
    const writeTx = db.transaction("users", "readwrite");
    writeTx.objectStore("users").add(row);
    await txDone(writeTx);
    await this.createSession(db, row.id);
    return this.toAuthUser(row);
  }

  async login(email: string, password: string): Promise<AuthUser> {
    validateEmail(email);
    if (!password) throw new AuthError("Enter your password.");
    const db = await this.db();
    const row = (await reqAsPromise(
      db
        .transaction("users")
        .objectStore("users")
        .index("email")
        .get(email.trim().toLowerCase()),
    )) as LocalUserRow | undefined;
    if (!row) throw new AuthError("No account found for that email.");
    const ok = await verifyPassword(password, {
      hash: row.hash,
      salt: row.salt,
      iterations: row.iterations,
    });
    if (!ok) throw new AuthError("Incorrect password — try again.");
    await this.createSession(db, row.id);
    return this.toAuthUser(row);
  }

  private async createSession(db: IDBDatabase, userId: string) {
    const token = makeSessionToken();
    const session: LocalSessionRow = {
      token,
      userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_TTL_MS,
    };
    const tx = db.transaction(["sessions", "meta"], "readwrite");
    tx.objectStore("sessions").add(session);
    tx.objectStore("meta").put({ key: "active_session", token });
    await txDone(tx);
  }

  async restoreSession(): Promise<AuthUser | null> {
    const db = await this.db();
    const meta = (await reqAsPromise(
      db.transaction("meta").objectStore("meta").get("active_session"),
    )) as { key: string; token: string } | undefined;
    if (!meta?.token) return null;
    const session = (await reqAsPromise(
      db.transaction("sessions").objectStore("sessions").get(meta.token),
    )) as LocalSessionRow | undefined;
    if (!session) return null;
    if (session.expiresAt < Date.now()) {
      // expired — clean it up
      const tx = db.transaction(["sessions", "meta"], "readwrite");
      tx.objectStore("sessions").delete(meta.token);
      tx.objectStore("meta").delete("active_session");
      await txDone(tx).catch(() => undefined);
      return null;
    }
    const row = (await reqAsPromise(
      db.transaction("users").objectStore("users").get(session.userId),
    )) as LocalUserRow | undefined;
    return row ? this.toAuthUser(row) : null;
  }

  async logout(): Promise<void> {
    const db = await this.db();
    const meta = (await reqAsPromise(
      db.transaction("meta").objectStore("meta").get("active_session"),
    )) as { key: string; token: string } | undefined;
    const tx = db.transaction(["sessions", "meta"], "readwrite");
    if (meta?.token) tx.objectStore("sessions").delete(meta.token);
    tx.objectStore("meta").delete("active_session");
    await txDone(tx).catch(() => undefined);
  }

  async updateRating(userId: string, rating: number): Promise<void> {
    const db = await this.db();
    const readTx = db.transaction("users");
    const row = (await reqAsPromise(readTx.objectStore("users").get(userId))) as
      | LocalUserRow
      | undefined;
    if (!row) return;
    row.rating = Math.max(100, Math.round(rating));
    const writeTx = db.transaction("users", "readwrite");
    writeTx.objectStore("users").put(row);
    await txDone(writeTx);
  }

  async saveGame(userId: string, record: GameRecord): Promise<void> {
    const db = await this.db();
    const row: LocalGameRow = { ...record, userId };
    const writeTx = db.transaction("games", "readwrite");
    writeTx.objectStore("games").put(row);
    await txDone(writeTx);
  }

  async getGames(userId: string): Promise<GameRecord[]> {
    const db = await this.db();
    const rows = (await reqAsPromise(
      db.transaction("games").objectStore("games").index("userId").getAll(userId),
    )) as LocalGameRow[];
    return rows
      .map(({ userId: _uid, ...record }) => record)
      .sort((a, b) => b.date - a.date);
  }
}

/* ------------------------------------------------------------------ */
/* Supabase adapter — real production database over REST               */
/*                                                                     */
/* Activated by VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY. Auth is    */
/* handled by Supabase Auth (bcrypt server-side); accounts, ratings    */
/* and game history live in Postgres tables protected by RLS so each   */
/* user can only touch their own rows. The anon key is a public        */
/* client key — it is read from environment variables, never hardcoded.*/
/* ------------------------------------------------------------------ */

interface SbSession {
  access_token: string;
  refresh_token: string;
}

interface SbProfileRow {
  id: string;
  email: string;
  username: string;
  rating: number;
  created_at: string;
}

class SupabaseDb implements AuthDb {
  readonly kind = "supabase" as const;
  private url: string;
  private anonKey: string;
  private session: SbSession | null = null;
  private sbStorage = "chessmaster_sb_session_v1";

  constructor(url: string, anonKey: string) {
    this.url = url.replace(/\/$/, "");
    this.anonKey = anonKey;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      apikey: this.anonKey,
      ...(this.session ? { Authorization: `Bearer ${this.session.access_token}` } : {}),
      "Content-Type": "application/json",
      ...extra,
    };
  }

  private async post<T>(path: string, body: unknown, isAuth = false): Promise<T> {
    const res = await fetch(`${this.url}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as T & {
      error_description?: string;
      msg?: string;
      message?: string;
    };
    if (!res.ok) {
      throw new AuthError(this.friendlyError(data, res.status, isAuth));
    }
    return data;
  }

  private friendlyError(data: { error_description?: string; msg?: string; message?: string }, status: number, isAuth: boolean): string {
    const raw = data.error_description ?? data.msg ?? data.message ?? "";
    if (status === 400 && isAuth && /invalid/i.test(raw)) return "Email or password is incorrect.";
    if (/already registered|already exists/i.test(raw))
      return "An account with this email already exists — log in instead.";
    if (/password/i.test(raw) && /short|weak|at least/i.test(raw))
      return "Password needs at least 8 characters.";
    if (/email/i.test(raw) && /invalid/i.test(raw)) return "Enter a valid email address.";
    if (/username/i.test(raw) && /unique|duplicate/i.test(raw))
      return "That username is taken — pick another.";
    return raw || "Something went wrong talking to the server.";
  }

  private persistTokens() {
    if (this.session) localStorage.setItem(this.sbStorage, JSON.stringify(this.session));
    else localStorage.removeItem(this.sbStorage);
  }

  private loadTokens(): SbSession | null {
    try {
      const raw = localStorage.getItem(this.sbStorage);
      return raw ? (JSON.parse(raw) as SbSession) : null;
    } catch {
      return null;
    }
  }

  private async refreshTokens(): Promise<boolean> {
    const stored = this.loadTokens();
    if (!stored?.refresh_token) return false;
    try {
      const data = await this.post<{ access_token: string; refresh_token: string }>(
        "/auth/v1/token?grant_type=refresh_token",
        { refresh_token: stored.refresh_token },
        true,
      );
      this.session = { access_token: data.access_token, refresh_token: data.refresh_token };
      this.persistTokens();
      return true;
    } catch {
      this.session = null;
      this.persistTokens();
      return false;
    }
  }

  private async fetchProfile(userId: string): Promise<AuthUser> {
    const res = await fetch(
      `${this.url}/rest/v1/profiles?select=*&id=eq.${encodeURIComponent(userId)}`,
      { headers: this.headers() },
    );
    const rows = (await res.json().catch(() => [])) as SbProfileRow[];
    const row = rows[0];
    if (!row) throw new AuthError("Profile not found — please log in again.");
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      rating: row.rating,
      createdAt: new Date(row.created_at).getTime(),
    };
  }

  async signup(email: string, password: string, username: string): Promise<AuthUser> {
    validateEmail(email);
    validatePassword(password);
    validateUsername(username);
    const data = await this.post<{ id?: string; user?: { id: string }; session?: SbSession | null }>(
      "/auth/v1/signup",
      { email: email.trim(), password },
      true,
    );
    const userId = data.user?.id ?? data.id;
    if (!userId) throw new AuthError("Sign-up failed — try again.");
    if (!data.session) {
      throw new AuthError("Account created! Check your inbox to confirm your email, then log in.");
    }
    this.session = {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    };
    this.persistTokens();
    // create the profile row (unique username enforced by the database)
    const res = await fetch(`${this.url}/rest/v1/profiles`, {
      method: "POST",
      headers: this.headers({ Prefer: "return=representation" }),
      body: JSON.stringify({
        id: userId,
        email: email.trim().toLowerCase(),
        username: username.trim(),
        rating: 1200,
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (/duplicate|unique/i.test(body.message ?? "")) {
        throw new AuthError("That username is taken — pick another.");
      }
      throw new AuthError(body.message ?? "Could not create your profile.");
    }
    return this.fetchProfile(userId);
  }

  async login(email: string, password: string): Promise<AuthUser> {
    validateEmail(email);
    if (!password) throw new AuthError("Enter your password.");
    const data = await this.post<{
      access_token: string;
      refresh_token: string;
      user: { id: string };
    }>("/auth/v1/token?grant_type=password", { email: email.trim(), password }, true);
    this.session = { access_token: data.access_token, refresh_token: data.refresh_token };
    this.persistTokens();
    return this.fetchProfile(data.user.id);
  }

  async restoreSession(): Promise<AuthUser | null> {
    const stored = this.loadTokens();
    if (!stored) return null;
    this.session = stored;
    try {
      // try the current access token, refresh if rejected
      const res = await fetch(
        `${this.url}/auth/v1/user`,
        { headers: this.headers() },
      );
      if (!res.ok) {
        const ok = await this.refreshTokens();
        if (!ok) return null;
      }
      const me = await fetch(`${this.url}/auth/v1/user`, { headers: this.headers() });
      const userData = (await me.json()) as { id?: string };
      if (!userData.id) return null;
      return await this.fetchProfile(userData.id);
    } catch {
      return null;
    }
  }

  async logout(): Promise<void> {
    try {
      await this.post("/auth/v1/logout", {}, true);
    } catch {
      /* best effort */
    }
    this.session = null;
    this.persistTokens();
  }

  async updateRating(userId: string, rating: number): Promise<void> {
    await fetch(`${this.url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify({ rating: Math.max(100, Math.round(rating)) }),
    });
  }

  async saveGame(userId: string, record: GameRecord): Promise<void> {
    const res = await fetch(`${this.url}/rest/v1/games`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        id: record.id,
        user_id: userId,
        mode: record.mode,
        my_color: record.myColor,
        my_name: record.myName,
        opponent: record.opponent,
        bot_rating: record.botRating ?? null,
        result: record.result,
        score: record.score,
        sans: record.sans,
        rating_before: record.ratingBefore ?? null,
        rating_after: record.ratingAfter ?? null,
        played_at: new Date(record.date).toISOString(),
      }),
    });
    if (!res.ok) throw new AuthError("Could not save the game to the database.");
  }

  async getGames(userId: string): Promise<GameRecord[]> {
    const res = await fetch(
      `${this.url}/rest/v1/games?user_id=eq.${encodeURIComponent(userId)}&order=played_at.desc&limit=200&select=*`,
      { headers: this.headers() },
    );
    const rows = (await res.json().catch(() => [])) as Array<{
      id: string;
      mode: GameRecord["mode"];
      my_color: "w" | "b";
      my_name: string;
      opponent: string;
      bot_rating: number | null;
      result: ResultKind;
      score: string;
      sans: string[];
      rating_before: number | null;
      rating_after: number | null;
      played_at: string;
    }>;
    return rows.map((r) => ({
      id: r.id,
      mode: r.mode,
      date: new Date(r.played_at).getTime(),
      myColor: r.my_color,
      myName: r.my_name,
      opponent: r.opponent,
      botRating: r.bot_rating ?? undefined,
      result: r.result,
      score: r.score,
      sans: r.sans ?? [],
      ratingBefore: r.rating_before ?? undefined,
      ratingAfter: r.rating_after ?? undefined,
    }));
  }
}

/* ------------------------------------------------------------------ */
/* Adapter selection                                                   */
/* ------------------------------------------------------------------ */

let db: AuthDb | null = null;

export function getDb(): AuthDb {
  if (db) return db;
  const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env ?? {};
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  db = url && key ? new SupabaseDb(url, key) : new LocalDb();
  return db;
}

export function getDbKind(): "local" | "supabase" {
  return getDb().kind;
}
