# Filename: invites/services.py

# Step 1: Standard library imports
from datetime import timedelta
from typing import Dict

# Step 2: Django imports
from django.db import transaction
from django.utils import timezone

# Step 3: DRF imports
from rest_framework.exceptions import PermissionDenied, ValidationError

# Step 4: Local imports
from .models import GameInvite, GameInviteStatus
from .serializers import GameInviteSerializer

# Step 5: Shared notification helper (your project util)
from utils.notifications.notify import notify_user

# Step 6: Canonical WS payload builders (contract-locked)
from invites.ws_payload import (  # NOTE: keep this import path as-is for your project
    build_invite_created_event,
    build_invite_status_event,
)

INVITE_TTL_MINUTES = 10


def _serialize_invite(invite: GameInvite) -> Dict:
    """
    Serialize invite into the canonical payload used by REST responses.

    Note:
    - WS notifications MUST NOT use this directly.
    - WS notifications must always use invites.ws_payload builders.
    """
    return GameInviteSerializer(invite).data


def _assert_receiver(invite: GameInvite, acting_user) -> None:
    """
    Enforce: Only to_user can accept/decline.

    Raises:
        PermissionDenied: if acting_user is not the invite receiver.
    """
    if invite.to_user_id != getattr(acting_user, "id", None):
        raise PermissionDenied("Only the invited user may accept/decline this invite.")


@transaction.atomic
def expire_invite_if_needed(*, invite: GameInvite) -> GameInvite:
    """
    Transition pending invites to expired once expires_at has passed.

    Why:
    - Prevents 'time travel' invites from being usable indefinitely.
    - Ensures server-authoritative behavior even if the frontend is stale.

    Notes:
    - Only PENDING invites may transition to EXPIRED.
    - Notifications are sent using transaction.on_commit to avoid phantom events.
    """
    # Step 1: Only pending invites can expire
    if invite.status != GameInviteStatus.PENDING:
        return invite

    # Step 2: Expire if time passed
    if timezone.now() >= invite.expires_at:
        invite.status = GameInviteStatus.EXPIRED
        invite.responded_at = timezone.now()
        invite.save(update_fields=["status", "responded_at"])

        # Step 3: Notify both users AFTER commit succeeds (canonical payload)
        transaction.on_commit(
            lambda: notify_user(
                user_id=invite.to_user_id,
                payload=build_invite_status_event(invite),
            )
        )
        transaction.on_commit(
            lambda: notify_user(
                user_id=invite.from_user_id,
                payload=build_invite_status_event(invite),
            )
        )

    return invite


@transaction.atomic
def create_invite(*, from_user, to_user, game_type: str, lobby_id: str) -> GameInvite:
    """
    Create a server-authoritative invite.

    Responsibilities:
    - Create DB record with pending status + expires_at.
    - Notify receiver via notifications socket event: invite_created.

    Non-negotiables supported:
    - Backend is authoritative (DB invite record exists).
    - Dedupe is by inviteId (UUID).

    Returns:
        GameInvite: created invite instance
    """
    # Step 1: TTL
    expires_at = timezone.now() + timedelta(minutes=INVITE_TTL_MINUTES)

    # Step 2: Create invite row
    invite = GameInvite.objects.create(
        from_user=from_user,
        to_user=to_user,
        game_type=game_type,
        lobby_id=str(lobby_id),
        status=GameInviteStatus.PENDING,
        expires_at=expires_at,
    )

    # Step 3: Notify receiver AFTER commit succeeds (canonical payload)
    transaction.on_commit(
        lambda: notify_user(
            user_id=to_user.id,
            payload=build_invite_created_event(invite),
        )
    )

    return invite


@transaction.atomic
def accept_invite(*, invite: GameInvite, acting_user) -> GameInvite:
    """
    Accept invite (idempotent).

    Non-negotiables:
    - Only receiver can accept.
    - If accepted twice -> return same invite (same lobbyId).
    - If expired -> error (frontend must disable navigation).
    - Notifications are sent after commit via transaction.on_commit.
    """
    # Step 1: Authorization
    _assert_receiver(invite, acting_user)

    # Step 2: Expire if needed (authoritative)
    invite = expire_invite_if_needed(invite=invite)

    # Step 3: Idempotent accept
    if invite.status == GameInviteStatus.ACCEPTED:
        return invite

    # Step 4: Terminal state checks
    if invite.status == GameInviteStatus.EXPIRED:
        raise ValidationError({"detail": "Invite expired."})

    if invite.status == GameInviteStatus.DECLINED:
        raise ValidationError({"detail": "Invite already declined."})

    if invite.status != GameInviteStatus.PENDING:
        raise ValidationError({"detail": f"Invite is not pending (status={invite.status})."})

    # Step 5: Transition to accepted
    invite.status = GameInviteStatus.ACCEPTED
    invite.responded_at = timezone.now()
    invite.save(update_fields=["status", "responded_at"])

    # Step 6: Notify both users AFTER commit succeeds (canonical payload)
    transaction.on_commit(
        lambda: notify_user(
            user_id=invite.to_user_id,
            payload=build_invite_status_event(invite),
        )
    )
    transaction.on_commit(
        lambda: notify_user(
            user_id=invite.from_user_id,
            payload=build_invite_status_event(invite),
        )
    )

    return invite


@transaction.atomic
def decline_invite(*, invite: GameInvite, acting_user) -> GameInvite:
    """
    Decline invite (idempotent).

    Non-negotiables:
    - Only receiver can decline.
    - Declining twice returns same invite.
    - Expired -> error.
    - Notifications are sent after commit via transaction.on_commit.
    """
    # Step 1: Authorization
    _assert_receiver(invite, acting_user)

    # Step 2: Expire if needed
    invite = expire_invite_if_needed(invite=invite)

    # Step 3: Idempotent decline
    if invite.status == GameInviteStatus.DECLINED:
        return invite

    # Step 4: Terminal state checks
    if invite.status == GameInviteStatus.EXPIRED:
        raise ValidationError({"detail": "Invite expired."})

    if invite.status == GameInviteStatus.ACCEPTED:
        raise ValidationError({"detail": "Invite already accepted."})

    if invite.status != GameInviteStatus.PENDING:
        raise ValidationError({"detail": f"Invite is not pending (status={invite.status})."})

    # Step 5: Transition to declined
    invite.status = GameInviteStatus.DECLINED
    invite.responded_at = timezone.now()
    invite.save(update_fields=["status", "responded_at"])

    # Step 6: Notify both users AFTER commit succeeds (canonical payload)
    transaction.on_commit(
        lambda: notify_user(
            user_id=invite.to_user_id,
            payload=build_invite_status_event(invite),
        )
    )
    transaction.on_commit(
        lambda: notify_user(
            user_id=invite.from_user_id,
            payload=build_invite_status_event(invite),
        )
    )

    return invite
