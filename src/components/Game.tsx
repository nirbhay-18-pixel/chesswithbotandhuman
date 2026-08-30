import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Chess, type PieceSymbol, type Square as JsSquare } from "chess.js";
import { evalToWhitePct, GLYPHS, squareName, type Kind, type Piece, type Side } from "../chess";
import { analyze, getEngineKind, initEngine, LEVELS, type EngineKind } from "../engine";
import { ChessBoard, type Square, type Target } from "./ChessBoard";
import { DiceIcon, FlagIcon, FlipIcon, RefreshIcon, RobotIcon, UndoIcon } from "./icons";

export interface GameHandle {
  quickStart: () => void;
}

interface Outcome {
  title: string;
  sub: string;
  winner: "human" | "bot" | "draw";
}

type SetupSide = "w" | "b" | "random";

const PIECE_VALUE: Record<Kind, number> = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
const coordsOf = (sq: string): Square => ({ col: sq.charCodeAt(0) - 97, row: 8 - parseInt(sq[1], 10) });

export const Game = forwardRef<GameHandle, { className?: string }>(function Game({ className = "" }, ref) {
  const gameRef = useRef<Chess>(new Chess());
  const reqRef = useRef(0);
  const levelRef = useRef(4);
  const timersRef = useRef<number[]>([]);

  const [version, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);

  const [phase, setPhase] = useState<"playing" | "over">("playing");
  const [humanColor, setHumanColor] = useState<Side>("w");
  const [level, setLevel] = useState(4);
  const [flipped, setFlipped] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [selected, setSelected] = useState<Square | null>(null);
  const [pendingPromo, setPendingPromo] = useState<{ from: string; to: string } | null>(null);
  const [evalCp, setEvalCp] = useState(0.2);
  const [engineKind, setEngineKind] = useState<EngineKind | null>(getEngineKind());
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupSide, setSetupSide] = useState<SetupSide>("w");
  const [setupLevel, setSetupLevel] = useState(4);

  /* ---------- lifecycle ---------- */

  useEffect(() => {
    initEngine().then((k) => setEngineKind(k));
    return () => {
      reqRef.current++;
      timersRef.current.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  /* ---------- derived state ---------- */

  const game = gameRef.current;
  const turn = game.turn();
  const inCheck = game.isCheck();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const history = useMemo(() => game.history({ verbose: true }), [game, phase, thinking, setupOpen, version]);
  const lastMv = history.length ? history[history.length - 1] : null;

  const isHumanTurn = phase === "playing" && !thinking && !outcome && turn === humanColor;

  const boardPieces = useMemo<Piece[]>(() => {
    const list: Piece[] = [];
    game.board().forEach((rank) =>
      rank.forEach((cell) => {
        if (cell) {
          list.push({
            id: cell.square,
            side: cell.color as Side,
            kind: cell.type.toUpperCase() as Kind,
            ...coordsOf(cell.square),
          });
        }
      }),
    );
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, phase, thinking, setupOpen, version]);

  const checkSquare = useMemo<Square | null>(() => {
    if (!inCheck) return null;
    for (const rank of game.board()) {
      for (const cell of rank) {
        if (cell && cell.type === "k" && cell.color === turn) return coordsOf(cell.square);
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, inCheck, turn, phase, thinking, version]);

  const targets = useMemo<Target[]>(() => {
    if (!selected || !isHumanTurn) return [];
    const from = squareName(selected.col, selected.row);
    const moves = game.moves({ square: from as JsSquare, verbose: true });
    const map = new Map<string, Target>();
    for (const mv of moves) {
      const existing = map.get(mv.to);
      const capture = mv.flags.includes("c") || mv.flags.includes("e");
      if (existing) {
        existing.capture = existing.capture || capture;
      } else {
        map.set(mv.to, { ...coordsOf(mv.to), capture });
      }
    }
    return [...map.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, isHumanTurn, game, phase, thinking, version]);

  const capturedByWhite = useMemo<Kind[]>(() => {
    const list: Kind[] = [];
    history.forEach((mv) => mv.captured && mv.color === "w" && list.push(mv.captured.toUpperCase() as Kind));
    return list.sort((a, b) => PIECE_VALUE[b] - PIECE_VALUE[a]);
  }, [history]);

  const capturedByBlack = useMemo<Kind[]>(() => {
    const list: Kind[] = [];
    history.forEach((mv) => mv.captured && mv.color === "b" && list.push(mv.captured.toUpperCase() as Kind));
    return list.sort((a, b) => PIECE_VALUE[b] - PIECE_VALUE[a]);
  }, [history]);

  const materialDiff =
    capturedByWhite.reduce((s, k) => s + PIECE_VALUE[k], 0) -
    capturedByBlack.reduce((s, k) => s + PIECE_VALUE[k], 0);

  const canUndo = phase === "playing" && !thinking && !outcome && history.length > 0 && turn === humanColor;

  /* ---------- move list autoscroll ---------- */

  const movesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = movesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history.length]);

  /* ---------- game flow ---------- */

  function finishFromPosition() {
    const g = gameRef.current;
    const loser: Side = g.turn() as Side;
    let next: Outcome;
    if (g.isCheckmate()) {
      const humanWon = loser !== humanColor;
      next = {
        title: "Checkmate",
        sub: humanWon
          ? "Coding Boy's king has nowhere to run. Well played."
          : "Coding Boy delivers the final blow. Run it back?",
        winner: humanWon ? "human" : "bot",
      };
    } else if (g.isStalemate()) {
      next = { title: "Stalemate", sub: "No legal moves and no check — the point is split.", winner: "draw" };
    } else if (g.isThreefoldRepetition()) {
      next = { title: "Draw", sub: "Threefold repetition — the same position thrice.", winner: "draw" };
    } else if (g.isDrawByFiftyMoves()) {
      next = { title: "Draw", sub: "Fifty moves without progress — the rules call it.", winner: "draw" };
    } else if (g.isInsufficientMaterial()) {
      next = { title: "Draw", sub: "Not enough material left to deliver mate.", winner: "draw" };
    } else {
      next = { title: "Draw", sub: "The position is dead level.", winner: "draw" };
    }
    setOutcome(next);
    setPhase("over");
    setThinking(false);
  }

  function scheduleEngine(delayMs: number) {
    setThinking(true);
    const token = ++reqRef.current;
    const t = window.setTimeout(() => {
      void runEngine(token);
    }, delayMs);
    timersRef.current.push(t);
  }

  async function runEngine(token: number) {
    const g = gameRef.current;
    if (token !== reqRef.current || g.isGameOver()) return;

    const fen = g.fen();
    const uciMoves = g.history({ verbose: true }).map((mv) => mv.from + mv.to + (mv.promotion ?? ""));

    let result;
    try {
      result = await analyze(fen, uciMoves, levelRef.current, (cp) => {
        if (token === reqRef.current) setEvalCp(cp);
      });
    } catch {
      if (token !== reqRef.current) return;
      // ultra-safety: never leave the game stuck — play any legal move
      const any = g.moves({ verbose: true })[0];
      if (any) g.move(any.san);
      setThinking(false);
      bump();
      if (g.isGameOver()) finishFromPosition();
      return;
    }

    if (token !== reqRef.current) return;
    const from = result.uci.slice(0, 2);
    const to = result.uci.slice(2, 4);
    const promotion = result.uci.slice(4) || undefined;
    try {
      g.move({
        from: from as JsSquare,
        to: to as JsSquare,
        ...(promotion ? { promotion: promotion as PieceSymbol } : {}),
      });
    } catch {
      const any = g.moves({ verbose: true })[0];
      if (any) g.move(any.san);
    }
    setThinking(false);
    setSelected(null);
    bump();
    if (g.isGameOver()) finishFromPosition();
  }

  function startGame(side: SetupSide, lvl: number) {
    reqRef.current++;
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];

    const color: Side = side === "random" ? (Math.random() < 0.5 ? "w" : "b") : side;
    gameRef.current = new Chess();
    levelRef.current = lvl;

    setHumanColor(color);
    setLevel(lvl);
    setFlipped(color === "b");
    setOutcome(null);
    setPhase("playing");
    setThinking(false);
    setSelected(null);
    setPendingPromo(null);
    setSetupOpen(false);
    setEvalCp(0.2);
    bump();

    if (color === "b") scheduleEngine(700);
  }

  useImperativeHandle(ref, () => ({
    quickStart: () => startGame(setupSide, setupLevel),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [setupSide, setupLevel]);

  function playHumanMove(fromSq: string, toSq: string, promotion?: string) {
    const g = gameRef.current;
    try {
      g.move({
        from: fromSq as JsSquare,
        to: toSq as JsSquare,
        ...(promotion ? { promotion: promotion as PieceSymbol } : {}),
      });
    } catch {
      setSelected(null);
      setPendingPromo(null);
      return;
    }
    setPendingPromo(null);
    setSelected(null);
    bump();
    if (g.isGameOver()) {
      finishFromPosition();
      return;
    }
    scheduleEngine(320 + Math.random() * 480);
  }

  function onSquareClick(square: Square) {
    if (!isHumanTurn) return; // humans can only act on their own turn
    const g = gameRef.current;
    const sq = squareName(square.col, square.row);
    const piece = g.get(sq as JsSquare);

    if (selected) {
      const selectedSq = squareName(selected.col, selected.row);
      const isTarget = targets.some((t) => t.col === square.col && t.row === square.row);
      if (isTarget) {
        const needsPromo = g
          .moves({ square: selectedSq as JsSquare, verbose: true })
          .some((mv) => mv.to === sq && mv.promotion);
        if (needsPromo) {
          setPendingPromo({ from: selectedSq, to: sq });
        } else {
          playHumanMove(selectedSq, sq);
        }
        return;
      }
      if (piece && piece.color === humanColor && sq !== selectedSq) {
        setSelected(square);
        return;
      }
      setSelected(null);
      return;
    }

    if (piece && piece.color === humanColor) setSelected(square);
  }

  function resign() {
    if (phase !== "playing") return;
    reqRef.current++;
    timersRef.current.forEach((t) => window.clearTimeout(t));
    setThinking(false);
    setPendingPromo(null);
    setSelected(null);
    setOutcome({
      title: "Resignation",
      sub: "You tipped your king — Coding Boy takes the point.",
      winner: "bot",
    });
    setPhase("over");
  }

  function undoMove() {
    if (!canUndo) return;
    const g = gameRef.current;
    g.undo();
    if (g.turn() !== humanColor && g.history().length > 0) g.undo();
    setSelected(null);
    setEvalCp(0.2);
    bump();
    // edge case: undoing the bot's opening move leaves it as the bot's turn
    if (!g.isGameOver() && g.turn() !== humanColor) scheduleEngine(500);
  }

  /* ---------- presentation helpers ---------- */

  const cfg = LEVELS[level - 1];
  const whitePct = evalToWhitePct(evalCp);
  const humanTurnLabel = humanColor === "w" ? "White" : "Black";

  const scoreText =
    outcome?.winner === "draw" ? "½–½" : outcome?.winner === "human" ? (humanColor === "w" ? "1–0" : "0–1") : outcome ? (humanColor === "w" ? "0–1" : "1–0") : null;

  const statusBar = outcome
    ? `${outcome.title} — ${outcome.sub}`
    : thinking
      ? "thinking"
      : isHumanTurn
        ? `Your move · ${humanTurnLabel}${inCheck ? " — Check!" : ""}`
        : `Coding Boy to move · ${inCheck ? "Check!" : ""}`;

  function PlayerBar({
    isBot,
    active,
    activeLabel,
    captures,
    captureGlyphClass,
    lead,
    colorLabel,
  }: {
    isBot: boolean;
    active: boolean;
    activeLabel: string;
    captures: Kind[];
    captureGlyphClass: string;
    lead: number;
    colorLabel: string;
  }) {
    return (
      <div
        className={`flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 transition-all duration-300 ${
          active
            ? "border-brass-500/60 bg-brass-500/[0.08]"
            : "border-ink-900/10 dark:border-ink-100/10"
        }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          {isBot ? (
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors duration-300 ${
                active ? "bg-brass-500 text-ink-950" : "bg-ink-900 text-brass-300 dark:bg-ink-950"
              }`}
            >
              <RobotIcon className="h-6 w-6" />
            </span>
          ) : (
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-display text-lg font-bold transition-colors duration-300 ${
                active ? "bg-brass-500 text-ink-950" : "bg-felt-600 text-paper-50"
              }`}
            >
              You
            </span>
          )}
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[15px] font-bold leading-tight text-ink-950 dark:text-ink-100">
              {isBot ? "Coding Boy" : "You"}
              <span className="rounded-full border border-ink-900/12 px-2 py-px font-mono text-[10px] font-medium uppercase tracking-wider text-ink-400 dark:border-ink-100/12">
                {colorLabel}
              </span>
            </p>
            <p className="truncate font-mono text-[11px] text-ink-400">
              {isBot ? `Lv ${level} · ${cfg.name} · ≈${cfg.elo} Elo` : "human · fair play"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="piece-glyph flex max-w-[150px] flex-wrap justify-end text-[15px] leading-none">
            {captures.map((k, i) => (
              <span key={i} className={captureGlyphClass}>
                {GLYPHS[k]}
              </span>
            ))}
          </span>
          {lead > 0 && (
            <span className="font-mono text-[12px] font-bold text-felt-500 dark:text-felt-300">+{lead}</span>
          )}
          <span
            className={`hidden min-w-[76px] items-center justify-end gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider sm:flex ${
              active ? "text-brass-700 dark:text-brass-300" : "text-transparent"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${active ? "animate-pulse-dot bg-brass-500" : ""}`} />
            {activeLabel}
          </span>
        </div>
      </div>
    );
  }

  /* ---------- render ---------- */

  return (
    <div
      id="game"
      className={`relative rounded-xl border border-ink-900/12 bg-paper-50/85 p-4 shadow-lift backdrop-blur-sm sm:p-5 dark:border-ink-100/12 dark:bg-ink-800/80 ${className}`}
    >
      {/* header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-400">
          <span className={`h-1.5 w-1.5 rounded-full ${outcome ? "bg-blunder" : inCheck ? "bg-blunder" : "bg-felt-400"} ${!outcome && (inCheck || phase === "playing") ? "animate-pulse-dot" : ""}`} />
          Play vs Computer
        </p>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-ink-900/12 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-500 dark:border-ink-100/12 dark:text-ink-300">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                engineKind === "stockfish" ? "bg-felt-400" : engineKind === "classic" ? "bg-brass-500" : "animate-pulse-dot bg-ink-400"
              }`}
            />
            {engineKind === "stockfish" ? "Stockfish" : engineKind === "classic" ? "Classic engine" : "Loading engine…"}
          </span>
          {inCheck && !outcome && (
            <span className="rounded-full border border-blunder/50 bg-blunder/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-blunder">
              Check
            </span>
          )}
        </div>
      </div>

      {/* opponent bar (top = opposite of human) */}
      <PlayerBar
        isBot
        active={phase === "playing" && (thinking || turn !== humanColor)}
        activeLabel={thinking ? "thinking" : "to move"}
        captures={humanColor === "w" ? capturedByBlack : capturedByWhite}
        captureGlyphClass={humanColor === "w" ? "piece-w" : "piece-b"}
        lead={humanColor === "w" ? -materialDiff : materialDiff}
        colorLabel={humanColor === "w" ? "Black" : "White"}
      />

      {/* board + eval bar */}
      <div className="mt-3 flex gap-2.5">
        <div className="relative hidden w-3 shrink-0 overflow-hidden rounded-full border border-ink-900/15 bg-ink-900 sm:block dark:border-ink-100/15">
          <div
            className="absolute left-0 w-full bg-paper-50 transition-all duration-1000 ease-out"
            style={
              flipped
                ? { top: 0, height: `${100 - whitePct}%` }
                : { bottom: 0, height: `${whitePct}%` }
            }
          />
          <div className="absolute left-1/2 top-1/2 h-px w-full -translate-x-1/2 bg-ink-100/20" />
        </div>

        <div className="relative min-w-0 flex-1">
          <div
            className={`overflow-hidden rounded-lg border-2 transition-colors duration-500 ${
              isHumanTurn
                ? "border-brass-500/70 shadow-[0_0_0_4px_rgb(207_159_61/0.12)]"
                : "border-ink-900/15 dark:border-ink-100/15"
            }`}
          >
            <ChessBoard
              pieces={boardPieces}
              coords
              flipped={flipped}
              interactive={isHumanTurn}
              onSquareClick={onSquareClick}
              selected={selected}
              targets={targets}
              checkSquare={checkSquare}
              lastMove={
                lastMv
                  ? { from: coordsOf(lastMv.from), to: coordsOf(lastMv.to) }
                  : null
              }
            />
          </div>

          {/* setup overlay */}
          {setupOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-ink-950/75 p-4 backdrop-blur-[3px]">
              <div className="animate-rise w-full max-w-sm rounded-xl border border-ink-100/15 bg-ink-900 p-5 shadow-lift">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brass-500 text-ink-950">
                    <RobotIcon className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="font-display text-lg font-bold leading-tight text-ink-100">New game</p>
                    <p className="font-mono text-[11px] text-ink-400">vs Coding Boy</p>
                  </div>
                </div>

                <p className="mt-5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-400">
                  Play as
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(
                    [
                      { key: "w", label: "White", glyph: <span className="piece-glyph piece-w text-lg">{GLYPHS.P}</span> },
                      { key: "b", label: "Black", glyph: <span className="piece-glyph piece-b text-lg">{GLYPHS.P}</span> },
                      { key: "random", label: "Random", glyph: <DiceIcon className="h-4.5 w-4.5" /> },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setSetupSide(opt.key)}
                      className={`flex h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border text-[13px] font-semibold transition-all duration-200 ${
                        setupSide === opt.key
                          ? "border-brass-500 bg-brass-500/15 text-brass-300"
                          : "border-ink-100/15 text-ink-300 hover:border-ink-100/35"
                      }`}
                    >
                      {opt.glyph}
                      {opt.label}
                    </button>
                  ))}
                </div>

                <p className="mt-4 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-400">
                  Difficulty
                </p>
                <div className="mt-2 rounded-lg border border-ink-100/15 p-3.5">
                  <div className="flex items-end justify-between">
                    <p className="font-display text-xl font-bold leading-none text-ink-100">
                      {LEVELS[setupLevel - 1].name}
                    </p>
                    <p className="font-mono text-[11px] text-brass-300">≈ {LEVELS[setupLevel - 1].elo} Elo</p>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={setupLevel}
                    onChange={(e) => setSetupLevel(Number(e.target.value))}
                    aria-label="Difficulty level"
                    className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-100/15 accent-brass-500"
                  />
                  <div className="mt-1.5 flex justify-between font-mono text-[9px] uppercase tracking-wider text-ink-500">
                    <span>Beginner</span>
                    <span>≈ 2000</span>
                  </div>
                </div>

                <div className="mt-4 flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSetupOpen(false)}
                    className="h-11 flex-1 cursor-pointer rounded-lg border border-ink-100/20 text-sm font-semibold text-ink-300 transition-colors hover:border-ink-100/40"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => startGame(setupSide, setupLevel)}
                    className="h-11 flex-1 cursor-pointer rounded-lg bg-brass-500 text-sm font-bold text-ink-950 transition-all duration-300 hover:-translate-y-[2px] hover:bg-brass-400"
                  >
                    Start game
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* game-over overlay */}
          {outcome && !setupOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-ink-950/75 p-4 backdrop-blur-[3px]">
              <div className="animate-rise w-full max-w-xs rounded-xl border border-ink-100/15 bg-ink-900 p-6 text-center shadow-lift">
                <p className="font-mono text-[11px] font-semibold tracking-[0.24em] text-ink-400">{scoreText}</p>
                <div className="mt-3 flex justify-center">
                  {outcome.winner === "human" ? (
                    <span className="piece-glyph piece-w text-6xl">{GLYPHS.Q}</span>
                  ) : outcome.winner === "bot" ? (
                    <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-brass-500 text-ink-950">
                      <RobotIcon className="h-8 w-8" />
                    </span>
                  ) : (
                    <span className="font-display text-5xl font-bold text-ink-300">½</span>
                  )}
                </div>
                <p className="mt-3 font-display text-2xl font-bold text-ink-100">
                  {outcome.winner === "human" ? "You win!" : outcome.winner === "bot" ? "Coding Boy wins" : "Drawn game"}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink-400">
                  {outcome.title} — {outcome.sub}
                </p>
                <div className="mt-5 flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSetupOpen(true)}
                    className="h-11 flex-1 cursor-pointer rounded-lg border border-ink-100/20 text-sm font-semibold text-ink-300 transition-colors hover:border-ink-100/40"
                  >
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => startGame(humanColor, level)}
                    className="h-11 flex-1 cursor-pointer rounded-lg bg-brass-500 text-sm font-bold text-ink-950 transition-all duration-300 hover:-translate-y-[2px] hover:bg-brass-400"
                  >
                    Rematch
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* promotion picker */}
          {pendingPromo && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center rounded-lg bg-ink-950/70 p-4 backdrop-blur-[2px]">
              <div className="animate-rise rounded-xl border border-ink-100/15 bg-ink-900 p-4 shadow-lift">
                <p className="text-center font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-400">
                  Promote to
                </p>
                <div className="mt-3 flex gap-2">
                  {(["Q", "R", "B", "N"] as Kind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => playHumanMove(pendingPromo.from, pendingPromo.to, k.toLowerCase())}
                      className="flex h-16 w-14 cursor-pointer items-center justify-center rounded-lg border border-ink-100/15 bg-ink-800 transition-all duration-200 hover:-translate-y-1 hover:border-brass-500"
                    >
                      <span className={`piece-glyph text-4xl ${humanColor === "w" ? "piece-w" : "piece-b"}`}>
                        {GLYPHS[k]}
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPendingPromo(null);
                    setSelected(null);
                  }}
                  className="mt-3 w-full cursor-pointer text-center font-mono text-[11px] uppercase tracking-wider text-ink-400 transition-colors hover:text-ink-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* human bar */}
      <div className="mt-3">
        <PlayerBar
          isBot={false}
          active={isHumanTurn}
          activeLabel={inCheck ? "in check" : "your move"}
          captures={humanColor === "w" ? capturedByWhite : capturedByBlack}
          captureGlyphClass={humanColor === "w" ? "piece-b" : "piece-w"}
          lead={humanColor === "w" ? materialDiff : -materialDiff}
          colorLabel={humanTurnLabel}
        />
      </div>

      {/* status + controls */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p
          className={`flex min-w-0 items-center gap-2 font-mono text-[12px] font-semibold ${
            inCheck && !outcome ? "text-blunder" : thinking ? "text-brass-700 dark:text-brass-300" : "text-ink-500 dark:text-ink-300"
          }`}
          aria-live="polite"
        >
          {statusBar === "thinking" ? (
            <>
              Coding Boy is thinking
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="animate-blink h-1.5 w-1.5 rounded-full bg-brass-500"
                    style={{ animationDelay: `${i * 0.18}s` }}
                  />
                ))}
              </span>
            </>
          ) : (
            statusBar
          )}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSetupOpen(true)}
            className="flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-ink-900 px-4 text-[13px] font-bold text-paper-50 transition-all duration-300 hover:-translate-y-[2px] hover:bg-ink-700 dark:bg-ink-100 dark:text-ink-950 dark:hover:bg-paper-200"
          >
            <RefreshIcon className="h-4 w-4" />
            New Game
          </button>
          <button
            type="button"
            onClick={undoMove}
            disabled={!canUndo}
            className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-ink-900/15 px-3.5 text-[13px] font-semibold text-ink-700 transition-all duration-200 enabled:hover:border-brass-600 enabled:hover:text-brass-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-ink-100/15 dark:text-ink-200 dark:enabled:hover:border-brass-400 dark:enabled:hover:text-brass-300"
          >
            <UndoIcon className="h-4 w-4" />
            Undo
          </button>
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            aria-label="Flip board"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-ink-900/15 text-ink-700 transition-all duration-200 hover:rotate-180 hover:border-brass-600 hover:text-brass-700 dark:border-ink-100/15 dark:text-ink-200 dark:hover:border-brass-400 dark:hover:text-brass-300"
          >
            <FlipIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={resign}
            disabled={phase !== "playing"}
            className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-blunder/40 px-3.5 text-[13px] font-semibold text-blunder transition-all duration-200 enabled:hover:bg-blunder/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FlagIcon className="h-4 w-4" />
            Resign
          </button>
        </div>
      </div>

      {/* move list */}
      <div className="mt-3.5 rounded-lg border border-ink-900/10 bg-paper-100/70 p-3.5 dark:border-ink-100/10 dark:bg-ink-900/60">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-400">Moves</p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-400">
            {history.length} {history.length === 1 ? "ply" : "plies"}
          </p>
        </div>
        <div ref={movesRef} className="no-scrollbar mt-2 grid max-h-[108px] grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1 overflow-y-auto font-mono text-[13px]">
          {history.length === 0 && (
            <p className="col-span-3 text-[12px] italic text-ink-400">
              {isHumanTurn ? "The board is yours — make the first move." : "Coding Boy will open the game…"}
            </p>
          )}
          {Array.from({ length: Math.ceil(history.length / 2) }, (_, i) => {
            const w = history[i * 2];
            const bMv = history[i * 2 + 1];
            return (
              <div key={i} className="contents">
                <span className="text-ink-400 dark:text-ink-500">{i + 1}.</span>
                <span
                  className={`rounded px-1.5 transition-colors ${
                    history.length - 1 === i * 2
                      ? "bg-brass-500/15 font-bold text-brass-700 dark:text-brass-300"
                      : "text-ink-800 dark:text-ink-200"
                  }`}
                >
                  {w.san}
                </span>
                <span
                  className={`rounded px-1.5 transition-colors ${
                    history.length - 1 === i * 2 + 1
                      ? "bg-brass-500/15 font-bold text-brass-700 dark:text-brass-300"
                      : "text-ink-800 dark:text-ink-200"
                  }`}
                >
                  {bMv?.san ?? ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
