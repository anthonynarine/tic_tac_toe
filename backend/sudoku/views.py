import logging
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import SudokuPuzzle, SudokuSession
from .serializers import SudokuSessionSerializer, SudokuSessionSaveSerializer
from .puzzle_generator import generate_puzzle

logger = logging.getLogger(__name__)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def new_puzzle(request):
    difficulty = request.query_params.get("difficulty", "medium")
    valid = {"easy", "medium", "hard", "expert"}
    if difficulty not in valid:
        return Response({"error": f"difficulty must be one of {sorted(valid)}"}, status=400)

    puzzle_str, solution_str = generate_puzzle(difficulty)
    puzzle = SudokuPuzzle.objects.create(
        difficulty=difficulty,
        puzzle=puzzle_str,
        solution=solution_str,
    )

    initial_board = [int(c) for c in puzzle_str]
    session = SudokuSession.objects.create(
        user=request.user,
        puzzle=puzzle,
        current_board=initial_board,
        notes={},
    )

    return Response(SudokuSessionSerializer(session).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_session(request, session_id):
    try:
        session = SudokuSession.objects.select_related("puzzle").get(
            pk=session_id, user=request.user
        )
    except SudokuSession.DoesNotExist:
        return Response({"error": "Session not found."}, status=404)

    return Response(SudokuSessionSerializer(session).data)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def save_session(request, session_id):
    try:
        session = SudokuSession.objects.select_related("puzzle").get(
            pk=session_id, user=request.user
        )
    except SudokuSession.DoesNotExist:
        return Response({"error": "Session not found."}, status=404)

    if session.completed:
        return Response({"error": "Session already completed."}, status=400)

    serializer = SudokuSessionSaveSerializer(session, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    completing = serializer.validated_data.get("completed", False)
    if completing and not session.completed:
        serializer.validated_data["completed_at"] = timezone.now()

    serializer.save()
    return Response(SudokuSessionSerializer(session).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def stats(request):
    sessions = SudokuSession.objects.filter(user=request.user, completed=True)

    result = {}
    for diff in ("easy", "medium", "hard", "expert"):
        diff_sessions = sessions.filter(puzzle__difficulty=diff)
        times = [s.elapsed_seconds for s in diff_sessions if s.elapsed_seconds]
        result[diff] = {
            "solved": diff_sessions.count(),
            "best_time": min(times) if times else None,
        }

    return Response(result)
