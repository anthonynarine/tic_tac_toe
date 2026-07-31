from django.urls import path

from . import views

urlpatterns = [
    path("tournaments/", views.tournaments, name="poker-tournaments"),
    path("tournaments/<int:tournament_id>/", views.tournament_detail, name="poker-tournament-detail"),
    path("tournaments/<int:tournament_id>/register/", views.tournament_register, name="poker-tournament-register"),
    path("tournaments/<int:tournament_id>/withdraw/", views.tournament_withdraw, name="poker-tournament-withdraw"),
    path(
        "tournaments/<int:tournament_id>/registrations/<int:registration_id>/remove/",
        views.tournament_remove_registration,
        name="poker-tournament-remove-registration",
    ),
    path("tournaments/<int:tournament_id>/start/", views.tournament_start, name="poker-tournament-start"),
    path("", views.create_game, name="poker-create"),
    path("<int:game_id>/", views.game_detail, name="poker-detail"),
    path("<int:game_id>/settings/", views.table_settings, name="poker-settings"),
    path("<int:game_id>/join/", views.join_game, name="poker-join"),
    path("<int:game_id>/action/", views.action, name="poker-action"),
    path("<int:game_id>/next-hand/", views.next_hand, name="poker-next-hand"),
]
