from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from friends.models import Friendship

from .consumers import _prepare_game_for_realtime
from .models import PokerGame, PokerTournament, PokerTournamentRegistration, evaluate_hand
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

    def test_deal_posts_heads_up_blinds(self):
        p1 = User.objects.create_user(email="blind-one@example.com", password="pass")
        p2 = User.objects.create_user(email="blind-two@example.com", password="pass")
        game = PokerGame.objects.create(player_one=p1, player_two=p2, dealer=1)

        game.ensure_dealt()

        self.assertEqual(game.player_one_bet, 10)
        self.assertEqual(game.player_two_bet, 20)
        self.assertEqual(game.current_bet, 20)
        self.assertEqual(game.pot, 30)
        self.assertEqual(game.current_turn, 1)

    def test_next_hand_rotates_dealer_and_keeps_stacks(self):
        p1 = User.objects.create_user(email="next-one@example.com", password="pass")
        p2 = User.objects.create_user(email="next-two@example.com", password="pass")
        game = PokerGame.objects.create(
            player_one=p1,
            player_two=p2,
            dealer=1,
            is_completed=True,
            phase="completed",
            player_one_chips=1200,
            player_two_chips=800,
            winner=1,
        )

        game.start_next_hand(p1)

        self.assertEqual(game.hand_number, 2)
        self.assertEqual(game.dealer, 2)
        self.assertEqual(len(game.player_one_cards), 2)
        self.assertEqual(len(game.player_two_cards), 2)
        self.assertEqual(game.player_one_chips, 1180)
        self.assertEqual(game.player_two_chips, 790)
        self.assertEqual(game.current_turn, 2)
        self.assertFalse(game.is_completed)

    def test_realtime_prepare_resolves_ai_first_action_before_timer(self):
        p1 = User.objects.create_user(email="ai-first-human@example.com", password="pass")
        ai = User.objects.create_user(email="ai-first-bot@example.com", password="pass", first_name="AI")
        game = PokerGame.objects.create(
            player_one=p1,
            player_two=ai,
            is_ai_game=True,
            dealer=2,
        )
        game.ensure_dealt()

        self.assertEqual(game.current_turn, 2)

        _prepare_game_for_realtime(game)

        self.assertNotEqual(game.current_turn, 2)
        self.assertIsNotNone(game.current_turn_deadline_at())

    def test_custom_raise_and_invalid_raise_are_server_enforced(self):
        p1 = User.objects.create_user(email="raise-one@example.com", password="pass")
        p2 = User.objects.create_user(email="raise-two@example.com", password="pass")
        game = PokerGame.objects.create(player_one=p1, player_two=p2, dealer=1)
        game.ensure_dealt()

        with self.assertRaisesMessage(ValidationError, "Raise must be at least 40."):
            game.apply_action("raise", p1, 30)

        game.apply_action("raise", p1, 80)

        self.assertEqual(game.current_bet, 80)
        self.assertEqual(game.player_one_bet, 80)
        self.assertEqual(game.player_one_chips, 920)
        self.assertEqual(game.pot, 100)

    def test_short_all_in_refunds_uncalled_overage_before_showdown(self):
        p1 = User.objects.create_user(email="short-one@example.com", password="pass")
        p2 = User.objects.create_user(email="short-two@example.com", password="pass")
        game = PokerGame.objects.create(
            player_one=p1,
            player_two=p2,
            dealer=1,
            deck=["2c", "3c", "4c", "5c", "6c", "7c", "8c", "9c", "Tc"],
            player_one_cards=["Ah", "Ad"],
            player_two_cards=["Kc", "Kd"],
            player_one_chips=0,
            player_two_chips=900,
            player_one_bet=100,
            player_two_bet=500,
            current_bet=500,
            pot=600,
            phase="preflop",
        )

        game._advance_phase()

        self.assertEqual(game.pot, 0)
        self.assertEqual(game.player_two_chips, 1400)
        self.assertTrue(game.is_completed)

    def test_timeout_auto_folds_player_facing_bet(self):
        p1 = User.objects.create_user(email="timeout-one@example.com", password="pass")
        p2 = User.objects.create_user(email="timeout-two@example.com", password="pass")
        game = PokerGame.objects.create(
            player_one=p1,
            player_two=p2,
            player_one_chips=990,
            player_two_chips=980,
            player_one_bet=10,
            player_two_bet=20,
            current_bet=20,
            pot=30,
            current_turn=1,
            turn_timer_seconds=15,
            current_turn_started_at=timezone.now() - timedelta(seconds=20),
        )

        changed = game.enforce_turn_timeout()

        self.assertTrue(changed)
        self.assertTrue(game.is_completed)
        self.assertEqual(game.winner, 2)
        self.assertEqual(game.player_two_chips, 1010)
        self.assertIsNone(game.current_turn_started_at)

    def test_timeout_auto_checks_when_check_is_available(self):
        p1 = User.objects.create_user(email="timeout-check-one@example.com", password="pass")
        p2 = User.objects.create_user(email="timeout-check-two@example.com", password="pass")
        game = PokerGame.objects.create(
            player_one=p1,
            player_two=p2,
            deck=["2c", "3c", "4c", "5c", "6c"],
            player_one_cards=["Ah", "Ad"],
            player_two_cards=["Kc", "Kd"],
            player_one_chips=980,
            player_two_chips=980,
            player_one_bet=20,
            player_two_bet=20,
            current_bet=20,
            pot=40,
            current_turn=1,
            actions_since_raise=1,
            turn_timer_seconds=15,
            current_turn_started_at=timezone.now() - timedelta(seconds=20),
        )

        changed = game.enforce_turn_timeout()

        self.assertTrue(changed)
        self.assertEqual(game.phase, "flop")
        self.assertEqual(game.last_action, "timeout-check-one@example.com checked (timeout)")
        self.assertIsNotNone(game.current_turn_started_at)

    def test_legacy_action_labels_use_display_names_and_ai(self):
        p1 = User.objects.create_user(email="ai-label@example.com", password="pass", first_name="Julia")
        ai = User.objects.create_user(email="ai-label-bot@example.com", password="pass", first_name="AI")
        game = PokerGame.objects.create(
            player_one=p1,
            player_two=ai,
            is_ai_game=True,
            player_one_cards=["Ah", "Ad"],
            player_two_cards=["Kc", "Kd"],
            deck=["2c", "3d", "4h", "5s", "6c"],
            player_one_chips=980,
            player_two_chips=980,
            player_one_bet=20,
            player_two_bet=20,
            current_bet=20,
            current_turn=1,
        )

        game.apply_action("check", p1)
        self.assertEqual(game.last_action, "Julia checked")

        game.current_turn = 2
        game.save(update_fields=["current_turn"])
        game.apply_ai_action()
        self.assertNotIn("Player 2", game.last_action)

    def test_table_showdown_distributes_side_pots(self):
        users = [
            User.objects.create_user(email=f"sidepot-{idx}@example.com", password="pass", first_name=f"P{idx}")
            for idx in range(1, 4)
        ]
        game = PokerGame.objects.create(
            player_one=users[0],
            player_two=users[1],
            community_cards=["2c", "7d", "9s", "Jc", "3d"],
            pot=700,
            phase="river",
            table_seats=[
                {
                    "seat": 1,
                    "user_id": users[0].id,
                    "name": "P1",
                    "chips": 0,
                    "cards": ["Ah", "Ad"],
                    "bet": 0,
                    "contribution": 100,
                    "folded": False,
                    "all_in": True,
                    "best": None,
                },
                {
                    "seat": 2,
                    "user_id": users[1].id,
                    "name": "P2",
                    "chips": 0,
                    "cards": ["Qh", "Qs"],
                    "bet": 0,
                    "contribution": 300,
                    "folded": False,
                    "all_in": True,
                    "best": None,
                },
                {
                    "seat": 3,
                    "user_id": users[2].id,
                    "name": "P3",
                    "chips": 0,
                    "cards": ["Kh", "Ks"],
                    "bet": 0,
                    "contribution": 300,
                    "folded": False,
                    "all_in": True,
                    "best": None,
                },
            ],
        )

        game._table_showdown()

        seat_one = game._seat_by_number(1)
        seat_two = game._seat_by_number(2)
        seat_three = game._seat_by_number(3)
        self.assertEqual(seat_one["chips"], 300)
        self.assertEqual(seat_two["chips"], 0)
        self.assertEqual(seat_three["chips"], 400)
        self.assertEqual(game.pot, 0)
        self.assertTrue(game.is_completed)

    def test_next_table_hand_rebuilds_deck_before_flop(self):
        users = [
            User.objects.create_user(email=f"next-table-{idx}@example.com", password="pass", first_name=f"P{idx}")
            for idx in range(1, 4)
        ]
        game = PokerGame.objects.create(player_one=users[0], is_ai_game=True)
        game.initialize_table(users)
        game.ensure_dealt()
        game.is_completed = True
        game.phase = "completed"

        game.start_next_hand(users[0])

        self.assertEqual(game.phase, "preflop")
        self.assertGreaterEqual(len(game.deck), 52 - (len(game.table_seats) * 2))
        self.assertTrue(all(len(seat.get("cards", [])) == 2 for seat in game.table_seats))

        for seat in game.table_seats:
            seat["bet"] = game.current_bet
            seat["folded"] = False
            seat["all_in"] = False
        game.actions_since_raise = len(game.table_seats)
        game._advance_table_phase()

        self.assertEqual(game.phase, "flop")
        self.assertEqual(len(game.community_cards), 3)


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

    @patch("poker.views.RedisGameLobbyManager")
    def test_create_multiplayer_returns_lobby_session(self, manager_cls):
        manager = manager_cls.return_value
        manager.ensure_session_key.return_value = "test-session-key"
        self.client.force_authenticate(user=self.p1)
        response = self.client.post("/api/poker/", {"is_ai_game": False}, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["my_seat"], 1)
        self.assertTrue(response.data["lobbyId"])
        self.assertEqual(response.data["sessionKey"], "test-session-key")
        manager.ensure_session_key.assert_called_once()
        manager.add_user_to_session.assert_called_once()

    def test_create_ai_game_can_include_multiple_ai_players(self):
        self.client.force_authenticate(user=self.p1)

        response = self.client.post(
            "/api/poker/",
            {"is_ai_game": True, "ai_player_count": 5},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["my_seat"], 1)
        self.assertEqual(len(response.data["players"]), 6)
        self.assertEqual(
            len([seat for seat in response.data["players"] if seat.get("is_ai")]),
            5,
        )
        current = next(
            seat for seat in response.data["players"]
            if int(seat["seat"]) == int(response.data["current_turn"])
        )
        self.assertFalse(current.get("is_ai"))

    def test_ai_action_response_does_not_depend_on_channel_layer(self):
        self.client.force_authenticate(user=self.p1)
        game = PokerGame.objects.create(player_one=self.p1, is_ai_game=True)
        game.initialize_ai_table(self.p1, 3)
        game.ensure_dealt()
        from .views import _resolve_ai_turn

        _resolve_ai_turn(game)
        action = "call" if "call" in game.legal_actions_for(self.p1) else "check"

        with patch("poker.views.get_channel_layer", side_effect=RuntimeError("Redis down")):
            response = self.client.post(
                f"/api/poker/{game.id}/action/",
                {"action": action},
                format="json",
            )

        self.assertEqual(response.status_code, 200)
        self.assertIn("players", response.data)

    def test_payload_includes_turn_deadline(self):
        game = PokerGame.objects.create(player_one=self.p1, player_two=self.p2)
        game.ensure_dealt()

        payload = poker_payload(game, self.p1)

        self.assertTrue(payload["turn_deadline_at"])
        self.assertTrue(payload["server_now"])

    def test_payload_hides_other_player_cards_before_showdown(self):
        game = PokerGame.objects.create(player_one=self.p1, player_two=self.p2)
        game.ensure_dealt()

        p1_payload = poker_payload(game, self.p1)
        p2_payload = poker_payload(game, self.p2)

        self.assertNotEqual(p1_payload["player_one_cards"], ["??", "??"])
        self.assertEqual(p1_payload["player_two_cards"], ["??", "??"])
        self.assertEqual(p2_payload["player_one_cards"], ["??", "??"])
        self.assertNotEqual(p2_payload["player_two_cards"], ["??", "??"])

    def test_payload_includes_only_requesting_players_current_best_hand(self):
        game = PokerGame.objects.create(player_one=self.p1, player_two=self.p2)
        game.initialize_table([self.p1, self.p2])
        game.ensure_dealt()
        for seat in game.table_seats:
            if seat["user_id"] == self.p1.id:
                seat["cards"] = ["Ah", "Kd"]
            elif seat["user_id"] == self.p2.id:
                seat["cards"] = ["2c", "3d"]
        game.community_cards = []
        game.phase = "preflop"
        game.save(update_fields=["table_seats", "community_cards", "phase"])

        preflop_payload = poker_payload(game, self.p1)
        preflop_me = next(seat for seat in preflop_payload["players"] if seat["user_id"] == self.p1.id)
        preflop_other = next(seat for seat in preflop_payload["players"] if seat["user_id"] == self.p2.id)
        self.assertIsNone(preflop_payload["my_current_best_hand"])
        self.assertIsNone(preflop_me["current_best_hand"])
        self.assertIsNone(preflop_other["current_best_hand"])

        game.community_cards = ["As", "Ad", "7c"]
        game.phase = "flop"
        game.save(update_fields=["community_cards", "phase"])
        flop_payload = poker_payload(game, self.p1)
        flop_me = next(seat for seat in flop_payload["players"] if seat["user_id"] == self.p1.id)
        flop_other = next(seat for seat in flop_payload["players"] if seat["user_id"] == self.p2.id)
        self.assertEqual(flop_payload["my_current_best_hand"], "Three of a kind")
        self.assertEqual(flop_me["current_best_hand"], "Three of a kind")
        self.assertIsNone(flop_other["current_best_hand"])

        game.community_cards = ["As", "Ad", "7c", "Kc"]
        game.phase = "turn"
        game.save(update_fields=["community_cards", "phase"])
        turn_payload = poker_payload(game, self.p1)
        self.assertEqual(turn_payload["my_current_best_hand"], "Full house")

        game.community_cards = ["As", "Ad", "7c", "Kc", "Ac"]
        game.phase = "river"
        game.save(update_fields=["community_cards", "phase"])
        river_payload = poker_payload(game, self.p1)
        river_me = next(seat for seat in river_payload["players"] if seat["user_id"] == self.p1.id)
        river_other = next(seat for seat in river_payload["players"] if seat["user_id"] == self.p2.id)
        self.assertEqual(river_payload["my_current_best_hand"], "Four of a kind")
        self.assertEqual(river_me["current_best_hand"], "Four of a kind")
        self.assertIsNone(river_other["current_best_hand"])

        p2_payload = poker_payload(game, self.p2)
        p2_own_seat = next(seat for seat in p2_payload["players"] if seat["user_id"] == self.p2.id)
        p1_seat_for_p2 = next(seat for seat in p2_payload["players"] if seat["user_id"] == self.p1.id)
        self.assertEqual(p2_payload["my_current_best_hand"], "Three of a kind")
        self.assertEqual(p2_own_seat["current_best_hand"], "Three of a kind")
        self.assertIsNone(p1_seat_for_p2["current_best_hand"])

    def test_host_can_update_table_settings_before_start(self):
        game = PokerGame.objects.create(player_one=self.p1)
        self.client.force_authenticate(user=self.p1)

        response = self.client.patch(
            f"/api/poker/{game.id}/settings/",
            {
                "starting_chips": 2000,
                "small_blind": 20,
                "big_blind": 40,
                "turn_timer_seconds": 60,
                "max_players": 4,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["starting_chips"], 2000)
        self.assertEqual(response.data["small_blind"], 20)
        self.assertEqual(response.data["big_blind"], 40)
        self.assertEqual(response.data["turn_timer_seconds"], 60)
        self.assertEqual(response.data["max_players"], 4)
        self.assertTrue(response.data["can_update_settings"])

    def test_non_host_cannot_update_table_settings(self):
        game = PokerGame.objects.create(player_one=self.p1)
        self.client.force_authenticate(user=self.p2)

        response = self.client.patch(
            f"/api/poker/{game.id}/settings/",
            {"starting_chips": 2000},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Only the table host", response.data["error"])

    def test_initialize_table_supports_nine_players_and_masks_cards(self):
        users = [
            User.objects.create_user(
                email=f"seat-{idx}@example.com",
                password="pass",
                first_name=f"Seat{idx}",
            )
            for idx in range(1, 10)
        ]
        game = PokerGame.objects.create(player_one=users[0])

        game.initialize_table(users)
        game.ensure_dealt()

        self.assertEqual(len(game.table_seats), 9)
        self.assertEqual(len(game.community_cards), 0)
        self.assertEqual(game.table_player_count(), 9)
        payload = poker_payload(game, users[2])
        visible = next(seat for seat in payload["players"] if seat["user_id"] == users[2].id)
        hidden = next(seat for seat in payload["players"] if seat["user_id"] == users[0].id)
        self.assertNotEqual(visible["cards"], ["??", "??"])
        self.assertEqual(hidden["cards"], ["??", "??"])

    def test_initialize_table_rejects_more_than_nine_players(self):
        users = [
            User.objects.create_user(email=f"overflow-{idx}@example.com", password="pass")
            for idx in range(1, 11)
        ]
        game = PokerGame.objects.create(player_one=users[0])

        with self.assertRaisesMessage(ValidationError, "Poker supports up to 9 players."):
            game.initialize_table(users)

    def test_winner_can_show_cards_after_fold_win(self):
        game = PokerGame.objects.create(player_one=self.p1, player_two=self.p2)
        game.initialize_table([self.p1, self.p2])
        game.ensure_dealt()
        winner_cards = list(
            next(seat for seat in game.table_seats if seat["user_id"] == self.p1.id)["cards"]
        )
        game.current_turn = 2
        game.save(update_fields=["current_turn"])
        game.apply_action("fold", self.p2)

        before_show = poker_payload(game, self.p2)
        before_winner = next(seat for seat in before_show["players"] if seat["user_id"] == self.p1.id)
        self.assertEqual(before_winner["cards"], ["??", "??"])

        self.client.force_authenticate(user=self.p1)
        response = self.client.post(
            f"/api/poker/{game.id}/action/",
            {"action": "show_cards"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["shown_cards"], [1])
        response_winner = next(seat for seat in response.data["players"] if seat["user_id"] == self.p1.id)
        self.assertEqual(response_winner["cards"], winner_cards)
        game.refresh_from_db()
        other_payload_winner = next(
            seat for seat in poker_payload(game, self.p2)["players"] if seat["user_id"] == self.p1.id
        )
        self.assertEqual(other_payload_winner["cards"], winner_cards)

    def test_show_cards_rejected_after_real_showdown(self):
        game = PokerGame.objects.create(
            player_one=self.p1,
            player_two=self.p2,
            player_one_cards=["Ah", "Ad"],
            player_two_cards=["Kc", "Kd"],
            community_cards=["2h", "7s", "9c", "Td", "3h"],
            pot=100,
            phase="river",
        )
        game._showdown()
        game.save()

        self.client.force_authenticate(user=self.p1)
        response = self.client.post(
            f"/api/poker/{game.id}/action/",
            {"action": "show_cards"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("already revealed", response.data["error"])

    def test_show_cards_rejected_for_non_winner(self):
        game = PokerGame.objects.create(player_one=self.p1, player_two=self.p2)
        game.initialize_table([self.p1, self.p2])
        game.ensure_dealt()
        game.current_turn = 2
        game.save(update_fields=["current_turn"])
        game.apply_action("fold", self.p2)

        self.client.force_authenticate(user=self.p2)
        response = self.client.post(
            f"/api/poker/{game.id}/action/",
            {"action": "show_cards"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Only the hand winner", response.data["error"])

    def test_show_cards_rejected_after_next_hand_started(self):
        game = PokerGame.objects.create(player_one=self.p1, player_two=self.p2)
        game.initialize_table([self.p1, self.p2])
        game.ensure_dealt()
        game.current_turn = 2
        game.save(update_fields=["current_turn"])
        game.apply_action("fold", self.p2)
        game.start_next_hand(self.p1)

        self.client.force_authenticate(user=self.p1)
        response = self.client.post(
            f"/api/poker/{game.id}/action/",
            {"action": "show_cards"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Hand is not over", response.data["error"])


class PokerTournamentApiTests(APITestCase):
    def setUp(self):
        self.creator = User.objects.create_user(
            email="tour-creator@example.com",
            password="pass",
            first_name="Creator",
        )
        self.friend = User.objects.create_user(
            email="tour-friend@example.com",
            password="pass",
            first_name="Friend",
        )
        self.other = User.objects.create_user(
            email="tour-other@example.com",
            password="pass",
            first_name="Other",
        )
        Friendship.objects.create(from_user=self.creator, to_user=self.friend, is_accepted=True)

    def _payload(self, **overrides):
        data = {
            "title": "Friday Night Hold'em",
            "scheduled_start": (timezone.now() + timedelta(hours=1)).isoformat(),
            "max_players": 2,
            "starting_chips": 1000,
            "small_blind": 10,
            "big_blind": 20,
            "turn_timer_seconds": 45,
        }
        data.update(overrides)
        return data

    def test_creator_can_create_and_friend_can_see_tournament(self):
        self.client.force_authenticate(user=self.creator)
        response = self.client.post("/api/poker/tournaments/", self._payload(), format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["registered_count"], 1)
        self.assertTrue(response.data["is_creator"])

        self.client.force_authenticate(user=self.friend)
        list_response = self.client.get("/api/poker/tournaments/")

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.data["results"]), 1)
        self.assertEqual(list_response.data["results"][0]["title"], "Friday Night Hold'em")

    def test_non_friend_cannot_see_or_register(self):
        tournament = PokerTournament.objects.create(
            creator=self.creator,
            title="Private table",
            scheduled_start=timezone.now() + timedelta(hours=1),
            max_players=2,
        )
        PokerTournamentRegistration.objects.create(tournament=tournament, user=self.creator)

        self.client.force_authenticate(user=self.other)
        list_response = self.client.get("/api/poker/tournaments/")
        register_response = self.client.post(f"/api/poker/tournaments/{tournament.id}/register/")

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.data["results"], [])
        self.assertEqual(register_response.status_code, 404)

    def test_registration_auto_closes_when_full(self):
        self.client.force_authenticate(user=self.creator)
        create_response = self.client.post("/api/poker/tournaments/", self._payload(), format="json")
        tournament_id = create_response.data["id"]

        self.client.force_authenticate(user=self.friend)
        register_response = self.client.post(f"/api/poker/tournaments/{tournament_id}/register/")

        self.assertEqual(register_response.status_code, 200)
        self.assertEqual(register_response.data["registered_count"], 2)
        self.assertEqual(register_response.data["status"], PokerTournament.STATUS_CLOSED)

    def test_creator_can_remove_registration_and_reopen(self):
        tournament = PokerTournament.objects.create(
            creator=self.creator,
            title="Manage roster",
            scheduled_start=timezone.now() + timedelta(hours=1),
            max_players=2,
            status=PokerTournament.STATUS_CLOSED,
        )
        PokerTournamentRegistration.objects.create(tournament=tournament, user=self.creator)
        registration = PokerTournamentRegistration.objects.create(tournament=tournament, user=self.friend)

        self.client.force_authenticate(user=self.creator)
        response = self.client.post(
            f"/api/poker/tournaments/{tournament.id}/registrations/{registration.id}/remove/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], PokerTournament.STATUS_OPEN)
        self.assertEqual(response.data["registered_count"], 1)

    def test_start_creates_multiplayer_poker_table_after_scheduled_time(self):
        tournament = PokerTournament.objects.create(
            creator=self.creator,
            title="Startable",
            scheduled_start=timezone.now() - timedelta(minutes=1),
            max_players=2,
            status=PokerTournament.STATUS_CLOSED,
        )
        PokerTournamentRegistration.objects.create(tournament=tournament, user=self.creator)
        PokerTournamentRegistration.objects.create(tournament=tournament, user=self.friend)

        self.client.force_authenticate(user=self.creator)
        response = self.client.post(f"/api/poker/tournaments/{tournament.id}/start/")

        self.assertEqual(response.status_code, 200)
        game = PokerGame.objects.get(pk=response.data["gameId"])
        tournament.refresh_from_db()
        self.assertEqual(tournament.status, PokerTournament.STATUS_IN_PROGRESS)
        self.assertEqual(game.table_player_count(), 2)
        self.assertEqual(len(game.table_seats), 2)
        self.assertEqual(len(game.table_seats[0]["cards"]), 2)

    def test_start_before_scheduled_time_is_rejected(self):
        tournament = PokerTournament.objects.create(
            creator=self.creator,
            title="Too early",
            scheduled_start=timezone.now() + timedelta(hours=1),
            max_players=2,
            status=PokerTournament.STATUS_CLOSED,
        )
        PokerTournamentRegistration.objects.create(tournament=tournament, user=self.creator)
        PokerTournamentRegistration.objects.create(tournament=tournament, user=self.friend)

        self.client.force_authenticate(user=self.creator)
        response = self.client.post(f"/api/poker/tournaments/{tournament.id}/start/")

        self.assertEqual(response.status_code, 400)
        self.assertIn("scheduled time", response.data["error"])
