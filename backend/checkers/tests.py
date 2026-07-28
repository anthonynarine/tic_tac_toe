from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APITestCase

from .models import CheckersGame, legal_moves_for


User = get_user_model()


class CheckersRulesTests(TestCase):
    def setUp(self):
        self.p1 = User.objects.create_user(
            email="p1@example.com",
            password="pass",
            first_name="P1",
            last_name="User",
        )
        self.p2 = User.objects.create_user(
            email="p2@example.com",
            password="pass",
            first_name="P2",
            last_name="User",
        )

    def test_initial_board_has_legal_moves_for_player_one(self):
        game = CheckersGame.objects.create(player_one=self.p1, player_two=self.p2)
        self.assertTrue(legal_moves_for(game.board, 1))

    def test_mandatory_capture_rejects_quiet_move(self):
        cells = ["0"] * 64
        cells[5 * 8 + 0] = "1"
        cells[4 * 8 + 1] = "2"
        cells[5 * 8 + 4] = "1"
        game = CheckersGame.objects.create(
            player_one=self.p1,
            player_two=self.p2,
            board="".join(cells),
            current_turn=1,
        )

        with self.assertRaises(ValidationError):
            game.apply_move(5 * 8 + 4, 4 * 8 + 3, self.p1)

        game.apply_move(5 * 8 + 0, 3 * 8 + 2, self.p1)
        self.assertEqual(game.board[4 * 8 + 1], "0")


class CheckersApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="api@example.com",
            password="pass",
            first_name="Api",
            last_name="User",
        )

    def test_create_multiplayer_returns_lobby_session(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post("/api/checkers/", {"is_ai_game": False}, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["my_piece"], 1)
        self.assertTrue(response.data["lobbyId"])
        self.assertTrue(response.data["sessionKey"])
