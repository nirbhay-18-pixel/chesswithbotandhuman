import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useScrolled, useTheme } from "../hooks";
import { goToSection } from "../nav";
import { ArrowRightIcon, CloseIcon, KnightMark, MenuIcon, MoonIcon, SunIcon } from "./icons";

type NavItem = { label: string } & ({ route: string } | { section: string });

const NAV_ITEMS: NavItem[] = [
  { label: "Home", route: "/" },
  { label: "Play", route: "/play" },
  { label: "Puzzles", section: "puzzles" },
  { label: "Learn", section: "learn" },
  { label: "Analysis", section: "analysis" },
  { label: "Profile", section: "join" },
];

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="group flex items-center gap-2.5" aria-label="ChessMaster home">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brass-500 text-ink-950 shadow-[inset_0_1px_0_rgb(255_255_255/0.35)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">
        <KnightMark className="h-[22px] w-[22px]" />
      </span>
      {!compact && (
        <span className="font-display text-[19px] font-bold tracking-tight text-ink-900 dark:text-ink-100">
          Chess<span className="text-brass-600 dark:text-brass-400">Master</span>
        </span>
      )}
    </Link>
  );
}

export function Navbar() {
  const [theme, toggleTheme] = useTheme();
  const scrolled = useScrolled(16);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleItem = (item: NavItem) => {
    setOpen(false);
    if ("route" in item) {
      if (pathname === item.route) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        navigate(item.route);
      }
    } else {
      goToSection(navigate, pathname, item.section);
    }
  };

  const isActive = (item: NavItem) => "route" in item && pathname === item.route;

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={`mx-auto max-w-7xl px-4 transition-all duration-500 sm:px-6 lg:px-8 ${
          scrolled || open ? "py-2.5" : "py-4"
        }`}
      >
        <nav
          className={`flex items-center justify-between rounded-xl border px-4 py-2.5 transition-all duration-500 sm:px-5 ${
            scrolled || open
              ? "border-ink-900/10 bg-paper-50/90 shadow-lift backdrop-blur-md dark:border-ink-100/10 dark:bg-ink-900/85"
              : "border-transparent bg-transparent"
          }`}
          aria-label="Primary"
        >
          <Logo />

          <ul className="hidden items-center gap-1 lg:flex">
            {NAV_ITEMS.map((item) => (
              <li key={item.label}>
                <button
                  onClick={() => handleItem(item)}
                  className={`group relative cursor-pointer rounded-md px-3.5 py-2 text-[15px] font-medium transition-colors duration-200 ${
                    isActive(item)
                      ? "text-brass-700 dark:text-brass-300"
                      : "text-ink-600 hover:text-ink-950 dark:text-ink-300 dark:hover:text-ink-100"
                  }`}
                >
                  {item.label}
                  <span
                    className={`absolute inset-x-3.5 bottom-1 h-[2px] origin-left rounded-full bg-brass-500 transition-transform duration-300 ${
                      isActive(item) ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                    }`}
                  />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2.5">
            <button
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              className="relative flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-ink-900/12 text-ink-600 transition-all duration-300 hover:border-brass-500/60 hover:text-brass-600 dark:border-ink-100/15 dark:text-ink-300 dark:hover:text-brass-300"
            >
              <SunIcon
                className={`absolute h-5 w-5 transition-all duration-500 ${
                  theme === "dark" ? "rotate-0 opacity-100" : "rotate-90 opacity-0"
                }`}
              />
              <MoonIcon
                className={`absolute h-5 w-5 transition-all duration-500 ${
                  theme === "light" ? "rotate-0 opacity-100" : "-rotate-90 opacity-0"
                }`}
              />
            </button>

            <button
              onClick={() => navigate("/play")}
              className="group hidden h-10 cursor-pointer items-center gap-2 rounded-lg bg-brass-500 px-4.5 text-[15px] font-semibold text-ink-950 shadow-[0_8px_20px_-10px_rgb(207_159_61/0.7)] transition-all duration-300 hover:-translate-y-[2px] hover:bg-brass-400 sm:inline-flex"
            >
              Play now
              <ArrowRightIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </button>

            <button
              onClick={() => setOpen((o) => !o)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-ink-900/12 text-ink-700 transition-colors hover:border-brass-500/60 dark:border-ink-100/15 dark:text-ink-200 lg:hidden"
            >
              {open ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        {/* mobile menu */}
        <div
          className={`overflow-hidden transition-all duration-400 lg:hidden ${
            open ? "mt-2 max-h-[420px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <ul className="rounded-xl border border-ink-900/10 bg-paper-50/95 p-3 shadow-lift backdrop-blur-md dark:border-ink-100/10 dark:bg-ink-900/95">
            {NAV_ITEMS.map((item, i) => (
              <li key={item.label}>
                <button
                  onClick={() => handleItem(item)}
                  className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-4 py-3 text-[15px] font-medium transition-colors hover:bg-brass-500/10 hover:text-brass-700 dark:hover:text-brass-300 ${
                    isActive(item)
                      ? "text-brass-700 dark:text-brass-300"
                      : "text-ink-700 dark:text-ink-200"
                  }`}
                  style={{ transitionDelay: `${i * 20}ms` }}
                >
                  {item.label}
                  <ArrowRightIcon className="h-4 w-4 opacity-40" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </header>
  );
}
