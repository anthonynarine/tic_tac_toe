# ✅ New Code
# Step 1: DRF imports
from rest_framework import serializers

# Step 2: Local imports
from .models import GameInvite


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
    - We expose `inviteId` instead of `id` to keep frontend naming consistent.
    - `fromUserId` / `toUserId` are returned as integers (not nested users) for Phase 1.
    (Later phases can add a lightweight nested user object if desired.)
    """
    inviteId = serializers.UUIDField(source="id", read_only=True)
    fromUserId = serializers.IntegerField(source="from_user_id", read_only=True)
    toUserId = serializers.IntegerField(source="to_user_id", read_only=True)
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
            "toUserId",
            "gameType",
            "lobbyId",
            "status",
            "createdAt",
            "expiresAt",
            "respondedAt",
        ]
        read_only_fields = fields
