import code
import logging
from os import error
from xml.dom import ValidationErr
from channels.generic.websocket import JsonWebsocketConsumer
from asgiref.sync import async_to_sync
from django.contrib.auth.models import AnonymousUser
from django.forms import ValidationError
from game.models import TicTacToeGame

logger = logging.getLogger(__name__)

class GameLobbyConsumer(JsonWebsocketConsumer):
    """
    WebSocket consumer for managing a game lobby with chat functionality.
    Features:
        - Authenticated connection via middleware.
        - Temporary chat messages that only live in the lobby.
        - Game-related events, such as starting the game.
    """
    # Maintain a dictionary to track players in each lobby
    lobby_players = {}  # Format: {"game_lobby_<game_id>": [{"username": <name>, "id": <id>}, ...]}

    def connect(self) -> None:
        """Handle WebSocket connection. Authenticate the user and join the game lobby group."""
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
        player = {"id": self.user.id, "username": self.user.first_name}
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
        Handle incoming messages from the WebSocket client.
        
        Parameters:
            content (dict): The message payload sent by the client.
            **kwargs: Additional optional parameters.
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

        # Respond to the client with success
        self.send_json({
            "type": "join_lobby_success",
            "message": f"Successfully joined lobby {self.lobby_group_name}",
        })
        
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
        # Ensure the lobby exists and has exactly two players
        if self.lobby_group_name not in GameLobbyConsumer.lobby_players:
            self.send_json({"type": "error", "message": "Lobby does not exist."})
            logger.error(f"Attempt to start a game in a non-existent lobby: {self.lobby_group_name}")
            return

        players = GameLobbyConsumer.lobby_players[self.lobby_group_name]

        # Ensure the lobby has exactly two players
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

        # Log the players who are starting the game
        logger.info(
            f"Game started by {self.user.first_name} in lobby {self.lobby_group_name}. "
            f"Players: {[player['username'] for player in players]}"
        )

        # Broadcast game start message
        try:
            async_to_sync(self.channel_layer.group_send)(
                self.lobby_group_name,
                {
                    "type": "game_start",  # Ensure this matches the event handler name
                    "message": f"{self.user.first_name} has started the game!",
                }
            )
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

        # Check if position is provided and valid
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

            # Broadcast updated game state
            async_to_sync(self.channel_layer.group_send)(
                self.lobby_group_name,
                {
                    "type": "game_update",
                    "board_state": game.board_state,
                    "current_turn": game.current_turn,
                    "winner": game.winner,
                }
            )
            logger.info(f"Broadcasting game state: {game.board_state}, Current Turn: {game.current_turn}")

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

        Parameters:
            event (dict): The message payload containing the game state.
        """
        logger.info(f"Received game update event: {event}")
        self.send_json({
            "type": "game_update",
            "board_state": event["board_state"],  # Default empty board
            "current_turn": event["current_turn"],       # Default turn to X
            "winner": event["winner"],                 # Default no winner
        })

    def disconnect(self, code: int) -> None:
        """Handle WebSocket disconnection and remove the player from the lobby group."""
        user_name = self.user.first_name if not isinstance(self.user, AnonymousUser) else "Anonymous"

        # Check if lobby_group_name is set
        if not hasattr(self, "lobby_group_name"):
            logger.warning(f"User {user_name} disconnected before joining a lobby. Code: {code}")
            return

        logger.info(f"User {user_name} disconnected from lobby {self.lobby_group_name} with code {code}")

        # Remove the player from the lobby's players list
        if self.lobby_group_name in GameLobbyConsumer.lobby_players:
            GameLobbyConsumer.lobby_players[self.lobby_group_name] = [
                p for p in GameLobbyConsumer.lobby_players[self.lobby_group_name]
                if p["id"] != self.user.id
            ]

            # Notify the lobby about the updated player list
            async_to_sync(self.channel_layer.group_send)(
                self.lobby_group_name,
                {
                    "type": "update_player_list",
                    "players": GameLobbyConsumer.lobby_players[self.lobby_group_name],
                }
            )

        # Remove the channel from the group
        async_to_sync(self.channel_layer.group_discard)(
            self.lobby_group_name,
            self.channel_name
        )

        logger.info(f"Updated player list after disconnection: {GameLobbyConsumer.lobby_players[self.lobby_group_name]}")
