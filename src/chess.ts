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

/* ---------------- shared helpers ---------------- */

/** "e4" -> { col: 4, row: 4 } for board rendering */
export function squareToCoords(name: string): { col: number; row: number } {
  const [col, row] = sq(name);
  return { col, row };
}

export const KIND_VALUE: Record<Kind, number> = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };

/** display order for captured-piece trays (most valuable first) */
export const KIND_ORDER: Kind[] = ["Q", "R", "B", "N", "P"];

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
