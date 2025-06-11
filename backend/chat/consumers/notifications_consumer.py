import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth import get_user_model

User = get_user_model()
logger = logging.getLogger("chat.notifications_consumer")

class NotificationConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for handling real-time user-level notifications.
    Responsibilities:
    - Authenticates user
    - Joins user-specific notification group
    - Sends events like: dm, game_invite, friend_request, alerts
    """
    async def connect(self):
        self.user = self.scope["user"]
        if self.user.is_anonymous:
            logger.warning("[Notify] Anonymous user tried to connect.")
            await self.close()
            return

        self.group_name = f"user_{self.user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info(f"[Notify] {self.user} connected to group {self.group_name}")

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        logger.info(f"[Notify] {self.user} disconnected from group {self.group_name}")

    async def receive(self, text_data):
        data = json.loads(text_data)
        logger.info(f"[Notify] Received client message: {data}")

    async def notify(self, event):
        logger.info(f"[Notify] Sending event to {self.user}: {event}")
        await self.send(text_data=json.dumps(event["payload"]))

    # 🔒 Safe fallback handlers
    async def chat_message(self, event):
        logger.warning("[Notify] Unexpected 'chat_message' in NotificationConsumer. Ignoring.")

    async def game_invite(self, event):
        logger.warning("[Notify] Unexpected 'game_invite' in NotificationConsumer. Ignoring.")
