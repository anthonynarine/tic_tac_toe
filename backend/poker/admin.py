from django.contrib import admin

from .models import PokerGame, PokerTournament, PokerTournamentRegistration


@admin.register(PokerGame)
class PokerGameAdmin(admin.ModelAdmin):
    list_display = ("id", "player_one", "player_two", "phase", "winner", "is_completed", "created_at")
    list_filter = ("phase", "is_ai_game", "is_completed")


@admin.register(PokerTournament)
class PokerTournamentAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "creator", "scheduled_start", "max_players", "status", "game")
    list_filter = ("status", "scheduled_start")
    search_fields = ("title", "creator__email", "creator__first_name")


@admin.register(PokerTournamentRegistration)
class PokerTournamentRegistrationAdmin(admin.ModelAdmin):
    list_display = ("id", "tournament", "user", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("tournament__title", "user__email", "user__first_name")
