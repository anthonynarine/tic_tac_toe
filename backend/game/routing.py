# Filename: backend/game/routing.py
from django.urls import path
from game.consumer.game_consumer import GameConsumer

# WebSocket URL patterns
websocket_urlpatterns = [
    # WebSocket endpoint for games
    path("ws/game/<int:game_id>/", GameConsumer.as_asgi()),
]
