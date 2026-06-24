from django.urls import path
from .consumers import ConnectFourConsumer

websocket_urlpatterns = [
    path("ws/c4/<int:game_id>/", ConnectFourConsumer.as_asgi()),
]
