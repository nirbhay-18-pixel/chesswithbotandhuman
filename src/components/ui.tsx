import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { useInView } from "../hooks";
import { CheckIcon, KnightMark } from "./icons";

/* ---------------- Reveal (scroll animation) ---------------- */

interface RevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function Reveal({ children, delay = 0, className = "" }: RevealProps) {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.15 });
  return (
    <div
      ref={ref}
      data-reveal=""
      className={`${className} ${inView ? "revealed" : ""}`}
      style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

/* ---------------- Button ---------------- */

type ButtonVariant = "primary" | "outline" | "soft" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brass-500 text-ink-950 hover:bg-brass-400 shadow-[0_10px_26px_-12px_rgb(207_159_61/0.65)] border border-brass-400/60",
  outline:
    "border border-ink-900/25 text-ink-900 hover:border-brass-600 hover:text-brass-700 dark:border-ink-100/25 dark:text-ink-100 dark:hover:border-brass-400 dark:hover:text-brass-300",
  soft: "bg-ink-900/[0.06] text-ink-900 hover:bg-ink-900/[0.11] dark:bg-ink-100/[0.08] dark:text-ink-100 dark:hover:bg-ink-100/[0.14]",
  ghost: "text-brass-700 hover:text-brass-600 dark:text-brass-300 dark:hover:text-brass-200 px-0",
};

const SIZES = {
  sm: "h-9 px-4 text-sm gap-1.5",
  md: "h-11 px-5 text-[15px] gap-2",
  lg: "h-[52px] px-7 text-base gap-2.5",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={`group/btn inline-flex items-center justify-center font-semibold tracking-tight rounded-md transition-all duration-300 active:translate-y-[1px] hover:-translate-y-[2px] disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {children}
    </button>
  );
}

/* ---------------- SectionHeading ---------------- */

interface SectionHeadingProps {
  eyebrow: string;
  title: ReactNode;
  description?: string;
  className?: string;
}

export function SectionHeading({ eyebrow, title, description, className = "" }: SectionHeadingProps) {
  return (
    <div className={`max-w-2xl ${className}`}>
      <p className="flex items-center gap-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.24em] text-brass-700 dark:text-brass-300">
        <span className="inline-block h-2 w-2 rotate-45 bg-brass-500" aria-hidden="true" />
        {eyebrow}
      </p>
      <h2 className="mt-4 font-display text-[clamp(1.9rem,4vw,3.1rem)] font-bold leading-[1.04] tracking-tight text-ink-900 dark:text-ink-100">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-[17px] leading-relaxed text-ink-500 dark:text-ink-300">{description}</p>
      ) : null}
    </div>
  );
}

/* ---------------- Chip ---------------- */

export function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "brass" | "felt" | "blunder" }) {
  const tones = {
    neutral:
      "border-ink-900/15 text-ink-600 dark:border-ink-100/15 dark:text-ink-300",
    brass:
      "border-brass-500/40 text-brass-700 bg-brass-500/10 dark:text-brass-300",
    felt: "border-felt-500/40 text-felt-600 bg-felt-500/10 dark:text-felt-300",
    blunder: "border-blunder/40 text-blunder bg-blunder/10",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] font-medium tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

/* ---------------- Toast ---------------- */

interface ToastItem {
  id: number;
  message: string;
  tone: "default" | "success";
}

interface ToastContextValue {
  push: (message: string, tone?: "default" | "success") => void;
}

const ToastContext = createContext<ToastContextValue>({ push: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const push = useCallback((message: string, tone: "default" | "success" = "default") => {
    const id = ++counter.current;
    setToasts((prev) => [...prev.slice(-3), { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[90] flex w-[min(92vw,380px)] flex-col gap-2.5">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="animate-rise pointer-events-auto flex items-start gap-3 rounded-lg border border-ink-900/12 bg-paper-50 px-4 py-3.5 shadow-lift dark:border-ink-100/12 dark:bg-ink-800"
          >
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                toast.tone === "success" ? "bg-felt-500 text-paper-50" : "bg-brass-500 text-ink-950"
              }`}
            >
              {toast.tone === "success" ? <CheckIcon className="h-3.5 w-3.5" /> : <KnightMark className="h-4 w-4" />}
            </span>
            <p className="text-sm font-medium leading-snug text-ink-800 dark:text-ink-100">{toast.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
