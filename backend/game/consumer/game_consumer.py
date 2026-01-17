import logging
import time
from urllib.parse import parse_qs
from asgiref.sync import async_to_sync
from channels.generic.websocket import JsonWebsocketConsumer
from django.core.exceptions import ValidationError
from asgiref.sync import async_to_sync

from utils.shared.shared_utils_game_chat import SharedUtils
from utils.game.game_utils import GameUtils
from utils.redis.redis_game_lobby_manager import RedisGameLobbyManager
from rest_framework.exceptions import PermissionDenied as DRFPermissionDenied
from rest_framework.exceptions import ValidationError as DRFValidationError

from invites.guards import validate_invite_for_lobby_join

logger = logging.getLogger("game")

class GameConsumer(JsonWebsocketConsumer):
    """
    WebSocket consumer for managing game-specific functionality.
    """

# Filename: game/consumer/game_consumer.py

    def connect(self):
        """
        Handle WebSocket connection for game-related functionality.

        Steps:
        1. Extract game ID from WebSocket URL route.
        2. Authenticate the user.
        3. Validate presence of game ID.
        4. Validate invite join guard (Invite v2).
        5. Add channel to Django Channels group.
        6. Track the player and channel in Redis.
        7. Accept the connection.
        8. Broadcast updated player list.
        9. Log successful join.
        """
        # Step 0: Always define game_lobby_manager so early-close disconnects don't crash
        self.game_lobby_manager = None

        # Step 1: Extract game ID and set group name
        self.game_id = self.scope["url_route"].get("kwargs", {}).get("game_id")
        self.lobby_group_name = f"game_lobby_{self.game_id}"
        logger.info(f"GameConsumer WebSocket connecting to group: {self.lobby_group_name}")

        # Step 2: Authenticate the user
        self.user = SharedUtils.authenticate_user(self.scope)
        if not self.user:
            logger.warning("Game WebSocket connection rejected: user not authenticated.")

            # Step 2a: Accept then close so client/tests receive the WS close code
            self.accept()
            self.close(code=4401)
            return

        # Step 3: Validate game ID
        if not self.game_id:
            self.accept()
            self.close(code=4404)
            return

        # Step 4: Invite v2 join guard (kills time-travel joins)
        qs = parse_qs(self.scope.get("query_string", b"").decode())
        invite_id = qs.get("invite", [None])[0]

        if not invite_id:
            logger.warning("WebSocket connection rejected: missing invite id.")
            self.accept()
            self.close(code=4404)
            return

        try:
            validate_invite_for_lobby_join(
                user=self.user,
                lobby_id=str(self.game_id),
                invite_id=str(invite_id),
            )

        except DRFPermissionDenied as exc:
            logger.warning(
                "[INVITE_GUARD] forbidden join. game_id=%s invite_id=%s user_id=%s err=%s",
                self.game_id,
                invite_id,
                getattr(self.user, "id", None),
                exc,
            )

            self.accept()
            self.close(code=4403)
            return

        except DRFValidationError as exc:
            detail = None
            try:
                if isinstance(getattr(exc, "detail", None), dict):
                    detail = exc.detail.get("detail")
                elif isinstance(getattr(exc, "detail", None), list):
                    detail = str(exc.detail[0])
                else:
                    detail = str(exc.detail)
            except Exception:
                detail = str(exc)

            message = detail or "Invite validation failed."
            code = 4408 if "expired" in message.lower() else 4404

            logger.warning(
                "[INVITE_GUARD] validation failed. code=%s game_id=%s invite_id=%s user_id=%s msg=%s",
                code,
                self.game_id,
                invite_id,
                getattr(self.user, "id", None),
                message,
            )

            self.accept()
            self.close(code=code)
            return

        # Step 5: Join Django Channels group
        async_to_sync(self.channel_layer.group_add)(self.lobby_group_name, self.channel_name)

        # Step 6: Track player and channel in Redis
        self.game_lobby_manager = RedisGameLobbyManager()
        self.game_lobby_manager.add_channel(self.game_id, self.channel_name)
        self.game_lobby_manager.add_player(self.game_id, self.user)

        # Step 7: Accept WebSocket connection
        self.accept()

        # Step 8: Broadcast updated player list
        self.game_lobby_manager.broadcast_player_list(self.channel_layer, self.game_id)
        logger.info(f"[✅ BROADCAST] Sent updated player list for game lobby {self.lobby_group_name}")

        # Step 9: Log success
        logger.info(f"User {self.user.first_name} connected to game lobby {self.lobby_group_name}")

    def receive_json(self, content: dict, **kwargs) -> None:
        """
        Handle incoming game-related messages from the WebSocket client.

        This method is responsible for:
        1. Validating the incoming JSON message structure using `SharedUtils.validate_message`.
        2. Extracting and normalizing the `type` field from the message payload.
        3. Routing valid messages to their respective handler methods:
        - `join_lobby`: Adds the user to the game lobby.
        - `start_game`: Initiates the game if conditions are met.
        - `move`: Processes a player's move and updates the game state.
        - `leave_lobby`: Removes the user from the game lobby.
        4. Sending error responses for invalid or unsupported message types.
        5. Logging unexpected runtime errors and sending a generic error response.

        Parameters:
            content (dict): The JSON message payload sent by the client. Expected to contain a "type" field indicating the message type.
            **kwargs: Additional optional arguments passed to the method (not used in this context).

        Raises:
            Exception: Catches and logs any unexpected errors during message processing.
                    Sends an error response to the client in case of such errors.
        """
        logger.info(f"GameConsumer received message: {content}")  
        
        # Step 1: Validate the incoming message structure.
        if not SharedUtils.validate_message(content):
            # Close the connection if the message is invalid.
            self.close(code=4003)
            return
        
        # Step 1.5: Ensure self.game is initialized before using it
        if not hasattr(self, "game"):
            try:
                self.game = GameUtils.get_game_instance(game_id=self.game_id)
                logger.debug(f"GameConsumer loaded game instance: ID={self.game.id}, is_completed={self.game.is_completed}")
            except Exception as e:
                logger.error(f"Failed to fetch game instance in receive_json: {e}")
                SharedUtils.send_error(self, "Unable to fetch game instance.")
                return
        
        if self.game.is_completed:
            logger.warning(f"Game {self.game_id} is already completed. Checking if WebSocket is still active.")
            

        # Step 2: Extract and normalize the message type.
        message_type = content.get("type").lower()
        
        try:
            # Step 3: Route the message to the appropriate handler based on its type.
            if message_type == "join_lobby":
                # Add the user to the game lobby.
                self.handle_join_lobby(content)
            elif message_type == "start_game":
                logger.info(f"GameConsumer received start_game for lobby: {self.lobby_group_name}")
                # Validate and start the game.
                self.handle_start_game()
            elif message_type == "move":
                # Validate and process the player's move.
                self.handle_move(content)
            elif message_type == "rematch_request":
                self.handle_rematch_request()
            elif message_type == "rematch_accept":
                self.handle_rematch_accept()
            elif message_type == "rematch_decline":
                self.handle_rematch_decline()
            else:
                # Send an error response for unsupported message types.
                SharedUtils.send_error(self, "Invalid message type.")
        except Exception as e:
            # Step 4: Log unexpected runtime errors and send a generic error response.
            logger.error(f"Unexpected error in GameConsumer: {e}")
            SharedUtils.send_error(self, f"An unexpected error occurred: {str(e)}")

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
        game_id = content.get("gameId")
        if game_id != self.game_id:
            logger.warning(f"Game ID mismatch: {game_id} != {self.game_id}")
            self.send_json({"type": "error", "message": "Invalid game ID."})
            return

        logger.info(f"User {self.user.first_name} attempting to join game {game_id}")

        # Step 2: Validate player limit (only allow 2 unique users)
        players = self.game_lobby_manager.get_players(self.game_id)
        player_ids = [p["id"] for p in players]

        if len(players) >= 2 and self.user.id not in player_ids:
            logger.warning(f"Game {game_id} already has 2 players. Rejecting user {self.user.first_name}.")
            self.send_json({
                "type": "error",
                "message": "Game is full. Only two players are allowed."
            })
            return

        # Step 3: Assign role
        player_role = self.game_lobby_manager.assign_player_role(self.game_id, self.user)
        logger.info(f"Assigned role {player_role} to user {self.user.first_name}")

        # Step 4: Broadcast updated player list
        self.game_lobby_manager.broadcast_player_list(self.channel_layer, self.game_id)

        # Step 5: Confirm join
        self.send_json({
            "type": "join_lobby_success",
            "message": f"Successfully joined game {self.game_id} as {player_role}.",
            "player_role": player_role,
        })

        logger.info(f"User {self.user.first_name} joined game {self.game_id} as {player_role}")

    def handle_start_game(self) -> None:
        
        """
        Handles the game start event and notifies both players in the lobby.

        This method:
        - Validates the existence of the lobby and the player list.
        - Ensures exactly two players are present before starting.
        - Randomizes the starting turn and assigns player roles (X or O).
        - Initializes the game instance with the assigned players and starting turn.
        - Sends a game start acknowledgment to all players in the WebSocket group.

        Parameters:
            self (GameConsumer): The instance of the WebSocket consumer.

        Raises:
            ValueError: If the lobby does not exist or if there is invalid player data.
        """
        logger.info(f" GameConsumer.handle_start_game triggered for lobby {self.lobby_group_name}")  
        
        # Step 1: Validate the lobby existence and player list
        try:
            players = GameUtils.validate_lobby(group_name=self.lobby_group_name)
        except ValueError as e:
            logger.error(e)
            self.send_json({"type": "error", "message": str(e)})
            return
        
        # Step 2 Ensure there are exactly two players in the lobby
        if len(players) != 2:
            logger.warning(f"Game start failed: Invalid number of players in the {self.lobby_group_name}")
            self.send_json({
                "type": "error",
                "message": "The game requires exactly two players to start."
            })
            return

        # Step 3: Randomize the starting turn and assign player roles
        starting_turn, player_x, player_o = GameUtils.randomize_turn(players=players)
        
        logger.info(
            f" Game is starting in lobby {self.lobby_group_name}. "
            f"Player X: {player_x['first_name']}, Player O: {player_o['first_name']}, Starting turn: {starting_turn}"
        )
        
        # Step 4: Initialize the game instance with the validated players and starting turn
        try:
            game = GameUtils.initialize_game(
                game_id=self.game_id,
                player_x=player_x,
                player_o=player_o,
                starting_turn=starting_turn,
            )
            # Log before sending acknowledgment
            logger.info(f" Sending game_start_acknowledgment for game {game.id}...")
            
            # Step 5: Send acknowledgment to frontend
            async_to_sync(self.channel_layer.group_send)(
                self.lobby_group_name,  # 📡 Target WebSocket group (game lobby)
                {
                    "type": "game_start_acknowledgment",
                    "message": "Game has started successfully!",
                    "game_id": game.id,
                    "current_turn": starting_turn,
                }
            )
        except Exception as e:
            logger.error(f"Failed to start the game: {e}")
            self.send_json({"type": "error", "message": "Failed to start the game due to a server error."})
            
    def game_start_acknowledgment(self, event: dict) -> None:
        """
            Handle the game start acknoledgment message.
        """
        logger.info(f" Broadcasting game start acknowledgment: {event}")
        
        self.send_json({
            "type": "game_start_acknowledgment",
            "message": event["message"],
            "game_id": event["game_id"],
            "current_turn": event["current_turn"],
        })

    def handle_move(self, content: dict) -> None:
        """
        Handle a move made by a player.

        Parameters:
            content (dict): The message payload containing the move details.
        """
        # Step 1: Extract the position from the message payload
        position = content.get("position")
        user = self.scope["user"]

        # Step 2: Validate the move position
        if position is None:
            self.send_json({
                "type": "error",
                "message": "Invalid move: Position is missing."
            })
            return

        if not isinstance(position, int) or not (0 <= position < 9):
            self.send_json({
                "type": "error",
                "message": "Invalid move: Position must be an integer between 0 and 8."
            })
            return

        # Step 3: Retrieve the game instance using the utility method
        try:
            game = GameUtils.get_game_instance(game_id=self.game_id)
        except ValueError as e:
            self.send_json({"type": "error", "message": str(e)})
            return

        logger.info(f"Game object retrieved: {game}")

        # Step 4: Determine the player's marker ("X" or "O")
        if user == game.player_x:
            player_marker = "X"
        elif user == game.player_o:
            player_marker = "O"
        else:
            logger.warning(f"Unauthorized move attempt by {user.first_name}")
            self.send_json({
                "type": "error",
                "message": "You are not a participant in this game."
            })
            return

        logger.info(f"Player {user.first_name} ({player_marker}) made a move at position {position}")

        # Step 5: Make the move and update the game state
        try:
            game.make_move(position=position, player=player_marker)
            # ✅ New Code
            # Step 5a: Refresh from DB to ensure we broadcast the final persisted state
            game.refresh_from_db()
            logger.info(f"Move made successfully: {game.board_state}")
        except ValidationError as e:
            logger.error(f"Invalid move: {e}")
            self.send_json({
                "type": "error",
                "message": str(e) if str(e) else "Invalid move due to a validation error."
            })
            return  # ✅ New Code (critical)

        # ✅ New Code
        # Step 6: Broadcast the updated game state to EVERY client in the lobby group
        async_to_sync(self.channel_layer.group_send)(
            self.lobby_group_name,
            {
                "type": "game_update",
                "board_state": game.board_state,
                "current_turn": game.current_turn,
                "winner": game.winner,
                "is_completed": getattr(game, "is_completed", False),
                "winning_combination": getattr(game, "winning_combination", []),
            },
        )

        logger.info(
            "[BROADCAST] game_update -> group=%s board=%s turn=%s winner=%s",
            self.lobby_group_name,
            game.board_state,
            game.current_turn,
            game.winner,
        )

    def update_player_list(self, event: dict) -> None:
        """
        Handles the update_player_list event for the game lobby
        

        Args:
            event (dict): Expected to contain:
            {
                "type": "update_player_list",
                "players": [
                    {"id": <int>, "first_name": <str>, "role": <str>},
                    ...
                ]
            }
        Returns:
            None
        """
        players = event.get("players", [])
        validated_players = [
            player for player in players
            if isinstance(player.get("id"), int) and isinstance(player.get("first_name"), str)
        ]
        logger.debug(f"GameConsumer processing update_player_list event: {validated_players}")
        
        # Send the updated player list (including the role) to the client.
        self.send_json({
            "type": "update_player_list",
            "players": validated_players
        })
        logger.info(f"GameConsumer sent updated player list: {validated_players}")
        
    def game_update(self, event: dict) -> None:
        """
        Broadcasts the updated game state to all connected clients.

        This method ensures that the game state update is valid before sending it
        to all players. If the game is AI-based, it verifies the AI user.

        Parameters:
            event (dict): The message payload containing the updated game state.
                        Expected keys:
                        - "board_state" (list): Current state of the board.
                        - "current_turn" (str): The player ('X' or 'O') whose turn it is.
                        - "winner" (str or None): The winner of the game (if any).

        Behavior:
            - Validates that the required keys exist in the event payload.
            - Retrieves the game instance.
            - If AI-based, verifies that the AI user exists.
            - Determines the player's role (X or O).
            - Prepares detailed player information.
            - Broadcasts the updated game state to all connected clients.
            - Logs critical errors if something goes wrong.
        """
        logger.info(f"Received game update event: {event}")

        try:
            # Step 1: Validate required keys in the event payload
            required_keys = ["board_state", "current_turn", "winner"]
            if not all(key in event for key in required_keys):
                logger.error(f"Missing keys in event: {event}")
                self.send_json({"type": "error", "message": "Invalid game update payload."})
                return

            # Step 2: Retrieve the game instance
            try:
                game = GameUtils.get_game_instance(self.game_id)
            except ValueError as e:
                logger.error(f"Game instance retrieval failed: {e}")
                self.send_json({"type": "error", "message": str(e)})
                return

            # Step 3: Retrieve the AI user if the game is AI-based
            ai_user = None
            if game.is_ai_game:
                ai_user = self.get_ai_user()
                if not ai_user:
                    logger.critical("AI user (ai@tictactoe.com) is missing. Please run migrations.")
                    self.send_json({"type": "error", "message": "AI user missing."})
                    return

            # Step 4: Determine the user's role in the game
            player_role = GameUtils.determine_player_role(user=self.user, game=game)

            # Step 5: Prepare detailed player information
            player_x_info = {
                "id": game.player_x.id,
                "first_name": game.player_x.first_name,
            } if game.player_x else None

            player_o_info = {
                "id": game.player_o.id if game.player_o else None,
                "first_name": "AI" if game.is_ai_game and game.player_o == ai_user else (
                    game.player_o.first_name if game.player_o else "Waiting..."
                ),
            }

            logger.debug(f"Player X Info: {player_x_info}")
            logger.debug(f"Player O Info: {player_o_info}")

            # Step 6: Broadcast the game update to all clients
            self.send_json({
                "type": "game_update",
                "game_id": game.id,
                "board_state": event["board_state"],
                "current_turn": event["current_turn"],
                "winner": event["winner"],
                "is_completed": game.is_completed,
                "player_role": player_role,
                "player_x": player_x_info,
                "player_o": player_o_info,
            })
            
            logger.info("Game update broadcasted successfully.")
            logger.info(f"Broadcasting game update: Board State={event['board_state']}, Current Turn={event['current_turn']}")

        except Exception as e:
            logger.error(f"Error during game update: {e}")
            self.send_json({"type": "error", "message": "An error occurred during the game update."})

    def handle_rematch_request(self) -> None:
        """
        Handles when a player initiates a rematch request.

        Fix:
        - Stop using Redis-based assign_player_role() for rematch decisions.
        - Use DB-authoritative roles (game.player_x / game.player_o).
        - Broadcast requesterUserId + receiverUserId so the frontend never guesses.
        - Store a full offer object in Redis (not just "X"/"O").
        """
        logger.info(
            f"[REMATCH][REQUEST] user_id={self.user.id} name={self.user.first_name} game_id={self.game_id}"
        )

        # Step 1: Load the game from DB (authoritative mapping)
        try:
            game = GameUtils.get_game_instance(game_id=self.game_id)
        except Exception as exc:
            logger.error(f"[REMATCH][REQUEST] Failed to fetch game: {exc}")
            self.send_json({"type": "error", "message": "Unable to process rematch request."})
            return

        # Step 2: Determine requester role via DB mapping (stable)
        try:
            requester_role = GameUtils.determine_player_role(user=self.user, game=game)
        except Exception as exc:
            logger.error(f"[REMATCH][REQUEST] Failed to determine role: {exc}")
            self.send_json({"type": "error", "message": "Unable to determine player role."})
            return

        if requester_role not in ("X", "O"):
            logger.warning(
                f"[REMATCH][REQUEST] Rejected: invalid role. user_id={self.user.id} role={requester_role}"
            )
            self.send_json({
                "type": "error",
                "message": "Only players assigned as X or O may request a rematch.",
            })
            return

        # Step 3: Determine receiver user (the OTHER player)
        if not getattr(game, "player_x", None) or not getattr(game, "player_o", None):
            self.send_json({"type": "error", "message": "Both players must be present to rematch."})
            return

        receiver_user = game.player_o if requester_role == "X" else game.player_x

        # Step 4: Store the full offer object in Redis
        offer = {
            "rematchRequestedBy": requester_role,
            "requesterUserId": self.user.id,
            "receiverUserId": receiver_user.id,
            "createdAtMs": int(time.time() * 1000),
        }
        self.game_lobby_manager.store_rematch_offer(self.game_id, offer)

        logger.info(
            f"[REMATCH][REQUEST] Stored offer. game_id={self.game_id} requested_by={requester_role} "
            f"requester_user_id={offer['requesterUserId']} receiver_user_id={offer['receiverUserId']}"
        )

        # Step 5: Broadcast offer with authoritative targeting info
        async_to_sync(self.channel_layer.group_send)(
            self.lobby_group_name,
            {
                "type": "rematch_offer_broadcast",
                "game_id": self.game_id,
                **offer,
                "message": f"{self.user.first_name} wants a rematch!",
                "isRematchOfferVisible": True,
                "rematchPending": True,
            }
        )

    def rematch_offer_broadcast(self, event: dict) -> None:
        """
        Sends a rematch_offer payload to THIS client.

        Key principles:
        - Server decides who sees Accept/Decline via receiverUserId.
        - UI logic is deterministic (showActions=True → Accept/Decline).
        - Optional fields preserved for frontend state consistency.
        """
        try:
            # Step 1: Determine if this socket belongs to the receiver
            receiver_user_id = event.get("receiverUserId")
            show_actions = bool(receiver_user_id and self.user.id == receiver_user_id)
            ui_mode = "receiver" if show_actions else "requester"

            # Step 2: Compute stable role (optional, diagnostic only)
            player_role = None
            try:
                game = GameUtils.get_game_instance(game_id=self.game_id)
                player_role = GameUtils.determine_player_role(user=self.user, game=game)
            except Exception:
                player_role = None  # fine to skip

            # Step 3: Build payload (clean + explicit)
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
                # ✅ Optional extras for your reducer
                "isRematchOfferVisible": event.get("isRematchOfferVisible", True),
                "rematchPending": event.get("rematchPending", True),
            }

            # Step 4: Send payload
            self.send_json(payload)

            logger.info(
                "[REMATCH][OFFER_SENT] "
                f"to_user_id={self.user.id} ui_mode={ui_mode} "
                f"requester_user_id={event.get('requesterUserId')} "
                f"receiver_user_id={receiver_user_id} "
                f"requested_by={event.get('rematchRequestedBy')} "
                f"game_id={event.get('game_id', self.game_id)}"
            )

        except Exception as exc:
            logger.error(f"[REMATCH][OFFER_SENT][ERROR] {exc}")
            SharedUtils.send_error(self, "Failed to deliver rematch offer.")

    def handle_rematch_accept(self) -> None:
        """
        Handles when the receiver accepts a rematch.

        Key fixes:
        - Requires an active offer in Redis.
        - Only receiverUserId can accept.
        - pop_rematch_offer() prevents double accept.
        """
        logger.info(
            f"[REMATCH][ACCEPT] user_id={self.user.id} name={self.user.first_name} game_id={self.game_id}"
        )

        # Step 1: Atomically pop the offer
        offer = self.game_lobby_manager.pop_rematch_offer(self.game_id)
        if not offer:
            SharedUtils.send_error(self, "No pending rematch offer found.")
            return

        receiver_user_id = offer.get("receiverUserId")
        if receiver_user_id and self.user.id != receiver_user_id:
            SharedUtils.send_error(self, "Only the other player may accept this rematch.")
            return

        # Step 2: Load old game
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

        # Step 3: Randomize / create new game
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

        # Step 4: Broadcast new game id
        async_to_sync(self.channel_layer.group_send)(
            self.lobby_group_name,
            {
                "type": "rematch_start",
                "old_game_id": self.game_id,
                "new_game_id": new_game.id,
                "requesterUserId": offer.get("requesterUserId"),
                "receiverUserId": offer.get("receiverUserId"),
            }
        )

    def handle_rematch_decline(self) -> None:
        """
        Handle when the receiving player declines a rematch offer.

        Steps:
        1. Load the stored rematch offer from Redis (if present).
        2. Clear the rematch offer so it can't be accepted later.
        3. Broadcast a rematch_declined event to all clients in the lobby group.
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

                # Optional metadata (helps frontend debugging)
                "requesterUserId": (offer or {}).get("requesterUserId"),
                "receiverUserId": (offer or {}).get("receiverUserId"),
                "createdAtMs": (offer or {}).get("createdAtMs"),
            },
        )

    def rematch_declined_broadcast(self, event: dict) -> None:
        """
        Send a rematch_declined message to this client.

        Steps:
        1. Send UI instruction to close rematch modal.
        2. Mark rematch as not pending / not visible.
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

    def rematch_start(self, event: dict) -> None:
        """
        Notify this client that a rematch has been accepted and a new game has been created.

        This is triggered after a successful rematch acceptance and game creation.
        Sends a message with the new game ID so the frontend can redirect accordingly.

        Args:
            event (dict): Expected to contain:
                - new_game_id (int): The ID of the newly created game.
        """
        try:
            new_game_id = event.get("new_game_id")
            if not new_game_id:
                raise ValueError("Missing new_game_id in rematch_start event")

            # Send the redirect instruction to the client
            self.send_json({
                "type": "rematch_start",
                "new_game_id": new_game_id,
                "message": f"A new rematch game has been created: Game {new_game_id}"
            })

            logger.info(f"Sent rematch_start to {self.user.first_name} for new game ID {new_game_id}")

        except Exception as e:
            logger.error(f"[rematch_start] Error sending new game ID to {self.user.first_name}: {e}")
            SharedUtils.send_error(self, "Failed to initiate rematch transition.")

    def disconnect(self, code: int) -> None:
        """
        Handle WebSocket disconnection for a game session.

        This method performs the following:
        1. Validates the user and lobby group.
        2. Removes the player and their channel from Redis.
        3. Cleans up the Redis keys if the lobby is now empty.
        4. Broadcasts the updated player list to remaining users.
        5. Removes the user from the Django Channels group.

        Note: If the game is completed, disconnection does not trigger cleanup
        to preserve rematch functionality.

        Important (Invite v2 / close-code tests):
        - connect() may accept() then close() during invite-guard failures.
        In those cases, disconnect() can run before Redis lobby manager is initialized.
        - This method must gracefully handle that early-disconnect path.
        """
        logger.debug(
            "Disconnect triggered for user %s | Group: %s | Close code: %s",
            getattr(getattr(self, "user", None), "first_name", "?"),
            getattr(self, "lobby_group_name", "?"),
            code,
        )

        # Step 1: Validate early disconnects (e.g., handshake failed)
        if not hasattr(self, "lobby_group_name") or not self.lobby_group_name:
            logger.warning("User disconnected before joining a game lobby.")
            return


        # Step 1.5: Guard early-close paths (invite-guard close before Redis manager init)
        # Where this happens:
        # - connect() accepted then closed with 4403/4404/4408 before Step 6 Redis init.
        # Why:
        # - self.game_lobby_manager is never assigned.
        # Fix:
        # - Skip Redis cleanup safely; still discard group membership in finally.
        if not getattr(self, "game_lobby_manager", None):
            logger.debug(
                "Disconnect occurred before Redis lobby manager init. "
                "Skipping Redis cleanup. game_id=%s channel=%s",
                getattr(self, "game_id", None),
                getattr(self, "channel_name", None),
            )
            # NOTE: We still run group_discard in finally.
            return

        try:
            # Step 2: Retrieve game instance (for rematch/game completion check)
            game = GameUtils.get_game_instance(self.game_id)

            # Step 3: Always remove the channel from Redis (prevents ghost channels)
            self.game_lobby_manager.remove_channel(self.game_id, self.channel_name)

            # Step 4: If game is completed, do NOT remove players/roles/rematch state (support rematch UI)
            if getattr(game, "is_completed", False):
                logger.info(
                    "Game %s is completed. Retaining player data for rematch support.",
                    getattr(game, "id", self.game_id),
                )
                return

            # Step 5: Remove player from Redis (game not completed)
            self.game_lobby_manager.remove_player(self.game_id, self.user)

            # Step 6: Clean up the lobby only if it is now empty; otherwise broadcast updated player list
            if not self.game_lobby_manager.has_any_channels(self.game_id):
                self.game_lobby_manager.clear_game_lobby_state(self.game_id)
                logger.info(
                    "Lobby empty after disconnect. Cleared Redis state for game %s",
                    self.game_id,
                )
            else:
                self.game_lobby_manager.broadcast_player_list(self.channel_layer, self.game_id)

            logger.info(
                "User %s disconnected from game %s and was removed from Redis",
                getattr(self.user, "first_name", "?"),
                self.game_id,
            )

        except Exception as e:
            logger.error(
                "[disconnect] Error while cleaning up user %s: %s",
                getattr(getattr(self, "user", None), "first_name", "?"),
                e,
            )

        finally:
            # Step 7: Leave Django Channels group
            try:
                async_to_sync(self.channel_layer.group_discard)(
                    self.lobby_group_name,
                    self.channel_name,
                )
                logger.debug(
                    "User %s removed from group %s",
                    getattr(getattr(self, "user", None), "first_name", "?"),
                    self.lobby_group_name,
                )
            except Exception as e:
                logger.error("Error removing user from group: %s", e)