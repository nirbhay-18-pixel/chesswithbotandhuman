import { Chess } from "chess.js";
import { searchPosition } from "./minimax";

/**
 * Engine orchestration for Coding Boy.
 *
 * Preferred: Stockfish 10 (asm.js build) running in a Web Worker created from
 * a blob URL — cross-origin Worker constructors are blocked by browsers, so we
 * fetch the script and wrap it. If Stockfish cannot be loaded (offline, CSP,
 * slow network) we fall back to ChessMaster Classic, the built-in minimax
 * engine. The computer NEVER plays random moves.
 */

export type EngineKind = "stockfish" | "classic";

export interface EngineResult {
  uci: string;
  /** centipawns from White's point of view */
  evalCp: number;
  depth: number;
  engine: EngineKind;
}

export interface LevelConfig {
  name: string;
  elo: number;
  /** max search depth — secondary strength cap (`go ... depth N`) */
  sfDepth: number;
  /** stockfish Skill Level 0–20 — primary weakness/strength control */
  sfSkill: number;
  /**
   * `go movetime N` — the hard per-move time bound. Stockfish self-terminates
   * at exactly N ms (or the depth cap, whichever comes first), so responses
   * are fast and predictable instead of relying on an external `stop`.
   */
  sfMoveMs: number;
  /** classic engine settings */
  clDepth: number;
  clTimeMs: number;
  clTopK: number;
}

export const LEVELS: LevelConfig[] = [
  { name: "Pawn",        elo: 400,  sfDepth: 2,  sfSkill: 0,  sfMoveMs: 300,  clDepth: 1, clTimeMs: 250,  clTopK: 5 },
  { name: "Squire",      elo: 600,  sfDepth: 3,  sfSkill: 1,  sfMoveMs: 350,  clDepth: 1, clTimeMs: 350,  clTopK: 4 },
  { name: "Knight",      elo: 800,  sfDepth: 4,  sfSkill: 3,  sfMoveMs: 450,  clDepth: 2, clTimeMs: 500,  clTopK: 3 },
  { name: "Rook",        elo: 1000, sfDepth: 6,  sfSkill: 5,  sfMoveMs: 600,  clDepth: 2, clTimeMs: 700,  clTopK: 2 },
  { name: "Bishop",      elo: 1200, sfDepth: 8,  sfSkill: 7,  sfMoveMs: 800,  clDepth: 3, clTimeMs: 900,  clTopK: 2 },
  { name: "Queen",       elo: 1400, sfDepth: 10, sfSkill: 9,  sfMoveMs: 1000, clDepth: 3, clTimeMs: 1200, clTopK: 1 },
  { name: "Candidate",   elo: 1550, sfDepth: 12, sfSkill: 12, sfMoveMs: 1300, clDepth: 3, clTimeMs: 1600, clTopK: 1 },
  { name: "Master",      elo: 1700, sfDepth: 14, sfSkill: 15, sfMoveMs: 1700, clDepth: 4, clTimeMs: 2000, clTopK: 1 },
  { name: "Grandmaster", elo: 1850, sfDepth: 16, sfSkill: 18, sfMoveMs: 2200, clDepth: 4, clTimeMs: 2600, clTopK: 1 },
  { name: "Nightmare",   elo: 2050, sfDepth: 18, sfSkill: 20, sfMoveMs: 2600, clDepth: 4, clTimeMs: 3200, clTopK: 1 },
];

/* ---------------- rating-keyed configs (Bot mode) ---------------- */

export const BOT_RATINGS = [400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200] as const;

export const BOT_PERSONAS: Record<number, string> = {
  400: "Pawn",
  600: "Squire",
  800: "Knight",
  1000: "Rook",
  1200: "Bishop",
  1400: "Queen",
  1600: "Candidate",
  1800: "Master",
  2000: "Grandmaster",
  2200: "Nightmare",
};

/**
 * The chosen rating genuinely changes engine behaviour: Stockfish's
 * Skill Level and search depth scale monotonically with rating, and the
 * classic fallback engine mirrors the curve.
 */
/**
 * Response-time targets per rating band:
 *   400–800  → ~0.25–0.5 s   1000–1400 → ~0.5–1 s
 *   1600–1800 → ~1.3–1.7 s   2000–2200 → ~2.3–2.8 s
 * Strength still scales monotonically: Skill Level, depth cap and thinking
 * time all increase with rating, so higher bots are genuinely stronger —
 * they just never exceed their movetime budget.
 */
