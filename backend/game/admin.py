from django.contrib import admin
from .models import TicTacToeGame

@admin.register(TicTacToeGame)
class TicTacToeGameAdmin(admin.ModelAdmin):
    list_display = ('id', 'player_x', 'player_o', 'created_at', 'winner')

    def get_queryset(self, request):
        # Ensure you are getting all games
        return super().get_queryset(request).all()
