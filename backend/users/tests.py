from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient


@override_settings(
    DEMO_MODE=True,
    DEMO_PLAYER1_EMAIL="guest1@example.com",
    DEMO_PLAYER2_EMAIL="guest2@example.com",
    DEMO_PLAYER1_FIRST_NAME="Guest",
    DEMO_PLAYER2_FIRST_NAME="Guest",
    DEMO_PLAYER1_LAST_NAME="One",
    DEMO_PLAYER2_LAST_NAME="Two",
)
class DemoGuestLoginTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.User = get_user_model()

    def post_guest(self):
        return self.client.post(reverse("demo_login_guest"))

    def test_guest_login_uses_player1_when_available(self):
        response = self.post_guest()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["guestRole"], "player1")
        self.assertTrue(response.data["access"])
        self.assertTrue(response.data["refresh"])

    def test_guest_login_uses_player2_when_player1_online(self):
        self.User.objects.create_user(
            email="guest1@example.com",
            password="x",
            first_name="Guest",
            last_name="One",
            status="online",
        )

        response = self.post_guest()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["guestRole"], "player2")

    def test_guest_login_rejects_when_both_slots_online(self):
        self.User.objects.create_user(
            email="guest1@example.com",
            password="x",
            first_name="Guest",
            last_name="One",
            status="online",
        )
        self.User.objects.create_user(
            email="guest2@example.com",
            password="x",
            first_name="Guest",
            last_name="Two",
            status="online",
        )

        response = self.post_guest()

        self.assertEqual(response.status_code, 409)
