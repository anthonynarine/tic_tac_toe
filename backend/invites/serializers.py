
# Filename: invites/serializers.py

import logging

from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import GameInvite

logger = logging.getLogger("invites.serializers")

User = get_user_model()


class CreateInviteSerializer(serializers.Serializer):
    """
    Validate the request payload for creating an invite.

    Expected request body:
        {
            "to_user_id": 123,
            "game_type": "tic_tac_toe"
        }
    """

    to_user_id = serializers.IntegerField()
    game_type = serializers.CharField(max_length=50, default="tic_tac_toe")

    def validate_to_user_id(self, value: int) -> int:
        """
        Validate invite recipient.

        Rules:
        - Cannot invite yourself
        - Recipient must be a real user
        """
        # Step 1: Get request safely
        request = self.context.get("request")
        if not request or not request.user or not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")

        current_user = request.user

        # Step 2: Block self-invites
        if int(value) == int(current_user.id):
            raise serializers.ValidationError("You cannot invite yourself.")

        # Step 3: Ensure recipient exists
        if not User.objects.filter(id=value).exists():
            raise serializers.ValidationError("Recipient user does not exist.")

        return value


class InviteActionSerializer(serializers.Serializer):
    """
    Validate the request payload for invite actions (accept/decline).

    We keep this flexible so we can add optional fields later without
    changing endpoint signatures.

    Example:
        { "reason": "Busy right now" }
    """

    reason = serializers.CharField(required=False, allow_blank=True)


class GameInviteSerializer(serializers.ModelSerializer):
    """
    Server-authoritative invite serializer.

    Notes:
    - Frontend naming consistency (inviteId, fromUserId, etc.)
    """

    inviteId = serializers.UUIDField(source="id", read_only=True)
    fromUserId = serializers.IntegerField(source="from_user_id", read_only=True)
    toUserId = serializers.IntegerField(source="to_user_id", read_only=True)

    # Step 1: Sender name (robust)
    fromUserName = serializers.SerializerMethodField()

    gameType = serializers.CharField(source="game_type", read_only=True)
    lobbyId = serializers.CharField(source="lobby_id", read_only=True)

    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    expiresAt = serializers.DateTimeField(source="expires_at", read_only=True)
    respondedAt = serializers.DateTimeField(source="responded_at", read_only=True)

    class Meta:
        model = GameInvite
        fields = [
            "inviteId",
            "fromUserId",
            "fromUserName",
            "toUserId",
            "gameType",
            "lobbyId",
            "status",
            "createdAt",
            "expiresAt",
            "respondedAt",
        ]
        read_only_fields = fields

    def get_fromUserName(self, obj) -> str:
        """
        Return a short, UI-friendly sender name for the invite.

        Goal:
        - Prefer first_name ONLY (no full name).
        - Fall back to safe identifiers if first_name is missing.

        Priority:
        1) first_name
        2) display_name / name (custom fields)
        3) username
        4) email prefix
        5) "Unknown"

        Logging:
        - Minimal debug logging showing which resolution path was used.
        """
        # Step 1: Resolve sender relation (may or may not be select_related)
        user = getattr(obj, "from_user", None)
        invite_id = getattr(obj, "id", None)

        if not user:
            # Step 2: Minimal warning (signals bad data / unexpected null relation)
            logger.warning(
                "[InviteSerializer] from_user is None (inviteId=%s)",
                invite_id,
            )
            return "Unknown"

        user_id = getattr(user, "id", None)

        # Step 3: Prefer FIRST NAME ONLY
        first = (getattr(user, "first_name", "") or "").strip()
        if first:
            logger.debug(
                "[InviteSerializer] fromUserName resolved via first_name "
                "(inviteId=%s fromUserId=%s)",
                invite_id,
                user_id,
            )
            return first

        # Step 4: Custom display fields
        display_name = (getattr(user, "display_name", "") or "").strip()
        if display_name:
            logger.debug(
                "[InviteSerializer] fromUserName resolved via display_name "
                "(inviteId=%s fromUserId=%s)",
                invite_id,
                user_id,
            )
            return display_name

        name = (getattr(user, "name", "") or "").strip()
        if name:
            logger.debug(
                "[InviteSerializer] fromUserName resolved via name "
                "(inviteId=%s fromUserId=%s)",
                invite_id,
                user_id,
            )
            return name

        # Step 5: Username fallback
        username = (getattr(user, "username", "") or "").strip()
        if username:
            logger.debug(
                "[InviteSerializer] fromUserName resolved via username "
                "(inviteId=%s fromUserId=%s)",
                invite_id,
                user_id,
            )
            return username

        # Step 6: Email prefix fallback
        email = (getattr(user, "email", "") or "").strip()
        if email:
            logger.debug(
                "[InviteSerializer] fromUserName resolved via email_prefix "
                "(inviteId=%s fromUserId=%s)",
                invite_id,
                user_id,
            )
            return email.split("@", 1)[0] if "@" in email else email

        # Step 7: Unknown fallback
        logger.debug(
            "[InviteSerializer] fromUserName fell back to Unknown "
            "(inviteId=%s fromUserId=%s)",
            invite_id,
            user_id,
        )
        return "Unknown"