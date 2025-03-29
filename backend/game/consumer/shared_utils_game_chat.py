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
        Validate the incoming WebSocket message content to ensure it conforms to expected format and types.

        Args:
            content (dict): The WebSocket message payload.

        Returns:
            bool: True if valid, False otherwise.
        """
        logger.debug(f"Validating message: {content}")

        # Step 1: Ensure the message is a dictionary
        if not isinstance(content, dict):
            logger.warning(f"Invalid format: Expected dict, got {type(content).__name__}")
            return False

        # Step 2: Require the "type" field
        message_type = content.get("type")
        if message_type is None:
            logger.warning(f"Missing 'type' field in message: {content}")
            return False

        # Step 3: Type must be a string
        if not isinstance(message_type, str):
            logger.warning(f"'type' field must be a string, got {type(message_type).__name__}")
            return False

        # Step 4: Normalize the type for consistent validation
        message_type = message_type.lower()

        # Step 5: Define allowed WebSocket message types (from Game and Chat Consumers)
        valid_types = {
            "chat_message",
            "update_user_list",
            "start_game",
            "leave_lobby",
            "game_update",
            "game_start_acknowledgment",
            "connection_success",
            "player_list",
            "rematch_request",
            "rematch_accept",
            "rematch_decline",
            "error",
        }

        # Step 6: Extra validation for chat messages
        if message_type == "chat_message" and "message" not in content:
            logger.warning(f"'chat_message' must include a 'message' field: {content}")
            return False

        # Step 7: Ensure it's a valid message type
        if message_type not in valid_types:
            logger.warning(f"Unsupported message type: {message_type}. Valid types: {valid_types}")
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