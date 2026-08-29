import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { goToSection } from "../nav";
import { ArrowRightIcon, CheckIcon, DiscordIcon, KnightMark, TwitchIcon, XSocialIcon, YoutubeIcon } from "./icons";
import { Logo } from "./Navbar";
import { Reveal, useToast } from "./ui";

/* ---------------- CTA ---------------- */

export function JoinCta() {
  const { push } = useToast();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
    if (!valid) {
      setError("That address doesn't look right — try again?");
      return;
    }
    setError(null);
    setDone(true);
    push("Welcome to ChessMaster — your account invite is on its way.", "success");
  };

  return (
    <section id="join" className="scroll-mt-28">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <Reveal>
          <div className="relative overflow-hidden rounded-xl border border-brass-500/30 bg-ink-950 px-6 py-14 shadow-lift sm:px-12 lg:px-16 lg:py-20">
            {/* layered backdrop */}
            <div
              className="absolute inset-0 opacity-[0.16]"
              style={{
                background: "repeating-conic-gradient(rgb(230 235 242 / 0.5) 0% 25%, transparent 0% 50%)",
                backgroundSize: "44px 44px",
                maskImage: "radial-gradient(60rem 30rem at 85% 20%, black, transparent 75%)",
                WebkitMaskImage: "radial-gradient(60rem 30rem at 85% 20%, black, transparent 75%)",
              }}
              aria-hidden="true"
            />
            <div className="absolute inset-0 bg-[radial-gradient(42rem_26rem_at_18%_30%,rgb(207_159_61/0.16),transparent_65%)]" aria-hidden="true" />
            <KnightMark className="pointer-events-none absolute -bottom-16 -right-10 h-72 w-72 rotate-12 text-brass-500/10" />

            <div className="relative grid items-center gap-10 lg:grid-cols-2">
              <div>
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.26em] text-brass-300">
                  Season 01 · Founding members get the brass knight badge
                </p>
                <h2 className="mt-5 font-display text-[clamp(2.6rem,6vw,4.6rem)] font-bold leading-[0.98] tracking-tight text-ink-100">
                  Your move<span className="text-brass-400">.</span>
                </h2>
                <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-300">
                  Create a free account and get rated games, unlimited puzzles and a full
                  analysis report after every single game.
                </p>
              </div>

              <div>
                {done ? (
                  <div className="flex items-start gap-4 rounded-xl border border-felt-500/40 bg-felt-500/10 p-6">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-felt-500 text-paper-50">
                      <CheckIcon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-display text-xl font-bold text-ink-100">You're on the list.</p>
                      <p className="mt-1.5 text-[15px] leading-relaxed text-ink-300">
                        We sent an invite to <strong className="text-brass-300">{email}</strong>. The board
                        will be set when you arrive.
                      </p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={submit} noValidate>
                    <label htmlFor="join-email" className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-ink-300">
                      Create your free account
                    </label>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                      <input
                        id="join-email"
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (error) setError(null);
                        }}
                        placeholder="you@grandmaster.com"
                        className={`h-[52px] w-full min-w-0 flex-1 rounded-lg border bg-ink-900/80 px-4 text-[15px] text-ink-100 placeholder:text-ink-500 focus:outline-none focus:ring-2 focus:ring-brass-500/60 ${
                          error ? "border-blunder" : "border-ink-100/15"
                        }`}
                      />
                      <button
                        type="submit"
                        className="group inline-flex h-[52px] shrink-0 cursor-pointer items-center justify-center gap-2.5 rounded-lg bg-brass-500 px-7 text-base font-bold text-ink-950 transition-all duration-300 hover:-translate-y-[2px] hover:bg-brass-400"
                      >
                        Start playing
                        <ArrowRightIcon className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                      </button>
                    </div>
                    {error ? (
                      <p className="mt-2.5 text-sm font-medium text-[#e08a80]">{error}</p>
                    ) : (
                      <p className="mt-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-400">
                        Free forever · No ads · Fair-play guaranteed
                      </p>
                    )}
                  </form>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Footer ---------------- */

type FooterLink = { label: string } & ({ section: string } | { route: string } | { stub?: true });

const FOOTER_COLS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Play",
    links: [
      { label: "Local match", route: "/play" },
      { label: "vs Computer", section: "computer" },
      { label: "Puzzles", section: "puzzles" },
      { label: "Analysis", section: "analysis" },
    ],
  },
  {
    title: "Learn",
    links: [
      { label: "Openings", section: "learn" },
      { label: "Tactics", section: "learn" },
      { label: "Endgames", section: "learn" },
      { label: "Coaches", stub: true },
    ],
  },
  {
    title: "Club",
    links: [
      { label: "Community", stub: true },
      { label: "Streams", stub: true },
      { label: "Tournaments", stub: true },
      { label: "About", stub: true },
    ],
  },
];

export function Footer() {
  const { push } = useToast();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleLink = (link: FooterLink) => {
    if ("route" in link) navigate(link.route);
    else if ("section" in link) goToSection(navigate, pathname, link.section);
    else push(`${link.label} arrives with the 1.0 release.`);
  };

  const socials = [
    { label: "X", icon: XSocialIcon },
    { label: "Discord", icon: DiscordIcon },
    { label: "YouTube", icon: YoutubeIcon },
    { label: "Twitch", icon: TwitchIcon },
  ];

  return (
    <footer className="border-t border-ink-900/10 bg-paper-50/70 dark:border-ink-100/10 dark:bg-ink-900/60">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-ink-500 dark:text-ink-300">
              The chess club that lives in your browser. Play, train and analyze —
              built for people who take the game seriously, but not themselves.
            </p>
            <div className="mt-6 flex gap-2.5">
              {socials.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  aria-label={label}
                  onClick={() => push(`Our ${label} channel opens its doors with the 1.0 launch.`)}
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-ink-900/12 text-ink-500 transition-all duration-300 hover:-translate-y-1 hover:border-brass-500/60 hover:bg-brass-500/10 hover:text-brass-600 dark:border-ink-100/15 dark:text-ink-300 dark:hover:text-brass-300"
                >
                  <Icon className="h-4.5 w-4.5" />
                </button>
              ))}
            </div>
          </div>

          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-ink-400">{col.title}</p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <button
                      onClick={() => handleLink(link)}
                      className="group inline-flex cursor-pointer items-center gap-1.5 text-[15px] font-medium text-ink-600 transition-colors hover:text-brass-700 dark:text-ink-300 dark:hover:text-brass-300"
                    >
                      <span className="h-[2px] w-0 bg-brass-500 transition-all duration-300 group-hover:w-3" />
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-5 border-t border-ink-900/10 pt-7 sm:flex-row dark:border-ink-100/10">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-400">
            © 2026 ChessMaster · Made for the love of the game
          </p>
          <div className="flex items-center gap-3">
            <div className="flex overflow-hidden rounded-sm border border-ink-900/15 dark:border-ink-100/15" aria-hidden="true">
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i} className={`h-2.5 w-2.5 ${i % 2 === 0 ? "bg-paper-200 dark:bg-ink-600" : "bg-felt-600"}`} />
              ))}
            </div>
            <span className="font-mono text-[11px] text-ink-400">1. e4 — always</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
