# Filename: stats/services.py
"""
Friends-scoped leaderboard aggregation.

Pure read layer over data that already exists elsewhere (SudokuSession,
TicTacToeGame, ConnectFourGame) -- no new models. PvP win/loss aggregation
is generic across game types via `utils.game_registry.GAME_TYPE_REGISTRY`,
so adding a new invite-capable PvP game to the registry automatically gets
a working leaderboard here too.
"""

from django.contrib.auth import get_user_model
from django.db import models as django_models

from friends.models import Friendship
from sudoku.models import SudokuPuzzle, SudokuSession
from utils.game_registry import get_game_type_config, get_model_for

User = get_user_model()


def get_friend_user_ids(user) -> set:
    """Returns the set of user ids who are accepted friends of `user`."""
    friendships = Friendship.objects.filter(
        django_models.Q(from_user=user) | django_models.Q(to_user=user),
        is_accepted=True,
    )
    return {f.get_other_user(user).id for f in friendships if f.get_other_user(user)}


def _display_name(user_obj) -> str:
    first = (getattr(user_obj, "first_name", "") or "").strip()
    if first:
        return first
    email = getattr(user_obj, "email", "") or ""
    return email.split("@", 1)[0] if "@" in email else (email or "Unknown")


def get_pvp_leaderboard(game_type: str, user_ids) -> list:
    """
    Friends-scoped win/loss/draw leaderboard for a PvP game type
    ("tic_tac_toe" or "connect_four"), sorted by wins descending.

    Excludes AI games -- only human vs human matches count.
    """
    cfg = get_game_type_config(game_type)
    if not cfg:
        return []

    Model = get_model_for(game_type)
    seat_x_field = cfg["seat_fk_names"]["X"]
    seat_o_field = cfg["seat_fk_names"]["O"]
    x_win_value = cfg["turn_values"]["X"]
    o_win_value = cfg["turn_values"]["O"]

    users_by_id = {u.id: u for u in User.objects.filter(id__in=user_ids)}

    rows = []
    for user_id in user_ids:
        user_obj = users_by_id.get(user_id)
        if not user_obj:
            continue

        games = (
            Model.objects.filter(
                django_models.Q(**{f"{seat_x_field}_id": user_id})
                | django_models.Q(**{f"{seat_o_field}_id": user_id}),
                is_completed=True,
                is_ai_game=False,
            )
            .order_by("-created_at")
        )

        wins = losses = draws = 0
        current_streak = 0
        streak_broken = False

        for game in games:
            my_seat = "X" if getattr(game, f"{seat_x_field}_id") == user_id else "O"
            my_win_value = x_win_value if my_seat == "X" else o_win_value

            if game.winner is None:
                continue  # defensive: shouldn't happen for is_completed=True

            if game.winner == my_win_value:
                wins += 1
                if not streak_broken:
                    current_streak += 1
            elif game.winner in (x_win_value, o_win_value):
                losses += 1
                streak_broken = True
            else:
                draws += 1
                streak_broken = True

        games_played = wins + losses + draws
        if games_played == 0:
            continue

        rows.append({
            "userId": user_id,
            "name": _display_name(user_obj),
            "wins": wins,
            "losses": losses,
            "draws": draws,
            "gamesPlayed": games_played,
            "currentStreak": current_streak,
        })

    rows.sort(key=lambda r: (-r["wins"], r["losses"]))
    return rows


def get_sudoku_leaderboard(difficulty: str, user_ids) -> list:
    """
    Friends-scoped best-time leaderboard for a Sudoku difficulty, sorted by
    time ascending (faster is better). Users with no completed session at
    this difficulty are omitted.
    """
    users_by_id = {u.id: u for u in User.objects.filter(id__in=user_ids)}

    rows = []
    for user_id in user_ids:
        user_obj = users_by_id.get(user_id)
        if not user_obj:
            continue

        best = (
            SudokuSession.objects
            .filter(user_id=user_id, completed=True, puzzle__difficulty=difficulty)
            .aggregate(best_time=django_models.Min("elapsed_seconds"))
        )
        best_time = best.get("best_time")
        if best_time is None:
            continue

        rows.append({
            "userId": user_id,
            "name": _display_name(user_obj),
            "bestTimeSeconds": best_time,
        })

    rows.sort(key=lambda r: r["bestTimeSeconds"])
    return rows


def get_my_sudoku_bests(user) -> dict:
    """Returns {difficulty: best_time_seconds_or_None} for every difficulty."""
    difficulties = [choice for choice, _ in SudokuPuzzle.DIFFICULTY_CHOICES]

    bests = {}
    for difficulty in difficulties:
        agg = (
            SudokuSession.objects
            .filter(user_id=user.id, completed=True, puzzle__difficulty=difficulty)
            .aggregate(best_time=django_models.Min("elapsed_seconds"))
        )
        bests[difficulty] = agg.get("best_time")

    return bests
