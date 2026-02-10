# Filename: invites/tests/conftest.py

# Step 1: Standard library imports
from datetime import timedelta
from uuid import uuid4

# Step 2: Third-party imports
import pytest

# Step 3: Django imports
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.test.utils import override_settings

# Step 4: Local imports
from invites.models import GameInvite, GameInviteStatus

User = get_user_model()


@pytest.fixture
def user_factory(db):
    # Step 1: Create a simple user factory for tests
    def _make_user(email: str, password: str = "pass1234", **kwargs):
        return User.objects.create_user(email=email, password=password, **kwargs)

    return _make_user


@pytest.fixture
def user_a(user_factory):
    # Step 1: Sender
    return user_factory(email="sender@test.com")


@pytest.fixture
def user_b(user_factory):
    # Step 1: Receiver
    return user_factory(email="receiver@test.com")


@pytest.fixture
def user_c(user_factory):
    # Step 1: Random other user (permission checks)
    return user_factory(email="other@test.com")


@pytest.fixture
def invite_factory(db, user_a, user_b):
    # Step 1: Create an invite factory with sane defaults
    def _make_invite(
        *,
        from_user=None,
        to_user=None,
        status=GameInviteStatus.PENDING,
        expires_at=None,
        game_type="tic_tac_toe",
        lobby_id="lobby-123",
    ):
        if expires_at is None:
            expires_at = timezone.now() + timedelta(minutes=10)

        return GameInvite.objects.create(
            from_user=from_user or user_a,
            to_user=to_user or user_b,
            game_type=game_type,
            lobby_id=str(lobby_id),
            status=status,
            expires_at=expires_at,
        )

    return _make_invite


@pytest.fixture
def pending_invite(invite_factory):
    # Step 1: Pending invite (default)
    return invite_factory(status=GameInviteStatus.PENDING)


@pytest.fixture
def expired_pending_invite(invite_factory):
    # Step 1: Pending invite that is already expired by time
    return invite_factory(
        status=GameInviteStatus.PENDING,
        expires_at=timezone.now() - timedelta(minutes=1),
    )


@pytest.fixture
def accepted_invite(invite_factory):
    # Step 1: Already accepted invite
    return invite_factory(status=GameInviteStatus.ACCEPTED)

@pytest.fixture(autouse=True)
def _silence_staticfiles_warning(tmp_path):
    # Step 1: Point STATIC_ROOT at a temp dir for tests
    with override_settings(STATIC_ROOT=str(tmp_path / "staticfiles")):
        yield