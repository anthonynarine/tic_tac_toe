from django.contrib import admin

from .models import PokerGame


@admin.register(PokerGame)
class PokerGameAdmin(admin.ModelAdmin):
    list_display = ("id", "player_one", "player_two", "phase", "winner", "is_completed", "created_at")
    list_filter = ("phase", "is_ai_game", "is_completed")
