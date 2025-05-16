import json
import logging
from utils.redis.redis_client import get_redis_client
from users.models import CustomUser
from channels.layers import BaseChannelLayer
from asgiref.sync import async_to_sync

logger = logging.getLogger(__name__)


class RedisGameLobbyManager:
    """
    Manages multiplayer game lobby state in Redis.

    Responsibilities:
    - Tracks players and WebSocket channels per game lobby.
    - Assigns player roles ("X", "O", or "Spectator") during lobby join.
    - Broadcasts player lists including roles to all connected clients.
    - Tracks rematch offer status (who sent it).
    - Performs full cleanup after a game ends.

    Redis Key Structure:
        - lobby:game:{game_id}:players     (Hash)    -> {user_id: JSON of player}
        - lobby:game:{game_id}:channels    (Set)     -> channel_name for sockets
        - lobby:game:{game_id}:roles       (Hash)    -> {user_id: "X"/"O"}
        - lobby:game:{game_id}:rematch     (String)  -> "X" or "O"
    """

    PREFIX = "lobby:game:"

    def __init__(self):
        self.redis = get_redis_client()
        
        try:
            self.redis.ping()
            logger.debug("Redis connection established successfully.")
        except Exception as e:
            logger.warning(f"Redis connection test failed: {e}")

    def _players_key(self, game_id: str) -> str:
        """Returns the Redis key used to store player metadata (id, first_name)."""
        return f"{self.PREFIX}{game_id}:players"

    def _channels_key(self, game_id: str) -> str:
        """Returns the Redis key used to store active WebSocket channels."""
        return f"{self.PREFIX}{game_id}:channels"

    def _roles_key(self, game_id: str) -> str:
        """Returns the Redis key used to store assigned player roles."""
        return f"{self.PREFIX}{game_id}:roles"

    def _rematch_key(self, game_id: str) -> str:
        """Returns the Redis key used to track rematch offers."""
        return f"{self.PREFIX}{game_id}:rematch"

    def add_player(self, game_id: str, user: CustomUser) -> None:
        """
        Adds or updates a player in the Redis players hash.

        Args:
            game_id (str): The game/lobby ID.
            user (CustomUser): The authenticated user object.
        """
        key = self._players_key(game_id)
        player = {"id": user.id, "first_name": user.first_name}
        self.redis.hset(key, user.id, json.dumps(player))

    def remove_player(self, game_id: str, user: CustomUser) -> None:
        """
        Removes a player from the Redis players hash.

        Args:
            game_id (str): The game/lobby ID.
            user (CustomUser): The user to remove.
        """
        self.redis.hdel(self._players_key(game_id), user.id)

    def get_players(self, game_id: str) -> list[dict]:
        """
        Returns a list of all players currently tracked in the Redis hash.

        Args:
            game_id (str): The game/lobby ID.

        Returns:
            list[dict]: A list of player objects (id, first_name).
        """
        return [json.loads(p) for p in self.redis.hvals(self._players_key(game_id))]

    def add_channel(self, game_id: str, channel_name: str) -> None:
        """
        Adds a WebSocket channel to the Redis set for the game lobby.

        Args:
            game_id (str): The game/lobby ID.
            channel_name (str): Django Channels `channel_name`.
        """
        self.redis.sadd(self._channels_key(game_id), channel_name)

    def remove_channel(self, game_id: str, channel_name: str) -> None:
        """
        Removes a WebSocket channel from the Redis set.

        Args:
            game_id (str): The game/lobby ID.
            channel_name (str): The WebSocket channel name to remove.
        """
        self.redis.srem(self._channels_key(game_id), channel_name)

    def assign_player_role(self, game_id: str, user: CustomUser) -> str:
        """
        Assigns a role ("X" or "O") to the player if available.

        Returns "Spectator" if both roles are already taken.

        Args:
            game_id (str): The game/lobby ID.
            user (CustomUser): The user being assigned a role.

        Returns:
            str: One of "X", "O", or "Spectator".
        """
        roles_key = self._roles_key(game_id)
        # roles = {k.decode(): v.decode() for k, v in self.redis.hgetall(roles_key).items()}
        roles = dict(self.redis.hgetall(roles_key))

        user_id_str = str(user.id)

        if user_id_str in roles:
            return roles[user_id_str]

        if "X" not in roles.values():
            self.redis.hset(roles_key, user.id, "X")
            return "X"
        elif "O" not in roles.values():
            self.redis.hset(roles_key, user.id, "O")
            return "O"

        return "Spectator"

    def get_players_with_roles(self, game_id: str) -> list[dict]:
        """
        Retrieves the player list with their assigned roles.

        Returns:
            list[dict]: Each dict contains id, first_name, and role.
        """
        players = self.get_players(game_id)
        roles = dict(self.redis.hgetall(self._roles_key(game_id)))
        return [
            {**p, "role": roles.get(str(p["id"]), "Spectator")}
            for p in players
        ]

    def broadcast_player_list(self, channel_layer: BaseChannelLayer, game_id: str) -> None:
        """
        Broadcasts the updated player list (with roles) to all clients in the group.

        Args:
            channel_layer (BaseChannelLayer): The Django Channels layer.
            game_id (str): The game/lobby ID.
        """
        players_with_roles = self.get_players_with_roles(game_id)
        async_to_sync(channel_layer.group_send)(
            str(game_id),
            {
                "type": "update_player_list",
                "players": players_with_roles
            }
        )

    def store_rematch_offer(self, game_id: str, requested_by: str) -> None:
        """
        Stores who requested the rematch ("X" or "O") in Redis.

        Args:
            game_id (str): The game/lobby ID.
            requested_by (str): Either "X" or "O".
        """
        self.redis.set(self._rematch_key(game_id), requested_by)

    def get_rematch_offer(self, game_id: str) -> str | None:
        """
        Retrieves the current rematch offer status from Redis.

        Args:
            game_id (str): The game/lobby ID.

        Returns:
            str | None: "X" or "O" if a request exists, otherwise None.
        """
        result = self.redis.get(self._rematch_key(game_id))
        return result if result else None

    def clear_game_lobby_state(self, game_id: str) -> None:
        """
        Clears all Redis keys related to the given game lobby.

        Used at the end of a game or during cleanup.

        Args:
            game_id (str): The game/lobby ID.
        """
        self.redis.delete(
            self._players_key(game_id),
            self._channels_key(game_id),
            self._roles_key(game_id),
            self._rematch_key(game_id)
        )
        logger.info(f"Cleared Redis state for game lobby {game_id}")
