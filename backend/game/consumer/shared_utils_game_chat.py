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
    lobby_players = {}  # Shared dictionary for tracking players in lobbies.

class SharedUtils:
    """
    Utility class for shared functionality between ChatConsumer and GameConsumer.
    """
    lobby_players = {}  # Shared dictionary for tracking players in lobbies.

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
        Validate the incoming message content.
        
        Parameters:
            content (dict): The message payload to validate.
            
        Returns:
            bool: True if the message is valid, False otherwise.
        """
        logger.debug(f"Validating message: {content}")

        # Step 1: Check if the content is a dictionary
        if not isinstance(content, dict):
            logger.warning(f"Invalid message format received: Expected a JSON object, got {type(content).__name__}.")
            return False

        # Step 2: Ensure required fields are present
        required_fields = ["type", "message"]
        missing_fields = [field for field in required_fields if field not in content]
        if missing_fields:
            logger.warning(f"Message missing required fields: {missing_fields}. Received: {content}")
            return False

        # Step 3: Validate the data types of the fields
        if not isinstance(content["type"], str):
            logger.warning(f"Invalid 'type' field: Expected a string, got {type(content['type']).__name__}.")
            return False
        if not isinstance(content["message"], str):
            logger.warning(f"Invalid 'message' field: Expected a string, got {type(content['message']).__name__}.")
            return False

        # Step 4: Additional validation for 'type' field (if applicable)
        valid_types = ["chat_message"]  # Extend with other valid types as needed
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