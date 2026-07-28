from django.urls import path

from .consumers import PokerConsumer

websocket_urlpatterns = [
    path("ws/poker/<int:game_id>/", PokerConsumer.as_asgi()),
]
