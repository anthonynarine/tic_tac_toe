import logging
from asgiref.sync import async_to_sync
from channels.generic.websocket import JsonWebsocketConsumer
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
