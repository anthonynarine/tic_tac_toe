import logging
from asgiref.sync import async_to_sync
from channels.generic.websocket import JsonWebsocketConsumer
from .game_utils import GameUtils
from .chat_utils import ChatUtils
from .shared_utils_game_chat import SharedUtils

logger = logging.getLogger(__name__)

class ChatConsumer(JsonWebsocketConsumer):
    """
    WebSocket consumer for managing chat-specific functionality.
    """

    def connect(self):
        """
        Handle WebSocket connection for chat-related functionality.
        """

        logger.debug(f"WebSocket connection attempt received: Channel Name: {self.channel_name}")

        # Step 1: Extract the lobby group name from the URL route.
        self.lobby_group_name = self.scope["url_route"].get("kwargs", {}).get("lobby_name")
        logger.debug(f"Extracted lobby group name: {self.lobby_group_name}")

        # Step 2: Validate the lobby group name.
        if not self.lobby_group_name:
            logger.warning("Missing lobby name in WebSocket connection request.")
            self.send_json({"type": "error", "message": "Missing lobby name in connection request."})
            self.close(code=4002)  # Close with a specific error code for missing lobby name.
            return

        # Step 3: Authenticate the user using the scope.
        self.user = SharedUtils.authenticate_user(self.scope)
        if not self.user:
            logger.warning("Unauthenticated user tried to connect.")
            self.send_json({"type": "error", "message": "Unauthenticated user. Please log in."})
            self.close(code=4001)  # Close with a specific error code for authentication failure.
            return

        logger.info(
            f"User authenticated: {self.user.first_name} (ID: {self.user.id}), "
            f"attempting to join lobby group {self.lobby_group_name}."
        )

        # Step 4: Check for duplicate connections in the group.
        try:
            if hasattr(self.channel_layer, "group_channels"):  # Ensure the channel layer supports this feature
                active_channels = async_to_sync(self.channel_layer.group_channels)(self.lobby_group_name)
                if self.channel_name in active_channels:
                    logger.warning(
                        f"Duplicate connection detected: Channel {self.channel_name} is already part of group {self.lobby_group_name}. "
                        f"Skipping group_add."
                    )
                    self.close(code=4003)  # Close the duplicate connection.
                    return
            else:
                logger.warning("group_channels not supported by the current channel layer.")
        except Exception as e:
            logger.error(
                f"Failed to retrieve active channels for group {self.lobby_group_name}. Error: {e}"
            )

        # Step 5: Add the WebSocket channel to the specified group for real-time communication.
        try:
            logger.debug(
                f"Attempting to add channel {self.channel_name} to group {self.lobby_group_name} "
                f"for user {self.user.first_name} (ID: {self.user.id})"
            )
            async_to_sync(self.channel_layer.group_add)(
                self.lobby_group_name,
                self.channel_name,
            )
            logger.info(
                f"Channel {self.channel_name} successfully added to group {self.lobby_group_name} "
                f"by user {self.user.first_name} (ID: {self.user.id})"
            )
        except Exception as e:
            logger.error(
                f"Failed to add channel {self.channel_name} to group {self.lobby_group_name} "
                f"for user {self.user.first_name}. Error: {e}"
            )
            self.close(code=5000)  # Close with a generic error code for server-side issues.
            return

        # Step 6: Accept the WebSocket connection.
        logger.info(f"WebSocket connection accepted: Channel Name: {self.channel_name}")
        self.accept()




    def receive_json(self, content: dict, **kwargs) -> None:
        """
        Handle incoming chat-related messages from the WebSocket client.

        Steps:
        1. Validate the incoming JSON message structure using `SharedUtils.validate_message`.
        2. Determine the message type from the `type` field in the payload.
        3. Route valid messages to their appropriate handler methods (e.g., `handle_chat_message`).
        4. Send error responses for invalid or unsupported message types.
        5. Log unexpected errors during message processing.

        Parameters:
            content (dict): The JSON message payload sent by the client. 
        """
        # Step 1: Validate the incoming message structure.
        logger.debug(f"Received WebSocket message: {content}")
        if not SharedUtils.validate_message(content):
            logger.warning(f"Invalid message received. Content: {content}. Closing connection.")
            self.close(code=4003)
            return

        # Step 2: Extract and normalize the message type.
        message_type = content.get("type", "").lower()

        try:
            # Step 3: Route the message to the appropriate handler based on its type.
            if message_type == "chat_message":
                self.handle_chat_message(content)
            else:
                # Step 4: Send an error response for unsupported message types.
                SharedUtils.send_error(self, "Invalid message type.")
        except Exception as e:
            # Step 5: Log unexpected errors and send a generic error response.
            logger.error(f"Unexpected error in ChatConsumer. Content: {content}. Error: {e}")
            SharedUtils.send_error(self, f"An unexpected error occurred.")

    def handle_chat_message(self, content: dict) -> None:
        """
        Handle a chat message sent by the client to the server and broadcast it to all players in the lobby.

        Steps:
        1. Validate the incoming chat message using `ChatUtils.validate_message`.
        2. Ensure the user is authenticated and extract sender details.
        3. Add the sender field to the message.
        4. Broadcast the chat message to all clients in the lobby group.
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

        Steps:
        1. Extract the message content from the event payload.
        2. Send the formatted chat message to the WebSocket client.
        """
        logger.info(f"chat_message handler called with event: {event}")

        # Step 1: Extract the message from the event.
        message = event.get("message")
        if not isinstance(message, dict) or "content" not in message:
            logger.warning(f"Invalid message structure in chat_message event: {event}")
            self.send_json({"type": "error", "message": "Invalid message structure."})
            return

        # Step 2: Send the chat message to the WebSocket client.
        logger.info(f"Broadcasting chat message in lobby {self.lobby_group_name}: {message['content']}")
        self.send_json({
            "type": "chat_message",
            "message": message,
        })

    def disconnect(self, code: int) -> None:
        """
        Handle WebSocket disconnection for chat-related functionality.

        Steps:
        1. Ensure `lobby_group_name` exists.
        2. Attempt to remove the user from the lobby group and handle cleanup.
        3. Remove the WebSocket channel from the group.
        """
        logger.debug(f"Disconnecting WebSocket for code: {code}")

        # Step 1: Ensure `lobby_group_name` exists.
        if not hasattr(self, "lobby_group_name") or not self.lobby_group_name:
            logger.warning("Chat user disconnected before joining a chat lobby or lobby_group_name is missing.")
            return

        # Step 2: Attempt to remove the user from the lobby group and handle cleanup.
        try:
            if hasattr(self, "user") and self.user:
                if self.lobby_group_name in GameUtils.lobby_players:
                    logger.debug(f"Removing user {self.user.first_name} from lobby group {self.lobby_group_name}.")
                    GameUtils._remove_player_from_lobby(
                        user=self.user,
                        group_name=self.lobby_group_name,
                        channel_layer=self.channel_layer,
                        channel_name=self.channel_name,
                    )
                else:
                    logger.debug(f"Lobby group {self.lobby_group_name} not found in active lobby players.")
            else:
                logger.warning("User attribute is missing or user is not authenticated during disconnection.")
        except Exception as e:
            logger.error(f"Error during chat disconnection for user: {getattr(self, 'user', 'Unknown')}. Error: {e}")

        # Step 3: Remove the WebSocket channel from the group.
        try:
            async_to_sync(self.channel_layer.group_discard)(
                self.lobby_group_name,
                self.channel_name,
            )
            
            logger.info(f"Chat user {getattr(self.user, 'first_name', 'Unknown')} disconnected from chat lobby {self.lobby_group_name}")
        except Exception as e:
            logger.error(f"Error removing WebSocket channel from group {self.lobby_group_name}. Error: {e}")
