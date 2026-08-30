import { useEffect, useState } from "react";
import { ENGINE_LEVELS, PUZZLES } from "../chess";
import { useInView, usePrefersReducedMotion } from "../hooks";
import { ChessBoard } from "./ChessBoard";
import {
  ArrowUpRightIcon,
  BoltIcon,
  CheckIcon,
  CpuIcon,
  FlameIcon,
  GlobeIcon,
  ScopeIcon,
  UsersIcon,
} from "./icons";
import { Chip, Reveal, SectionHeading, useToast } from "./ui";

const cardBase =
  "group relative flex h-full flex-col overflow-hidden rounded-xl border border-ink-900/10 bg-paper-50/85 p-6 shadow-card backdrop-blur-sm transition-all duration-400 hover:-translate-y-1.5 hover:border-brass-500/50 hover:shadow-lift sm:p-7 dark:border-ink-100/10 dark:bg-ink-800/75";

function CardHeader({
  icon,
  kicker,
  title,
  copy,
}: {
  icon: React.ReactNode;
  kicker: string;
  title: string;
  copy: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brass-500/15 text-brass-700 transition-transform duration-400 group-hover:-rotate-6 group-hover:scale-110 dark:text-brass-300">
          {icon}
        </span>
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.24em] text-ink-400 dark:text-ink-400">
          {kicker}
        </p>
      </div>
      <h3 className="mt-4 font-display text-2xl font-bold tracking-tight text-ink-950 dark:text-ink-100">
        {title}
      </h3>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-500 dark:text-ink-300">{copy}</p>
    </div>
  );
}

/* ---------------- Online chess card (live game mock) ---------------- */

