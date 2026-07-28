from django.contrib.auth import get_user_model
from django.utils import timezone
from unittest.mock import patch
from rest_framework.test import APITestCase

from chat.models import ChatRoom, ChatRoomMember, ChatRoomMessage
from friends.models import Friendship


User = get_user_model()


class GroupChatRestTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@example.com",
            password="pass",
            first_name="Owner",
            last_name="User",
        )
        self.friend = User.objects.create_user(
            email="friend@example.com",
            password="pass",
            first_name="Friend",
            last_name="User",
        )
        self.other = User.objects.create_user(
            email="other@example.com",
            password="pass",
            first_name="Other",
            last_name="User",
        )
        Friendship.objects.create(
            from_user=self.owner,
            to_user=self.friend,
            is_accepted=True,
        )

    def test_create_group_with_accepted_friend(self):
        self.client.force_authenticate(user=self.owner)

        with patch("chat.views.group_views.notify_user") as notify_user:
            response = self.client.post(
                "/api/chat/groups/",
                {"name": "Recruiter Demo", "member_ids": [self.friend.id]},
                format="json",
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["name"], "Recruiter Demo")
        self.assertEqual(response.data["member_count"], 2)
        notify_user.assert_called_once()
        self.assertEqual(notify_user.call_args.kwargs["user_id"], self.friend.id)
        self.assertEqual(notify_user.call_args.kwargs["payload"]["type"], "group_created")
        self.assertEqual(notify_user.call_args.kwargs["payload"]["room_id"], response.data["id"])
        self.assertTrue(
            ChatRoomMember.objects.filter(
                room_id=response.data["id"],
                user=self.owner,
                role=ChatRoomMember.ROLE_OWNER,
            ).exists()
        )
        self.assertTrue(
            ChatRoomMember.objects.filter(
                room_id=response.data["id"],
                user=self.friend,
                role=ChatRoomMember.ROLE_MEMBER,
            ).exists()
        )

    def test_create_group_rejects_non_friend(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(
            "/api/chat/groups/",
            {"name": "Bad Group", "member_ids": [self.other.id]},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(ChatRoom.objects.filter(name="Bad Group").exists())

    def test_non_member_cannot_fetch_messages(self):
        room = ChatRoom.objects.create(name="Private", created_by=self.owner)
        ChatRoomMember.objects.create(
            room=room,
            user=self.owner,
            role=ChatRoomMember.ROLE_OWNER,
        )
        self.client.force_authenticate(user=self.other)

        response = self.client.get(f"/api/chat/groups/{room.id}/messages/")

        self.assertEqual(response.status_code, 403)

    def test_group_unread_summary_counts_messages_after_last_read(self):
        room = ChatRoom.objects.create(name="Unread", created_by=self.owner)
        ChatRoomMember.objects.create(
            room=room,
            user=self.owner,
            role=ChatRoomMember.ROLE_OWNER,
            last_read_at=timezone.now(),
        )
        ChatRoomMember.objects.create(
            room=room,
            user=self.friend,
            role=ChatRoomMember.ROLE_MEMBER,
        )
        ChatRoomMessage.objects.create(room=room, sender=self.owner, content="hello")

        self.client.force_authenticate(user=self.friend)
        response = self.client.get("/api/chat/unread-summary/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["group_unread_total"], 1)
        self.assertEqual(response.data["groups"][str(room.id)], 1)

    def test_owner_can_delete_group_for_everyone(self):
        room = ChatRoom.objects.create(name="Delete Me", created_by=self.owner)
        ChatRoomMember.objects.create(
            room=room,
            user=self.owner,
            role=ChatRoomMember.ROLE_OWNER,
        )
        ChatRoomMember.objects.create(
            room=room,
            user=self.friend,
            role=ChatRoomMember.ROLE_MEMBER,
        )

        self.client.force_authenticate(user=self.owner)
        with patch("chat.views.group_views.notify_user") as notify_user:
            response = self.client.delete(f"/api/chat/groups/{room.id}/delete/")

        self.assertEqual(response.status_code, 204)
        room.refresh_from_db()
        self.assertIsNotNone(room.archived_at)
        notify_user.assert_called_once()
        self.assertEqual(notify_user.call_args.kwargs["user_id"], self.friend.id)
        self.assertEqual(notify_user.call_args.kwargs["payload"]["type"], "group_deleted")

        self.client.force_authenticate(user=self.friend)
        list_response = self.client.get("/api/chat/groups/")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.data, [])

    def test_non_owner_cannot_delete_group_for_everyone(self):
        room = ChatRoom.objects.create(name="Protected", created_by=self.owner)
        ChatRoomMember.objects.create(
            room=room,
            user=self.owner,
            role=ChatRoomMember.ROLE_OWNER,
        )
        ChatRoomMember.objects.create(
            room=room,
            user=self.friend,
            role=ChatRoomMember.ROLE_MEMBER,
        )

        self.client.force_authenticate(user=self.friend)
        response = self.client.delete(f"/api/chat/groups/{room.id}/delete/")

        self.assertEqual(response.status_code, 403)
        room.refresh_from_db()
        self.assertIsNone(room.archived_at)
