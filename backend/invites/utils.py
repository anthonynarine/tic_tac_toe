
# Filename: notifications/utils.py

from typing import Dict

from invites.models import GameInvite
from invites.ws_payload import build_invite_event


def build_notification_invite_payload(invite: GameInvite, event: str) -> Dict:
    """
    Build the WS notification payload for invite events.

    Single source of truth:
      invites/ws_payload.py -> build_invite_event(...)
    """
    # Step 1: Delegate to contract-locked builder
    return build_invite_event(invite=invite, event=event)
