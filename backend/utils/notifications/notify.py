
# Step 1: Standard libs
from typing import Any, Dict

# Step 2: Channels imports
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def notify_user(*, user_id: int, payload: Dict[str, Any]) -> None:
    """
    Send a notification payload to the user's NotificationConsumer group.

    Contract:
      - Consumer group: user_<user_id>
      - Consumer handler: notify
      - Event shape: {"type": "notify", "payload": {...}}

    Args:
        user_id: Recipient user id.
        payload: JSON-serializable dict sent to the client.
    """
    # Step 1: Resolve channel layer and group
    channel_layer = get_channel_layer()
    group_name = f"user_{user_id}"

    # Step 2: Send payload using the consumer's expected envelope
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "notify",
            "payload": payload,
        },
    )
