# ♞ ChessMaster

A complete, production-ready chess platform — polished landing page, three fully playable game modes, a real engine opponent, and a secure account system with persistent game history.

Built with **React 18 + TypeScript + Vite + Tailwind CSS v4**, with **chess.js** as the single source of truth for chess rules and **Stockfish 10** running in a Web Worker.

---

## ✨ Features

### Landing page
- Asymmetric hero with a self-playing Italian Game board (animated piece glides, capture fades, live eval bar, filling notation card)
- Results & openings marquee ticker, interactive feature bento (live clocks, engine slider, solvable mate-in-1 puzzles, animated analysis charts)
- Training section, animated stats band, working email capture, dark/light theme with no-flash persistence

### Play modes (`/play`)
| Mode | Route | Description |
|---|---|---|
| 🤖 **vs Bot** | `/play/bot` | Play Stockfish at 10 ratings (400 → 2200+). Rating genuinely scales Skill Level, depth and move time — never random moves. Human White / Black / Random, Elo rating changes saved to your account |
| 👥 **With a Friend** | `/play/friend` | Same-device pass-and-play with two player names, Save Game / Rematch / New Game / View Game |
| 🌐 **Online** | `/play/online` | Real peer-to-peer multiplayer (PeerJS / WebRTC). Create a room → share a 6-char code → opponent joins → moves sync in real time. Resign, draw offers, rematch, disconnect/reconnect handling, results saved |

### The board (shared `MatchRoom`)
- Full chess.js rules: castling, en passant, promotion picker, check / checkmate / stalemate, threefold, fifty-move, insufficient material
- Legal-move dots, capture rings, last-move + check highlighting, coordinates, board flip
- Move list in SAN with auto-scroll, captured pieces + material lead, eval bar
- **Full Screen mode** via the browser Fullscreen API — responsive portrait/landscape layouts, game state and connections untouched
- Undo, two-tap confirm Resign, game-over overlay with score & rating delta

### Accounts & history (`/profile`)
- Sign up / log in / log out with **email + password**, unique UUID per user
- **No plain-text passwords**: PBKDF2 (WebCrypto, salted & iterated) locally, bcrypt server-side with Supabase Auth in production
- Persistent 30-day sessions — close the browser, come back, still logged in
- Game history across all three modes with **full replay viewer** (autoplay, keyboard navigation, per-ply board)
- Rating, W/L/D stats, per-mode breakdowns, Elo deltas per game

---

## 🛠 Tech stack

| Layer | Technology |
|---|---|
| UI | React 18, TypeScript (strict), Tailwind CSS v4, Vite 6 |
| Chess rules | [chess.js](https://github.com/jhlywa/chess.js) v1 |
| Engine | Stockfish 10 (asm.js, Web Worker via blob URL) + alpha-beta minimax fallback (dedicated Vite worker) |
| Routing | react-router-dom (HashRouter — works on any static host) |
| Multiplayer | PeerJS (WebRTC data channels, cloud signaling) |
| Database | Supabase (Postgres + Auth, RLS) **or** embedded IndexedDB fallback |

---

## 🚀 Getting started

```bash
npm install
npm run dev        # local development server
npm run build      # production build → dist/
```

No environment variables are required to run — the app works out of the box on the embedded IndexedDB database (accounts, sessions and game history persist per browser).

## ☁️ Optional: production database (Supabase)

1. Copy `.env.example` → `.env` and fill in:
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
2. Run `supabase/schema.sql` once in the Supabase SQL editor (creates `profiles` + `games` tables with row-level security)
3. `npm run build` — accounts, ratings and history now sync to Postgres across devices

The anon key is a **public client key** by design; security comes from RLS. Never commit a service-role key.

## 📁 Project structure

```
src/
├── auth/            # AuthContext, PBKDF2 crypto, IndexedDB + Supabase adapters
├── game/MatchRoom   # shared board UI: rules, panels, fullscreen, all modes
├── pages/           # Home, PlayHub, Bot, Friend, Online, Profile
├── components/      # ChessBoard, navbar, hero, icons, UI primitives
├── engine.ts        # Stockfish worker bridge, rating configs, warmup
├── minimax*.ts      # classic fallback engine + its worker
├── online.ts        # PeerJS room protocol (moves, sync, draw, rematch)
└── account*.ts      # account/history API facade + shared types
supabase/schema.sql  # production tables + RLS policies
```

## 🔒 Security notes

- `.env*` files are git-ignored (only `.env.example` is tracked)
- No secrets or API keys in the repository — verified by scan
- Passwords hashed before storage in every backend path
- Every engine move is legality-validated through chess.js before being played

---

MIT © ChessMaster
