from django.urls import re_path
from game.consumer.game_consumer import GameConsumer

# WebSocket URL patterns
websocket_urlpatterns = [
    # WebSocket endpoint for the game lobbies
    re_path(r"^ws/game/(?P<game_id>\d+)/$", GameConsumer.as_asgi()),
]
