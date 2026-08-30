import { ArrowRightIcon } from "./icons";
import { Chip, Reveal, SectionHeading, useToast } from "./ui";

const MODULES = [
  {
    number: "01",
    title: "Openings",
    copy: "Build a repertoire that survives past move 15 — structured courses with plans, not just move orders.",
    stat: "250+ lines",
    tags: ["Italian Game", "Caro-Kann", "Najdorf", "Queen's Gambit"],
  },
  {
    number: "02",
    title: "Tactics",
    copy: "Pattern recognition until forks and pins feel like reflexes. Spaced repetition keeps them sharp.",
    stat: "12 themes",
    tags: ["Pins", "Forks", "Skewers", "Deflection", "Zwischenzug"],
  },
  {
    number: "03",
    title: "Endgames",
    copy: "Convert the win you already earned — from basic opposition to six-piece tablebase precision.",
    stat: "6-man tablebases",
    tags: ["Lucena", "Philidor", "Opposition", "Pawn races"],
  },
];

export function Learn() {
  const { push } = useToast();

  return (
    <section id="learn" className="relative scroll-mt-28">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <Reveal>
          <SectionHeading
            eyebrow="The Training Ground"
            title={
              <>
                Train like the board
                <br className="hidden sm:block" /> owes you something.
              </>
            }
            description="A guided path from first opening to last endgame. Every lesson ends on a live board — never a slideshow."
          />
        </Reveal>

        <div className="mt-14 border-t border-ink-900/10 dark:border-ink-100/10">
          {MODULES.map((module, i) => (
            <Reveal key={module.number} delay={i * 110}>
              <button
                onClick={() => push(`The ${module.title.toLowerCase()} dojo opens with update 1.0 — your seat is saved.`)}
                className="group/row grid w-full cursor-pointer grid-cols-[auto_1fr] items-center gap-x-6 gap-y-4 border-b border-ink-900/10 px-2 py-8 text-left transition-all duration-400 hover:bg-brass-500/[0.06] sm:grid-cols-[110px_1fr_auto] sm:px-4 lg:py-10 dark:border-ink-100/10"
              >
                <span className="font-display text-5xl font-bold tracking-tight text-ink-900/15 transition-all duration-400 group-hover/row:-translate-y-1 group-hover/row:text-brass-500 lg:text-7xl dark:text-ink-100/15">
                  {module.number}
                </span>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <h3 className="font-display text-2xl font-bold tracking-tight text-ink-950 transition-transform duration-400 group-hover/row:translate-x-1.5 lg:text-3xl dark:text-ink-100">
                      {module.title}
                    </h3>
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-brass-600 dark:text-brass-400">
                      {module.stat}
                    </span>
                  </div>
                  <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-500 dark:text-ink-300">{module.copy}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {module.tags.map((tag) => (
                      <Chip key={tag}>{tag}</Chip>
                    ))}
                  </div>
                </div>

                <span className="col-start-2 flex h-12 w-12 items-center justify-center rounded-full border border-ink-900/15 text-ink-500 transition-all duration-400 group-hover/row:rotate-[-45deg] group-hover/row:border-brass-500 group-hover/row:bg-brass-500 group-hover/row:text-ink-950 sm:col-start-3 dark:border-ink-100/20 dark:text-ink-300">
                  <ArrowRightIcon className="h-5 w-5" />
                </span>
              </button>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
