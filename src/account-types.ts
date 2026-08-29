/** Shared account/game-history types (no runtime code — safe to import anywhere). */

export type Mode = "bot" | "friend" | "online";
export type ResultKind = "win" | "loss" | "draw";

export interface GameRecord {
  id: string;
  mode: Mode;
  /** epoch ms */
  date: number;
  myColor: "w" | "b";
  myName: string;
  opponent: string;
  botRating?: number;
  result: ResultKind;
  score: string;
  /** full game in SAN — replayed with chess.js */
  sans: string[];
  ratingBefore?: number;
  ratingAfter?: number;
}

export interface PlayerStats {
  rating: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  perMode: Record<Mode, { games: number; wins: number; losses: number; draws: number }>;
}
