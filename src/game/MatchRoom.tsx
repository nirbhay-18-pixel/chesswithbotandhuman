import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
import { analyzeAtRating } from "../engine";
import { ChessBoard, type Square, type Target } from "../components/ChessBoard";
import {
  CpuIcon,
  FlagIcon,
  FlipIcon,
  FullscreenIcon,
  RefreshIcon,
  RobotIcon,
  UndoIcon,
} from "../components/icons";
import { useFullscreen } from "../hooks";
import { useToast } from "../components/ui";

export type ResultKind = "checkmate" | "stalemate" | "draw" | "resign";

export interface ResultInfo {
  kind: ResultKind;
  winner?: Side;
  reason?: string;
}

export interface GameOverInfo extends ResultInfo {
  sans: string[];
  finalFen: string;
}

export interface PlayerInfo {
  name: string;
  rating?: number;
  kind: "human" | "bot";
}

export interface MatchHandle {
  applyExternalUci: (uci: string) => boolean;
  loadSans: (sans: string[]) => void;
  reset: () => void;
  getSans: () => string[];
  forceResult: (r: ResultInfo) => void;
  clearResult: () => void;
}

const SIDE_NAME: Record<Side, string> = { w: "White", b: "Black" };

interface MatchRoomProps {
  mode: "bot" | "friend" | "online";
  white: PlayerInfo;
  black: PlayerInfo;
  botColor?: Side;
  botRating?: number;
  /** online: the colour this device controls */
  myColor?: Side;
  canControl?: (color: Side) => boolean;
  /** freeze the board entirely (e.g. opponent disconnected) */
  locked?: boolean;
  onLocalMove?: (uci: string, color: Side) => void;
  onGameOver?: (info: GameOverInfo) => void;
  onRematch?: () => void;
  onNewGame?: () => void;
  onViewGame?: (info: GameOverInfo) => void;
  onSaveGame?: (info: GameOverInfo) => void;
  saveState?: "hidden" | "idle" | "saved";
  /** online: tell the parent to transmit our resignation */
  onResignLocal?: () => void;
  onDrawOffer?: () => void;
  drawOfferState?: "none" | "sent" | "received";
  onDrawAccept?: () => void;
  onDrawDecline?: () => void;
  rematchStatus?: "idle" | "sent" | "received";
  onRematchAccept?: () => void;
  statusSlot?: ReactNode;
  panelExtras?: ReactNode;
  resultExtras?: ReactNode;
  footerNote?: string;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/* ---------------- player bar ---------------- */

interface PlayerBarProps {
  player: PlayerInfo;
  side: Side;
  active: boolean;
  thinking?: boolean;
  inCheck: boolean;
  captures: Kind[];
  captureGlyphClass: string;
  lead: number;
  gameOver: boolean;
}

function PlayerBar({
  player,
  side,
  active,
  thinking,
  inCheck,
  captures,
  captureGlyphClass,
  lead,
  gameOver,
}: PlayerBarProps) {
  const status = gameOver
    ? "game over"
    : thinking
      ? "thinking…"
      : active
        ? inCheck
          ? "in check"
          : "to move"
        : "waiting";

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 transition-all duration-300 ${
        active
          ? "border-brass-500/60 bg-brass-500/[0.07] shadow-[0_0_24px_-10px_rgb(207_159_61/0.55)]"
          : "border-ink-900/10 dark:border-ink-100/10"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        {player.kind === "bot" ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ink-900 text-brass-300 dark:bg-ink-700">
            <RobotIcon className="h-5 w-5" />
          </span>
        ) : (
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[12px] font-bold ${
              side === "w"
                ? "border border-ink-900/15 bg-paper-200 text-ink-900"
                : "border border-ink-100/15 bg-ink-900 text-paper-100"
            }`}
          >
            {initials(player.name)}
          </span>
        )}
        <div className="min-w-0">
          <p className="flex items-center gap-2 truncate text-[15px] font-semibold leading-tight text-ink-900 dark:text-ink-100">
            {player.name}
            {player.rating !== undefined && (
              <span className="font-mono text-[11px] font-medium text-ink-400">{player.rating}</span>
            )}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
            {SIDE_NAME[side]} · {status}
          </p>
        </div>
        {active && !gameOver && (
          <span className="animate-pulse-dot ml-1 hidden h-2 w-2 shrink-0 rounded-full bg-brass-500 sm:block" />
        )}
        {inCheck && active && !gameOver && (
          <span className="hidden rounded-full border border-blunder/50 bg-blunder/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-blunder sm:block">
            Check
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
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

/* ---------------- match room ---------------- */

export const MatchRoom = forwardRef<MatchHandle, MatchRoomProps>(function MatchRoom(
  {
    mode,
    white,
    black,
    botColor,
    botRating,
    myColor,
    canControl,
    locked = false,
    onLocalMove,
    onGameOver,
    onRematch,
    onNewGame,
    onViewGame,
    onSaveGame,
    saveState = "hidden",
    onResignLocal,
    onDrawOffer,
    drawOfferState = "none",
    onDrawAccept,
    onDrawDecline,
    rematchStatus = "idle",
    onRematchAccept,
    statusSlot,
    panelExtras,
    resultExtras,
    footerNote,
  },
  ref,
) {
  const gameRef = useRef(new Chess());
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  /* ----- fullscreen mode ----- */
  const { isFullscreen: isFs, toggle: toggleFs } = useFullscreen();
  const { push } = useToast();
  const handleToggleFs = useCallback(async () => {
    const ok = await toggleFs();
    if (!ok) push("Fullscreen isn't available in this browser.");
  }, [toggleFs, push]);

  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [result, setResult] = useState<ResultInfo | null>(null);
  const [resignArmed, setResignArmed] = useState(false);
  const [drawArmed, setDrawArmed] = useState(false);
  const resignTimer = useRef<number | null>(null);

  const [thinking, setThinking] = useState(false);
  const [evalCp, setEvalCp] = useState(0.2);
  const [engineError, setEngineError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const runRef = useRef(0);
  const firedRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  // keep my colour at the bottom by default
  const mySide: Side =
    mode === "bot" ? (botColor === "w" ? "b" : "w") : mode === "online" ? (myColor ?? "w") : "w";
  const [flipped, setFlipped] = useState(mySide === "b");

  const onLocalMoveRef = useRef(onLocalMove);
  onLocalMoveRef.current = onLocalMove;
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  useEffect(
    () => () => {
      if (resignTimer.current) window.clearTimeout(resignTimer.current);
      // invalidate any in-flight engine search on unmount
      runRef.current++;
      // never leave the browser stuck in fullscreen after leaving a game
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    },
    [],
  );

  const game = gameRef.current;
  const turn = game.turn() as Side;
  const inCheck = game.inCheck();
  const gameOver = result !== null;

  /* ----- derived state ----- */

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

  const canControlNow = useCallback(
    (color: Side) => {
      if (locked) return false;
      if (canControl) return canControl(color);
      if (mode === "bot") return color !== botColor;
      if (mode === "friend") return true;
      return color === myColor;
    },
    [locked, canControl, mode, botColor, myColor],
  );

  const targets = useMemo<Target[]>(() => {
    if (!selected || result || promotion || thinking) return [];
    if (!canControlNow(turn)) return [];
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
  }, [selected, result, promotion, thinking, turn, version, canControlNow]);

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

  /* ----- applying moves ----- */

  const detectEnd = useCallback(() => {
    const g = gameRef.current;
    if (g.isCheckmate()) setResult({ kind: "checkmate", winner: g.turn() === "w" ? "b" : "w" });
    else if (g.isStalemate()) setResult({ kind: "stalemate" });
    else if (g.isThreefoldRepetition()) setResult({ kind: "draw", reason: "Threefold repetition" });
    else if (g.isInsufficientMaterial()) setResult({ kind: "draw", reason: "Insufficient material" });
    else if (g.isDraw()) setResult({ kind: "draw", reason: "Fifty-move rule" });
  }, []);

  const applyMove = useCallback(
    (from: JsSquare, to: JsSquare, promo?: PieceSymbol, external = false) => {
      const g = gameRef.current;
      let mv;
      try {
        mv = g.move({ from, to, ...(promo ? { promotion: promo } : {}) });
      } catch {
        setSelected(null);
        return null;
      }
      setSelected(null);
      setPromotion(null);
      detectEnd();
      bump();
      if (!external) onLocalMoveRef.current?.(`${mv.from}${mv.to}${mv.promotion ?? ""}`, mv.color as Side);
      return mv;
    },
    [bump, detectEnd],
  );

  const buildGameOver = useCallback((): GameOverInfo => {
    const g = gameRef.current;
    return {
      ...(result ?? { kind: "draw" }),
      sans: g.history(),
      finalFen: g.fen(),
    } as GameOverInfo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, version]);

  useEffect(() => {
    if (result && !firedRef.current) {
      firedRef.current = true;
      onGameOverRef.current?.(buildGameOver());
    }
    if (!result) firedRef.current = false;
  }, [result, buildGameOver]);

  /* ----- engine (bot mode) ----- */

  useEffect(() => {
    if (mode !== "bot" || !botColor) return;
    if (result || promotion) return;
    const g = gameRef.current;
    if (g.turn() !== botColor) {
      setThinking(false);
      return;
    }
    const id = ++runRef.current;
    setThinking(true);
    setEngineError(false);
    const fen = g.fen();
    const uciMoves = g
      .history({ verbose: true })
      .map((m) => `${m.from}${m.to}${m.promotion ?? ""}`);
    analyzeAtRating(fen, uciMoves, botRating ?? 1200, (cp) => {
      if (runRef.current === id) setEvalCp(cp);
    })
      .then((res) => {
        if (runRef.current !== id) return;
        const ok = applyMove(
          res.uci.slice(0, 2) as JsSquare,
          res.uci.slice(2, 4) as JsSquare,
          res.uci.length > 4 ? (res.uci[4] as PieceSymbol) : undefined,
          true,
        );
        if (!ok) setEngineError(true);
      })
      .catch(() => {
        if (runRef.current === id) setEngineError(true);
      })
      .finally(() => {
        if (runRef.current === id) setThinking(false);
      });
  }, [mode, botColor, botRating, result, promotion, version, retryTick, applyMove]);

  /* ----- imperative handle ----- */

  useImperativeHandle(
    ref,
    () => ({
      applyExternalUci: (uci: string) => {
        const ok = applyMove(
          uci.slice(0, 2) as JsSquare,
          uci.slice(2, 4) as JsSquare,
          uci.length > 4 ? (uci[4] as PieceSymbol) : undefined,
          true,
        );
        return ok !== null;
      },
      loadSans: (sans: string[]) => {
        runRef.current++;
        const g = new Chess();
        for (const san of sans) {
          try {
            g.move(san);
          } catch {
            break;
          }
        }
        gameRef.current = g;
        setSelected(null);
        setPromotion(null);
        setResult(null);
        firedRef.current = false;
        setThinking(false);
        setEngineError(false);
        bump();
      },
      reset: () => {
        runRef.current++;
        gameRef.current = new Chess();
        setSelected(null);
        setPromotion(null);
        setResult(null);
        setResignArmed(false);
        setDrawArmed(false);
        firedRef.current = false;
        setThinking(false);
        setEngineError(false);
        setEvalCp(0.2);
        bump();
      },
      getSans: () => gameRef.current.history(),
      forceResult: (r) => {
        setResult(r);
      },
      clearResult: () => {
        setResult(null);
        firedRef.current = false;
      },
    }),
    [applyMove, bump],
  );

  /* ----- interactions ----- */

  const interactive = !gameOver && !promotion && !thinking && !locked && canControlNow(turn);

  const onSquareClick = useCallback(
    (sq: Square) => {
      if (!interactive) return;
      if (result || promotion) return;
      const g = gameRef.current;
      const name = squareName(sq.col, sq.row) as JsSquare;

      if (selected && selected.col === sq.col && selected.row === sq.row) {
        setSelected(null);
        return;
      }
      if (selected) {
        const isTarget = targets.some((t) => t.col === sq.col && t.row === sq.row);
        if (isTarget) {
          const from = squareName(selected.col, selected.row) as JsSquare;
          const piece = g.get(from);
          const isPromo =
            !!piece && piece.type === "p" && ((piece.color === "w" && sq.row === 0) || (piece.color === "b" && sq.row === 7));
          if (isPromo) {
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
    [interactive, result, promotion, selected, targets, applyMove],
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

  const undoMove = () => {
    const g = gameRef.current;
    if (thinking || g.history().length === 0) return;
    if (mode === "bot" && botColor) {
      const human = botColor === "w" ? "b" : "w";
      if (g.history().length > 0 && g.turn() === human) g.undo();
      let guard = 0;
      while (g.history().length > 0 && g.turn() !== human && guard < 8) {
        g.undo();
        guard++;
      }
    } else if (mode === "friend") {
      g.undo();
    } else {
      return;
    }
    setResult(null);
    setSelected(null);
    setPromotion(null);
    firedRef.current = false;
    bump();
  };

  const resign = () => {
    if (gameOver || history.length === 0) return;
    if (!resignArmed) {
      setResignArmed(true);
      if (resignTimer.current) window.clearTimeout(resignTimer.current);
      resignTimer.current = window.setTimeout(() => setResignArmed(false), 2600);
      return;
    }
    if (resignTimer.current) window.clearTimeout(resignTimer.current);
    setResignArmed(false);
    const loser: Side = mode === "bot" && botColor ? (botColor === "w" ? "b" : "w") : mode === "online" && myColor ? myColor : turn;
    setResult({ kind: "resign", winner: loser === "w" ? "b" : "w" });
    if (mode === "online") onResignLocal?.();
  };

  const agreeDraw = () => {
    if (gameOver) return;
    if (!drawArmed) {
      setDrawArmed(true);
      window.setTimeout(() => setDrawArmed(false), 2600);
      return;
    }
    setDrawArmed(false);
    setResult({ kind: "draw", reason: "Draw agreed" });
  };

  /* ----- result copy ----- */

  const nameOf = (side: Side) => (side === "w" ? white.name : black.name);
  const score =
    result === null
      ? ""
      : result.kind === "stalemate" || result.kind === "draw"
        ? "½–½"
        : result.winner === "w"
          ? "1–0"
          : "0–1";

  let resultTitle = "";
  let resultSub = "";
  if (result) {
    if (result.kind === "draw" || result.kind === "stalemate") {
      resultTitle = result.kind === "stalemate" ? "Stalemate" : "Draw";
      resultSub = result.kind === "stalemate" ? "No legal moves — and no check" : (result.reason ?? "Draw agreed");
    } else {
      const winnerName = result.winner ? nameOf(result.winner) : "";
      if (mode === "bot" && botColor) {
        const humanWon = result.winner !== botColor;
        resultTitle = result.kind === "resign" ? (humanWon ? "Victory!" : "Defeat") : humanWon ? "Victory!" : "Defeat";
        resultSub = humanWon
          ? `${nameOf(botColor)} ${result.kind === "resign" ? "resigned" : "is beaten"}`
          : `${nameOf(botColor)} ${result.kind === "resign" ? "accepts your resignation" : "takes the point"}`;
      } else {
        resultTitle = `${winnerName} wins${result.kind === "resign" ? " by resignation" : ""}!`;
        resultSub = result.kind === "checkmate" ? "Checkmate" : result.kind === "resign" ? `${nameOf(result.winner === "w" ? "b" : "w")} resigned` : "Checkmate";
      }
    }
  }

  const topSide: Side = flipped ? "w" : "b";
  const bottomSide: Side = flipped ? "b" : "w";
  const barOf = (side: Side): PlayerBarProps => ({
    player: side === "w" ? white : black,
    side,
    active: !gameOver && turn === side,
    thinking: !gameOver && thinking && mode === "bot" && turn === botColor,
    inCheck: inCheck && turn === side,
    captures: side === "w" ? captured.byWhite : captured.byBlack,
    captureGlyphClass: side === "w" ? "piece-b" : "piece-w",
    lead: side === "w" ? captured.diff : -captured.diff,
    gameOver,
  });

  const evalPct = Math.round(Math.min(92, Math.max(8, 50 + evalCp * 9)));

  /* ----- render ----- */

  return (
    <div
      className={
        isFs
          ? "grid min-h-0 flex-1 gap-3 overflow-y-auto sm:gap-4 landscape:max-lg:grid-cols-[minmax(0,1fr)_290px] landscape:max-lg:overflow-hidden lg:grid-cols-[minmax(0,1fr)_400px] lg:overflow-hidden"
          : "grid gap-8 lg:grid-cols-[minmax(0,1fr)_372px] lg:items-start"
      }
    >
      {/* board column */}
      <div
        className={
          isFs
            ? "flex min-h-0 w-full flex-col justify-center gap-3 landscape:max-lg:h-full lg:h-full"
            : "mx-auto w-full max-w-[660px] lg:mx-0"
        }
      >
        <div className={isFs ? "flex min-h-0 flex-col justify-center gap-3" : "space-y-3"}>
          {statusSlot}

          <PlayerBar {...barOf(topSide)} />

          <div
            className={
              isFs
                ? "relative mx-auto w-[min(100%,max(17rem,calc(100dvh-16rem)))] shrink-0 landscape:max-lg:w-[min(100%,max(14rem,calc(100dvh-15rem)))] lg:w-[min(100%,max(20rem,calc(100dvh-17rem)))]"
                : "relative"
            }
          >
            <div
              className={`overflow-hidden rounded-xl border shadow-lift transition-all duration-500 ${
                gameOver
                  ? "border-ink-900/15 dark:border-ink-100/15"
                  : interactive || thinking
                    ? "border-brass-500/35 dark:border-brass-400/30"
                    : "border-ink-900/15 dark:border-ink-100/15"
              }`}
            >
              <ChessBoard
                coords
                flipped={flipped}
                interactive={interactive}
                onSquareClick={onSquareClick}
                selected={selected}
                targets={targets}
                checkSquare={checkSquare}
                lastMove={lastMv ? { from: squareToCoords(lastMv.from), to: squareToCoords(lastMv.to) } : null}
                pieces={boardPieces}
              />
            </div>

            {/* result overlay */}
            {gameOver && (
              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-xl bg-ink-950/85 p-6 text-center backdrop-blur-[3px]">
                <p className="font-mono text-4xl font-bold tracking-tight text-brass-400 sm:text-5xl">{score}</p>
                <div>
                  <p className="font-display text-3xl font-bold tracking-tight text-ink-100 sm:text-4xl">{resultTitle}</p>
                  <p className="mt-1.5 text-[15px] text-ink-300">{resultSub}</p>
                </div>
                {resultExtras}
                <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                  {mode === "friend" && saveState !== "hidden" && onSaveGame && (
                    <button
                      onClick={() => onSaveGame(buildGameOver())}
                      disabled={saveState === "saved"}
                      className={`inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg px-5 text-[15px] font-bold transition-all duration-300 ${
                        saveState === "saved"
                          ? "cursor-default border border-felt-500/50 bg-felt-500/15 text-felt-300"
                          : "border border-ink-100/25 text-ink-100 hover:-translate-y-[2px] hover:border-brass-400 hover:text-brass-300"
                      }`}
                    >
                      {saveState === "saved" ? "Saved ✓" : "Save Game"}
                    </button>
                  )}
                  {onRematch && (
                    <button
                      onClick={rematchStatus === "received" ? onRematchAccept : onRematch}
                      className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg bg-brass-500 px-6 text-[15px] font-bold text-ink-950 transition-all duration-300 hover:-translate-y-[2px] hover:bg-brass-400"
                    >
                      <RefreshIcon className="h-4 w-4" />
                      {rematchStatus === "sent"
                        ? "Rematch offered…"
                        : rematchStatus === "received"
                          ? "Accept Rematch"
                          : "Rematch"}
                    </button>
                  )}
                  {onViewGame && (
                    <button
                      onClick={() => onViewGame(buildGameOver())}
                      className="inline-flex h-11 cursor-pointer items-center rounded-lg border border-ink-100/25 px-5 text-[15px] font-semibold text-ink-100 transition-all duration-300 hover:-translate-y-[2px] hover:border-brass-400 hover:text-brass-300"
                    >
                      View Game
                    </button>
                  )}
                  {onNewGame && (
                    <button
                      onClick={onNewGame}
                      className="inline-flex h-11 cursor-pointer items-center rounded-lg border border-ink-100/25 px-5 text-[15px] font-semibold text-ink-100 transition-all duration-300 hover:-translate-y-[2px] hover:border-brass-400 hover:text-brass-300"
                    >
                      New Game
                    </button>
                  )}
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
                        <span className={`piece-glyph text-[34px] ${turn === "w" ? "piece-w" : "piece-b"}`}>
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

            {/* quick exit chip while in fullscreen */}
            {isFs && (
              <button
                onClick={handleToggleFs}
                aria-label="Exit full screen"
                className="absolute right-2 top-2 z-50 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-ink-900/15 bg-paper-50/95 px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink-800 shadow-lift backdrop-blur transition-all duration-200 hover:-translate-y-[1px] hover:border-brass-500/60 hover:text-brass-700 dark:border-ink-100/15 dark:bg-ink-800/95 dark:text-ink-100 dark:hover:text-brass-300"
              >
                <FullscreenIcon className="h-3.5 w-3.5" />
                Exit
              </button>
            )}
          </div>

          <PlayerBar {...barOf(bottomSide)} />

          <p
            className={`pt-1 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400 ${
              isFs ? "hidden" : ""
            }`}
          >
            {footerNote ??
              (mode === "bot"
                ? "Click a piece — legal squares light up · Coding Boy answers for the other side"
                : "Click a piece — legal squares light up · Click a dot to move")}
          </p>
        </div>
      </div>

      {/* side panel */}
      <aside
        className={
          isFs
            ? "flex min-h-0 flex-col gap-4 overflow-y-auto landscape:max-lg:pr-0.5 lg:overflow-y-auto"
            : "space-y-5 lg:sticky lg:top-28"
        }
      >
        {/* status */}
        <div
          className={`rounded-xl border border-ink-900/10 bg-paper-50/85 p-5 shadow-card backdrop-blur-sm dark:border-ink-100/10 dark:bg-ink-800/75 ${
            isFs ? "shrink-0" : ""
          }`}
        >
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-ink-400">
            {gameOver ? "Result" : `Move ${moveNumber}`}
          </p>
          <div className="mt-2.5 flex items-center gap-3">
            {gameOver && result ? (
              <>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brass-500 font-mono text-[13px] font-bold text-ink-950">
                  {score}
                </span>
                <div>
                  <p className="font-display text-xl font-bold leading-tight text-ink-950 dark:text-ink-100">{resultTitle}</p>
                  <p className="text-[13px] text-ink-500 dark:text-ink-300">{resultSub}</p>
                </div>
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
                    {thinking ? "Coding Boy is thinking…" : `${nameOf(turn)} to move`}
                  </p>
                  <p className="text-[13px] text-ink-500 dark:text-ink-300">
                    {thinking
                      ? "Your pieces are locked while the engine calculates"
                      : inCheck
                        ? "Check — the king must escape"
                        : history.length === 0
                          ? "White opens the game"
                          : mode === "friend"
                            ? "Pass the device to the other player"
                            : "Your move"}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* eval bar (bot mode) */}
          {mode === "bot" && (
            <div className="mt-4">
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-ink-400">
                <span>Engine eval</span>
                <span className={evalCp >= 0 ? "text-ink-700 dark:text-ink-200" : "text-ink-500"}>
                  {evalCp >= 0 ? "+" : ""}
                  {evalCp.toFixed(2)}
                </span>
              </div>
              <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full border border-ink-900/15 dark:border-ink-100/15">
                <div className="h-full bg-paper-100 transition-all duration-700" style={{ width: `${evalPct}%` }} />
                <div className="h-full flex-1 bg-ink-900 dark:bg-ink-950" />
              </div>
            </div>
          )}
        </div>

        {/* move list */}
        <div
          className={`rounded-xl border border-ink-900/10 bg-paper-50/85 p-5 shadow-card backdrop-blur-sm dark:border-ink-100/10 dark:bg-ink-800/75 ${
            isFs ? "flex min-h-0 flex-col lg:flex-1" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-ink-400">Moves</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-400">
              {history.length} {history.length === 1 ? "ply" : "plies"}
            </p>
          </div>
          <div
            ref={listRef}
            className={
              isFs
                ? "mt-3 h-32 overflow-y-auto pr-1 landscape:max-lg:h-24 lg:h-auto lg:min-h-0 lg:flex-1"
                : "mt-3 h-48 overflow-y-auto pr-1 lg:h-56"
            }
          >
            {history.length === 0 ? (
              <p className="flex h-full items-center justify-center text-center font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">
                No moves yet — White begins
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
        <div className={`grid grid-cols-2 gap-2.5 ${isFs ? "shrink-0" : ""}`}>
          <button
            onClick={handleToggleFs}
            aria-label={isFs ? "Exit full screen" : "Enter full screen"}
            className={`col-span-2 inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg text-[14px] font-bold tracking-tight transition-all duration-300 hover:-translate-y-[2px] ${
              isFs
                ? "bg-brass-500 text-ink-950 shadow-[0_10px_26px_-12px_rgb(207_159_61/0.65)] hover:bg-brass-400"
                : "bg-ink-900 text-paper-50 hover:bg-ink-700 dark:bg-ink-100 dark:text-ink-950 dark:hover:bg-paper-200"
            }`}
          >
            <FullscreenIcon className="h-4 w-4" />
            {isFs ? "Exit Full Screen" : "Full Screen"}
          </button>
          {onNewGame && (
            <button
              onClick={onNewGame}
              className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-brass-500 text-[14px] font-bold text-ink-950 transition-all duration-300 hover:-translate-y-[2px] hover:bg-brass-400"
            >
              <RefreshIcon className="h-4 w-4" />
              New Game
            </button>
          )}
          {mode !== "online" && (
            <button
              onClick={undoMove}
              disabled={history.length === 0 || thinking}
              className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-ink-900/15 text-[14px] font-semibold text-ink-800 transition-all duration-300 hover:-translate-y-[2px] hover:border-brass-600 hover:text-brass-700 disabled:pointer-events-none disabled:opacity-40 dark:border-ink-100/15 dark:text-ink-100 dark:hover:border-brass-400 dark:hover:text-brass-300"
            >
              <UndoIcon className="h-4 w-4" />
              Undo
            </button>
          )}
          <button
            onClick={() => setFlipped((f) => !f)}
            className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-ink-900/15 text-[14px] font-semibold text-ink-800 transition-all duration-300 hover:-translate-y-[2px] hover:border-brass-600 hover:text-brass-700 dark:border-ink-100/15 dark:text-ink-100 dark:hover:border-brass-400 dark:hover:text-brass-300"
          >
            <FlipIcon className="h-4 w-4" />
            Flip board
          </button>

          {mode === "online" && drawOfferState === "received" && onDrawAccept && onDrawDecline ? (
            <div className="col-span-1 grid grid-cols-2 gap-2">
              <button
                onClick={onDrawAccept}
                className="inline-flex h-11 cursor-pointer items-center justify-center rounded-lg border border-felt-500/50 text-[13px] font-semibold text-felt-600 transition-colors hover:bg-felt-500/10 dark:text-felt-300"
              >
                ½ Accept
              </button>
              <button
                onClick={onDrawDecline}
                className="inline-flex h-11 cursor-pointer items-center justify-center rounded-lg border border-ink-900/15 text-[13px] font-semibold text-ink-700 dark:border-ink-100/15 dark:text-ink-200"
              >
                Decline
              </button>
            </div>
          ) : mode === "online" && onDrawOffer ? (
            <button
              onClick={onDrawOffer}
              disabled={gameOver || drawOfferState === "sent"}
              className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-ink-900/15 text-[14px] font-semibold text-ink-800 transition-all duration-300 hover:border-brass-600 hover:text-brass-700 disabled:pointer-events-none disabled:opacity-40 dark:border-ink-100/15 dark:text-ink-100"
            >
              ½ Offer draw
            </button>
          ) : mode === "friend" ? (
            <button
              onClick={agreeDraw}
              disabled={gameOver}
              className={`inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border text-[14px] font-semibold transition-all duration-300 disabled:pointer-events-none disabled:opacity-40 ${
                drawArmed
                  ? "border-felt-500 bg-felt-500 text-paper-50"
                  : "border-ink-900/15 text-ink-800 hover:-translate-y-[2px] hover:border-felt-500 hover:text-felt-600 dark:border-ink-100/15 dark:text-ink-100"
              }`}
            >
              ½ {drawArmed ? "Confirm draw" : "Agree draw"}
            </button>
          ) : null}

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
            {resignArmed ? "Confirm" : "Resign"}
          </button>
        </div>

        {/* engine trouble (bot) */}
        {mode === "bot" && engineError && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-blunder/40 bg-blunder/10 p-4">
            <p className="text-[13px] font-medium text-blunder">The engine hiccuped on that position.</p>
            <button
              onClick={() => {
                setEngineError(false);
                setRetryTick((t) => t + 1);
              }}
              className="shrink-0 cursor-pointer rounded-lg bg-blunder px-3.5 py-2 text-[13px] font-bold text-paper-50 transition-colors hover:bg-[#a84c41]"
            >
              Retry
            </button>
          </div>
        )}

        {panelExtras}

        {/* rule strip */}
        <div className="rounded-xl border border-ink-900/10 p-4 dark:border-ink-100/10">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-400">Enforced by chess.js</p>
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
            {["Castling", "En passant", "Promotion", "Check & mate", "Stalemate", "Repetition", "Fifty-move", "Bare kings"].map((r) => (
              <span key={r} className="font-mono text-[10px] uppercase tracking-wider text-ink-500 dark:text-ink-300">
                ✓ {r}
              </span>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
});
