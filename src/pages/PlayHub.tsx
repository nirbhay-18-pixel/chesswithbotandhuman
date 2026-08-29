import { useNavigate } from "react-router-dom";
import { getSessionUser } from "../account";
import { CpuIcon, GlobeIcon, RobotIcon, UsersIcon, ArrowRightIcon } from "../components/icons";
import { Chip } from "../components/ui";

const MODES = [
  {
    to: "/play/bot",
    number: "01",
    tag: "BOT",
    title: "Play vs Bot",
    sub: "Play against Stockfish",
    desc: "Ten strength levels from a polite beginner to a ~2200 nightmare. Pick a rating, pick a colour, and the engine does the rest.",
    icon: CpuIcon,
    accent: "text-brass-600 dark:text-brass-300",
    ring: "hover:border-brass-500/60",
    chips: ["Stockfish engine", "400 – 2200", "Rated"],
    face: <RobotIcon className="h-4 w-4" />,
  },
  {
    to: "/play/friend",
    number: "02",
    tag: "FRIEND",
    title: "Play with Friend",
    sub: "Two players on the same device",
    desc: "Pass-and-play hotseat. Enter both names, share one screen, and settle it over the board — every rule enforced.",
    icon: UsersIcon,
    accent: "text-felt-600 dark:text-felt-300",
    ring: "hover:border-felt-500/60",
    chips: ["One device", "Named players", "Saved to history"],
    face: <UsersIcon className="h-4 w-4" />,
  },
  {
    to: "/play/online",
    number: "03",
    tag: "ONLINE",
    title: "Play Online",
    sub: "Play against another ChessMaster player",
    desc: "Create a room, share the code, and your moves sync in real time over WebRTC. No account servers — pure peer-to-peer.",
    icon: GlobeIcon,
    accent: "text-ink-700 dark:text-ink-200",
    ring: "hover:border-ink-500/60 dark:hover:border-ink-300/60",
    chips: ["Real-time", "Room codes", "P2P WebRTC"],
    face: <GlobeIcon className="h-4 w-4" />,
  },
];

export function PlayHub() {
  const navigate = useNavigate();
  const user = getSessionUser();

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-28 sm:px-6 lg:px-8 lg:pt-36">
      <header className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <p className="animate-rise flex items-center gap-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.24em] text-brass-700 dark:text-brass-300">
            <span className="inline-block h-2 w-2 rotate-45 bg-brass-500" aria-hidden="true" />
            ChessMaster · Play
          </p>
          <h1
            className="animate-rise mt-4 font-display text-[clamp(2.4rem,5.6vw,4.4rem)] font-bold leading-[1.01] tracking-tight text-ink-950 dark:text-ink-100"
            style={{ animationDelay: "80ms" }}
          >
            Choose how you <span className="text-outline">want to play.</span>
          </h1>
          <p
            className="animate-rise mt-5 max-w-2xl text-lg leading-relaxed text-ink-500 dark:text-ink-300"
            style={{ animationDelay: "160ms" }}
          >
            Three doors, one board. Fight an engine, share a screen with a friend, or send a code to
            someone across the world{user ? (
              <>
                {" "}— playing as <strong className="font-semibold text-ink-800 dark:text-ink-100">{user.username}</strong> (
                {user.rating}).
              </>
            ) : (
              "."
            )}
          </p>
        </div>

        <div className="animate-rise flex flex-col items-start gap-3 lg:items-end" style={{ animationDelay: "220ms" }}>
          <div className="flex flex-wrap gap-2">
            <Chip tone="brass">Full FIDE rules</Chip>
            <Chip tone="felt">chess.js engine</Chip>
          </div>
          <p className="max-w-[300px] text-right font-mono text-[10px] uppercase leading-relaxed tracking-[0.16em] text-ink-400">
            Every mode is live — no mock screens
          </p>
        </div>
      </header>

      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {MODES.map((m, i) => {
          const Icon = m.icon;
          return (
            <button
              key={m.to}
              onClick={() => navigate(m.to)}
              className={`group animate-rise relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-ink-900/10 bg-paper-50/85 p-6 text-left shadow-card backdrop-blur-sm transition-all duration-400 hover:-translate-y-1.5 hover:shadow-lift dark:border-ink-100/10 dark:bg-ink-800/75 ${m.ring}`}
              style={{ animationDelay: `${280 + i * 90}ms` }}
            >
              <div className="flex items-start justify-between">
                <span className={`flex h-12 w-12 items-center justify-center rounded-lg bg-ink-900/[0.06] transition-transform duration-400 group-hover:-rotate-6 group-hover:scale-110 dark:bg-ink-100/[0.08] ${m.accent}`}>
                  <Icon className="h-6 w-6" />
                </span>
                <span className="font-display text-4xl font-bold text-ink-900/10 dark:text-ink-100/10">{m.number}</span>
              </div>

              <p className={`mt-5 font-mono text-[10px] font-semibold uppercase tracking-[0.24em] ${m.accent}`}>
                {m.tag}
              </p>
              <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-ink-950 dark:text-ink-100">
                {m.title}
              </h2>
              <p className="mt-0.5 text-[14px] font-medium text-ink-500 dark:text-ink-300">{m.sub}</p>
              <p className="mt-3 flex-1 text-[14px] leading-relaxed text-ink-500 dark:text-ink-300">{m.desc}</p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {m.chips.map((c) => (
                  <span
                    key={c}
                    className="rounded-full border border-ink-900/12 px-2.5 py-0.5 font-mono text-[10px] font-medium text-ink-500 dark:border-ink-100/15 dark:text-ink-300"
                  >
                    {c}
                  </span>
                ))}
              </div>

              <span className="mt-5 inline-flex items-center gap-2 text-[15px] font-bold text-ink-900 transition-colors group-hover:text-brass-700 dark:text-ink-100 dark:group-hover:text-brass-300">
                Enter
                <ArrowRightIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
