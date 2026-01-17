
from rest_framework import serializers
from .models import GameInvite
from django.contrib.auth import get_user_model

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
        

