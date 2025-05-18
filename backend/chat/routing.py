from django.urls import path
from chat.consumers.chat_consumer import ChatConsumer
from chat.consumers.direct_message_consumer import DirectMessageConsumer

websocket_urlpatterns = [
    path("ws/chat/lobby/<str:lobby_id>/", ChatConsumer.as_asgi()),  # Game lobby 
    path("ws/chat/<int:friend_id>/", DirectMessageConsumer.as_asgi()),  # DM route
]
