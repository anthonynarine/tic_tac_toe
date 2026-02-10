# Filename: backend/lobby/routing.py
from django.urls import path
from .lobby_consumer import LobbyConsumer

websocket_urlpatterns = [
    path("ws/lobby/<int:lobby_id>/", LobbyConsumer.as_asgi()),
]
