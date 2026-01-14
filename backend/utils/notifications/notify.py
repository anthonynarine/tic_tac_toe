
# Filename: utils/notifications/notify.py

# Step 1: Standard libs
from typing import Any, Dict

# Step 2: Channels imports
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def _validate_notification_payload(payload: Dict[str, Any]) -> None:
    """
    Validate the inner notification payload contract.

    This function prevents accidental drift like:
      - passing {"type":"notify","payload":{...}} (double envelope)
      - passing a payload missing "type"
    """
    # Step 1: Must be a dict
    if not isinstance(payload, dict):
        raise ValueError("notify_user payload must be a dict")

    # Step 2: Prevent double envelope
    if payload.get("type") == "notify" and "payload" in payload:
        raise ValueError(
            "notify_user expects the INNER payload only. "
            "Do not pass the outer {type:'notify', payload:{...}} envelope."
        )

    # Step 3: Enforce inner payload has 'type'
    if not isinstance(payload.get("type"), str) or not payload["type"]:
        raise ValueError("notify_user inner payload must include a non-empty string 'type'.")


def notify_user(*, user_id: int, payload: Dict[str, Any]) -> None:
    """
    Send a notification payload to the user's NotificationConsumer group.

    Contract:
      - Consumer group: user_<user_id>
      - Consumer handler: notify
      - Event shape: {"type": "notify", "payload": {...}}

    Args:
        user_id: Recipient user id.
        payload: INNER payload forwarded to client (must include "type").
    """
    # Step 1: Validate inner payload contract
    _validate_notification_payload(payload)

    # Step 2: Resolve channel layer and group
    channel_layer = get_channel_layer()
    group_name = f"user_{user_id}"

    # Step 3: Send payload using the consumer's expected envelope
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "notify",
            "payload": payload,
        },
    )
