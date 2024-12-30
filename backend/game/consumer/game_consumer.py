import logging
from asgiref.sync import async_to_sync
from channels.generic.websocket import JsonWebsocketConsumer
from .shared_utils_game_chat import SharedUtils
from .game_utils import GameUtils

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
        5. Updating the player list for the game lobby using `GameUtils.add_player_to_lobby`.
        6. Accepting the WebSocket connection if all checks pass.

        Raises:
            Exception: Logs and closes the WebSocket connection in case of missing game ID or authentication failure.
        """
        # Step 1: Extract the game ID from the URL route.
        self.game_id = self.scope["url_route"].get("kwargs", {}).get("game_id")
        self.lobby_group_name = f"Julia's_game_lobby_{self.game_id}"  # Derive lobby group name.

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
        GameUtils.add_player_to_lobby(
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

    def handle_join_lobby(self, content: dict) -> None:
        """
        Handle the join lobby message and confirm the user's addition to the lobby.
        
        Parameters:
            content (dict): The message payload sent by the client.
        """
        game_id = content.get("gameId")
        if game_id != self.game_id:
            self.send_json({"type": "error", "message": "Invalid game ID."})
            return
        
        logger.info(f"User {self.user.first_name} attempting to join lobby: {self.lobby_group_name}")
        
        # Retrieve or validate the game instance
        try:
            game = GameUtils.get_game_instance(game_id=self.game_id)
        except ValueError as e:
            logger.error(e)
            self.send_json({"type": "error", "message": str(e)})
            return
        
        # Determine player role and assign if needed
        player_role = GameUtils.assign_player_role(game=game, user=self.user)
        
        # Update the lobby players and avoid duplicates
        GameUtils.add_player_to_lobby(
            user=self.user,
            group_name=self.lobby_group_name,
            player_role=player_role
        )
        
        # Broadcast the updated player list to all clients in the lobby
        self.update_player_list({
            "players": GameUtils.lobby_players[self.lobby_group_name],
        })
        
        # Respond to the client with success
        self.send_json({
            "type": "join_lobby_success",
            "message": f"Successfully joined lobby {self.lobby_group_name} as {player_role}.",
            "player_role": player_role,
        })
        
        logger.info(f"User {self.user.first_name} successfully joined lobby {self.lobby_group_name} as {player_role}.")
        
    def handle_leave_lobby(self) -> None:
        
        """
        Handle explicit leave lobby from the client.
        """
        logger.info(f"User {self.user.first_name} is leaving the lobby {self.lobby_group_name}")
        try:
            # Remove the player from the lobby
            GameUtils._remove_player_from_lobby(
                user=self.user,
                group_name=self.lobby_group_name,
                channel_layer=self.channel_layer,
                channel_name=self.channel_name
            )
            
            # Broadcast the updated player list to all clients in the lobby
            self.update_player_list({
                "players": GameUtils.lobby_players.get(self.lobby_group_name, []),
            })
            
            # Notify the user that they left successfully
            self.send_json({
                "type": "leave_lobby_success",
                "message": "You have successfully left the lobby",
            })
            
        except ValueError as e:
            logger.error(e)
            self.send_json({"type": "error", "message": str(e)})
            
        # Close the Websocket connection
        self.close(code=1000)
    
    def update_player_list(self, event: dict) -> None:
        """
        Send the updated player list to the WebSocket client.

        Parameters:
            event (dict): The message payload containing the updated player list.
                        Expected to have a "players" key with the list of players.
        """
        # Ensure the WebSocket connection is active before sending data
        if self.scope["type"] == "websocket" and self.channel_name:
            try:
                # Extract the players list from the event payload
                players = event.get("players", [])

                # Send the player list to the WebSocket client
                self.send_json({
                    "type": "player_list",
                    "players": players,
                })

            # Handle cases where the WebSocket connection is closed unexpectedly
            except RuntimeError as e:
                logger.warning(
                    f"Attempted to send a message to a closed WebSocket connection: {e}"
                )
        
    def handle_start_game(self) -> None:
        
        """
        Handle the game start event and notify both players in the lobby.

        This method validates the lobby, ensures exactly two players are present, 
        randomizes the starting turn, assigns player roles, and initializes the game.

        Parameters:
            self: The instance of the WebSocket consumer calling this method.
        
        Raises:
            ValueError: If the lobby does not exist or if there is invalid player data.
        """
        # Step 1: Validate the lobby existence and player list
        try:
            players = GameUtils.validate_lobby(group_name=self.lobby_group_name)
        except ValueError as e:
            logger.error(e)
            self.send_json({"type": "error", "message": str(e)})
            return
        
        # Step 2 Ensure there are exactly two players in the lobby
        if len(players) != 2:
            logger.warning(f"Game start failed: Invalid number of players in the {self.lobby_group_name}")
            self.send_json({
                "type": "error",
                "message": "The game requires exactly two players to start."
            })
            return

        # Step 3: Randomize the starting turn and assign player roles
        starting_turn, player_x, player_o = GameUtils.randomize_turn(players=players)
        
        logger.info(
            f"Game is starting in lobby {self.lobby_group_name}. "
            f"Player X: {player_x['first_name']}, Player O: {player_o['first_name']}, Starting turn: {starting_turn}"
        )
        
        # Step 4: Initialize the game instance with the validated players and starting turn
        try:
            game = GameUtils.initialize_game(
                game_id=self.game_id,
                player_x=player_x,
                player_o=player_o,
                starting_turn=starting_turn,
            )
            # Step 5: Send acknowledgment to the player who initiated the game start
            self.send_json({
                "type": "game_start_acknowledgment",
                "message": "Game has started successfully!",
                "game_id": game.id,
                "current_turn": starting_turn,
            })
        except Exception as e:
            logger.error(f"Failed to start the game: {e}")
            self.send_json({"type": "error", "message": "Failed to start the game due to a server error."})



    
                    
            