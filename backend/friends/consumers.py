# friends/consumers.py

import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from friends.models import Friendship
from django.db.models import Q

User = get_user_model()

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

        if self.user.is_anonymous:
            await self.close()
            return

        await self.accept()

        await self.channel_layer.group_add(
            f"user_{self.user.id}",  # Group name based on user ID
            self.channel_name
        )

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
            await self.set_user_status("offline")
            await self.broadcast_status_to_friends("offline")

            await self.channel_layer.group_discard(
                f"user_{self.user.id}",
                self.channel_name
            )

    async def receive(self, text_data):
        """
        Not used in this consumer — status updates are one-way.
        """
        pass

    @database_sync_to_async
    def set_user_status(self, status):
        """
        Updates the user's `status` field in the database.
        """
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
        return friend_ids

    async def broadcast_status_to_friends(self, status):
        """
        Sends a `status_update` event to all accepted friends' Redis groups.
        """
        friend_ids = await self.get_accepted_friend_ids()

        for friend_id in friend_ids:
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
        await self.send(text_data=json.dumps({
            "type": "status_update",
            "user_id": event["user_id"],
            "status": event["status"]
        }))
