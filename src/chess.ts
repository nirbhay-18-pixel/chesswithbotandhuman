export type Side = "w" | "b";
export type Kind = "K" | "Q" | "R" | "B" | "N" | "P";

export interface Piece {
  id: string;
  side: Side;
  kind: Kind;
  col: number; // 0 = a-file … 7 = h-file
  row: number; // 0 = rank 8 (top) … 7 = rank 1 (bottom)
}

/** Filled glyphs are used for both sides so silhouettes render identically everywhere. */
export const GLYPHS: Record<Kind, string> = {
  K: "\u265A",
  Q: "\u265B",
  R: "\u265C",
  B: "\u265D",
  N: "\u265E",
  P: "\u265F",
};

export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

/** "e4" -> [4, 4] */
export function sq(name: string): [number, number] {
  const col = name.charCodeAt(0) - 97;
  const row = 8 - parseInt(name[1], 10);
  return [col, row];
}

export function squareName(col: number, row: number): string {
  return `${FILES[col]}${8 - row}`;
}

export function initialPieces(): Piece[] {
  const pieces: Piece[] = [];
  const back: Kind[] = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  back.forEach((kind, col) => {
    pieces.push({ id: `b${kind}${col}`, side: "b", kind, col, row: 0 });
    pieces.push({ id: `w${kind}${col}`, side: "w", kind, col, row: 7 });
  });
  for (let col = 0; col < 8; col++) {
    pieces.push({ id: `bP${col}`, side: "b", kind: "P", col, row: 1 });
    pieces.push({ id: `wP${col}`, side: "w", kind: "P", col, row: 6 });
  }
  return pieces;
}

export interface ScriptMove {
  from: [number, number];
  to: [number, number];
  /** SAN notation for the move list */
  san: string;
  /** evaluation in pawns, from White's point of view */
  evalCp: number;
}

const m = (from: string, to: string, san: string, evalCp: number): ScriptMove => ({
  from: sq(from),
  to: sq(to),
  san,
  evalCp,
});

/** The Italian Game, played out move by move in the hero board. */
export const OPENING_SCRIPT: ScriptMove[] = [
  m("e2", "e4", "e4", 0.25),
  m("e7", "e5", "e5", 0.2),
  m("g1", "f3", "Nf3", 0.3),
  m("b8", "c6", "Nc6", 0.25),
  m("f1", "c4", "Bc4", 0.35),
  m("f8", "c5", "Bc5", 0.3),
  m("c2", "c3", "c3", 0.3),
  m("g8", "f6", "Nf6", 0.4),
  m("d2", "d4", "d4", 0.55),
  m("e5", "d4", "exd4", 0.45),
  m("c3", "d4", "cxd4", 0.5),
  m("c5", "b4", "Bb4+", 0.6),
  m("b1", "c3", "Nc3", 0.65),
  m("d7", "d6", "d6", 0.6),
];

export function evalToWhitePct(evalCp: number): number {
  return Math.round(Math.min(88, Math.max(12, 50 + evalCp * 24)));
}

/* ---------------- puzzle positions (mate in 1) ---------------- */

export interface Puzzle {
  id: string;
  title: string;
  pieces: Piece[];
  solution: { from: [number, number]; to: [number, number]; san: string };
  ratingDelta: number;
}

const p = (id: string, side: Side, kind: Kind, square: string): Piece => {
  const [col, row] = sq(square);
  return { id, side, kind, col, row };
};

export const PUZZLES: Puzzle[] = [
  {
    id: "scholar",
    title: "Queen & bishop battery",
    pieces: [
      p("bk", "b", "K", "e8"),
      p("br1", "b", "R", "a8"),
      p("br2", "b", "R", "h8"),
      p("bp1", "b", "P", "f7"),
      p("bp2", "b", "P", "g7"),
      p("bp3", "b", "P", "h7"),
      p("bp4", "b", "P", "d7"),
      p("wq", "w", "Q", "h5"),
      p("wb", "w", "B", "c4"),
      p("wk", "w", "K", "g1"),
      p("wp1", "w", "P", "f2"),
      p("wp2", "w", "P", "g2"),
      p("wp3", "w", "P", "h2"),
    ],
    solution: { from: sq("h5"), to: sq("f7"), san: "Qxf7#" },
    ratingDelta: 96,
  },
  {
    id: "backrank",
    title: "Back-rank finish",
    pieces: [
      p("bk", "b", "K", "e8"),
      p("bn", "b", "N", "b8"),
      p("bp1", "b", "P", "d7"),
      p("bp2", "b", "P", "e7"),
      p("bp3", "b", "P", "f7"),
      p("wr", "w", "R", "a1"),
      p("wk", "w", "K", "g1"),
      p("wp1", "w", "P", "f2"),
      p("wp2", "w", "P", "g2"),
      p("wp3", "w", "P", "h2"),
    ],
    solution: { from: sq("a1"), to: sq("a8"), san: "Ra8#" },
    ratingDelta: 84,
  },
];

/* ---------------- computer difficulty ---------------- */

export const ENGINE_LEVELS = [
  "Pawn",
  "Squire",
  "Knight",
  "Rook",
  "Bishop",
  "Queen",
  "Candidate",
  "Master",
  "Grandmaster",
  "Nightmare",
] as const;
