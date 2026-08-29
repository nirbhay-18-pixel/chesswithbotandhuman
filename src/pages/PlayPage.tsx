import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Chess, type PieceSymbol, type Square as JsSquare } from "chess.js";
import {
  GLYPHS,
  KIND_ORDER,
  KIND_VALUE,
  squareName,
  squareToCoords,
  type Kind,
  type Piece,
  type Side,
} from "../chess";
import {
  analyze,
  initEngine,
  LEVELS,
  subscribeEngineKind,
  type EngineKind,
} from "../engine";
import { ChessBoard, type Square, type Target } from "../components/ChessBoard";
import {
  CheckIcon,
  CpuIcon,
  DiceIcon,
  FlagIcon,
  FlipIcon,
  RefreshIcon,
  RobotIcon,
  UndoIcon,
  UsersIcon,
} from "../components/icons";
import { Chip, useToast } from "../components/ui";

type ResultKind = "checkmate" | "stalemate" | "draw" | "resign";
type Mode = "computer" | "local";
type ColorChoice = "w" | "b" | "random";

interface ResultInfo {
  kind: ResultKind;
  winner?: Side;
  reason?: string;
}

const SIDE_NAME: Record<Side, string> = { w: "White", b: "Black" };

const RULES_PROOF = [
  "Castling",
  "En passant",
  "Promotion",
  "Check & mate",
  "Stalemate",
  "Threefold repetition",
  "Fifty-move rule",
  "Insufficient material",
];

function needsPromotion(game: Chess, from: Square, to: Square): boolean {
  const piece = game.get(squareName(from.col, from.row) as JsSquare);
  if (!piece || piece.type !== "p") return false;
  if (piece.color === "w") return to.row === 0;
  return to.row === 7;
}

function formatEval(cp: number): string {
  return `${cp >= 0 ? "+" : ""}${cp.toFixed(2)}`;
}

/* ---------------- living details ---------------- */

function ThinkingDots() {
  return (
    <span className="ml-1 inline-flex items-end gap-[3px]" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1 w-1 animate-bounce rounded-full bg-brass-500"
          style={{ animationDelay: `${i * 140}ms`, animationDuration: "0.9s" }}
        />
      ))}
    </span>
  );
}

function engineMeta(kind: EngineKind | null) {
  if (kind === "stockfish") {
    return {
      dot: "bg-felt-500 dark:bg-felt-400",
      pulse: false,
      text: "text-felt-600 dark:text-felt-300",
      label: "Stockfish 10 · ready",
    };
  }
  if (kind === "classic") {
    return {
      dot: "bg-ink-400",
      pulse: false,
      text: "text-ink-500 dark:text-ink-300",
      label: "Classic engine · fallback",
    };
  }
  return {
    dot: "bg-brass-500",
    pulse: true,
    text: "text-brass-700 dark:text-brass-300",
    label: "Loading Stockfish…",
  };
}

/* ---------------- player bar ---------------- */

interface PlayerBarProps {
  side: Side;
  active: boolean;
  inCheck: boolean;
  captures: Kind[];
  captureGlyphClass: string;
  lead: number;
  gameOver: boolean;
  title?: string;
  avatar?: ReactNode;
  thinking?: boolean;
  evalCp?: number | null;
}

