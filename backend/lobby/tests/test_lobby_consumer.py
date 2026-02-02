# Filename: backend/lobby/tests/test_lobby_consumer.py
import pytest
from types import SimpleNamespace

from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator

from lobby.routing import websocket_urlpatterns


def make_user(user_id=1, is_anonymous=False):
    # Step 1: Minimal shape the consumer expects
    return SimpleNamespace(
        id=user_id,
        is_anonymous=is_anonymous,
        first_name="Test",
    )


@pytest.mark.asyncio
async def test_lobby_ws_rejects_anonymous_user(monkeypatch):
    """
    Expectation:
      - Consumer accepts then immediately closes with 4401
    """
    application = URLRouter(websocket_urlpatterns)

    communicator = WebsocketCommunicator(application, "/ws/lobby/664/?sessionKey=abc")
    communicator.scope["user"] = make_user(is_anonymous=True)

    connected, _ = await communicator.connect()
    assert connected is True

    await communicator.wait_closed()
    assert communicator.close_code == 4401


@pytest.mark.asyncio
async def test_lobby_ws_rejects_without_invite_or_sessionkey(monkeypatch):
    """
    Expectation:
      - No invite and no sessionKey => closes with 4404
    """
    application = URLRouter(websocket_urlpatterns)

    communicator = WebsocketCommunicator(application, "/ws/lobby/664/")
    communicator.scope["user"] = make_user(is_anonymous=False)

    connected, _ = await communicator.connect()
    assert connected is True

    await communicator.wait_closed()
    assert communicator.close_code == 4404


@pytest.mark.asyncio
async def test_lobby_ws_rejects_when_invite_guard_fails(monkeypatch):
    """
    Expectation:
      - invite present but validate_invite_for_lobby_join raises => closes with 4404
    """
    # Step 1: Patch the imported guard *inside the consumer module*
    import lobby.lobby_consumer as lobby_consumer_module

    def _raise(*args, **kwargs):
        raise Exception("bad invite")

    monkeypatch.setattr(lobby_consumer_module, "validate_invite_for_lobby_join", _raise)

    application = URLRouter(websocket_urlpatterns)

    communicator = WebsocketCommunicator(application, "/ws/lobby/664/?invite=deadbeef")
    communicator.scope["user"] = make_user(is_anonymous=False)

    connected, _ = await communicator.connect()
    assert connected is True

    await communicator.wait_closed()
    assert communicator.close_code == 4404


@pytest.mark.asyncio
async def test_lobby_ws_rejects_invalid_sessionkey(monkeypatch):
    """
    Expectation:
      - sessionKey present but Redis manager validation returns False => closes with 4408
    """
    import lobby.lobby_consumer as lobby_consumer_module

    # Step 1: Stub manager with deterministic behavior
    class FakeManager:
        def validate_session_key(self, lobby_id, session_key, user_id):
            return False

    # Step 2: Patch constructor used by consumer
    monkeypatch.setattr(lobby_consumer_module, "RedisGameLobbyManager", lambda: FakeManager())

    application = URLRouter(websocket_urlpatterns)

    communicator = WebsocketCommunicator(application, "/ws/lobby/664/?sessionKey=bad")
    communicator.scope["user"] = make_user(is_anonymous=False)

    connected, _ = await communicator.connect()
    assert connected is True

    await communicator.wait_closed()
    assert communicator.close_code == 4408


@pytest.mark.asyncio
async def test_lobby_ws_invite_happy_path_sends_session_established(monkeypatch):
    """
    Expectation:
      - invite present, guard passes
      - sessionKey minted
      - consumer emits session_established with lobbyId + sessionKey
    """
    import lobby.lobby_consumer as lobby_consumer_module

    # Step 1: Guard passes
    monkeypatch.setattr(lobby_consumer_module, "validate_invite_for_lobby_join", lambda **kwargs: None)

    # Step 2: Fake Redis manager used in connect() (no real Redis needed)
    class FakeManager:
        def ensure_session_key(self, lobby_id):
            return "session-xyz"

        def add_user_to_session(self, lobby_id, user_id):
            return None

        def add_player(self, lobby_id, user):
            return None

        def add_channel(self, lobby_id, channel_name):
            return None

        def assign_player_role(self, lobby_id, user):
            return "X"

        def set_player_role(self, lobby_id, user_id, role):
            return None

        def broadcast_player_list(self, channel_layer, lobby_id):
            return None

    monkeypatch.setattr(lobby_consumer_module, "RedisGameLobbyManager", lambda: FakeManager())

    application = URLRouter(websocket_urlpatterns)

    communicator = WebsocketCommunicator(application, "/ws/lobby/664/?invite=deadbeef")
    communicator.scope["user"] = make_user(user_id=10, is_anonymous=False)

    connected, _ = await communicator.connect()
    assert connected is True

    # Step 3: First server message should be session_established
    msg = await communicator.receive_json_from()
    assert msg["type"] == "session_established"
    assert msg["lobbyId"] == "664"
    assert msg["sessionKey"] == "session-xyz"

    await communicator.disconnect()


@pytest.mark.asyncio
async def test_lobby_receive_json_invalid_type_returns_error_not_close(monkeypatch):
    """
    Expectation:
      - bad client payload should return {type:"error"} and keep socket alive
      - consumer explicitly says: do NOT close for client mistakes
    """
    import lobby.lobby_consumer as lobby_consumer_module

    # Step 1: Minimal happy-path connect stubs
    monkeypatch.setattr(lobby_consumer_module, "validate_invite_for_lobby_join", lambda **kwargs: None)

    class FakeManager:
        def ensure_session_key(self, lobby_id):
            return "session-xyz"

        def add_user_to_session(self, lobby_id, user_id):
            return None

        def add_player(self, lobby_id, user):
            return None

        def add_channel(self, lobby_id, channel_name):
            return None

        def assign_player_role(self, lobby_id, user):
            return "X"

        def set_player_role(self, lobby_id, user_id, role):
            return None

        def broadcast_player_list(self, channel_layer, lobby_id):
            return None

        def remove_player(self, lobby_id, user):
            return None

        def remove_channel(self, lobby_id, channel_name):
            return None

    monkeypatch.setattr(lobby_consumer_module, "RedisGameLobbyManager", lambda: FakeManager())

    application = URLRouter(websocket_urlpatterns)

    communicator = WebsocketCommunicator(application, "/ws/lobby/664/?invite=deadbeef")
    communicator.scope["user"] = make_user(user_id=10, is_anonymous=False)

    connected, _ = await communicator.connect()
    assert connected is True

    # Drain session_established
    _ = await communicator.receive_json_from()

    # Step 2: Send invalid type (not in LOBBY_ALLOWED_TYPES)
    await communicator.send_json_to({"type": "not_a_real_type"})

    # Step 3: Expect error response, no close
    err = await communicator.receive_json_from()
    assert err["type"] == "error"

    # Step 4: Socket should still be open; disconnect cleanly
    await communicator.disconnect()
