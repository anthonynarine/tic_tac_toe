# Filename: game/consumer/game_consumer.py

import logging
import time
import random
from urllib.parse import parse_qs
from django.apps import apps

from asgiref.sync import async_to_sync
from channels.generic.websocket import JsonWebsocketConsumer
from django.core.exceptions import ValidationError
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import PermissionDenied as DRFPermissionDenied
from rest_framework.exceptions import ValidationError as DRFValidationError

from invites.guards import validate_invite_for_lobby_join
from utils.game.game_utils import GameUtils
from utils.redis.redis_game_lobby_manager import RedisGameLobbyManager
from utils.shared.shared_utils_game_chat import SharedUtils
from utils.websockets.ws_groups import game_group

logger = logging.getLogger("game")

GAME_ALLOWED_TYPES = {
    "move",
    "sync_state",         
    "rematch_request",
    "rematch_accept",
    "rematch_decline",
    "rematch_timeout",
}

def _extract_drf_validation_message(exc: DRFValidationError) -> str:
    """
    Extract a readable message from DRFValidationError.

    Args:
        exc: DRF validation exception.

    Returns:
        A best-effort string message.
    """
    # Step 1: Try common DRF shapes
    detail = getattr(exc, "detail", None)

    if isinstance(detail, dict):
        if "detail" in detail:
            return str(detail["detail"])
        return str(detail)

    if isinstance(detail, list) and detail:
        return str(detail[0])

    if detail is not None:
        return str(detail)

    return str(exc)

