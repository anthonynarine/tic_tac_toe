import logging
from asgiref.sync import async_to_sync
from channels.generic.websocket import JsonWebsocketConsumer
from .game_utils import GameUtils

from backend.game.consumer.chat_utils import ChatUtils
from .shared_utils_game_chat import SharedUtils

logger = logging.getLogger(__name__)

class ChatConsumer(JsonWebsocketConsumer):
    """
    WebSocket consumer for managing chat-specific functionality.
    """
    
    def connect(self):
        """
        Handle WebSocket connection for chat-related functionality.

        This method is responsible for:
        1. Extracting the lobby group name from the WebSocket URL route.
        2. Validating the lobby group name.
        3. Authenticating the user using `SharedUtils.authenticate_user`.
        4. Adding the WebSocket channel to the specified group for real-time communication.
        5. Sending error responses and closing the connection in case of invalid input or authentication failure.
        6. Accepting the WebSocket connection if all checks pass.

        Raises:
            Exception: Logs and sends error responses for invalid lobby group names or authentication failures.
        """
        # Step 1: Extract the lobby group name from the URL route.
        self.lobby_group_name = self.scope["url_route"].get("kwargs", {}).get("lobby_name")

        # Step 2: Validate the lobby group name.
        if not self.lobby_group_name:
            logger.warning("Missing lobby name in WebSocket connection request.")
            self.send_json({"type": "error", "message": "Missing lobby name in connection request."})
            self.close(code=4002)  # Close with a specific error code for missing lobby name.
            return

        # Step 3: Authenticate the user.
        if not SharedUtils.authenticate_user(self.scope):
            self.send_json({"type": "error", "message": "Unauthenticated user. Please log in."})
            self.close(code=4001)  # Close with a specific error code for authentication failure.
            return

        # Step 4: Add the WebSocket channel to the specified lobby group.
        async_to_sync(self.channel_layer.group_add)(
            self.lobby_group_name, self.channel_name
        )
        logger.info(f"Chat WebSocket connected for group: {self.lobby_group_name}")

        # Step 5: Accept the WebSocket connection.
        self.accept()

    def receive_json(self, content: dict, **kwargs) -> None:
        """
        Handle incoming chat-related messages from the WebSocket client.

        This method is responsible for:
        1. Validating the incoming JSON message structure using `SharedUtils.validate_message`.
        2. Determining the message type from the `type` field in the payload.
        3. Routing valid messages to their appropriate handler methods (e.g., `handle_chat_message`).
        4. Sending error responses for invalid or unsupported message types.
        5. Logging unexpected errors during message processing.

        Parameters:
            content (dict): The JSON message payload sent by the client. 
                            Expected to contain a "type" field that indicates the type of message.
            **kwargs: Additional arguments passed to the method (not used in this context).

        Raises:
            Exception: Catches and logs any unexpected errors during message processing.
                    Sends an error response to the client in case of such errors.
        """
        # Step 1: Validate the incoming message structure.
        if not SharedUtils.validate_message(content):
            # Close the connection if the message is invalid.
            self.close(code=4003)
            return

        # Step 2: Extract and normalize the message type.
        message_type = content.get("type").lower()

        try:
            # Step 3: Route the message to the appropriate handler based on its type.
            if message_type == "chat_message":
                # Handle chat-specific messages.
                self.handle_chat_message(content)
            else:
                # Send an error response for unsupported message types.
                SharedUtils.send_error(self, "Invalid message type.")
        except Exception as e:
            # Step 4: Log unexpected errors and send a generic error response.
            logger.error(f"Unexpected error in ChatConsumer: {e}")
            SharedUtils.send_error(self, f"An unexpected error occurred: {str(e)}")

    def handle_chat_message(self, content: dict) -> None:
        """
        Handle a chat message sent by the client to the server and broadcast it to all players in the lobby.

        Parameters:
            content (dict): The message payload sent by the client.
        """
        try:
            # Validate the message
            logger.info(f"Received chat message from user: {self.user.first_name}")
            ChatUtils.validate_message(content)

            # Extract sender name and message content
            sender_name = self.user.first_name
            message = content["message"]
            logger.info(f"Chat message from {sender_name}: {message}")

            # Broadcast the chat message to the lobby
            ChatUtils.broadcast_chat_message(
                channel_layer=self.channel_layer,
                group_name=self.lobby_group_name,
                sender_name=sender_name,
                message=message,
            )
        except ValueError as e:
            logger.warning(f"Chat message validation failed: {e}")
            self.send_json({"type": "error", "message": str(e)})

    def chat_message(self, event: dict) -> None:
        """
        Send a chat message event to the WebSocket client.

        Args:
            event (dict): The message payload sent by the server (via group_send).
        """
        logger.info(f"chat_message handler called with event: {event}")

        message = event.get("message")
        if "content" in message:
            logger.info(f"Broadcasting chat message in lobby {self.lobby_group_name}: {message['content']}")
            self.send_json({
                "type": "chat_message",
                "message": message,
            })
        else:
            logger.warning(f"chat_message event missing 'content' field: {event}")
            self.send_json({"type": "error", "message": "Invalid chat message format."})

    def disconnect(self, code: int) -> None:
        """
        Handle WebSocket disconnection for chat-related functionality.

        Parameters:
            code (int): The WebSocket close code.
        """
        if not hasattr(self, "lobby_group_name"):
            logger.warning("Chat user disconnected before joining a chat lobby")
            return

        try:
            if self.lobby_group_name in GameUtils.lobby_players:
                GameUtils._remove_player_from_lobby(
                    user=self.user,
                    group_name=self.lobby_group_name,
                    channel_layer=self.channel_layer,
                    channel_name=self.channel_name,
                )
        except Exception as e:
            logger.error(f"Error during chat disconnection: {e}")

        async_to_sync(self.channel_layer.group_discard)(
            self.lobby_group_name,
            self.channel_name,
        )
        logger.info(f"Chat user {self.user.first_name} disconnected from chat lobby {self.lobby_group_name}")
