from django.apps import AppConfig


class GameConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "game"
    
    def ready(self):
        # Import all signal modules
        import backend.game.signals.create_ai_player_signal
        import backend.game.signals.game_update_signal
