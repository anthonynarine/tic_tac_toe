
from typing import TYPE_CHECKING
from asgiref.sync import async_to_sync
from django.contrib.auth import get_user_model
from channels.layers import BaseChannelLayer
from game.models import TicTacToeGame
import logging

logger = logging.getLogger(__name__)

# Import AbstractBaseUser for type hints during static analysis only
if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractBaseUser

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
        elif not game.player_o and user != game.player_x:
            game.player_o = user
            game.save()
            return "O"
        return "Spectator"
        
    @staticmethod
    def add_player_to_lobby(user: 'AbstractBaseUser', group_name: str, channel_layer: BaseChannelLayer) -> None:
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
                "players": GameUtils.lobby_players[group_name]
            }
        )