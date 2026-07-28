# Filename: backend/lobby/consumers.py
import logging
import random
from urllib.parse import parse_qs

from asgiref.sync import async_to_sync
from channels.generic.websocket import JsonWebsocketConsumer
from django.db import transaction

from utils.redis.redis_game_lobby_manager import RedisGameLobbyManager
from utils.shared.shared_utils_game_chat import SharedUtils
from utils.websockets.ws_groups import lobby_group, scoped_lobby_id
from utils.game_registry import get_game_type_config, get_model_for

from invites.guards import validate_invite_for_lobby_join


logger = logging.getLogger("lobby.consumer")


# Step 1: Client->Server message contract for Lobby WS only
LOBBY_ALLOWED_TYPES = {
    "join_lobby",
    "leave_lobby",
    "start_game",
}


class LobbyConsumer(JsonWebsocketConsumer):
    """
    Lobby WebSocket (pre-game control plane)

    Route: ws/lobby/<game_type>/<lobby_id>/

    Client -> Server:
      - { "type": "join_lobby" }
      - { "type": "leave_lobby" }
      - { "type": "start_game" }

    Server -> Client:
      - { "type": "session_established", "lobbyId": "<id>", "sessionKey": "<key>" }
      - { "type": "update_player_list", "players": [...] }
      - { "type": "game_start_acknowledgment", ... }
      - { "type": "error", "message": "..." }

    Note on ids:
      - self.lobby_id: the raw id from the URL, used for DB lookups
        against the game_type's own model (TicTacToeGame/ConnectFourGame
        each have independent auto-increment PKs).
      - self.redis_scope_id: "<game_type>-<lobby_id>", used for every
        Redis key and the Channels group name, so two different game
        types never collide on the same numeric lobby_id.
    """

    def connect(self):
        # Step 1: Basic scope setup
        self.user = self.scope.get("user")
        self.game_type = str(self.scope["url_route"]["kwargs"]["game_type"])
        self.lobby_id = str(self.scope["url_route"]["kwargs"]["lobby_id"])

        if not get_game_type_config(self.game_type):
            self.accept()
            self.close(code=4400)  # unknown game_type
            return

        self.redis_scope_id = scoped_lobby_id(self.game_type, self.lobby_id)

        # ✅ Root fix: lobby socket must join a *lobby-only* namespace (no game updates here)
        # This prevents crashes like: "No handler for message type game_update"
        self.lobby_group_name = lobby_group(self.redis_scope_id)

        self.game_lobby_manager = RedisGameLobbyManager()

        if not self.user or getattr(self.user, "is_anonymous", True):
            # Anonymous users cannot use lobby WS
            self.accept()
            self.close(code=4401)
            return

        # Step 2: Parse query params
        qs = parse_qs((self.scope.get("query_string") or b"").decode("utf-8"))
        invite = (qs.get("invite") or [None])[0]
        session_key = (qs.get("sessionKey") or [None])[0]

        # Step 3: Validate/mint session
        minted_or_valid_session_key = None

        if invite:
            # Step 3a: Validate invite BEFORE minting/allow-listing (match GameConsumer)
            try:
                validate_invite_for_lobby_join(
                    user=self.user,
                    lobby_id=str(self.lobby_id),
                    invite_id=str(invite),
                    expected_game_type=self.game_type,
                )
            except Exception as exc:
                logger.error(
                    "[INVITE_GUARD] reject lobby join. game_type=%s lobby_id=%s invite_id=%s user_id=%s err=%s",
                    self.game_type,
                    self.lobby_id,
                    invite,
                    getattr(self.user, "id", None),
                    exc,
                )
                self.accept()
                self.close(code=4404)  # invite invalid / not allowed
                return

            # Step 3b: Invite path: mint/reuse sessionKey and allow-list this user
            try:
                minted_or_valid_session_key = self.game_lobby_manager.ensure_session_key(self.redis_scope_id)
                self.game_lobby_manager.add_user_to_session(self.redis_scope_id, int(self.user.id))
            except Exception as exc:
                logger.error("[LOBBY] invite session init failed lobby_id=%s err=%s", self.redis_scope_id, exc)
                self.accept()
                self.close(code=4500)
                return

        elif session_key:
            # SessionKey path: validate and refresh allow-list (best effort)
            try:
                is_valid = self.game_lobby_manager.validate_session_key(
                    lobby_id=self.redis_scope_id,
                    session_key=str(session_key),
                    user_id=int(self.user.id),
                )
            except Exception as exc:
                logger.error("[LOBBY] session validation error lobby_id=%s err=%s", self.redis_scope_id, exc)
                self.accept()
                self.close(code=4500)
                return

            if not is_valid:
                self.accept()
                self.close(code=4408)  # invalid/expired session
                return

            minted_or_valid_session_key = str(session_key)
            try:
                self.game_lobby_manager.add_user_to_session(self.redis_scope_id, int(self.user.id))
            except Exception:
                pass

        else:
            # No invite and no sessionKey => reject
            self.accept()
            self.close(code=4404)
            return

        # Step 4: Join lobby group + accept socket
        async_to_sync(self.channel_layer.group_add)(self.lobby_group_name, self.channel_name)
        self.accept()

        try:
            # Presence + channel tracking
            self.game_lobby_manager.add_player(self.redis_scope_id, self.user)
            self.game_lobby_manager.add_channel(self.redis_scope_id, self.channel_name)

            # Assign role via Redis manager (X/O/Spectator) — these are internal
            # lobby SEAT labels shared by every game type, not gameplay markers.
            role = self.game_lobby_manager.assign_player_role(self.redis_scope_id, self.user)
            self.game_lobby_manager.set_player_role(self.redis_scope_id, int(self.user.id), role)

            # Tell client the stable session key
            self.send_json(
                {
                    "type": "session_established",
                    "gameType": self.game_type,
                    "lobbyId": str(self.lobby_id),
                    "sessionKey": minted_or_valid_session_key,
                }
            )

            # Broadcast roster (must broadcast to lobby_<scope> group internally)
            self.game_lobby_manager.broadcast_player_list(self.channel_layer, self.redis_scope_id)

        except Exception as exc:
            logger.error("[LOBBY] post-connect init failed lobby_id=%s err=%s", self.redis_scope_id, exc)
            self.send_json({"type": "error", "message": "Failed to initialize lobby."})
            self.close(code=4500)

    def disconnect(self, code):
        # Step 1: Guard for early disconnects
        if not hasattr(self, "redis_scope_id"):
            return

        # Step 2: Remove from Redis
        try:
            self.game_lobby_manager.remove_player(self.redis_scope_id, self.user)
            self.game_lobby_manager.remove_channel(self.redis_scope_id, self.channel_name)
        except Exception as exc:
            logger.warning("[LOBBY] disconnect cleanup failed lobby_id=%s err=%s", self.redis_scope_id, exc)

        # Step 3: Leave Channels group
        try:
            async_to_sync(self.channel_layer.group_discard)(self.lobby_group_name, self.channel_name)
        except Exception:
            pass

        # Step 4: Broadcast roster update
        try:
            self.game_lobby_manager.broadcast_player_list(self.channel_layer, self.redis_scope_id)
        except Exception:
            pass

    def receive_json(self, content, **kwargs):
        """
        Step 1: Validate client payload using per-socket allowed types.
        Step 2: Route lobby-only message types.
        Important: Do NOT close the socket for client mistakes; just send error.
        """
        # Step 1: Validate
        if not SharedUtils.validate_message(content, allowed_types=LOBBY_ALLOWED_TYPES):
            self.send_json({"type": "error", "message": "Invalid message payload/type."})
            return

        # Step 2: Normalize
        message_type = (content.get("type") or "").lower().strip()

        # Step 3: Route
        try:
            if message_type == "join_lobby":
                self.handle_join_lobby()

            elif message_type == "leave_lobby":
                self.handle_leave_lobby()

            elif message_type == "start_game":
                self.handle_start_game()

            else:
                # Should be unreachable because allowed_types is enforced
                self.send_json({"type": "error", "message": f"Unsupported message type: {message_type}"})
                return

        except Exception as exc:
            logger.error("[LOBBY] unexpected error type=%s err=%s", message_type, exc)
            self.send_json({"type": "error", "message": "Server error handling lobby message."})
            return

    def handle_join_lobby(self):
        # Step 1: Idempotent resync (connect already joined)
        self.game_lobby_manager.add_player(self.redis_scope_id, self.user)
        self.game_lobby_manager.add_channel(self.redis_scope_id, self.channel_name)
        self.game_lobby_manager.broadcast_player_list(self.channel_layer, self.redis_scope_id)

    def handle_leave_lobby(self):
        # Step 1: Client-initiated leave
        try:
            self.game_lobby_manager.remove_player(self.redis_scope_id, self.user)
            self.game_lobby_manager.remove_channel(self.redis_scope_id, self.channel_name)
        except Exception:
            pass

        try:
            self.game_lobby_manager.broadcast_player_list(self.channel_layer, self.redis_scope_id)
        except Exception:
            pass

        self.close(code=1000)

    def handle_start_game(self):
        """
        Start game orchestration (lobby socket responsibility):
        - requires X and O present in Redis
        - only X can start (prevents double-start races)
        - persist player assignments + current_turn to DB (transaction + row lock)
          using field names/values appropriate for this lobby's game_type
        - ensure sessionKey exists for this lobby
        - broadcast game_start_acknowledgment with game_id + gameType + sessionKey
        """
        cfg = get_game_type_config(self.game_type)

        # Step 1: Require X and O (roles are Redis-authoritative)
        players = self.game_lobby_manager.get_players_with_roles(self.redis_scope_id) or []
        player_x = next((p for p in players if p.get("role") == "X"), None)
        player_o = next((p for p in players if p.get("role") == "O"), None)

        if not player_x or not player_o:
            self.send_json(
                {
                    "type": "error",
                    "message": "Waiting for 2 players (X and O) to join the lobby.",
                }
            )
            return

        # Step 2: Only X can start (prevents double-start races)
        me = next((p for p in players if str(p.get("id")) == str(getattr(self.user, "id", ""))), None)
        if not me or me.get("role") != "X":
            self.send_json({"type": "error", "message": "Only Player X can start the game."})
            return

        # Step 3: Ensure there is a stable lobby sessionKey for BOTH clients
        # (used by FE to navigate into the game route with ?sessionKey=...)
        session_key = None
        try:
            session_key = self.game_lobby_manager.ensure_session_key(self.redis_scope_id)
        except Exception as exc:
            logger.error("[LOBBY] ensure_session_key failed lobby_id=%s err=%s", self.redis_scope_id, exc)

        # Step 4: Persist into DB safely (transaction + row lock)
        seat_x_field = cfg["seat_fk_names"]["X"]
        seat_o_field = cfg["seat_fk_names"]["O"]
        starting_turn = None

        try:
            GameModel = get_model_for(self.game_type)

            with transaction.atomic():
                game = GameModel.objects.select_for_update().get(id=self.lobby_id)

                # Step 4.1: Idempotency: if already started, do NOT re-randomize
                already_started = bool(
                    getattr(game, f"{seat_x_field}_id", None) and getattr(game, f"{seat_o_field}_id", None)
                )

                if not already_started:
                    starting_seat = random.choice(["X", "O"])
                    starting_turn = cfg["turn_values"][starting_seat]

                    setattr(game, f"{seat_x_field}_id", int(player_x["id"]))
                    setattr(game, f"{seat_o_field}_id", int(player_o["id"]))
                    game.current_turn = starting_turn

                    game.save(update_fields=[seat_x_field, seat_o_field, "current_turn"])
                else:
                    # If already started, use the canonical DB turn
                    starting_turn = game.current_turn

            # Step 4.2: If session_key couldn't be ensured earlier, try a second time
            # (non-fatal, but improves navigation reliability)
            if not session_key:
                try:
                    session_key = self.game_lobby_manager.ensure_session_key(self.redis_scope_id)
                except Exception:
                    session_key = None

        except GameModel.DoesNotExist:
            self.send_json({"type": "error", "message": "Lobby game not found."})
            return
        except Exception as exc:
            logger.error("[LOBBY] start_game persist failed lobby_id=%s err=%s", self.redis_scope_id, exc)
            self.send_json(
                {"type": "error", "message": "Failed to start the game due to a server error."}
            )
            return

        # Step 5: Broadcast ack (include gameType + sessionKey + canonical state)
        async_to_sync(self.channel_layer.group_send)(
            self.lobby_group_name,
            {
                "type": "game_start_acknowledgment",
                "message": "Game has started successfully!",
                "game_type": self.game_type,
                "game_id": str(self.lobby_id),
                "sessionKey": session_key,
                "current_turn": starting_turn,
                "player_x": player_x,
                "player_o": player_o,
            },
        )

    # Group event passthrough
    def update_player_list(self, event: dict) -> None:
        players = event.get("players", [])
        self.send_json({"type": "update_player_list", "players": players})

    def game_start_acknowledgment(self, event: dict) -> None:
        self.send_json(
            {
                "type": "game_start_acknowledgment",
                "message": event.get("message"),
                "game_type": event.get("game_type"),
                "game_id": event.get("game_id"),
                "current_turn": event.get("current_turn"),
            }
        )