export const RATING_CONFIG: Record<number, LevelConfig> = {
  400:  { name: "Pawn",        elo: 400,  sfDepth: 2,  sfSkill: 0,  sfMoveMs: 300,  clDepth: 1, clTimeMs: 300,  clTopK: 6 },
  600:  { name: "Squire",      elo: 600,  sfDepth: 3,  sfSkill: 1,  sfMoveMs: 350,  clDepth: 1, clTimeMs: 400,  clTopK: 4 },
  800:  { name: "Knight",      elo: 800,  sfDepth: 4,  sfSkill: 3,  sfMoveMs: 500,  clDepth: 2, clTimeMs: 550,  clTopK: 3 },
  1000: { name: "Rook",        elo: 1000, sfDepth: 6,  sfSkill: 5,  sfMoveMs: 650,  clDepth: 2, clTimeMs: 750,  clTopK: 2 },
  1200: { name: "Bishop",      elo: 1200, sfDepth: 8,  sfSkill: 7,  sfMoveMs: 850,  clDepth: 3, clTimeMs: 1000, clTopK: 2 },
  1400: { name: "Queen",       elo: 1400, sfDepth: 10, sfSkill: 9,  sfMoveMs: 1050, clDepth: 3, clTimeMs: 1400, clTopK: 1 },
  1600: { name: "Candidate",   elo: 1600, sfDepth: 12, sfSkill: 12, sfMoveMs: 1400, clDepth: 4, clTimeMs: 1900, clTopK: 1 },
  1800: { name: "Master",      elo: 1800, sfDepth: 14, sfSkill: 15, sfMoveMs: 1800, clDepth: 4, clTimeMs: 2500, clTopK: 1 },
  2000: { name: "Grandmaster", elo: 2000, sfDepth: 16, sfSkill: 18, sfMoveMs: 2400, clDepth: 4, clTimeMs: 3200, clTopK: 1 },
  2200: { name: "Nightmare",   elo: 2200, sfDepth: 18, sfSkill: 20, sfMoveMs: 2800, clDepth: 4, clTimeMs: 3800, clTopK: 1 },
};

const STOCKFISH_URLS = [
  "https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js",
  "https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js",
];

type LineListener = (line: string) => void;

class StockfishWorker {
  private worker: Worker | null = null;
  private listeners = new Set<LineListener>();
  /** monotonic token — only the newest search may resolve */
  private searchSeq = 0;
  /** cached Skill Level to avoid redundant UCI options per move */
  private lastSkill = -1;

