import json
import logging
from django_redis import get_redis_connection
from channels.layers import BaseChannelLayer
from users.models import CustomUser

logger = logging.getLogger(__name__)

class RedisLobbyManager:
    """
    RedisLobbyManager handles WebSocket lobby state persistence using Redis.

    This class abstracts lobby operations such as player tracking, channel
    subscriptions, and group broadcasts using Redis hash and set data structures.

    Redis Storage Design:
    - Player data is stored using a Redis **hash** (HSET):
        - Key: `lobby:{lobby_id}:players`
        - Field: user ID
        - Value: JSON-encoded user metadata (id, first_name)

    - WebSocket channel names are stored using a Redis **set** (SADD):
        - Key: `lobby:{lobby_id}:channels`
        - Elements: unique Django Channels `channel_name`s
        - Prevents duplicates and supports fast membership tests and cleanup.

    Benefits:
    - Centralized state management in Redis allows horizontal scaling across Django processes.
    - Ensures consistent game lobby tracking across all WebSocket consumers (chat/game).
    """

    PREFIX = "lobby:"

    def __init__(self):
        """
        Initialize the Redis connection using the Django Redis configuration.
        """
        self.redis = get_redis_connection("default")

    def _players_key(self, lobby_id: str) -> str:
        """
        Construct the Redis key used to store player data (hash).

        Returns:
            str: Redis key of the form 'lobby:{lobby_id}:players'
        """
        return f"{self.PREFIX}{lobby_id}:players"

    def _channels_key(self, lobby_id: str) -> str:
        """
        Construct the Redis key used to store channel names (set).

        Returns:
            str: Redis key of the form 'lobby:{lobby_id}:channels'
        """
        return f"{self.PREFIX}{lobby_id}:channels"

    def add_player(self, lobby_id: str, user: CustomUser) -> None:
        """
        Add or update a player in the Redis hash for the specified lobby.

        Uses HSET to map user.id -> JSON string of player data.

        Args:
            lobby_id (str): The unique lobby identifier.
            user (CustomUser): Django user object with id and first_name.
        """
        key = self._players_key(lobby_id)
        player = {"id": user.id, "first_name": user.first_name}
        # Serialize and store user info in Redis hash under their user ID
        self.redis.hset(key, user.id, json.dumps(player))
        logger.info(f"✅ Added player {user.first_name} to Redis lobby {lobby_id}")

    def remove_player(self, lobby_id: str, user: CustomUser) -> None:
        """
        Remove a player from the Redis hash.

        Uses HDEL to remove the field associated with the user's ID.

        Args:
            lobby_id (str): The lobby identifier.
            user (CustomUser): The user to remove.
        """
        key = self._players_key(lobby_id)
        self.redis.hdel(key, user.id)
        logger.info(f"🧹 Removed player {user.first_name} from Redis lobby {lobby_id}")

    def get_players(self, lobby_id: str) -> list[dict]:
        """
        Retrieve all players in the Redis hash for the specified lobby.

        Returns:
            list[dict]: List of player objects, each with "id" and "first_name".
        """
        key = self._players_key(lobby_id)
        players = self.redis.hvals(key)
        return [json.loads(p) for p in players]

    def add_channel(self, lobby_id: str, channel_name: str) -> None:
        """
        Add a WebSocket channel to the Redis set for the specified lobby.

        Uses SADD to ensure uniqueness.

        Args:
            lobby_id (str): The lobby identifier.
            channel_name (str): Django Channels channel name.
        """
        key = self._channels_key(lobby_id)
        self.redis.sadd(key, channel_name)

    def remove_channel(self, lobby_id: str, channel_name: str) -> None:
        """
        Remove a WebSocket channel from the Redis set for the specified lobby.

        Uses SREM for fast removal.

        Args:
            lobby_id (str): The lobby identifier.
            channel_name (str): Django Channels channel name.
        """
        key = self._channels_key(lobby_id)
        self.redis.srem(key, channel_name)

    def get_channels(self, lobby_id: str) -> set:
        """
        Retrieve all channel names in the Redis set for the specified lobby.

        Returns:
            set[bytes]: Set of WebSocket channel names as bytes.
        """
        key = self._channels_key(lobby_id)
        # Retrieve all active WebSocket channels connected to this lobby
        return self.redis.smembers(key)

    def clear_lobby_if_empty(self, lobby_id: str) -> None:
        """
        Delete Redis keys for a lobby if no players or channels remain.

        Useful for preventing Redis bloat and ensuring stale lobbies don't persist.

        Args:
            lobby_id (str): The lobby identifier.
        """
        players_key = self._players_key(lobby_id)
        channels_key = self._channels_key(lobby_id)

        # Only delete the lobby if both the players hash and channels set are empty
        if self.redis.hlen(players_key) == 0 and self.redis.scard(channels_key) == 0:
            self.redis.delete(players_key, channels_key)
            logger.info(f"♻️ Cleaned up empty Redis lobby {lobby_id}")

    def broadcast_player_list(self, channel_layer: BaseChannelLayer, lobby_id: str) -> None:
        """
        Broadcast the updated player list to all WebSocket clients in the group.

        Uses Django Channels `group_send` to trigger a frontend update.

        Args:
            channel_layer (BaseChannelLayer): The Django Channels channel layer.
            lobby_id (str): The lobby group name (used as Redis key suffix and Channels group name).
        """
        players = self.get_players(lobby_id)
        from asgiref.sync import async_to_sync
        # Broadcast updated player list to all connected clients in this lobby group
        # The group_send will call the `update_player_list` handler in the consumer
        async_to_sync(channel_layer.group_send)(
            str(lobby_id),
            {
                "type": "update_player_list",
                "players": players
            }
        )
