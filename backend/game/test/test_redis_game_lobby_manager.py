import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ttt_core.settings")
django.setup()

import pytest
import fakeredis
from unittest.mock import patch, MagicMock
from users.models import CustomUser
from game.utils.redis_game_lobby_manager import RedisGameLobbyManager




@pytest.fixture
def redis_client():
    return fakeredis.FakeRedis(decode_responses=True)


@pytest.fixture
def game_lobby_manager(redis_client):
    with patch("game.utils.redis_game_lobby_manager.get_redis_connection", return_value=redis_client):
        yield RedisGameLobbyManager()


@pytest.fixture
def mock_user():
    user = MagicMock(spec=CustomUser)
    user.id = 42
    user.first_name = "TestUser"
    return user


@pytest.fixture
def mock_user_2():
    user = MagicMock(spec=CustomUser)
    user.id = 99
    user.first_name = "SecondUser"
    return user


def test_add_and_get_game_players(game_lobby_manager, mock_user):
    game_id = "game123"
    game_lobby_manager.add_player(game_id, mock_user)
    players = game_lobby_manager.get_players(game_id)

    assert len(players) == 1
    assert players[0]["id"] == mock_user.id
    assert players[0]["first_name"] == mock_user.first_name


def test_remove_game_player(game_lobby_manager, mock_user):
    game_id = "game123"
    game_lobby_manager.add_player(game_id, mock_user)
    game_lobby_manager.remove_player(game_id, mock_user)
    players = game_lobby_manager.get_players(game_id)

    assert players == []


def test_assign_roles_and_limits(game_lobby_manager, mock_user, mock_user_2):
    game_id = "game456"
    role1 = game_lobby_manager.assign_player_role(game_id, mock_user)
    role2 = game_lobby_manager.assign_player_role(game_id, mock_user_2)

    assert role1 in ("X", "O")
    assert role2 in ("X", "O") and role2 != role1

    # Third player should get Spectator
    mock_user_3 = MagicMock(spec=CustomUser)
    mock_user_3.id = 17
    mock_user_3.first_name = "ThirdUser"
    role3 = game_lobby_manager.assign_player_role(game_id, mock_user_3)

    assert role3 == "Spectator"


def test_get_players_with_roles(game_lobby_manager, mock_user, mock_user_2):
    game_id = "game789"
    game_lobby_manager.add_player(game_id, mock_user)
    game_lobby_manager.add_player(game_id, mock_user_2)
    game_lobby_manager.assign_player_role(game_id, mock_user)
    game_lobby_manager.assign_player_role(game_id, mock_user_2)

    players_with_roles = game_lobby_manager.get_players_with_roles(game_id)

    assert all("role" in p for p in players_with_roles)
    roles = [p["role"] for p in players_with_roles]
    assert "X" in roles or "O" in roles


def test_store_and_get_rematch_offer(game_lobby_manager):
    game_id = "game987"
    game_lobby_manager.store_rematch_offer(game_id, "X")
    result = game_lobby_manager.get_rematch_offer(game_id)

    assert result == "X"


def test_clear_game_lobby_state(game_lobby_manager, redis_client, mock_user):
    game_id = "game_to_clear"

    # Setup keys
    game_lobby_manager.add_player(game_id, mock_user)
    game_lobby_manager.assign_player_role(game_id, mock_user)
    game_lobby_manager.add_channel(game_id, "test.channel")
    game_lobby_manager.store_rematch_offer(game_id, "X")

    # Ensure keys exist
    assert redis_client.exists(f"lobby:game:{game_id}:players")
    assert redis_client.exists(f"lobby:game:{game_id}:channels")
    assert redis_client.exists(f"lobby:game:{game_id}:roles")
    assert redis_client.exists(f"lobby:game:{game_id}:rematch")

    # Clear and assert cleanup
    game_lobby_manager.clear_game_lobby_state(game_id)
    keys = redis_client.keys(f"lobby:game:{game_id}:*")

    assert keys == []
