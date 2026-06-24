from django.urls import path
from . import views

urlpatterns = [
    path("", views.create_game, name="c4-create"),
    path("<int:game_id>/", views.game_detail, name="c4-detail"),
    path("<int:game_id>/join/", views.join_game, name="c4-join"),
    path("<int:game_id>/move/", views.make_move, name="c4-move"),
]
