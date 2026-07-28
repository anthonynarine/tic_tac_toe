from django.urls import path
from . import views

urlpatterns = [
    path("leaderboard/sudoku/", views.sudoku_leaderboard, name="stats-sudoku-leaderboard"),
    path("leaderboard/<str:game_type>/", views.pvp_leaderboard, name="stats-pvp-leaderboard"),
    path("me/sudoku/", views.my_sudoku_bests, name="stats-my-sudoku-bests"),
]
