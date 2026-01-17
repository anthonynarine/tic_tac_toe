# Filename: invites/tests/test_invite_ws_close_codes.py

# Step 1: Third-party imports
import pytest
import asyncio
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.urls import re_path
from rest_framework.exceptions import PermissionDenied as DRFPermissionDenied
from rest_framework.exceptions import ValidationError as DRFValidationError

# Step 2: Import the consumer under test
from game.consumer.game_consumer import GameConsumer


@pytest.fixture
def asgi_application():
    # Step 1: Minimal URLRouter for this consumer only
    return URLRouter(
        [
            re_path(r"^ws/game/(?P<game_id>[^/]+)/$", GameConsumer.as_asgi()),
        ]
    )


async def _connect_and_assert_close_code(communicator, expected_code: int) -> None:
    """
    Connect and assert the socket is closed with expected close code.

    Note:
    - In some Channels versions, communicator.connect() consumes websocket.close.
    - Prefer communicator.close_code when available.
    """
    # Step 1: Connect (may immediately close)
    connected, _ = await communicator.connect()

    # Step 2: If Channels exposes close_code, use it (most reliable)
    close_code = getattr(communicator, "close_code", None)
    if close_code is not None:
        assert close_code == expected_code
        return

    # Step 3: Fallback: read ASGI output queue for websocket.close
    close_msg = None
    for _ in range(10):
        try:
            msg = await asyncio.wait_for(communicator.receive_output(), timeout=0.5)
        except asyncio.TimeoutError:
            msg = None

        if msg and msg.get("type") == "websocket.close":
            close_msg = msg
            break

    assert close_msg is not None, "Expected websocket.close but never received it."
    assert close_msg.get("code") == expected_code


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_ws_close_4403_forbidden(monkeypatch, asgi_application, user_b):
    # Step 1: Patch auth to return user_b
    from game.consumer import game_consumer as consumer_module

    monkeypatch.setattr(
        consumer_module.SharedUtils,
        "authenticate_user",
        lambda scope: user_b,
    )

    # Step 2: Patch invite guard to raise forbidden
    def _raise_forbidden(*args, **kwargs):
        raise DRFPermissionDenied("Only invited user may join.")

    monkeypatch.setattr(consumer_module, "validate_invite_for_lobby_join", _raise_forbidden)

    # Step 3: Connect with invite query param
    communicator = WebsocketCommunicator(asgi_application, "/ws/game/123/?invite=abc")
    await _connect_and_assert_close_code(communicator, 4403)


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_ws_close_4408_expired(monkeypatch, asgi_application, user_b):
    # Step 1: Patch auth
    from game.consumer import game_consumer as consumer_module

    monkeypatch.setattr(
        consumer_module.SharedUtils,
        "authenticate_user",
        lambda scope: user_b,
    )

    # Step 2: Patch invite guard to raise "expired"
    def _raise_expired(*args, **kwargs):
        raise DRFValidationError({"detail": "Invite expired."})

    monkeypatch.setattr(consumer_module, "validate_invite_for_lobby_join", _raise_expired)

    communicator = WebsocketCommunicator(asgi_application, "/ws/game/123/?invite=abc")
    await _connect_and_assert_close_code(communicator, 4408)


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_ws_close_4404_invalid(monkeypatch, asgi_application, user_b):
    # Step 1: Patch auth
    from game.consumer import game_consumer as consumer_module

    monkeypatch.setattr(
        consumer_module.SharedUtils,
        "authenticate_user",
        lambda scope: user_b,
    )

    # Step 2: Patch invite guard to raise non-expired validation error
    def _raise_invalid(*args, **kwargs):
        raise DRFValidationError({"detail": "Invite mismatch."})

    monkeypatch.setattr(consumer_module, "validate_invite_for_lobby_join", _raise_invalid)

    communicator = WebsocketCommunicator(asgi_application, "/ws/game/123/?invite=abc")
    await _connect_and_assert_close_code(communicator, 4404)
