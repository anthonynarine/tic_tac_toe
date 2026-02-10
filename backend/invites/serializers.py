
# Filename: invites/serializers.py

import logging

from django.apps import apps
from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import GameInvite

logger = logging.getLogger("invites.serializers")

User = get_user_model()


class CreateInviteSerializer(serializers.Serializer):
    """
    Validate the request payload for creating an invite.

    Expected request body (either key is accepted):
        {
            "to_user_id": 123,
            "game_type": "tic_tac_toe",
            "lobby_id": "700"      # optional
        }

        OR

        {
            "to_user_id": 123,
            "game_type": "tic_tac_toe",
            "lobbyId": "700"       # optional alias (frontend)
        }
    """

    to_user_id = serializers.IntegerField()
    game_type = serializers.CharField(max_length=50, default="tic_tac_toe", required=False)
    lobby_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate_to_user_id(self, value: int) -> int:
        """
        Validate invite recipient.

        Rules:
        - Must be authenticated
        - Cannot invite yourself
        - Recipient must exist
        """
        request = self.context.get("request")
        if not request or not request.user or not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")

        current_user = request.user

        if int(value) == int(current_user.id):
            raise serializers.ValidationError("You cannot invite yourself.")

        if not User.objects.filter(id=value).exists():
            raise serializers.ValidationError("Recipient user does not exist.")

        return value

    def validate_lobby_id(self, value):
        # Normalize empty -> None, otherwise string
        if value in (None, ""):
            return None
        return str(value)

    def validate(self, attrs):
        """
        Validate optional lobby_id.

        Rules (only when lobby_id is provided):
        - Lobby must exist
        - Cannot invite into AI game
        - Cannot invite into full lobby
        - Inviter must be a member of the lobby (defense-in-depth)
        """
        # Step 1: Accept lobbyId alias (frontend sends lobbyId)
        if not attrs.get("lobby_id"):
            lobby_id_alias = self.initial_data.get("lobbyId")
            if lobby_id_alias not in (None, ""):
                attrs["lobby_id"] = str(lobby_id_alias)

        lobby_id = attrs.get("lobby_id")
        if not lobby_id:
            return attrs  # nothing else to validate

        # Step 2: Auth guard (consistent with validate_to_user_id)
        request = self.context.get("request")
        if not request or not request.user or not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")

        # Step 3: Resolve lobby/game model (no hard import)
        TicTacToeGame = apps.get_model("game", "TicTacToeGame")

        try:
            game = TicTacToeGame.objects.get(id=str(lobby_id))
        except TicTacToeGame.DoesNotExist:
            raise serializers.ValidationError({"lobby_id": "Lobby does not exist."})

        # Step 4: Block AI games
        if getattr(game, "is_ai_game", False):
            raise serializers.ValidationError({"lobby_id": "Cannot invite into an AI game."})

        # Step 5: Block full lobbies (both players assigned)
        player_x_id = getattr(game, "player_x_id", None)
        player_o_id = getattr(game, "player_o_id", None)
        if player_x_id and player_o_id:
            raise serializers.ValidationError({"lobby_id": "Lobby is already full."})

        # Step 6: Ensure inviter is actually in the lobby (defense-in-depth)
        inviter_id = int(request.user.id)
        in_lobby = (player_x_id and int(player_x_id) == inviter_id) or (
            player_o_id and int(player_o_id) == inviter_id
        )

        # If one slot is filled and it's not inviter, reject.
        # (If both are empty, this is an odd state; allow for now.)
        if (player_x_id or player_o_id) and not in_lobby:
            raise serializers.ValidationError({"lobby_id": "You are not a member of this lobby."})

        return attrs


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