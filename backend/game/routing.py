from django.urls import re_path
from .consumer import GameLobbyConsumer

# WebSocket URL patterns
websocket_urlpatterns = [
    # WebSocket endpoint for the game lobbies
    re_path(r"^ws/lobby/(?P<game_id>\d+)/$", GameLobbyConsumer.as_asgi()),
]
