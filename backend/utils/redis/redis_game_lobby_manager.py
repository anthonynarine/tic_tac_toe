# Filename: utils/redis/redis_game_lobby_manager.py


import json
import logging
import secrets
from typing import Any

from asgiref.sync import async_to_sync
from channels.layers import BaseChannelLayer

from users.models import CustomUser
from utils.redis.redis_client import get_redis_client
from utils.websockets.ws_groups import lobby_group

logger = logging.getLogger(__name__)


class RedisGameLobbyManager:
    """
    Manages multiplayer game lobby state in Redis.

    Responsibilities:
    - Tracks players + WebSocket channels per game lobby.
    - Assigns roles ("X", "O", or Spectator) during lobby join.
    - Persists roles in Redis (authoritative for lobby).
    - Broadcasts player lists including roles to all connected clients.
    - Tracks sessionKey allow-list (invite -> session continuity).
    - Tracks rematch offer status and supports cleanup.

    Redis Key Structure:
        - lobby:game:{game_id}:players     (Hash) user_id -> {"id", "first_name"}
        - lobby:game:{game_id}:channels    (Set)  channel_name
        - lobby:game:{game_id}:roles       (Hash) user_id -> "X"|"O"   (Spectator implied)
        - lobby:game:{game_id}:rematch     (String JSON)
        - lobby:session:{lobby_id}:key     (String) -> sessionKey
        - lobby:session:{lobby_id}:users   (Set) -> allowed user_ids
    """

    PREFIX = "lobby:game:"
    REMATCH_TTL_SECONDS = 120
    LOBBY_TTL_SECONDS = 600          # 10 minutes
    SESSION_TTL_SECONDS = 1200       # 20 minutes

    def __init__(self) -> None:
        # Step 1: Create Redis client (decode_responses=True is expected)
        self.redis = get_redis_client()

        # Step 2: Optional health check
        try:
            self.redis.ping()
            logger.debug("Redis connection established successfully.")
        except Exception as exc:
            logger.warning("Redis connection test failed: %s", exc)

    # ----------------------------
    # Key builders
    # ----------------------------
    def _players_key(self, game_id: str) -> str:
        return f"{self.PREFIX}{game_id}:players"

    def _channels_key(self, game_id: str) -> str:
        return f"{self.PREFIX}{game_id}:channels"

    def _roles_key(self, game_id: str) -> str:
        return f"{self.PREFIX}{game_id}:roles"

    def _rematch_key(self, game_id: str) -> str:
        return f"{self.PREFIX}{game_id}:rematch"

    def _session_key_key(self, lobby_id: str) -> str:
        return f"lobby:session:{lobby_id}:key"

    def _session_users_key(self, lobby_id: str) -> str:
        return f"lobby:session:{lobby_id}:users"

    def _touch_lobby_ttl(self, game_id: str) -> None:
        """Refresh TTL for lobby keys to prevent stale presence."""
        # Step 1: Expire each lobby-related key
        self.redis.expire(self._players_key(game_id), self.LOBBY_TTL_SECONDS)
        self.redis.expire(self._channels_key(game_id), self.LOBBY_TTL_SECONDS)
        self.redis.expire(self._roles_key(game_id), self.LOBBY_TTL_SECONDS)

    # ----------------------------
    # Session Key (Invite -> Session)
    # ----------------------------
    def ensure_session_key(self, lobby_id: str) -> str:
        """Creates (or reuses) a lobby-scoped sessionKey with TTL."""
        # Step 1: If it exists, reuse it
        existing = self.redis.get(self._session_key_key(lobby_id))
        if existing:
            self.redis.expire(self._session_key_key(lobby_id), self.SESSION_TTL_SECONDS)
            self.redis.expire(self._session_users_key(lobby_id), self.SESSION_TTL_SECONDS)
            return str(existing)

        # Step 2: Create new random sessionKey
        session_key = secrets.token_urlsafe(24)

        # Step 3: Store with TTL
        self.redis.set(
            self._session_key_key(lobby_id),
            session_key,
            ex=self.SESSION_TTL_SECONDS,
        )
        self.redis.expire(self._session_users_key(lobby_id), self.SESSION_TTL_SECONDS)

        logger.info("[SESSION] Created sessionKey for lobby_id=%s", lobby_id)
        return session_key

    def add_user_to_session(self, lobby_id: str, user_id: int) -> None:
        """Adds user to session allow-list (and refreshes TTL)."""
        # Step 1: Add user to allow-list set
        self.redis.sadd(self._session_users_key(lobby_id), str(user_id))

        # Step 2: Refresh TTL
        self.redis.expire(self._session_users_key(lobby_id), self.SESSION_TTL_SECONDS)

    def validate_session_key(self, lobby_id: str, session_key: str, user_id: int) -> bool:
        """
        Validates that:
        - session_key matches stored key for lobby_id
        - user_id is in allow-list

        Returns:
            True if valid, else False.
        """
        # Step 1: Validate session key
        stored = self.redis.get(self._session_key_key(lobby_id))
        if not stored or str(stored) != str(session_key):
            return False

        # Step 2: Validate allow-list membership
        is_allowed = self.redis.sismember(self._session_users_key(lobby_id), str(user_id))
        return bool(is_allowed)

    # ----------------------------
    # Players
    # ----------------------------
    def add_player(self, game_id: str, user: CustomUser) -> None:
        """Adds or updates a player in Redis."""
        # Step 1: Build player object
        player = {"id": user.id, "first_name": user.first_name}

        # Step 2: Store under players hash
        self.redis.hset(self._players_key(game_id), str(user.id), json.dumps(player))

        # Step 3: Refresh TTL for lobby keys
        self._touch_lobby_ttl(game_id)

    def remove_player(self, game_id: str, user: CustomUser) -> None:
        """Removes a player from Redis (and removes any role assignment)."""
        # Step 1: Remove from players hash
        self.redis.hdel(self._players_key(game_id), str(user.id))

        # Step 2: Remove role assignment (if any)
        self.redis.hdel(self._roles_key(game_id), str(user.id))

    def get_players(self, game_id: str) -> list[dict]:
        """Returns list of players stored in Redis for this game."""
        raw_vals = self.redis.hvals(self._players_key(game_id))
        if not raw_vals:
            return []

        # Step 1: Parse JSON payloads
        return [json.loads(v) for v in raw_vals]

    # ----------------------------
    # Channels
    # ----------------------------
    def add_channel(self, game_id: str, channel_name: str) -> None:
        """Adds a socket channel to Redis."""
        # Step 1: Add to channels set
        self.redis.sadd(self._channels_key(game_id), channel_name)

        # Step 2: Refresh TTL
        self._touch_lobby_ttl(game_id)

    def remove_channel(self, game_id: str, channel_name: str) -> None:
        """Removes a socket channel from Redis."""
        self.redis.srem(self._channels_key(game_id), channel_name)

    def has_any_channels(self, game_id: str) -> bool:
        """Returns True if any socket channels remain for the game lobby."""
        return self.redis.scard(self._channels_key(game_id)) > 0

    # ----------------------------
    # Roles (Lobby-authoritative)
    # ----------------------------
    def assign_player_role(self, game_id: str, user: CustomUser) -> str:
        """
        Assigns a role ("X" or "O") to the player if available.
        Returns "Spectator" if both roles are taken.

        Uses WATCH to prevent two clients being assigned the same role concurrently.
        """
        roles_key = self._roles_key(game_id)
        user_id = str(user.id)

        # Step 1: Attempt to assign role with optimistic locking
        pipe = self.redis.pipeline()

        while True:
            try:
                pipe.watch(roles_key)

                # Step 2: Read existing roles
                roles: dict[str, str] = self.redis.hgetall(roles_key) or {}

                # Step 3: If user already has a role, return it
                if user_id in roles:
                    pipe.unwatch()
                    self._touch_lobby_ttl(game_id)
                    return roles[user_id]

                # Step 4: Determine which roles are taken
                taken = set(roles.values())

                # Step 5: Choose role
                assigned = "Spectator"
                if "X" not in taken:
                    assigned = "X"
                elif "O" not in taken:
                    assigned = "O"

                # Step 6: Write transactionally
                pipe.multi()
                if assigned in ("X", "O"):
                    pipe.hset(roles_key, user_id, assigned)
                pipe.execute()

                self._touch_lobby_ttl(game_id)
                return assigned

            except Exception as exc:
                # Step 7: Retry on conflicts
                try:
                    pipe.reset()
                except Exception:
                    pass

                logger.debug("Role assignment retry due to Redis conflict/exception: %s", exc)
                continue

    def set_player_role(self, game_id: str, user_id: int, role: str) -> None:
        """
        Explicitly sets a player's lobby role.

        This exists to support your consumer calling:
            self.game_lobby_manager.set_player_role(...)

        Rules:
        - Store only X/O in Redis (Spectator is implied if missing).
        - If role == "Spectator", remove any stored role.
        """
        # Step 1: Normalize
        role = str(role)

        # Step 2: Write role or delete if Spectator
        if role in ("X", "O"):
            self.redis.hset(self._roles_key(game_id), str(user_id), role)
        else:
            self.redis.hdel(self._roles_key(game_id), str(user_id))

        # Step 3: Refresh TTL
        self._touch_lobby_ttl(game_id)

    def get_players_with_roles(self, game_id: str) -> list[dict]:
        """Returns player objects with their roles merged in."""
        # Step 1: Fetch players
        players = self.get_players(game_id)

        # Step 2: Fetch role mappings
        roles = self.redis.hgetall(self._roles_key(game_id)) or {}

        # Step 3: Merge roles into player list
        return [{**p, "role": roles.get(str(p["id"]), "Spectator")} for p in players]

    def broadcast_player_list(self, channel_layer: BaseChannelLayer, game_id: str) -> None:
        """Broadcasts updated players+roles list to the lobby group."""
        players_with_roles = self.get_players_with_roles(game_id)

        async_to_sync(channel_layer.group_send)(
            lobby_group(str(game_id)),  
            {"type": "update_player_list", "players": players_with_roles},
        )

    # ----------------------------
    # Rematch offer (authoritative)
    # ----------------------------
    def store_rematch_offer(self, game_id: str, offer: dict[str, Any] | str) -> None:
        """Stores a rematch offer in Redis with TTL (supports dict or legacy str)."""
        # Step 1: Normalize offer into string payload
        payload = json.dumps(offer) if isinstance(offer, dict) else str(offer)

        # Step 2: Store with TTL
        self.redis.set(self._rematch_key(game_id), payload, ex=self.REMATCH_TTL_SECONDS)
        logger.info("Stored rematch offer for game_id=%s: %s", game_id, payload)

    def pop_rematch_offer(self, game_id: str) -> dict[str, Any] | None:
        """
        Atomically reads and deletes the rematch offer.

        Returns:
            - dict offer if JSON dict
            - {"rematchRequestedBy": "X"/"O"} if legacy
            - None if missing/invalid
        """
        key = self._rematch_key(game_id)

        # Step 1: Use GETDEL if available
        getdel = getattr(self.redis, "getdel", None)
        if callable(getdel):
            raw = getdel(key)
            if not raw:
                return None

            # Step 2: Parse JSON dict
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, dict):
                    return parsed
            except Exception:
                pass

            # Step 3: Legacy fallback
            if raw in ("X", "O"):
                return {"rematchRequestedBy": raw}

            return None

        # Step 4: Fallback pipeline GET + DEL
        pipe = self.redis.pipeline()
        try:
            pipe.get(key)
            pipe.delete(key)
            raw, _ = pipe.execute()
        except Exception:
            return None

        if not raw:
            return None

        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass

        if raw in ("X", "O"):
            return {"rematchRequestedBy": raw}

        return None

    def get_rematch_offer(self, game_id: str) -> dict[str, Any] | None:
        """Gets the current rematch offer if present."""
        raw = self.redis.get(self._rematch_key(game_id))
        if not raw:
            return None

        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass

        if raw in ("X", "O"):
            return {"rematchRequestedBy": raw}

        return None

    def clear_rematch_offer(self, game_id: str) -> None:
        """Deletes the rematch offer key."""
        self.redis.delete(self._rematch_key(game_id))

    # ----------------------------
    # Cleanup
    # ----------------------------
    def clear_game_lobby_state(self, game_id: str) -> None:
        """Clears all Redis keys related to the game lobby."""
        self.redis.delete(
            self._players_key(game_id),
            self._channels_key(game_id),
            self._roles_key(game_id),
            self._rematch_key(game_id),
        )
        logger.info("Cleared Redis state for game lobby %s", game_id)
