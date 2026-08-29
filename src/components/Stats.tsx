import { useCountUp, useInView } from "../hooks";
import { Reveal } from "./ui";

interface StatDef {
  target: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  label: string;
  sub: string;
}

const STATS: StatDef[] = [
  { target: 2.4, decimals: 1, suffix: "M", label: "Players worldwide", sub: "from 190 countries" },
  { target: 38, suffix: "M", label: "Games analyzed", sub: "every single month" },
  { target: 120, suffix: "K", label: "Curated puzzles", sub: "rated 600 – 3200" },
  { target: 187, prefix: "+", label: "Avg. Elo gained", sub: "after 90 training days" },
];

function StatValue({ stat, active }: { stat: StatDef; active: boolean }) {
  const value = useCountUp(stat.target, active, { decimals: stat.decimals ?? 0 });
  return (
    <span className="font-display text-[clamp(2.4rem,4.5vw,3.6rem)] font-bold leading-none tracking-tight text-ink-950 tabular-nums dark:text-ink-100">
      {stat.prefix}
      {value}
      {stat.suffix && <span className="text-brass-600 dark:text-brass-400">{stat.suffix}</span>}
    </span>
  );
}

export function Stats() {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.35 });

  return (
    <section className="relative border-y border-ink-900/10 bg-paper-50/60 dark:border-ink-100/10 dark:bg-ink-900/50">
      <div ref={ref} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat, i) => (
            <Reveal key={stat.label} delay={i * 90} className={`py-10 lg:py-14 ${i > 0 ? "lg:border-l lg:border-ink-900/10 lg:pl-10 dark:lg:border-ink-100/10" : ""} ${i % 2 === 1 ? "border-l border-ink-900/10 pl-6 sm:pl-10 lg:border-0 lg:pl-10 dark:border-ink-100/10" : ""}`}>
              <StatValue stat={stat} active={inView} />
              <p className="mt-3 text-[15px] font-semibold text-ink-700 dark:text-ink-200">{stat.label}</p>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-400">{stat.sub}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
