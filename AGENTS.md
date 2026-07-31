# AGENTS.md

Handoff notes for whichever agent picks this up next (Codex, a fresh Claude session, etc).
This complements `CLAUDE.md` (architecture reference) — read that first, then this file for
"what's in flight right now."

## Session summary (most recent work, in order)

### 1. Full frontend retheme (done)
The app previously mixed four incompatible visual styles (League-of-Legends gold/Cinzel,
Tron neon cyan/red, Twitter-blue `#1DA1F2`, stray cyan `#00d4ff`). It's now a single
EstateIQ-Web-inspired dark "glass" theme:
- `tailwind.config.js` — centralized tokens: `background.app/app-soft/app-panel`,
  `surface`, `border`, `text.primary/secondary/muted/faint`, and a `brand` palette
  (cyan/emerald/violet/amber/rose, each with a full 50–900 scale).
- `src/index.css` — glass-card utility, cyan-tinted scrollbars, Geist font.
- `src/components/ui/{Button,Badge,Card}.jsx` — new shared primitives (variant-based,
  mirrors EstateIQ's pattern), used across the app instead of ad-hoc inline styles.
- Game piece convention: Tic-Tac-Toe X = rose/red, O = cyan (per user preference — note
  this was deliberately flipped once already, don't re-flip without asking). Connect Four:
  player one = cyan, player two/AI = violet.
- `src/components/home/GameIcons.jsx` — new custom mini SVG icons per game (previously
  Connect Four and Sudoku shared the exact same generic icon).
- Every component file under `src/components/` and `src/layout/` was touched. A few
  confirmed-dead/orphaned files were found and deliberately left un-retouched (not worth
  the effort): `Login.css`, `Registration.css`, `resultModal/ResultModal.css`,
  `form/TextInput.jsx`, `form/PasswordInput.jsx`, `Trinity.module.css` (+ `Trinity.jsx`,
  `TrinityUI.jsx`), and various `.html` scratch files under `svg/` folders.

### 2. Generalized invite → accept → lobby → start pipeline (code complete, verification blocked)
Original ask: Connect Four's "vs Friend" was a bare copy-paste link with no invite, no
notification, no roster — nothing like Tic-Tac-Toe's real lobby flow. User asked for "a
standard enterprise invite/accept pattern" for both games.

**Root cause found:** there's no generic `Lobby` model. `lobby_id` *is* `TicTacToeGame.id`.
The lobby WS consumer hardcoded `TicTacToeGame` lookups and `player_x`/`player_o` field
names. Connect Four already had its own separate REST+WS app but never went through the
lobby at all.

**What changed (backend):**
- `backend/utils/websockets/ws_groups.py` — new `scoped_lobby_id(game_type, lobby_id)` →
  `"{game_type}-{lobby_id}"` (hyphen, not colon — Channels group names can't contain `:`).
  Used everywhere a lobby-phase Redis key or Channels group name is built, so
  `TicTacToeGame` and `ConnectFourGame` (separate tables, overlapping auto-increment PKs)
  never collide.
- `backend/utils/game_registry.py` — new central `GAME_TYPE_REGISTRY` dict: for each
  game_type, which model/app_label, which create-function, which seat("X"/"O")→FK-field
  mapping, which seat→turn-value mapping. Single source of truth consumed by the invites
  app and the lobby consumer instead of hardcoded TicTacToe field names in three places.
- `backend/connect_four/services/game_factory.py` — new, mirrors
  `game/services/game_factory.py::create_tictactoe_game`.
- `backend/invites/views.py`, `backend/invites/serializers.py` — the `game_type !=
  "tic_tac_toe"` hard-reject is gone; both now dispatch through the registry.
- `backend/invites/guards.py` — `validate_invite_for_lobby_join` gained an optional
  `expected_game_type` param (closes a spoof gap: a mismatched-type invite whose
  `lobby_id` happens to collide numerically).
- `backend/lobby/routing.py` — route is now `ws/lobby/<str:game_type>/<int:lobby_id>/`
  (was `ws/lobby/<int:lobby_id>/`).
- `backend/lobby/lobby_consumer.py` — reads `game_type` from the URL, validates it against
  the registry, scopes every Redis call, branches `handle_start_game`'s DB write via the
  registry instead of hardcoded `player_x`/`player_o`. Broadcasts now include `game_type`
  so the frontend knows which game route to land on.
- `backend/game/consumer/game_consumer.py` — this consumer is permanently TicTacToe-only
  (route `ws/game/<id>/`), but shares the same Redis manager/key scheme as the lobby, so it
  now scopes its own keys with `scoped_lobby_id("tic_tac_toe", ...)` in `connect()`,
  `handle_rematch_accept()`, and `disconnect()`. **If you touch lobby Redis keys again,
  check this file too** — it's the highest-risk regression spot (rematch flow especially).
- `backend/connect_four/views.py::create_game` — now mints a `sessionKey` for non-AI
  games (mirrors `TicTacToeGameViewSet.create()`), needed so a Connect Four lobby creator
  can make their first WS connection before any invite exists.
- Deleted `backend/invites/tests/test_invite_ws_close_codes.py` (confirmed testing a dead
  code path — `GameConsumer.connect()` unconditionally rejects any `invite` query param
  before the guard it was testing would ever run). Added
  `backend/invites/tests/test_invite_guards.py` (game_type mismatch coverage) and a new
  case in `backend/lobby/tests/test_lobby_consumer.py` (unknown game_type → close 4400).
  **`backend/lobby/tests/test_lobby_consumer.py`'s existing tests were updated** to use
  the new `/ws/lobby/tic_tac_toe/664/` URL shape (they used the bare old shape and would
  have broken otherwise).

**What changed (frontend):**
- `src/routes/AppRoutes.jsx` — `/lobby/:id` → `/lobby/:gameType/:id`.
- `src/websocket/getWebsocketURL.jsx` — `getLobbyWSUrl`/`getChatWSUrl` take a `gameType`
  param; chat lobby room name is namespaced `${gameType}_${lobbyId}`.
- `src/components/lobby/components/LobbyPage.jsx` — reads `gameType` from route params,
  threads it through WS URLs/session-storage keys/invite payloads, branches
  `buildGameUrl` (`tic_tac_toe` → `/games/:id`, `connect_four` → `/games/connect-four/:id`).
- `src/components/lobby/hooks/useActiveLobbyId.jsx` — now returns `{ lobbyId, gameType }`
  (was a bare string) matching the new route shape.
- `src/invites/InviteNavigation.js` — `buildInviteLobbyUrl` takes `gameType`; deleted the
  unused `buildInviteGameUrl` (confirmed dead, never imported).
- `src/components/notifications/InvitePanelContainer.jsx` — accept navigation now uses the
  shared `buildInviteLobbyUrl` builder (was inlining its own URL string) with `gameType`
  sourced from the invite.
- `src/components/friends/FriendRow.jsx` — invite icon now opens a small 2-item popover
  (Tic-Tac-Toe / Connect Four) instead of inviting to Tic-Tac-Toe unconditionally.
  `src/components/friends/FriendsSidebar.jsx::handleInvite` takes a `gameType` arg and
  only reuses the currently-open lobby if its game type matches what was picked.
- `src/components/home/HomePage.jsx` — Connect Four's "vs Friend" now creates a game then
  navigates to `/lobby/connect_four/:id` (was navigating straight to the game page with no
  lobby step at all, matching what Tic-Tac-Toe's "Multiplayer" already did).
- `src/components/connect-four/ConnectFourMPPage.jsx` — removed the auto-join-on-visit
  effect and the `CopyLinkBox` (lobby now owns invite/copy-link for both game types).
- `src/reducers/lobbyReducer.jsx` — removed the dormant `SET_GAME` action (confirmed never
  dispatched; had TicTacToe-specific field names that would've been misleading bait for a
  future maintainer).
- `src/components/game/Gamepage.jsx` — the "missing lobby/sessionKey → bounce back" redirect
  now targets `/lobby/tic_tac_toe/:id` (this page is TTT-only per its own comment).

### Blocking issue: verification incomplete

**Not a code defect** — confirmed by: (a) `python -c "import ttt_core.asgi"` in a fresh
process loads cleanly, (b) new unit tests pass, (c) live logs show the REST layer working
correctly (`sessionKey` minted with the new scoped id format for a Connect Four game,
frontend correctly requesting the new `/ws/lobby/connect_four/4/?...` URL shape).

**The actual blocker:** the local dev backend was running under `python manage.py
runserver` (WSGI), which returns a plain HTTP 404 for any `/ws/...` path — it cannot
upgrade to WebSocket at all, regardless of routing correctness. This affected *every*
socket type (including `/ws/notifications/` and `/ws/friends/status/`, untouched by this
work), which is what confirmed it wasn't code-specific. This is a pre-existing, documented
gotcha (see CLAUDE.md → "Debug WebSocket Issues").

**To resume verification:** from `backend/`, run one of:
```
uvicorn ttt_core.asgi:application --host 0.0.0.0 --port 8000 --reload
daphne -b 0.0.0.0 -p 8000 ttt_core.asgi:application
```
Then, with two separate logged-in browser sessions (two accounts, or one + incognito):
1. Tic-Tac-Toe: Home → Multiplayer → lobby loads, WS shows LIVE → invite the other
   account (or use Copy Link) → accept → both land in the same lobby roster → Start Game →
   both redirect to `/games/:id` and can play a full game, including rematch (this is the
   highest-regression-risk path — it depends on `game_consumer.py`'s Redis key scoping
   exactly matching `lobby_consumer.py`'s).
2. Connect Four: Home → vs Friend → same flow → Start Game → both land on
   `/games/connect-four/:id` and can drop pieces to a win/draw.
3. Sanity-check a mismatched-game_type invite is rejected (the new `expected_game_type`
   guard), not silently accepted.

### Other in-flight items
- `src/layout/LayoutFrame.jsx` was just adjusted to vertically center the app shell
  (previously pinned near the top via a fixed `mt-16` with no bottom counterbalance,
  which read as "too high" on tall viewports). Confirmed visually fixed in-browser.

### 3. Poker / flagship game work (latest in-flight state)

Poker has been added and iterated heavily as the platform's intended flagship game. The
current implementation is no longer just a prototype UI:
- Backend app: `backend/poker/` with `PokerGame`, Hold'em hand evaluation, betting
  actions, table seats, configurable starting chips/blinds/timers/max players, side-pot
  distribution, turn timeout behavior, AI game support, and websocket updates.
- Migrations added through `backend/poker/migrations/0006_pokergame_max_players_nine.py`.
  Run `python manage.py migrate` locally if the DB has not picked these up.
- Poker is wired into the generic invite/lobby pipeline using `game_type="poker"` and
  routes to `/lobby/poker/:id` before starting the table.
- Frontend app files live under `tic-tac-toe/src/components/poker/` with REST helper
  `tic-tac-toe/src/api/pokerApi.js`.
- Poker routes include AI and multiplayer table pages; lobby setup lets the host configure
  starting stack, blinds, turn timer, and max players. Max players is currently 9.

Poker gameplay behavior:
- Backend already auto-advances streets after betting rounds close: preflop → flop → turn
  → river → showdown/completed.
- Turn timers are server-side: timeout auto-checks if checking is valid, otherwise
  auto-folds when the player is facing a bet.
- After a completed multiplayer hand, `backend/poker/consumers.py` schedules a server-side
  auto-deal after ~5 seconds and broadcasts the next hand to the table. Because production
  in-process timers can be fragile across workers/restarts, `usePokerGame.js` also has a
  production-safe client fallback: each connected multiplayer client sends
  `{ type: "next_hand", auto: true }` after the result delay. The backend suppresses
  harmless duplicate auto-next attempts by syncing state instead of surfacing an error.
  The small `Deal Now` button remains as a manual fallback.
- Manual deal/start controls should not be reintroduced into the production table UI
  unless explicitly requested; they make the game feel like a dev tool.

Current poker UI decisions from the last iteration:
- Player seats should be compact square/rectangular plates, not rounded pills.
- Seat plates should show only the player's name, stack, hole cards, and active-turn dot.
- Bets should appear above the relevant player chip when that player has an active bet.
  They should not live inside the player chip and should not overlap the community cards.
- Dealer `D` should be a separate table marker near the player chip, not part of the chip
  contents.
- Pot/phase/blinds/timer rail must sit above the community cards with visible breathing
  room. It was last moved upward after it overlapped the card display.
- Mobile layout matters: remove unnecessary headers on small screens and keep the table
  compact enough that player chips, card row, status, and actions do not cause awkward
  vertical overflow.
- Cards now deal in instead of appearing instantly. `src/components/poker/PokerCard.jsx`
  accepts `dealVariant="community" | "hole"`; `PokerTable.jsx` has a staged reveal layer
  that shows hole cards one at a time in seat order and reveals flop/turn/river cards
  sequentially as the websocket state changes. `src/index.css` owns the `pokerCardDeal` /
  `pokerCardDealHole` animations with shorter mobile durations and a
  `prefers-reduced-motion` opt-out.

Recent verification that passed:
```
npm run build
backend\ttt_venv\Scripts\python.exe backend\manage.py check
backend\ttt_venv\Scripts\python.exe backend\manage.py test poker.tests -v 2
```

Suggested next verification when resuming:
1. Start Redis/Memurai and the ASGI backend (`uvicorn ttt_core.asgi:application --host
   0.0.0.0 --port 8000 --reload` from `backend/`).
2. In two browser sessions, create a poker lobby, invite/join a second user, start the
   table, and play through at least one hand.
3. Confirm active bets sit above the correct player chip, dealer button is outside the
   chip, pot/phase/timer does not overlap community cards, and auto-next-hand fires once
   after the result window.
4. Re-check mobile specifically; the user cares about fitting perfectly on mobile and
   removing unnecessary headers there.

### 4. Mobile-readiness pass (latest UI sweep)

The app just got a broad mobile pass across the main surfaces:
- `src/layout/LayoutFrame.jsx` now removes the desktop shell border/shadow on mobile,
  uses tighter mobile content padding, and reserves safe-area bottom padding for the
  bottom tab bar.
- Home, leaderboard, Sudoku, Tic-Tac-Toe, Connect Four, Checkers, and Poker pages now use
  smaller mobile top padding, responsive min-heights, tighter gaps, and fewer mobile-only
  headers/eyebrows.
- Poker table mobile controls now use a fixed grid instead of unpredictable wrapping.
  Player seat chips remain compact/square with amount-only bet markers above the chip.
- Lobby mobile panels are denser: compact header/tabs, bounded player/chat panels,
  shorter poker player rows for 9-seat tables, and the poker setup modal behaves as a
  bottom sheet on mobile.
- Result modals and result slots were reduced on mobile so they do not cause large board
  shifts or consume excessive viewport height.

Verification run after this pass:
```
npm run build
```

Still worth live-checking on actual mobile widths before shipping:
1. Home hub at 360px and 390px widths.
2. Poker lobby with 2, 6, and 9 players.
3. Poker table with active bets, dealer marker, raise controls, and showdown/auto-next-hand.
4. Tic-Tac-Toe / Connect Four / Checkers result modal positions.
5. Sudoku difficulty switching/loading to ensure the board container no longer visibly
   shrinks and expands.

### 5. Collapsible desktop social sidebar

The desktop social sidebar was converted from a permanently wide panel into a collapsible
app rail:
- `src/context/uiContext.jsx` owns `isSidebarCollapsed` and persists explicit user choice
  only for the current browser tab in `sessionStorage` under
  `ui:sidebarCollapsed:session:v1`.
- With no saved preference, the sidebar defaults collapsed everywhere after login.
- `src/layout/LayoutFrame.jsx` drives the desktop aside width via `--sidebar-w`: `72px`
  collapsed, `280px` expanded. Mobile overlay behavior is unchanged.
- `src/components/friends/FriendsSidebar.jsx` renders a compact desktop rail when
  collapsed: expand, avatar initial, Home, Friends, Chat, and Ranks, with unread/request
  badges still visible. Expanded mode keeps the full social panel and has a collapse
  button in the desktop header.

Verification run after this pass:
```
npm run build
```

### 6. Poker tournaments v1

Poker now has a scheduled single-table tournament workflow, scoped intentionally as v1:
- Backend models live in `backend/poker/models.py`: `PokerTournament` and
  `PokerTournamentRegistration`, with migration
  `backend/poker/migrations/0007_pokertournament_pokertournamentregistration.py`.
- REST endpoints live under `/api/poker/tournaments/`: list/create/detail/register/
  withdraw/remove registration/start.
- Visibility is friends-only plus self: users see tournaments created by accepted friends
  or tournaments they are registered in. The creator sees the full roster; non-creators do
  not.
- Registration closes automatically when registered players hit `max_players` and reopens
  if the creator removes someone or a non-creator withdraws before start.
- Creator-only start is guarded by scheduled time and requires at least 2 registered
  players. Starting creates a real `PokerGame`, calls `initialize_table(users)`, deals the
  first hand, marks the tournament `in_progress`, and returns `/games/poker/:gameId`.
- Frontend page is `src/components/poker/PokerTournamentsPage.jsx`, reachable at
  `/tournaments`. The collapsed sidebar has a Tournaments rail button.

Verification run after this pass:
```
backend\ttt_venv\Scripts\python.exe backend\manage.py check
backend\ttt_venv\Scripts\python.exe backend\manage.py test poker.tests -v 2
npm run build
backend\ttt_venv\Scripts\python.exe backend\manage.py migrate poker
```
