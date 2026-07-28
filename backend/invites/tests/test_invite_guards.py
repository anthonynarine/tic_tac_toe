# Filename: invites/tests/test_invite_guards.py

import pytest
from rest_framework.exceptions import ValidationError

from invites.guards import validate_invite_for_lobby_join


@pytest.mark.django_db
def test_validate_invite_rejects_game_type_mismatch(pending_invite, user_a):
    """
    A caller connecting to the lobby WS for one game_type must not be able
    to use an invite that was created for a different game_type, even if
    the lobby_id happens to match (separate tables, independent PKs).
    """
    with pytest.raises(ValidationError):
        validate_invite_for_lobby_join(
            user=user_a,
            lobby_id=pending_invite.lobby_id,
            invite_id=str(pending_invite.id),
            expected_game_type="connect_four",
        )


@pytest.mark.django_db
def test_validate_invite_allows_matching_game_type(pending_invite, user_a):
    """Sanity check: the guard still passes when game_type matches."""
    result = validate_invite_for_lobby_join(
        user=user_a,
        lobby_id=pending_invite.lobby_id,
        invite_id=str(pending_invite.id),
        expected_game_type="tic_tac_toe",
    )
    assert result.id == pending_invite.id


@pytest.mark.django_db
def test_validate_invite_skips_game_type_check_when_not_provided(pending_invite, user_a):
    """Omitting expected_game_type preserves old (pre-generalization) behavior."""
    result = validate_invite_for_lobby_join(
        user=user_a,
        lobby_id=pending_invite.lobby_id,
        invite_id=str(pending_invite.id),
    )
    assert result.id == pending_invite.id
