
# Step 1: Standard library imports
import uuid

# Step 2: Django imports
from django.utils import timezone

# Step 3: DRF imports (nice consistent exceptions)
from rest_framework.exceptions import PermissionDenied, ValidationError

# Step 4: Local imports
from invites.models import GameInvite, GameInviteStatus
from invites.services import expire_invite_if_needed


def validate_invite_for_lobby_join(*, user, lobby_id: str, invite_id: str) -> GameInvite:
    """
    Validate that a lobby WS join is permitted using an invite.

    Rules enforced (Phase 1):
    - invite_id must be a valid UUID
    - invite must exist and match lobby_id
    - invite must not be expired (server-authoritative expiry)
    - Only from_user or to_user may join using this invite
    - Sender (from_user) can join while invite is PENDING or ACCEPTED
    - Receiver (to_user) can join only after invite is ACCEPTED
    - EXPIRED/DECLINED/CANCELED => never allowed to join

    Args:
        user: Authenticated Django user.
        lobby_id: Target lobby/game id (string).
        invite_id: Invite UUID string.

    Returns:
        GameInvite: validated invite (fresh status).

    Raises:
        ValidationError: invalid/expired/not-joinable.
        PermissionDenied: user not allowed to use this invite.
    """
    # Step 1: Validate UUID format early
    try:
        parsed = uuid.UUID(str(invite_id))
    except Exception as exc:
        raise ValidationError({"detail": "Invalid invite id."}) from exc

    # Step 2: Fetch invite + verify lobby binding
    try:
        invite = GameInvite.objects.select_related("from_user", "to_user").get(id=parsed)
    except GameInvite.DoesNotExist as exc:
        raise ValidationError({"detail": "Invite not found."}) from exc

    if str(invite.lobby_id) != str(lobby_id):
        raise ValidationError({"detail": "Invite does not match this lobby."})

    # Step 3: Expire if needed (authoritative)
    invite = expire_invite_if_needed(invite=invite)

    # Step 4: Membership check (only sender/receiver can use invite)
    is_sender = invite.from_user_id == getattr(user, "id", None)
    is_receiver = invite.to_user_id == getattr(user, "id", None)

    if not (is_sender or is_receiver):
        raise PermissionDenied("You are not authorized to join this lobby via this invite.")

    # Step 5: Status gating
    if invite.status == GameInviteStatus.EXPIRED:
        raise ValidationError({"detail": "Invite expired."})

    if invite.status in [GameInviteStatus.DECLINED, GameInviteStatus.CANCELED]:
        raise ValidationError({"detail": f"Invite not joinable (status={invite.status})."})

    # Step 6: Receiver must accept before joining
    if is_receiver and invite.status != GameInviteStatus.ACCEPTED:
        raise ValidationError({"detail": "Invite must be accepted before joining."})

    # Step 7: Sender can join while pending or accepted
    if is_sender and invite.status not in [GameInviteStatus.PENDING, GameInviteStatus.ACCEPTED]:
        raise ValidationError({"detail": f"Invite not joinable (status={invite.status})."})

    return invite
