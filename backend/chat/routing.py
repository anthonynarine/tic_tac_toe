# chat/routing.py
from django.urls import re_path
from chat.consumers.chat_consumer import ChatConsumer


websocket_urlpatterns = [
    re_path(r"^ws/chat/(?P<lobby_name>\w+)/$", ChatConsumer.as_asgi()),
]
