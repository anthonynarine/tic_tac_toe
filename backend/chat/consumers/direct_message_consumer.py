# # Filename: chat/consumers/direct_message_consumer.py

import json
import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth import get_user_model
from django.db.models import Q

from friends.models import Friendship
from chat.models import Conversation, DirectMessage

logger = logging.getLogger("chat.direct_message_consumer")
User = get_user_model()


class DirectMessageConsumer(AsyncWebsocketConsumer):
    """
    Handles private 1-on-1 WebSocket messaging between two accepted friends.

    WS URL:
      /ws/dm/<friend_id>/

    Groups:
      - dm_<smaller_id>__<larger_id>          (conversation realtime stream)
      - user_<id>                             (personal notifications stream; handled by notifications consumer)

    Incoming message shapes:
      1) Send DM message
        {
          "type": "message",
          "message": "hello"
        }

      2) Send game invite via DM
        {
          "type": "game_invite",
          "game_id": 123,
          "lobby_id": "123"   // optional; defaults to str(game_id)
        }

    Outgoing message shapes:
      1) DM broadcast to dm group:
        {
          "type": "message",
          "sender_id": 1,
          "receiver_id": 2,
          "message": "hello",
          "message_id": 999,
          "conversation_id": 55,                 // ✅ DB conversation id
          "conversation_key": "1__2"             // ✅ deterministic key if you want it
        }

      2) Notify receiver via personal group (for unread badge):
        {
          "type": "notify",
          "payload": {
            "type": "dm",
            "sender_id": 1,
            "receiver_id": 2,
            "message_id": 999,
            "conversation_id": 55,               // ✅ DB conversation id
            "conversation_key": "1__2",
            "timestamp": "..."
          }
        }

      3) Game invite broadcast:
        {
          "type": "game_invite",
          "sender_id": 1,
          "receiver_id": 2,
          "game_id": 123,
          "lobby_id": "123"
        }
    """

    async def connect(self):
        self.user = self.scope.get("user")

        # Step 1: Extract friend_id
        try:
            self.friend_id = int(self.scope["url_route"]["kwargs"]["friend_id"])
        except (KeyError, TypeError, ValueError):
            await self.accept()
            await self.send(text_data=json.dumps({"type": "error", "message": "Missing/invalid friend_id"}))
            await self.close(code=4402)
            return

        # Step 2: Reject anonymous (make it observable to FE/devtools)
        if not self.user or self.user.is_anonymous:
            await self.accept()
            await self.send(text_data=json.dumps({"type": "error", "message": "Unauthorized"}))
            await self.close(code=4401)
            return

        # Step 3: Verify friendship
        if not await self.are_friends(self.user.id, self.friend_id):
            await self.accept()
            await self.send(text_data=json.dumps({"type": "error", "message": "Not friends"}))
            await self.close(code=4403)
            return

        # Step 4: Group join
        self.room_group_name = self.get_room_group_name(self.user.id, self.friend_id)
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)

        await self.accept()

    async def disconnect(self, close_code):
        if getattr(self, "room_group_name", None):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        logger.info("[DM] user=%s disconnected room=%s", getattr(self.user, "id", None), getattr(self, "room_group_name", None))

    async def receive(self, text_data=None, bytes_data=None):
        # Step 1: Parse JSON safely
        try:
            data = json.loads(text_data or "{}")
        except json.JSONDecodeError:
            logger.warning("[DM] Invalid JSON received; ignoring.")
            return

        msg_type = data.get("type")
        if not msg_type:
            logger.warning("[DM] Missing message type; ignoring.")
            return

        if msg_type == "message":
            await self._handle_message(data)
            return

        if msg_type == "game_invite":
            await self._handle_game_invite(data)
            return

        logger.warning("[DM] Unrecognized message type received: %s", msg_type)

    # -----------------------------
    # Handlers
    # -----------------------------

    async def _handle_message(self, data):
        message = data.get("message")
        if not message or not isinstance(message, str):
            return

        # Step 1: Ensure conversation exists + revive if soft-deleted
        conversation = await self.get_or_create_conversation()

        # Step 2: Persist message
        dm = await self.save_message(message, conversation)

        # Step 3: Broadcast to DM group (real-time thread)
        sender_id = int(self.user.id)
        receiver_id = int(self.friend_id)
        conversation_key = self.get_conversation_key(sender_id, receiver_id)

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "chat_message",
                "sender_id": sender_id,
                "receiver_id": receiver_id,
                "message": message,
                "message_id": dm.id,
                "conversation_id": conversation.id,        # ✅ DB id
                "conversation_key": conversation_key,       # ✅ deterministic key if you need it
            },
        )

        # Step 4: Notify receiver personal group (badge signal; keep payload minimal)
        await self.channel_layer.group_send(
            f"user_{receiver_id}",
            {
                "type": "notify",
                "payload": {
                    "type": "dm",
                    "sender_id": sender_id,
                    "receiver_id": receiver_id,
                    "message_id": dm.id,
                    "conversation_id": conversation.id,      # ✅ DB id
                    "conversation_key": conversation_key,
                    "timestamp": str(dm.timestamp),
                },
            },
        )

    async def _handle_game_invite(self, data):
        game_id = data.get("game_id")
        if not game_id:
            return

        lobby_id = data.get("lobby_id") or str(game_id)
        sender_id = int(self.user.id)
        receiver_id = int(self.friend_id)

        # Step 1: Send to DM room
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "game_invite",
                "sender_id": sender_id,
                "receiver_id": receiver_id,
                "game_id": game_id,
                "lobby_id": lobby_id,
            },
        )

        # Step 2: Also notify receiver (sidebar/panel)
        await self.channel_layer.group_send(
            f"user_{receiver_id}",
            {
                "type": "notify",
                "payload": {
                    "type": "game_invite",
                    "sender_id": sender_id,
                    "receiver_id": receiver_id,
                    "game_id": game_id,
                    "lobby_id": lobby_id,
                },
            },
        )

    # -----------------------------
    # Group event handlers
    # -----------------------------

    async def chat_message(self, event):
        # Step 1: Normalize & forward
        payload = {
            "type": "message",
            "sender_id": event["sender_id"],
            "receiver_id": event["receiver_id"],
            "message": event["message"],
            "message_id": event["message_id"],
            "conversation_id": event.get("conversation_id"),
            "conversation_key": event.get("conversation_key") or self.get_conversation_key(
                event["sender_id"], event["receiver_id"]
            ),
        }
        await self.send(text_data=json.dumps(payload))

    async def game_invite(self, event):
        payload = {
            "type": "game_invite",
            "sender_id": event["sender_id"],
            "receiver_id": event["receiver_id"],
            "game_id": event["game_id"],
            "lobby_id": event.get("lobby_id", str(event["game_id"])),
        }
        await self.send(text_data=json.dumps(payload))

    # -----------------------------
    # Helpers
    # -----------------------------

    @staticmethod
    def get_room_group_name(id1: int, id2: int) -> str:
        """Group name used by Channels for the 1-on-1 DM stream."""
        return f"dm_{min(id1, id2)}__{max(id1, id2)}"

    @staticmethod
    def get_conversation_key(id1: int, id2: int) -> str:
        """Deterministic key sometimes used client-side: '<min>__<max>'."""
        return f"{min(id1, id2)}__{max(id1, id2)}"

    @database_sync_to_async
    def are_friends(self, user_id, friend_id) -> bool:
        uid1, uid2 = int(user_id), int(friend_id)
        qs = Friendship.objects.filter(is_accepted=True).filter(
            Q(from_user_id=uid1, to_user_id=uid2) | Q(from_user_id=uid2, to_user_id=uid1)
        )
        return qs.exists()

    @database_sync_to_async
    def save_message(self, content: str, conversation: Conversation) -> DirectMessage:
        return DirectMessage.objects.create(
            sender=self.user,
            receiver_id=self.friend_id,
            content=content,
            conversation=conversation,
        )

    @database_sync_to_async
    def get_or_create_conversation(self) -> Conversation:
        """
        Ensures a unique 1-on-1 conversation between two users.
        Also revives conversation if either participant soft-deleted it.
        """
        friend = User.objects.get(id=self.friend_id)
        user1, user2 = sorted([self.user, friend], key=lambda u: u.id)
        conversation, _ = Conversation.objects.get_or_create(user1=user1, user2=user2)

        # # ✅ If you added soft-delete fields/methods, revive on new activity
        # if hasattr(conversation, "revive_for_participants"):
        #     conversation.revive_for_participants()

        return conversation
