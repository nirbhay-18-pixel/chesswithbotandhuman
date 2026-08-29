import { Chess, type Move } from "chess.js";

/**
 * ChessMaster Classic — the built-in fallback engine.
 * Negamax + alpha-beta + quiescence search over chess.js legal moves,
 * with piece-square tables and MVV-LVA move ordering.
 */

const VALUE: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

/* prettier-ignore */
const PST: Record<string, number[]> = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  n: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  b: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0,
  ],
  q: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  k: [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20,
  ],
};

class Abort extends Error {}

interface SearchCtx {
  deadline: number;
  nodes: number;
}

/** Static evaluation from White's point of view (centipawns). */
function evaluateWhite(game: Chess): number {
  let score = 0;
  const board = game.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (!piece) continue;
      const idx = piece.color === "w" ? r * 8 + f : (7 - r) * 8 + f;
      score += (piece.color === "w" ? 1 : -1) * (VALUE[piece.type] + PST[piece.type][idx]);
    }
  }
  return score;
}

function orderMoves(moves: Move[]): Move[] {
  return moves.sort((a, b) => scoreMove(b) - scoreMove(a));
}

function scoreMove(m: Move): number {
  let s = 0;
  if (m.captured) s += 10 * VALUE[m.captured] - VALUE[m.piece];
  if (m.promotion) s += VALUE[m.promotion];
  if (m.san.includes("+")) s += 40;
  return s;
}

function checkTime(ctx: SearchCtx) {
  ctx.nodes++;
  if ((ctx.nodes & 511) === 0 && performance.now() > ctx.deadline) throw new Abort();
}

function quiescence(game: Chess, alpha: number, beta: number, ctx: SearchCtx, qply: number): number {
  checkTime(ctx);
  const stand = game.turn() === "w" ? evaluateWhite(game) : -evaluateWhite(game);
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;
  if (qply >= 6) return alpha;

  const captures = orderMoves(
    game.moves({ verbose: true }).filter((m) => m.captured || m.promotion),
  );
  for (const move of captures) {
    game.move(move.san);
    const score = -quiescence(game, -beta, -alpha, ctx, qply + 1);
    game.undo();
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function negamax(game: Chess, depth: number, alpha: number, beta: number, ply: number, ctx: SearchCtx): number {
  checkTime(ctx);
  if (game.isCheckmate()) return -(100000 - ply);
  if (game.isStalemate() || game.isDraw()) return 0;
  if (depth <= 0) return quiescence(game, alpha, beta, ctx, 0);

  const moves = orderMoves(game.moves({ verbose: true }));
  let best = -Infinity;
  for (const move of moves) {
    game.move(move.san);
    const score = -negamax(game, depth - 1, -beta, -alpha, ply + 1, ctx);
    game.undo();
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

export interface ClassicResult {
  uci: string;
  /** evaluation in centipawns from White's point of view */
  evalCp: number;
  depth: number;
}

/**
 * Root search with iterative deepening and a hard time budget.
 * `topK` > 1 makes weaker levels occasionally pick a near-best move.
 */
export function searchPosition(
  fen: string,
  maxDepth: number,
  timeMs: number,
  topK: number,
): ClassicResult {
  const game = new Chess(fen);
  const ctx: SearchCtx = { deadline: performance.now() + timeMs, nodes: 0 };
  const rootMoves = orderMoves(game.moves({ verbose: true }));
  if (rootMoves.length === 0) throw new Error("no legal moves");

  let best: { move: Move; score: number } = { move: rootMoves[0], score: -Infinity };
  let ranked: { move: Move; score: number }[] = [{ move: rootMoves[0], score: 0 }];
  let completedDepth = 0;

  for (let depth = 1; depth <= maxDepth; depth++) {
    const scored: { move: Move; score: number }[] = [];
    let alpha = -Infinity;
    try {
      for (const move of rootMoves) {
        game.move(move.san);
        const score = -negamax(game, depth - 1, -Infinity, -alpha, 1, ctx);
        game.undo();
        scored.push({ move, score });
        if (score > alpha) alpha = score;
        if (performance.now() > ctx.deadline) throw new Abort();
      }
    } catch (e) {
      if (!(e instanceof Abort)) throw e;
      // time expired mid-depth: keep the previous complete depth
      break;
    }
    scored.sort((a, b) => b.score - a.score);
    ranked = scored;
    best = scored[0];
    completedDepth = depth;
  }

  // weak levels: choose among the top-K near-equal moves
  let pick = best;
  if (topK > 1 && ranked.length > 1) {
    const candidates = ranked.filter((s) => s.score >= best.score - 60).slice(0, topK);
    pick = candidates[Math.floor(Math.random() * candidates.length)];
  }

  const turn = new Chess(fen).turn();
  const evalCp = Math.max(-900, Math.min(900, turn === "w" ? pick.score : -pick.score));

  return {
    uci: pick.move.from + pick.move.to + (pick.move.promotion ?? ""),
    evalCp,
    depth: completedDepth,
  };
}
