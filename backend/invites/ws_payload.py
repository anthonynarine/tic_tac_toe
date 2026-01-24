
# Filename: invites/ws_payload.py

import logging
from typing import Any, Dict
from invites.serializers import GameInviteSerializer

logger = logging.getLogger("invites.ws_payload")


def build_invite_payload(invite) -> Dict[str, Any]:
    # Step 1: Serialize with canonical serializer
    data = GameInviteSerializer(invite).data

    # Step 2: Debug-only: minimal contract snapshot
    if logger.isEnabledFor(logging.DEBUG):
        logger.debug(
            "[build_invite_payload] inviteId=%s fromUserId=%s toUserId=%s lobbyId=%s status=%s fromUserName=%s",
            data.get("inviteId"),
            data.get("fromUserId"),
            data.get("toUserId"),
            data.get("lobbyId"),
            data.get("status"),
            data.get("fromUserName"),
        )

    return data


def build_invite_event(invite, event: str) -> Dict[str, Any]:
    # Step 1: Build canonical invite fields
    invite_payload = build_invite_payload(invite)

    payload = {
        "type": "invite",
        "event": event,
        **invite_payload,
    }

    # Step 2: Debug-only: confirm final event contract keys
    if logger.isEnabledFor(logging.DEBUG):
        logger.debug(
            "[build_invite_event] event=%s inviteId=%s keys=%s",
            event,
            payload.get("inviteId"),
            sorted(list(payload.keys())),
        )

    return payload


# Backwards-compatible wrappers (keep if your callers still use them)
def build_invite_created_event(invite) -> Dict[str, Any]:
    return build_invite_event(invite, event="invite_created")


def build_invite_status_event(invite) -> Dict[str, Any]:
    return build_invite_event(invite, event="invite_updated")