  async init(): Promise<boolean> {
    for (const url of STOCKFISH_URLS) {
      try {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 9000);
        const res = await fetch(url, { signal: controller.signal });
        window.clearTimeout(timeout);
        if (!res.ok) continue;
        const code = await res.text();
        if (!code || code.length < 10000) continue;
        const blobUrl = URL.createObjectURL(new Blob([code], { type: "application/javascript" }));
        const worker = new Worker(blobUrl);
        URL.revokeObjectURL(blobUrl);

        worker.onmessage = (event: MessageEvent) => {
          const line = typeof event.data === "string" ? event.data : String(event.data);
          this.listeners.forEach((fn) => fn(line));
        };
        worker.onerror = () => {
          this.fail();
        };
        this.worker = worker;

        // UCI handshake with a hard deadline
        const ok = await new Promise<boolean>((resolve) => {
          const timer = window.setTimeout(() => {
            cleanup();
            resolve(false);
          }, 8000);
          const onLine: LineListener = (line) => {
            if (line === "uciok") {
              this.post("isready");
            } else if (line === "readyok") {
              window.clearTimeout(timer);
              this.listeners.delete(onLine);
              resolve(true);
            }
          };
          const cleanup = () => {
            window.clearTimeout(timer);
            this.listeners.delete(onLine);
          };
          this.listeners.add(onLine);
          this.post("uci");
        });

        if (ok) return true;
        this.fail();
      } catch {
        this.fail();
      }
    }
    return false;
  }

  private post(command: string) {
    this.worker?.postMessage(command);
  }

  private fail() {
    try {
      this.worker?.terminate();
    } catch {
      /* noop */
    }
    this.worker = null;
    this.listeners.clear();
  }

  get alive() {
    return this.worker !== null;
  }

  /**
   * Search a position defined by its full move history.
   * Reports live evaluations (centipawns, side-to-move perspective) via onEval.
   *
   * Speed & correctness guarantees:
   *  - `go movetime N depth D` — Stockfish self-terminates after N ms (or at
   *    depth D, whichever first), so thinking time is hard-bounded by rating.
   *  - any in-flight search is `stop`ped before a new one begins, and a
   *    sequence token makes sure a stale `bestmove` can never resolve a newer
   *    search — exactly one search runs at a time per engine instance.
   *  - the Skill Level UCI option is only re-sent when it changes.
   */
  search(
    uciMoves: string[],
    depth: number,
    skill: number,
    moveTimeMs: number,
    onEval: (cpForSideToMove: number, mate: boolean) => void,
  ): Promise<string> {
    if (!this.worker) return Promise.reject(new Error("stockfish offline"));

    // Cancel any previous search so it cannot keep burning CPU or emit a
    // result for an outdated position, and drop its listener immediately.
    this.post("stop");
    this.listeners.clear();
    const id = ++this.searchSeq;

    return new Promise((resolve, reject) => {
      let guardTimer = 0;
      // A stopped search emits its stale `bestmove` *before* the new search's
      // first `info` line (UCI processes `stop` → `bestmove`, then `go` →
      // `info…`). Only accept a `bestmove` once this search has produced its
      // own `info` output, so a superseded result can never resolve us.
      let sawOwnInfo = false;

      const cleanup = () => {
        this.listeners.delete(onLine);
        window.clearTimeout(guardTimer);
      };

      const onLine: LineListener = (line) => {
        // A superseded search's trailing output must never leak through.
        if (id !== this.searchSeq) {
          cleanup();
          return;
        }
        if (line.startsWith("info") && line.includes("score")) {
          sawOwnInfo = true;
          const cpMatch = line.match(/score cp (-?\d+)/);
          const mateMatch = line.match(/score mate (-?\d+)/);
          if (cpMatch) onEval(parseInt(cpMatch[1], 10), false);
          else if (mateMatch) onEval(parseInt(mateMatch[1], 10) > 0 ? 9000 : -9000, true);
        } else if (line.startsWith("bestmove")) {
          // Ignore a stale `bestmove` from a search we just stopped.
          if (!sawOwnInfo) return;
          const move = line.split(" ")[1];
          cleanup();
          if (move && move !== "(none)") resolve(move);
          else reject(new Error("no bestmove"));
        }
      };

      this.listeners.add(onLine);

      if (skill !== this.lastSkill) {
        this.post(`setoption name Skill Level value ${skill}`);
        this.lastSkill = skill;
      }
      this.post(`setoption name Ponder value false`);
      this.post(`position startpos moves ${uciMoves.join(" ")}`);
      // Bounded search: engine stops at moveTimeMs OR depth, whichever first.
      this.post(`go movetime ${moveTimeMs} depth ${depth}`);

      // movetime self-terminates; this is only a safety net for a wedged engine.
      guardTimer = window.setTimeout(() => {
        cleanup();
        reject(new Error("search timeout"));
      }, moveTimeMs + 2000);
    });
  }
}

let sf: StockfishWorker | null = null;
let initPromise: Promise<EngineKind> | null = null;
let kind: EngineKind | null = null;

/** Start loading Stockfish; resolves to the engine that will be used. */
export function initEngine(): Promise<EngineKind> {
  if (initPromise) return initPromise;
  sf = new StockfishWorker();
  initPromise = sf.init().then((ok) => {
    if (!ok) sf = null;
    setEngineKind(ok ? "stockfish" : "classic");
    return kind as EngineKind;
  });
  return initPromise;
}

export function getEngineKind(): EngineKind | null {
  return kind;
}

/**
 * Begin loading Stockfish in the background. Call this as soon as the user
 * commits to a bot game (not on the homepage) so the download, worker startup
 * and UCI handshake are already done by the time the first move is needed.
 * Idempotent — the engine instance is created once and reused for the whole
 * session, so repeated calls are free.
 */
export function warmupEngine(): void {
  void initEngine();
}

/* ---------------- engine-state subscriptions ---------------- */

type KindListener = (k: EngineKind | null) => void;
const kindListeners = new Set<KindListener>();

export function subscribeEngineKind(listener: KindListener): () => void {
  kindListeners.add(listener);
  listener(kind); // replay current state immediately
  return () => kindListeners.delete(listener);
}

function setEngineKind(next: EngineKind) {
  if (kind === next) return;
  kind = next;
  kindListeners.forEach((fn) => fn(next));
}

/** Verify that a UCI move is legal in the given position; returns normalized UCI. */
export function validateUci(fen: string, uci: string): string | null {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci[4] : undefined;
  try {
    const scratch = new Chess(fen);
    const move = scratch.move({
      from: from as never,
      to: to as never,
      ...(promotion ? { promotion: promotion as never } : {}),
    });
    return `${move.from}${move.to}${move.promotion ?? ""}`;
  } catch {
    return null;
  }
}

/**
 * Ask the engine for the best move.
 * @param fen current position (used by the classic engine)
 * @param uciMoves full UCI move history from the initial position
 */
