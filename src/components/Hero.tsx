import { useEffect, useRef, useState } from "react";
import {
  evalToWhitePct,
  initialPieces,
  OPENING_SCRIPT,
  type Piece,
  type ScriptMove,
} from "../chess";
import { usePrefersReducedMotion } from "../hooks";
import { ChessBoard } from "./ChessBoard";
import { ArrowRightIcon, DiamondIcon, KnightMark } from "./icons";
import { useToast } from "./ui";

function applyScript(pieces: Piece[], moves: ScriptMove[]): Piece[] {
  let board = pieces;
  for (const move of moves) {
    board = board
      .filter((p) => !(p.col === move.to[0] && p.row === move.to[1]))
      .map((p) =>
        p.col === move.from[0] && p.row === move.from[1]
          ? { ...p, col: move.to[0], row: move.to[1] }
          : p,
      );
  }
  return board;
}

const AVATARS = [
  { initials: "AR", tone: "bg-felt-500" },
  { initials: "MK", tone: "bg-brass-500 text-ink-950" },
  { initials: "JT", tone: "bg-ink-500" },
  { initials: "SV", tone: "bg-blunder" },
];

export function Hero() {
  const { push } = useToast();
  const reduced = usePrefersReducedMotion();

  const [pieces, setPieces] = useState<Piece[]>(() =>
    reduced ? applyScript(initialPieces(), OPENING_SCRIPT.slice(0, 10)) : initialPieces(),
  );
  const [step, setStep] = useState(() => (reduced ? 10 : 0));
  const [fading, setFading] = useState<Set<string>>(new Set());
  const notationRef = useRef<HTMLDivElement>(null);
  const cleanupTimers = useRef<number[]>([]);

  useEffect(() => {
    const timers = cleanupTimers.current;
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  useEffect(() => {
    if (reduced) return;
    const delay = step === 0 ? 1000 : step >= OPENING_SCRIPT.length ? 4600 : 1500;
    const t = window.setTimeout(() => {
      if (step >= OPENING_SCRIPT.length) {
        setPieces(initialPieces());
        setFading(new Set());
        setStep(0);
        return;
      }
      const move = OPENING_SCRIPT[step];
      const victim = pieces.find((p) => p.col === move.to[0] && p.row === move.to[1]);
      if (victim) {
        const victimId = victim.id;
        setFading((prev) => new Set(prev).add(victimId));
        cleanupTimers.current.push(
          window.setTimeout(() => {
            setPieces((prev) => prev.filter((p) => p.id !== victimId));
            setFading((prev) => {
              const next = new Set(prev);
              next.delete(victimId);
              return next;
            });
          }, 400),
        );
      }
      setPieces((prev) =>
        prev.map((p) =>
          p.col === move.from[0] && p.row === move.from[1]
            ? { ...p, col: move.to[0], row: move.to[1] }
            : p,
        ),
      );
      setStep(step + 1);
    }, delay);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, reduced]);

  useEffect(() => {
    const el = notationRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [step]);

  const last = step > 0 ? OPENING_SCRIPT[step - 1] : null;
  const evalCp = last ? last.evalCp : 0.2;
  const whitePct = evalToWhitePct(evalCp);
  const movePairs = Math.ceil(OPENING_SCRIPT.length / 2);

  return (
    <section id="top" className="relative overflow-hidden pb-16 pt-32 sm:pt-36 lg:pb-24 lg:pt-44">
      {/* giant knight watermark */}
      <KnightMark className="pointer-events-none absolute -left-44 top-16 hidden h-[560px] w-[560px] -rotate-12 text-ink-900/[0.045] dark:text-ink-100/[0.035] xl:block" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-12 lg:gap-10 lg:px-8">
        {/* ---------------- copy ---------------- */}
        <div className="lg:col-span-6">
          <p className="animate-rise flex items-center gap-3 font-mono text-[11px] font-medium uppercase tracking-[0.26em] text-brass-700 dark:text-brass-300">
            <DiamondIcon className="h-2.5 w-2.5" />
            Rated matches · Free forever · Season 01
          </p>

          <h1 className="mt-6 font-display font-bold leading-[0.99] tracking-tight text-ink-950 dark:text-ink-100">
            <span className="animate-rise block text-[clamp(2.9rem,7.2vw,5.4rem)]" style={{ animationDelay: "80ms" }}>
              Play Chess.
            </span>
            <span className="animate-rise block text-[clamp(2.9rem,7.2vw,5.4rem)]" style={{ animationDelay: "180ms" }}>
              Improve <span className="text-outline">Your Game.</span>
            </span>
          </h1>

          <p
            className="animate-rise mt-7 max-w-xl text-lg leading-relaxed text-ink-500 dark:text-ink-300"
            style={{ animationDelay: "280ms" }}
          >
            Blitz at midnight, classical on Sundays. ChessMaster pairs you with rivals
            worldwide, drills your tactics, and shows you exactly where every game was
            won — or thrown away.
          </p>

          <div className="animate-rise mt-9 flex flex-wrap items-center gap-4" style={{ animationDelay: "380ms" }}>
            <button
              onClick={() => push("Scanning the queue for a worthy opponent… matchmaking lands in the next update.")}
              className="group inline-flex h-[54px] cursor-pointer items-center gap-3 rounded-lg border border-brass-400/60 bg-brass-500 px-7 text-base font-bold tracking-tight text-ink-950 shadow-[0_14px_30px_-12px_rgb(207_159_61/0.7)] transition-all duration-300 hover:-translate-y-[3px] hover:bg-brass-400 active:translate-y-0"
            >
              Play Now
              <ArrowRightIcon className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
            <button
              onClick={() => push("Warming up the engines — computer opponents arrive with the 1.0 release.")}
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
        </div>

        {/* ---------------- board ---------------- */}
        <div className="animate-rise lg:col-span-6" style={{ animationDelay: "240ms" }}>
          <div className="relative mx-auto max-w-[600px]">
            {/* floating chips */}
            <div className="animate-float absolute -top-5 right-2 z-30 hidden rotate-3 items-center gap-2 rounded-lg border border-ink-900/10 bg-paper-50/95 px-3.5 py-2 font-mono text-xs font-semibold text-ink-800 shadow-lift backdrop-blur sm:flex dark:border-ink-100/10 dark:bg-ink-800/95 dark:text-ink-100">
              <span className="h-1.5 w-1.5 rounded-full bg-brass-500" />
              eval +{evalCp.toFixed(2)}
            </div>
            <div
              className="animate-float absolute -bottom-5 left-2 z-30 hidden -rotate-2 items-center gap-2 rounded-lg border border-ink-900/10 bg-paper-50/95 px-3.5 py-2 font-mono text-xs font-semibold text-ink-800 shadow-lift backdrop-blur sm:flex dark:border-ink-100/10 dark:bg-ink-800/95 dark:text-ink-100"
              style={{ animationDelay: "1.2s" }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-felt-400" />
              94.2% accuracy
            </div>

            <div className="flex gap-3">
              {/* evaluation bar */}
              <div className="relative hidden w-3 shrink-0 overflow-hidden rounded-full border border-ink-900/15 bg-ink-900 sm:block dark:border-ink-100/15">
                <div
                  className="absolute bottom-0 left-0 w-full bg-paper-50 transition-all duration-1000 ease-out"
                  style={{ height: `${whitePct}%` }}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="overflow-hidden rounded-xl border border-ink-900/15 shadow-lift dark:border-ink-100/15">
                  <ChessBoard
                    pieces={pieces}
                    fading={fading}
                    coords
                    lastMove={
                      last ? { from: { col: last.from[0], row: last.from[1] }, to: { col: last.to[0], row: last.to[1] } } : null
                    }
                  />
                </div>

                {/* notation card */}
                <div className="mt-4 rounded-xl border border-ink-900/10 bg-paper-50/80 p-4 shadow-card backdrop-blur-sm dark:border-ink-100/10 dark:bg-ink-800/70">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-ink-400 dark:text-ink-400">
                      Now playing · Italian Game <span className="text-brass-600 dark:text-brass-400">C53</span>
                    </p>
                    <p className="flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-felt-500 dark:text-felt-300">
                      <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-felt-400" />
                      Live board
                    </p>
                  </div>
                  <div ref={notationRef} className="no-scrollbar mt-3 grid max-h-[104px] grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1 overflow-y-auto font-mono text-[13px]">
                    {Array.from({ length: movePairs }, (_, i) => {
                      const w = OPENING_SCRIPT[i * 2];
                      const b = OPENING_SCRIPT[i * 2 + 1];
                      const wPlayed = i * 2 < step;
                      const bPlayed = i * 2 + 1 < step;
                      return (
                        <div key={i} className="contents">
                          <span className="text-ink-400 dark:text-ink-500">{i + 1}.</span>
                          <span
                            className={`rounded px-1.5 transition-colors duration-300 ${
                              wPlayed
                                ? step - 1 === i * 2
                                  ? "bg-brass-500/15 font-bold text-brass-700 dark:text-brass-300"
                                  : "text-ink-800 dark:text-ink-200"
                                : "text-ink-300 dark:text-ink-600"
                            }`}
                          >
                            {w?.san ?? ""}
                          </span>
                          <span
                            className={`rounded px-1.5 transition-colors duration-300 ${
                              bPlayed
                                ? step - 1 === i * 2 + 1
                                  ? "bg-brass-500/15 font-bold text-brass-700 dark:text-brass-300"
                                  : "text-ink-800 dark:text-ink-200"
                                : "text-ink-300 dark:text-ink-600"
                            }`}
                          >
                            {b?.san ?? ""}
                          </span>
                        </div>
                      );
                    })}
                    <span className="animate-blink col-start-2 h-4 w-2 self-center bg-brass-500/80" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
