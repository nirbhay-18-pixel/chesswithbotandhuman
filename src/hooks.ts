import { useCallback, useEffect, useRef, useState } from "react";

/* ---------------- fullscreen ---------------- */

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
}

interface FullscreenHTMLElement extends HTMLElement {
  webkitRequestFullscreen?: () => void;
}

/**
 * Real browser Fullscreen API, applied to the document element so the whole
 * app shell (toasts, navbar, theme) stays rendered and NO component state is
 * lost — entering/exiting never resets the game, the engine or connections.
 * The `fullscreenchange` event keeps `isFullscreen` authoritative at all
 * times, including exits via the Escape key or browser UI.
 */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(
    () => typeof document !== "undefined" && !!(document as FullscreenDocument).fullscreenElement,
  );

  useEffect(() => {
    const sync = () =>
      setIsFullscreen(
        !!((document as FullscreenDocument).fullscreenElement ??
          (document as FullscreenDocument).webkitFullscreenElement),
      );
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  const supported =
    typeof document !== "undefined" &&
    (!!document.fullscreenEnabled ||
      typeof (document.documentElement as FullscreenHTMLElement).webkitRequestFullscreen === "function");

  const toggle = useCallback(async (): Promise<boolean> => {
    const doc = document as FullscreenDocument;
    const root = document.documentElement as FullscreenHTMLElement;
    try {
      if (doc.fullscreenElement || doc.webkitFullscreenElement) {
        if (doc.fullscreenElement) await doc.exitFullscreen();
        else await doc.webkitExitFullscreen?.();
        return true;
      }
      if (typeof root.requestFullscreen === "function") {
        await root.requestFullscreen({ navigationUI: "hide" });
        return true;
      }
      if (typeof root.webkitRequestFullscreen === "function") {
        root.webkitRequestFullscreen();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  return { isFullscreen, toggle, supported };
}

/* ---------------- reduced motion ---------------- */

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/* ---------------- theme ---------------- */

export type Theme = "dark" | "light";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.setAttribute("data-theme", theme);
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark";
    const stored = window.localStorage.getItem("cm-theme");
    if (stored === "light" || stored === "dark") return stored;
    return document.documentElement.classList.contains("light") ? "light" : "dark";
  });

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem("cm-theme", theme);
    } catch {
      /* private mode — ignore */
    }
  }, [theme]);

  useEffect(() => {
    // stay in sync if the embedding environment pushes a theme
    const onMessage = (event: MessageEvent) => {
      const t = event.data?.theme;
      if (t === "light" || t === "dark") setTheme(t);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return [theme, toggle];
}

/* ---------------- in-view observer ---------------- */

export function useInView<T extends HTMLElement>(
  options: IntersectionObserverInit = { threshold: 0.25 },
): [React.MutableRefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      });
    }, options);
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return [ref, inView];
}

/* ---------------- animated counter ---------------- */

export function useCountUp(
  target: number,
  active: boolean,
  opts: { duration?: number; decimals?: number } = {},
): string {
  const { duration = 1400, decimals = 0 } = opts;
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (!active || started.current) return;
    started.current = true;
    if (reduced) {
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration, reduced]);

  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/* ---------------- scroll position ---------------- */

export function useScrolled(threshold = 14): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}
