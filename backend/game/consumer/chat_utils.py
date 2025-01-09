from asgiref.sync import async_to_sync
from uuid import uuid4
from channels.layers import BaseChannelLayer
import logging

logger = logging.getLogger(__name__)

class ChatUtils:
    """
    Utility class for managing chat-related operations.
    """

    @staticmethod
    def validate_message(content: dict) -> None:
        """
        Validate the chat message payload.

        Steps:
        1. Validate the 'type' field to ensure it exists and equals 'chat_message'.
        2. Validate the 'message' field to ensure it is a non-empty string within the allowed length.

        Args:
            content (dict): The message payload sent by the client.

        Raises:
            ValueError: If the payload structure or fields are invalid.
        """
        logger.debug(f"Validating chat message content: {content}")

        # Step 1: Validate the 'type' field
        if content.get("type") != "chat_message":
            raise ValueError("Invalid message type. Expected 'chat_message'.")

        # Step 2: Validate the 'message' field
        message = content.get("message")
        if not isinstance(message, str):
            raise ValueError(f"Invalid 'message' field: Expected a string, got {type(message).__name__}.")
        if not message.strip():  # Check for empty or whitespace-only message
            raise ValueError("Message cannot be empty.")
        if len(message) > 250:
            raise ValueError("Message is too long. Maximum length is 250 characters.")

        logger.debug("Chat message validation passed.")


    @staticmethod
    def broadcast_chat_message(
        channel_layer: BaseChannelLayer, group_name: str, sender_name: str, message: str
    ) -> None:
        """
        Broadcast a chat message to all clients in the specified lobby.

        Steps:
        1. Generate a unique identifier (UUID) for the message to ensure traceability and prevent duplicates.
        2. Construct the payload containing message details (id, sender, content).
        3. Log the payload details for debugging purposes.
        4. Use the channel layer to broadcast the message to the specified group.
        5. Handle and log any errors that may occur during the broadcast process.

        Args:
            channel_layer (BaseChannelLayer): The channel layer used for broadcasting messages.
            group_name (str): The name of the lobby group where the message will be sent.
            sender_name (str): The name of the sender.
            message (str): The content of the chat message.

        Raises:
            Exception: Logs and raises any exceptions that occur during the broadcast.
        """
        # Step 1: Generate a unique identifier for the message.
        unique_id = str(uuid4())  # Create a UUID for message tracking and debugging.
        
        # Ensure the message is a non-empty string (safety check).
        if not isinstance(message, str) or not message.strip():
            logger.error("Message content is invalid or empty.")
            raise ValueError("Message content must be a non-empty string.")

        # Step 2: Construct the payload for the message.
        payload = {
            "type": "chat_message",  # Defines the message type for WebSocket handlers.
            "message": {
                "id": unique_id,       # Unique identifier for deduplication and traceability.
                "sender": sender_name, # Name of the user sending the message.
                "content": message,    # Content of the chat message.
            },
        }

        # Step 3: Log the payload for debugging purposes.
        logger.debug(f"Constructed payload for broadcast: {payload}")

        try:
            # Step 4: Broadcast the message using the channel layer.
            async_to_sync(channel_layer.group_send)(group_name, payload)
            logger.info(
                f"Message broadcast successful. "
                f"Group: {group_name}, Sender: {sender_name}, Message ID: {unique_id}"
            )

        except Exception as e:
            # Step 5: Handle and log any errors during the broadcast process.
            logger.error(
                f"Failed to broadcast message to group {group_name}. "
                f"Sender: {sender_name}, Error: {e}"
            )
            # Re-raise the exception to ensure visibility upstream.
            raise


