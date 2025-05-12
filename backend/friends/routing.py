# friends/routing.py

from django.urls import path
from .consumers import FriendStatusConsumer

websocket_urlpatterns = [
    path("ws/friends/status/", FriendStatusConsumer.as_asgi()),
]
