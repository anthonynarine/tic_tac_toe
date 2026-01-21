# Filename: game/consumer/game_consumer.py

import logging
import time
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

logger = logging.getLogger("game")


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
        WebSocket connect for a specific game.

        Session rules (standard):
        - First join: invite-based
            /ws/game/<gameId>/?token=...&invite=<uuid>&lobby=<lobbyId>
        -> validates invite, mints sessionKey, allow-lists user, sends session_established.

        - Subsequent joins (including rematch games): session-based
            /ws/game/<newGameId>/?token=...&sessionKey=<sessionKey>&lobby=<lobbyId>
        -> validates sessionKey + allow-list membership.

        Guarantees:
        - Joins group + accepts once (or closes with a code).
        - Initializes Redis manager on self.
        - Tracks player + channel.
        - Syncs DB-truth role to Redis roles hash.
        - Broadcasts player list.
        """
        # Step 1: Extract game_id and derive group name
        self.game_id = self.scope["url_route"].get("kwargs", {}).get("game_id")
        self.lobby_group_name = f"game_lobby_{self.game_id}"

        if not self.game_id:
            self.close(code=4002)
            return

        # Step 2: Authenticate user
        self.user = SharedUtils.authenticate_user(self.scope)
        if not self.user:
            self.close(code=4001)
            return

        # Step 3: Parse query string
        raw_qs = (self.scope.get("query_string") or b"").decode("utf-8")
        qs = parse_qs(raw_qs)

        invite_id = (qs.get("invite") or [None])[0]
        lobby_id = (qs.get("lobby") or [None])[0]
        session_key = (qs.get("sessionKey") or [None])[0]

        # Step 4: Stable lobby_id (required for session continuity)
        stable_lobby_id = str(lobby_id or self.game_id)
        self.lobby_id = stable_lobby_id

        logger.info(
            "[CONNECT] user_id=%s game_id=%s group=%s invite=%s lobby=%s has_sessionKey=%s",
            self.user.id,
            self.game_id,
            self.lobby_group_name,
            invite_id,
            stable_lobby_id,
            bool(session_key),
        )

        # Step 5: Initialize Redis manager on the instance
        self.game_lobby_manager = RedisGameLobbyManager()

        # Step 6: Authorization path (invite OR sessionKey)
        minted_session_key = None

        if invite_id:
            # Step 6a: Invite-based join (first join)
            try:
                validate_invite_for_lobby_join(
                    user=self.user,
                    lobby_id=stable_lobby_id,
                    invite_id=str(invite_id),
                )
            except Exception as exc:
                logger.error(
                    "[INVITE_GUARD] reject. game_id=%s invite_id=%s user_id=%s err=%s",
                    self.game_id,
                    invite_id,
                    self.user.id,
                    exc,
                )
                self.close(code=4404)
                return

            # Step 6b: Create/reuse sessionKey + allow-list user
            try:
                minted_session_key = self.game_lobby_manager.ensure_session_key(stable_lobby_id)
                self.game_lobby_manager.add_user_to_session(stable_lobby_id, self.user.id)
            except Exception as exc:
                logger.error(
                    "[SESSION] failed to mint/allow-list. lobby_id=%s user_id=%s err=%s",
                    stable_lobby_id,
                    self.user.id,
                    exc,
                )
                self.close(code=4500)
                return

        else:
            # Step 6c: Session-based join (rematches / reconnect)
            if not session_key:
                logger.warning(
                    "[SESSION] missing sessionKey and invite. lobby_id=%s user_id=%s",
                    stable_lobby_id,
                    self.user.id,
                )
                self.close(code=4404)
                return

            is_valid = False
            try:
                is_valid = self.game_lobby_manager.validate_session_key(
                    lobby_id=stable_lobby_id,
                    session_key=str(session_key),
                    user_id=self.user.id,
                )
            except Exception as exc:
                logger.error(
                    "[SESSION] validation error. lobby_id=%s user_id=%s err=%s",
                    stable_lobby_id,
                    self.user.id,
                    exc,
                )

            if not is_valid:
                logger.warning(
                    "[SESSION] invalid/expired. lobby_id=%s user_id=%s",
                    stable_lobby_id,
                    self.user.id,
                )
                self.close(code=4408)
                return

            # refresh allow-list TTL while they are active (optional but useful)
            try:
                self.game_lobby_manager.add_user_to_session(stable_lobby_id, self.user.id)
            except Exception:
                pass

        # Step 7: Join group
        async_to_sync(self.channel_layer.group_add)(self.lobby_group_name, self.channel_name)

        # Step 8: Accept connection
        self.accept()
        logger.info("[CONNECT] accepted. user_id=%s game_id=%s", self.user.id, self.game_id)

        # Step 9: If we minted a sessionKey, tell the client (store it for rematch)
        if minted_session_key:
            self.send_json(
                {
                    "type": "session_established",
                    "lobbyId": stable_lobby_id,
                    "sessionKey": minted_session_key,
                }
            )

        # Step 10: Track player/channel in Redis
        try:
            self.game_lobby_manager.add_player(str(self.game_id), self.user)
            self.game_lobby_manager.add_channel(str(self.game_id), self.channel_name)
        except Exception as exc:
            logger.error(
                "[CONNECT] Redis presence failed. game_id=%s user_id=%s err=%s",
                self.game_id,
                self.user.id,
                exc,
            )
            self.send_json({"type": "error", "message": "Failed to join lobby."})
            self.close(code=4004)
            return

        # Step 11: DB-authoritative role sync
        role = "Spectator"
        try:
            GameModel = apps.get_model("game", "Game")  # adjust if needed
            game = GameModel.objects.only("player_x_id", "player_o_id").get(id=self.game_id)

            if game.player_x_id == self.user.id:
                role = "X"
            elif game.player_o_id == self.user.id:
                role = "O"

            logger.info(
                "[CONNECT][ROLE_SYNC] game_id=%s user_id=%s role=%s db_x_id=%s db_o_id=%s",
                self.game_id,
                self.user.id,
                role,
                getattr(game, "player_x_id", None),
                getattr(game, "player_o_id", None),
            )
        except Exception as exc:
            logger.error(
                "[CONNECT][ROLE_SYNC] failed. game_id=%s user_id=%s err=%s",
                self.game_id,
                self.user.id,
                exc,
            )

        # Step 12: Persist role in Redis
        try:
            self.game_lobby_manager.set_player_role(str(self.game_id), self.user.id, role)
        except Exception as exc:
            logger.error(
                "[CONNECT] set_player_role failed. game_id=%s user_id=%s role=%s err=%s",
                self.game_id,
                self.user.id,
                role,
                exc,
            )

        # Step 13: Broadcast player list
        try:
            self.game_lobby_manager.broadcast_player_list(self.channel_layer, str(self.game_id))
        except Exception as exc:
            logger.error(
                "[CONNECT] broadcast_player_list failed. game_id=%s user_id=%s err=%s",
                self.game_id,
                self.user.id,
                exc,
            )

    def receive_json(self, content: dict, **kwargs) -> None:
        """
        Handle incoming game-related messages from the WebSocket client.

        This method:
        1. Validates the incoming JSON message structure using `SharedUtils.validate_message`.
        2. Extracts and normalizes the `type` field from the message payload.
        3. Routes valid messages to their respective handler methods.
        4. Sends error responses for invalid/unsupported message types.
        5. Logs unexpected runtime errors and sends a generic error response.

        Args:
            content: The JSON message payload sent by the client.
            **kwargs: Unused.
        """
        logger.info("GameConsumer received message: %s", content)

        # Step 1: Validate the incoming message structure.
        if not SharedUtils.validate_message(content):
            # Close the connection if the message is invalid.
            self.close(code=4003)
            return

        # Step 2: Ensure self.game is initialized before using it
        if not getattr(self, "game", None):
            try:
                self.game = GameUtils.get_game_instance(game_id=self.game_id)
                logger.debug(
                    "GameConsumer loaded game instance: ID=%s is_completed=%s",
                    self.game.id,
                    getattr(self.game, "is_completed", None),
                )
            except Exception as exc:
                logger.error("Failed to fetch game instance in receive_json: %s", exc)
                SharedUtils.send_error(self, "Unable to fetch game instance.")
                return

        # Step 3: Normalize message type.
        message_type_raw = content.get("type")
        if not isinstance(message_type_raw, str):
            SharedUtils.send_error(self, "Invalid message type.")
            return

        message_type = message_type_raw.lower()

        try:
            # Step 4: Route the message to the appropriate handler based on its type.
            if message_type == "join_lobby":
                self.handle_join_lobby(content)

            elif message_type == "start_game":
                logger.info(
                    "GameConsumer received start_game for lobby: %s",
                    self.lobby_group_name,
                )
                self.handle_start_game()

            elif message_type == "move":
                self.handle_move(content)

            elif message_type == "rematch_request":
                self.handle_rematch_request()

            elif message_type == "rematch_accept":
                self.handle_rematch_accept()

            elif message_type == "rematch_decline":
                self.handle_rematch_decline()
                
            elif message_type == "rematch_timeout":
                self.handle_rematch_timeout()
            else:
                SharedUtils.send_error(self, "Invalid message type.")

        except Exception as exc:
            logger.error("Unexpected error in GameConsumer: %s", exc)
            SharedUtils.send_error(self, f"An unexpected error occurred: {str(exc)}")

    def handle_join_lobby(self, content: dict) -> None:
        """
        Handle the join_lobby WebSocket message for multiplayer games.

        Steps:
        1. Validate game ID in message vs. route.
        2. Check if lobby already has 2 players.
        3. Assign role (X/O/Spectator) using Redis.
        4. Broadcast updated player list.
        5. Confirm join to the client.
        """
        # Step 1: Validate payload game id vs route game id
        game_id = content.get("gameId")
        if str(game_id) != str(self.game_id):
            logger.warning("Game ID mismatch: %s != %s", game_id, self.game_id)
            self.send_json({"type": "error", "message": "Invalid game ID."})
            return

        logger.info("User %s attempting to join game %s", self.user.first_name, game_id)

        # Step 2: Validate player limit (only allow 2 unique users)
        players = self.game_lobby_manager.get_players(self.game_id)
        player_ids = [p.get("id") for p in players]

        if len(players) >= 2 and self.user.id not in player_ids:
            logger.warning(
                "Game %s already has 2 players. Rejecting user %s.",
                game_id,
                self.user.first_name,
            )
            self.send_json(
                {
                    "type": "error",
                    "message": "Game is full. Only two players are allowed.",
                }
            )
            return

        # Step 3: Assign role
        player_role = self.game_lobby_manager.assign_player_role(self.game_id, self.user)
        logger.info("Assigned role %s to user %s", player_role, self.user.first_name)

        # Step 4: Broadcast updated player list
        self.game_lobby_manager.broadcast_player_list(self.channel_layer, self.game_id)

        # Step 5: Confirm join
        self.send_json(
            {
                "type": "join_lobby_success",
                "message": f"Successfully joined game {self.game_id} as {player_role}.",
                "player_role": player_role,
            }
        )

        logger.info(
            "User %s joined game %s as %s",
            self.user.first_name,
            self.game_id,
            player_role,
        )

    def handle_start_game(self) -> None:
        """
        Handles the game start event and notifies both players in the lobby.

        This method:
        - Validates the existence of the lobby and the player list.
        - Ensures exactly two players are present before starting.
        - Randomizes the starting turn and assigns player roles (X or O).
        - Initializes the game instance with the assigned players and starting turn.
        - Sends a game start acknowledgment to all players in the WebSocket group.
        """
        logger.info("GameConsumer.handle_start_game triggered for lobby %s", self.lobby_group_name)

        # Step 1: Validate the lobby existence and player list
        try:
            players = GameUtils.validate_lobby(group_name=self.lobby_group_name)
        except ValueError as exc:
            logger.error(exc)
            self.send_json({"type": "error", "message": str(exc)})
            return

        # Step 2: Ensure there are exactly two players in the lobby
        if len(players) != 2:
            logger.warning(
                "Game start failed: Invalid number of players in %s",
                self.lobby_group_name,
            )
            self.send_json(
                {
                    "type": "error",
                    "message": "The game requires exactly two players to start.",
                }
            )
            return

        # Step 3: Randomize the starting turn and assign player roles
        starting_turn, player_x, player_o = GameUtils.randomize_turn(players=players)

        logger.info(
            "Game starting in lobby %s. Player X=%s Player O=%s Starting=%s",
            self.lobby_group_name,
            player_x.get("first_name"),
            player_o.get("first_name"),
            starting_turn,
        )

        # Step 4: Initialize the game instance
        try:
            game = GameUtils.initialize_game(
                game_id=self.game_id,
                player_x=player_x,
                player_o=player_o,
                starting_turn=starting_turn,
            )

            # Step 5: Send acknowledgment to frontend
            async_to_sync(self.channel_layer.group_send)(
                self.lobby_group_name,
                {
                    "type": "game_start_acknowledgment",
                    "message": "Game has started successfully!",
                    "game_id": game.id,
                    "current_turn": starting_turn,
                },
            )
        except Exception as exc:
            logger.error("Failed to start the game: %s", exc)
            self.send_json(
                {"type": "error", "message": "Failed to start the game due to a server error."}
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

        logger.info(
            "[BROADCAST] game_update -> group=%s game_id=%s board=%s turn=%s winner=%s",
            self.lobby_group_name,
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
        async_to_sync(self.channel_layer.group_send)(
            self.lobby_group_name,
            {
                "type": "rematch_start",
                "old_game_id": self.game_id,
                "new_game_id": new_game.id,
                "requesterUserId": offer.get("requesterUserId"),
                "receiverUserId": offer.get("receiverUserId"),
            },
        )

    def handle_rematch_decline(self) -> None:
        """
        Handle when the receiving player declines a rematch offer.
        """
        logger.info(
            "[REMATCH][DECLINE] user=%s game_id=%s",
            getattr(self.user, "first_name", "?"),
            self.game_id,
        )

        # Step 1: Read current offer (for metadata) then clear it
        offer = None
        try:
            offer = self.game_lobby_manager.get_rematch_offer(self.game_id)
        except Exception as exc:
            logger.warning("[REMATCH][DECLINE] could not read offer: %s", exc)

        try:
            self.game_lobby_manager.clear_rematch_offer(self.game_id)
        except Exception as exc:
            logger.warning("[REMATCH][DECLINE] could not clear offer: %s", exc)

        # Step 2: Broadcast to entire lobby so both clients close UI
        async_to_sync(self.channel_layer.group_send)(
            self.lobby_group_name,
            {
                "type": "rematch_declined_broadcast",
                "game_id": str(self.game_id),
                "message": f"{self.user.first_name} declined the rematch.",
                "declinedByUserId": getattr(self.user, "id", None),
                "requesterUserId": (offer or {}).get("requesterUserId"),
                "receiverUserId": (offer or {}).get("receiverUserId"),
                "createdAtMs": (offer or {}).get("createdAtMs"),
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
                    "rematchPending": False,
                    "isRematchOfferVisible": False,
                    "declinedByUserId": event.get("declinedByUserId"),
                    "requesterUserId": event.get("requesterUserId"),
                    "receiverUserId": event.get("receiverUserId"),
                    "createdAtMs": event.get("createdAtMs"),
                }
            )

            logger.info(
                "[REMATCH][DECLINED_SENT] to_user=%s game_id=%s",
                getattr(self.user, "first_name", "?"),
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
