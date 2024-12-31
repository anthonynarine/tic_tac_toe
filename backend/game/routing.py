from django.urls import re_path
from .consumer import GameLobbyConsumer
from consumer.chat_consumer import ChatConsumer
from consumer.game_consumer import GameConsumer

# WebSocket URL patterns
websocket_urlpatterns = [
    # WebSocket endpoint for the game lobbies (version1)
    re_path(r"^ws/lobby/(?P<game_id>\d+)/$", GameLobbyConsumer.as_asgi()),
    # WebSocket endpoint for the game lobbies
    re_path(r"^ws/game/(?P<game_id>\d+)/$", GameConsumer.as_asgi()),
        # WebSocket endpoint for the chat
    re_path(r"^ws/chat/(?P<lobby_name>\w+)/$", ChatConsumer.as_asgi()),
]
