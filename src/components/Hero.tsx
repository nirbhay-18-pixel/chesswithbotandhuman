import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Game, type GameHandle } from "./Game";
import { ArrowRightIcon, DiamondIcon, KnightMark } from "./icons";

const AVATARS = [
  { initials: "AR", tone: "bg-felt-500" },
  { initials: "MK", tone: "bg-brass-500 text-ink-950" },
  { initials: "JT", tone: "bg-ink-500" },
  { initials: "SV", tone: "bg-blunder" },
];

export function Hero() {
  const navigate = useNavigate();
  const gameRef = useRef<GameHandle>(null);

  const quickPlay = () => {
    gameRef.current?.quickStart();
    window.setTimeout(() => {
      document.getElementById("game")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  };

  return (
    <section id="top" className="relative overflow-hidden pb-16 pt-32 sm:pt-36 lg:pb-24 lg:pt-44">
      {/* giant knight watermark */}
      <KnightMark className="pointer-events-none absolute -left-44 top-16 hidden h-[560px] w-[560px] -rotate-12 text-ink-900/[0.045] dark:text-ink-100/[0.035] xl:block" />

      <div className="relative mx-auto grid max-w-7xl items-start gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-8 lg:px-8">
        {/* ---------------- copy ---------------- */}
        <div className="lg:col-span-5 lg:pt-6">
          <p className="animate-rise flex items-center gap-3 font-mono text-[11px] font-medium uppercase tracking-[0.26em] text-brass-700 dark:text-brass-300">
            <DiamondIcon className="h-2.5 w-2.5" />
            Season 01 · Coding Boy online
          </p>

          <h1 className="mt-6 font-display font-bold leading-[0.99] tracking-tight text-ink-950 dark:text-ink-100">
            <span className="animate-rise block text-[clamp(2.7rem,6.4vw,4.9rem)]" style={{ animationDelay: "80ms" }}>
              Play Chess.
            </span>
            <span className="animate-rise block text-[clamp(2.7rem,6.4vw,4.9rem)]" style={{ animationDelay: "180ms" }}>
              Improve <span className="text-outline">Your Game.</span>
            </span>
          </h1>

          <p
            className="animate-rise mt-7 max-w-md text-lg leading-relaxed text-ink-500 dark:text-ink-300"
            style={{ animationDelay: "280ms" }}
          >
            Sit down against <strong className="font-semibold text-ink-800 dark:text-ink-100">Coding Boy</strong> —
            our house engine, from polite beginner to ~2000 strength. Every move is
            legal, every loss is a lesson.
          </p>

          <div className="animate-rise mt-9 flex flex-wrap items-center gap-4" style={{ animationDelay: "380ms" }}>
            <button
              onClick={() => navigate("/play")}
              className="group inline-flex h-[54px] cursor-pointer items-center gap-3 rounded-lg border border-brass-400/60 bg-brass-500 px-7 text-base font-bold tracking-tight text-ink-950 shadow-[0_14px_30px_-12px_rgb(207_159_61/0.7)] transition-all duration-300 hover:-translate-y-[3px] hover:bg-brass-400 active:translate-y-0"
            >
              Play Now
              <ArrowRightIcon className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
            <button
              onClick={quickPlay}
              className="group inline-flex h-[54px] cursor-pointer items-center gap-3 rounded-lg border border-ink-900/20 px-7 text-base font-semibold tracking-tight text-ink-800 transition-all duration-300 hover:-translate-y-[3px] hover:border-brass-600 hover:text-brass-700 active:translate-y-0 dark:border-ink-100/20 dark:text-ink-100 dark:hover:border-brass-400 dark:hover:text-brass-300"
            >
              <KnightMark className="h-5 w-5 text-brass-600 transition-transform duration-300 group-hover:-rotate-12 dark:text-brass-400" />
              Play vs Computer
            </button>
          </div>

          <div className="animate-rise mt-10 flex flex-wrap items-center gap-4" style={{ animationDelay: "480ms" }}>
            <div className="flex -space-x-2.5">
              {AVATARS.map((a) => (
                <span
                  key={a.initials}
                  className={`flex h-9 w-9 items-center justify-center rounded-full ${a.tone} text-[11px] font-bold text-paper-50 ring-2 ring-paper-100 transition-transform duration-300 hover:-translate-y-1 dark:ring-ink-950`}
                >
                  {a.initials}
                </span>
              ))}
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-ink-400/60 text-[13px] font-semibold text-ink-500 ring-2 ring-paper-100 dark:border-ink-500 dark:text-ink-300 dark:ring-ink-950">
                +
              </span>
            </div>
            <p className="flex items-center gap-2.5 text-sm font-medium text-ink-500 dark:text-ink-300">
              <span className="animate-pulse-dot h-2.5 w-2.5 rounded-full bg-felt-400" />
              <span>
                <strong className="font-bold text-ink-900 dark:text-ink-100">12,483</strong> players in queue right now
              </span>
            </p>
          </div>

          <div
            className="animate-rise mt-10 hidden max-w-md border-l-2 border-brass-500/60 pl-4 lg:block"
            style={{ animationDelay: "560ms" }}
          >
            <p className="font-mono text-[11px] leading-relaxed tracking-wide text-ink-400">
              TIP — CLICK A PIECE TO SEE ITS LEGAL MOVES, THEN CLICK A HIGHLIGHTED SQUARE.
              CASTLING, EN PASSANT AND PROMOTIONS ARE ALL FAIR GAME.
            </p>
          </div>
        </div>

        {/* ---------------- the game ---------------- */}
        <div className="animate-rise lg:col-span-7" style={{ animationDelay: "240ms" }}>
          <Game ref={gameRef} />
        </div>
      </div>
    </section>
  );
}
