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

    @staticmethod
    def authenticate_user(scope: dict) -> bool:
        """
        Authenticate the WebSocket user based on the scope.

        Args:
            scope (dict): The connection scope containing the user information.

        Returns:
            bool: True if the user is authenticated, False otherwise.
        """
        user = scope.get("user")
        if user and not user.is_anonymous:
            logger.info(f"User authenticated: {user.first_name}")
            return True
        logger.warning("Unauthenticated user attempted to connect.")
        return False

    @staticmethod
    def add_player_to_lobby(user: 'AbstractBaseUser', group_name: str, channel_layer: BaseChannelLayer) -> None:
        """
        Add a player to the lobby and broadcast the updated player list.

        Args:
            user (AbstractBaseUser): The authenticated user.
            group_name (str): The name of the lobby group.
            channel_layer: The channel layer for broadcasting messages.
        """
        player = {"id": user.id, "first_name": user.first_name}

        # Ensure a group (lobby) is initialized in the lobby_players dictionary.
        if group_name not in SharedUtils.lobby_players:
            SharedUtils.lobby_players[group_name] = []

        # Add player to the lobby (avoiding duplicate entries).
        SharedUtils.lobby_players[group_name] = [
            p for p in SharedUtils.lobby_players[group_name] if p["id"] != user.id
        ]
        SharedUtils.lobby_players[group_name].append(player)

        # Broadcast updated player list
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                "type": "update_player_list",
                "players": SharedUtils.lobby_players[group_name],
            },
        )
        logger.info(f"Player added to the lobby {group_name}: {player}")

    @staticmethod
    def validate_message(content: dict) -> bool:
        """
        Validate the incoming message content.
        """
        if not isinstance(content, dict):
            logger.warning("Invalid message format received: Expected a JSON object.")
            return False
        if not isinstance(content.get("tyep"), str):
            logger.warning("Missing or invalid 'type' field in message")
            return False
        return True

    @staticmethod
    def send_error(consumer, message: str, code: int = 4003):
        """
        Send an error message and close the WebSocket connection.
        """
        consumer.send_json({"type": "error", "message": message})
        consumer.close(code=code)