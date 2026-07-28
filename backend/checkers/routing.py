from django.urls import path

from .consumers import CheckersConsumer

websocket_urlpatterns = [
    path("ws/checkers/<int:game_id>/", CheckersConsumer.as_asgi()),
]
