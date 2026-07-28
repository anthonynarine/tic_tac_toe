# Filename: stats/views.py

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from utils.game_registry import get_game_type_config
from .services import (
    get_friend_user_ids,
    get_my_sudoku_bests,
    get_pvp_leaderboard,
    get_sudoku_leaderboard,
)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def pvp_leaderboard(request, game_type):
    if not get_game_type_config(game_type):
        return Response({"error": f"Unsupported game_type: {game_type}"}, status=400)

    user_ids = get_friend_user_ids(request.user) | {request.user.id}
    rows = get_pvp_leaderboard(game_type, user_ids)
    return Response({"gameType": game_type, "rows": rows}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sudoku_leaderboard(request):
    difficulty = request.query_params.get("difficulty", "medium")

    user_ids = get_friend_user_ids(request.user) | {request.user.id}
    rows = get_sudoku_leaderboard(difficulty, user_ids)
    return Response({"difficulty": difficulty, "rows": rows}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_sudoku_bests(request):
    bests = get_my_sudoku_bests(request.user)
    return Response(bests, status=status.HTTP_200_OK)
