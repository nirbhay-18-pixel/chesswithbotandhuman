import type { Piece } from "../chess";
import { FILES, GLYPHS } from "../chess";

export interface Square {
  col: number;
  row: number;
}

interface ChessBoardProps {
  pieces: Piece[];
  lastMove?: { from: Square; to: Square } | null;
  highlights?: Square[];
  arrow?: { from: Square; to: Square } | null;
  coords?: boolean;
  fading?: Set<string>;
  className?: string;
  frameClassName?: string;
}

const LIGHT_SQUARE = "#e9e1cb";
const DARK_SQUARE = "#47604e";

export function ChessBoard({
  pieces,
  lastMove = null,
  highlights = [],
  arrow = null,
  coords = false,
  fading,
  className = "",
  frameClassName = "",
}: ChessBoardProps) {
  const isLastMove = (col: number, row: number) =>
    lastMove !== null &&
    ((lastMove.from.col === col && lastMove.from.row === row) ||
      (lastMove.to.col === col && lastMove.to.row === row));

  const isHighlighted = (col: number, row: number) =>
    highlights.some((h) => h.col === col && h.row === row);

  return (
    <div
      className={`relative aspect-square w-full select-none overflow-hidden [container-type:inline-size] ${frameClassName} ${className}`}
      role="img"
      aria-label="Chessboard"
    >
      {/* squares */}
      <div className="absolute inset-0 grid grid-cols-8 grid-rows-8">
        {Array.from({ length: 64 }, (_, i) => {
          const col = i % 8;
          const row = Math.floor(i / 8);
          const light = (col + row) % 2 === 0;
          return (
            <div
              key={i}
              className="relative"
              style={{ backgroundColor: light ? LIGHT_SQUARE : DARK_SQUARE }}
            >
              {isLastMove(col, row) && (
                <div className="absolute inset-0 bg-brass-400/45" />
              )}
              {isHighlighted(col, row) && (
                <div className="absolute inset-0 border-[3px] border-brass-400 bg-brass-400/20" />
              )}
              {coords && col === 0 && (
                <span
                  className="absolute left-[6%] top-[4%] font-mono text-[1.55cqw] font-bold"
                  style={{ color: light ? DARK_SQUARE : LIGHT_SQUARE }}
                >
                  {8 - row}
                </span>
              )}
              {coords && row === 7 && (
                <span
                  className="absolute bottom-[3%] right-[6%] font-mono text-[1.55cqw] font-bold"
                  style={{ color: light ? DARK_SQUARE : LIGHT_SQUARE }}
                >
                  {FILES[col]}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* pieces */}
      <div className="absolute inset-0">
        {pieces.map((piece) => {
          const gone = fading?.has(piece.id) ?? false;
          return (
            <div
              key={piece.id}
              className={`piece-move absolute left-0 top-0 flex h-[12.5%] w-[12.5%] items-center justify-center ${
                gone ? "z-10 scale-[0.55] opacity-0" : "z-20"
              }`}
              style={{
                transform: `translate(${piece.col * 100}%, ${piece.row * 100}%)${gone ? " scale(0.55)" : ""}`,
              }}
            >
              <span
                className={`piece-glyph ${piece.side === "w" ? "piece-w" : "piece-b"}`}
                style={{ fontSize: "10.4cqw" }}
              >
                {GLYPHS[piece.kind]}
              </span>
            </div>
          );
        })}
      </div>

      {/* arrow overlay */}
      {arrow && (
        <svg className="absolute inset-0 z-30 h-full w-full" viewBox="0 0 8 8" aria-hidden="true">
          <defs>
            <marker
              id="cm-arrowhead"
              markerWidth="5"
              markerHeight="5"
              refX="3.2"
              refY="2.5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L5,2.5 L0,5 Z" fill="var(--color-brass-400)" />
            </marker>
          </defs>
          <line
            x1={arrow.from.col + 0.5}
            y1={arrow.from.row + 0.5}
            x2={arrow.to.col + 0.5}
            y2={arrow.to.row + 0.5}
            stroke="var(--color-brass-400)"
            strokeWidth="0.16"
            strokeLinecap="round"
            opacity="0.9"
            markerEnd="url(#cm-arrowhead)"
          />
          <circle
            cx={arrow.from.col + 0.5}
            cy={arrow.from.row + 0.5}
            r="0.14"
            fill="var(--color-brass-400)"
            opacity="0.9"
          />
        </svg>
      )}
    </div>
  );
}
