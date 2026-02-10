# Filename: backend/utils/redis/tests/test_redis_game_lobby_manager.py
# ✅ New Code

# Step 1: Imports
from types import SimpleNamespace
from unittest.mock import patch

import fakeredis

from utils.redis.redis_game_lobby_manager import RedisGameLobbyManager


# Step 2: Test helpers
def _fake_user(user_id: int, first_name: str):
    return SimpleNamespace(id=user_id, first_name=first_name)


def _fake_redis():
    return fakeredis.FakeRedis(decode_responses=True)


# Step 3: Tests
def test_add_and_get_game_players():
    game_id = "g123"

    with patch(
        "utils.redis.redis_game_lobby_manager.get_redis_client",
        return_value=_fake_redis(),
    ):
        manager = RedisGameLobbyManager()

        user1 = _fake_user(1, "Alice")
        user2 = _fake_user(2, "Bob")

        manager.add_player(game_id, user1)
        manager.add_player(game_id, user2)

        players = manager.get_players(game_id)
        assert len(players) == 2
        assert {p["id"] for p in players} == {1, 2}


def test_remove_game_player():
    game_id = "g123"

    with patch(
        "utils.redis.redis_game_lobby_manager.get_redis_client",
        return_value=_fake_redis(),
    ):
        manager = RedisGameLobbyManager()

        user1 = _fake_user(1, "Alice")
        user2 = _fake_user(2, "Bob")

        manager.add_player(game_id, user1)
        manager.add_player(game_id, user2)

        # Assign roles so we can verify role cleanup too
        role1 = manager.assign_player_role(game_id, user1)
        role2 = manager.assign_player_role(game_id, user2)
        assert role1 in {"X", "O"}
        assert role2 in {"X", "O"}
        assert role1 != role2

        manager.remove_player(game_id, user1)

        players = manager.get_players(game_id)
        assert len(players) == 1
        assert players[0]["id"] == 2

        players_with_roles = manager.get_players_with_roles(game_id)
        assert players_with_roles[0]["role"] in {"X", "O"}


def test_assign_roles_and_limits():
    game_id = "g123"

    with patch(
        "utils.redis.redis_game_lobby_manager.get_redis_client",
        return_value=_fake_redis(),
    ):
        manager = RedisGameLobbyManager()

        user1 = _fake_user(1, "Alice")
        user2 = _fake_user(2, "Bob")
        user3 = _fake_user(3, "Cara")

        role1 = manager.assign_player_role(game_id, user1)
        role2 = manager.assign_player_role(game_id, user2)
        role3 = manager.assign_player_role(game_id, user3)

        assert role1 in {"X", "O"}
        assert role2 in {"X", "O"}
        assert role1 != role2
        assert role3 == "Spectator"


def test_get_players_with_roles():
    game_id = "g123"

    with patch(
        "utils.redis.redis_game_lobby_manager.get_redis_client",
        return_value=_fake_redis(),
    ):
        manager = RedisGameLobbyManager()

        user1 = _fake_user(1, "Alice")
        user2 = _fake_user(2, "Bob")

        manager.add_player(game_id, user1)
        manager.add_player(game_id, user2)

        role1 = manager.assign_player_role(game_id, user1)
        role2 = manager.assign_player_role(game_id, user2)

        players_with_roles = manager.get_players_with_roles(game_id)
        assert len(players_with_roles) == 2

        role_map = {p["id"]: p["role"] for p in players_with_roles}
        assert role_map[1] == role1
        assert role_map[2] == role2


def test_store_and_get_rematch_offer():
    game_id = "g123"

    with patch(
        "utils.redis.redis_game_lobby_manager.get_redis_client",
        return_value=_fake_redis(),
    ):
        manager = RedisGameLobbyManager()

        offer = {
            "rematchRequestedBy": "X",
            "requesterUserId": 10,
            "receiverUserId": 20,
            "createdAtMs": 1234567890,
        }

        manager.store_rematch_offer(game_id, offer)

        stored = manager.get_rematch_offer(game_id)
        assert stored is not None
        assert stored["rematchRequestedBy"] == "X"
        assert stored["requesterUserId"] == 10
        assert stored["receiverUserId"] == 20

        popped = manager.pop_rematch_offer(game_id)
        assert popped is not None
        assert popped["rematchRequestedBy"] == "X"

        # After pop, it should be gone
        assert manager.get_rematch_offer(game_id) is None


def test_clear_game_lobby_state():
    game_id = "g123"

    with patch(
        "utils.redis.redis_game_lobby_manager.get_redis_client",
        return_value=_fake_redis(),
    ):
        manager = RedisGameLobbyManager()

        user1 = _fake_user(1, "Alice")
        manager.add_player(game_id, user1)
        manager.add_channel(game_id, "chan_1")
        manager.assign_player_role(game_id, user1)
        manager.store_rematch_offer(game_id, {"rematchRequestedBy": "X"})

        manager.clear_game_lobby_state(game_id)

        assert manager.get_players(game_id) == []
        assert manager.has_any_channels(game_id) is False
        assert manager.get_rematch_offer(game_id) is None
