import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ttt_core.settings")
django.setup()

import json
import pytest
import fakeredis
from unittest.mock import patch, MagicMock
from users.models import CustomUser
from utils.redis.redis_chat_lobby_manager import RedisChatLobbyManager


@pytest.fixture
def redis_client():
    return fakeredis.FakeRedis(decode_responses=True)


@pytest.fixture
def lobby_manager(redis_client):
    with patch("game.utils.redis_chat_lobby_manager.get_redis_connection", return_value=redis_client):
        yield RedisChatLobbyManager()


@pytest.fixture
def mock_user():
    user = MagicMock(spec=CustomUser)
    user.id = 42
    user.first_name = "TestUser"
    return user


def test_add_and_get_players(lobby_manager, mock_user):
    lobby_id = "abc123"
    lobby_manager.add_player(lobby_id, mock_user)
    players = lobby_manager.get_players(lobby_id)

    assert len(players) == 1
    assert players[0]["id"] == mock_user.id
    assert players[0]["first_name"] == mock_user.first_name


def test_remove_player(lobby_manager, mock_user):
    lobby_id = "abc123"
    lobby_manager.add_player(lobby_id, mock_user)
    lobby_manager.remove_player(lobby_id, mock_user)
    players = lobby_manager.get_players(lobby_id)

    assert players == []


def test_add_and_get_channels(lobby_manager):
    lobby_id = "abc123"
    channel = "test.channel.1"
    lobby_manager.add_channel(lobby_id, channel)
    channels = lobby_manager.get_channels(lobby_id)

    assert channel.encode() in channels or channel in channels


def test_remove_channel(lobby_manager):
    lobby_id = "abc123"
    channel = "test.channel.1"
    lobby_manager.add_channel(lobby_id, channel)
    lobby_manager.remove_channel(lobby_id, channel)
    channels = lobby_manager.get_channels(lobby_id)

    assert channel.encode() not in channels and channel not in channels


def test_clear_lobby_if_empty(lobby_manager, redis_client, mock_user):
    lobby_id = "abc123"
    lobby_manager.add_player(lobby_id, mock_user)
    lobby_manager.remove_player(lobby_id, mock_user)
    lobby_manager.add_channel(lobby_id, "test.channel.1")
    lobby_manager.remove_channel(lobby_id, "test.channel.1")

    lobby_manager.clear_lobby_if_empty(lobby_id)

    assert redis_client.keys(f"lobby:{lobby_id}:*") == []
