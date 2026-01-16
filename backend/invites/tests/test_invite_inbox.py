# Filename: invites/tests/test_invite_inbox.py

# Step 1: Third-party imports
import pytest
from rest_framework.test import APIClient
from django.urls import reverse

# Step 2: Local imports
from invites.models import GameInviteStatus


@pytest.mark.django_db
def test_inbox_defaults_to_receiver_pending(user_b, invite_factory):
    # Step 1: Receiver has 2 pending invites, plus one accepted (should not show)
    i1 = invite_factory(to_user=user_b, status=GameInviteStatus.PENDING, lobby_id="l1")
    i2 = invite_factory(to_user=user_b, status=GameInviteStatus.PENDING, lobby_id="l2")
    invite_factory(to_user=user_b, status=GameInviteStatus.ACCEPTED, lobby_id="l3")

    client = APIClient()
    client.force_authenticate(user=user_b)

    url = reverse("invite-inbox")
    resp = client.get(url)  # default status=pending, role=to_user
    assert resp.status_code == 200

    lobby_ids = {row["lobbyId"] for row in resp.data}
    assert lobby_ids == {"l1", "l2"}


@pytest.mark.django_db
def test_inbox_role_from_user_filters_sent(user_a, user_b, invite_factory):
    # Step 1: user_a sends 2 pending
    invite_factory(from_user=user_a, to_user=user_b, status=GameInviteStatus.PENDING, lobby_id="sent1")
    invite_factory(from_user=user_a, to_user=user_b, status=GameInviteStatus.PENDING, lobby_id="sent2")

    # Step 2: user_a receives 1 pending (from someone else)
    invite_factory(from_user=user_b, to_user=user_a, status=GameInviteStatus.PENDING, lobby_id="recv1")

    client = APIClient()
    client.force_authenticate(user=user_a)

    url = reverse("invite-inbox")
    resp = client.get(url, {"role": "from_user", "status": "pending"})
    assert resp.status_code == 200

    lobby_ids = {row["lobbyId"] for row in resp.data}
    assert lobby_ids == {"sent1", "sent2"}


@pytest.mark.django_db
def test_inbox_status_filter(user_b, invite_factory):
    # Step 1: Receiver has one accepted + one declined
    invite_factory(to_user=user_b, status=GameInviteStatus.ACCEPTED, lobby_id="a1")
    invite_factory(to_user=user_b, status=GameInviteStatus.DECLINED, lobby_id="d1")

    client = APIClient()
    client.force_authenticate(user=user_b)

    url = reverse("invite-inbox")

    resp_accepted = client.get(url, {"status": "accepted", "role": "to_user"})
    assert resp_accepted.status_code == 200
    assert {row["lobbyId"] for row in resp_accepted.data} == {"a1"}

    resp_declined = client.get(url, {"status": "declined", "role": "to_user"})
    assert resp_declined.status_code == 200
    assert {row["lobbyId"] for row in resp_declined.data} == {"d1"}
