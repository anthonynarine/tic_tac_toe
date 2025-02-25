import code
import logging
import random
from os import error
from xml.dom import ValidationErr
from channels.generic.websocket import JsonWebsocketConsumer
from asgiref.sync import async_to_sync
from django.contrib.auth.models import AnonymousUser
from django.forms import ValidationError
from game.models import TicTacToeGame
from game.models import DEFAULT_BOARD_STATE
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)
User = get_user_model()

class GameLobbyConsumer(JsonWebsocketConsumer):
    """
    WebSocket consumer for managing a game lobby with chat functionality and real-time game updates.

    Features:
        - Authenticated connection via middleware.
        - Lobby management for real-time player interactions.
        - Chat messaging within the lobby.
        - Game-related events such as starting a game and making moves.
        - Handles both single-player (AI) and multiplayer games.
    """
    # Maintain a dictionary to track players in each lobby
    
    lobby_players = {}  # Format: {"game_lobby_<game_id>": [{"username": <name>, "id": <id>}, ...]}

    def connect(self) -> None:
        """
        Handle WebSocket connection.

        - Authenticates the user.
        - Adds the WebSocket channel to the appropriate game lobby group.
        - Tracks players in the lobby and broadcasts updates to all connected clients.

        Raises:
            AnonymousUser: Closes the connection if the user is not authenticated.
            KeyError: Closes the connection if the `game_id` is missing from the URL.

        Side Effects:
            - Adds the channel to the Django Channels group for the corresponding game lobby.
            - Updates the `lobby_players` dictionary with the current user.
            - Sends a success message to the connected client.
            - Broadcasts the updated player list to all players in the lobby.
        """
        logger.info(f"New connection: {self.scope}")
        self.user = self.scope["user"]

        if isinstance(self.user, AnonymousUser):
            logger.warning("WebSocket connection rejected: Unauthenticated user")
            self.close(code=4001)
            return 

        logger.info(f"WebSocket connection accepted for user: {self.user.first_name}")
        self.accept()

        # Extract game ID and validate
        self.game_id = self.scope["url_route"]["kwargs"].get("game_id")
        if not self.game_id:
            self.send_json({"type": "error", "message": "Missing game_id in URL."})
            self.close(code=4002)
            return

        self.lobby_group_name = f"game_lobby_{self.game_id}"

        # Add the WebSocket connection to the group
        async_to_sync(self.channel_layer.group_add)(
            self.lobby_group_name,
            self.channel_name
        )
        logger.info(f"Added channel {self.channel_name} to group {self.lobby_group_name}")

        # Initialize players list for the lobby if it doesn't exist
        if self.lobby_group_name not in GameLobbyConsumer.lobby_players:
            GameLobbyConsumer.lobby_players[self.lobby_group_name] = []

        # Ensure no duplicate player entries
        GameLobbyConsumer.lobby_players[self.lobby_group_name] = [
            p for p in GameLobbyConsumer.lobby_players[self.lobby_group_name]
            if p["id"] != self.user.id
        ]

        # Add player to the lobby
        player = {"id": self.user.id, "first_name": self.user.first_name}
        GameLobbyConsumer.lobby_players[self.lobby_group_name].append(player)

        # Broadcast updated player list
        async_to_sync(self.channel_layer.group_send)(
            self.lobby_group_name,
            {
                "type": "update_player_list",
                "players": GameLobbyConsumer.lobby_players[self.lobby_group_name],
            }
        )

        self.send_json({
            "type": "connection_success",
            "message": f"Welcome to the game lobby, {self.user.first_name}!"
        })
        logger.info(f"User {self.user.first_name} joined lobby: {self.lobby_group_name}")

    def receive_json(self, content: dict, **kwargs) -> None:
        """
        Handle incoming JSON messages from the WebSocket client.

        Parameters:
            content (dict): The JSON message payload sent by the client.
            **kwargs: Additional arguments passed to the method.

        Valid `type` values in `content`:
            - `join_lobby`: Adds the user to the game lobby.
            - `chat_message`: Handles a chat message sent by the client.
            - `start_game`: Starts the game if conditions are met.
            - `move`: Handles a move made by the player.
            - `leave_lobby`: Removes the user from the game lobby.

        Raises:
            KeyError: If a required key is missing from the payload.
            Exception: If an unexpected error occurs during processing.

        Side Effects:
            - Calls the appropriate handler method based on the `type` field in the payload.
        """
        if not isinstance(content, dict):
            logger.warning("Invalid message format received: Expected a JSON object.")
            self.send_json({
                "type": "error", 
                "message": "Invalid message format. Expected a JSON object."
            })
            self.close(code=4003)
            return

        # Extract and validate the message type
        message_type = content.get("type")
        if not isinstance(message_type, str):
            logger.warning("Missing or invalid 'type' field in message.")
            self.send_json({
                "type": "error",
                "message": "Invalid message format. Missing 'type' field.",
            })
            return

        message_type = message_type.lower()

        try:
            # Handle specific message types
            if message_type == "join_lobby":
                self.handle_join_lobby(content)
            elif message_type == "chat_message":
                self.handle_chat_message(content)
            elif message_type == "start_game":
                logger.info("Start game request received.")
                if self.lobby_group_name not in GameLobbyConsumer.lobby_players:
                    logger.warning(f"Lobby {self.lobby_group_name} does not exist.")
                    self.send_json({
                        "type": "error",
                        "message": "Cannot start game: Lobby does not exist.",
                    })
                    return

                if len(GameLobbyConsumer.lobby_players[self.lobby_group_name]) == 2:
                    self.handle_start_game()
                else:
                    logger.warning(
                        f"Start game request denied: Lobby {self.lobby_group_name} has "
                        f"{len(GameLobbyConsumer.lobby_players[self.lobby_group_name])} players (expected 2)."
                    )
                    self.send_json({
                        "type": "error",
                        "message": "Cannot start game: Exactly two players are required in the lobby.",
                    })
            elif message_type == "move":
                logger.info("Move request received.")
                self.handle_move(content)
            elif message_type == "leave_lobby":
                self.handle_leave_lobby()
            else:
                logger.warning(f"Unknown or invalid message type received: {message_type}")
                self.send_json({
                    "type": "error",
                    "message": "Invalid message type.",
                })

        except KeyError as e:
            logger.error(f"KeyError while processing {message_type}: {e}")
            self.send_json({
                "type": "error",
                "message": f"Missing required field: {str(e)}",
            })
        except Exception as e:
            logger.error(f"Unexpected error while handling message of type {message_type}: {e}")
            logger.debug(f"Full message content: {content}")
            self.send_json({
                "type": "error",
                "message": f"An unexpected error occurred: {str(e)}",
            })

    def handle_join_lobby(self, content: dict) -> None:
        """
        Handle the join lobby message and confirm the user's addition to the lobby.

        Parameters:
            content (dict): The message payload sent by the client.
        """
        game_id = content.get("gameId")
        if game_id != self.game_id:
            self.send_json({"type": "error", "message": "Invalid game ID."})
            return

        logger.info(f"User {self.user.first_name} joined lobby: {self.lobby_group_name}")

        # Retrieve or create the game instance
        try:
            game = TicTacToeGame.objects.get(id=self.game_id)
        except TicTacToeGame.DoesNotExist:
            logger.error(f"Game with ID {self.game_id} does not exist.")
            self.send_json({"type": "error", "message": "Game does not exist."})
            return

        # Assign roles if not already
        if not game.player_x:
            game.player_x = self.user
            game.save()
            game.refresh_from_db()  # Refresh instance
            player_role = "X"
            logger.info(f"Assigned {self.user.first_name} as Player X for game {self.game_id}.")
        elif not game.player_o and self.user != game.player_x:
            game.player_o = self.user
            game.save()
            game.refresh_from_db()  # Refresh instance
            logger.debug(f"Player O after save: {game.player_o}")  # Add log
            player_role = "O"
            logger.info(f"Assigned {self.user.first_name} as Player O for game {self.game_id}.")
        else:
            game.refresh_from_db()  # Refresh instance
            player_role = "Spectator"
            logger.info(f"{self.user.first_name} joined the game as a Spectator.")

        # Prepare player info
        player_info = {
            "id": self.user.id,
            "first_name": self.user.first_name,
            "role": player_role,
        }

        # Avoid duplicate entries in lobby_players
        GameLobbyConsumer.lobby_players[self.lobby_group_name] = [
            p for p in GameLobbyConsumer.lobby_players[self.lobby_group_name]
            if p["id"] != self.user.id
        ]
        GameLobbyConsumer.lobby_players[self.lobby_group_name].append(player_info)
        logger.debug(f"Current players in lobby {self.lobby_group_name}: {GameLobbyConsumer.lobby_players[self.lobby_group_name]}")

        # Respond to the client with success
        self.send_json({
            "type": "join_lobby_success",
            "message": f"Successfully joined lobby {self.lobby_group_name} as {player_role}.",
            "player_role": player_role,
        })

        # Broadcast updated player list to all clients in the lobby
        async_to_sync(self.channel_layer.group_send)(
            self.lobby_group_name,
            {
                "type": "update_player_list",
                "players": GameLobbyConsumer.lobby_players[self.lobby_group_name],
            }
        )

        logger.info(f"User {self.user.first_name} joined lobby {self.lobby_group_name} as {player_role}.")

    def handle_leave_lobby(self) -> None:
        """
        Handle explicit leave lobby request from the client.
        """
        logger.info(f"User {self.user.first_name} is leaving the lobby {self.lobby_group_name}")

        # Remove the player from the lobby
        self._remove_player_from_lobby()

        # Notify the user that they left successfully
        self.send_json({
            "type": "leave_lobby_success",
            "message": "You have successfully left the lobby.",
        })

        # Close the WebSocket connection
        self.close(code=1000)

    def _remove_player_from_lobby(self) -> None:
        """
        Shared logic to remove a player from the lobby and notify others.
        """
        if self.lobby_group_name in GameLobbyConsumer.lobby_players:
            # Log the player removal
            logger.info(f"Removing player {self.user.first_name} (ID: {self.user.id}) from lobby {self.lobby_group_name}")

            # Remove the player from the lobby's player list
            GameLobbyConsumer.lobby_players[self.lobby_group_name] = [
                p for p in GameLobbyConsumer.lobby_players[self.lobby_group_name]
                if p["id"] != self.user.id
            ]

            # Notify the lobby about the updated player list
            if GameLobbyConsumer.lobby_players[self.lobby_group_name]:  # Only broadcast if there are remaining players
                async_to_sync(self.channel_layer.group_send)(
                    self.lobby_group_name,
                    {
                        "type": "update_player_list",
                        "players": GameLobbyConsumer.lobby_players[self.lobby_group_name],
                    }
                )
                logger.info(f"Updated player list after removal: {GameLobbyConsumer.lobby_players[self.lobby_group_name]}")
            else:
                # If lobby is empty, clean up the lobby
                del GameLobbyConsumer.lobby_players[self.lobby_group_name]
                logger.info(f"Lobby {self.lobby_group_name} has been deleted after becoming empty.")
        else:
            logger.warning(f"Attempted to remove player from non-existent lobby {self.lobby_group_name}")

        # Remove the channel from the group
        async_to_sync(self.channel_layer.group_discard)(
            self.lobby_group_name,
            self.channel_name
        )
        logger.info(f"Channel {self.channel_name} has been removed from group {self.lobby_group_name}.")

    def handle_chat_message(self, content: dict) -> None:
        """
        Handle a chat message sent by the client to the server and broadcast it to all players in the lobby.

        Parameters:
            content (dict): The message payload sent by the client.
        """
        message = content.get("message", "")
        if not message:
            self.send_json({"type": "error", "message": "Message cannot be empty."})
            return

        if len(message) > 250:
            self.send_json({"type": "error", "message": "Message is too long. Maximum length is 250 characters."})
            return

        sender_name = self.user.first_name
        logger.info(f"Chat message from {sender_name}: {message}")
        
        # Broadcast chat message to the lobby
        logger.info(f"Broadcasting message to group {self.lobby_group_name}: {message}")
        async_to_sync(self.channel_layer.group_send)(
            self.lobby_group_name,
            {
                "type": "chat_message",
                "message": {
                    "sender": sender_name,
                    "content": message,
                },
            }
        )

    def chat_message(self, event: dict) -> None:
        """Send a chat message event to the WebSocket client."""
        logger.info(f"chat_message handler called with event: {event}")
        message = event.get("message")
        if message:
            logger.info(f"Broadcasting chat message in lobby {self.lobby_group_name}: {message['content']}")
            self.send_json({
                "type": "chat_message",
                "message": message,
            })
    
    def handle_start_game(self) -> None:
        """
        Handle the game start event and notify both players in the lobby.
        """
        if self.lobby_group_name not in GameLobbyConsumer.lobby_players:
            self.send_json({"type": "error", "message": "Lobby does not exist."})
            logger.error(f"Attempt to start a game in a non-existent lobby: {self.lobby_group_name}")
            return

        players = GameLobbyConsumer.lobby_players[self.lobby_group_name]

        # Validate players
        for player in players:
            if "first_name" not in player or not player["first_name"]:
                logger.error(f"Missing 'first_name' for player: {player}")
                self.send_json({"type": "error", "message": "Invalid player data in the lobby."})
                return

        if len(players) != 2:
            self.send_json({
                "type": "error",
                "message": "The game requires exactly two players to start."
            })
            logger.warning(
                f"Game start attempt with invalid number of players: {len(players)} "
                f"in {self.lobby_group_name}."
            )
            return

        # Randomize who starts first and determine player roles
        starting_turn = random.choice(["X", "O"])
        if starting_turn == "X":
            player_x, player_o = players[0], players[1]
        else:
            player_x, player_o = players[1], players[0]

        logger.info(
            f"Game started by {self.user.first_name} in lobby {self.lobby_group_name}. "
            f"Players: Player X = {player_x['first_name']}, Player O = {player_o['first_name']}, Starting turn = {starting_turn}"
        )

        try:
            # Fetch CustomUser instances
            from django.contrib.auth import get_user_model
            User = get_user_model()
            player_x_instance = User.objects.get(pk=player_x["id"])
            player_o_instance = User.objects.get(pk=player_o["id"])

            # Retrieve and update the game instance 
            game = TicTacToeGame.objects.get(id=self.game_id)
            game.refresh_from_db()  # Refresh the game instance to ensure it is up-to-date
            game.player_x = player_x_instance
            game.player_o = player_o_instance
            game.current_turn = starting_turn
            game.board_state = DEFAULT_BOARD_STATE
            game.save()  # Save updated game instance

            # Send acknowledgment to the player who started the game
            self.send_json({
                "type": "game_start_acknowledgment",
                "message": "Game has started successfully!",
                "game_id": game.id,
                "current_turn": starting_turn,
            })

        except User.DoesNotExist as e:
            logger.error(f"Failed to fetch user: {e}")
            self.send_json({
                "type": "error",
                "message": "Failed to start the game due to missing user data.",
            })
        except Exception as e:
            logger.error(f"Failed to broadcast game start message: {e}")
            self.send_json({
                "type": "error",
                "message": "Failed to start the game due to a server error.",
            })

    def game_start(self, event: dict) -> None:
        """
        Handle the game start event broadcast to the WebSocket group.

        Parameters:
            event (dict): The event data sent by the group.
        """
        logger.info(f"Broadcasting game start message in lobby {self.lobby_group_name}")
        self.send_json({
            "type": "game_start",
            "message": event["message"],
        })

    def update_player_list(self, event: dict) -> None:
        """
        Send the updated player list to the WebSocket client.
        """
        if self.scope["type"] == "websocket" and self.channel_name:
            try:
                players = event.get("players", [])
                self.send_json({
                    "type": "player_list",
                    "players": players,
                })
            except RuntimeError as e:
                logger.warning(
                    f"Attempted to send a message to a closed WebSocket connection: {e}"
                )
    
    def handle_move(self, content: dict) -> None:
        """
        Handle a move made by a player.

        Parameters:
            content (dict): The message payload containing the move details.
        """
        position = content.get("position")
        user = self.scope["user"]

        # Validate position
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

        try:
            # Retrieve the game
            game = TicTacToeGame.objects.get(id=self.game_id)
            logger.info(f"Game object retrieved: {game}")

            # Determine the player's marker ("X" or "O")
            player_marker = "X" if user == game.player_x else "O"
            logger.info(f"Player {user.first_name} ({player_marker}) made a move at position {position}")

            # Make the move
            game.make_move(position=position, player=player_marker)

            # AI Handling is triggered automatically if necessary
            logger.info(f"Move made successfully: {game.board_state}")

        except TicTacToeGame.DoesNotExist:
            logger.error("Game does not exist.")
            self.send_json({
                "type": "error",
                "message": "Game does not exist."
            })
        except ValidationError as e:
            logger.error(f"Invalid move: {e}")
            self.send_json({
                "type": "error",
                "message": str(e) if str(e) else "Invalid move due to a validation error."
            })

    def game_update(self, event: dict) -> None:
        """
        Broadcast the updated game state to all connected clients.
        """
        logger.info(f"Received game update event: {event}")

        try:
            # Validate required keys in the event payload
            required_keys = ["board_state", "current_turn", "winner"]
            if not all(key in event for key in required_keys):
                logger.error(f"Missing keys in event: {event}")
                self.send_json({"type": "error", "message": "Invalid game update payload."})
                return

            # Retrieve the game instance
            game = TicTacToeGame.objects.get(id=self.game_id)

            # Fetch the AI user dynamically (use caching or validation)
            ai_user = None
            if game.is_ai_game:
                ai_user = self.get_ai_user()
                if not ai_user:
                    logger.critical("AI user (ai@tictactoe.com) is missing. Please run migrations.")
                    self.send_json({"type": "error", "message": "AI user missing."})
                    return

            # Determine the user's role dynamically
            if not game.player_x or not game.player_o:
                logger.warning("Game is incomplete; waiting for players to join.")
                player_role = "Spectator"
            else:
                if self.user == game.player_x:
                    player_role = "X"
                elif self.user == game.player_o:
                    player_role = "O"
                else:
                    player_role = "Spectator"

            # Log player role determination
            logger.debug(f"Player Role Determination: user={self.user}, player_x={game.player_x}, player_o={game.player_o}, role={player_role}")

            # Prepare detailed player information
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

            # Broadcast the game update
            self.send_json({
                "type": "game_update",
                "game_id": game.id,
                "board_state": event["board_state"],
                "current_turn": event["current_turn"],
                "winner": event["winner"],
                "player_role": player_role,
                "player_x": player_x_info,
                "player_o": player_o_info,
            })
            logger.info("Game update broadcasted successfully.")
            logger.info(f"Broadcasting game update: Board State={game.board_state}, Current Turn={game.current_turn}")

        except TicTacToeGame.DoesNotExist:
            logger.error("Game does not exist.")
            self.send_json({"type": "error", "message": "Game does not exist."})
        except Exception as e:
            logger.error(f"Error during game update: {e}")
            self.send_json({"type": "error", "message": "An error occurred during the game update."})

    def get_ai_user(self):
        """
        Fetch the AI user. Ensure that the AI user exists in the database.
        """
        ai_user = User.objects.filter(email="ai@tictactoe.com").first()
        if not ai_user:
            logger.warning("AI user with email ai@tictactoe.com does not exist.")
        return ai_user

    def disconnect(self, code: int) -> None:
        """Handle WebSocket disconnection and remove the player from the lobby group."""
        user_name = self.user.first_name if not isinstance(self.user, AnonymousUser) else "Anonymous"

        # Check if lobby_group_name is set
        if not hasattr(self, "lobby_group_name"):
            logger.warning(f"User {user_name} disconnected before joining a lobby. Code: {code}")
            return

        logger.info(f"User {user_name} disconnected from lobby {self.lobby_group_name} with code {code}")

        # Check if the lobby group still exists
        if self.lobby_group_name in GameLobbyConsumer.lobby_players:
            # Remove the player from the lobby's player list
            GameLobbyConsumer.lobby_players[self.lobby_group_name] = [
                p for p in GameLobbyConsumer.lobby_players[self.lobby_group_name]
                if p["id"] != self.user.id
            ]

            # Notify the lobby about the updated player list
            if GameLobbyConsumer.lobby_players[self.lobby_group_name]:  # Only broadcast if there are remaining players
                async_to_sync(self.channel_layer.group_send)(
                    self.lobby_group_name,
                    {
                        "type": "update_player_list",
                        "players": GameLobbyConsumer.lobby_players[self.lobby_group_name],
                    }
                )
                logger.info(f"Updated player list after disconnection: {GameLobbyConsumer.lobby_players[self.lobby_group_name]}")
            else:
                # If lobby is empty, clean up the lobby
                del GameLobbyConsumer.lobby_players[self.lobby_group_name]
                logger.info(f"Lobby {self.lobby_group_name} has been deleted after becoming empty.")
        else:
            logger.warning(f"Lobby {self.lobby_group_name} does not exist when disconnecting.")

        # Remove the channel from the group
        async_to_sync(self.channel_layer.group_discard)(
            self.lobby_group_name,
            self.channel_name
        )
