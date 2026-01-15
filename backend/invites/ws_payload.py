# Filename: invites/ws_payload.py

from __future__ import annotations

from typing import Any, Dict

from invites.serializers import GameInviteSerializer


def build_invite_payload(invite) -> Dict[str, Any]:
    """
    Build the canonical invite object used across ALL WS notifications.

    Notes:
    - Uses GameInviteSerializer as the source of truth.
    - Prevents drift from ad-hoc dict construction.
    """
    # Step 1: Serialize with the canonical serializer
    return GameInviteSerializer(invite).data


def build_invite_created_event(invite) -> Dict[str, Any]:
    # Step 1: Build canonical invite
    invite_payload = build_invite_payload(invite)

    # Step 2: Wrap in contract-locked event shape
    return {"type": "invite_created", "invite": invite_payload}


def build_invite_status_event(invite) -> Dict[str, Any]:
    # Step 1: Build canonical invite
    invite_payload = build_invite_payload(invite)

    # Step 2: Wrap in contract-locked event shape
    return {"type": "invite_status", "invite": invite_payload}
