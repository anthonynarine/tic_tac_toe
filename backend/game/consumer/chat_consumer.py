import logging
from asgiref.sync import async_to_sync
from channels.generic.websocket import JsonWebsocketConsumer
from .game_utils import GameUtils
from .chat_utils import ChatUtils
from .shared_utils_game_chat import SharedUtils
from django.contrib.auth.models import AnonymousUser
from typing import TypedDict, List


logger = logging.getLogger(__name__)

class ChatConsumer(JsonWebsocketConsumer):
    """
    WebSocket consumer for managing chat-specific functionality.
    """

    def connect(self) -> None:
        """
        Handle WebSocket connection for the game lobby.

        This method manages the initialization of a WebSocket connection for a game 
        lobby. It authenticates the user, validates the lobby name, adds the WebSocket 
        channel to the appropriate group, tracks participants, and broadcasts updates 
        to all connected clients.

        Args:
            None: This method is triggered automatically when a WebSocket connection is established.

        Returns:
            None: Sends responses or updates to the connected WebSocket client and other participants.

        Steps:
            1. Authenticate the user using the `SharedUtils.authenticate_user` helper function.
            2. Extract and validate the `lobby_group_name` from the WebSocket URL parameters.
            3. Initialize the lobby state in `SharedUtils.lobby_players` if it doesn't already exist.
            4. Prevent duplicate WebSocket connections by checking for the `channel_name` in the lobby's state.
            5. Add the WebSocket channel to the appropriate group using the `channel_layer`.
            6. Add the user to the lobby participant list to track active players.
            7. Broadcast the updated participant list to all clients in the lobby.
            8. Accept the WebSocket connection and send a success message to the client.

        Raises:
            None: Any errors are logged and appropriate error messages are sent to the client before closing the connection.
        """
        logger.debug(f"WebSocket connection attempt received: Channel Name: {self.channel_name}")

        # Step 1: Authenticate the user
        self.user = SharedUtils.authenticate_user(self.scope)
        if not self.user:
            logger.warning("WebSocket connection rejected: User not authenticated.")
            self.close(code=4001)  # Close the connection with an authentication error code
            return

        # Step 2: Extract and validate the lobby name
        self.lobby_group_name = self.scope["url_route"]["kwargs"].get("lobby_name")
        if not self.lobby_group_name:
            logger.error("WebSocket connection rejected: Missing 'lobby_name' in URL.")
            self.send_json({"type": "error", "message": "Missing lobby_name in URL."})
            self.close(code=4002)  # Close the connection with a validation error code
            return

        # Step 3: Initialize the lobby state if it doesn't exist
        if self.lobby_group_name not in SharedUtils.lobby_players:
            SharedUtils.lobby_players[self.lobby_group_name] = {"channels": set(), "players": []}
            logger.info(f"New chat lobby initialized: {self.lobby_group_name}")

        # Step 4: Prevent duplicate connections for the same user
        existing_players = SharedUtils.lobby_players[self.lobby_group_name]["players"]
        if self.user.id in [player["id"] for player in existing_players]:
            logger.warning(
                f"Duplicate WebSocket connection detected for user {self.user.first_name} "
                f"(ID: {self.user.id}) in lobby {self.lobby_group_name}. Closing connection."
            )
            self.close(code=4004)
            return


        # Step 5: Add the WebSocket channel to the group
        try:
            async_to_sync(self.channel_layer.group_add)(
                self.lobby_group_name,
                self.channel_name
            )
            SharedUtils.lobby_players[self.lobby_group_name]["channels"].add(self.channel_name)
            logger.info(f"WebSocket channel {self.channel_name} added to group {self.lobby_group_name}.")
        except Exception as e:
            logger.error(f"Error adding channel {self.channel_name} to group {self.lobby_group_name}: {e}")
            self.close(code=5000)  # Close the connection with a server error code
            return

        # Step 6: Add the user to the lobby participant list
        SharedUtils.lobby_players[self.lobby_group_name]["players"] = [
            player for player in SharedUtils.lobby_players[self.lobby_group_name]["players"]
            if player["id"] != self.user.id
        ]
        SharedUtils.lobby_players[self.lobby_group_name]["players"].append({"id": self.user.id, "first_name": self.user.first_name})

        # Step 7: Broadcast the updated participant list to all clients
        async_to_sync(self.channel_layer.group_send)(
            self.lobby_group_name,
            {
                "type": "update_user_list",
                "players": SharedUtils.lobby_players[self.lobby_group_name]["players"],
            },
        )
        logger.info(f"Updated Players list broadcasted for lobby {self.lobby_group_name}.")

        # Step 8: Accept the WebSocket connection and send success message
        self.accept()
        self.send_json({
            "type": "connection_success",
            "message": f"Welcome to the chat lobby, {self.user.first_name}!",
        })
        logger.info(f"User {self.user.first_name} joined chat lobby: {self.lobby_group_name}.")

    def receive_json(self, content: dict, **kwargs) -> None:
        """
        Handle incoming chat-related messages from the WebSocket client.

        This method processes JSON messages sent by the client, validates the structure,
        and routes the message to the appropriate handler method based on its type. 
        It handles errors gracefully by logging and sending error responses when needed.

        Args:
            content (dict): The JSON message payload sent by the client. Expected structure:
                {
                    "type": <str>,  # The type of the message (e.g., "chat_message").
                    "message": <any>,  # The actual message payload (optional, varies by type).
                }
            **kwargs: Additional arguments passed by Django Channels (not used here).

        Returns:
            None: Routes the message or sends an error response to the WebSocket client.

        Steps:
            1. Validate the incoming JSON message structure using `SharedUtils.validate_message`.
            2. Extract and normalize the `type` field from the payload.
            3. Route valid messages to their appropriate handler methods (e.g., `handle_chat_message`).
            4. Send error responses for invalid or unsupported message types.
            5. Log unexpected errors during message processing.

        Raises:
            None: Errors are logged and handled with appropriate responses sent to the client.
        """
        # Step 1: Validate the incoming message structure.
        logger.debug(f"Received WebSocket message: {content}")
        if not SharedUtils.validate_message(content):
            logger.warning(f"Invalid message received. Content: {content}. Closing connection.")
            self.close(code=4003)  # Close the connection for invalid message structure.
            return

        # Step 2: Extract and normalize the message type.
        message_type = content.get("type", "").lower()  # Normalize to lowercase for consistency.

        try:
            # Step 3: Route the message to the appropriate handler based on its type.
            if message_type == "chat_message":
                self.handle_chat_message(content)  # Route to chat message handler.
            else:
                # Step 4: Send an error response for unsupported message types.
                logger.warning(f"Unsupported message type received: {message_type}")
                SharedUtils.send_error(self, "Invalid message type.")

        except Exception as e:
            # Step 5: Log unexpected errors and send a generic error response.
            logger.error(f"Unexpected error in ChatConsumer. Content: {content}. Error: {e}")
            SharedUtils.send_error(self, "An unexpected error occurred.")

    def handle_chat_message(self, content: dict) -> None:
        """
        Handle a chat message sent by the client and broadcast it to all players in the lobby.

        This method processes incoming chat messages from a WebSocket client, validates 
        the message, and broadcasts it to all connected clients in the same lobby group.

        Args:
            content (dict): The message payload received from the client. Expected structure:
                {
                    "type": "chat_message",
                    "message": <str>  # The chat message content sent by the client.
                }

        Returns:
            None: Sends a JSON response back to the client on success or failure.

        Steps:
            1. Validate the incoming chat message using `ChatUtils.validate_message`.
            2. Ensure the user is authenticated and extract sender details.
            3. Add the sender field to the message.
            4. Validate that the message content is non-empty.
            5. Ensure the lobby group exists and is valid.
            6. Broadcast the chat message to all clients in the lobby group.

        Raises:
            ValueError: If the message format is invalid.
            KeyError: If required keys are missing in the message payload.
            Exception: For unexpected errors during message handling.
        """
        try:
            # Step 1: Validate the message format.
            logger.debug(f"Validating chat message: {content}")
            ChatUtils.validate_message(content)

            # Step 2: Ensure the user is authenticated.
            if not hasattr(self, "user") or not self.user:
                logger.error("User not authenticated or missing during chat message handling.")
                self.send_json({"type": "error", "message": "User not authenticated."})
                return

            # Step 3: Extract the sender's name and message content.
            sender_name = getattr(self.user, "first_name", "Unknown")
            message = content.get("message", "").strip()

            # Step 4: Validate the message content (non-empty check).
            if not message:
                logger.warning(f"Empty message received from user: {sender_name}")
                self.send_json({"type": "error", "message": "Message cannot be empty."})
                return

            # Step 5: Ensure the lobby group exists.
            if not hasattr(self, "lobby_group_name") or not self.lobby_group_name:
                logger.error("Lobby group name is missing or invalid.")
                self.send_json({"type": "error", "message": "Lobby group not found."})
                return

            # Step 6: Broadcast the chat message with the sender's name.
            logger.info(f"Broadcasting chat message from {sender_name}: {message}")
            ChatUtils.broadcast_chat_message(
                channel_layer=self.channel_layer,
                group_name=self.lobby_group_name,
                sender_name=sender_name,
                message=message,
            )

        except ValueError as e:
            # Handle validation errors raised by `ChatUtils.validate_message`.
            logger.warning(f"Chat message validation failed: {e}")
            self.send_json({"type": "error", "message": str(e)})
        except KeyError as e:
            # Handle missing keys in the message payload.
            logger.error(f"Missing key in chat message payload: {e}")
            self.send_json({"type": "error", "message": f"Missing key: {e}"})
        except Exception as e:
            # Handle unexpected errors.
            logger.error(f"Unexpected error in handle_chat_message: {e}")
            self.send_json({"type": "error", "message": "An unexpected error occurred."})

    def chat_message(self, event: dict) -> None:
        """
        Send a chat message event to the WebSocket client.

        This method is triggered when a `chat_message` event is broadcasted to the lobby group.
        It processes the event payload, validates the message structure, and sends the message
        to the connected WebSocket client.

        Args:
            event (dict): The event payload sent by the backend. Expected structure:
                {
                    "type": "chat_message",
                    "message": {
                        "sender": <str>,  # The name of the message sender.
                        "content": <str>,  # The content of the chat message.
                    }
                }

        Returns:
            None: Sends the chat message to the connected WebSocket client.

        Steps:
            1. Extract the message content from the event payload and validate its structure.
            2. Send the formatted chat message to the WebSocket client.

        Raises:
            None: Errors are handled by logging warnings and sending error responses to the client.
        """
        logger.info(f"chat_message handler called with event: {event}")

        # Step 1: Extract the message from the event payload.
        message = event.get("message")
        if not isinstance(message, dict) or "content" not in message:
            logger.warning(f"Invalid message structure in chat_message event: {event}")
            self.send_json({"type": "error", "message": "Invalid message structure."})
            return

        # Step 2: Send the chat message to the WebSocket client.
        logger.info(f"Broadcasting chat message in lobby {self.lobby_group_name}: {message['content']}")
        self.send_json({
            "type": "chat_message",  # Message type for frontend handling.
            "message": message,  # The validated chat message payload.
        })

    def disconnect(self, code: int) -> None:
        """
        Handle WebSocket disconnection for chat-related functionality.

        This method ensures that when a WebSocket connection is disconnected, the associated
        channel and user are removed from the lobby group. If the lobby becomes empty (no players
        or channels remain), it cleans up the lobby entirely. It also handles errors gracefully
        and logs detailed information for debugging.

        Args:
            code (int): The WebSocket close code indicating the reason for disconnection.

        Steps:
            1. Ensure `lobby_group_name` exists for the connection. If missing, log a warning and exit.
            2. Attempt to remove the user and channel from the lobby group, updating the lobby state.
            3. If the lobby has no players or channels remaining, delete it from the shared state.
            4. Remove the WebSocket channel from the group using `channel_layer.group_discard`.
            5. Log success or any errors encountered during cleanup.
        """
        logger.debug(f"Disconnecting WebSocket for code: {code}, Channel: {self.channel_name}")

        # Step 1: Ensure `lobby_group_name` exists
        if not hasattr(self, "lobby_group_name") or not self.lobby_group_name:
            logger.warning(
                f"User disconnected before joining a chat lobby. Channel: {self.channel_name}"
            )
            return

        # Step 2: Attempt to remove the user from the lobby group and handle cleanup
        try:
            # Check if the lobby exists in the shared state
            if self.lobby_group_name in SharedUtils.lobby_players:
                # Remove the user from the players list
                SharedUtils.lobby_players[self.lobby_group_name]["players"] = [
                    player for player in SharedUtils.lobby_players[self.lobby_group_name]["players"]
                    if player["id"] != self.user.id
                ]
                
                # Remove the WebSocket channel from the channels set
                SharedUtils.lobby_players[self.lobby_group_name]["channels"].discard(
                    self.channel_name
                )

                # Step 3: Clean up the lobby if no players or channels remain
                if not SharedUtils.lobby_players[self.lobby_group_name]["players"] and \
                not SharedUtils.lobby_players[self.lobby_group_name]["channels"]:
                    del SharedUtils.lobby_players[self.lobby_group_name]
                    logger.info(f"Lobby {self.lobby_group_name} cleaned up as it is now empty.")
        except Exception as e:
            # Log any errors encountered during cleanup
            logger.error(
                f"Error during disconnection for channel {self.channel_name}. Error: {e}"
            )

        # Step 4: Remove the WebSocket channel from the group
        try:
            async_to_sync(self.channel_layer.group_discard)(
                self.lobby_group_name,
                self.channel_name,
            )
            logger.info(f"Channel {self.channel_name} removed from group {self.lobby_group_name}.")
        except Exception as e:
            # Log any errors encountered when discarding the channel
            logger.error(f"Error removing channel {self.channel_name} from group {self.lobby_group_name}: {e}")

    def update_user_list(self, event: dict) -> None:
        """
        Handle the "update_user_list" message type.
        
        This method is triggered when the backend broadcasts an updated list of players
        in the chat lobby. It processes the event and sends the updated list of players
        to the connected WebSocket client.
        
        Args:
            event (dict): The event payload sent by the backend. Expected structure:
            {
                "type": "update_user_list",
                "players": [
                    {"id": <int>, "first_name": <str>},
                    ...
                ]
            }
        Returns:
            None: This method sends a JSON response back to the client.
        """
        # Step 1: Extract and validate the list of players from the event payload
        players: list[dict] = event.get("players", [])
        validated_players = [
            player for player in players if isinstance(player.get("id"), int) and isinstance(player.get("first_name"), str)
        ]
        
        # Step 2: Log the received event payload for debugging
        logger.debug(f"Processing 'update_user_list' event with players: {validated_players}")

        # Step 3: Send the updated player list to the WebSocket client
        self.send_json({
            "type": "update_user_list",  # The message type for frontend handling
            "players": validated_players,  # The updated list of players in the lobby
        })
        
        # Step 4: Log the action for monitoring purposes
        logger.info(f"Sent updated user list to client: {validated_players}")

        