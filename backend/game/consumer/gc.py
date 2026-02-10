# Filename: game/consumer/game_consumer.py
# ✅ New Code

import logging
import time
from urllib.parse import parse_qs

from asgiref.sync import async_to_sync
from channels.generic.websocket import JsonWebsocketConsumer
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import PermissionDenied as DRFPermissionDenied
from rest_framework.exceptions import ValidationError as DRFValidationError

from invites.guards import validate_invite_for_lobby_join
from utils.game.game_utils import GameUtils
from utils.shared.shared_utils_game_chat import SharedUtils

logger = logging.getLogger(__name__)


class GameConsumer(JsonWebsocketConsumer):
    """
    WebSocket consumer for managing game-specific functionality.

    Invite v2:
    - If `?invite=<uuid>` is present, we validate the invite before accepting.
    - Close codes:
        - 4403: Forbidden (not invited / not allowed)
        - 4408: Expired
        - 4404: Invalid (mismatch/invalid invite)
    """



    def receive_json(self, content: dict, **kwargs) -> None:
        """
        Route incoming messages to handlers.
        """
        logger.info("GameConsumer received message: %s", content)

        # Step 1: Validate message shape
        if not SharedUtils.validate_message(content):
            self.close(code=4003)
            return

        # Step 2: Normalize type
        message_type = (content.get("type") or "").lower()

        try:
            if message_type == "join_lobby":
                self.handle_join_lobby(content)
            elif message_type == "start_game":
                self.handle_start_game()
            elif message_type == "move":
                self.handle_move(content)
            elif message_type == "rematch_request":
                self.handle_rematch_request()
            elif message_type == "rematch_accept":
                self.handle_rematch_accept()
            elif message_type == "rematch_decline":
                self.handle_rematch_decline()
            else:
                SharedUtils.send_error(self, "Invalid message type.")
        except Exception as exc:
            logger.error("Unexpected error in GameConsumer: %s", exc)
            SharedUtils.send_error(self, f"An unexpected error occurred: {str(exc)}")

    def handle_join_lobby(self, content: dict) -> None:
        """
        Confirm the user has joined the lobby and broadcast player list.
        """
        # Step 1: Validate game id matches
        incoming_game_id = content.get("gameId")
        if str(incoming_game_id) != str(self.game_id):
            self.send_json({"type": "error", "message": "Invalid game ID."})
            return

        logger.info("User %s attempting to join lobby: %s", self.user.first_name, self.lobby_group_name)

        # Step 2: Fetch game instance (authoritative)
        try:
            game = GameUtils.get_game_instance(game_id=self.game_id)
        except ValueError as exc:
            self.send_json({"type": "error", "message": str(exc)})
            return

        # Step 3: Assign role if needed
        player_role = GameUtils.assign_player_role(game=game, user=self.user)

        # Step 4: Track player in lobby list + broadcast updated players
        GameUtils.add_player_to_lobby(user=self.user, group_name=self.lobby_group_name, player_role=player_role)

        self.update_player_list({"players": GameUtils.lobby_players.get(self.lobby_group_name, [])})

        # Step 5: Acknowledge join
        self.send_json(
            {
                "type": "join_lobby_success",
                "message": f"Successfully joined lobby {self.lobby_group_name} as {player_role}.",
                "player_role": player_role,
            }
        )

    def handle_start_game(self) -> None:
        """
        Start game when exactly two players are present, then broadcast ack.
        """
        logger.info("GameConsumer.handle_start_game triggered for lobby %s", self.lobby_group_name)

        # Step 1: Validate lobby players exist
        try:
            players = GameUtils.validate_lobby(group_name=self.lobby_group_name)
        except ValueError as exc:
            self.send_json({"type": "error", "message": str(exc)})
            return

        # Step 2: Require 2 players
        if len(players) != 2:
            self.send_json({"type": "error", "message": "The game requires exactly two players to start."})
            return

        # Step 3: Randomize turn + assign players
        starting_turn, player_x, player_o = GameUtils.randomize_turn(players=players)

        # Step 4: Initialize game
        try:
            game = GameUtils.initialize_game(
                game_id=self.game_id,
                player_x=player_x,
                player_o=player_o,
                starting_turn=starting_turn,
            )
        except Exception as exc:
            logger.error("Failed to start the game: %s", exc)
            self.send_json({"type": "error", "message": "Failed to start the game due to a server error."})
            return

        # Step 5: Broadcast start ack
        async_to_sync(self.channel_layer.group_send)(
            self.lobby_group_name,
            {
                "type": "game_start_acknowledgment",
                "message": "Game has started successfully!",
                "game_id": str(game.id),
                "current_turn": starting_turn,
            },
        )

    def game_start_acknowledgment(self, event: dict) -> None:
        """
        Forward game start ack to this client.
        """
        self.send_json(
            {
                "type": "game_start_acknowledgment",
                "message": event.get("message"),
                "game_id": event.get("game_id"),
                "current_turn": event.get("current_turn"),
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

        # Step 7: Broadcast game update to group
        async_to_sync(self.channel_layer.group_send)(
            self.lobby_group_name,
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

    def game_update(self, event: dict) -> None:
        """
        Send updated game state to this client.

        Important:
        - Do not require DB lookups to send the core payload.
        - Optionally enrich player info if available.
        """
        required_keys = ["board_state", "current_turn", "winner"]
        if not all(k in event for k in required_keys):
            self.send_json({"type": "error", "message": "Invalid game update payload."})
            return

        player_role = None
        player_x_info = None
        player_o_info = None
        is_completed = event.get("is_completed", False)

        # Optional enrichment (safe fallback if lobbyId != gameId edge cases exist)
        try:
            game = GameUtils.get_game_instance(self.game_id)
            player_role = GameUtils.determine_player_role(user=self.user, game=game)
            is_completed = getattr(game, "is_completed", is_completed)

            if getattr(game, "player_x", None):
                player_x_info = {"id": game.player_x.id, "first_name": game.player_x.first_name}

            if getattr(game, "player_o", None):
                player_o_info = {"id": game.player_o.id, "first_name": game.player_o.first_name}
        except Exception:
            pass

        self.send_json(
            {
                "type": "game_update",
                "game_id": str(event.get("game_id")),
                "board_state": event["board_state"],
                "current_turn": event["current_turn"],
                "winner": event["winner"],
                "is_completed": is_completed,
                "winning_combination": event.get("winning_combination", []),
                "player_role": player_role,
                "player_x": player_x_info,
                "player_o": player_o_info,
            }
        )

    def update_player_list(self, event: dict) -> None:
        """
        Send updated player list to this client.
        """
        players = event.get("players", [])
        validated_players = [
            p for p in players if isinstance(p.get("id"), int) and isinstance(p.get("first_name"), str)
        ]

        self.send_json({"type": "update_player_list", "players": validated_players})

    # ----------------------------
    # Rematch (keep your existing handlers below as-is)
    # ----------------------------
    def handle_rematch_request(self) -> None:
        logger.info("User %s is requesting a rematch", self.user.first_name)

        try:
            game = GameUtils.get_game_instance(game_id=self.game_id)
        except Exception as exc:
            logger.error("[Rematch Request] Failed to fetch game instance: %s", exc)
            SharedUtils.send_error(self, "Failed to find current game.")
            return

        try:
            requester_role = GameUtils.determine_player_role(self.user, game)
        except Exception as exc:
            logger.error("[Rematch Request] Failed to determine player role: %s", exc)
            SharedUtils.send_error(self, "Could not determine player role.")
            return

        if requester_role not in ("X", "O"):
            SharedUtils.send_error(self, "Only players X or O may request a rematch.")
            return

        if not game.player_x or not game.player_o:
            SharedUtils.send_error(self, "Both players must be present to request a rematch.")
            return

        requester_user_id = self.user.id
        receiver_user_id = game.player_o.id if requester_role == "X" else game.player_x.id

        async_to_sync(self.channel_layer.group_send)(
            self.lobby_group_name,
            {
                "type": "rematch_offer_broadcast",
                "game_id": str(self.game_id),
                "message": f"{self.user.first_name} wants a rematch!",
                "rematchRequestedBy": requester_role,
                "requesterUserId": requester_user_id,
                "receiverUserId": receiver_user_id,
                "createdAtMs": int(time.time() * 1000),
                "isRematchOfferVisible": True,
                "rematchPending": True,
            },
        )

    def rematch_offer_broadcast(self, event: dict) -> None:
        try:
            receiver_user_id = event.get("receiverUserId")
            show_actions = bool(receiver_user_id and self.user.id == receiver_user_id)
            ui_mode = "receiver" if show_actions else "requester"

            self.send_json(
                {
                    "type": "rematch_offer",
                    "game_id": event.get("game_id", str(self.game_id)),
                    "message": event.get("message", "Rematch requested."),
                    "rematchRequestedBy": event.get("rematchRequestedBy"),
                    "requesterUserId": event.get("requesterUserId"),
                    "receiverUserId": receiver_user_id,
                    "showActions": show_actions,
                    "uiMode": ui_mode,
                    "createdAtMs": event.get("createdAtMs"),
                    "isRematchOfferVisible": event.get("isRematchOfferVisible", True),
                    "rematchPending": event.get("rematchPending", True),
                }
            )
        except Exception as exc:
            logger.error("[rematch_offer_broadcast] Error: %s", exc)
            SharedUtils.send_error(self, "Failed to broadcast rematch offer.")

    def handle_rematch_accept(self) -> None:
        # Keep your existing implementation (unchanged)
        raise NotImplementedError

    def handle_rematch_decline(self) -> None:
        logger.info("User %s declined a rematch in %s", self.user.first_name, self.lobby_group_name)
        async_to_sync(self.channel_layer.group_send)(
            self.lobby_group_name,
            {
                "type": "rematch_declined_broadcast",
                "game_id": str(self.game_id),
                "message": f"{self.user.first_name} declined the rematch.",
                "declinedByUserId": getattr(self.user, "id", None),
                "isRematchOfferVisible": False,
                "rematchPending": False,
            },
        )

    def rematch_declined_broadcast(self, event: dict) -> None:
        self.send_json(
            {
                "type": "rematch_declined",
                "game_id": event.get("game_id", str(self.game_id)),
                "message": event.get("message", "Rematch declined."),
                "declinedByUserId": event.get("declinedByUserId"),
                "isRematchOfferVisible": event.get("isRematchOfferVisible", False),
                "rematchPending": event.get("rematchPending", False),
            }
        )

    def disconnect(self, code: int) -> None:
        """
        Always discard channel from group, and optionally clean lobby state.
        """
        group = getattr(self, "lobby_group_name", None)
        if not group:
            return

        logger.debug(
            "[WS-DISCONNECT] user=%s group=%s code=%s",
            getattr(getattr(self, "user", None), "id", None),
            group,
            code,
        )

        # Step 1: Try game completion check (optional)
        try:
            game = GameUtils.get_game_instance(self.game_id)
            if getattr(game, "is_completed", False):
                logger.info("[WS-DISCONNECT] Game %s completed. Retaining player data for rematch.", game.id)
        except Exception:
            pass

        # Step 2: Always discard from channels group (prevents ghost channels)
        try:
            async_to_sync(self.channel_layer.group_discard)(group, self.channel_name)
        except Exception as exc:
            logger.error("[WS-DISCONNECT] group_discard error: %s", exc)
