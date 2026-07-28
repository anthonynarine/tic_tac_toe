from django.urls import path
from chat.consumers.chat_consumer import ChatConsumer
from chat.consumers.direct_message_consumer import DirectMessageConsumer
from chat.consumers.group_chat_consumer import GroupChatConsumer


websocket_urlpatterns = [
    path("ws/chat/lobby/<str:lobby_name>/", ChatConsumer.as_asgi()), # game lobby
    path("ws/chat/<int:friend_id>/", DirectMessageConsumer.as_asgi()),  # DM route
    path("ws/chat/group/<int:room_id>/", GroupChatConsumer.as_asgi()),
]
