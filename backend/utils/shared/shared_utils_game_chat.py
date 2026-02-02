from typing import TYPE_CHECKING, Optional, Set
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
    def validate_message(content: dict, allowed_types: Optional[Set[str]] = None) -> bool:
        """
        Validates minimal WS message structure.
        If allowed_types is provided, enforce membership.
        """
        # Step 1: Ensure dict
        if not isinstance(content, dict):
            logger.warning("Invalid WS message format: expected dict got %s", type(content).__name__)
            return False

        # Step 2: Require type string
        message_type = content.get("type")
        if not isinstance(message_type, str) or not message_type.strip():
            logger.warning("Invalid WS message: missing/invalid 'type': %s", content)
            return False

        message_type_norm = message_type.lower().strip()

        # Step 3: Optional allowed types enforcement
        if allowed_types is not None and message_type_norm not in allowed_types:
            logger.warning(
                "Unsupported WS message type=%s allowed=%s",
                message_type_norm,
                sorted(list(allowed_types)),
            )
            return False

        # Step 4: Minimal per-type checks (optional)
        if message_type_norm == "chat_message" and "message" not in content:
            logger.warning("'chat_message' missing 'message' field: %s", content)
            return False

        return True

    @staticmethod
    def send_error(consumer, message: str, code: int = 4003):
        """
        Send an error message and close the WebSocket connection.
        """
        consumer.send_json({"type": "error", "message": message})
        consumer.close(code=code)
        
    @staticmethod
    async def async_send_error(consumer, message: str, code: int = 4003):
        """
        Asynchronously send an error message and close the WebSocket connection.
        """
        await consumer.send_json({"type": "error", "message": message})
        await consumer.close(code=code)

