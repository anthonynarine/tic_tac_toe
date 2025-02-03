from typing import TYPE_CHECKING
from asgiref.sync import async_to_sync
from django.contrib.auth import get_user_model
from channels.layers import BaseChannelLayer
import logging

# Import AbstractBaseUser for type hints during static analysis only
if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractBaseUser

# Dynamically fetch the User model at runtime
User = get_user_model()

logger = logging.getLogger(__name__)

class SharedUtils:
    """
    Utility class for shared functionality between ChatConsumer and GameConsumer.
    """

    @staticmethod
    def authenticate_user(scope: dict):
        """
        Authenticate the WebSocket user based on the scope.

        Args:
            scope (dict): The connection scope containing the user information.

        Returns:
            User: The authenticated user object if authentication is successful, None otherwise.
        """
        # Extract the user from the scope
        user = scope.get("user", None)

        # Check if the user is valid
        if user and not user.is_anonymous:
            logger.info(f"User authenticated: {user.first_name} (ID: {user.id})")
            return user

        # Log unauthenticated access
        logger.warning("Unauthenticated user attempted to connect.")
        return None

    @staticmethod
    def validate_message(content: dict) -> bool:
        """
        Validate the incoming WebSocket message content.

        Parameters:
            content (dict): The WebSocket message payload to validate.

        Returns:
            bool: True if the message is valid, False otherwise.
        """
        logger.debug(f"Validating message: {content}")

        # Step 1: Check if the content is a dictionary
        if not isinstance(content, dict):
            logger.warning(f"Invalid message format received: Expected a JSON object, got {type(content).__name__}.")
            return False

        # Step 2: Always require the "type" field
        if "type" not in content:
            logger.warning(f"Message missing required 'type' field. Received: {content}")
            return False

        # Step 3: Validate that "type" is a string
        if not isinstance(content["type"], str):
            logger.warning(f"Invalid 'type' field: Expected a string, got {type(content['type']).__name__}.")
            return False

        # Step 4: Define all valid WebSocket message types (from Game and Chat Consumers)
        valid_types = (
            "chat_message",  # User sends a chat message
            "update_user_list",  # Server updates lobby user list
            "start_game",  # A player starts the game
            "leave_lobby",  # A player leaves the game
            "game_update",  # Server sends updated game state
            "game_start_acknowledgment",  # Server confirms game has started
            "connection_success",  # WebSocket connection is established
            "player_list",  # Update player list in the lobby
            "error"  # Error messages from the server
        )

        # Step 5: If the message type is "chat_message", require a "message" field
        if content["type"] == "chat_message" and "message" not in content:
            logger.warning(f"Chat messages require a 'message' field. Received: {content}")
            return False

        # Step 6: Ensure the message type is valid
        if content["type"] not in valid_types:
            logger.warning(f"Unsupported message type: {content['type']}. Valid types: {valid_types}")
            return False

        logger.debug("Message validation passed.")
        return True

    @staticmethod
    def send_error(consumer, message: str, code: int = 4003):
        """
        Send an error message and close the WebSocket connection.
        """
        consumer.send_json({"type": "error", "message": message})
        consumer.close(code=code)