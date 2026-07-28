import json
import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from chat.models import ChatRoom, ChatRoomMember, ChatRoomMessage


logger = logging.getLogger("chat.group_chat_consumer")


class GroupChatConsumer(AsyncWebsocketConsumer):
    """
    Persistent group chat socket.

    Route:
      /ws/chat/group/<room_id>/?token=...

    Client -> Server:
      { "type": "message", "message": "hello" }

    Server -> Client:
      {
        "type": "group_message",
        "room_id": 1,
        "message_id": 10,
        "sender_id": 2,
        "sender_name": "Julia",
        "message": "hello",
        "timestamp": "..."
      }
    """

    async def connect(self):
        self.user = self.scope.get("user")
        self.room_id = None
        self.room_group_name = None

        try:
            self.room_id = int(self.scope["url_route"]["kwargs"]["room_id"])
        except (KeyError, TypeError, ValueError):
            await self.accept()
            await self.send(text_data=json.dumps({"type": "error", "message": "Missing/invalid room_id"}))
            await self.close(code=4402)
            return

        if not self.user or getattr(self.user, "is_anonymous", True):
            await self.accept()
            await self.send(text_data=json.dumps({"type": "error", "message": "Unauthorized"}))
            await self.close(code=4401)
            return

        if not await self.is_active_member():
            await self.accept()
            await self.send(text_data=json.dumps({"type": "error", "message": "Not a group member"}))
            await self.close(code=4403)
            return

        self.room_group_name = f"chat_group_{self.room_id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        await self.mark_read()

    async def disconnect(self, close_code):
        if self.room_group_name:
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        logger.info(
            "[GROUP_CHAT] user=%s disconnected room=%s code=%s",
            getattr(self.user, "id", None),
            self.room_id,
            close_code,
        )

    async def receive(self, text_data=None, bytes_data=None):
        try:
            data = json.loads(text_data or "{}")
        except json.JSONDecodeError:
            return

        if data.get("type") != "message":
            return

        message = str(data.get("message") or "").strip()
        if not message:
            return

        if not await self.is_active_member():
            await self.send(text_data=json.dumps({"type": "error", "message": "Not a group member"}))
            await self.close(code=4403)
            return

        saved = await self.save_message(message)

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "group_message",
                **saved,
            },
        )
        await self.notify_members(saved)
        await self.touch_room()

    async def group_message(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    "type": "group_message",
                    "room_id": event["room_id"],
                    "message_id": event["message_id"],
                    "sender_id": event["sender_id"],
                    "sender_name": event["sender_name"],
                    "message": event["message"],
                    "content": event["message"],
                    "timestamp": event["timestamp"],
                }
            )
        )

    @database_sync_to_async
    def is_active_member(self):
        return ChatRoomMember.objects.filter(
            room_id=self.room_id,
            room__archived_at__isnull=True,
            user=self.user,
            left_at__isnull=True,
        ).exists()

    @database_sync_to_async
    def save_message(self, content):
        message = ChatRoomMessage.objects.create(
            room_id=self.room_id,
            sender=self.user,
            content=content,
        )
        return {
            "room_id": self.room_id,
            "message_id": message.id,
            "sender_id": self.user.id,
            "sender_name": self.user.first_name,
            "message": message.content,
            "timestamp": message.timestamp.isoformat(),
        }

    @database_sync_to_async
    def mark_read(self):
        membership = ChatRoomMember.objects.filter(
            room_id=self.room_id,
            room__archived_at__isnull=True,
            user=self.user,
            left_at__isnull=True,
        ).first()
        if membership:
            membership.mark_read()

    @database_sync_to_async
    def touch_room(self):
        room = ChatRoom.objects.filter(id=self.room_id).first()
        if room:
            room.save(update_fields=["updated_at"])

    @database_sync_to_async
    def active_member_ids(self):
        return list(
            ChatRoomMember.objects.filter(
                room_id=self.room_id,
                left_at__isnull=True,
            )
            .exclude(user=self.user)
            .values_list("user_id", flat=True)
        )

    async def notify_members(self, saved):
        for user_id in await self.active_member_ids():
            await self.channel_layer.group_send(
                f"user_{user_id}",
                {
                    "type": "notify",
                    "payload": {
                        "type": "group_chat",
                        "room_id": saved["room_id"],
                        "sender_id": saved["sender_id"],
                        "sender_name": saved["sender_name"],
                        "message_id": saved["message_id"],
                        "timestamp": saved["timestamp"],
                    },
                },
            )
