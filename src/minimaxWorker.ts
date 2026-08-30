import { searchPosition } from "./minimax";

/** Dedicated worker so the classic engine never blocks the UI thread. */

interface Request {
  id: number;
  fen: string;
  maxDepth: number;
  timeMs: number;
  topK: number;
}

self.onmessage = (event: MessageEvent<Request>) => {
  const { id, fen, maxDepth, timeMs, topK } = event.data;
  try {
    const result = searchPosition(fen, maxDepth, timeMs, topK);
    (self as unknown as Worker).postMessage({ id, ok: true, ...result });
  } catch (error) {
    (self as unknown as Worker).postMessage({ id, ok: false, error: String(error) });
  }
};
