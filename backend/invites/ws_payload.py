
# Filename: invites/ws_payloads.py

from __future__ import annotations

from typing import Any, Dict

from invites.serializers import InviteSerializer


def build_invite_payload(invite) -> Dict[str, Any]:
    """
    Build the canonical invite object used across ALL WS notifications.

    Notes:
    - Uses InviteSerializer as the source of truth (single canonical shape).
    - This prevents drift from ad-hoc dict construction in services/consumers.

    Args:
        invite: Invite model instance.

    Returns:
        A JSON-serializable dict representing the invite.
    """
    # Step 1: Serialize with the canonical serializer
    return InviteSerializer(invite).data


def build_invite_created_event(invite) -> Dict[str, Any]:
    """
    Build the inner payload for an invite_created notification.

    Returns:
        {
          "type": "invite_created",
          "invite": { ...canonical invite... }
        }
    """
    # Step 1: Build canonical invite
    invite_payload = build_invite_payload(invite)

    # Step 2: Wrap in contract-locked event shape
    return {
        "type": "invite_created",
        "invite": invite_payload,
    }


def build_invite_status_event(invite) -> Dict[str, Any]:
    """
    Build the inner payload for invite status changes (accepted/declined/expired).

    Returns:
        {
          "type": "invite_status",
          "invite": { ...canonical invite... }
        }
    """
    # Step 1: Build canonical invite
    invite_payload = build_invite_payload(invite)

    # Step 2: Wrap in contract-locked event shape
    return {
        "type": "invite_status",
        "invite": invite_payload,
    }
