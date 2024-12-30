
import random
import re
from asgiref.sync import async_to_sync
from channels.layers import BaseChannelLayer
from game.models import TicTacToeGame, DEFAULT_BOARD_STATE
from users.models import CustomUser
import logging

logger = logging.getLogger(__name__)


class GameUtils:
    """
    Utility class for managing game-specific operations, such as player lists and broadcasting updates.
    """
    lobby_players = {}  # Tracks players in each game lobby
    
    @staticmethod
    def get_game_instance(game_id: int):
        """
        Retrieve or validate the game instance.
        
        Args:
            game_id (int): The ID of the game to retrieve.
            
        Returns:
            ValueError: if the game does not exist.
        """
        try:
            return TicTacToeGame.objects.get(id=game_id)
        except TicTacToeGame.DoesNotExist:
            raise ValueError(f"Game with ID {game_id} does not exist")
        
    @staticmethod
    def assign_player_role(game, user):
        """
        Add a player role if available, or return "Spectator" role.
        
        Args:
            game (TicTacToeGame): The game instance.
            user (User): The authenticated user. 
            
        Returns:
            str: The role assigned to the user ("X", "O", or "Sectator")
        """
        if not game.player_x:
            game.player_x = user
            game.save()
            return "X"
        elif not game.player_o and user != game.pyayer_x:
            game.player_o = user
            game.save()
            return "O"
        return "Spectator"
        
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
        if group_name not in GameUtils.lobby_players:
            GameUtils.lobby_players[group_name] = []

        # Add player to the lobby (avoiding duplicate entries).
        GameUtils.lobby_players[group_name] = [
            p for p in GameUtils.lobby_players[group_name] if p["id"] != user.id
        ]
        GameUtils.lobby_players[group_name].append(player)

        # Broadcast updated player list
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                "type": "update_player_list",
                "players": GameUtils.lobby_players[group_name],
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
        if group_name not in GameUtils.lobby_players:
            raise ValueError(f"Group name {group_name} does not exist in the lobby_players.")
        
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                "type": "update_player_list",
                "players": GameUtils.lobby_players[group_name],
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
        if group_name not in GameUtils.lobby_players:
            raise ValueError(f"Lobby {group_name} does not exist.")
        
        # Log the player removal
        logger.info(f"Removing player {user.first_name} (ID: {user.id}) from lobby {group_name}")
        
        # Remove the player from the lobby's players list
        GameUtils.lobby_players[group_name] = [
            p for p in GameUtils.lobby_players[group_name] if p["id"] != user.id
        ]
        
        # Broadcast the updated player list if there are remaining players
        if GameUtils.lobby_players[group_name]:
            GameUtils.broadcast_player_list(channel_layer, group_name)
            logger.info(f"Updated player list after removal: {GameUtils.lobby_players[group_name]}")
        else:
            # Clean up the lobby if it becomes empty
            del GameUtils.lobby_players[group_name]
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
        if group_name not in GameUtils.lobby_players:
            # Raise an error if the lobby group is not found.
            raise ValueError(f"Lobby {group_name} does not exist.")

        # Step 2: Retrieve the list of players in the specified lobby.
        players = GameUtils.lobby_players[group_name]

        # Step 3: Iterate through each player in the lobby to validate their data.
        for player in players:
            # Ensure the "first_name" key exists and is not empty.
            if "first_name" not in player or not player["first_name"]:
                # Raise an error if the player data is invalid.
                raise ValueError(f"Invalid player data in the lobby: {player}")

        # Step 4: Return the validated list of players.
        return players
    
    @staticmethod
    def randomize_turn(players: list):
        """
        Randominize which player start 1st and assign player roles.

        Args:
            players (list): List of players in the lobby.
            
        Returns:
            tuple: (starting_turn, player_x, player_o)
        """
        starting_turn = random.choice(["X", "O"])
        player_x, player_o = (players[0], players[1]) if starting_turn == "X" else (players[1], players[0])
        return starting_turn, player_x, player_o

    @staticmethod
    def randomize_turn(players: list) -> tuple:
        """
        Randomizes which player starts first and assigns player roles.

        This method determines the starting turn for a game (either 'X' or 'O') 
        by randomly selecting one of the two players to begin. It also assigns 
        the roles of Player X and Player O based on the randomized starting turn.

        Args:
            players (list): A list of players in the lobby. Each player is represented 
                            as a dictionary containing their details, such as "id" and "first_name".

        Returns:
            tuple: A tuple containing:
                - starting_turn (str): The player starting the game ('X' or 'O').
                - player_x (dict): The player assigned the 'X' role.
                - player_o (dict): The player assigned the 'O' role.

        Raises:
            ValueError: If the players list does not contain exactly two players.
        """
        # Step 1: Ensure the players list contains exactly two players.
        if len(players) != 2:
            # Raise an error if the player count is invalid.
            raise ValueError("Exactly two players are required to start the game.")

        # Step 2: Randomly determine the starting turn ('X' or 'O').
        starting_turn = random.choice(["X", "O"])

        # Step 3: Assign roles based on the starting turn.
        # If starting_turn is 'X', the first player in the list is Player X; otherwise, they are Player O.
        if starting_turn == "X":
            player_x, player_o = players[0], players[1]
        else:
            player_x, player_o = players[1], players[0]

        # Step 4: Log the assignment details for debugging purposes.
        logger.debug(f"Randomized starting turn: {starting_turn}")
        logger.debug(f"Player X: {player_x['first_name']}, Player O: {player_o['first_name']}")

        # Step 5: Return the starting turn and assigned roles.
        return starting_turn, player_x, player_o

    @staticmethod
    def initialize_game(game_id: int, player_x: dict, player_o: dict, starting_turn: str) -> TicTacToeGame:
        """
        Initialize the game instance with the provided players and starting turn.

        Args:
            game_id (int): The ID of the game to initialize.
            player_x (dict): Player X information (must contain "id").
            player_o (dict): Player O information (must contain "id").
            starting_turn (str): The starting turn ("X" or "O").

        Returns:
            TicTacToeGame: The initialized game instance.

        Raises:
            ValueError: If the users or game instance cannot be retrieved.
        """
        # Step 1: Fetch CustomUser instances for the players
        try:
            player_x_instance = CustomUser.objects.get(pk=player_x["id"])
            player_o_instance = CustomUser.objects.get(pk=player_o["id"])
        except CustomUser.DoesNotExist as e:
            raise ValueError(f"User does not exist: {e}")

        # Step 2: Retrieve and update the game instance
        try:
            game = TicTacToeGame.objects.get(id=game_id)
            game.player_x = player_x_instance
            game.player_o = player_o_instance
            game.current_turn = starting_turn  # Fixed typo from "starting_turn" to "current_turn"
            game.board_state = DEFAULT_BOARD_STATE
            game.save()
        except TicTacToeGame.DoesNotExist as e:
            raise ValueError(f"Game does not exist: {e}")

        # Step 3: Return the updated game instance
        return game


        
        
