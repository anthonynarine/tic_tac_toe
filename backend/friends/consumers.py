# friends/consumers.py

import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from friends.models import Friendship
from django.db.models import Q

User = get_user_model()
logger = logging.getLogger(__name__)  

class FriendStatusConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for tracking and broadcasting user online/offline status.

    Responsibilities:
    - Marks a user as "online" on WebSocket connect
    - Marks them "offline" on disconnect
    - Broadcasts status updates to all accepted friends using Redis pub/sub
    - Allows other friends to listen for real-time status updates via group subscription
    """

    async def connect(self):
        """
        Called when the WebSocket client connects.

        - Rejects unauthenticated users
        - Adds the user to their personal channel group to receive updates
        - Sets user status to "online"
        - Broadcasts status update to all accepted friends
        """
        self.user = self.scope['user']
        logger.debug(f"[connect] Attempting WebSocket connection for user: {self.user}")

        if self.user.is_anonymous:
            logger.warning("[connect] Anonymous user attempted connection. Closing socket.")
            await self.close()
            return

        await self.accept()
        logger.info(f"[connect] Connection accepted for user ID {self.user.id}")

        await self.channel_layer.group_add(
            f"user_{self.user.id}",  # Group name based on user ID
            self.channel_name
        )
        logger.debug(f"[connect] User ID {self.user.id} joined group: user_{self.user.id}")

        await self.set_user_status("online")
        await self.broadcast_status_to_friends("online")

    async def disconnect(self, close_code):
        """
        Called when the WebSocket disconnects.

        - Sets user status to "offline"
        - Broadcasts status update to friends
        - Removes user from their personal group
        """
        if not self.user.is_anonymous:
            logger.info(f"[disconnect] User ID {self.user.id} disconnecting")
            await self.set_user_status("offline")
            await self.broadcast_status_to_friends("offline")
            await self.channel_layer.group_discard(
                f"user_{self.user.id}",
                self.channel_name
            )
            logger.debug(f"[disconnect] User ID {self.user.id} removed from group")

    async def receive(self, text_data):
        """
        Not used in this consumer — status updates are one-way.
        """
        logger.debug(f"[receive] Unexpected message received: {text_data}")

    @database_sync_to_async
    def set_user_status(self, status):
        """
        Updates the user's `status` field in the database.
        """
        logger.debug(f"[set_user_status] Setting user {self.user.id} status to '{status}'")
        self.user.status = status
        self.user.save()

    @database_sync_to_async
    def get_accepted_friend_ids(self):
        """
        Returns a list of user IDs for accepted friends.
        """
        friendships = Friendship.objects.filter(
            is_accepted=True
        ).filter(
            Q(from_user=self.user) | Q(to_user=self.user)
        )

        friend_ids = []
        for f in friendships:
            if f.from_user == self.user:
                friend_ids.append(f.to_user.id)
            else:
                friend_ids.append(f.from_user.id)

        logger.debug(f"[get_accepted_friend_ids] User {self.user.id} has {len(friend_ids)} accepted friends")
        return friend_ids

    async def broadcast_status_to_friends(self, status):
        """
        Sends a `status_update` event to all accepted friends' Redis groups.
        """
        friend_ids = await self.get_accepted_friend_ids()

        for friend_id in friend_ids:
            logger.debug(f"[broadcast_status_to_friends] Notifying friend ID {friend_id} that user {self.user.id} is {status}")
            await self.channel_layer.group_send(
                f"user_{friend_id}",
                {
                    "type": "status_update",
                    "user_id": self.user.id,
                    "status": status
                }
            )

    async def status_update(self, event):
        """
        Called when another user's status update is sent to this client.

        This method sends the JSON payload to the frontend WebSocket connection.
        """
        logger.debug(f"[status_update] Forwarding status update to client: {event}")
        await self.send(text_data=json.dumps({
            "type": "status_update",
            "user_id": event["user_id"],
            "status": event["status"]
        }))
