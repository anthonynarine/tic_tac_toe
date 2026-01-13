
# Step 1: Standard library imports
import uuid
from datetime import timedelta

# Step 2: Django imports
from django.conf import settings
from django.db import models
from django.utils import timezone


class GameInviteStatus(models.TextChoices):
    """
    Canonical invite lifecycle statuses.

    Notes:
    - PENDING: Created and actionable by to_user.
    - ACCEPTED / DECLINED: Terminal states set by to_user.
    - EXPIRED: Terminal state set by server when expires_at is reached.
    - CANCELED: Optional future state (sender cancels before response).
    """
    PENDING = "pending", "Pending"
    ACCEPTED = "accepted", "Accepted"
    DECLINED = "declined", "Declined"
    EXPIRED = "expired", "Expired"
    CANCELED = "canceled", "Canceled"  # future-ready


class GameInvite(models.Model):
    """
    Server-authoritative game invite.

    Mental model:
    - The invite is a single-use "permission slip" tied to a specific lobby/game target.
    - The backend is always the source of truth for:
        - status transitions
        - expiry
        - who can accept/decline
        - what lobby/game is associated

    Key rules (enforced in services, not on the model):
    - Accept is idempotent (accept twice returns same lobby/game).
    - Only to_user can accept/decline.
    - Expired invites never navigate.
    - Frontend dedupes by inviteId (this model's UUID primary key).
    """

    # Step 1: Stable dedupe key across REST/WS
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Step 2: Who invited whom
    from_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_game_invites",
    )
    to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="received_game_invites",
    )

    # Step 3: Game Hub extensibility (tic_tac_toe now; connect4 later)
    game_type = models.CharField(max_length=50, default="tic_tac_toe")

    # Step 4: Join target (Phase 1)
    # In your app today, /lobby/:id uses the game.id as the lobby id.
    lobby_id = models.CharField(max_length=64, db_index=True)

    # Step 5: State machine
    status = models.CharField(
        max_length=20,
        choices=GameInviteStatus.choices,
        default=GameInviteStatus.PENDING,
        db_index=True,
    )

    # Step 6: Timing
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(db_index=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        # Step 1: Query patterns we know we’ll need
        indexes = [
            models.Index(fields=["to_user", "status", "-created_at"]),
            models.Index(fields=["from_user", "status", "-created_at"]),
            models.Index(fields=["lobby_id", "status"]),
        ]

    def is_expired(self) -> bool:
        """
        Returns True if now is at-or-after expires_at.
        """
        return timezone.now() >= self.expires_at

    @staticmethod
    def build_default_expiry(minutes: int = 10) -> timezone.datetime:
        """
        Helper for a consistent TTL.

        Args:
            minutes: Invite TTL in minutes.

        Returns:
            timezone-aware datetime for expires_at.
        """
        return timezone.now() + timedelta(minutes=minutes)
