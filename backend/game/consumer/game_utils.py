
import random
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
    def create_game(player_x_id: int, player_o_id: int, starting_turn: str) -> TicTacToeGame:
        """
        Create a new Tic-Tac-Toe game instance.

        Args:
            player_x_id (int): The ID of the player assigned to "X".
            player_o_id (int): The ID of the player assigned to "O".
            starting_turn (str): "X" or "O" indicating which player starts.
            
        Returns:
            TicTacToeGame: The newly created game instance.

        Raises:
            ValueError: If one or both player instances cannot be found in the database.
        """
        try:
            player_x = CustomUser.objects.get(id=player_x_id)
            player_o = CustomUser.objects.get(id=player_o_id)
        except CustomUser.DoesNotExist as e:
            raise ValueError(f"Player not found: {e}")
        
        game = TicTacToeGame.objects.create(
            player_x=player_x,
            player_o=player_o,
            current_turn=starting_turn,
            board_state=DEFAULT_BOARD_STATE,
            is_ai_game=False 
        )
        
        return game

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

    @staticmethod
    def get_ai_user() -> CustomUser:
        """
        Fetch the AI user. Ensure that the AI user exists in the database.

        Returns:
            CustomUser: The AI user instance if found, otherwise None.
        """
        ai_user = CustomUser.objects.filter(email="ai@tictactoe.com").first()
        if not ai_user:
            logger.warning("AI user with email ai@tictactoe.com does not exist.")
        return ai_user
    
    @staticmethod
    def determine_player_role(user: CustomUser, game: TicTacToeGame) -> str:
        """
        Determine the role of the user in the game (X, O, or Spectator)

        Args:
            user (CustomUser): The current user making the reqeust.
            game (TicTacToeGame): The TicTacToeGame instance.
        Returns:
            str: "X", "O", or "Spectator"
        """
        if not game.player_x or not game.player_o:
            logger.warning("Game is incomplete; waiting for players to join.")
            return "Spectator"

        if user == game.player_x:
            return "X"
        elif user == game.player_o:
            return "O"
        return "Spectator"