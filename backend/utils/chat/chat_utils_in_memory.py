from asgiref.sync import async_to_sync
from uuid import uuid4
from channels.layers import BaseChannelLayer
import logging
from users.models import CustomUser

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
        if content.get("type") not in ["chat_message", "start_game", "leave_lobby"]:
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

    @staticmethod
    def add_player_to_lobby(user: CustomUser, group_name: str, channel_layer: BaseChannelLayer) -> None:
        """
        Add a player to the lobby and broadcast the updated player list.

        Args:
            user (AbstractBaseUser): The authenticated user.
            group_name (str): The name of the lobby group.
            channel_layer: The channel layer for broadcasting messages.
        """
        player = {"id": user.id, "first_name": user.first_name}

        # Ensure a group (lobby) is initialized in the lobby_players dictionary.
        if group_name not in ChatUtils.lobby_players:
            ChatUtils.lobby_players[group_name] = []

        # Add player to the lobby (avoiding duplicate entries).
        ChatUtils.lobby_players[group_name] = [
            p for p in ChatUtils.lobby_players[group_name] if p["id"] != user.id
        ]
        ChatUtils.lobby_players[group_name].append(player)

        # Broadcast updated player list
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                "type": "update_player_list",
                "players": ChatUtils.lobby_players[group_name],
            },
        )
        logger.info(f"Player added to the lobby {group_name}: {player}")

    @staticmethod
    def broadcast_player_list(channel_layer: BaseChannelLayer, group_name: str) -> None:
        """
        Broadcast the updated player list to all clients in the specified lobby.

        Args:
            channel_layer (BaseChannelLayer): The channel layer used for broadcasting messages.
            group_name (str): The name of the lobby group.

        Raises:
            ValueError: If the group_name is not found in lobby_players.
        """
        if group_name not in ChatUtils.lobby_players:
            raise ValueError(f"Group name {group_name} does not exist in the lobby_players.")
        
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                "type": "update_player_list",
                "players": ChatUtils.lobby_players[group_name],
            }
        )
        
    @staticmethod
    def _remove_player_from_lobby(
        user: CustomUser,
        group_name: str,
        channel_layer: BaseChannelLayer,
        channel_name: str
    ) -> None:
        """
        Remove a player from the lobby and broadcast the updated player list.

        Args:
            user (User): The user to remove.
            group_name (str): The name of the lobby group.
            channel_layer (BaseChannelLayer): The channel layer for broadcasting updates.
            channel_name (str): The WebSocket channel name for the user.

        Raises:
            ValueError: If the group_name does not exist in `lobby_players`.
        """
        if group_name not in ChatUtils.lobby_players:
            raise ValueError(f"Lobby {group_name} does not exist.")
        
        # Log the player removal
        logger.info(f"Removing player {user.first_name} (ID: {user.id}) from lobby {group_name}")
        
        # Remove the player from the lobby's players list
        ChatUtils.lobby_players[group_name] = [
            p for p in ChatUtils.lobby_players[group_name] if p["id"] != user.id
        ]
        
        # Broadcast the updated player list if there are remaining players
        if ChatUtils.lobby_players[group_name]:
            ChatUtils.broadcast_player_list(channel_layer, group_name)
            logger.info(f"Updated player list after removal: {ChatUtils.lobby_players[group_name]}")
        else:
            # Clean up the lobby if it becomes empty
            del ChatUtils.lobby_players[group_name]
            logger.info(f"Lobby {group_name} has been deleted after becoming empty.")

        # Remove the channel from the WebSocket group
        try:
            async_to_sync(channel_layer.group_discard)(group_name, channel_name)
            logger.info(f"Channel {channel_name} has been removed from group {group_name}.")
        except Exception as e:
            logger.error(f"Failed to remove channel {channel_name} from group {group_name}: {e}")
            
    @staticmethod
    def validate_lobby(group_name: str) -> list:
        """
        Validates the existence of a lobby and ensures the player list is valid.

        This method checks if a given lobby group exists and verifies that all players 
        in the lobby have valid data, such as a non-empty "first_name" field.

        Args:
            group_name (str): The name of the lobby group to validate.

        Returns:
            list: A list of players in the lobby, each represented as a dictionary.

        Raises:
            ValueError: If the lobby does not exist in the GameUtils.lobby_players 
                        or if the player data is invalid (e.g., missing "first_name").
        """
        # Step 1: Check if the specified lobby exists in the lobby_players dictionary.
        if group_name not in ChatUtils.lobby_players:
            # Raise an error if the lobby group is not found.
            raise ValueError(f"Lobby {group_name} does not exist.")

        # Step 2: Retrieve the list of players in the specified lobby.
        players = ChatUtils.lobby_players[group_name].get("players", [])


        # Step 3: Iterate through each player in the lobby to validate their data.
        for player in players:
            # Ensure the "first_name" key exists and is not empty.
            if "first_name" not in player or not player["first_name"]:
                # Raise an error if the player data is invalid.
                raise ValueError(f"Invalid player data in the lobby: {player}")

        # Step 4: Return the validated list of players.
        return players