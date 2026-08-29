import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  applyRatingChange,
  eloDelta,
  makeGameId,
  saveGame,
  type GameRecord,
} from "../account";
import { useAuth } from "../auth/AuthContext";
import type { Side } from "../chess";
import { MatchRoom, type GameOverInfo, type MatchHandle, type PlayerInfo } from "../game/MatchRoom";
import {
  generateRoomCode,
  joinOnlineRoom,
  hostOnlineRoom,
  normalizeRoomCode,
  type OnlineRoom,
  type PeerInfo,
  type StartInfo,
} from "../online";
import { ArrowRightIcon, GlobeIcon, UsersIcon } from "../components/icons";
import { useFullscreen } from "../hooks";

type Phase = "gate" | "lobby" | "waiting" | "connecting" | "game";
type ColorChoice = "w" | "b" | "random";

function scoreOf(info: GameOverInfo): string {
  if (!info.winner) return "½–½";
  return info.winner === "w" ? "1–0" : "0–1";
}

export function OnlinePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { isFullscreen: isFs } = useFullscreen();
  const { user, ready, refresh, setUser } = useAuth();

  const [phase, setPhase] = useState<Phase>("lobby");

  const [colorChoice, setColorChoice] = useState<ColorChoice>("w");
  const [joinCode, setJoinCode] = useState(params.get("code") ?? "");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [role, setRole] = useState<"host" | "guest">("host");
  const [copied, setCopied] = useState(false);

  const [startInfo, setStartInfo] = useState<StartInfo | null>(null);
  const [connState, setConnState] = useState<"connected" | "disconnected">("connected");
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [drawOffer, setDrawOffer] = useState<"none" | "sent" | "received">("none");
  const [rematch, setRematch] = useState<"idle" | "sent" | "received">("idle");
  const [ratingDelta, setRatingDelta] = useState<number | null>(null);
  const [savedRecord, setSavedRecord] = useState<GameRecord | null>(null);

  const roomRef = useRef<OnlineRoom | null>(null);
  const matchRef = useRef<MatchHandle>(null);
  const peerRef = useRef<PeerInfo | null>(null);
  const myColorRef = useRef<Side>("w");
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  const rematchRef = useRef(rematch);
  rematchRef.current = rematch;
  const startRef = useRef<StartInfo | null>(null);
  const roleRef = useRef<"host" | "guest">("host");
  const colorChoiceRef = useRef<ColorChoice>(colorChoice);
  colorChoiceRef.current = colorChoice;
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => () => roomRef.current?.leave(), []);

  const self = (): PeerInfo => ({
    name: userRef.current?.username ?? "Guest",
    rating: userRef.current?.rating ?? 1200,
  });

  /* ----- connection handlers ----- */

  const handlers = {
    onPeerInfo: (info: PeerInfo) => {
      peerRef.current = info;
      if (roleRef.current === "host" && phaseRef.current === "waiting") {
        // opponent arrived — kick off the game with colours
        const choice = colorChoiceRef.current;
        const hostColor: Side = choice === "random" ? (Math.random() < 0.5 ? "w" : "b") : choice;
        const me = self();
        const start: StartInfo =
          hostColor === "w"
            ? { whiteName: me.name, blackName: info.name, whiteRating: me.rating, blackRating: info.rating }
            : { whiteName: info.name, blackName: me.name, whiteRating: info.rating, blackRating: me.rating };
        myColorRef.current = hostColor;
        startRef.current = start;
        setStartInfo(start);
        roomRef.current?.sendStart(start);
        setPhase("game");
      }
    },
    onStart: (info: StartInfo) => {
      startRef.current = info;
      setStartInfo(info);
      const me = self();
      myColorRef.current = info.whiteName === me.name ? "w" : "b";
      setPhase("game");
      // if we joined late, ask for the current move list
      window.setTimeout(() => roomRef.current?.requestSync(), 300);
    },
    onMove: (uci: string) => {
      matchRef.current?.applyExternalUci(uci);
    },
    onSync: (sans: string[]) => {
      const current = matchRef.current?.getSans().length ?? 0;
      if (sans.length >= current) matchRef.current?.loadSans(sans);
    },
    onSyncRequest: () => {
      const sans = matchRef.current?.getSans() ?? [];
      if (sans.length > 0) roomRef.current?.sendSync(sans);
    },
    onResign: () => {
      const winner: Side = myColorRef.current;
      matchRef.current?.forceResult({ kind: "resign", winner });
      setStatusNote(null);
    },
    onDrawOffer: () => setDrawOffer("received"),
    onDrawAccept: () => {
      matchRef.current?.forceResult({ kind: "draw", reason: "Draw agreed" });
      setDrawOffer("none");
    },
    onDrawDecline: () => setDrawOffer("none"),
    onRematchRequest: () => {
      if (rematchRef.current === "sent") {
        doRematch();
      } else {
        setRematch("received");
      }
    },
    onRematchAccept: () => doRematch(),
    onPeerJoin: () => {
      setConnState("connected");
      setStatusNote(null);
      // re-sync state after a reconnect
      if (roleRef.current === "host" && startRef.current) {
        roomRef.current?.sendStart(startRef.current);
        const sans = matchRef.current?.getSans() ?? [];
        if (sans.length > 0) roomRef.current?.sendSync(sans);
      } else {
        roomRef.current?.requestSync();
      }
    },
    onPeerLeave: () => {
      if (phaseRef.current === "game") {
        setConnState("disconnected");
        setStatusNote("Opponent disconnected — keeping their seat warm…");
      }
    },
    onStatus: (s: string) => setStatusNote(s),
  };

  /* ----- actions ----- */

  const createGame = () => {
    const me = self();
    setRole("host");
    roleRef.current = "host";
    setJoinError(null);
    const tryHost = (attempt: number) => {
      const c = generateRoomCode();
      setCode(c);
      setPhase("waiting");
      const room = hostOnlineRoom(
        c,
        me,
        handlers,
        () => setPhase("waiting"),
        () => {
          // id collision — pick a fresh code
          roomRef.current?.leave();
          if (attempt < 4) tryHost(attempt + 1);
          else setJoinError("Could not reserve a room. Try again.");
        },
      );
      roomRef.current = room;
    };
    tryHost(0);
  };

  const joinGame = () => {
    const c = normalizeRoomCode(joinCode);
    if (c.length < 4) {
      setJoinError("Enter the 6-character code your friend shared.");
      return;
    }
    setJoinError(null);
    setRole("guest");
    roleRef.current = "guest";
    setCode(c);
    setPhase("connecting");
    const room = joinOnlineRoom(
      c,
      self(),
      handlers,
      () => setConnState("connected"),
      (message) => {
        setJoinError(message);
        setPhase("lobby");
        roomRef.current?.leave();
        roomRef.current = null;
      },
    );
    roomRef.current = room;
  };

  const copyCode = async () => {
    const link = `${window.location.origin}${window.location.pathname}#/play/online?code=${code}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const shareCode = async () => {
    const link = `${window.location.origin}${window.location.pathname}#/play/online?code=${code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "ChessMaster", text: `Join my chess game — code ${code}`, url: link });
      } catch {
        /* cancelled */
      }
    } else {
      copyCode();
    }
  };

  const leaveToLobby = () => {
    roomRef.current?.leave();
    roomRef.current = null;
    setStartInfo(null);
    setCode("");
    setDrawOffer("none");
    setRematch("idle");
    setConnState("connected");
    setStatusNote(null);
    setSavedRecord(null);
    setRatingDelta(null);
    setPhase("lobby");
  };

  const doRematch = () => {
    matchRef.current?.reset();
    setRematch("idle");
    setDrawOffer("none");
    setSavedRecord(null);
    setRatingDelta(null);
  };

  const onGameOver = (info: GameOverInfo) => {
    const me = self();
    const myColor = myColorRef.current;
    const result = !info.winner ? "draw" : info.winner === myColor ? "win" : "loss";
    const oppRating = myColor === "w" ? (startInfo?.blackRating ?? 1200) : (startInfo?.whiteRating ?? 1200);
    const scoreVal = result === "win" ? 1 : result === "draw" ? 0.5 : 0;
    const delta = eloDelta(me.rating, oppRating, scoreVal as 0 | 0.5 | 1);
    const after = Math.max(100, me.rating + delta);

    if (user) {
      const record: GameRecord = {
        id: makeGameId(),
        mode: "online",
        date: Date.now(),
        myColor,
        myName: me.name,
        opponent: myColor === "w" ? (startInfo?.blackName ?? "Opponent") : (startInfo?.whiteName ?? "Opponent"),
        result: result as GameRecord["result"],
        score: scoreOf(info),
        sans: info.sans,
        ratingBefore: me.rating,
        ratingAfter: after,
      };
      // optimistic local update + async database write
      setUser({ ...user, rating: after });
      void applyRatingChange(user.id, after)
        .then(() => saveGame(user.id, record))
        .then(() => refresh())
        .catch(() => undefined);
      setSavedRecord(record);
    }
    setRatingDelta(delta);
  };

  /* ----- derived ----- */

  const myColor: Side = myColorRef.current;
  const white: PlayerInfo | null = startInfo
    ? { name: startInfo.whiteName, rating: startInfo.whiteRating, kind: "human" }
    : null;
  const black: PlayerInfo | null = startInfo
    ? { name: startInfo.blackName, rating: startInfo.blackRating, kind: "human" }
    : null;

  /* ----- gate (signed-in players only) ----- */

  if (!ready) {
    return (
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-40 text-center sm:px-6 lg:px-8">
        <p className="animate-pulse font-mono text-[11px] uppercase tracking-[0.24em] text-ink-400">
          Restoring your session…
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-28 sm:px-6 lg:px-8 lg:pt-36">
        <div className="mx-auto max-w-md rounded-xl border border-ink-900/10 bg-paper-50/85 p-7 shadow-card backdrop-blur-sm dark:border-ink-100/10 dark:bg-ink-800/75">
          <p className="flex items-center gap-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.24em] text-brass-700 dark:text-brass-300">
            <GlobeIcon className="h-4 w-4" /> Play Online
          </p>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink-950 dark:text-ink-100">
            Log in to play online.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-500 dark:text-ink-300">
            Online games are tied to your ChessMaster account — your name and rating travel with
            every move, and the result is saved to your history.
          </p>
          <button
            onClick={() => navigate("/profile")}
            className="mt-5 inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-brass-500 text-base font-bold text-ink-950 transition-all duration-300 hover:-translate-y-[2px] hover:bg-brass-400"
          >
            Sign in or create an account
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  /* ----- lobby / waiting / connecting ----- */

  if (phase !== "game" || !startInfo || !white || !black) {
    return (
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-28 sm:px-6 lg:px-8 lg:pt-36">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <button
              onClick={() => navigate("/play")}
              className="group flex cursor-pointer items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.24em] text-brass-700 transition-colors hover:text-brass-600 dark:text-brass-300"
            >
              <ArrowRightIcon className="h-3.5 w-3.5 rotate-180 transition-transform group-hover:-translate-x-1" />
              All play modes
            </button>
            <h1 className="animate-rise mt-3 font-display text-[clamp(2.2rem,5vw,3.8rem)] font-bold leading-[1.01] tracking-tight text-ink-950 dark:text-ink-100">
              Play <span className="text-outline">Online.</span>
            </h1>
            <p className="animate-rise mt-4 max-w-xl text-lg leading-relaxed text-ink-500 dark:text-ink-300" style={{ animationDelay: "100ms" }}>
              Real-time, peer-to-peer chess. Create a room and share the code — moves sync instantly
              over WebRTC. Playing as{" "}
              <strong className="font-semibold text-ink-800 dark:text-ink-100">{user?.username}</strong> ({user?.rating}).
            </p>
          </div>
        </header>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {/* create */}
          <section className="rounded-xl border border-ink-900/10 bg-paper-50/85 p-6 shadow-card backdrop-blur-sm dark:border-ink-100/10 dark:bg-ink-800/75 sm:p-7">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-ink-400">Create a game</p>

            {phase === "waiting" ? (
              <div className="mt-5">
                <p className="text-[15px] font-medium text-ink-700 dark:text-ink-200">Game created! Room code:</p>
                <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brass-500/50 bg-brass-500/[0.06] px-4 py-5">
                  {code.split("").map((ch, i) => (
                    <span key={i} className="flex h-12 w-10 items-center justify-center rounded-lg border border-ink-900/10 bg-paper-50 font-display text-2xl font-bold text-ink-950 dark:border-ink-100/10 dark:bg-ink-900 dark:text-ink-100">
                      {ch}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex gap-2.5">
                  <button
                    onClick={copyCode}
                    className="h-11 flex-1 cursor-pointer rounded-lg border border-ink-900/15 text-[14px] font-semibold text-ink-800 transition-all hover:border-brass-600 hover:text-brass-700 dark:border-ink-100/15 dark:text-ink-100"
                  >
                    {copied ? "Copied ✓" : "Copy link"}
                  </button>
                  <button
                    onClick={shareCode}
                    className="h-11 flex-1 cursor-pointer rounded-lg bg-brass-500 text-[14px] font-bold text-ink-950 transition-all hover:bg-brass-400"
                  >
                    Share
                  </button>
                </div>
                <p className="mt-4 flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">
                  <span className="animate-pulse-dot h-2 w-2 rounded-full bg-brass-500" />
                  Waiting for opponent… keep this tab open
                </p>
                <button onClick={leaveToLobby} className="mt-3 w-full cursor-pointer text-center font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400 hover:text-blunder">
                  Cancel room
                </button>
              </div>
            ) : (
              <>
                <p className="mt-3 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-400">Your colour</p>
                <div className="mt-3 flex gap-2.5">
                  {(
                    [
                      { id: "w", label: "White" },
                      { id: "b", label: "Black" },
                      { id: "random", label: "Random" },
                    ] as { id: ColorChoice; label: string }[]
                  ).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setColorChoice(c.id)}
                      className={`flex-1 cursor-pointer rounded-lg border px-3 py-2.5 text-[14px] font-semibold transition-all ${
                        colorChoice === c.id
                          ? "border-brass-500 bg-brass-500/10 text-brass-700 dark:text-brass-300"
                          : "border-ink-900/12 text-ink-700 hover:border-brass-500/50 dark:border-ink-100/12 dark:text-ink-200"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={createGame}
                  className="mt-6 inline-flex h-[52px] w-full cursor-pointer items-center justify-center gap-3 rounded-lg bg-brass-500 text-base font-bold text-ink-950 shadow-[0_14px_30px_-12px_rgb(207_159_61/0.7)] transition-all duration-300 hover:-translate-y-[2px] hover:bg-brass-400"
                >
                  Create Game
                  <ArrowRightIcon className="h-5 w-5" />
                </button>
              </>
            )}
          </section>

          {/* join */}
          <section className="rounded-xl border border-ink-900/10 bg-paper-50/85 p-6 shadow-card backdrop-blur-sm dark:border-ink-100/10 dark:bg-ink-800/75 sm:p-7">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-ink-400">Join a game</p>
            <label htmlFor="room-code" className="mt-4 block font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-400">
              Enter game code
            </label>
            <input
              id="room-code"
              value={joinCode}
              onChange={(e) => {
                setJoinCode(normalizeRoomCode(e.target.value));
                if (joinError) setJoinError(null);
              }}
              placeholder="ABC123"
              maxLength={6}
              className={`mt-2.5 h-14 w-full rounded-lg border bg-paper-100/60 px-4 text-center font-display text-2xl font-bold tracking-[0.3em] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 dark:bg-ink-900/60 dark:text-ink-100 dark:placeholder:text-ink-600 ${
                joinError ? "border-blunder focus:ring-blunder/40" : "border-ink-900/15 focus:border-brass-500 focus:ring-brass-500/40 dark:border-ink-100/15"
              }`}
            />
            {joinError && <p className="mt-2 text-sm font-medium text-blunder">{joinError}</p>}
            <button
              onClick={joinGame}
              disabled={phase === "connecting"}
              className="mt-4 inline-flex h-[52px] w-full cursor-pointer items-center justify-center gap-3 rounded-lg border border-ink-900/20 text-base font-bold text-ink-900 transition-all duration-300 hover:-translate-y-[2px] hover:border-brass-600 hover:text-brass-700 disabled:opacity-50 dark:border-ink-100/20 dark:text-ink-100 dark:hover:border-brass-400 dark:hover:text-brass-300"
            >
              {phase === "connecting" ? (
                <>
                  <span className="animate-pulse-dot h-2.5 w-2.5 rounded-full bg-brass-500" />
                  Connecting…
                </>
              ) : (
                <>
                  Join Game
                  <UsersIcon className="h-5 w-5" />
                </>
              )}
            </button>
            <p className="mt-4 font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-ink-400">
              Tip: open this page in a second browser or tab and join your own code to try it.
            </p>
          </section>
        </div>
      </div>
    );
  }

  /* ----- game ----- */

  return (
    <div
      className={
        isFs
          ? "flex h-[100dvh] flex-col px-3 pb-3 pt-20 sm:px-5 sm:pb-4 sm:pt-24"
          : "mx-auto max-w-7xl px-4 pb-24 pt-24 sm:px-6 lg:px-8 lg:pt-32"
      }
    >
      <div className={`flex flex-wrap items-center justify-between gap-4 ${isFs ? "mb-3 shrink-0" : "mb-6"}`}>
        <div>
          <p className="flex items-center gap-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.24em] text-brass-700 dark:text-brass-300">
            <GlobeIcon className="h-4 w-4" /> Online · Room {code}
          </p>
          <h1 className="mt-2 font-display text-[clamp(1.6rem,3.4vw,2.4rem)] font-bold tracking-tight text-ink-950 dark:text-ink-100">
            {white.name} <span className="text-ink-400">vs</span> {black.name}
          </h1>
        </div>
        <button
          onClick={leaveToLobby}
          className="cursor-pointer rounded-lg border border-ink-900/15 px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-600 transition-colors hover:border-blunder hover:text-blunder dark:border-ink-100/15 dark:text-ink-300"
        >
          Leave game
        </button>
      </div>

      <MatchRoom
        ref={matchRef}
        mode="online"
        white={white}
        black={black}
        myColor={myColor}
        canControl={(color) => color === myColor && connState === "connected"}
        locked={connState === "disconnected"}
        onLocalMove={(uci) => roomRef.current?.sendMove(uci)}
        onGameOver={onGameOver}
        onResignLocal={() => roomRef.current?.sendResign()}
        onDrawOffer={() => {
          roomRef.current?.sendDrawOffer();
          setDrawOffer("sent");
        }}
        drawOfferState={drawOffer}
        onDrawAccept={() => {
          roomRef.current?.sendDrawAccept();
          matchRef.current?.forceResult({ kind: "draw", reason: "Draw agreed" });
          setDrawOffer("none");
        }}
        onDrawDecline={() => {
          roomRef.current?.sendDrawDecline();
          setDrawOffer("none");
        }}
        onRematch={() => {
          roomRef.current?.sendRematchRequest();
          setRematch("sent");
        }}
        rematchStatus={rematch}
        onRematchAccept={() => {
          roomRef.current?.sendRematchAccept();
          doRematch();
        }}
        onViewGame={savedRecord ? () => navigate("/profile", { state: { replay: savedRecord.id } }) : undefined}
        resultExtras={
          ratingDelta !== null && user ? (
            <div className="flex items-center gap-4 rounded-lg border border-ink-100/15 bg-ink-900/60 px-5 py-3">
              <div className="text-left">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">Your rating</p>
                <p className="font-display text-xl font-bold text-ink-100">
                  {savedRecord?.ratingBefore}
                  <ArrowRightIcon className="mx-2 inline h-4 w-4 text-ink-400" />
                  {savedRecord?.ratingAfter}
                </p>
              </div>
              <span className={`rounded-md px-2.5 py-1 font-mono text-sm font-bold ${ratingDelta >= 0 ? "bg-felt-500/20 text-felt-300" : "bg-blunder/20 text-[#e08a80]"}`}>
                {ratingDelta >= 0 ? `+${ratingDelta}` : ratingDelta}
              </span>
            </div>
          ) : null
        }
        statusSlot={
          (connState === "disconnected" || statusNote) && (
            <div className={`flex items-center gap-2.5 rounded-lg border px-4 py-2.5 ${connState === "disconnected" ? "border-blunder/50 bg-blunder/10" : "border-brass-500/40 bg-brass-500/10"}`}>
              <span className={`animate-pulse-dot h-2 w-2 rounded-full ${connState === "disconnected" ? "bg-blunder" : "bg-brass-500"}`} />
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-700 dark:text-ink-200">
                {statusNote ?? (connState === "disconnected" ? "Opponent disconnected" : "Connected")}
              </p>
            </div>
          )
        }
        panelExtras={
          <div className="rounded-xl border border-ink-900/10 bg-paper-50/85 p-4 dark:border-ink-100/10 dark:bg-ink-800/75">
            <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-400">
              <GlobeIcon className="h-3.5 w-3.5 text-brass-600 dark:text-brass-300" /> Room
            </p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="font-display text-2xl font-bold tracking-[0.2em] text-ink-950 dark:text-ink-100">{code}</p>
              <button
                onClick={copyCode}
                className="cursor-pointer rounded-md border border-ink-900/15 px-3 py-1.5 font-mono text-[11px] font-semibold text-ink-700 transition-colors hover:border-brass-600 hover:text-brass-700 dark:border-ink-100/15 dark:text-ink-200"
              >
                {copied ? "Copied ✓" : "Copy link"}
              </button>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-500 dark:text-ink-300">
              You are {myColor === "w" ? "White" : "Black"} · moves sync in real time over WebRTC.
            </p>
          </div>
        }
        footerNote={`You play ${myColor === "w" ? "White" : "Black"} — only your pieces respond on your turn`}
      />
    </div>
  );
}
