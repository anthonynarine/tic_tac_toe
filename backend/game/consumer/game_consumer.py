import logging
from turtle import st
from asgiref.sync import async_to_sync
from channels.generic.websocket import JsonWebsocketConsumer
from django.core.exceptions import ValidationError

from backend import game
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
        self.lobby_group_name = f"game_lobby_{self.game_id}"  # Derive lobby group name.
        
        logger.info(f"GameConsumer WebSocket connecting for group: {self.lobby_group_name}")

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
        
        # Ensure slef.user is set.
        self.user = self.scope["user"]

        # Step 4: Add the WebSocket channel to the game lobby group.
        async_to_sync(self.channel_layer.group_add)(
            self.lobby_group_name,
            self.channel_name
        )
        logger.info(f"Game WebSocket connected for group: {self.lobby_group_name}")

        # Step 5: Accept the WebSocket connection.
        self.accept()

        # Step 6: Update the player list for the game lobby.
        GameUtils.add_player_to_game_lobby(
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
        logger.info(f"GameConsumer received message: {content}")  
        
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
                logger.info(f"GameConsumer received start_game for lobby: {self.lobby_group_name}")
                # Validate and start the game.
                self.handle_start_game()
            elif message_type == "move":
                # Validate and process the player's move.
                self.handle_move(content)
            elif message_type == "rematch_request":
                self.handle_rematch_request(),
            elif message_type == "rematch_accept":
                self.handle_rematch_accept()
            elif message_type == "rematch_accept":
                self.handle_rematch_accept
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
        logger.info(f" GameConsumer.handle_start_game triggered for lobby {self.lobby_group_name}")  
        
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
            f" Game is starting in lobby {self.lobby_group_name}. "
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
            # ✅Log before sending acknowledgment
            logger.info(f" Sending game_start_acknowledgment for game {game.id}...")
            
            # Step 5: Send acknowledgment to frontend
            async_to_sync(self.channel_layer.group_send)(
                self.lobby_group_name,  # 📡 Target WebSocket group (game lobby)
                {
                    "type": "game_start_acknowledgment",
                    "message": "Game has started successfully!",
                    "game_id": game.id,
                    "current_turn": starting_turn,
                }
            )
        except Exception as e:
            logger.error(f"Failed to start the game: {e}")
            self.send_json({"type": "error", "message": "Failed to start the game due to a server error."})
            
    def game_start_acknowledgment(self, event: dict) -> None:
        """
            Handle the game start acknoledgment message.
        """
        logger.info(f" Broadcasting game start acknowledgment: {event}")
        
        self.send_json({
            "type": "game_start_acknowledgment",
            "message": event["message"],
            "game_id": event["game_id"],
            "current_turn": event["current_turn"],
        })

    def handle_move(self, content: dict) -> None:
        """
        Handle a move made by a player.

        Parameters:
            content (dict): The message payload containing the move details.
        """
        # Step 1: Extract the position from the message payload
        position = content.get("position")
        user = self.scope["user"]

        # Step 2: Validate the move position
        if position is None:
            self.send_json({
                "type": "error",
                "message": "Invalid move: Position is missing."
            })
            return

        if not isinstance(position, int) or not (0 <= position < 9):
            self.send_json({
                "type": "error",
                "message": "Invalid move: Position must be an integer between 0 and 8."
            })
            return

        # Step 3: Retrieve the game instance using the utility method
        try:
            game = GameUtils.get_game_instance(game_id=self.game_id)
        except ValueError as e:
            self.send_json({"type": "error", "message": str(e)})
            return

        logger.info(f"Game object retrieved: {game}")

        # Step 4: Determine the player's marker ("X" or "O")
        if user == game.player_x:
            player_marker = "X"
        elif user == game.player_o:
            player_marker = "O"
        else:
            logger.warning(f"Unauthorized move attempt by {user.first_name}")
            self.send_json({
                "type": "error",
                "message": "You are not a participant in this game."
            })
            return

        logger.info(f"Player {user.first_name} ({player_marker}) made a move at position {position}")

        # Step 5: Make the move and update the game state
        try:
            game.make_move(position=position, player=player_marker)
            logger.info(f"Move made successfully: {game.board_state}")
        except ValidationError as e:
            logger.error(f"Invalid move: {e}")
            self.send_json({
                "type": "error",
                "message": str(e) if str(e) else "Invalid move due to a validation error."
            })

    def update_player_list(self, event: dict) -> None:
        """
        Handles the update_player_list event for the game lobby
        

        Args:
            event (dict): Expected to contain:
            {
                "type": "update_player_list",
                "players": [
                    {"id": <int>, "first_name": <str>, "role": <str>},
                    ...
                ]
            }
        Returns:
            None
        """
        players = event.get("players", [])
        validated_players = [
            player for player in players
            if isinstance(player.get("id"), int) and isinstance(player.get("first_name"), str)
        ]
        logger.debug(f"GameConsumer processing update_player_list event: {validated_players}")
        
        # Send the updated player list (including the role) to the client.
        self.send_json({
            "type": "update_player_list",
            "players": validated_players
        })
        logger.info(f"GameConsumer sent updated player list: {validated_players}")
        
    def game_update(self, event: dict) -> None:
        """
        Broadcast the updated game state to all connected clients.
        
        Parameters:
            event(dict): The message payload containing the updated game state.
                        Expected keys: "board_state, "current_turn", "winner".
        """
        logger.info(f"Received game update event: {event}")
        
        try:
            # Step 1: Validate required keys in the event playload
            required_keys = ["board_state", "current_turn", "winner"]
            if not all(key in event for key in required_keys):
                logger.error(f"Missing keys in event:: {event}")
                self.send_json({"type": "error", "message": "Invalid game update payload."})
                return
            
            # Step 2 Retrieve the game instance
            try:
                game = GameUtils.get_game_instance(self.game_id)
            except ValueError as e:
                self.send_json({"type": "error", "message": str(e)})
                return
            
            # Step 3: Retrieve the AI user if the game is AI-based
            ai_user = None
            if game.is_ai_game:
                ai_user = self.get_ai_user()
                if not ai_user:
                    logger.critical("AI user (ai@tictactoe.com) is missing. Please run migrations.")
                    self.send_json({"type": "error", "message": "AI user missing."})
                    return
                        
            # Step 4: Determine the user's role in the game
            player_role = GameUtils.determine_player_role(user=self.user, game=game)

            # Step 5: Prepare detailed player information
            player_x_info = {
                "id": game.player_x.id,
                "first_name": game.player_x.first_name,
            } if game.player_x else None

            player_o_info = {
                "id": game.player_o.id if game.player_o else None,
                "first_name": "AI" if game.is_ai_game and game.player_o == ai_user else (
                    game.player_o.first_name if game.player_o else "Waiting..."
                ),
            }

            logger.debug(f"Player X Info: {player_o_info}"),
            logger.debug(f"Player O Info: {player_o_info}")

            # Step 6: Broadcast the game update to all clients
            # Step 6: Broadcast the game update to all clients
            self.send_json({
                "type": "game_update",
                "game_id": game.id,
                "board_state": event["board_state"],
                "current_turn": event["current_turn"],
                "winner": event["winner"],
                "player_role": player_role,
                "player_x": player_x_info,
                "player_o": player_o_info,
            })
            logger.info("Game update broadcasted successfully.")
            logger.info(f"Broadcasting game update: Board State={game.board_state}, Current Turn={game.current_turn}")

        except Exception as e:
            logger.error(f"Error during game update: {e}")
            self.send_json({"type": "error", "message": "An error occurred during the game update."})

    def handle_rematch_request(self) -> None:
        """
            Broadcast a "rematch_offer" to the other player in the same game lobby
            indicating that self.user wants a rematch.
        """
        logger.info(f"User {self.user.first_name} is requesting a rematch")
        
        async_to_sync(self.channel_layer.group_send)(
            self.lobby_group_name,
            {
                "type": "rematch_offer", # handler below
                "from_user": self.user.first_name
            }
        )
        
    def rematch_offer(self, event: dict) -> None:
        """
        called when someone in the group triggers "rematch_offer".
        Broadcast a message to all clients so the other players see a "rematch_offer"
        """
        from_user = event.get("from_user", "Unknown")
        self.send_json({
            "type": "rematch_offer",
            "message": f"{from_user} wants a rematch!",
        })
        
    def handle_rematch_accept(self) -> None:
        """
        Handles when the second player accepts a rematch. 
        A new game will be created and ID boradcsted
        """
        logger.info(f"User {self.user.first_name} accepted a rematch in {self.lobby_group_name}")
        
        # 1) retrieve the old game instance
        try:
            old_game = GameUtils.get_game_instance(game_id=self.game_id)
        except ValidationError as e:
            logger.error(f"Rematch accept failed: {e}")
            SharedUtils.send_error(self, str(e))
            return
        
        # 2) Identify the old players
        old_x = old_game.player_x
        old_o = old_game.player_o
        
        # Safty checks
        if not old_x or old_o:
            logger.warning("Rematch accept failed: Missing a plyaer from the old game.")
            SharedUtils.send_error(self, "Cannot rematch because one of the players is missing")
            return
        
        # 3) Build a small list of the old players 
        #    so we can pass it to "randomize_turn"
        #    each entry will be a dict with "id" and "first_name"
        players = [
            {"id": old_x.id, "first_name": old_x.first_name},
            {"id": old_o.id, "first_name": old_o.first_name},
            
        ]
        
        try:
            starting_turn, player_x_dict, player_o_dict = GameUtils.randomize_turn(players=players)
            
            # 4) Create a new game
            new_game = GameUtils.create_game(
                player_o_id=player_o_dict["id"],
                player_x_id=player_x_dict["id"],
                starting_turn=starting_turn,
            )
            logger.info(f"New rematch game created with ID{new_game.id}")
        
        except ValueError as e:
            logger.error(f"Rematch creation failed: {e}")
            SharedUtils.send_error(self, str(e))
            return
        
        # 5) Broadcast the new Game ID to everone in the group
        async_to_sync(self.channel_layer.group_send)(
            self.lobby_group_name,
            {
                "type": "rematch_start", # Handler below
                "new_game_id": new_game.id,
                
            }
        )
        
    def rematch_start(self, event: dict) -> None:
        """
        Notify both players of the tnew game ID so the can navigate there.
        """
        new_game_id = event.get("new_game_id")
        logger.info(f"Broadcasting rematch_start for the new game {new_game_id}")
        
        # Send a JSON message to *this* client
        self.send_json({
            "type": "rematch_start",
            "new_game_id": new_game_id,
            "message": f"A new rematch game has been created with ID {new_game_id}"
        })
        
        
        
    def disconnect(self, code: int) -> None:
        """
        Handle WebSocket disconnection for game-related functionality.

        Parameters:
            code (int): The WebSocket close code.
        """
        if not hasattr(self, "lobby_group_name"):
            logger.warning("Game user disconnected before joining a game lobby")
            return

        try:
            if self.lobby_group_name in GameUtils.lobby_players:
                GameUtils._remove_player_from_lobby(
                    user=self.user,
                    group_name=self.lobby_group_name,
                    channel_layer=self.channel_layer,
                    channel_name=self.channel_name,
                )
        except Exception as e:
            logger.error(f"Error during game disconnection: {e}")

        async_to_sync(self.channel_layer.group_discard)(
            self.lobby_group_name,
            self.channel_name,
        )
        logger.info(f"Game user {self.user.first_name} disconnected from game lobby {self.lobby_group_name}")



