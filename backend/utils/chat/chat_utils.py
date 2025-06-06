from asgiref.sync import async_to_sync
from uuid import uuid4
from channels.layers import BaseChannelLayer
import logging

logger = logging.getLogger(__name__)

class ChatUtils:
    """
    Utility class for chat-specific operations (non-lobby).
    """

    @staticmethod
    def validate_message(content: dict) -> None:
        """
        Validate the structure and fields of a chat message.

        Args:
            content (dict): Message payload from WebSocket client.

        Raises:
            ValueError: If the message is invalid or incomplete.
        """
        logger.debug(f"Validating chat message content: {content}")

        if content.get("type") not in ["chat_message", "start_game", "leave_lobby"]:
            raise ValueError("Invalid message type.")

        message = content.get("message")
        if not isinstance(message, str):
            raise ValueError("Message must be a string.")
        if not message.strip():
            raise ValueError("Message cannot be empty.")
        if len(message) > 250:
            raise ValueError("Message is too long. Max 250 characters.")

        logger.debug("Chat message validation passed.")

    @staticmethod
    def broadcast_chat_message(
        channel_layer: BaseChannelLayer, group_name: str, sender_name: str, message: str
    ) -> None:
        """
        Broadcast a chat message to all clients in the specified lobby.

        Args:
            channel_layer (BaseChannelLayer): Django Channels layer.
            group_name (str): Lobby group name.
            sender_name (str): Name of the sender.
            message (str): Message content.

        Raises:
            ValueError: If message is empty.
        """
        unique_id = str(uuid4())

        if not isinstance(message, str) or not message.strip():
            raise ValueError("Message content must be a non-empty string.")

        payload = {
            "type": "chat_message",
            "message": {
                "id": unique_id,
                "sender": sender_name,
                "content": message,
            },
        }

        logger.debug(f"Broadcasting message: {payload}")

        try:
            async_to_sync(channel_layer.group_send)(group_name, payload)
            logger.info(f"Broadcasted chat message {unique_id} to group {group_name}")
        except Exception as e:
            logger.error(f"Failed to broadcast chat message: {e}")
            raise
