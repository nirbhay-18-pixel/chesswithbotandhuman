import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  applyRatingChange,
  eloDelta,
  getSessionUser,
  makeGameId,
  saveGame,
  type GameRecord,
} from "../account";
import { BOT_PERSONAS, BOT_RATINGS, getEngineKind, subscribeEngineKind, warmupEngine, type EngineKind } from "../engine";
import { MatchRoom, type GameOverInfo, type MatchHandle, type PlayerInfo } from "../game/MatchRoom";
import type { Side } from "../chess";
import { ArrowRightIcon, CpuIcon, DiceIcon, RobotIcon } from "../components/icons";

type ColorChoice = "w" | "b" | "random";

function scoreOf(info: GameOverInfo): string {
  if (!info.winner) return "½–½";
  return info.winner === "w" ? "1–0" : "0–1";
}

export function BotPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"setup" | "game">("setup");
  const [rating, setRating] = useState<number>(1200);
  const [colorChoice, setColorChoice] = useState<ColorChoice>("w");
  const [humanColor, setHumanColor] = useState<Side>("w");
  const [engineKind, setEngineKind] = useState<EngineKind | null>(getEngineKind());
  const [ratingDelta, setRatingDelta] = useState<number | null>(null);
  const [savedRecord, setSavedRecord] = useState<GameRecord | null>(null);
  const matchRef = useRef<MatchHandle>(null);
  const startRatingRef = useRef(1200);

  useEffect(() => subscribeEngineKind(setEngineKind), []);

  // Begin loading Stockfish as soon as the user enters the bot flow, so the
  // download + worker startup + UCI handshake finish before the first move.
  useEffect(() => {
    warmupEngine();
  }, []);

  const user = getSessionUser();
  const botColor: Side = humanColor === "w" ? "b" : "w";

  const startGame = () => {
    warmupEngine(); // idempotent — already loaded by now, keeps the first move instant
    const resolved: Side = colorChoice === "random" ? (Math.random() < 0.5 ? "w" : "b") : colorChoice;
    setHumanColor(resolved);
    startRatingRef.current = getSessionUser()?.rating ?? 1200;
    setRatingDelta(null);
    setSavedRecord(null);
    setPhase("game");
  };

  const white: PlayerInfo =
    humanColor === "w"
      ? { name: user?.username ?? "You", rating: user?.rating, kind: "human" }
      : { name: `Bot ${rating}`, rating, kind: "bot" };
  const black: PlayerInfo =
    humanColor === "b"
      ? { name: user?.username ?? "You", rating: user?.rating, kind: "human" }
      : { name: `Bot ${rating}`, rating, kind: "bot" };

  const onGameOver = (info: GameOverInfo) => {
    const result = !info.winner ? "draw" : info.winner === humanColor ? "win" : "loss";
    const scoreVal = result === "win" ? 1 : result === "draw" ? 0.5 : 0;
    const before = startRatingRef.current;
    const delta = eloDelta(before, rating, scoreVal as 0 | 0.5 | 1);
    const after = Math.max(100, before + delta);

    const session = getSessionUser();
    let record: GameRecord | null = null;
    if (session) {
      applyRatingChange(session.username, after);
      record = {
        id: makeGameId(),
        mode: "bot",
        date: Date.now(),
        myColor: humanColor,
        myName: session.username,
        opponent: `Bot ${rating}`,
        botRating: rating,
        result,
        score: scoreOf(info),
        sans: info.sans,
        ratingBefore: before,
        ratingAfter: after,
      };
      saveGame(session.username, record);
    }
    setRatingDelta(session ? delta : null);
    setSavedRecord(record);
  };

  const rematch = () => {
    startRatingRef.current = getSessionUser()?.rating ?? 1200;
    setRatingDelta(null);
    setSavedRecord(null);
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
            {phase === "game" ? "Change settings" : "All play modes"}
          </button>
          <h1
            className="animate-rise mt-3 font-display text-[clamp(2.2rem,5vw,3.8rem)] font-bold leading-[1.01] tracking-tight text-ink-950 dark:text-ink-100"
          >
            Play vs <span className="text-outline">Coding Boy.</span>
          </h1>
          <p className="animate-rise mt-4 max-w-xl text-lg leading-relaxed text-ink-500 dark:text-ink-300" style={{ animationDelay: "100ms" }}>
            Our house engine, tuned from beginner to master. The rating you pick is the rating it
            plays — Stockfish skill and depth scale with every step.
          </p>
        </div>

        <div className="flex items-center gap-2.5 rounded-lg border border-ink-900/10 bg-paper-50/85 px-4 py-2.5 dark:border-ink-100/10 dark:bg-ink-800/75">
          <span
            className={`h-2 w-2 rounded-full ${
              engineKind === "stockfish"
                ? "bg-felt-400"
                : engineKind === "classic"
                  ? "bg-brass-500"
                  : "animate-pulse-dot bg-ink-400"
            }`}
          />
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-ink-500 dark:text-ink-300">
            {engineKind === "stockfish"
              ? "Stockfish 10 · ready"
              : engineKind === "classic"
                ? "Classic engine · fallback"
                : "Loading Stockfish…"}
          </p>
        </div>
      </header>

      {phase === "setup" ? (
        <div className="animate-rise mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start" style={{ animationDelay: "180ms" }}>
          {/* rating grid */}
          <section className="rounded-xl border border-ink-900/10 bg-paper-50/85 p-6 shadow-card backdrop-blur-sm dark:border-ink-100/10 dark:bg-ink-800/75 sm:p-8">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-ink-400">
              1 · Choose bot rating
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {BOT_RATINGS.map((r) => {
                const active = r === rating;
                return (
                  <button
                    key={r}
                    onClick={() => setRating(r)}
                    className={`group cursor-pointer rounded-lg border p-3.5 text-left transition-all duration-300 hover:-translate-y-1 ${
                      active
                        ? "border-brass-500 bg-brass-500/10 shadow-[0_10px_24px_-14px_rgb(207_159_61/0.8)]"
                        : "border-ink-900/12 hover:border-brass-500/50 dark:border-ink-100/12"
                    }`}
                  >
                    <p className={`font-display text-2xl font-bold tracking-tight ${active ? "text-brass-700 dark:text-brass-300" : "text-ink-950 dark:text-ink-100"}`}>
                      {r === 2200 ? "2200+" : r}
                    </p>
                    <p className={`mt-0.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider ${active ? "text-brass-700/80 dark:text-brass-300/80" : "text-ink-400"}`}>
                      <RobotIcon className="h-3 w-3" />
                      {BOT_PERSONAS[r]}
                    </p>
                  </button>
                );
              })}
            </div>

            <p className="mt-8 font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-ink-400">
              2 · Choose your colour
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {(
                [
                  { id: "w", label: "White", glyph: "♔" },
                  { id: "b", label: "Black", glyph: "♚" },
                  { id: "random", label: "Random", glyph: "?" },
                ] as { id: ColorChoice; label: string; glyph: string }[]
              ).map((c) => {
                const active = colorChoice === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setColorChoice(c.id)}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-5 py-3 transition-all duration-300 hover:-translate-y-0.5 ${
                      active
                        ? "border-brass-500 bg-brass-500/10"
                        : "border-ink-900/12 hover:border-brass-500/50 dark:border-ink-100/12"
                    }`}
                  >
                    {c.id === "random" ? (
                      <DiceIcon className={`h-5 w-5 ${active ? "text-brass-600 dark:text-brass-300" : "text-ink-500 dark:text-ink-300"}`} />
                    ) : (
                      <span className="piece-glyph text-[22px] leading-none">{c.glyph}</span>
                    )}
                    <span className={`text-[15px] font-semibold ${active ? "text-brass-700 dark:text-brass-300" : "text-ink-800 dark:text-ink-100"}`}>
                      {c.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* play card */}
          <aside className="rounded-xl border border-brass-500/30 bg-paper-50/90 p-6 shadow-card backdrop-blur-sm dark:bg-ink-800/80 sm:p-7">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-ink-900 text-brass-300 dark:bg-ink-700">
                <RobotIcon className="h-6 w-6" />
              </span>
              <div>
                <p className="font-display text-xl font-bold leading-tight text-ink-950 dark:text-ink-100">
                  Bot {rating === 2200 ? "2200+" : rating}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">{BOT_PERSONAS[rating]} · Coding Boy</p>
              </div>
            </div>

            <div className="mt-5 space-y-2.5 text-[14px]">
              <div className="flex items-center justify-between">
                <span className="text-ink-500 dark:text-ink-300">You play</span>
                <span className="font-semibold text-ink-900 dark:text-ink-100">
                  {colorChoice === "random" ? "Random colour" : colorChoice === "w" ? "White" : "Black"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-500 dark:text-ink-300">Engine</span>
                <span className="font-semibold text-ink-900 dark:text-ink-100">
                  {engineKind === "classic" ? "Classic (fallback)" : "Stockfish 10"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-500 dark:text-ink-300">Rated</span>
                <span className="font-semibold text-ink-900 dark:text-ink-100">{user ? `Yes · ${user.rating}` : "Log in to rate"}</span>
              </div>
            </div>

            <button
              onClick={startGame}
              className="group mt-6 inline-flex h-[52px] w-full cursor-pointer items-center justify-center gap-3 rounded-lg bg-brass-500 text-base font-bold text-ink-950 shadow-[0_14px_30px_-12px_rgb(207_159_61/0.7)] transition-all duration-300 hover:-translate-y-[2px] hover:bg-brass-400"
            >
              Play
              <ArrowRightIcon className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
            <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">
              Real engine moves · never random
            </p>
          </aside>
        </div>
      ) : (
        <div className="animate-rise mt-10" style={{ animationDelay: "120ms" }}>
          <MatchRoom
            ref={matchRef}
            mode="bot"
            white={white}
            black={black}
            botColor={botColor}
            botRating={rating}
            onGameOver={onGameOver}
            onRematch={rematch}
            onNewGame={() => setPhase("setup")}
            onViewGame={
              savedRecord
                ? () => navigate("/profile", { state: { replay: savedRecord.id } })
                : undefined
            }
            resultExtras={
              ratingDelta !== null ? (
                <div className="flex items-center gap-4 rounded-lg border border-ink-100/15 bg-ink-900/60 px-5 py-3">
                  <div className="text-left">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">Your rating</p>
                    <p className="font-display text-xl font-bold text-ink-100">
                      {startRatingRef.current}
                      <ArrowRightIcon className="mx-2 inline h-4 w-4 text-ink-400" />
                      {Math.max(100, startRatingRef.current + ratingDelta)}
                    </p>
                  </div>
                  <span
                    className={`rounded-md px-2.5 py-1 font-mono text-sm font-bold ${
                      ratingDelta >= 0 ? "bg-felt-500/20 text-felt-300" : "bg-blunder/20 text-[#e08a80]"
                    }`}
                  >
                    {ratingDelta >= 0 ? `+${ratingDelta}` : ratingDelta}
                  </span>
                </div>
              ) : (
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-400">
                  Log in to record this game and move your rating
                </p>
              )
            }
            panelExtras={
              <div className="rounded-xl border border-ink-900/10 bg-paper-50/85 p-4 dark:border-ink-100/10 dark:bg-ink-800/75">
                <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-400">
                  <CpuIcon className="h-3.5 w-3.5 text-brass-600 dark:text-brass-300" />
                  Opponent
                </p>
                <p className="mt-2 text-[14px] font-semibold text-ink-900 dark:text-ink-100">
                  Bot {rating === 2200 ? "2200+" : rating} · {BOT_PERSONAS[rating]}
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-500 dark:text-ink-300">
                  Stockfish with rating-scaled skill. It thinks, you answer — pieces lock while it calculates.
                </p>
              </div>
            }
          />
        </div>
      )}
    </div>
  );
}
