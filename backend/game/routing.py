from django.urls import path
from .consumer import GameLobbyConsumer

# Websocket URL patterns
websocket_urlpatterns = [
    # Websocket endpoint for the game lobbies
    path("lobby/<int:game_id>/", GameLobbyConsumer.as_asgi()),
    
]