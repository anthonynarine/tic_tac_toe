from django.urls import re_path
from game.consumer.chat_consumer import ChatConsumer
from game.consumer.game_consumer import GameConsumer

# WebSocket URL patterns
websocket_urlpatterns = [
    # WebSocket endpoint for the game lobbies
    re_path(r"^ws/game/(?P<game_id>\d+)/$", GameConsumer.as_asgi()),
        # WebSocket endpoint for the chat
    re_path(r"^ws/chat/(?P<lobby_name>\w+)/$", ChatConsumer.as_asgi()),
]
