import { useCallback, useRef, useState } from "react";
import { applyRatingChange, saveGame, type GameRecord } from "../account";
import { CheckIcon } from "../components/icons";
import { useToast } from "../components/ui";

/**
 * Reliable persistence pipeline for finished games.
 *
 * Guarantees:
 *  - The UI never claims "saved" until the database write has succeeded.
 *  - Every write is idempotent: rating updates use an atomic GREATEST-based
 *    server function (peak only moves upward) and game rows upsert on their
 *    stable id — so retries can never create duplicates or corrupt data.
 *  - On failure the exact failed stage (rating vs game record) is surfaced
 *    and retry resumes from there.
 */

export type PersistPhase = "idle" | "saving" | "saved" | "failed";
export type PersistStage = "rating" | "game";

export interface PersistArgs {
  userId: string;
  record: GameRecord;
  /** when set, the profile rating is updated before the game is stored */
  newRating?: number;
}

export function usePersistGame() {
  const { push } = useToast();
  const [phase, setPhase] = useState<PersistPhase>("idle");
  const [stage, setStage] = useState<PersistStage>("game");
  const argsRef = useRef<PersistArgs | null>(null);
  const ratingDoneRef = useRef(false);
  const runningRef = useRef(false);

  const run = useCallback(async () => {
    const args = argsRef.current;
    if (!args || runningRef.current) return;
    runningRef.current = true;
    setPhase("saving");
    let failedStage: PersistStage = "game";
    try {
      if (args.newRating != null && !ratingDoneRef.current) {
        failedStage = "rating";
        await applyRatingChange(args.userId, args.newRating);
        ratingDoneRef.current = true;
      }
      failedStage = "game";
      await saveGame(args.userId, args.record);
      setStage("game");
      setPhase("saved");
    } catch {
      setStage(failedStage);
      setPhase("failed");
      push(
        failedStage === "rating"
          ? "Rating update failed — nothing was saved yet. Retry from the result screen."
          : "Couldn't save the game — check your connection and retry.",
      );
    } finally {
      runningRef.current = false;
    }
  }, [push]);

  const persist = useCallback(
    (args: PersistArgs) => {
      argsRef.current = args;
      ratingDoneRef.current = false;
      void run();
    },
    [run],
  );

  /** retry resumes from the failed stage; idempotent by design */
  const retry = useCallback(() => void run(), [run]);

  const reset = useCallback(() => {
    argsRef.current = null;
    ratingDoneRef.current = false;
    runningRef.current = false;
    setPhase("idle");
    setStage("game");
  }, []);

  return { phase, stage, persist, retry, reset };
}

/* ---------------- status badge (dark result overlays) ---------------- */

export function PersistBadge({
  phase,
  stage,
  onRetry,
}: {
  phase: PersistPhase;
  stage: PersistStage;
  onRetry: () => void;
}) {
  if (phase === "idle") return null;

  if (phase === "saving") {
    return (
      <p className="inline-flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-brass-300">
        <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-brass-400" />
        Saving {stage === "rating" ? "rating" : "game"}…
      </p>
    );
  }

  if (phase === "saved") {
    return (
      <p className="inline-flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-felt-300">
        <span className="flex h-4.5 w-4.5 items-center justify-center rounded-sm bg-felt-500/25">
          <CheckIcon className="h-3 w-3" />
        </span>
        Saved to your history
      </p>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
      <p className="inline-flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e08a80]">
        <span className="h-1.5 w-1.5 rounded-full bg-blunder" />
        Save failed · {stage === "rating" ? "rating update" : "game record"}
      </p>
      <button
        onClick={onRetry}
        className="inline-flex h-8 cursor-pointer items-center rounded-md border border-brass-400/60 px-3.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-brass-300 transition-all duration-200 hover:-translate-y-[1px] hover:bg-brass-500/15"
      >
        Retry save
      </button>
    </span>
  );
}
