

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