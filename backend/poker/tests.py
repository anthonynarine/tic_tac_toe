from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APITestCase

from .models import PokerGame, evaluate_hand
from .serializers import poker_payload

User = get_user_model()


class PokerRulesTests(TestCase):
    def test_evaluate_detects_flush_over_pair(self):
        hand = evaluate_hand(["Ah", "Th", "8h", "4h", "2h", "Ks", "Kd"])
        self.assertEqual(hand["label"], "Flush")

    def test_showdown_awards_best_hand(self):
        p1 = User.objects.create_user(email="p1poker@example.com", password="pass")
        p2 = User.objects.create_user(email="p2poker@example.com", password="pass")
        game = PokerGame.objects.create(
            player_one=p1,
            player_two=p2,
            player_one_cards=["Ah", "Ad"],
            player_two_cards=["Kc", "Kd"],
            community_cards=["2h", "7s", "9c", "Td", "3h"],
            pot=100,
            phase="river",
            current_turn=1,
        )

        game._showdown()
        game.save()

        self.assertEqual(game.winner, 1)
        self.assertEqual(game.player_one_chips, 1100)
        self.assertTrue(game.is_completed)


class PokerApiTests(APITestCase):
    def setUp(self):
        self.p1 = User.objects.create_user(
            email="api-poker-one@example.com",
            password="pass",
            first_name="One",
        )
        self.p2 = User.objects.create_user(
            email="api-poker-two@example.com",
            password="pass",
            first_name="Two",
        )

    def test_create_multiplayer_returns_lobby_session(self):
        self.client.force_authenticate(user=self.p1)
        response = self.client.post("/api/poker/", {"is_ai_game": False}, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["my_seat"], 1)
        self.assertTrue(response.data["lobbyId"])
        self.assertTrue(response.data["sessionKey"])

    def test_payload_hides_other_player_cards_before_showdown(self):
        game = PokerGame.objects.create(player_one=self.p1, player_two=self.p2)
        game.ensure_dealt()

        p1_payload = poker_payload(game, self.p1)
        p2_payload = poker_payload(game, self.p2)

        self.assertNotEqual(p1_payload["player_one_cards"], ["??", "??"])
        self.assertEqual(p1_payload["player_two_cards"], ["??", "??"])
        self.assertEqual(p2_payload["player_one_cards"], ["??", "??"])
        self.assertNotEqual(p2_payload["player_two_cards"], ["??", "??"])
