# Filename: invites/tests/test_invite_rest.py

# Step 1: Third-party imports
import pytest
from rest_framework.test import APIClient
from django.urls import reverse

# Step 2: Local imports
from invites.models import GameInviteStatus


@pytest.mark.django_db
def test_accept_invite_idempotent(user_b, pending_invite):
    # Step 1: Authenticate as the receiver (to_user)
    client = APIClient()
    client.force_authenticate(user=user_b)

    # Step 2: Accept once
    url = reverse("invite-accept", kwargs={"invite_id": pending_invite.id})
    resp1 = client.post(url, data={}, format="json")
    assert resp1.status_code == 200
    assert resp1.data["invite"]["status"] == GameInviteStatus.ACCEPTED

    first_responded_at = resp1.data["invite"]["respondedAt"]
    first_lobby_id = resp1.data["lobbyId"]

    # Step 3: Accept again (idempotent)
    resp2 = client.post(url, data={}, format="json")
    assert resp2.status_code == 200
    assert resp2.data["invite"]["status"] == GameInviteStatus.ACCEPTED
    assert resp2.data["invite"]["respondedAt"] == first_responded_at
    assert resp2.data["lobbyId"] == first_lobby_id


@pytest.mark.django_db
def test_only_receiver_can_accept(user_a, pending_invite):
    # Step 1: Authenticate as sender (from_user) -> should be forbidden
    client = APIClient()
    client.force_authenticate(user=user_a)

    url = reverse("invite-accept", kwargs={"invite_id": pending_invite.id})
    resp = client.post(url, data={}, format="json")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_only_receiver_can_decline(user_c, pending_invite):
    # Step 1: Authenticate as random other user -> forbidden
    client = APIClient()
    client.force_authenticate(user=user_c)

    url = reverse("invite-decline", kwargs={"invite_id": pending_invite.id})
    resp = client.post(url, data={}, format="json")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_accept_rejects_expired_invite(user_b, expired_pending_invite):
    # Step 1: Authenticate as receiver
    client = APIClient()
    client.force_authenticate(user=user_b)

    # Step 2: Attempt accept -> should fail, and DB should transition to EXPIRED
    url = reverse("invite-accept", kwargs={"invite_id": expired_pending_invite.id})
    resp = client.post(url, data={}, format="json")
    assert resp.status_code == 400
    assert "expired" in str(resp.data).lower()

    expired_pending_invite.refresh_from_db()
    assert expired_pending_invite.status == GameInviteStatus.EXPIRED


@pytest.mark.django_db
def test_decline_idempotent(user_b, pending_invite):
    # Step 1: Authenticate as receiver
    client = APIClient()
    client.force_authenticate(user=user_b)

    # Step 2: Decline once
    url = reverse("invite-decline", kwargs={"invite_id": pending_invite.id})
    resp1 = client.post(url, data={}, format="json")
    assert resp1.status_code == 200
    assert resp1.data["invite"]["status"] == GameInviteStatus.DECLINED

    first_responded_at = resp1.data["invite"]["respondedAt"]

    # Step 3: Decline again (idempotent)
    resp2 = client.post(url, data={}, format="json")
    assert resp2.status_code == 200
    assert resp2.data["invite"]["status"] == GameInviteStatus.DECLINED
    assert resp2.data["invite"]["respondedAt"] == first_responded_at
  
    
@pytest.mark.django_db
def test_create_invite_rejects_self_invite(user_a):
    # Step 1: Authenticate as user_a
    client = APIClient()
    client.force_authenticate(user=user_a)

    # Step 2: Attempt to create an invite to self
    url = reverse("invite-create")  # must match your router name
    resp = client.post(
        url,
        {"to_user_id": user_a.id, "game_type": "tic_tac_toe"},
        format="json",
    )

    # Step 3: Assert backend blocks it
    assert resp.status_code == 400
    assert "yourself" in str(resp.data).lower()

@pytest.mark.django_db
def test_create_invite_rejects_self_invite(user_a):
    # Step 1: Authenticate as sender
    client = APIClient()
    client.force_authenticate(user=user_a)

    # Step 2: Attempt self-invite
    resp = client.post(
        "/api/invites/",
        {"to_user_id": user_a.id, "game_type": "tic_tac_toe"},
        format="json",
    )

    # Step 3: Assert 400 with clear message
    assert resp.status_code == 400
    assert "yourself" in str(resp.data).lower()