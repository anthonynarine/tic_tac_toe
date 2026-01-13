# Step 1: Shared notification sender helper (used by invites/, game/, chat/, etc.)

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def notify_user(user_id: int, payload: dict) -> None:
    """
    Send a notification payload to a single user's NotificationConsumer.

    Consumer expectations (from your NotificationConsumer):
      - group name: f"user_{user_id}"
      - handler: "notify"
      - event key: "payload"
    """
    channel_layer = get_channel_layer()
    group_name = f"user_{user_id}"

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "notify",
            "payload": payload,
        },
    )
