# Filename: backend/utils/chat/chat_utils.py
from asgiref.sync import async_to_sync
from channels.layers import BaseChannelLayer
from uuid import uuid4
import logging

logger = logging.getLogger(__name__)


class ChatUtils:
    """
    Utility class for chat-specific operations (chat socket only).
    """

    # Step 1: Single responsibility — chat-only
    CHAT_ALLOWED_TYPES = {"chat_message"}
    MAX_LEN = 250

    @staticmethod
    def validate_message(content: dict) -> None:
        """
        Validate the structure and fields of a chat message.

        Expected:
          { "type": "chat_message", "message": "<string>" }
        """
        logger.debug("Validating chat message content keys=%s", list((content or {}).keys()))

        msg_type = (content or {}).get("type")
        if msg_type not in ChatUtils.CHAT_ALLOWED_TYPES:
            raise ValueError(f"Invalid message type: {msg_type}")

        message = content.get("message")
        if not isinstance(message, str):
            raise ValueError("Message must be a string.")
        message = message.strip()
        if not message:
            raise ValueError("Message cannot be empty.")
        if len(message) > ChatUtils.MAX_LEN:
            raise ValueError(f"Message is too long. Max {ChatUtils.MAX_LEN} characters.")

    @staticmethod
    def broadcast_chat_message(
        channel_layer: BaseChannelLayer,
        group_name: str,
        sender_name: str,
        message: str,
    ) -> None:
        """
        Broadcast a chat message to all clients in the specified chat group.
        """
        if not isinstance(message, str) or not message.strip():
            raise ValueError("Message content must be a non-empty string.")

        payload = {
            "type": "chat_message",  # Step 2: must match consumer handler name
            "message": {
                "id": str(uuid4()),
                "sender": sender_name,
                "content": message.strip(),
            },
        }

        try:
            async_to_sync(channel_layer.group_send)(group_name, payload)
            logger.info("Broadcasted chat message id=%s group=%s", payload["message"]["id"], group_name)
        except Exception as e:
            logger.error("Failed to broadcast chat message group=%s err=%s", group_name, e)
            raise
