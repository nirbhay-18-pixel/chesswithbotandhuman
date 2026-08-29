import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { ChessBoard, type Square, type Target } from "../components/ChessBoard";
import {
  CheckIcon,
  CpuIcon,
  FlagIcon,
  FlipIcon,
  RefreshIcon,
  UndoIcon,
  UsersIcon,
} from "../components/icons";
import { Chip, useToast } from "../components/ui";

type ResultKind = "checkmate" | "stalemate" | "draw" | "resign";

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

/* ---------------- player bar ---------------- */

interface PlayerBarProps {
  side: Side;
  active: boolean;
  inCheck: boolean;
  captures: Kind[];
  captureGlyphClass: string;
  lead: number;
  gameOver: boolean;
}

function PlayerBar({ side, active, inCheck, captures, captureGlyphClass, lead, gameOver }: PlayerBarProps) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 transition-all duration-300 ${
        active
          ? "border-brass-500/60 bg-brass-500/[0.07] shadow-[0_0_24px_-10px_rgb(207_159_61/0.55)]"
          : "border-ink-900/10 dark:border-ink-100/10"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-[22px] leading-none ${
            side === "w"
              ? "border-ink-900/15 bg-paper-200 text-ink-900"
              : "border-ink-100/15 bg-ink-900 text-paper-100 dark:border-ink-100/20"
          }`}
        >
          <span className="piece-glyph">{GLYPHS.K}</span>
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold leading-tight text-ink-900 dark:text-ink-100">
            {SIDE_NAME[side]}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
            {gameOver ? "game over" : active ? (inCheck ? "in check" : "to move") : "waiting"}
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

  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const game = gameRef.current;

  useEffect(() => {
    return () => {
      if (resignTimer.current) window.clearTimeout(resignTimer.current);
    };
  }, []);

  /* ----- derived state (version-driven) ----- */

  const turn = game.turn() as Side;
  const inCheck = game.inCheck();

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
  }, [selected, result, promotion, version]);

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
    [selected, targets, result, promotion, applyMove],
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

  const startNewGame = useCallback(() => {
    gameRef.current = new Chess();
    setSelected(null);
    setPromotion(null);
    setResult(null);
    setReviewing(false);
    setResignArmed(false);
    bump();
    push("New game — White to move.");
  }, [bump, push]);

  const undoMove = useCallback(() => {
    const g = gameRef.current;
    if (g.history().length === 0) return;
    g.undo();
    setSelected(null);
    setPromotion(null);
    setResult(null);
    setReviewing(false);
    bump();
  }, [bump]);

  const resign = () => {
    if (result || history.length === 0) return;
    if (!resignArmed) {
      setResignArmed(true);
      if (resignTimer.current) window.clearTimeout(resignTimer.current);
      resignTimer.current = window.setTimeout(() => setResignArmed(false), 2600);
      return;
    }
    if (resignTimer.current) window.clearTimeout(resignTimer.current);
    setResignArmed(false);
    setResult({ kind: "resign", winner: turn === "w" ? "b" : "w" });
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
        ? `${SIDE_NAME[result.winner ?? "w"]} wins`
        : result.kind === "resign"
          ? `${SIDE_NAME[result.winner === "w" ? "b" : "w"]} resigned`
          : result.kind === "stalemate"
            ? "No legal moves — and no check"
            : (result.reason ?? "Draw agreed");

  const topSide: Side = flipped ? "w" : "b";
  const bottomSide: Side = flipped ? "b" : "w";
  const gameOver = result !== null;

  /* ----- render ----- */

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-28 sm:px-6 lg:px-8 lg:pt-36">
      {/* ---------- header ---------- */}
      <header className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <p className="animate-rise flex items-center gap-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.24em] text-brass-700 dark:text-brass-300">
            <span className="inline-block h-2 w-2 rotate-45 bg-brass-500" aria-hidden="true" />
            Play · Local match
          </p>
          <h1
            className="animate-rise mt-4 font-display text-[clamp(2.3rem,5.4vw,4.2rem)] font-bold leading-[1.01] tracking-tight text-ink-950 dark:text-ink-100"
            style={{ animationDelay: "80ms" }}
          >
            Two players. <span className="text-outline">One board.</span>
          </h1>
          <p
            className="animate-rise mt-5 max-w-2xl text-lg leading-relaxed text-ink-500 dark:text-ink-300"
            style={{ animationDelay: "160ms" }}
          >
            Pass-and-play hotseat with <strong className="font-semibold text-ink-800 dark:text-ink-100">chess.js</strong> as
            the single source of truth — every rule enforced, nothing automated. You control White
            <em> and</em> Black; the computer opponent arrives in the next update.
          </p>
        </div>

        <div className="animate-rise flex flex-col items-start gap-3 lg:items-end" style={{ animationDelay: "220ms" }}>
          <div className="flex flex-wrap gap-2">
            <Chip tone="felt">
              <UsersIcon className="h-3 w-3" /> Human vs Human
            </Chip>
            <Chip tone="brass">Full FIDE rules</Chip>
            <Chip>
              <CpuIcon className="h-3 w-3" /> Stockfish · next
            </Chip>
          </div>
          <p className="max-w-[300px] text-right font-mono text-[10px] leading-relaxed uppercase tracking-[0.16em] text-ink-400 lg:text-right">
            No clocks, no engine — verify the rules first
          </p>
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
                    : "border-brass-500/35 dark:border-brass-400/30"
                }`}
              >
                <ChessBoard
                  coords
                  flipped={flipped}
                  interactive={!gameOver && !promotion}
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

              {/* result overlay */}
              {gameOver && !reviewing && (
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
              active={!gameOver && turn === bottomSide}
              inCheck={inCheck && turn === bottomSide}
              captures={bottomSide === "w" ? captured.byWhite : captured.byBlack}
              captureGlyphClass={bottomSide === "w" ? "piece-b" : "piece-w"}
              lead={bottomSide === "w" ? captured.diff : -captured.diff}
              gameOver={gameOver}
            />

            <p className="pt-1 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
              Click a piece — legal squares light up · Click a dot to move
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
              ) : (
                <>
                  <span
                    className={`animate-pulse-dot h-3.5 w-3.5 shrink-0 rounded-full ${
                      turn === "w" ? "bg-paper-300 ring-2 ring-ink-900/30 dark:ring-ink-100/40" : "bg-ink-900 dark:bg-ink-200"
                    }`}
                  />
                  <div>
                    <p className="font-display text-xl font-bold leading-tight text-ink-950 dark:text-ink-100">
                      {SIDE_NAME[turn]} to move
                    </p>
                    <p className="text-[13px] text-ink-500 dark:text-ink-300">
                      {inCheck ? "Check — the king must escape" : history.length === 0 ? "White opens the game" : "Pass the device, or swap seats"}
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
              disabled={history.length === 0}
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
              disabled={gameOver || history.length === 0}
              className={`inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border text-[14px] font-semibold transition-all duration-300 disabled:pointer-events-none disabled:opacity-40 ${
                resignArmed
                  ? "border-blunder bg-blunder text-paper-50 hover:bg-[#a84c41]"
                  : "border-blunder/40 text-blunder hover:-translate-y-[2px] hover:border-blunder hover:bg-blunder/10"
              }`}
            >
              <FlagIcon className="h-4 w-4" />
              {resignArmed ? `Confirm · ${SIDE_NAME[turn]}` : "Resign"}
            </button>
          </div>

          {/* engine note */}
          <div className="flex items-start gap-3.5 rounded-xl border border-dashed border-ink-900/15 p-4.5 dark:border-ink-100/15">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-900/[0.06] text-brass-700 dark:bg-ink-100/[0.08] dark:text-brass-300">
              <CpuIcon className="h-5 w-5" />
            </span>
            <p className="text-[13px] leading-relaxed text-ink-500 dark:text-ink-300">
              <strong className="font-semibold text-ink-800 dark:text-ink-100">Computer opponent is next.</strong>{" "}
              This board is deliberately engine-free — both sides are human-controlled so every rule
              can be verified before Stockfish takes a seat.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
