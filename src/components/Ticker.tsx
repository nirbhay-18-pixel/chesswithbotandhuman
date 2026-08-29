import { DiamondIcon } from "./icons";

const ITEMS = [
  ["Italian Game", "1–0"],
  ["Sicilian Najdorf", "½–½"],
  ["Queen's Gambit", "0–1"],
  ["Caro-Kann Advance", "1–0"],
  ["King's Indian", "1–0"],
  ["Ruy López Berlin", "½–½"],
  ["English Opening", "0–1"],
  ["French Winawer", "1–0"],
  ["Nimzo-Indian", "½–½"],
  ["Scandinavian", "0–1"],
  ["Catalan", "1–0"],
  ["Grünfeld Exchange", "½–½"],
] as const;

function Row() {
  return (
    <div className="flex shrink-0 items-center">
      {ITEMS.map(([opening, result]) => (
        <span key={opening} className="flex items-center">
          <span className="px-5 font-mono text-[12px] font-medium uppercase tracking-[0.18em] text-ink-500 dark:text-ink-300">
            {opening}
          </span>
          <span
            className={`font-mono text-[12px] font-bold tracking-widest ${
              result === "1–0"
                ? "text-felt-500 dark:text-felt-300"
                : result === "0–1"
                  ? "text-blunder"
                  : "text-brass-600 dark:text-brass-400"
            }`}
          >
            {result}
          </span>
          <DiamondIcon className="mx-5 h-2 w-2 text-brass-500/70" />
        </span>
      ))}
    </div>
  );
}

export function Ticker() {
  return (
    <section aria-label="Recent results across the openings" className="relative border-y border-ink-900/10 bg-paper-50/60 py-4 dark:border-ink-100/10 dark:bg-ink-900/50">
      <div
        className="flex overflow-hidden"
        style={{
          maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
          WebkitMaskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        }}
      >
        <div className="animate-marquee flex">
          <Row />
          <div aria-hidden="true" className="flex shrink-0 items-center">
            <Row />
          </div>
        </div>
      </div>
    </section>
  );
}
