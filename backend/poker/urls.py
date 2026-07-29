from django.urls import path

from . import views

urlpatterns = [
    path("", views.create_game, name="poker-create"),
    path("<int:game_id>/", views.game_detail, name="poker-detail"),
    path("<int:game_id>/settings/", views.table_settings, name="poker-settings"),
    path("<int:game_id>/join/", views.join_game, name="poker-join"),
    path("<int:game_id>/action/", views.action, name="poker-action"),
    path("<int:game_id>/next-hand/", views.next_hand, name="poker-next-hand"),
]
