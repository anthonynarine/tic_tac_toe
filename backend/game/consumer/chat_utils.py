from asgiref.sync import async_to_sync
from channels.layers import BaseChannelLayer
import logging

logger = logging.getLogger(__name__)

class ChatUtils:
    """
    Utility class for managing chat-related operations
    """
    @staticmethod
    def validate_message(content: dict) -> None:
        """
        Validate the chat message content.
        
        Args:
            content (dict): The message payload sent by the client.
        
        Raises:
            ValueError: If the message is empty or exceeds the max length. 
        """
        message = content.get("message", "")
        if not message:
            raise ValueError("Message cannot be empty.")
        if len(message) > 250:
            raise ValueError("Message is too long. Maximum lenght is 250 characters.")
        
    @staticmethod
    def broadcast_chat_messsage(
        channel_layer: BaseChannelLayer, group_name: str, sender_name: str, message: str
    ) -> None:
        """
        Broadcast a chat message to all clients in the specified lobby.

        Args:
            channel_layer (BaseChannelLayer): The channel layer used for broadcasting messages.
            group_name (str): The name of the lobby group.
            sender_name (str): The name of the sender.
            message (str): The chat message content.
        """
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                "type": "chat_message",
                "message": {
                    "sender": sender_name,
                    "content": message,
                },
            },
        )
        logger.info(f"Broadcasted message to group {group_name}: {message}")