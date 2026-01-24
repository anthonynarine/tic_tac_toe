# Filename: invites/views.py
import logging
# Step 1: Django imports
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404

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
      2) Create the lobby/game (server authoritative)
      3) Create the invite (DB authoritative)
      4) Return invite + lobbyId so sender can navigate immediately
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):

        # Step 1: Validate request payload (MUST include request context for guards)
        serializer = CreateInviteSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        to_user_id = serializer.validated_data["to_user_id"]
        game_type = serializer.validated_data.get("game_type", "tic_tac_toe")

        # Step 2: Resolve receiver user
        to_user = get_object_or_404(User, id=to_user_id)

        # Step 3: Create lobby/game (Phase 1 supports tic_tac_toe only)
        if game_type != "tic_tac_toe":
            return Response(
                {"detail": f"Unsupported game_type: {game_type}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Invite-created game:
        # - is_ai_game=False
        # - reserve opponent_user immediately (Player O is the receiver)
        result = create_tictactoe_game(
            creator_user=request.user,
            is_ai_game=False,
            opponent_user=to_user,
        )
        game = result["game"]
        lobby_id = str(game.id)

        # Step 4: Create invite record (authoritative + WS notify receiver after commit)
        invite = create_invite(
            from_user=request.user,
            to_user=to_user,
            game_type=game_type,
            lobby_id=lobby_id,
        )

        # Step 5: Return invite + lobbyId for sender navigation
        return Response(
            {
                "invite": GameInviteSerializer(invite).data,
                "lobbyId": lobby_id,
            },
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