function PlayerBar({
  side,
  active,
  inCheck,
  captures,
  captureGlyphClass,
  lead,
  gameOver,
  title,
  avatar,
  thinking = false,
  evalCp = null,
}: PlayerBarProps) {
  const status = gameOver
    ? "game over"
    : thinking
      ? "thinking"
      : active
        ? inCheck
          ? "in check"
          : "to move"
        : "waiting";

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 transition-all duration-300 ${
        active || thinking
          ? "border-brass-500/60 bg-brass-500/[0.07] shadow-[0_0_24px_-10px_rgb(207_159_61/0.55)]"
          : "border-ink-900/10 dark:border-ink-100/10"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        {avatar ?? (
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-[22px] leading-none ${
              side === "w"
                ? "border-ink-900/15 bg-paper-200 text-ink-900"
                : "border-ink-100/15 bg-ink-900 text-paper-100 dark:border-ink-100/20"
            }`}
          >
            <span className="piece-glyph">{GLYPHS.K}</span>
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold leading-tight text-ink-900 dark:text-ink-100">
            {title ?? SIDE_NAME[side]}
          </p>
          <p className="flex items-center font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
            {status}
            {thinking && <ThinkingDots />}
          </p>
        </div>
        {active && !thinking && !gameOver && (
          <span className="animate-pulse-dot ml-1 hidden h-2 w-2 shrink-0 rounded-full bg-brass-500 sm:block" />
        )}
        {inCheck && active && !gameOver && (
          <span className="hidden rounded-full border border-blunder/50 bg-blunder/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-blunder sm:block">
            Check
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {evalCp !== null && !gameOver && (
          <span className="hidden rounded-md border border-ink-900/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink-500 sm:inline dark:border-ink-100/15 dark:text-ink-300">
            eval {formatEval(evalCp)}
          </span>
        )}
        <div className="piece-glyph flex items-center text-[17px] leading-none">
          {captures.map((k, i) => (
            <span key={`${k}${i}`} className={captureGlyphClass}>
              {GLYPHS[k]}
            </span>
          ))}
        </div>
        {lead > 0 && (
          <span className="rounded-md bg-felt-500/15 px-1.5 py-0.5 font-mono text-[11px] font-bold text-felt-600 dark:text-felt-300">
            +{lead}
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------------- page ---------------- */

export function PlayPage() {
  const { push } = useToast();
  const gameRef = useRef(new Chess());
  const [version, setVersion] = useState(0);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [result, setResult] = useState<ResultInfo | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [resignArmed, setResignArmed] = useState(false);
  const resignTimer = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /* ----- computer-opponent state ----- */
  const [mode, setMode] = useState<Mode>("computer");
  const [humanColor, setHumanColor] = useState<Side>("w");
  const [colorChoice, setColorChoice] = useState<ColorChoice>("w");
  const [difficulty, setDifficulty] = useState(5);
  const [setupOpen, setSetupOpen] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [engineKind, setEngineKind] = useState<EngineKind | null>(null);
  const [lastEval, setLastEval] = useState<number | null>(null);
  const [engineError, setEngineError] = useState(false);
  const tokenRef = useRef(0);
  const busyRef = useRef(false);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    return () => {
      if (resignTimer.current) window.clearTimeout(resignTimer.current);
    };
  }, []);

  /* engine lifecycle: start the Stockfish download early, subscribe to its state */
  useEffect(() => {
    void initEngine();
    return subscribeEngineKind((k) => setEngineKind(k));
  }, []);

  /* ----- derived state (version-driven) ----- */

  const computerColor: Side = humanColor === "w" ? "b" : "w";
  const levelCfg = LEVELS[Math.min(LEVELS.length - 1, Math.max(0, difficulty - 1))];

  const turn = gameRef.current.turn() as Side;
  const inCheck = gameRef.current.inCheck();

  const history = useMemo(
    () => gameRef.current.history({ verbose: true }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  const boardPieces = useMemo<Piece[]>(() => {
    const list: Piece[] = [];
    gameRef.current.board().forEach((rank) =>
      rank.forEach((cell) => {
        if (cell) {
          list.push({
            id: cell.square,
            side: cell.color as Side,
            kind: cell.type.toUpperCase() as Kind,
            ...squareToCoords(cell.square),
          });
        }
      }),
    );
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const checkSquare = useMemo<Square | null>(() => {
    if (!gameRef.current.inCheck()) return null;
    const sideToMove = gameRef.current.turn();
    for (const rank of gameRef.current.board()) {
      for (const cell of rank) {
        if (cell && cell.type === "k" && cell.color === sideToMove) return squareToCoords(cell.square);
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const targets = useMemo<Target[]>(() => {
    if (!selected || result || promotion) return [];
    if (mode === "computer" && turn !== humanColor) return [];
    const from = squareName(selected.col, selected.row) as JsSquare;
    const moves = gameRef.current.moves({ square: from, verbose: true });
    const map = new Map<string, Target>();
    for (const mv of moves) {
      const capture = mv.flags.includes("c") || mv.flags.includes("e");
      const prev = map.get(mv.to);
      if (prev) {
        prev.capture = prev.capture || capture;
        continue;
      }
      map.set(mv.to, { ...squareToCoords(mv.to), capture });
    }
    return [...map.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, result, promotion, version, mode, turn, humanColor]);

  const captured = useMemo(() => {
    const byWhite: Kind[] = [];
    const byBlack: Kind[] = [];
    for (const mv of history) {
      if (mv.captured) {
        const kind = mv.captured.toUpperCase() as Kind;
        (mv.color === "w" ? byWhite : byBlack).push(kind);
      }
    }
    const byValue = (a: Kind, b: Kind) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b);
    byWhite.sort(byValue);
    byBlack.sort(byValue);
    const val = (arr: Kind[]) => arr.reduce((sum, k) => sum + KIND_VALUE[k], 0);
    return { byWhite, byBlack, diff: val(byWhite) - val(byBlack) };
  }, [history]);

  const lastMv = history.length > 0 ? history[history.length - 1] : null;
  const moveNumber = Math.floor(history.length / 2) + 1;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history.length]);

  /* ----- actions ----- */

  const applyMove = useCallback(
    (from: JsSquare, to: JsSquare, promo?: PieceSymbol) => {
      const g = gameRef.current;
      try {
        g.move({ from, to, ...(promo ? { promotion: promo } : {}) });
      } catch {
        setSelected(null);
        return;
      }
      setSelected(null);
      setPromotion(null);

      if (g.isCheckmate()) {
        setResult({ kind: "checkmate", winner: g.turn() === "w" ? "b" : "w" });
      } else if (g.isStalemate()) {
        setResult({ kind: "stalemate" });
      } else if (g.isThreefoldRepetition()) {
        setResult({ kind: "draw", reason: "Threefold repetition" });
      } else if (g.isInsufficientMaterial()) {
        setResult({ kind: "draw", reason: "Insufficient material" });
      } else if (g.isDraw()) {
        setResult({ kind: "draw", reason: "Fifty-move rule" });
      }
      bump();
    },
    [bump],
  );

  const onSquareClick = useCallback(
    (sq: Square) => {
      if (result || promotion) return;
      const g = gameRef.current;
      /* only the human may act, and only on their own turn */
      if (mode === "computer" && (thinking || engineError || g.turn() !== humanColor)) return;
      const name = squareName(sq.col, sq.row) as JsSquare;

      if (selected && selected.col === sq.col && selected.row === sq.row) {
        setSelected(null);
        return;
      }
      if (selected) {
        const isTarget = targets.some((t) => t.col === sq.col && t.row === sq.row);
        if (isTarget) {
          const from = squareName(selected.col, selected.row) as JsSquare;
          if (needsPromotion(g, selected, sq)) {
            setPromotion({ from: selected, to: sq });
            return;
          }
          applyMove(from, name);
          return;
        }
      }
      const piece = g.get(name);
      if (piece && piece.color === g.turn()) setSelected(sq);
      else setSelected(null);
    },
    [selected, targets, result, promotion, applyMove, mode, thinking, engineError, humanColor],
  );

  const choosePromotion = (kind: PieceSymbol) => {
    if (!promotion) return;
    applyMove(
      squareName(promotion.from.col, promotion.from.row) as JsSquare,
      squareName(promotion.to.col, promotion.to.row) as JsSquare,
      kind,
    );
  };

  useEffect(() => {
    if (!promotion) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPromotion(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [promotion]);

  /* ----- the computer brain ----- */

  useEffect(() => {
    if (mode !== "computer" || setupOpen || result || reviewing || engineError) return;
    const g = gameRef.current;
    if (g.isGameOver() || g.turn() === humanColor) return;

    const token = ++tokenRef.current;
    let cancelled = false;
    busyRef.current = true;
    setThinking(true);

    const fen = g.fen();
    const uciMoves = g
      .history({ verbose: true })
      .map((mv) => `${mv.from}${mv.to}${mv.promotion ?? ""}`);

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await analyze(fen, uciMoves, difficulty, (cp) => {
            if (!cancelled) setLastEval(cp);
          });
          if (cancelled || tokenRef.current !== token) return;
          const from = res.uci.slice(0, 2) as JsSquare;
          const to = res.uci.slice(2, 4) as JsSquare;
          const promo = res.uci.length > 4 ? (res.uci[4] as PieceSymbol) : undefined;
          busyRef.current = false;
          setThinking(false);
          applyMove(from, to, promo);
        } catch {
          if (cancelled || tokenRef.current !== token) return;
          busyRef.current = false;
          setThinking(false);
          setEngineError(true);
          push("Coding Boy hit a snag — retry to make it think again.");
        }
      })();
    }, 420);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      tokenRef.current++;
      if (busyRef.current) {
        busyRef.current = false;
        setThinking(false);
      }
    };
  }, [mode, setupOpen, result, reviewing, engineError, version, humanColor, difficulty, applyMove, push]);

  /* ----- game management ----- */

  const resetBoard = useCallback(
    (msg?: string) => {
      tokenRef.current++;
      busyRef.current = false;
      gameRef.current = new Chess();
      setSelected(null);
      setPromotion(null);
      setResult(null);
      setReviewing(false);
      setResignArmed(false);
      setThinking(false);
      setEngineError(false);
      setLastEval(null);
      bump();
      if (msg) push(msg);
    },
    [bump, push],
  );

  const confirmSetup = () => {
    const resolved: Side =
      colorChoice === "random" ? (Math.random() < 0.5 ? "w" : "b") : colorChoice;
    setHumanColor(resolved);
    setSetupOpen(false);
    setFlipped(resolved === "b");
    resetBoard();
    push(
      resolved === "w"
        ? "You play White — your move."
        : "You play Black — Coding Boy opens with White.",
    );
  };

  const startNewGame = useCallback(() => {
    if (mode === "computer") {
      setColorChoice(humanColor);
      setSetupOpen(true);
      return;
    }
    resetBoard("New game — White to move.");
  }, [mode, humanColor, resetBoard]);

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    resetBoard();
    setMode(next);
    if (next === "computer") {
      setColorChoice(humanColor);
      setSetupOpen(true);
    } else {
      setSetupOpen(false);
      push("Local match — White to move. Pass and play.");
    }
  };

  const undoMove = useCallback(() => {
    const g = gameRef.current;
    if (g.history().length === 0 || thinking) return;
    g.undo();
    /* in computer mode, rewind to the human's turn (undo the pair) */
    if (mode === "computer" && g.turn() !== humanColor && g.history().length > 0) g.undo();
    setSelected(null);
    setPromotion(null);
    setResult(null);
    setReviewing(false);
    setEngineError(false);
    setLastEval(null);
    bump();
  }, [bump, mode, humanColor, thinking]);

  const resign = () => {
    if (result || history.length === 0 || thinking) return;
    if (!resignArmed) {
      setResignArmed(true);
      if (resignTimer.current) window.clearTimeout(resignTimer.current);
      resignTimer.current = window.setTimeout(() => setResignArmed(false), 2600);
      return;
    }
    if (resignTimer.current) window.clearTimeout(resignTimer.current);
    setResignArmed(false);
    const winner: Side = mode === "computer" ? computerColor : turn === "w" ? "b" : "w";
    setResult({ kind: "resign", winner });
  };

  /* ----- result copy ----- */

  const score =
    result === null
      ? ""
      : result.kind === "stalemate" || result.kind === "draw"
        ? "½–½"
        : result.winner === "w"
          ? "1–0"
          : "0–1";

  const resultTitle =
    result === null
      ? ""
      : result.kind === "checkmate"
        ? "Checkmate"
        : result.kind === "stalemate"
          ? "Stalemate"
          : result.kind === "resign"
            ? "Resignation"
            : "Draw";

  const resultSub =
    result === null
      ? ""
      : result.kind === "checkmate"
        ? mode === "computer"
          ? result.winner === humanColor
            ? "You win — Coding Boy is mated"
            : "Coding Boy wins by checkmate"
          : `${SIDE_NAME[result.winner ?? "w"]} wins`
        : result.kind === "resign"
          ? mode === "computer"
            ? result.winner === humanColor
              ? "Coding Boy resigned — you take the point"
              : "You resigned — Coding Boy takes the point"
            : `${SIDE_NAME[result.winner === "w" ? "b" : "w"]} resigned`
          : result.kind === "stalemate"
            ? "No legal moves — and no check"
            : (result.reason ?? "Draw agreed");

  const topSide: Side = flipped ? "w" : "b";
  const bottomSide: Side = flipped ? "b" : "w";
  const gameOver = result !== null;
  const meta = engineMeta(engineKind);

  const robotAvatar = (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-ink-100/15 bg-ink-900 text-brass-400 dark:bg-ink-950">
      <RobotIcon className="h-5 w-5" />
    </span>
  );

  /* ----- render ----- */

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-28 sm:px-6 lg:px-8 lg:pt-36">
      {/* ---------- header ---------- */}
      <header className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <p className="animate-rise flex items-center gap-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.24em] text-brass-700 dark:text-brass-300">
            <span className="inline-block h-2 w-2 rotate-45 bg-brass-500" aria-hidden="true" />
            {mode === "computer" ? "Play · vs Computer" : "Play · Local match"}
          </p>
          <h1
            className="animate-rise mt-4 font-display text-[clamp(2.3rem,5.4vw,4.2rem)] font-bold leading-[1.01] tracking-tight text-ink-950 dark:text-ink-100"
            style={{ animationDelay: "80ms" }}
          >
            {mode === "computer" ? (
              <>
                You vs <span className="text-outline">Coding Boy.</span>
              </>
            ) : (
              <>
                Two players. <span className="text-outline">One board.</span>
              </>
            )}
          </h1>
          <p
            className="animate-rise mt-5 max-w-2xl text-lg leading-relaxed text-ink-500 dark:text-ink-300"
            style={{ animationDelay: "160ms" }}
          >
            {mode === "computer" ? (
              <>
                Coding Boy runs <strong className="font-semibold text-ink-800 dark:text-ink-100">Stockfish 10</strong>{" "}
                inside a Web Worker — genuine search, genuine legal moves, ten strengths from
                first-day beginner to ≈2050. Pick your colour, set the difficulty, make it sweat.
              </>
            ) : (
              <>
                Pass-and-play hotseat with{" "}
                <strong className="font-semibold text-ink-800 dark:text-ink-100">chess.js</strong> as the
                single source of truth — every rule enforced, nothing automated. You control White
                <em> and</em> Black; Coding Boy waits one mode-switch away.
              </>
            )}
          </p>
        </div>

        <div className="animate-rise flex flex-col items-start gap-3 lg:items-end" style={{ animationDelay: "220ms" }}>
          {/* mode switch */}
          <div
            className="flex rounded-lg border border-ink-900/12 bg-paper-50/70 p-1 dark:border-ink-100/12 dark:bg-ink-800/70"
            role="group"
            aria-label="Game mode"
          >
            {(
              [
                { id: "computer", label: "vs Coding Boy", icon: <RobotIcon className="h-4 w-4" /> },
                { id: "local", label: "Local match", icon: <UsersIcon className="h-4 w-4" /> },
              ] as { id: Mode; label: string; icon: ReactNode }[]
            ).map((m) => (
              <button
                key={m.id}
                onClick={() => switchMode(m.id)}
                aria-pressed={mode === m.id}
                className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md px-3.5 text-[13.5px] font-semibold transition-all duration-200 ${
                  mode === m.id
                    ? "bg-brass-500 text-ink-950 shadow-[0_6px_16px_-8px_rgb(207_159_61/0.8)]"
                    : "text-ink-500 hover:text-ink-900 dark:text-ink-300 dark:hover:text-ink-100"
                }`}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {mode === "computer" ? (
              <>
                <Chip tone="felt">
                  <RobotIcon className="h-3 w-3" /> You vs Coding Boy
                </Chip>
                <Chip tone="brass">
                  <CpuIcon className="h-3 w-3" /> {meta.label}
                </Chip>
                <Chip>
                  {levelCfg.name} · ≈{levelCfg.elo}
                </Chip>
              </>
            ) : (
              <>
                <Chip tone="felt">
                  <UsersIcon className="h-3 w-3" /> Human vs Human
                </Chip>
                <Chip tone="brass">Full FIDE rules</Chip>
                <Chip>
                  <RobotIcon className="h-3 w-3" /> Coding Boy ready
                </Chip>
              </>
            )}
          </div>
        </div>
      </header>

      {/* rule proof strip */}
      <div
        className="animate-rise mt-8 flex flex-wrap gap-x-5 gap-y-2 border-y border-ink-900/10 py-3.5 dark:border-ink-100/10"
        style={{ animationDelay: "280ms" }}
      >
        {RULES_PROOF.map((rule) => (
          <span
            key={rule}
            className="flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-500 dark:text-ink-300"
          >
            <CheckIcon className="h-3 w-3 text-felt-500 dark:text-felt-300" />
            {rule}
          </span>
        ))}
      </div>

      {/* ---------- game area ---------- */}
      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_372px] lg:items-start">
        {/* board column */}
        <div className="animate-rise mx-auto w-full max-w-[660px] lg:mx-0" style={{ animationDelay: "320ms" }}>
          <div className="space-y-3">
            <PlayerBar
              side={topSide}
              title={
                mode === "computer"
                  ? topSide === computerColor
                    ? "Coding Boy"
                    : `You · ${SIDE_NAME[humanColor]}`
                  : undefined
              }
              avatar={mode === "computer" && topSide === computerColor ? robotAvatar : undefined}
              thinking={mode === "computer" && thinking && topSide === computerColor}
              evalCp={mode === "computer" && topSide === computerColor ? lastEval : null}
              active={!gameOver && turn === topSide}
              inCheck={inCheck && turn === topSide}
              captures={topSide === "w" ? captured.byWhite : captured.byBlack}
              captureGlyphClass={topSide === "w" ? "piece-b" : "piece-w"}
              lead={topSide === "w" ? captured.diff : -captured.diff}
              gameOver={gameOver}
            />

            <div className="relative">
              <div
                className={`overflow-hidden rounded-xl border shadow-lift transition-all duration-500 ${
                  gameOver
                    ? "border-ink-900/15 dark:border-ink-100/15"
                    : thinking
                      ? "border-brass-500/70 shadow-[0_0_38px_-12px_rgb(207_159_61/0.65)] dark:border-brass-400/60"
                      : "border-brass-500/35 dark:border-brass-400/30"
                }`}
              >
                <ChessBoard
                  coords
                  flipped={flipped}
                  interactive={!gameOver && !promotion && !setupOpen && (mode === "local" || (!thinking && turn === humanColor))}
                  onSquareClick={onSquareClick}
                  selected={selected}
                  targets={targets}
                  checkSquare={checkSquare}
                  lastMove={
                    lastMv
                      ? { from: squareToCoords(lastMv.from), to: squareToCoords(lastMv.to) }
                      : null
                  }
                  pieces={boardPieces}
                />
              </div>

              {/* setup overlay (computer mode) */}
              {setupOpen && mode === "computer" && (
                <div className="absolute inset-0 z-50 flex items-center justify-center rounded-xl bg-ink-950/80 p-4 backdrop-blur-[3px]">
                  <div className="w-full max-w-sm rounded-xl border border-ink-100/15 bg-ink-900 p-6 shadow-lift">
                    <div className="flex items-center gap-3.5">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brass-500 text-ink-950">
                        <RobotIcon className="h-6 w-6" />
                      </span>
                      <div>
                        <p className="font-display text-xl font-bold leading-tight text-ink-100">
                          Challenge Coding Boy
                        </p>
                        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
                          Pick your side & strength
                        </p>
                      </div>
                    </div>

                    {/* colour choice */}
                    <p className="mt-5 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-ink-300">
                      You play
                    </p>
                    <div className="mt-2 flex gap-2">
                      {(
                        [
                          {
                            id: "w",
                            label: "White",
                            glyph: <span className="piece-glyph piece-w text-[19px]">{GLYPHS.K}</span>,
                          },
                          {
                            id: "b",
                            label: "Black",
                            glyph: <span className="piece-glyph piece-b text-[19px]">{GLYPHS.K}</span>,
                          },
                          { id: "random", label: "Random", glyph: <DiceIcon className="h-[18px] w-[18px] text-brass-300" /> },
                        ] as { id: ColorChoice; label: string; glyph: ReactNode }[]
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setColorChoice(opt.id)}
                          aria-pressed={colorChoice === opt.id}
                          className={`flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border text-[13.5px] font-semibold transition-all duration-200 ${
                            colorChoice === opt.id
                              ? "border-brass-500 bg-brass-500/15 text-brass-300"
                              : "border-ink-100/15 text-ink-300 hover:border-ink-100/35 hover:text-ink-100"
                          }`}
                        >
                          {opt.glyph}
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {/* difficulty */}
                    <div className="mt-5 flex items-end justify-between">
                      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-ink-300">
                        Difficulty
                      </p>
                      <p className="font-display text-lg font-bold leading-none text-brass-300">
                        {levelCfg.name}
                        <span className="ml-2 font-mono text-[11px] font-medium text-ink-400">≈{levelCfg.elo}</span>
                      </p>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={difficulty}
                      onChange={(e) => setDifficulty(Number(e.target.value))}
                      aria-label="Bot difficulty"
                      className="mt-2.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-100/15 accent-brass-500"
                    />
                    <div className="mt-1.5 flex justify-between font-mono text-[9px] uppercase tracking-wider text-ink-500">
                      <span>Beginner</span>
                      <span>≈2050</span>
                    </div>

                    {/* engine status */}
                    <p className={`mt-4 flex items-center gap-2 font-mono text-[11px] font-medium ${meta.text}`}>
                      <span className={`h-2 w-2 rounded-full ${meta.dot} ${meta.pulse ? "animate-pulse-dot" : ""}`} />
                      {meta.label}
                    </p>

                    <button
                      onClick={confirmSetup}
                      className="mt-5 inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg bg-brass-500 text-[15px] font-bold text-ink-950 transition-all duration-300 hover:-translate-y-[2px] hover:bg-brass-400"
                    >
                      <RobotIcon className="h-5 w-5" />
                      Start the match
                    </button>
                  </div>
                </div>
              )}

              {/* result overlay */}
              {gameOver && !reviewing && !setupOpen && (
                <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 rounded-xl bg-ink-950/80 p-6 text-center backdrop-blur-[3px]">
                  <p className="font-mono text-4xl font-bold tracking-tight text-brass-400 sm:text-5xl">{score}</p>
                  <div>
                    <p className="font-display text-3xl font-bold tracking-tight text-ink-100 sm:text-4xl">{resultTitle}</p>
                    <p className="mt-1.5 text-[15px] text-ink-300">{resultSub}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap justify-center gap-3">
                    <button
                      onClick={startNewGame}
                      className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg bg-brass-500 px-6 text-[15px] font-bold text-ink-950 transition-all duration-300 hover:-translate-y-[2px] hover:bg-brass-400"
                    >
                      <RefreshIcon className="h-4 w-4" />
                      New game
                    </button>
                    <button
                      onClick={() => setReviewing(true)}
                      className="inline-flex h-11 cursor-pointer items-center rounded-lg border border-ink-100/25 px-6 text-[15px] font-semibold text-ink-100 transition-all duration-300 hover:-translate-y-[2px] hover:border-brass-400 hover:text-brass-300"
                    >
                      Review board
                    </button>
                  </div>
                </div>
              )}

              {/* promotion picker */}
              {promotion && (
                <div className="absolute inset-0 z-40 flex items-center justify-center rounded-xl bg-ink-950/70 p-6 backdrop-blur-[2px]">
                  <div className="w-full max-w-xs rounded-xl border border-ink-100/15 bg-ink-900 p-5 shadow-lift">
                    <p className="text-center font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-ink-300">
                      Promote pawn to
                    </p>
                    <div className="mt-4 grid grid-cols-4 gap-2.5">
                      {(["q", "r", "n", "b"] as PieceSymbol[]).map((kind) => (
                        <button
                          key={kind}
                          onClick={() => choosePromotion(kind)}
                          aria-label={`Promote to ${kind.toUpperCase()}`}
                          className="flex aspect-square cursor-pointer items-center justify-center rounded-lg border border-ink-100/15 bg-ink-800 transition-all duration-200 hover:-translate-y-1 hover:border-brass-400 hover:bg-ink-700"
                        >
                          <span
                            className={`piece-glyph text-[34px] ${turn === "w" ? "piece-w" : "piece-b"}`}
                          >
                            {GLYPHS[kind.toUpperCase() as Kind]}
                          </span>
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setPromotion(null)}
                      className="mt-4 w-full cursor-pointer text-center font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400 transition-colors hover:text-ink-200"
                    >
                      Cancel (Esc)
                    </button>
                  </div>
                </div>
              )}
            </div>

            <PlayerBar
              side={bottomSide}
              title={
                mode === "computer"
                  ? bottomSide === computerColor
                    ? "Coding Boy"
                    : `You · ${SIDE_NAME[humanColor]}`
                  : undefined
              }
              avatar={mode === "computer" && bottomSide === computerColor ? robotAvatar : undefined}
              thinking={mode === "computer" && thinking && bottomSide === computerColor}
              evalCp={mode === "computer" && bottomSide === computerColor ? lastEval : null}
              active={!gameOver && turn === bottomSide}
              inCheck={inCheck && turn === bottomSide}
              captures={bottomSide === "w" ? captured.byWhite : captured.byBlack}
              captureGlyphClass={bottomSide === "w" ? "piece-b" : "piece-w"}
              lead={bottomSide === "w" ? captured.diff : -captured.diff}
              gameOver={gameOver}
            />

            <p className="pt-1 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
              {mode === "computer"
                ? "Your pieces only — the rest answer to Coding Boy"
                : "Click a piece — legal squares light up · Click a dot to move"}
            </p>
          </div>
        </div>

        {/* side panel */}
        <aside className="animate-rise space-y-5 lg:sticky lg:top-28" style={{ animationDelay: "400ms" }}>
          {/* status */}
          <div className="rounded-xl border border-ink-900/10 bg-paper-50/85 p-5 shadow-card backdrop-blur-sm dark:border-ink-100/10 dark:bg-ink-800/75">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-ink-400">
              {gameOver ? "Result" : `Move ${moveNumber}`}
            </p>
            <div className="mt-2.5 flex items-center gap-3">
              {gameOver ? (
                <>
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brass-500 font-mono text-[13px] font-bold text-ink-950">
                    {score}
                  </span>
                  <div>
                    <p className="font-display text-xl font-bold leading-tight text-ink-950 dark:text-ink-100">
                      {resultTitle}
                    </p>
                    <p className="text-[13px] text-ink-500 dark:text-ink-300">{resultSub}</p>
                  </div>
                </>
              ) : mode === "computer" && thinking ? (
                <>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-900 text-brass-400 dark:bg-ink-950">
                    <RobotIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="flex items-center font-display text-xl font-bold leading-tight text-ink-950 dark:text-ink-100">
                      Computer thinking
                      <ThinkingDots />
                    </p>
                    <p className="text-[13px] text-ink-500 dark:text-ink-300">
                      {meta.label} · {levelCfg.name} level
                    </p>
                  </div>
                </>
              ) : mode === "computer" && engineError ? (
                <>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blunder/15 text-blunder">
                    <CpuIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-xl font-bold leading-tight text-blunder">Engine hiccup</p>
                    <p className="text-[13px] text-ink-500 dark:text-ink-300">The search failed — give it another go.</p>
                  </div>
                  <button
                    onClick={() => setEngineError(false)}
                    className="h-9 shrink-0 cursor-pointer rounded-lg border border-brass-500/60 px-3.5 text-[13px] font-bold text-brass-700 transition-all duration-200 hover:-translate-y-[1px] hover:bg-brass-500/10 dark:text-brass-300"
                  >
                    Retry
                  </button>
                </>
              ) : (
                <>
                  <span
                    className={`animate-pulse-dot h-3.5 w-3.5 shrink-0 rounded-full ${
                      turn === "w" ? "bg-paper-300 ring-2 ring-ink-900/30 dark:ring-ink-100/40" : "bg-ink-900 dark:bg-ink-200"
                    }`}
                  />
                  <div>
                    <p className="font-display text-xl font-bold leading-tight text-ink-950 dark:text-ink-100">
                      {mode === "computer" && turn === humanColor
                        ? "Your move"
                        : `${SIDE_NAME[turn]} to move`}
                    </p>
                    <p className="text-[13px] text-ink-500 dark:text-ink-300">
                      {inCheck
                        ? "Check — the king must escape"
                        : mode === "computer"
                          ? history.length === 0 && humanColor === "w"
                            ? "White opens the game — that's you"
                            : "Coding Boy answers every move"
                          : history.length === 0
                            ? "White opens the game"
                            : "Pass the device, or swap seats"}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* move list */}
          <div className="rounded-xl border border-ink-900/10 bg-paper-50/85 p-5 shadow-card backdrop-blur-sm dark:border-ink-100/10 dark:bg-ink-800/75">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-ink-400">Moves</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink-400">
                {history.length} {history.length === 1 ? "ply" : "plies"}
              </p>
            </div>
            <div ref={listRef} className="mt-3 h-52 overflow-y-auto pr-1 lg:h-60">
              {history.length === 0 ? (
                <p className="flex h-full items-center justify-center text-center font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">
                  No moves yet — {mode === "computer" && humanColor === "b" ? "Coding Boy opens" : "White begins"}
                </p>
              ) : (
                <div className="grid grid-cols-[2.2rem_1fr_1fr] gap-y-0.5 font-mono text-[13px]">
                  {Array.from({ length: Math.ceil(history.length / 2) }, (_, i) => {
                    const w = history[i * 2];
                    const b = history[i * 2 + 1];
                    const cell = (mv: (typeof history)[number] | undefined, idx: number) => (
                      <span
                        className={`rounded px-1.5 py-[3px] transition-colors ${
                          idx === history.length - 1
                            ? "bg-brass-500/15 font-bold text-brass-700 dark:text-brass-300"
                            : "text-ink-700 dark:text-ink-200"
                        }`}
                      >
                        {mv?.san ?? ""}
                      </span>
                    );
                    return (
                      <div key={i} className="contents">
                        <span className="px-1.5 py-[3px] text-ink-400 dark:text-ink-500">{i + 1}.</span>
                        {cell(w, i * 2)}
                        {cell(b, i * 2 + 1)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* controls */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={startNewGame}
              className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-brass-500 text-[14px] font-bold text-ink-950 transition-all duration-300 hover:-translate-y-[2px] hover:bg-brass-400"
            >
              <RefreshIcon className="h-4 w-4" />
              New Game
            </button>
            <button
              onClick={undoMove}
              disabled={history.length === 0 || thinking}
              className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-ink-900/15 text-[14px] font-semibold text-ink-800 transition-all duration-300 hover:-translate-y-[2px] hover:border-brass-600 hover:text-brass-700 disabled:pointer-events-none disabled:opacity-40 dark:border-ink-100/15 dark:text-ink-100 dark:hover:border-brass-400 dark:hover:text-brass-300"
            >
              <UndoIcon className="h-4 w-4" />
              Undo
            </button>
            <button
              onClick={() => setFlipped((f) => !f)}
              className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-ink-900/15 text-[14px] font-semibold text-ink-800 transition-all duration-300 hover:-translate-y-[2px] hover:border-brass-600 hover:text-brass-700 dark:border-ink-100/15 dark:text-ink-100 dark:hover:border-brass-400 dark:hover:text-brass-300"
            >
              <FlipIcon className="h-4 w-4" />
              Flip board
            </button>
            <button
              onClick={resign}
              disabled={gameOver || history.length === 0 || thinking}
              className={`inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border text-[14px] font-semibold transition-all duration-300 disabled:pointer-events-none disabled:opacity-40 ${
                resignArmed
                  ? "border-blunder bg-blunder text-paper-50 hover:bg-[#a84c41]"
                  : "border-blunder/40 text-blunder hover:-translate-y-[2px] hover:border-blunder hover:bg-blunder/10"
              }`}
            >
              <FlagIcon className="h-4 w-4" />
              {resignArmed ? (mode === "computer" ? "Confirm · you" : `Confirm · ${SIDE_NAME[turn]}`) : "Resign"}
            </button>
          </div>

          {/* engine card */}
          {mode === "computer" ? (
            <div className="rounded-xl border border-ink-900/10 bg-paper-50/85 p-5 shadow-card backdrop-blur-sm dark:border-ink-100/10 dark:bg-ink-800/75">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-ink-400">Engine</p>
                <p className={`flex items-center gap-1.5 font-mono text-[10.5px] font-semibold ${meta.text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${meta.pulse ? "animate-pulse-dot" : ""}`} />
                  {meta.label}
                </p>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-900 text-brass-400 dark:bg-ink-950">
                  <RobotIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[15px] font-bold leading-tight text-ink-900 dark:text-ink-100">Coding Boy</p>
                  <p className="font-mono text-[11px] text-ink-500 dark:text-ink-300">
                    {levelCfg.name} · ≈{levelCfg.elo} Elo · depth {levelCfg.sfDepth}
                  </p>
                </div>
              </div>
              <p className="mt-3 border-l-2 border-brass-500/60 pl-3 text-[12.5px] leading-relaxed text-ink-500 dark:text-ink-300">
                Every reply is a genuine search in a Web Worker — never a random move. If Stockfish
                can't be reached, the Classic engine covers the board seamlessly.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-3.5 rounded-xl border border-dashed border-ink-900/15 p-4.5 dark:border-ink-100/15">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-900/[0.06] text-brass-700 dark:bg-ink-100/[0.08] dark:text-brass-300">
                <CpuIcon className="h-5 w-5" />
              </span>
              <p className="text-[13px] leading-relaxed text-ink-500 dark:text-ink-300">
                <strong className="font-semibold text-ink-800 dark:text-ink-100">Engine idle — local match.</strong>{" "}
                Both sides are human-controlled. Switch to <em>vs Coding Boy</em> and Stockfish takes
                whichever seat you hand it.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