export async function analyze(
  fen: string,
  uciMoves: string[],
  level: number,
  onEval: (whiteCp: number) => void,
): Promise<EngineResult> {
  const cfg = LEVELS[Math.min(LEVELS.length - 1, Math.max(0, level - 1))];
  return runSearch(cfg, fen, uciMoves, onEval);
}

/** Analyze at a specific bot rating (400–2200). */
export async function analyzeAtRating(
  fen: string,
  uciMoves: string[],
  rating: number,
  onEval: (whiteCp: number) => void,
): Promise<EngineResult> {
  const cfg =
    RATING_CONFIG[rating] ??
    RATING_CONFIG[BOT_RATINGS.reduce((best, r) => (Math.abs(r - rating) < Math.abs(best - rating) ? r : best))];
  return runSearch(cfg, fen, uciMoves, onEval);
}

async function runSearch(
  cfg: LevelConfig,
  fen: string,
  uciMoves: string[],
  onEval: (whiteCp: number) => void,
): Promise<EngineResult> {
  // Decide which engine to use — without ever blocking an already-loaded one.
  let activeKind: EngineKind;
  if (kind === "stockfish" && sf?.alive) {
    // Hot path: the engine is warm, search immediately (no race, no wait).
    activeKind = "stockfish";
  } else if (kind === "classic") {
    // A previous attempt already failed to load Stockfish — don't retry per move.
    activeKind = "classic";
  } else {
    // Engine not decided yet: wait for it, but cap the wait so the UI never stalls.
    // Once Stockfish finishes loading, every following move takes the hot path.
    activeKind = await Promise.race<EngineKind>([
      initEngine(),
      new Promise<EngineKind>((resolve) =>
        window.setTimeout(() => resolve(getEngineKind() ?? "classic"), 2500),
      ),
    ]);
  }

  const turn = fen.split(" ")[1];
  const toWhite = (cp: number) => (turn === "b" ? -cp : cp);

  if (activeKind === "stockfish" && sf?.alive) {
    try {
      let lastCp = 20;
      const rawUci = await sf.search(uciMoves, cfg.sfDepth, cfg.sfSkill, cfg.sfMoveMs, (cp: number, mate: boolean) => {
        lastCp = mate ? cp : Math.max(-1200, Math.min(1200, cp));
        onEval(Math.round(toWhite(lastCp)) / 100);
      });
      const uci = validateUci(fen, rawUci);
      if (uci) {
        return { uci, evalCp: toWhite(lastCp) / 100, depth: cfg.sfDepth, engine: "stockfish" };
      }
      // Stockfish suggested an illegal move — fall through to classic.
    } catch {
      // engine hiccup — fall through to classic for this move
    }
  }

  const r = await classicSearch(fen, cfg.clDepth, cfg.clTimeMs, cfg.clTopK);
  const uci = validateUci(fen, r.uci);
  if (!uci) throw new Error("engine returned an illegal move");
  onEval(r.evalCp);
  return { uci, evalCp: r.evalCp, depth: r.depth, engine: "classic" };
}

/* ---------------- classic engine worker ---------------- */

let classicWorker: Worker | null = null;
let classicSeq = 0;
const pendingClassic = new Map<
  number,
  { resolve: (r: { uci: string; evalCp: number; depth: number }) => void; reject: (e: Error) => void }
>();

function getClassicWorker(): Worker {
  if (classicWorker) return classicWorker;
  const worker = new Worker(new URL("./minimaxWorker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent) => {
    const data = event.data as
      | { id: number; ok: true; uci: string; evalCp: number; depth: number }
      | { id: number; ok: false; error: string };
    const handler = pendingClassic.get(data.id);
    if (!handler) return;
    pendingClassic.delete(data.id);
    if (data.ok) handler.resolve({ uci: data.uci, evalCp: data.evalCp / 100, depth: data.depth });
    else handler.reject(new Error(data.error));
  };
  classicWorker = worker;
  return worker;
}

function classicSearch(
  fen: string,
  maxDepth: number,
  timeMs: number,
  topK: number,
): Promise<{ uci: string; evalCp: number; depth: number }> {
  try {
    const worker = getClassicWorker();
    const id = ++classicSeq;
    return new Promise((resolve, reject) => {
      pendingClassic.set(id, { resolve, reject });
      worker.postMessage({ id, fen, maxDepth, timeMs, topK });
      window.setTimeout(() => {
        if (pendingClassic.has(id)) {
          pendingClassic.delete(id);
          reject(new Error("classic engine timeout"));
        }
      }, timeMs + 8000);
    });
  } catch {
    // worker construction blocked — run synchronously as a last resort
    const r = searchPosition(fen, maxDepth, timeMs, topK);
    return Promise.resolve({ uci: r.uci, evalCp: r.evalCp / 100, depth: r.depth });
  }
}