class GameConsumer(JsonWebsocketConsumer):
    """
    WebSocket consumer for managing game-specific functionality.
    """

    def _accept_and_close(self, code: int) -> None:
        """
        Accept then close so the client (and Channels tests) receive close codes.

        Args:
            code: WebSocket close code.
        """
        # Step 1: Accept handshake so close frame is actually emitted
        self.accept()
        self.close(code=code)
        
    def connect(self) -> None:
        """
        Game WebSocket connect for a specific game.

        Production rules (Game WS):
        - No invite-based join here (invite belongs to Lobby WS).
        - Requires sessionKey + lobbyId for authorization.
        - Joins game group only.
        - Sends authoritative snapshot immediately (game_state).
        """
        # Step 1: Extract game_id and derive GAME group name (not lobby group)
        raw_game_id = self.scope.get("url_route", {}).get("kwargs", {}).get("game_id")
        if not raw_game_id:
            self._accept_and_close(code=4002)
            return

        self.game_id = str(raw_game_id)

        # ✅ Step 1b: Canonical game group (imported at module top)
        self.game_group_name = game_group(self.game_id)

        # Step 2: Authenticate user
        self.user = SharedUtils.authenticate_user(self.scope)
        if not self.user:
            self._accept_and_close(code=4001)
            return

        # Step 3: Parse query string (Game WS requires sessionKey + lobbyId)
        raw_qs = (self.scope.get("query_string") or b"").decode("utf-8")
        qs = parse_qs(raw_qs)

        invite_id = (qs.get("invite") or [None])[0]

        # ✅ Step 3a: Accept lobby param in any common naming
        lobby_id = (
            (qs.get("lobby") or [None])[0]
            or (qs.get("lobbyId") or [None])[0]
            or (qs.get("lobby_id") or [None])[0]
        )

        session_key = (qs.get("sessionKey") or [None])[0]

        # Step 3b: Reject invite-based connects on Game WS (use Lobby WS for that)
        if invite_id:
            logger.warning(
                "[GAME_CONNECT] invite provided on game ws (reject). game_id=%s lobby_id=%s user_id=%s",
                self.game_id, lobby_id, getattr(self.user, "id", None),
            )
            self._accept_and_close(code=4003)  # protocol violation
            return

        if not lobby_id or not session_key:
            logger.warning(
                "[GAME_CONNECT] missing lobby/sessionKey. game_id=%s lobby_id=%s user_id=%s",
                self.game_id, lobby_id, getattr(self.user, "id", None),
            )
            self._accept_and_close(code=4404)
            return

        self.lobby_id = str(lobby_id)

        # ✅ Step 3c: Hard guard — for TicTacToe, lobby id should equal game id
        # This prevents a valid sessionKey for lobby A being used to connect to game B.
        if self.lobby_id != self.game_id:
            logger.warning(
                "[GAME_CONNECT] lobby/game mismatch (reject). game_id=%s lobby_id=%s user_id=%s",
                self.game_id, self.lobby_id, self.user.id,
            )
            self._accept_and_close(code=4409)
            return

        # Step 4: Initialize Redis manager
        self.game_lobby_manager = RedisGameLobbyManager()

        # Step 5: Validate sessionKey + allow-list membership
        try:
            is_valid = self.game_lobby_manager.validate_session_key(
                lobby_id=self.lobby_id,
                session_key=str(session_key),
                user_id=self.user.id,
            )
        except Exception as exc:
            logger.error(
                "[GAME_CONNECT] session validation error. lobby_id=%s user_id=%s err=%s",
                self.lobby_id, self.user.id, exc,
            )
            self._accept_and_close(code=4500)
            return

        if not is_valid:
            logger.warning(
                "[GAME_CONNECT] invalid/expired session. lobby_id=%s user_id=%s",
                self.lobby_id, self.user.id,
            )
            self._accept_and_close(code=4408)
            return

        # Optional: refresh allow-list TTL (best effort)
        try:
            self.game_lobby_manager.add_user_to_session(self.lobby_id, self.user.id)
        except Exception:
            pass

        # Step 6: Join GAME group + accept
        async_to_sync(self.channel_layer.group_add)(self.game_group_name, self.channel_name)
        self.accept()

        # Step 7: Load game + determine role (needed for move validation)
        try:
            self.game = GameUtils.get_game_instance(game_id=self.game_id)
        except Exception as exc:
            logger.error("[GAME_CONNECT] failed to load game. game_id=%s err=%s", self.game_id, exc)
            self.send_json({"type": "error", "message": "Failed to load game."})
            self.close(code=4500)
            return

        # (Optional) compute role for local validation (no Redis roster broadcasting here)
        self.role = "Spectator"
        try:
            GameModel = apps.get_model("game", "Game")
            game = GameModel.objects.only("player_x_id", "player_o_id").get(id=self.game_id)
            if game.player_x_id == self.user.id:
                self.role = "X"
            elif game.player_o_id == self.user.id:
                self.role = "O"
        except Exception:
            pass

        # Step 8: Send authoritative snapshot immediately
        self.send_game_state_snapshot(reason="connect")

    def receive_json(self, content: dict, **kwargs) -> None:
        """
        Handle incoming gameplay-related messages from the WebSocket client.
        """
        logger.info("GameConsumer received message: %s", content)

        # Step 2: Validate structure + enforce allowed message types (gameplay only)
        if not SharedUtils.validate_message(content, allowed_types=GAME_ALLOWED_TYPES):
            # IMPORTANT: Do NOT close for bad client payload; just respond
            self.send_json({"type": "error", "message": "Invalid message payload/type (gameplay socket)."})
            return

        # Step 3: Normalize message type
        message_type = content.get("type", "").lower().strip()

        # Step 4: Only load game when needed (gameplay only)
        requires_game = message_type in {
            "sync_state",
            "move",
            "rematch_request",
            "rematch_accept",
            "rematch_decline",
            "rematch_timeout",
        }

        if requires_game and not getattr(self, "game", None):
            try:
                self.game = GameUtils.get_game_instance(game_id=self.game_id)
            except Exception as exc:
                logger.error("Failed to fetch game instance in receive_json: %s", exc)
                self.send_json({"type": "error", "message": "Unable to fetch game instance."})
                return

        # Step 5: Route gameplay-only messages
        try:
            if message_type == "sync_state":
                self.handle_sync_state()
                return

            if message_type == "move":
                self.handle_move(content)
                return

            if message_type == "rematch_request":
                self.handle_rematch_request()
                return

            if message_type == "rematch_accept":
                self.handle_rematch_accept()
                return

            if message_type == "rematch_decline":
                self.handle_rematch_decline()
                return

            if message_type == "rematch_timeout":
                self.handle_rematch_timeout()
                return

            # Should be unreachable due to allowed_types enforcement
            self.send_json({"type": "error", "message": "Unsupported gameplay message type."})
            return

        except Exception as exc:
            logger.error("Unexpected error in GameConsumer: %s", exc)
            self.send_json({"type": "error", "message": "Server error handling game message."})
            return

    def send_game_state_snapshot(self, reason: str = "unknown") -> None:
        """
        Sends authoritative game state snapshot to THIS client.
        """
        # You can either implement GameUtils.serialize_game_state(...) or inline fields.
        snapshot = GameUtils.serialize_game_state(self.game)

        self.send_json(
            {
                "type": "game_state",
                "reason": reason,          # "connect" | "sync_state"
                "gameId": str(self.game_id),
                **snapshot,
            }
        )

    def game_start_acknowledgment(self, event: dict) -> None:
        """
        Handle the game_start_acknowledgment group event.
        """
        logger.info("Broadcasting game start acknowledgment: %s", event)

        self.send_json(
            {
                "type": "game_start_acknowledgment",
                "message": event["message"],
                "game_id": event["game_id"],
                "current_turn": event["current_turn"],
            }
        )

    def handle_move(self, content: dict) -> None:
        """
        Handle a move made by a player and broadcast the updated game state.
        """
        # Step 1: Extract position + use authenticated user
        position = content.get("position")
        user = self.user

        # Step 2: Validate position
        if position is None:
            self.send_json({"type": "error", "message": "Invalid move: Position is missing."})
            return

        if not isinstance(position, int) or not (0 <= position < 9):
            self.send_json({"type": "error", "message": "Invalid move: Position must be an integer between 0 and 8."})
            return

        # Step 3: Fetch game instance
        try:
            game = GameUtils.get_game_instance(game_id=self.game_id)
        except ValueError as exc:
            self.send_json({"type": "error", "message": str(exc)})
            return

        # Step 4: Determine marker (X/O)
        if user == game.player_x:
            player_marker = "X"
        elif user == game.player_o:
            player_marker = "O"
        else:
            self.send_json({"type": "error", "message": "You are not a participant in this game."})
            return

        logger.info("Player %s (%s) made a move at position %s", user.first_name, player_marker, position)

        # Step 5: Apply move
        try:
            game.make_move(position=position, player=player_marker)
            game.refresh_from_db()
        except (DjangoValidationError, DRFValidationError) as exc:
            self.send_json({"type": "error", "message": str(exc) or "Invalid move."})
            return
        except Exception as exc:
            logger.error("Unexpected error applying move: %s", exc)
            self.send_json({"type": "error", "message": "Server error applying move."})
            return

        # Step 6: Normalize winner to JSON-safe primitive
        winner_value = getattr(game, "winner", None)
        if hasattr(winner_value, "id"):
            winner_value = winner_value.id

        # Step 7: Broadcast game update to GAME group (not lobby)
        async_to_sync(self.channel_layer.group_send)(
            self.game_group_name,
            {
                "type": "game_update",
                "game_id": str(game.id),
                "board_state": game.board_state,
                "current_turn": game.current_turn,
                "winner": winner_value,
                "is_completed": getattr(game, "is_completed", False),
                "winning_combination": getattr(game, "winning_combination", []),
            },
        )

        logger.info(
            "[BROADCAST] game_update -> group=%s game_id=%s board=%s turn=%s winner=%s",
            self.game_group_name,
            game.id,
            game.board_state,
            game.current_turn,
            game.winner,
        )

    def update_player_list(self, event: dict) -> None:
        """
        Handle the update_player_list event for the game lobby.

        Args:
            event: Expected to contain "players".
        """
        players = event.get("players", [])
        validated_players = [
            p for p in players if isinstance(p.get("id"), int) and isinstance(p.get("first_name"), str)
        ]

        logger.debug("GameConsumer processing update_player_list event: %s", validated_players)

        self.send_json({"type": "update_player_list", "players": validated_players})
        logger.info("GameConsumer sent updated player list: %s", validated_players)

    def game_update(self, event: dict) -> None:
        """
        Send the updated game state to this client.

        Key rule:
        - Always deliver the core update from the event payload.
        - Enrichment (player info / AI labels) is best-effort only.
        """
        logger.info("Received game update event: %s", event)

        # Step 1: Validate required keys (core contract)
        required_keys = ["board_state", "current_turn", "winner"]
        if not all(key in event for key in required_keys):
            logger.error("Missing keys in event: %s", event)
            self.send_json({"type": "error", "message": "Invalid game update payload."})
            return

        # Step 2: Start with core payload (never depends on DB)
        payload = {
            "type": "game_update",
            "game_id": str(event.get("game_id", getattr(self, "game_id", ""))),
            "board_state": event["board_state"],
            "current_turn": event["current_turn"],
            "winner": event["winner"],
            "is_completed": event.get("is_completed", False),
            "winning_combination": event.get("winning_combination", []),
            # Enrichment defaults
            "player_role": None,
            "player_x": None,
            "player_o": None,
        }

        # Step 3: Best-effort enrichment (safe fallback if GameUtils fails)
        try:
            game = GameUtils.get_game_instance(self.game_id)

            ai_user = None
            if getattr(game, "is_ai_game", False):
                ai_user = self.get_ai_user()

            payload["is_completed"] = getattr(game, "is_completed", payload["is_completed"])
            payload["player_role"] = GameUtils.determine_player_role(user=self.user, game=game)

            if getattr(game, "player_x", None):
                payload["player_x"] = {"id": game.player_x.id, "first_name": game.player_x.first_name}

            payload["player_o"] = {
                "id": game.player_o.id if game.player_o else None,
                "first_name": (
                    "AI"
                    if getattr(game, "is_ai_game", False) and ai_user and game.player_o == ai_user
                    else (game.player_o.first_name if game.player_o else "Waiting...")
                ),
            }
        except Exception as exc:
            # Important: do NOT block the update if enrichment fails
            logger.warning("game_update enrichment skipped: %s", exc)

        # Step 4: Send the update
        self.send_json(payload)
        logger.info("Game update sent successfully.")

    def handle_rematch_request(self) -> None:
        """
        Handle when a player initiates a rematch request.

        Guarantees:
        - Uses DB-authoritative roles (game.player_x / game.player_o).
        - Stores full offer in Redis with TTL (prevents stale offers).
        - Dedupe: if an offer already exists, do not create a new one; resync broadcast instead.
        - Broadcasts requesterUserId + receiverUserId so frontend never guesses.
        - Socket-safe: never throws and closes the connection.
        """
        logger.info(
            "[REMATCH][REQUEST] user_id=%s name=%s game_id=%s",
            self.user.id,
            self.user.first_name,
            self.game_id,
        )

        # Step 1: Load the game from DB (authoritative mapping)
        try:
            game = GameUtils.get_game_instance(game_id=self.game_id)
        except Exception as exc:
            logger.error("[REMATCH][REQUEST] Failed to fetch game: %s", exc)
            self.send_json({"type": "error", "message": "Unable to process rematch request."})
            return

        logger.info(
            "[REMATCH][REQUEST][STATE] game_id=%s is_completed=%s player_x_id=%s player_o_id=%s requester_id=%s",
            self.game_id,
            getattr(game, "is_completed", None),
            getattr(getattr(game, "player_x", None), "id", None),
            getattr(getattr(game, "player_o", None), "id", None),
            getattr(self.user, "id", None),
        )

        # Step 2: Ensure game is completed
        if not getattr(game, "is_completed", False):
            logger.warning(
                "[REMATCH][REQUEST] Rejected: game not completed. game_id=%s user_id=%s",
                self.game_id,
                self.user.id,
            )
            self.send_json({"type": "error", "message": "Rematch is only available after the game ends."})
            return

        # Step 3: Ensure both players exist
        if not getattr(game, "player_x", None) or not getattr(game, "player_o", None):
            logger.warning(
                "[REMATCH][REQUEST] Rejected: missing players. game_id=%s user_id=%s",
                self.game_id,
                self.user.id,
            )
            self.send_json({"type": "error", "message": "Both players must be present to rematch."})
            return

        # Step 4: Determine requester role via DB mapping (stable)
        try:
            requester_role = GameUtils.determine_player_role(user=self.user, game=game)
        except Exception as exc:
            logger.error("[REMATCH][REQUEST] Failed to determine role: %s", exc)
            self.send_json({"type": "error", "message": "Unable to determine player role."})
            return

        logger.info(
            "[REMATCH][REQUEST][ROLE] requester_id=%s requester_role=%s",
            self.user.id,
            requester_role,
        )

        if requester_role not in ("X", "O"):
            logger.warning(
                "[REMATCH][REQUEST] Rejected: invalid role. user_id=%s role=%s",
                self.user.id,
                requester_role,
            )
            self.send_json(
                {"type": "error", "message": "Only players assigned as X or O may request a rematch."}
            )
            return

        # Step 5: Determine receiver user (the other player)
        receiver_user = game.player_o if requester_role == "X" else game.player_x

        # Step 6: Dedupe — if an offer is already pending, resync broadcast
        try:
            existing_offer = self.game_lobby_manager.get_rematch_offer(str(self.game_id))
        except Exception as exc:
            logger.error("[REMATCH][REQUEST] Failed reading existing offer from Redis: %s", exc)
            existing_offer = None

        logger.info(
            "[REMATCH][REQUEST][REDIS] existing_offer_present=%s",
            bool(existing_offer),
        )

        if existing_offer:
            logger.info(
                "[REMATCH][REQUEST] Duplicate request -> resync broadcast. game_id=%s user_id=%s",
                self.game_id,
                self.user.id,
            )

            try:
                async_to_sync(self.channel_layer.group_send)(
                    self.lobby_group_name,
                    {
                        "type": "rematch_offer_broadcast",
                        "game_id": str(self.game_id),
                        **existing_offer,
                        "message": existing_offer.get(
                            "message",
                            f"{self.user.first_name} wants a rematch!",
                        ),
                        "isRematchOfferVisible": True,
                        "rematchPending": True,
                    },
                )
                logger.info(
                    "[REMATCH][REQUEST] Resync broadcast sent. game_id=%s group=%s",
                    self.game_id,
                    self.lobby_group_name,
                )
            except Exception as exc:
                logger.error(
                    "[REMATCH][REQUEST] Resync broadcast failed. game_id=%s err=%s",
                    self.game_id,
                    exc,
                )
            return

        # Step 7: Build offer payload (authoritative)
        offer = {
            "rematchRequestedBy": requester_role,
            "requesterUserId": self.user.id,
            "receiverUserId": receiver_user.id,
            "createdAtMs": int(time.time() * 1000),
            "message": f"{self.user.first_name} wants a rematch!",
            "isRematchOfferVisible": True,
            "rematchPending": True,
        }

        # Step 8: Store offer in Redis with TTL
        try:
            self.game_lobby_manager.store_rematch_offer(str(self.game_id), offer)
            logger.info(
                "[REMATCH][REQUEST] Stored offer. game_id=%s requested_by=%s requester_user_id=%s receiver_user_id=%s",
                self.game_id,
                requester_role,
                self.user.id,
                receiver_user.id,
            )
        except Exception as exc:
            logger.error("[REMATCH][REQUEST] Failed storing offer in Redis: %s", exc)
            self.send_json({"type": "error", "message": "Unable to store rematch offer."})
            return

        # Step 9: Broadcast offer to group
        try:
            async_to_sync(self.channel_layer.group_send)(
                self.lobby_group_name,
                {
                    "type": "rematch_offer_broadcast",
                    "game_id": str(self.game_id),
                    **offer,
                },
            )
            logger.info(
                "[REMATCH][REQUEST] Broadcast sent. game_id=%s group=%s",
                self.game_id,
                self.lobby_group_name,
            )
        except Exception as exc:
            logger.error(
                "[REMATCH][REQUEST] Broadcast failed. game_id=%s err=%s",
                self.game_id,
                exc,
            )

    def rematch_offer_broadcast(self, event: dict) -> None:
        """
        Send a rematch_offer payload to this client.
        """
        logger.info(
            "[REMATCH][OFFER_BROADCAST][IN] user_id=%s game_id=%s channel=%s event=%s",
            self.user.id,
            self.game_id,
            self.channel_name,
            event,
        )
        try:
            receiver_user_id = event.get("receiverUserId")
            show_actions = bool(receiver_user_id and self.user.id == receiver_user_id)
            ui_mode = "receiver" if show_actions else "requester"

            # Step 1: Optional role compute (safe)
            player_role = None
            try:
                game = GameUtils.get_game_instance(game_id=self.game_id)
                player_role = GameUtils.determine_player_role(user=self.user, game=game)
            except Exception:
                player_role = None

            payload = {
                "type": "rematch_offer",
                "game_id": event.get("game_id", self.game_id),
                "message": event.get("message", "Rematch requested."),
                "rematchRequestedBy": event.get("rematchRequestedBy"),
                "requesterUserId": event.get("requesterUserId"),
                "receiverUserId": receiver_user_id,
                "showActions": show_actions,
                "uiMode": ui_mode,
                "playerRole": player_role,
                "createdAtMs": event.get("createdAtMs"),
                "isRematchOfferVisible": event.get("isRematchOfferVisible", True),
                "rematchPending": event.get("rematchPending", True),
            }

            self.send_json(payload)

            logger.info(
                "[REMATCH][OFFER_SENT] to_user_id=%s ui_mode=%s requester_user_id=%s receiver_user_id=%s requested_by=%s game_id=%s",
                self.user.id,
                ui_mode,
                event.get("requesterUserId"),
                receiver_user_id,
                event.get("rematchRequestedBy"),
                event.get("game_id", self.game_id),
            )

        except Exception as exc:
            logger.error("[REMATCH][OFFER_SENT][ERROR] %s", exc)
            SharedUtils.send_error(self, "Failed to deliver rematch offer.")

    def handle_rematch_accept(self) -> None:
        """
        Handle when the receiver accepts a rematch.

        Key fixes:
        - Requires an active offer in Redis.
        - Only receiverUserId can accept.
        - pop_rematch_offer() prevents double accept.
        - ✅ Fix: validate receiver BEFORE deleting the offer.
        """
        logger.info(
            "[REMATCH][ACCEPT] user_id=%s name=%s game_id=%s",
            self.user.id,
            self.user.first_name,
            self.game_id,
        )

        # Step 1: Read offer WITHOUT deleting (prevents wrong-user clicks from deleting state)
        offer_preview = self.game_lobby_manager.get_rematch_offer(self.game_id)
        if not offer_preview:
            SharedUtils.send_error(self, "No pending rematch offer found.")
            return

        receiver_user_id = offer_preview.get("receiverUserId")
        if receiver_user_id and self.user.id != receiver_user_id:
            SharedUtils.send_error(self, "Only the other player may accept this rematch.")
            return

        # Step 2: Now atomically pop the offer (prevents double-accept race)
        offer = self.game_lobby_manager.pop_rematch_offer(self.game_id)
        if not offer:
            SharedUtils.send_error(self, "Rematch offer already consumed.")
            return

        # Step 3: Load old game
        try:
            old_game = GameUtils.get_game_instance(game_id=self.game_id)
        except ValidationError as exc:
            SharedUtils.send_error(self, str(exc))
            return

        old_x = old_game.player_x
        old_o = old_game.player_o
        if not old_x or not old_o:
            SharedUtils.send_error(self, "Cannot rematch because one of the players is missing.")
            return

        # Step 4: Randomize / create new game
        players = [
            {"id": old_x.id, "first_name": old_x.first_name},
            {"id": old_o.id, "first_name": old_o.first_name},
        ]

        try:
            starting_turn, player_x_dict, player_o_dict = GameUtils.randomize_turn(players=players)
            new_game = GameUtils.create_game(
                player_o_id=player_o_dict["id"],
                player_x_id=player_x_dict["id"],
                starting_turn=starting_turn,
            )
        except ValueError as exc:
            SharedUtils.send_error(self, str(exc))
            return

        # Step 5: Broadcast new game id
        # Step 5a: Include lobby/session continuity so next WS connect does NOT require invite
        stable_lobby_id = getattr(self, "lobby_id", str(self.game_id))
        session_key = None
        try:
            session_key = self.game_lobby_manager.ensure_session_key(stable_lobby_id)
        except Exception:
            session_key = None

        async_to_sync(self.channel_layer.group_send)(
            self.lobby_group_name,
            {
                "type": "rematch_start",
                "old_game_id": self.game_id,
                "new_game_id": new_game.id,
                "requesterUserId": offer.get("requesterUserId"),
                "receiverUserId": offer.get("receiverUserId"),
                "lobby_id": stable_lobby_id,
                "sessionKey": session_key,
            },
        )
        
    def handle_rematch_decline(self) -> None:
        """
        Handle when the receiving player declines a rematch offer.

        Server-authoritative rules:
        - Only the intended receiver may decline.
        - Decline clears the offer in Redis.
        - Broadcast notifies both clients to close UI + reset local state.
        """
        logger.info(
            "[REMATCH][DECLINE] user_id=%s name=%s game_id=%s",
            getattr(self.user, "id", None),
            getattr(self.user, "first_name", "?"),
            self.game_id,
        )

        # Step 1: Load current offer
        offer = None
        try:
            offer = self.game_lobby_manager.get_rematch_offer(str(self.game_id))
        except Exception as exc:
            logger.warning("[REMATCH][DECLINE] could not read offer: %s", exc)

        if not offer:
            # No active offer; do not crash, just inform user.
            self.send_json(
                {"type": "error", "message": "No active rematch offer to decline."}
            )
            return

        # Step 2: Authorize decline (receiver-only)
        receiver_user_id = offer.get("receiverUserId")
        if receiver_user_id is None or int(receiver_user_id) != int(self.user.id):
            logger.warning(
                "[REMATCH][DECLINE][FORBIDDEN] user_id=%s is not receiver_user_id=%s game_id=%s",
                getattr(self.user, "id", None),
                receiver_user_id,
                self.game_id,
            )
            self.send_json(
                {"type": "error", "message": "Only the receiving player can decline."}
            )
            return

        # Step 3: Clear offer in Redis (authoritative)
        try:
            self.game_lobby_manager.clear_rematch_offer(str(self.game_id))
        except Exception as exc:
            logger.warning("[REMATCH][DECLINE] could not clear offer: %s", exc)

        # Step 4: Broadcast to entire lobby so both clients close UI
        async_to_sync(self.channel_layer.group_send)(
            self.lobby_group_name,
            {
                "type": "rematch_declined_broadcast",
                "game_id": str(self.game_id),
                "message": f"{self.user.first_name} declined the rematch.",
                "declinedByUserId": getattr(self.user, "id", None),
                "requesterUserId": offer.get("requesterUserId"),
                "receiverUserId": offer.get("receiverUserId"),
                "createdAtMs": offer.get("createdAtMs"),
                "rematchPending": False,
                "isRematchOfferVisible": False,
            },
        )

    def rematch_declined_broadcast(self, event: dict) -> None:
        """
        Send a rematch_declined message to this client.
        """
        try:
            self.send_json(
                {
                    "type": "rematch_declined",
                    "game_id": event.get("game_id", str(self.game_id)),
                    "message": event.get("message", "Rematch declined."),
                    "rematchPending": event.get("rematchPending", False),
                    "isRematchOfferVisible": event.get("isRematchOfferVisible", False),
                    "declinedByUserId": event.get("declinedByUserId"),
                    "requesterUserId": event.get("requesterUserId"),
                    "receiverUserId": event.get("receiverUserId"),
                    "createdAtMs": event.get("createdAtMs"),
                }
            )

            logger.info(
                "[REMATCH][DECLINED_SENT] to_user_id=%s game_id=%s",
                getattr(self.user, "id", None),
                event.get("game_id", str(self.game_id)),
            )
        except Exception as exc:
            logger.error("[REMATCH][DECLINED_SENT][ERROR] %s", exc)
            SharedUtils.send_error(self, "Failed to deliver rematch declined event.")

    def handle_rematch_timeout(self) -> None:
        """
        Handle when a client countdown expires and it wants the server to close the loop.

        Server is authoritative:
        - If offer is already gone (accepted/declined/expired), do nothing.
        - If offer exists, clear it and broadcast rematch_expired to both clients.
        """
        logger.info(
            "[REMATCH][TIMEOUT] user_id=%s game_id=%s",
            getattr(self.user, "id", None),
            self.game_id,
        )

        # Step 1: Check if an offer is still pending
        try:
            offer = self.game_lobby_manager.get_rematch_offer(self.game_id)
        except Exception as exc:
            logger.warning("[REMATCH][TIMEOUT] get_rematch_offer failed: %s", exc)
            offer = None

        if not offer:
            logger.info("[REMATCH][TIMEOUT] No pending offer (already resolved). game_id=%s", self.game_id)
            return

        # Step 2: Clear offer (idempotent)
        try:
            self.game_lobby_manager.clear_rematch_offer(self.game_id)
        except Exception as exc:
            logger.warning("[REMATCH][TIMEOUT] clear_rematch_offer failed: %s", exc)

        # Step 3: Broadcast expiry to both clients
        async_to_sync(self.channel_layer.group_send)(
            self.lobby_group_name,
            {
                "type": "rematch_expired_broadcast",
                "game_id": str(self.game_id),
                "message": "Rematch request expired.",
                "requesterUserId": offer.get("requesterUserId"),
                "receiverUserId": offer.get("receiverUserId"),
                "createdAtMs": offer.get("createdAtMs"),
            },
        )

    def rematch_expired_broadcast(self, event: dict) -> None:
        """
        Send a rematch_expired message to this client so UI can reset cleanly.
        """
        try:
            self.send_json(
                {
                    "type": "rematch_expired",
                    "game_id": event.get("game_id", str(self.game_id)),
                    "message": event.get("message", "Rematch expired."),
                    "rematchPending": False,
                    "isRematchOfferVisible": False,
                    "requesterUserId": event.get("requesterUserId"),
                    "receiverUserId": event.get("receiverUserId"),
                    "createdAtMs": event.get("createdAtMs"),
                }
            )

            logger.info(
                "[REMATCH][EXPIRED_SENT] to_user=%s game_id=%s",
                getattr(self.user, "first_name", "?"),
                event.get("game_id", str(self.game_id)),
            )
        except Exception as exc:
            logger.error("[REMATCH][EXPIRED_SENT][ERROR] %s", exc)
            SharedUtils.send_error(self, "Failed to deliver rematch expired event.")

    def rematch_start(self, event: dict) -> None:
        """
        Notify this client that a rematch has been accepted and a new game has been created.
        """
        try:
            new_game_id = event.get("new_game_id")
            if not new_game_id:
                raise ValueError("Missing new_game_id in rematch_start event")

            self.send_json(
                {
                    "type": "rematch_start",
                    "new_game_id": new_game_id,
                    "lobby_id": event.get("lobby_id"),
                    "sessionKey": event.get("sessionKey"),
                    "message": f"A new rematch game has been created: Game {new_game_id}",
                }
            )

            logger.info(
                "Sent rematch_start to %s for new game ID %s",
                getattr(self.user, "first_name", "?"),
                new_game_id,
            )

        except Exception as exc:
            logger.error("[rematch_start] Error sending new game ID to %s: %s", getattr(self.user, "first_name", "?"), exc)
            SharedUtils.send_error(self, "Failed to initiate rematch transition.")

    def disconnect(self, close_code: int) -> None:
        """
        Clean up state when a WebSocket disconnects.

        Presence is soft-state:
        - Channels should be removed immediately.
        - Player records should NOT be hard-removed on disconnect
        (navigation/reconnects make disconnect unreliable).
        - TTL handles eventual cleanup.

        CRITICAL RULE:
        - In GameConsumer, Redis cleanup keys MUST be game_id (never lobby_id).
        """
        # Step 1: Safe attribute access
        user = getattr(self, "user", None)
        game_lobby_manager = getattr(self, "game_lobby_manager", None)
        game_id = getattr(self, "game_id", None)

        group_name = (
            getattr(self, "group_name", None)
            or getattr(self, "lobby_group_name", None)
        )

        #  ALWAYS use game_id for Redis keys in GameConsumer
        redis_key = str(game_id) if game_id else None

        logger.debug(
            "[DISCONNECT] user=%s user_id=%s group=%s close_code=%s redis_key=%s channel=%s",
            getattr(user, "first_name", "?"),
            getattr(user, "id", None),
            group_name or "?",
            close_code,
            redis_key,
            getattr(self, "channel_name", None),
        )

        try:
            if game_lobby_manager and redis_key:
                # Step 2: Always remove the channel (channel is truly dead)
                try:
                    game_lobby_manager.remove_channel(redis_key, self.channel_name)
                except Exception as exc:
                    logger.debug("[DISCONNECT] remove_channel failed: %s", exc)

                # Step 3: Do NOT remove_player here (soft presence)
                # Let TTL expire player records instead.

                # Step 4: Broadcast player list after channel removal
                try:
                    game_lobby_manager.broadcast_player_list(self.channel_layer, redis_key)
                except Exception as exc:
                    logger.debug("[DISCONNECT] broadcast_player_list failed: %s", exc)
            else:
                logger.debug(
                    "[DISCONNECT] Skipping Redis cleanup (manager/key missing). redis_key=%s",
                    redis_key,
                )

        except Exception as exc:
            logger.error(
                "[DISCONNECT] Error while cleaning up user=%s err=%s",
                getattr(user, "first_name", "?"),
                exc,
            )
        finally:
            # Step 5: Always discard from group
            try:
                if group_name:
                    async_to_sync(self.channel_layer.group_discard)(group_name, self.channel_name)
            except Exception as exc:
                logger.debug("[DISCONNECT] group_discard failed: %s", exc)
