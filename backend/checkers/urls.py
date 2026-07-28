from django.urls import path

from . import views

urlpatterns = [
    path("", views.create_game, name="checkers-create"),
    path("<int:game_id>/", views.game_detail, name="checkers-detail"),
    path("<int:game_id>/join/", views.join_game, name="checkers-join"),
    path("<int:game_id>/move/", views.make_move, name="checkers-move"),
]
