import logging
from asgiref.sync import async_to_sync
from channels.generic.websocket import JsonWebsocketConsumer
from .shared_utils_game_chat import SharedUtils

logger = logging.getLogger(__name__)

class GameConsumer(JsonWebsocketConsumer):
    """
    WebSocket consumer for managing game-specific functionality.
    """

    def connect(self):
        """
        Handle WebSocket connection for game-related functionality.

        This method is responsible for:
        1. Extracting the game ID from the WebSocket URL route.
        2. Validating the game ID.
        3. Authenticating the user using `SharedUtils.authenticate_user`.
        4. Adding the WebSocket channel to the specified game lobby group.
        5. Updating the player list for the game lobby using `SharedUtils.add_player_to_lobby`.
        6. Accepting the WebSocket connection if all checks pass.

        Raises:
            Exception: Logs and closes the WebSocket connection in case of missing game ID or authentication failure.
        """
        # Step 1: Extract the game ID from the URL route.
        self.game_id = self.scope["url_route"].get("kwargs", {}).get("game_id")
        self.lobby_group_name = f"game_lobby_{self.game_id}"  # Derive lobby group name.

        # Step 2: Validate the game ID.
        if not self.game_id:
            logger.warning("Missing game ID in WebSocket connection request.")
            self.send_json({"type": "error", "message": "Missing game ID in connection request."})
            self.close(code=4002)  # Close with a specific error code for missing game ID.
            return

        # Step 3: Authenticate the user.
        if not SharedUtils.authenticate_user(self.scope):
            self.send_json({"type": "error", "message": "Unauthenticated user. Please log in."})
            self.close(code=4001)  # Close with a specific error code for authentication failure.
            return

        # Step 4: Add the WebSocket channel to the game lobby group.
        async_to_sync(self.channel_layer.group_add)(
            self.lobby_group_name, self.channel_name
        )
        logger.info(f"Game WebSocket connected for group: {self.lobby_group_name}")

        # Step 5: Accept the WebSocket connection.
        self.accept()

        # Step 6: Update the player list for the game lobby.
        SharedUtils.add_player_to_lobby(
            self.scope["user"], self.lobby_group_name, self.channel_layer
        )
        logger.info(f"Player added to game lobby {self.lobby_group_name}")


    def receive_json(self, content: dict, **kwargs) -> None:
        """
        Handle incoming game-related messages from the WebSocket client.

        This method is responsible for:
        1. Validating the incoming JSON message structure using `SharedUtils.validate_message`.
        2. Extracting and normalizing the `type` field from the message payload.
        3. Routing valid messages to their respective handler methods:
        - `join_lobby`: Adds the user to the game lobby.
        - `start_game`: Initiates the game if conditions are met.
        - `move`: Processes a player's move and updates the game state.
        - `leave_lobby`: Removes the user from the game lobby.
        4. Sending error responses for invalid or unsupported message types.
        5. Logging unexpected runtime errors and sending a generic error response.

        Parameters:
            content (dict): The JSON message payload sent by the client. Expected to contain a "type" field indicating the message type.
            **kwargs: Additional optional arguments passed to the method (not used in this context).

        Raises:
            Exception: Catches and logs any unexpected errors during message processing.
                    Sends an error response to the client in case of such errors.
        """
        # Step 1: Validate the incoming message structure.
        if not SharedUtils.validate_message(content):
            # Close the connection if the message is invalid.
            self.close(code=4003)
            return

        # Step 2: Extract and normalize the message type.
        message_type = content.get("type").lower()

        try:
            # Step 3: Route the message to the appropriate handler based on its type.
            if message_type == "join_lobby":
                # Add the user to the game lobby.
                self.handle_join_lobby(content)
            elif message_type == "start_game":
                # Validate and start the game.
                self.handle_start_game()
            elif message_type == "move":
                # Validate and process the player's move.
                self.handle_move(content)
            elif message_type == "leave_lobby":
                # Remove the user from the game lobby.
                self.handle_leave_lobby()
            else:
                # Send an error response for unsupported message types.
                SharedUtils.send_error(self, "Invalid message type.")
        except Exception as e:
            # Step 4: Log unexpected runtime errors and send a generic error response.
            logger.error(f"Unexpected error in GameConsumer: {e}")
            SharedUtils.send_error(self, f"An unexpected error occurred: {str(e)}")

