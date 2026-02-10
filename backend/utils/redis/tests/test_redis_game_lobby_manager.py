# Filename: backend/utils/redis/tests/test_redis_chat_lobby_manager.py
# ✅ New Code

# Step 1: Imports
from types import SimpleNamespace
from unittest.mock import patch

import fakeredis

from utils.redis.redis_chat_lobby_manager import RedisChatLobbyManager


# Step 2: Test helpers
def _fake_user(user_id: int, first_name: str):
    return SimpleNamespace(id=user_id, first_name=first_name)


def _fake_redis():
    return fakeredis.FakeRedis(decode_responses=True)


# Step 3: Tests
def test_add_and_get_players():
    lobby_id = "abc123"

    with patch(
        "utils.redis.redis_chat_lobby_manager.get_redis_client",
        return_value=_fake_redis(),
    ):
        manager = RedisChatLobbyManager()

        user1 = _fake_user(1, "Alice")
        user2 = _fake_user(2, "Bob")

        manager.add_player(lobby_id, user1)
        manager.add_player(lobby_id, user2)

        players = manager.get_players(lobby_id)
        assert len(players) == 2

        player_ids = {p["id"] for p in players}
        assert player_ids == {1, 2}


def test_remove_player():
    lobby_id = "abc123"

    with patch(
        "utils.redis.redis_chat_lobby_manager.get_redis_client",
        return_value=_fake_redis(),
    ):
        manager = RedisChatLobbyManager()

        user1 = _fake_user(1, "Alice")
        user2 = _fake_user(2, "Bob")

        manager.add_player(lobby_id, user1)
        manager.add_player(lobby_id, user2)

        manager.remove_player(lobby_id, user1)

        players = manager.get_players(lobby_id)
        assert len(players) == 1
        assert players[0]["id"] == 2


def test_add_and_get_channels():
    lobby_id = "abc123"

    with patch(
        "utils.redis.redis_chat_lobby_manager.get_redis_client",
        return_value=_fake_redis(),
    ):
        manager = RedisChatLobbyManager()

        manager.add_channel(lobby_id, "chan_1")
        manager.add_channel(lobby_id, "chan_2")

        channels = manager.get_channels(lobby_id)
        assert channels == {"chan_1", "chan_2"}


def test_remove_channel():
    lobby_id = "abc123"

    with patch(
        "utils.redis.redis_chat_lobby_manager.get_redis_client",
        return_value=_fake_redis(),
    ):
        manager = RedisChatLobbyManager()

        manager.add_channel(lobby_id, "chan_1")
        manager.add_channel(lobby_id, "chan_2")

        manager.remove_channel(lobby_id, "chan_1")

        channels = manager.get_channels(lobby_id)
        assert channels == {"chan_2"}


def test_clear_lobby_if_empty():
    lobby_id = "abc123"

    with patch(
        "utils.redis.redis_chat_lobby_manager.get_redis_client",
        return_value=_fake_redis(),
    ):
        manager = RedisChatLobbyManager()

        # Add one player + one channel, then remove both
        user1 = _fake_user(1, "Alice")
        manager.add_player(lobby_id, user1)
        manager.add_channel(lobby_id, "chan_1")

        manager.remove_player(lobby_id, user1)
        manager.remove_channel(lobby_id, "chan_1")

        # Should delete both keys since lobby is empty
        manager.clear_lobby_if_empty(lobby_id)

        assert manager.get_players(lobby_id) == []
        assert manager.get_channels(lobby_id) == set()
