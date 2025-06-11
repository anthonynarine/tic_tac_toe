import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.db.models import Q
from friends.models import Friendship
from chat.models import DirectMessage, Conversation


logger = logging.getLogger("chat")
User = get_user_model()

class DirectMessageConsumer(AsyncWebsocketConsumer):
    """
    Handles private 1-on-1 WebSocket messaging between two accepted friends.

    Responsibilities:
    - Accept authenticated users only
    - Verify sender and receiver are friends
    - Establish a unique, shared conversation group for message exchange
    - Broadcast chat messages and game invites
    - Persist messages to the database
    """

    async def connect(self):
        """
        Called on WebSocket connection.
        Verifies the user and friendship status before joining a private group.
        """
        self.user = self.scope["user"]
        logger.debug(f"[DM] Raw URL scope: {self.scope.get('url_route')}")

        try:
            self.friend_id = int(self.scope["url_route"]["kwargs"]["friend_id"])
            logger.debug(f"[DM] Extracted friend_id: {self.friend_id}")
        except (KeyError, TypeError, ValueError) as e:
            logger.error(f"[DM] Invalid or missing friend_id in WebSocket URL: {e}")
            await self.close()
            return

        self.room_group_name = self.get_conversation_id(self.user.id, self.friend_id)

        if self.user.is_anonymous:
            logger.warning("[DM] Anonymous user blocked from connecting.")
            await self.close()
            return

        if not await self.are_friends(self.user.id, self.friend_id):
            logger.warning(
                f"[DM] Unauthorized DM attempt. No accepted friendship between "
                f"user {self.user.id} and user {self.friend_id}"
            )
            await self.close()
            return

        # Join the private group
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        logger.info(f"[DM] {self.user} connected to room {self.room_group_name}")

    async def disconnect(self, close_code):
        """
        Called on WebSocket disconnect.
        Removes user from the private group.
        """
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        logger.info(f"[DM] {self.user} disconnected from room {self.room_group_name}")

    async def receive(self, text_data):
        """
        Handles incoming WebSocket messages.
        Supports:
        - 'message': a chat message to be saved and broadcast
        - 'game_invite': a game invitation to be sent to the friend
        """
        data = json.loads(text_data)
        msg_type = data.get("type")
        
        logger.info(f"[DM] Received WebSocket message: {data}")

        if msg_type == "message":
            message = data.get("message")
            if message:
                conversation = await self.get_or_create_conversation()
                dm = await self.save_message(message, conversation)  # ✅ capture saved message
                
                logger.info(f"[DM] Sending message to group: {self.room_group_name}")  
                
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "chat_message",
                        "sender_id": self.user.id,
                        "receiver_id": self.friend_id,
                        "message": message,
                        "message_id": dm.id,  # ✅ include message_id
                        "conversation_id": f"{self.user.id}__{self.friend_id}",  # optional but helpful
                    }
                )

        elif msg_type == "game_invite":
            game_id = data.get("game_id")
            lobby_id = data.get("lobby_id") or str(game_id)  # fallback to game_id
            logger.info(f"[DM] game_invite received for game_id={game_id}, lobby_id={lobby_id}")

            if game_id:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "game_invite",
                        "sender_id": self.user.id,
                        "receiver_id": self.friend_id,
                        "game_id": game_id,
                        "lobby_id": lobby_id,  
                    }
                )
        else:
            logger.warning(f"[DM] Unrecognized message type received: {msg_type}")

    async def chat_message(self, event):
        logger.info(f"[DM] chat_message triggered with event: {event}")
        await self.send(text_data=json.dumps({
            "type": "message",
            "sender_id": event["sender_id"],
            "receiver_id": event["receiver_id"],
            "message": event["message"],
            "message_id": event["message_id"], 
            "conversation_id": f"{min(event['sender_id'], event['receiver_id'])}__{max(event['sender_id'], event['receiver_id'])}"
        }))

    async def game_invite(self, event):
        """
        Sends a game invite message to both users in the conversation group.
        Includes the game ID and lobby ID for joining the lobby.
        """
        await self.send(text_data=json.dumps({
            "type": "game_invite",
            "sender_id": event["sender_id"],
            "receiver_id": event["receiver_id"],
            "game_id": event["game_id"],
            "lobby_id": event.get("lobby_id", str(event["game_id"]))  # fallback if lobby_id isn't explicitly passed
        }))
        logger.info(f"[DM] Sending game_invite event: {event}")


    @staticmethod
    def get_conversation_id(id1, id2):
        """
        Generates a deterministic group name for a 1-on-1 chat between two users.
        Ensures the same ID is used regardless of sender/receiver order.
        Format: "dm_<smaller_id>__<larger_id>"
        """
        return f"dm_{min(id1, id2)}__{max(id1, id2)}"

    @database_sync_to_async
    def save_message(self, content, conversation):
        """
        Saves a direct message to the database and links it to a conversation thread.

        Parameters:
        - content (str): The message content sent by the user.
        - conversation (Conversation): The conversation instance this message belongs to.

        Behavior:
        - Creates a new DirectMessage object tied to the current user and their friend.
        - Links the message to the corresponding Conversation.
        - Marks the message as unread (default behavior).
        
        Returns:
        - DirectMessage: The created message instance.
        """
        return DirectMessage.objects.create(
            sender=self.user,
            receiver_id=self.friend_id,
            content=content,
            conversation=conversation,
        )

    @database_sync_to_async
    def are_friends(self, user_id, friend_id):
        uid1, uid2 = int(user_id), int(friend_id)
        logger.info(f"[DM] Checking friendship between {uid1} and {uid2}")

        match = Friendship.objects.filter(
            is_accepted=True
        ).filter(
            Q(from_user_id=uid1, to_user_id=uid2) |
            Q(from_user_id=uid2, to_user_id=uid1)
        )

        logger.info(f"[DM] Friendship query found {match.count()} record(s)")
        return match.exists()

    @database_sync_to_async
    def get_or_create_conversation(self):
        """
        Ensures a unique 1-on-1 conversation between two users for WebSocket messages.
        """
        user1, user2 = sorted([self.user, User.objects.get(id=self.friend_id)], key=lambda u: u.id)
        conversation, _ = Conversation.objects.get_or_create(user1=user1, user2=user2)
        return conversation
