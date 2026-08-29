import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getDb, getDbKind, type AuthUser } from "./db";

interface AuthContextValue {
  /** null while restoring / signed out */
  user: AuthUser | null;
  /** false until the persisted session has been checked once */
  ready: boolean;
  /** "local" (embedded IndexedDB) or "supabase" (production database) */
  backend: "local" | "supabase";
  signup: (email: string, password: string, username: string) => Promise<AuthUser>;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  /** re-read the user row (after rating changes etc.) */
  refresh: () => Promise<void>;
  setUser: (u: AuthUser | null) => void;
}

const AuthCtx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDb()
      .restoreSession()
      .then((restored) => {
        if (!cancelled) setUser(restored);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signup = useCallback(async (email: string, password: string, username: string) => {
    const created = await getDb().signup(email, password, username);
    setUser(created);
    return created;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const loggedIn = await getDb().login(email, password);
    setUser(loggedIn);
    return loggedIn;
  }, []);

  const logout = useCallback(async () => {
    await getDb().logout();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const current = await getDb().restoreSession();
    setUser(current);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      backend: getDbKind(),
      signup,
      login,
      logout,
      refresh,
      setUser,
    }),
    [user, ready, signup, login, logout, refresh],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
