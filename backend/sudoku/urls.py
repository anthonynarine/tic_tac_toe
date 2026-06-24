from django.urls import path
from . import views

urlpatterns = [
    path("new/", views.new_puzzle, name="sudoku-new"),
    path("session/<int:session_id>/", views.get_session, name="sudoku-session"),
    path("session/<int:session_id>/save/", views.save_session, name="sudoku-save"),
    path("stats/", views.stats, name="sudoku-stats"),
]
