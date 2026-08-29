import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Chess, type PieceSymbol } from "chess.js";
import {
  getHistory,
  getSessionUser,
  getStats,
  login,
  logout,
  signup,
  type GameRecord,
  type Mode,
  type StoredUser,
} from "../account";
import type { Kind, Piece, Side } from "../chess";
import { GLYPHS, squareToCoords } from "../chess";
import { ChessBoard } from "../components/ChessBoard";
import { ArrowRightIcon, CloseIcon, KnightMark, UndoIcon } from "../components/icons";
import { Chip } from "../components/ui";

const RESULT_BADGE: Record<GameRecord["result"], string> = {
  win: "bg-felt-500/15 text-felt-600 border-felt-500/40 dark:text-felt-300",
  loss: "bg-blunder/10 text-blunder border-blunder/40",
  draw: "bg-brass-500/15 text-brass-700 border-brass-500/40 dark:text-brass-300",
};

const MODE_LABEL: Record<Mode, string> = { bot: "Bot", friend: "Friend", online: "Online" };

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

/* ---------------- replay modal ---------------- */

function ReplayModal({ record, onClose }: { record: GameRecord; onClose: () => void }) {
  const [ply, setPly] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);

  const replay = useMemo(() => {
    const g = new Chess();
    const positions: string[] = [g.fen()];
    const sans: string[] = [];
    for (const san of record.sans) {
      try {
        const mv = g.move(san);
        sans.push(mv.san);
      } catch {
        break;
      }
      positions.push(g.fen());
    }
    return { positions, sans };
  }, [record]);

  const maxPly = replay.positions.length - 1;

  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(() => {
      setPly((p) => {
        if (p >= maxPly) {
          setPlaying(false);
          return p;
        }
        return p + 1;
      });
    }, 700);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [playing, maxPly]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setPly((p) => Math.max(0, p - 1));
      if (e.key === "ArrowRight") setPly((p) => Math.min(maxPly, p + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [maxPly, onClose]);

  const game = useMemo(() => {
    const g = new Chess();
    for (let i = 0; i < Math.min(ply, replay.sans.length); i++) {
      try {
        g.move(replay.sans[i]);
      } catch {
        break;
      }
    }
    return g;
  }, [ply, replay]);

  const pieces = useMemo<Piece[]>(() => {
    const list: Piece[] = [];
    game.board().forEach((rank) =>
      rank.forEach((cell) => {
        if (cell) {
          list.push({
            id: cell.square,
            side: cell.color as Side,
            kind: cell.type.toUpperCase() as Kind,
            ...squareToCoords(cell.square),
          });
        }
      }),
    );
    return list;
  }, [game]);

  const last = ply > 0 ? game.history({ verbose: true })[Math.min(ply, game.history().length) - 1] : null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-ink-100/15 bg-ink-900 shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-100/10 px-5 py-4">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-400">
              Replay · {MODE_LABEL[record.mode]} · {formatDate(record.date)}
            </p>
            <p className="mt-0.5 font-display text-xl font-bold text-ink-100">
              {record.myName} <span className="text-ink-500">vs</span> {record.opponent}
              <span className={`ml-3 rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold uppercase ${RESULT_BADGE[record.result]}`}>
                {record.result}
              </span>
            </p>
          </div>
          <button onClick={onClose} aria-label="Close replay" className="cursor-pointer rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-100/10 hover:text-ink-100">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="grid flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="mx-auto w-full max-w-[440px]">
            <div className="overflow-hidden rounded-lg border border-ink-100/15">
              <ChessBoard coords pieces={pieces} lastMove={last ? { from: squareToCoords(last.from), to: squareToCoords(last.to) } : null} />
            </div>
            <div className="mt-4 flex items-center justify-center gap-2.5">
              <button onClick={() => setPly(0)} className="h-10 cursor-pointer rounded-lg border border-ink-100/15 px-3 font-mono text-[12px] text-ink-200 transition-colors hover:border-brass-400 hover:text-brass-300">
                ⏮
              </button>
              <button onClick={() => setPly((p) => Math.max(0, p - 1))} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-ink-100/15 text-ink-200 transition-colors hover:border-brass-400 hover:text-brass-300" aria-label="Previous move">
                <UndoIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPlaying((v) => !v)}
                className="h-10 cursor-pointer rounded-lg bg-brass-500 px-5 font-mono text-[12px] font-bold text-ink-950 transition-colors hover:bg-brass-400"
              >
                {playing ? "Pause" : "Autoplay"}
              </button>
              <button onClick={() => setPly((p) => Math.min(maxPly, p + 1))} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-ink-100/15 text-ink-200 transition-colors hover:border-brass-400 hover:text-brass-300" aria-label="Next move">
                <ArrowRightIcon className="h-4 w-4" />
              </button>
              <button onClick={() => setPly(maxPly)} className="h-10 cursor-pointer rounded-lg border border-ink-100/15 px-3 font-mono text-[12px] text-ink-200 transition-colors hover:border-brass-400 hover:text-brass-300">
                ⏭
              </button>
            </div>
            <p className="mt-3 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">
              Ply {ply} / {maxPly}
            </p>
          </div>

          <div className="max-h-[380px] overflow-y-auto rounded-lg border border-ink-100/10 bg-ink-950/50 p-3">
            <div className="grid grid-cols-[2rem_1fr_1fr] gap-y-0.5 font-mono text-[12px]">
              {Array.from({ length: Math.ceil(replay.sans.length / 2) }, (_, i) => {
                const w = replay.sans[i * 2];
                const b = replay.sans[i * 2 + 1];
                const cellCls = (idx: number) =>
                  `rounded px-1.5 py-[2px] ${idx === ply - 1 ? "bg-brass-500/20 font-bold text-brass-300" : idx < ply ? "text-ink-200" : "text-ink-600"}`;
                return (
                  <div key={i} className="contents">
                    <span className="px-1 py-[2px] text-ink-500">{i + 1}.</span>
                    <button onClick={() => setPly(i * 2 + 1)} className={`cursor-pointer text-left ${cellCls(i * 2 + 1)}`}>
                      {w ?? ""}
                    </button>
                    <button onClick={() => setPly(i * 2 + 2)} className={`cursor-pointer text-left ${cellCls(i * 2 + 2)}`}>
                      {b ?? ""}
                    </button>
                  </div>
                );
              })}
              {replay.sans.length === 0 && <p className="col-span-3 py-4 text-center text-ink-500">No moves recorded</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- auth form ---------------- */

function AuthCard({ onDone }: { onDone: (u: StoredUser) => void }) {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = tab === "login" ? await login(username, password) : await signup(username, password);
    setBusy(false);
    if (!res.ok || !res.user) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    onDone(res.user);
  };

  return (
    <div className="mx-auto max-w-md rounded-xl border border-ink-900/10 bg-paper-50/85 p-7 shadow-card backdrop-blur-sm dark:border-ink-100/10 dark:bg-ink-800/75">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brass-500 text-ink-950">
          <KnightMark className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink-950 dark:text-ink-100">Your club card.</h1>
          <p className="text-[13px] text-ink-500 dark:text-ink-300">Accounts live on this device — games save to your history.</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 rounded-lg border border-ink-900/10 p-1 dark:border-ink-100/10">
        {(["login", "signup"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setError(null);
            }}
            className={`h-9 cursor-pointer rounded-md text-[14px] font-semibold transition-all ${
              tab === t ? "bg-brass-500 text-ink-950" : "text-ink-500 hover:text-ink-900 dark:hover:text-ink-100"
            }`}
          >
            {t === "login" ? "Log in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-5 space-y-3">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          maxLength={18}
          className="h-12 w-full rounded-lg border border-ink-900/15 bg-paper-100/60 px-4 text-[15px] font-medium text-ink-900 placeholder:text-ink-400 focus:border-brass-500 focus:outline-none focus:ring-2 focus:ring-brass-500/40 dark:border-ink-100/15 dark:bg-ink-900/60 dark:text-ink-100"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="h-12 w-full rounded-lg border border-ink-900/15 bg-paper-100/60 px-4 text-[15px] font-medium text-ink-900 placeholder:text-ink-400 focus:border-brass-500 focus:outline-none focus:ring-2 focus:ring-brass-500/40 dark:border-ink-100/15 dark:bg-ink-900/60 dark:text-ink-100"
        />
        {error && <p className="text-sm font-medium text-blunder">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="h-12 w-full cursor-pointer rounded-lg bg-brass-500 text-base font-bold text-ink-950 transition-all duration-300 hover:-translate-y-[2px] hover:bg-brass-400 disabled:opacity-50"
        >
          {busy ? "One moment…" : tab === "login" ? "Log in" : "Create account"}
        </button>
      </form>
    </div>
  );
}

/* ---------------- page ---------------- */

const TABS = [
  { id: "all", label: "All" },
  { id: "bot", label: "Bot" },
  { id: "friend", label: "Friend" },
  { id: "online", label: "Online" },
] as const;

export function ProfilePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<StoredUser | null>(() => getSessionUser());
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const [replay, setReplay] = useState<GameRecord | null>(null);

  const history = useMemo(() => (user ? getHistory(user.username) : []), [user]);
  const stats = useMemo(() => (user ? getStats(user.username) : null), [user]);

  // deep-link from "View Game"
  useEffect(() => {
    const target = (location.state as { replay?: string } | null)?.replay;
    if (target && user) {
      const record = getHistory(user.username).find((g) => g.id === target);
      if (record) setReplay(record);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, user, navigate]);

  if (!user || !stats) {
    return (
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-28 sm:px-6 lg:px-8 lg:pt-36">
        <AuthCard onDone={setUser} />
      </div>
    );
  }

  const filtered = tab === "all" ? history : history.filter((g) => g.mode === tab);
  const winRate = stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-28 sm:px-6 lg:px-8 lg:pt-36">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex items-center gap-5">
          <span className="flex h-20 w-20 items-center justify-center rounded-xl bg-brass-500 font-display text-3xl font-bold text-ink-950 shadow-[0_14px_30px_-12px_rgb(207_159_61/0.7)]">
            {user.username.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.24em] text-brass-700 dark:text-brass-300">
              Member since {new Date(user.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
            </p>
            <h1 className="mt-1 font-display text-[clamp(2rem,4.6vw,3.4rem)] font-bold leading-[1.01] tracking-tight text-ink-950 dark:text-ink-100">
              {user.username}
            </h1>
          </div>
        </div>
        <button
          onClick={() => {
            logout();
            setUser(null);
          }}
          className="cursor-pointer rounded-lg border border-ink-900/15 px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-600 transition-colors hover:border-blunder hover:text-blunder dark:border-ink-100/15 dark:text-ink-300"
        >
          Log out
        </button>
      </header>

      {/* stats */}
      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: "Rating", value: String(stats.rating) },
          { label: "Games", value: String(stats.games) },
          { label: "Wins", value: String(stats.wins) },
          { label: "Losses", value: String(stats.losses) },
          { label: "Win rate", value: `${winRate}%` },
        ].map((s, i) => (
          <div key={s.label} className="animate-rise rounded-xl border border-ink-900/10 bg-paper-50/85 p-5 shadow-card backdrop-blur-sm dark:border-ink-100/10 dark:bg-ink-800/75" style={{ animationDelay: `${i * 60}ms` }}>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-400">{s.label}</p>
            <p className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink-950 dark:text-ink-100">{s.value}</p>
          </div>
        ))}
      </div>

      {/* history */}
      <div className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink-950 dark:text-ink-100">Game History</h2>
          <div className="flex gap-2 rounded-lg border border-ink-900/10 p-1 dark:border-ink-100/10">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`h-8 cursor-pointer rounded-md px-3.5 font-mono text-[11px] font-semibold uppercase tracking-wider transition-all ${
                  tab === t.id ? "bg-brass-500 text-ink-950" : "text-ink-500 hover:text-ink-900 dark:hover:text-ink-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-ink-900/15 p-10 text-center dark:border-ink-100/15">
              <p className="font-display text-xl font-bold text-ink-700 dark:text-ink-200">No {tab === "all" ? "" : tab + " "}games yet.</p>
              <p className="mt-1.5 text-[14px] text-ink-500 dark:text-ink-300">Finished games from every mode land here automatically.</p>
              <button onClick={() => navigate("/play")} className="mt-5 inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg bg-brass-500 px-6 text-[15px] font-bold text-ink-950 transition-all hover:-translate-y-[2px] hover:bg-brass-400">
                Start playing
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            </div>
          )}

          {filtered.map((g) => (
            <button
              key={g.id}
              onClick={() => setReplay(g)}
              className="group flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl border border-ink-900/10 bg-paper-50/85 px-5 py-4 text-left shadow-card backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-brass-500/50 hover:shadow-lift dark:border-ink-100/10 dark:bg-ink-800/75"
            >
              <div className="flex min-w-0 items-center gap-4">
                <span className={`shrink-0 rounded-md border px-2.5 py-1 font-mono text-[11px] font-bold uppercase ${RESULT_BADGE[g.result]}`}>
                  {g.result}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-ink-900 dark:text-ink-100">
                    {g.myName} <span className="font-normal text-ink-400">vs</span> {g.opponent}
                  </p>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-ink-400">
                    {MODE_LABEL[g.mode]} · {g.myColor === "w" ? "White" : "Black"} · {formatDate(g.date)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                {g.ratingBefore !== undefined && g.ratingAfter !== undefined && (
                  <span className={`hidden font-mono text-[12px] font-bold sm:block ${g.ratingAfter >= g.ratingBefore ? "text-felt-600 dark:text-felt-300" : "text-blunder"}`}>
                    {g.ratingBefore} → {g.ratingAfter}
                  </span>
                )}
                <Chip>{MODE_LABEL[g.mode]}</Chip>
                <span className="font-mono text-[13px] font-bold text-ink-500 dark:text-ink-300">{g.score}</span>
                <ArrowRightIcon className="h-4 w-4 text-ink-400 transition-transform group-hover:translate-x-1 group-hover:text-brass-600" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {replay && <ReplayModal record={replay} onClose={() => setReplay(null)} />}
    </div>
  );
}
