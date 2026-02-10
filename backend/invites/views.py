# Filename: invites/views.py
import logging

# Step 1: Django imports
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.apps import apps
from django.db import connection

# Step 2: DRF imports
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

# Step 3: Local imports
from .models import GameInvite
from .serializers import CreateInviteSerializer, GameInviteSerializer, InviteActionSerializer
from .services import create_invite, accept_invite, decline_invite

# Step 4: Game creation service (your new factory)
from game.services.game_factory import create_tictactoe_game

logger = logging.getLogger("invites.views")
User = get_user_model()

class InviteCreateView(APIView):
    """
    POST /api/invites/

    Workflow:
      1) Validate to_user_id + game_type
      2) If lobby_id provided: validate lobby exists and can accept invite
         Else: create the lobby/game (server authoritative)
      3) Create the invite (DB authoritative)
      4) Return invite + lobbyId
    """
    permission_classes = [IsAuthenticated]

    logger.warning("INVITES DB=%s USER_TABLE=%s", connection.settings_dict.get("NAME"), User._meta.db_table)
    
    def post(self, request):
        # Step 0: Normalize lobbyId -> lobby_id BEFORE serializer validation
        data = request.data.copy()
        raw_has_lobby = ("lobbyId" in data) or ("lobby_id" in data)

        if "lobby_id" not in data and "lobbyId" in data:
            data["lobby_id"] = data.get("lobbyId")

        # Step 1: Validate
        serializer = CreateInviteSerializer(data=data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        to_user_id = serializer.validated_data["to_user_id"]
        game_type = serializer.validated_data.get("game_type", "tic_tac_toe")
        lobby_id = serializer.validated_data.get("lobby_id")

        # Fail loudly if client attempted lobby invite but lobby_id didn’t parse
        if raw_has_lobby and not lobby_id:
            return Response(
                {"detail": "Invalid or empty lobby id provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        to_user = get_object_or_404(User, id=to_user_id)

        if game_type != "tic_tac_toe":
            return Response(
                {"detail": f"Unsupported game_type: {game_type}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Step 2: Resolve lobby
        if lobby_id:
            TicTacToeGame = apps.get_model("game", "TicTacToeGame")
            game = get_object_or_404(TicTacToeGame, id=str(lobby_id))

            # Guard: full lobby
            if getattr(game, "player_x_id", None) and getattr(game, "player_o_id", None):
                return Response(
                    {"detail": "Cannot invite: lobby is already full."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            resolved_lobby_id = str(game.id)

        else:
            # Existing behavior: create new lobby/game
            result = create_tictactoe_game(
                creator_user=request.user,
                is_ai_game=False,
                opponent_user=to_user,
            )
            game = result["game"]
            resolved_lobby_id = str(game.id)

        invite = create_invite(
            from_user=request.user,
            to_user=to_user,
            game_type=game_type,
            lobby_id=resolved_lobby_id,
        )

        return Response(
            {"invite": GameInviteSerializer(invite).data, "lobbyId": resolved_lobby_id},
            status=status.HTTP_201_CREATED,
        )

class InviteAcceptView(APIView):
    """
    POST /api/invites/{id}/accept/

    Non-negotiables enforced by service:
      - only to_user can accept
      - accept is idempotent
      - expired invites return error and never navigate
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, invite_id):
        # Step 1: Validate optional request body (future-ready)
        body = InviteActionSerializer(data=request.data)
        body.is_valid(raise_exception=False)

        # Step 2: Fetch invite
        invite = get_object_or_404(GameInvite, id=invite_id)

        # Step 3: Accept (authoritative + idempotent)
        accepted = accept_invite(invite=invite, acting_user=request.user)

        # Step 4: Return invite + lobbyId so receiver can navigate
        return Response(
            {
                "invite": GameInviteSerializer(accepted).data,
                "lobbyId": accepted.lobby_id,
            },
            status=status.HTTP_200_OK,
        )

class InviteDeclineView(APIView):
    """
    POST /api/invites/{id}/decline/

    Non-negotiables enforced by service:
      - only to_user can decline
      - decline is idempotent
      - expired invites return error
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, invite_id):
        # Step 1: Validate optional request body (future-ready)
        body = InviteActionSerializer(data=request.data)
        body.is_valid(raise_exception=False)

        # Step 2: Fetch invite
        invite = get_object_or_404(GameInvite, id=invite_id)

        # Step 3: Decline (authoritative + idempotent)
        declined = decline_invite(invite=invite, acting_user=request.user)

        return Response(
            {"invite": GameInviteSerializer(declined).data},
            status=status.HTTP_200_OK,
        )

class InviteInboxView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Step 1: Read filters
        status_filter = request.query_params.get("status", "pending")
        role = request.query_params.get("role", "to_user")

        # Step 2: Log request intent (safe fields only)
        logger.info(
            "[InviteInboxView][GET] user_id=%s role=%s status=%s",
            getattr(request.user, "id", None),
            role,
            status_filter,
        )

        # Step 3: Query (load sender to avoid N+1 / Unknown name)
        qs = GameInvite.objects.select_related("from_user").all()

        if role == "from_user":
            qs = qs.filter(from_user=request.user)
        else:
            qs = qs.filter(to_user=request.user)

        if status_filter:
            qs = qs.filter(status__iexact=status_filter.upper())

        qs = qs.order_by("-created_at")

        # Step 4: Serialize
        serialized = GameInviteSerializer(qs, many=True).data

        # Step 5: Debug-only: show a sample (no tokens)
        if logger.isEnabledFor(logging.DEBUG):
            sample = serialized[0] if serialized else None
            logger.debug(
                "[InviteInboxView][GET] user_id=%s invites_count=%s sample=%s",
                getattr(request.user, "id", None),
                len(serialized),
                sample,
            )

        return Response(serialized, status=status.HTTP_200_OK)
