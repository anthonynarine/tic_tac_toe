# Filename: backend/chat/consumers/notifications_consumer.py


import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger("notifications.consumer")


class NotificationConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for handling real-time user-level notifications.

    Responsibilities:
        - Authenticates user via scope["user"] (populated by JWT middleware)
        - Joins a user-specific group
        - Receives server events and forwards payloads to the client

    Notes:
        - Channels may call disconnect() even if connect() returns early.
        - Therefore, group_name must be defined defensively and disconnect() must guard access.
    """

    async def connect(self) -> None:
        """Handle websocket connection and join user-specific group."""
        # Step 1: Always initialize attributes used in disconnect()
        self.user = self.scope.get("user")
        self.group_name = None 

        # Step 2: Reject anonymous connections cleanly
        if not self.user or getattr(self.user, "is_anonymous", True):
            logger.warning("[Notify] Anonymous user tried to connect.")
            await self.close(code=4401)  # Unauthorized (non-standard but common)
            return

        # Step 3: Build group name and join
        self.group_name = f"user_{self.user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)

        # Step 4: Accept connection
        await self.accept()
        logger.info(f"[Notify] {self.user} connected to group {self.group_name}")

    async def disconnect(self, code: int) -> None:
        """Handle websocket disconnect safely."""
        # Step 1: group_name may not exist if connect() returned early
        group_name = getattr(self, "group_name", None)  # ✅ New Code
        user = getattr(self, "user", None)

        if group_name:
            try:
                await self.channel_layer.group_discard(group_name, self.channel_name)
            except Exception as exc:
                logger.warning(f"[Notify] group_discard failed: {exc}")

        logger.info(f"[Notify] {user} disconnected (code={code}) group={group_name}")

    async def receive(self, text_data: str | None = None, bytes_data: bytes | None = None) -> None:
        """Handle optional client messages (usually not needed for notifications)."""
        if not text_data:
            return

        try:
            data = json.loads(text_data)
            logger.info(f"[Notify] Received client message: {data}")
        except json.JSONDecodeError:
            logger.warning("[Notify] Invalid JSON received. Ignoring.")

    async def notify(self, event: dict) -> None:
        """Send notification payload to websocket client."""
        payload = event.get("payload", {})
        logger.info(f"[Notify] Sending event to {self.user}: {payload}")
        await self.send(text_data=json.dumps(payload))

    # Step 1: Safe fallback handlers (ignore unexpected event types)
    async def chat_message(self, event: dict) -> None:
        logger.warning("[Notify] Unexpected 'chat_message' in NotificationConsumer. Ignoring.")

    async def game_invite(self, event: dict) -> None:
        logger.warning("[Notify] Unexpected 'game_invite' in NotificationConsumer. Ignoring.")
