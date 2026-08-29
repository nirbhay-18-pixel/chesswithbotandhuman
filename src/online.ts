import Peer from "peerjs";
import type { DataConnection } from "peerjs";

/**
 * ChessMaster online play — REAL peer-to-peer multiplayer.
 *
 * Architecture (serverless-friendly, works on Vercel/static hosting):
 *  - PeerJS provides signalling via its free cloud broker and opens a
 *    WebRTC data channel between the two browsers.
 *  - The room code maps to a deterministic host peer id (`cm1-XXXXXX`).
 *    The creator registers that id; the joiner connects straight to it.
 *  - All moves / resignations / draws / rematches are plain JSON messages
 *    over the data channel, so both boards stay in sync in real time.
 *  - No ChessMaster backend exists or is required.
 */

export interface PeerInfo {
  name: string;
  rating: number;
}

export interface StartInfo {
  whiteName: string;
  blackName: string;
  whiteRating: number;
  blackRating: number;
}

export interface OnlineHandlers {
  onPeerInfo: (info: PeerInfo) => void;
  onStart: (info: StartInfo) => void;
  onMove: (uci: string) => void;
  onSync: (sans: string[]) => void;
  onSyncRequest: () => void;
  onResign: () => void;
  onDrawOffer: () => void;
  onDrawAccept: () => void;
  onDrawDecline: () => void;
  onRematchRequest: () => void;
  onRematchAccept: () => void;
  onPeerJoin: () => void;
  onPeerLeave: () => void;
  /** signalling / connection problem that may be recoverable */
  onStatus?: (status: string) => void;
}

export interface OnlineRoom {
  code: string;
  isHost: boolean;
  sendStart: (info: StartInfo) => void;
  sendMove: (uci: string) => void;
  sendSync: (sans: string[]) => void;
  requestSync: () => void;
  sendResign: () => void;
  sendDrawOffer: () => void;
  sendDrawAccept: () => void;
  sendDrawDecline: () => void;
  sendRematchRequest: () => void;
  sendRematchAccept: () => void;
  /** host keeps the room open so the guest can rejoin after a drop */
  leave: () => void;
}

type Msg =
  | { t: "hello"; info: PeerInfo }
  | { t: "start"; info: StartInfo }
  | { t: "move"; uci: string }
  | { t: "sync"; sans: string[] }
  | { t: "syncreq" }
  | { t: "resign" }
  | { t: "drawoffer" }
  | { t: "drawaccept" }
  | { t: "drawdecline" }
  | { t: "rematchreq" }
  | { t: "rematchok" };

const APP_PREFIX = "cm1-";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(length = 6): string {
  let code = "";
  const values = crypto.getRandomValues(new Uint32Array(length));
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[values[i] % CODE_ALPHABET.length];
  }
  return code;
}

export function normalizeRoomCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function hostPeerId(code: string): string {
  return `${APP_PREFIX}${normalizeRoomCode(code)}`;
}

/** Wire a live data connection to the handler callbacks + send helpers. */
function bindConnection(
  code: string,
  isHost: boolean,
  self: PeerInfo,
  getConn: () => DataConnection | null,
  handlers: OnlineHandlers,
): OnlineRoom {
  const send = (msg: Msg) => {
    const conn = getConn();
    if (conn && conn.open) {
      try {
        conn.send(msg);
      } catch {
        /* connection torn mid-send — peer leave will fire */
      }
    }
  };

  return {
    code: normalizeRoomCode(code),
    isHost,
    sendStart: (info) => send({ t: "start", info }),
    sendMove: (uci) => send({ t: "move", uci }),
    sendSync: (sans) => send({ t: "sync", sans }),
    requestSync: () => send({ t: "syncreq" }),
    sendResign: () => send({ t: "resign" }),
    sendDrawOffer: () => send({ t: "drawoffer" }),
    sendDrawAccept: () => send({ t: "drawaccept" }),
    sendDrawDecline: () => send({ t: "drawdecline" }),
    sendRematchRequest: () => send({ t: "rematchreq" }),
    sendRematchAccept: () => send({ t: "rematchok" }),
    // overridden below
    leave: () => {},
  };
}

