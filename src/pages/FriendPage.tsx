import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSessionUser, makeGameId, saveGame, type GameRecord } from "../account";
import type { Side } from "../chess";
import { MatchRoom, type GameOverInfo, type MatchHandle } from "../game/MatchRoom";
import { ArrowRightIcon, UsersIcon } from "../components/icons";

function scoreOf(info: GameOverInfo): string {
  if (!info.winner) return "½–½";
  return info.winner === "w" ? "1–0" : "0–1";
}

export function FriendPage() {
  const navigate = useNavigate();
  const session = getSessionUser();
  const [phase, setPhase] = useState<"setup" | "game">("setup");
  const [player1, setPlayer1] = useState(session?.username ?? "");
  const [player2, setPlayer2] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [p1Name, setP1Name] = useState("Player 1");
  const [p2Name, setP2Name] = useState("Player 2");

  const [saveState, setSaveState] = useState<"hidden" | "idle" | "saved">("hidden");
  const [savedRecord, setSavedRecord] = useState<GameRecord | null>(null);
  const pendingInfo = useRef<GameOverInfo | null>(null);
  const matchRef = useRef<MatchHandle>(null);

  const start = () => {
    const n1 = player1.trim() || "Player 1";
    const n2 = player2.trim();
    if (!n2) {
      setError("Give Player 2 a name — history needs to know who lost.");
      return;
    }
    setError(null);
    setP1Name(n1);
    setP2Name(n2);
    setSaveState(session ? "idle" : "hidden");
    setSavedRecord(null);
    pendingInfo.current = null;
    setPhase("game");
  };

  const onGameOver = (info: GameOverInfo) => {
    pendingInfo.current = info;
  };

  const handleSave = (info: GameOverInfo) => {
    const user = getSessionUser();
    if (!user) return;
    // the logged-in player's perspective: match by name, else assume White (seat 1)
    const myColor: Side =
      user.username.toLowerCase() === p2Name.toLowerCase()
        ? "b"
        : user.username.toLowerCase() === p1Name.toLowerCase()
          ? "w"
          : "w";
    const opponent = myColor === "w" ? p2Name : p1Name;
    const result = !info.winner ? "draw" : info.winner === myColor ? "win" : "loss";
    const record: GameRecord = {
      id: makeGameId(),
      mode: "friend",
      date: Date.now(),
      myColor,
      myName: user.username,
      opponent,
      result: result as GameRecord["result"],
      score: scoreOf(info),
      sans: info.sans,
    };
    saveGame(user.username, record);
    setSavedRecord(record);
    setSaveState("saved");
  };

  const rematch = () => {
    setSaveState(session ? "idle" : "hidden");
    setSavedRecord(null);
    pendingInfo.current = null;
    matchRef.current?.reset();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-28 sm:px-6 lg:px-8 lg:pt-36">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <button
            onClick={() => (phase === "game" ? setPhase("setup") : navigate("/play"))}
            className="group flex cursor-pointer items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.24em] text-brass-700 transition-colors hover:text-brass-600 dark:text-brass-300"
          >
            <ArrowRightIcon className="h-3.5 w-3.5 rotate-180 transition-transform group-hover:-translate-x-1" />
            {phase === "game" ? "Change players" : "All play modes"}
          </button>
          <h1 className="animate-rise mt-3 font-display text-[clamp(2.2rem,5vw,3.8rem)] font-bold leading-[1.01] tracking-tight text-ink-950 dark:text-ink-100">
            One board. <span className="text-outline">Two rivals.</span>
          </h1>
          <p className="animate-rise mt-4 max-w-xl text-lg leading-relaxed text-ink-500 dark:text-ink-300" style={{ animationDelay: "100ms" }}>
            Pass-and-play on a single phone, tablet or laptop. Player 1 takes White, Player 2 takes
            Black — pass the device after every move.
          </p>
        </div>
        <div className="flex items-center gap-2.5 rounded-lg border border-ink-900/10 bg-paper-50/85 px-4 py-2.5 dark:border-ink-100/10 dark:bg-ink-800/75">
          <UsersIcon className="h-4 w-4 text-felt-600 dark:text-felt-300" />
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-ink-500 dark:text-ink-300">
            Same device · hotseat
          </p>
        </div>
      </header>

      {phase === "setup" ? (
        <div className="animate-rise mx-auto mt-10 max-w-2xl" style={{ animationDelay: "180ms" }}>
          <div className="rounded-xl border border-ink-900/10 bg-paper-50/85 p-6 shadow-card backdrop-blur-sm dark:border-ink-100/10 dark:bg-ink-800/75 sm:p-8">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="p1" className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-400">
                  Player 1 · White
                </label>
                <input
                  id="p1"
                  value={player1}
                  onChange={(e) => setPlayer1(e.target.value)}
                  placeholder="coding boy"
                  maxLength={18}
                  className="mt-2.5 h-12 w-full rounded-lg border border-ink-900/15 bg-paper-100/60 px-4 text-[15px] font-medium text-ink-900 placeholder:text-ink-400 focus:border-brass-500 focus:outline-none focus:ring-2 focus:ring-brass-500/40 dark:border-ink-100/15 dark:bg-ink-900/60 dark:text-ink-100"
                />
              </div>
              <div>
                <label htmlFor="p2" className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-400">
                  Player 2 · Black
                </label>
                <input
                  id="p2"
                  value={player2}
                  onChange={(e) => {
                    setPlayer2(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Rahul"
                  maxLength={18}
                  className={`mt-2.5 h-12 w-full rounded-lg border bg-paper-100/60 px-4 text-[15px] font-medium text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 dark:bg-ink-900/60 dark:text-ink-100 ${
                    error
                      ? "border-blunder focus:ring-blunder/40"
                      : "border-ink-900/15 focus:border-brass-500 focus:ring-brass-500/40 dark:border-ink-100/15"
                  }`}
                />
              </div>
            </div>
            {error && <p className="mt-3 text-sm font-medium text-blunder">{error}</p>}

            <button
              onClick={start}
              className="group mt-7 inline-flex h-[52px] w-full cursor-pointer items-center justify-center gap-3 rounded-lg bg-brass-500 text-base font-bold text-ink-950 shadow-[0_14px_30px_-12px_rgb(207_159_61/0.7)] transition-all duration-300 hover:-translate-y-[2px] hover:bg-brass-400"
            >
              Start Game
              <ArrowRightIcon className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
            <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">
              {session ? `Saving as ${session.username}` : "Log in to keep these games in your history"}
            </p>
          </div>
        </div>
      ) : (
        <div className="animate-rise mt-10" style={{ animationDelay: "120ms" }}>
          <MatchRoom
            ref={matchRef}
            mode="friend"
            white={{ name: p1Name, kind: "human" }}
            black={{ name: p2Name, kind: "human" }}
            onGameOver={onGameOver}
            onRematch={rematch}
            onNewGame={() => setPhase("setup")}
            onSaveGame={handleSave}
            saveState={saveState}
            onViewGame={
              savedRecord
                ? () => navigate("/profile", { state: { replay: savedRecord.id } })
                : undefined
            }
            footerNote="Pass the device after each move — the active player's bar glows brass"
          />
        </div>
      )}
    </div>
  );
}
