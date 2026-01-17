# Filename: friends/consumers.py


# Step 1: Standard library imports
import json
import logging

# Step 2: Third-party imports
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

# Step 3: Django imports
from django.contrib.auth import get_user_model
from django.db.models import Q

# Step 4: Local imports
from friends.models import Friendship

User = get_user_model()
logger = logging.getLogger("friends")



# Step 1: Use a presence-specific group namespace to avoid collisions with NotificationConsumer
def _presence_group_name(user_id: int) -> str:
    """
    Build the group name used exclusively for presence updates.

    Args:
        user_id (int): The target user's ID.

    Returns:
        str: The presence group name.
    """
    return f"presence_user_{user_id}"


class FriendStatusConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for tracking and broadcasting user online/offline status.

    Responsibilities:
    - Marks a user as "online" on WebSocket connect
    - Marks them "offline" on disconnect
    - Broadcasts status updates to all accepted friends (presence-only groups)
    - Allows friends to listen for real-time status updates via group subscription

    Important:
    - Presence groups MUST NOT share the same namespace as Notifications/DM groups.
      We use: presence_user_<id>
    """

    async def connect(self):
        """
        Called when the WebSocket client connects.

        Steps:
        1) Reject unauthenticated users.
        2) Accept the socket.
        3) Add user to their presence group.
        4) Mark user online.
        5) Broadcast online status to accepted friends.
        """
        # Step 1: Store the authenticated user
        self.user = self.scope["user"]
        logger.debug("[connect] Attempting presence WS connection for user=%s", self.user)

        # Step 2: Reject anonymous users
        if self.user.is_anonymous:
            logger.warning("[connect] Anonymous user attempted presence connection. Closing socket.")
            await self.close()
            return

        # Step 3: Accept connection
        await self.accept()
        logger.info("[connect] Presence connection accepted for user_id=%s", self.user.id)


        # Step 4: Join presence-only group (prevents collisions with NotificationConsumer user_<id>)
        group_name = _presence_group_name(self.user.id)
        await self.channel_layer.group_add(group_name, self.channel_name)
        logger.debug("[connect] user_id=%s joined presence group=%s", self.user.id, group_name)

        # Step 5: Mark online and notify friends
        await self.set_user_status("online")
        await self.broadcast_status_to_friends("online")

    async def disconnect(self, close_code):
        """
        Called when the WebSocket disconnects.

        Steps:
        1) Mark user offline.
        2) Broadcast offline status to accepted friends.
        3) Remove user from their presence group.
        """
        if self.user.is_anonymous:
            return

        logger.info("[disconnect] Presence disconnect for user_id=%s close_code=%s", self.user.id, close_code)

        # Step 1: Mark offline
        await self.set_user_status("offline")

        # Step 2: Notify friends
        await self.broadcast_status_to_friends("offline")


        # Step 3: Leave presence-only group
        group_name = _presence_group_name(self.user.id)
        await self.channel_layer.group_discard(group_name, self.channel_name)
        logger.debug("[disconnect] user_id=%s removed from presence group=%s", self.user.id, group_name)

    async def receive(self, text_data):
        """
        Presence is one-way (server -> client). We ignore inbound messages.
        """
        logger.debug("[receive] Unexpected presence message received: %s", text_data)

    @database_sync_to_async
    def set_user_status(self, status: str) -> None:
        """
        Updates the user's `status` field in the database.

        Args:
            status (str): "online" or "offline"
        """
        logger.debug("[set_user_status] Setting user_id=%s status=%s", self.user.id, status)
        self.user.status = status
        self.user.save(update_fields=["status"])

    @database_sync_to_async
    def get_accepted_friend_ids(self):
        """
        Returns a list of user IDs for accepted friends.

        Returns:
            list[int]: Accepted friend user IDs.
        """
        friendships = Friendship.objects.filter(is_accepted=True).filter(
            Q(from_user=self.user) | Q(to_user=self.user)
        )

        friend_ids = []
        for friendship in friendships:
            if friendship.from_user == self.user:
                friend_ids.append(friendship.to_user.id)
            else:
                friend_ids.append(friendship.from_user.id)

        logger.debug(
            "[get_accepted_friend_ids] user_id=%s accepted_friends=%s",
            self.user.id,
            len(friend_ids),
        )
        return friend_ids

    async def broadcast_status_to_friends(self, status: str) -> None:
        """
        Sends a `status_update` event to all accepted friends' presence groups.

        Args:
            status (str): "online" or "offline"
        """
        friend_ids = await self.get_accepted_friend_ids()

        for friend_id in friend_ids:
  
            # Step 1: Broadcast ONLY to presence group (prevents NotificationConsumer crash)
            target_group = _presence_group_name(friend_id)

            logger.debug(
                "[broadcast_status_to_friends] user_id=%s -> friend_id=%s status=%s group=%s",
                self.user.id,
                friend_id,
                status,
                target_group,
            )

            await self.channel_layer.group_send(
                target_group,
                {
                    "type": "status_update",
                    "user_id": self.user.id,
                    "status": status,
                },
            )

    async def status_update(self, event):
        """
        Called when another user's status update is sent to this client.

        Args:
            event (dict): Must include 'user_id' and 'status'.
        """
        logger.debug("[status_update] Forwarding status update to client: %s", event)

        await self.send(
            text_data=json.dumps(
                {
                    "type": "status_update",
                    "user_id": event.get("user_id"),
                    "status": event.get("status"),
                }
            )
        )