function formatClock(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const LIVE_MOVES = ["1. e4", "c5", "2. Nf3", "d6", "3. d4", "cxd4", "4. Nxd4", "Nf6"];

function OnlineChessCard() {
  const { push } = useToast();
  const reduced = usePrefersReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.3 });
  const [whiteClock, setWhiteClock] = useState(187);
  const [blackClock, setBlackClock] = useState(203);

  useEffect(() => {
    if (!inView || reduced) return;
    const t = window.setInterval(() => {
      setWhiteClock((s) => (s <= 0 ? 180 : s - 1));
    }, 1000);
    const t2 = window.setInterval(() => {
      setBlackClock((s) => (s <= 0 ? 200 : s - 2));
    }, 2000);
    return () => {
      window.clearInterval(t);
      window.clearInterval(t2);
    };
  }, [inView, reduced]);

  return (
    <div id="play" ref={ref} className={`${cardBase} scroll-mt-28 lg:col-span-7 lg:row-span-2`}>
      <CardHeader
        icon={<GlobeIcon className="h-5.5 w-5.5" />}
        kicker="01 · Online Chess"
        title="Enter the arena"
        copy="Bullet to classical — matched by rating in seconds, with fair-play screening on every move. Climb seasonal ladders and earn titled badges."
      />

      <div className="mt-6 flex flex-1 flex-col justify-end gap-3">
        <div className="rounded-xl border border-ink-900/10 bg-paper-100/70 p-4 dark:border-ink-100/10 dark:bg-ink-900/60">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-blunder">
              <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-blunder" />
              Live · 3+2 Blitz
            </p>
            <p className="flex items-center gap-1.5 font-mono text-[11px] text-ink-400">
              <UsersIcon className="h-3.5 w-3.5" /> 1,204 watching
            </p>
          </div>

          {/* players + clocks */}
          <div className="mt-4 space-y-2.5">
            {[
              { name: "V. Volkova", rating: 2417, clock: blackClock, active: false, initials: "VV", tone: "bg-ink-700" },
              { name: "E. Anders", rating: 2389, clock: whiteClock, active: true, initials: "EA", tone: "bg-felt-600" },
            ].map((player) => (
              <div
                key={player.name}
                className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 transition-colors duration-300 ${
                  player.active
                    ? "border-brass-500/50 bg-brass-500/[0.07]"
                    : "border-ink-900/10 dark:border-ink-100/10"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-md ${player.tone} text-[11px] font-bold text-paper-50`}>
                    {player.initials}
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold leading-tight text-ink-900 dark:text-ink-100">{player.name}</p>
                    <p className="font-mono text-[11px] text-ink-400">{player.rating} Elo</p>
                  </div>
                </div>
                <div
                  className={`rounded-md px-3 py-1.5 font-mono text-lg font-bold tabular-nums ${
                    player.active
                      ? "bg-brass-500 text-ink-950"
                      : "bg-ink-900 text-paper-100 dark:bg-ink-950"
                  }`}
                >
                  {formatClock(player.clock)}
                </div>
              </div>
            ))}
          </div>

          {/* move strip */}
          <div className="no-scrollbar mt-3.5 flex gap-1.5 overflow-x-auto">
            {LIVE_MOVES.map((mv, i) => (
              <span
                key={mv}
                className={`shrink-0 rounded-md border px-2.5 py-1 font-mono text-[12px] font-medium transition-colors ${
                  i === LIVE_MOVES.length - 1
                    ? "border-brass-500/50 bg-brass-500/10 text-brass-700 dark:text-brass-300"
                    : "border-ink-900/10 text-ink-500 dark:border-ink-100/10 dark:text-ink-300"
                }`}
              >
                {mv}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Chip tone="felt">Rated</Chip>
            <Chip>Anti-cheat</Chip>
          </div>
          <button
            onClick={() => push("The arena gates open with update 1.0 — your seat is reserved.")}
            className="group/link inline-flex cursor-pointer items-center gap-1.5 text-[15px] font-bold text-brass-700 transition-colors hover:text-brass-600 dark:text-brass-300 dark:hover:text-brass-200"
          >
            Enter the arena
            <ArrowUpRightIcon className="h-4 w-4 transition-transform duration-300 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Computer chess card (difficulty slider) ---------------- */

const LEVEL_QUIPS = [
  "A gentle sparring partner. It apologizes after capturing.",
  "Knows the rules. Mostly.",
  "Tactical, but forgiving.",
  "A solid club fighter.",
  "Punishes every loose piece.",
  "Calculates three moves deeper than you.",
  "Tournament sharp.",
  "National-strength. Bring notes.",
  "It will not be kind.",
  "Good luck. Seriously.",
];

function ComputerChessCard() {
  const { push } = useToast();
  const [level, setLevel] = useState(4);

  return (
    <div id="computer" className={`${cardBase} scroll-mt-28 lg:col-span-5`}>
      <CardHeader
        icon={<CpuIcon className="h-5.5 w-5.5" />}
        kicker="02 · Computer Chess"
        title="Ten engines, one dare"
        copy="From a polite beginner bot to a nightmare-strength engine that never blunders. Dial in your level."
      />

      <div className="mt-6 flex flex-1 flex-col justify-end">
        <div className="rounded-xl border border-ink-900/10 bg-paper-100/70 p-4 dark:border-ink-100/10 dark:bg-ink-900/60">
          <div className="flex items-end justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">Engine level</p>
              <p className="mt-1 font-display text-3xl font-bold leading-none text-ink-950 dark:text-ink-100">
                {ENGINE_LEVELS[level]}
              </p>
            </div>
            <div className="text-right font-mono text-[11px] leading-relaxed text-ink-400">
              <p>depth {level + 2}</p>
              <p className="text-brass-600 dark:text-brass-400">≈ {800 + level * 220} Elo</p>
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={9}
            step={1}
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
            aria-label="Engine difficulty"
            className="mt-4 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-900/15 accent-brass-500 dark:bg-ink-100/15"
          />
          <div className="mt-2 flex justify-between font-mono text-[9px] uppercase tracking-wider text-ink-400">
            <span>Pawn</span>
            <span className="text-blunder">Nightmare</span>
          </div>
          <p
            className={`mt-3.5 border-l-2 pl-3 text-[13px] italic leading-snug transition-colors duration-300 ${
              level >= 8
                ? "border-blunder text-blunder"
                : "border-brass-500 text-ink-500 dark:text-ink-300"
            }`}
          >
            “{LEVEL_QUIPS[level]}”
          </p>
        </div>

        <button
          onClick={() => push(`The ${ENGINE_LEVELS[level]} engine accepts your challenge — duels begin with update 1.0.`)}
          className="mt-4 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-ink-900 text-[15px] font-bold text-paper-50 transition-all duration-300 hover:-translate-y-[2px] hover:bg-ink-700 dark:bg-ink-100 dark:text-ink-950 dark:hover:bg-paper-200"
        >
          Accept challenge
        </button>
      </div>
    </div>
  );
}

/* ---------------- Puzzles card ---------------- */

function PuzzlesCard() {
  const { push } = useToast();
  const [index, setIndex] = useState(0);
  const [hintOn, setHintOn] = useState(false);
  const [solved, setSolved] = useState(false);
  const puzzle = PUZZLES[index];

  const showArrow = hintOn || solved;

  const nextPuzzle = () => {
    setIndex((i) => (i + 1) % PUZZLES.length);
    setHintOn(false);
    setSolved(false);
  };

  return (
    <div id="puzzles" className={`${cardBase} scroll-mt-28 lg:col-span-5`}>
      <CardHeader
        icon={<BoltIcon className="h-5.5 w-5.5" />}
        kicker="03 · Puzzles"
        title="Mate in one. Then harder."
        copy="120,000 curated positions that adapt to your rating. Streaks, sprint modes and theme drills."
      />

      <div className="mt-5 flex flex-1 items-end gap-5">
        <div className="w-[46%] max-w-[220px] shrink-0">
          <div
            className={`overflow-hidden rounded-lg border-2 transition-colors duration-500 ${
              solved ? "border-felt-500" : "border-ink-900/15 dark:border-ink-100/15"
            }`}
          >
            <ChessBoard
              pieces={puzzle.pieces}
              arrow={showArrow ? { from: { col: puzzle.solution.from[0], row: puzzle.solution.from[1] }, to: { col: puzzle.solution.to[0], row: puzzle.solution.to[1] } } : null}
              highlights={showArrow ? [{ col: puzzle.solution.to[0], row: puzzle.solution.to[1] }] : []}
            />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <Chip tone="brass">Mate in 1</Chip>
            <Chip tone="felt">
              <FlameIcon className="h-3 w-3" /> 12 streak
            </Chip>
          </div>
          <p className="mt-3 text-[13px] font-medium text-ink-400 dark:text-ink-400">
            {puzzle.title} — White to move
          </p>

          {solved ? (
            <div className="mt-3">
              <p className="flex items-center gap-2 rounded-lg border border-felt-500/40 bg-felt-500/10 px-3 py-2 font-mono text-[13px] font-bold text-felt-600 dark:text-felt-300">
                <CheckIcon className="h-4 w-4" />
                {puzzle.solution.san} · +{puzzle.ratingDelta} rating
              </p>
              <button
                onClick={nextPuzzle}
                className="mt-3 inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-brass-500 text-sm font-bold text-ink-950 transition-all duration-300 hover:-translate-y-[2px] hover:bg-brass-400"
              >
                Next puzzle
                <ArrowUpRightIcon className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setHintOn((h) => !h)}
                className="h-10 flex-1 cursor-pointer rounded-lg border border-ink-900/15 text-sm font-semibold text-ink-700 transition-all duration-300 hover:border-brass-600 hover:text-brass-700 dark:border-ink-100/15 dark:text-ink-200 dark:hover:border-brass-400 dark:hover:text-brass-300"
              >
                {hintOn ? "Hide hint" : "Hint"}
              </button>
              <button
                onClick={() => {
                  setSolved(true);
                  push(`Brilliant — ${puzzle.solution.san}! +${puzzle.ratingDelta} puzzle rating.`, "success");
                }}
                className="h-10 flex-1 cursor-pointer rounded-lg bg-felt-600 text-sm font-bold text-paper-50 transition-all duration-300 hover:-translate-y-[2px] hover:bg-felt-500"
              >
                Solve
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Analysis card (wide) ---------------- */

const ACCURACY_SERIES = [97, 95, 91, 93, 88, 90, 84, 87, 92, 96, 94, 89, 91, 95, 98, 93, 90, 86, 88, 94, 97, 99, 96, 94];

const QUALITY = [
  { label: "Best", count: 14, tone: "bg-felt-500" },
  { label: "Good", count: 6, tone: "bg-felt-300" },
  { label: "Inaccuracy", count: 3, tone: "bg-brass-500" },
  { label: "Mistake", count: 1, tone: "bg-blunder" },
];

function AnalysisCard() {
  const { push } = useToast();
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.3 });
  const reduced = usePrefersReducedMotion();

  const max = 100;
  const points = ACCURACY_SERIES.map((v, i) => {
    const x = (i / (ACCURACY_SERIES.length - 1)) * 100;
    const y = 38 - ((v - 70) / 30) * 34;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <div id="analysis" ref={ref} className={`${cardBase} scroll-mt-28 lg:col-span-12`}>
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-4">
          <CardHeader
            icon={<ScopeIcon className="h-5.5 w-5.5" />}
            kicker="04 · Analysis"
            title="Every game, dissected"
            copy="The moment you resign, your report is ready — evaluation graph, accuracy per phase, and the exact move where the tide turned."
          />
          <div className="mt-6 flex flex-wrap gap-2">
            <Chip tone="brass">94.2% accuracy</Chip>
            <Chip>18 avg CPL</Chip>
            <Chip tone="felt">Opening +0.4</Chip>
          </div>
        </div>

        <div className="lg:col-span-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">Final evaluation</p>
          <p className="mt-2 font-display text-5xl font-bold tracking-tight text-ink-950 dark:text-ink-100">
            +0.84
          </p>
          <div className="mt-4 h-3 overflow-hidden rounded-full border border-ink-900/15 bg-ink-900 dark:border-ink-100/15">
            <div
              className="h-full rounded-full bg-paper-50 transition-all duration-[1400ms] ease-out"
              style={{ width: inView || reduced ? "62%" : "50%" }}
            />
          </div>
          <p className="mt-2 font-mono text-[11px] text-ink-400">White holds a lasting edge — convert it.</p>

          <div className="mt-5 space-y-2">
            {QUALITY.map((q) => (
              <div key={q.label} className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-sm ${q.tone}`} />
                <span className="w-20 text-[13px] font-medium text-ink-600 dark:text-ink-300">{q.label}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-900/10 dark:bg-ink-100/10">
                  <div
                    className={`h-full rounded-full ${q.tone} transition-all duration-[1200ms] ease-out`}
                    style={{ width: inView || reduced ? `${(q.count / 24) * 100}%` : "0%" }}
                  />
                </div>
                <span className="w-6 text-right font-mono text-[12px] font-bold text-ink-700 dark:text-ink-200">{q.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col lg:col-span-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">Accuracy by move</p>
          <div className="mt-2 flex-1 rounded-xl border border-ink-900/10 bg-paper-100/70 p-4 dark:border-ink-100/10 dark:bg-ink-900/60">
            <svg viewBox="0 0 100 40" className="h-full min-h-[120px] w-full" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="cm-spark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-brass-500)" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="var(--color-brass-500)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[10, 20, 30].map((y) => (
                <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="currentColor" strokeOpacity="0.08" strokeWidth="0.4" />
              ))}
              <polygon points={`0,40 ${points} 100,40`} fill="url(#cm-spark)" />
              <polyline
                points={points}
                fill="none"
                stroke="var(--color-brass-500)"
                strokeWidth="1.1"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="240"
                strokeDashoffset={inView || reduced ? 0 : 240}
                style={{ transition: "stroke-dashoffset 1.8s ease-out 0.2s" }}
              />
            </svg>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
            <button
              onClick={() => push("Drop a PGN and watch the report build itself — analysis ships with 1.0.")}
              className="h-11 flex-1 cursor-pointer rounded-lg bg-brass-500 text-[15px] font-bold text-ink-950 transition-all duration-300 hover:-translate-y-[2px] hover:bg-brass-400"
            >
              Analyze a game
            </button>
            <button
              onClick={() => push("PGN import is wired up and waiting for the 1.0 release.")}
              className="h-11 flex-1 cursor-pointer rounded-lg border border-ink-900/15 text-[15px] font-semibold text-ink-700 transition-all duration-300 hover:-translate-y-[2px] hover:border-brass-600 hover:text-brass-700 dark:border-ink-100/15 dark:text-ink-200 dark:hover:border-brass-400 dark:hover:text-brass-300"
            >
              Paste PGN
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Section ---------------- */

export function Features() {
  return (
    <section className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow="The Arsenal"
            title={
              <>
                Everything you need to master
                <br className="hidden sm:block" /> the sixty-four squares.
              </>
            }
            description="Four rooms, one club. Play humans, fight engines, drill tactics and read your own games like a coach."
          />
          <p className="hidden max-w-[180px] border-l-2 border-brass-500 pl-4 font-mono text-[11px] leading-relaxed text-ink-400 lg:block">
            BUILT FOR RATED PLAY — EVERY MODULE SHARES ONE RATING
          </p>
        </div>
      </Reveal>

      <div className="mt-12 grid gap-5 lg:grid-cols-12">
        <Reveal className="lg:col-span-7 lg:row-span-2" delay={60}>
          <OnlineChessCard />
        </Reveal>
        <Reveal className="lg:col-span-5" delay={140}>
          <ComputerChessCard />
        </Reveal>
        <Reveal className="lg:col-span-5" delay={220}>
          <PuzzlesCard />
        </Reveal>
        <Reveal className="lg:col-span-12" delay={120}>
          <AnalysisCard />
        </Reveal>
      </div>
    </section>
  );
}