function handleMsg(msg: Msg, handlers: OnlineHandlers) {
  switch (msg.t) {
    case "hello":
      handlers.onPeerInfo(msg.info);
      handlers.onPeerJoin();
      break;
    case "start":
      handlers.onStart(msg.info);
      break;
    case "move":
      handlers.onMove(msg.uci);
      break;
    case "sync":
      handlers.onSync(msg.sans);
      break;
    case "syncreq":
      handlers.onSyncRequest();
      break;
    case "resign":
      handlers.onResign();
      break;
    case "drawoffer":
      handlers.onDrawOffer();
      break;
    case "drawaccept":
      handlers.onDrawAccept();
      break;
    case "drawdecline":
      handlers.onDrawDecline();
      break;
    case "rematchreq":
      handlers.onRematchRequest();
      break;
    case "rematchok":
      handlers.onRematchAccept();
      break;
  }
}

/* ---------------- host (creator) ---------------- */

export function hostOnlineRoom(
  code: string,
  self: PeerInfo,
  handlers: OnlineHandlers,
  onOpen: () => void,
  onUnavailable: () => void,
): OnlineRoom {
  const peer = new Peer(hostPeerId(code));
  let conn: DataConnection | null = null;
  const room = bindConnection(code, true, self, () => conn, handlers);

  const wire = (c: DataConnection) => {
    conn = c;
    c.on("open", () => {
      // introduce ourselves to the joiner
      c.send({ t: "hello", info: self } satisfies Msg);
      handlers.onPeerJoin();
    });
    c.on("data", (data) => handleMsg(data as Msg, handlers));
    c.on("close", () => handlers.onPeerLeave());
  };

  peer.on("open", () => onOpen());
  peer.on("connection", wire);
  peer.on("disconnected", () => {
    handlers.onStatus?.("Reconnecting to signalling server…");
    try {
      peer.reconnect();
    } catch {
      /* noop */
    }
  });
  peer.on("error", (err) => {
    const type = (err as { type?: string }).type;
    if (type === "unavailable-id") onUnavailable();
    else handlers.onStatus?.(`Connection issue (${type ?? "unknown"})`);
  });

  room.leave = () => {
    try {
      conn?.close();
    } catch {
      /* noop */
    }
    try {
      peer.destroy();
    } catch {
      /* noop */
    }
  };

  return room;
}

/* ---------------- guest (joiner) ---------------- */

export function joinOnlineRoom(
  code: string,
  self: PeerInfo,
  handlers: OnlineHandlers,
  onOpen: () => void,
  onError: (message: string) => void,
): OnlineRoom {
  const peer = new Peer();
  let conn: DataConnection | null = null;
  let settled = false;
  const room = bindConnection(code, false, self, () => conn, handlers);

  const wire = (c: DataConnection) => {
    conn = c;
    c.on("open", () => {
      // introduce ourselves to the host
      c.send({ t: "hello", info: self } satisfies Msg);
      if (!settled) {
        settled = true;
        onOpen();
      }
      handlers.onPeerJoin();
    });
    c.on("data", (data) => handleMsg(data as Msg, handlers));
    c.on("close", () => handlers.onPeerLeave());
  };

  peer.on("open", () => {
    const c = peer.connect(hostPeerId(code), { reliable: true });
    wire(c);
    // if the host never answers, surface a friendly error
    window.setTimeout(() => {
      if (!settled && !(conn && conn.open)) {
        settled = true;
        onError("No game found with that code. Double-check it with your friend.");
      }
    }, 9000);
  });
  peer.on("error", (err) => {
    const type = (err as { type?: string }).type;
    if (!settled) {
      settled = true;
      if (type === "peer-unavailable") {
        onError("No game found with that code. Double-check it with your friend.");
      } else {
        onError(`Could not connect (${type ?? "network"}). Try again.`);
      }
    } else {
      handlers.onStatus?.(`Connection issue (${type ?? "unknown"})`);
    }
  });

  room.leave = () => {
    try {
      conn?.close();
    } catch {
      /* noop */
    }
    try {
      peer.destroy();
    } catch {
      /* noop */
    }
  };

  return room;
}
