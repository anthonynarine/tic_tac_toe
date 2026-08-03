import itertools
import random
from collections import Counter
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


RANKS = "23456789TJQKA"
SUITS = "cdhs"
PHASES = ("preflop", "flop", "turn", "river", "showdown", "completed")
STARTING_CHIPS = 1000
SMALL_BLIND = 10
BIG_BLIND = 20
MIN_RAISE = 20
MAX_PLAYERS = 9
MIN_STARTING_CHIPS = 500
MAX_STARTING_CHIPS = 10000
MIN_TURN_TIMER_SECONDS = 15
MAX_TURN_TIMER_SECONDS = 120


def new_deck():
    deck = [f"{rank}{suit}" for rank in RANKS for suit in SUITS]
    random.shuffle(deck)
    return deck


def _rank_value(card):
    return RANKS.index(card[0]) + 2


def _straight_high(values):
    unique = sorted(set(values), reverse=True)
    if 14 in unique:
        unique.append(1)
    for i in range(len(unique) - 4):
        run = unique[i:i + 5]
        if run[0] - run[4] == 4 and len(set(run)) == 5:
            return 5 if run[0] == 5 else run[0]
    return None


def _evaluate_five(cards):
    values = sorted((_rank_value(card) for card in cards), reverse=True)
    suits = [card[1] for card in cards]
    counts = Counter(values)
    groups = sorted(counts.items(), key=lambda item: (item[1], item[0]), reverse=True)
    flush = len(set(suits)) == 1
    straight = _straight_high(values)

    if straight and flush:
        return (8, [straight], "Straight flush")
    if groups[0][1] == 4:
        quad = groups[0][0]
        kicker = max(v for v in values if v != quad)
        return (7, [quad, kicker], "Four of a kind")
    if groups[0][1] == 3 and groups[1][1] == 2:
        return (6, [groups[0][0], groups[1][0]], "Full house")
    if flush:
        return (5, values, "Flush")
    if straight:
        return (4, [straight], "Straight")
    if groups[0][1] == 3:
        trips = groups[0][0]
        kickers = sorted([v for v in values if v != trips], reverse=True)
        return (3, [trips] + kickers, "Three of a kind")
    if groups[0][1] == 2 and groups[1][1] == 2:
        pairs = sorted([g[0] for g in groups if g[1] == 2], reverse=True)
        kicker = max(v for v in values if v not in pairs)
        return (2, pairs + [kicker], "Two pair")
    if groups[0][1] == 2:
        pair = groups[0][0]
        kickers = sorted([v for v in values if v != pair], reverse=True)
        return (1, [pair] + kickers, "Pair")
    return (0, values, "High card")


def evaluate_hand(cards):
    best = None
    for combo in itertools.combinations(cards, 5):
        score = _evaluate_five(combo)
        if best is None or (score[0], score[1]) > (best[0], best[1]):
            best = score
    return {"rank": best[0], "kickers": best[1], "label": best[2]}


class PokerGame(models.Model):
    player_one = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="poker_games_as_one",
    )
    player_two = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="poker_games_as_two",
        null=True,
        blank=True,
    )
    is_ai_game = models.BooleanField(default=False)
    deck = models.JSONField(default=list)
    community_cards = models.JSONField(default=list)
    player_one_cards = models.JSONField(default=list)
    player_two_cards = models.JSONField(default=list)
    table_seats = models.JSONField(default=list)
    starting_chips = models.IntegerField(default=STARTING_CHIPS)
    small_blind = models.IntegerField(default=SMALL_BLIND)
    big_blind = models.IntegerField(default=BIG_BLIND)
    turn_timer_seconds = models.IntegerField(default=45)
    max_players = models.IntegerField(default=MAX_PLAYERS)
    player_one_chips = models.IntegerField(default=STARTING_CHIPS)
    player_two_chips = models.IntegerField(default=STARTING_CHIPS)
    pot = models.IntegerField(default=0)
    current_bet = models.IntegerField(default=0)
    player_one_bet = models.IntegerField(default=0)
    player_two_bet = models.IntegerField(default=0)
    current_turn = models.IntegerField(default=1)
    current_turn_started_at = models.DateTimeField(null=True, blank=True)
    dealer = models.IntegerField(default=1)
    hand_number = models.IntegerField(default=1)
    phase = models.CharField(max_length=16, default="preflop")
    last_action = models.CharField(max_length=64, blank=True, default="")
    actions_since_raise = models.IntegerField(default=0)
    winner = models.IntegerField(null=True, blank=True)
    winning_label = models.CharField(max_length=64, blank=True, default="")
    shown_cards = models.JSONField(default=list)
    is_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def piece_for_user(self, user):
        if self.table_seats:
            for seat in self.table_seats:
                if str(seat.get("user_id")) == str(getattr(user, "id", None)):
                    return int(seat["seat"])
            return None
        if user == self.player_one:
            return 1
        if self.player_two and user == self.player_two:
            return 2
        return None

    def initialize_table(self, users):
        if self.table_seats:
            return
        clean_users = []
        seen = set()
        for user in users:
            if not user or getattr(user, "id", None) in seen:
                continue
            seen.add(user.id)
            clean_users.append(user)
        if len(clean_users) < 2:
            raise ValidationError("Poker needs at least 2 players.")
        if len(clean_users) > self.max_players:
            raise ValidationError(f"Poker supports up to {self.max_players} players.")

        self.table_seats = [
            {
                "seat": idx + 1,
                "user_id": user.id,
                "name": user.first_name or user.email,
                "chips": self.starting_chips,
                "cards": [],
                "bet": 0,
                "contribution": 0,
                "folded": False,
                "all_in": False,
                "best": None,
            }
            for idx, user in enumerate(clean_users)
        ]
        self.player_one = clean_users[0]
        self.player_two = clean_users[1]
        self.dealer = random.choice([seat["seat"] for seat in self.table_seats])
        self.save()

    def initialize_ai_table(self, user, ai_count=1):
        if self.table_seats:
            return
        try:
            ai_count = int(ai_count)
        except (TypeError, ValueError):
            ai_count = 1
        ai_count = max(1, min(ai_count, self.max_players - 1))
        seats = [
            {
                "seat": 1,
                "user_id": user.id,
                "name": user.first_name or user.email,
                "chips": self.starting_chips,
                "cards": [],
                "bet": 0,
                "contribution": 0,
                "folded": False,
                "all_in": False,
                "best": None,
                "is_ai": False,
            }
        ]
        seats.extend(
            {
                "seat": idx + 2,
                "user_id": None,
                "name": f"AI {idx + 1}",
                "chips": self.starting_chips,
                "cards": [],
                "bet": 0,
                "contribution": 0,
                "folded": False,
                "all_in": False,
                "best": None,
                "is_ai": True,
            }
            for idx in range(ai_count)
        )
        self.table_seats = seats
        self.player_one = user
        self.dealer = random.choice([seat["seat"] for seat in self.table_seats])
        self.save()

    def has_open_seat(self):
        return len(self.table_seats or []) < self.max_players

    def update_table_settings(self, user, settings_data):
        if int(getattr(user, "id", 0)) != int(self.player_one_id):
            raise ValidationError("Only the table host can edit poker settings.")
        if self.table_seats or self.player_one_cards or self.player_two_cards:
            raise ValidationError("Poker settings are locked after the table starts.")

        next_starting_chips = int(settings_data.get("starting_chips", self.starting_chips))
        next_small_blind = int(settings_data.get("small_blind", self.small_blind))
        next_big_blind = int(settings_data.get("big_blind", self.big_blind))
        next_turn_timer_seconds = int(settings_data.get("turn_timer_seconds", self.turn_timer_seconds))
        next_max_players = int(settings_data.get("max_players", self.max_players))

        if next_starting_chips < MIN_STARTING_CHIPS or next_starting_chips > MAX_STARTING_CHIPS:
            raise ValidationError(f"Starting chips must be between {MIN_STARTING_CHIPS} and {MAX_STARTING_CHIPS}.")
        if next_small_blind < 5:
            raise ValidationError("Small blind must be at least 5.")
        if next_big_blind < next_small_blind * 2:
            raise ValidationError("Big blind must be at least double the small blind.")
        if next_big_blind > next_starting_chips // 5:
            raise ValidationError("Big blind is too high for the starting stack.")
        if next_turn_timer_seconds < MIN_TURN_TIMER_SECONDS or next_turn_timer_seconds > MAX_TURN_TIMER_SECONDS:
            raise ValidationError(
                f"Turn timer must be between {MIN_TURN_TIMER_SECONDS} and {MAX_TURN_TIMER_SECONDS} seconds."
            )
        if next_max_players < 2 or next_max_players > MAX_PLAYERS:
            raise ValidationError(f"Max players must be between 2 and {MAX_PLAYERS}.")

        self.starting_chips = next_starting_chips
        self.small_blind = next_small_blind
        self.big_blind = next_big_blind
        self.turn_timer_seconds = next_turn_timer_seconds
        self.max_players = next_max_players
        self.save(update_fields=[
            "starting_chips",
            "small_blind",
            "big_blind",
            "turn_timer_seconds",
            "max_players",
            "updated_at",
        ])

    def table_player_count(self):
        if self.table_seats:
            return len(self.table_seats)
        return int(bool(self.player_one_id)) + int(bool(self.player_two_id))

    def current_turn_deadline_at(self):
        if not self.current_turn_started_at or self.is_completed:
            return None
        return self.current_turn_started_at + timedelta(seconds=self.turn_timer_seconds)

    def refresh_turn_timer(self):
        self.current_turn_started_at = timezone.now() if self._current_turn_can_act() else None

    def _current_turn_can_act(self):
        if self.is_completed:
            return False
        if self.table_seats:
            seat = self._seat_by_number(self.current_turn)
            return bool(
                seat
                and not seat.get("folded")
                and not seat.get("all_in")
                and int(seat.get("chips", 0)) > 0
            )
        if not self.player_two:
            return False
        return self.current_turn in (1, 2) and self._chips(self.current_turn) > 0

    def _save_after_action(self):
        self.refresh_turn_timer()
        self.save()

    def completed_by_showdown(self):
        return bool(self.is_completed and self.winning_label not in {"Fold", "Timeout"})

    def show_cards(self, user):
        seat_no = self.piece_for_user(user)
        if seat_no is None:
            raise ValidationError("You are not a participant in this game.")
        if not self.is_completed or self.phase != "completed":
            raise ValidationError("Hand is not over.")
        if self.completed_by_showdown():
            raise ValidationError("Cards are already revealed after showdown.")
        if self.winning_label != "Fold":
            raise ValidationError("Cards can only be shown after winning by fold.")
        if self.winner in (None, 0) or int(self.winner) != int(seat_no):
            raise ValidationError("Only the hand winner can show cards.")

        if self.table_seats:
            seat = self._seat_by_number(seat_no)
            if not seat or not seat.get("cards") or seat.get("is_ai"):
                raise ValidationError("Only a human winner can show cards.")
            player_name = seat.get("name") or "Player"
        else:
            cards = self.player_one_cards if int(seat_no) == 1 else self.player_two_cards
            if not cards:
                raise ValidationError("No cards are available to show.")
            player_name = self._legacy_player_name(seat_no)

        shown = {int(seat) for seat in self.shown_cards or []}
        shown.add(int(seat_no))
        self.shown_cards = sorted(shown)
        self.last_action = f"{player_name} showed cards"
        self.save(update_fields=["shown_cards", "last_action", "updated_at"])

    def enforce_turn_timeout(self):
        deadline = self.current_turn_deadline_at()
        if not deadline or timezone.now() < deadline:
            return False
        if self.table_seats:
            return self._apply_table_timeout()
        return self._apply_legacy_timeout()

    def ensure_dealt(self):
        if self.table_seats:
            self._ensure_table_dealt()
            return
        if self.player_one_cards:
            return
        if not self.player_two:
            self.save()
            return
        deck = new_deck()
        self.player_one_cards = [deck.pop(), deck.pop()]
        self.player_two_cards = [deck.pop(), deck.pop()]
        self.deck = deck
        self._post_blinds()
        self.refresh_turn_timer()
        self.save()

    def _ensure_table_dealt(self):
        if any(seat.get("cards") for seat in self.table_seats):
            return
        seated = [seat for seat in self.table_seats if int(seat.get("chips", 0)) > 0]
        if len(seated) < 2:
            raise ValidationError("Poker needs at least 2 players with chips.")
        deck = new_deck()
        for seat in self.table_seats:
            seat["cards"] = [deck.pop(), deck.pop()] if seat in seated else []
            seat["bet"] = 0
            seat["contribution"] = 0
            seat["folded"] = False
            seat["all_in"] = False
            seat["best"] = None
        self.deck = deck
        self._post_table_blinds()
        self.refresh_turn_timer()
        self.save()

    def start_next_hand(self, user):
        if self.table_seats:
            self._start_next_table_hand(user)
            return
        if self.piece_for_user(user) is None:
            raise ValidationError("You are not a participant in this game.")
        if not self.is_completed:
            raise ValidationError("Finish the current hand first.")
        if not self.player_two:
            raise ValidationError("Waiting for another player.")

        if self.player_one_chips <= 0 or self.player_two_chips <= 0:
            self.player_one_chips = self.starting_chips
            self.player_two_chips = self.starting_chips

        self.dealer = 2 if self.dealer == 1 else 1
        self.hand_number += 1
        self.deck = []
        self.community_cards = []
        self.player_one_cards = []
        self.player_two_cards = []
        self.pot = 0
        self.current_bet = 0
        self.player_one_bet = 0
        self.player_two_bet = 0
        self.phase = "preflop"
        self.last_action = ""
        self.actions_since_raise = 0
        self.winner = None
        self.winning_label = ""
        self.shown_cards = []
        self.is_completed = False
        for seat in self.table_seats:
            seat["cards"] = []
            seat["bet"] = 0
            seat["contribution"] = 0
            seat["folded"] = False
            seat["all_in"] = False
            seat["best"] = None
        self.ensure_dealt()

    def _start_next_table_hand(self, user):
        if self.piece_for_user(user) is None:
            raise ValidationError("You are not a participant in this game.")
        if not self.is_completed:
            raise ValidationError("Finish the current hand first.")

        if len([seat for seat in self.table_seats if int(seat.get("chips", 0)) > 0]) < 2:
            for seat in self.table_seats:
                seat["chips"] = self.starting_chips

        active_seats = [seat["seat"] for seat in self.table_seats if int(seat.get("chips", 0)) > 0]
        self.dealer = self._next_occupied_seat(self.dealer, active_seats)
        self.hand_number += 1
        self.deck = []
        self.community_cards = []
        self.pot = 0
        self.current_bet = 0
        self.phase = "preflop"
        self.last_action = ""
        self.actions_since_raise = 0
        self.winner = None
        self.winning_label = ""
        self.shown_cards = []
        self.is_completed = False
        for seat in self.table_seats:
            seat["cards"] = []
            seat["bet"] = 0
            seat["contribution"] = 0
            seat["folded"] = False
            seat["all_in"] = False
            seat["best"] = None
        self.ensure_dealt()

    def _post_blinds(self):
        small_blind_player = self.dealer
        big_blind_player = 2 if self.dealer == 1 else 1
        self._charge(small_blind_player, self.small_blind)
        self._charge(big_blind_player, self.big_blind)
        self.current_bet = max(self.player_one_bet, self.player_two_bet)
        self.current_turn = small_blind_player
        self.actions_since_raise = 0
        self.last_action = "Blinds posted"

    def legal_actions_for(self, user):
        if self.table_seats:
            return self._table_legal_actions_for(user)
        player = self.piece_for_user(user)
        if self.is_completed or player != self.current_turn or not self.player_two:
            return []
        if self._chips(player) <= 0:
            return []
        bet = self.player_one_bet if player == 1 else self.player_two_bet
        actions = ["fold", "all_in"]
        actions.append("check" if bet == self.current_bet else "call")
        if self._chips(player) >= (self.current_bet - bet + MIN_RAISE):
            actions.append("raise")
        return actions

    def _table_legal_actions_for(self, user):
        seat = self._seat_for_user(user)
        if not seat or self.is_completed or int(seat["seat"]) != int(self.current_turn):
            return []
        if seat.get("folded") or seat.get("all_in") or int(seat.get("chips", 0)) <= 0:
            return []
        actions = ["fold", "all_in"]
        actions.append("check" if int(seat.get("bet", 0)) == self.current_bet else "call")
        call_amount = max(0, self.current_bet - int(seat.get("bet", 0)))
        if int(seat.get("chips", 0)) >= call_amount + MIN_RAISE:
            actions.append("raise")
        return actions

    def apply_action(self, action, user, amount=None):
        action = str(action or "").lower()
        if action == "show_cards":
            self.show_cards(user)
            return
        if self.table_seats:
            self._apply_table_action(action, user, amount)
            return
        player = self.piece_for_user(user)
        if player is None:
            raise ValidationError("You are not a participant in this game.")
        if self.is_completed:
            raise ValidationError("Hand is already over.")
        if not self.player_two:
            raise ValidationError("Waiting for another player.")
        if player != self.current_turn:
            raise ValidationError("It is not your turn.")

        player_name = self._legacy_player_name(player)
        if action == "fold":
            self._award(2 if player == 1 else 1, "Fold")
            self.last_action = f"{player_name} folded"
            self._save_after_action()
            return
        if action == "check":
            if self._bet(player) != self.current_bet:
                raise ValidationError("Call is required.")
            self.actions_since_raise += 1
            self.last_action = f"{player_name} checked"
        elif action == "call":
            diff = self.current_bet - self._bet(player)
            if diff <= 0:
                raise ValidationError("Check is available.")
            self._charge(player, diff)
            self.actions_since_raise += 1
            self.last_action = f"{player_name} called"
        elif action == "raise":
            try:
                raise_to = int(amount) if amount is not None else self.current_bet + MIN_RAISE
            except (TypeError, ValueError):
                raise ValidationError("Invalid raise amount.")
            min_raise_to = self.current_bet + MIN_RAISE
            max_raise_to = self._bet(player) + self._chips(player)
            if raise_to < min_raise_to:
                raise ValidationError(f"Raise must be at least {min_raise_to}.")
            if raise_to > max_raise_to:
                raise ValidationError("Raise exceeds your chip stack.")
            self._charge(player, raise_to - self._bet(player))
            self.current_bet = raise_to
            self.actions_since_raise = 1
            self.last_action = f"{player_name} raised to {self.current_bet}"
        elif action == "all_in":
            target = self._bet(player) + self._chips(player)
            self._charge(player, self._chips(player))
            if target > self.current_bet:
                self.current_bet = target
                self.actions_since_raise = 1
            else:
                self.actions_since_raise += 1
            self.last_action = f"{player_name} moved all-in"
        else:
            raise ValidationError("Unknown poker action.")

        if self._betting_round_closed():
            self._advance_phase()
        else:
            self.current_turn = 2 if player == 1 else 1
        self._save_after_action()

    def _apply_table_action(self, action, user, amount=None):
        seat = self._seat_for_user(user)
        if not seat:
            raise ValidationError("You are not a participant in this game.")
        self._apply_table_action_for_seat(seat, action, amount)

    def _apply_table_action_for_seat(self, seat, action, amount=None):
        if self.is_completed:
            raise ValidationError("Hand is already over.")
        if int(seat["seat"]) != int(self.current_turn):
            raise ValidationError("It is not your turn.")

        action = str(action or "").lower()
        seat_no = int(seat["seat"])
        if action == "fold":
            seat["folded"] = True
            self.last_action = f"{seat['name']} folded"
            if self._remaining_live_seats_count() == 1:
                self._award_table(self._remaining_live_seats()[0]["seat"], "Fold")
                self._save_after_action()
                return
        elif action == "check":
            if int(seat.get("bet", 0)) != self.current_bet:
                raise ValidationError("Call is required.")
            self.actions_since_raise += 1
            self.last_action = f"{seat['name']} checked"
        elif action == "call":
            diff = self.current_bet - int(seat.get("bet", 0))
            if diff <= 0:
                raise ValidationError("Check is available.")
            self._charge_table(seat, diff)
            self.actions_since_raise += 1
            self.last_action = f"{seat['name']} called"
        elif action == "raise":
            try:
                raise_to = int(amount) if amount is not None else self.current_bet + MIN_RAISE
            except (TypeError, ValueError):
                raise ValidationError("Invalid raise amount.")
            min_raise_to = self.current_bet + MIN_RAISE
            max_raise_to = int(seat.get("bet", 0)) + int(seat.get("chips", 0))
            if raise_to < min_raise_to:
                raise ValidationError(f"Raise must be at least {min_raise_to}.")
            if raise_to > max_raise_to:
                raise ValidationError("Raise exceeds your chip stack.")
            self._charge_table(seat, raise_to - int(seat.get("bet", 0)))
            self.current_bet = raise_to
            self.actions_since_raise = 1
            self.last_action = f"{seat['name']} raised to {self.current_bet}"
        elif action == "all_in":
            target = int(seat.get("bet", 0)) + int(seat.get("chips", 0))
            self._charge_table(seat, int(seat.get("chips", 0)))
            if target > self.current_bet:
                self.current_bet = target
                self.actions_since_raise = 1
            else:
                self.actions_since_raise += 1
            self.last_action = f"{seat['name']} moved all-in"
        else:
            raise ValidationError("Unknown poker action.")

        if self._table_betting_round_closed():
            self._advance_table_phase()
        else:
            self.current_turn = self._next_action_seat(seat_no)
        self._save_after_action()

    def _apply_legacy_timeout(self):
        if not self._current_turn_can_act():
            self._save_after_action()
            return False
        player = int(self.current_turn)
        player_name = self._legacy_player_name(player)
        if self._bet(player) == self.current_bet:
            self.actions_since_raise += 1
            self.last_action = f"{player_name} checked (timeout)"
            if self._betting_round_closed():
                self._advance_phase()
            else:
                self.current_turn = 2 if player == 1 else 1
        else:
            self._award(2 if player == 1 else 1, "Timeout")
            self.last_action = f"{player_name} folded on timeout"
        self._save_after_action()
        return True

    def _apply_table_timeout(self):
        seat = self._seat_by_number(self.current_turn)
        if not seat or not self._current_turn_can_act():
            self._save_after_action()
            return False
        seat_no = int(seat["seat"])
        if int(seat.get("bet", 0)) == self.current_bet:
            self.actions_since_raise += 1
            self.last_action = f"{seat['name']} checked (timeout)"
        else:
            seat["folded"] = True
            self.last_action = f"{seat['name']} folded on timeout"
            if self._remaining_live_seats_count() == 1:
                self._award_table(self._remaining_live_seats()[0]["seat"], "Timeout")
                self._save_after_action()
                return True

        if self._table_betting_round_closed():
            self._advance_table_phase()
        else:
            self.current_turn = self._next_action_seat(seat_no)
        self._save_after_action()
        return True

    def _chips(self, player):
        return self.player_one_chips if player == 1 else self.player_two_chips

    def _bet(self, player):
        return self.player_one_bet if player == 1 else self.player_two_bet

    def _legacy_player_name(self, player):
        if int(player) == 1:
            if self.player_one:
                return self.player_one.first_name or self.player_one.email or "Player 1"
            return "Player 1"
        if self.is_ai_game:
            return "AI"
        if self.player_two:
            return self.player_two.first_name or self.player_two.email or "Player 2"
        return "Player 2"

    def _charge(self, player, amount):
        amount = max(0, min(int(amount), self._chips(player)))
        if player == 1:
            self.player_one_chips -= amount
            self.player_one_bet += amount
        else:
            self.player_two_chips -= amount
            self.player_two_bet += amount
        self.pot += amount

    def _seat_for_user(self, user):
        user_id = str(getattr(user, "id", None))
        return next((seat for seat in self.table_seats if str(seat.get("user_id")) == user_id), None)

    def _seat_by_number(self, seat_no):
        return next((seat for seat in self.table_seats if int(seat.get("seat")) == int(seat_no)), None)

    def _current_turn_is_ai(self):
        if self.table_seats:
            seat = self._seat_by_number(self.current_turn)
            return bool(seat and seat.get("is_ai"))
        return bool(self.is_ai_game and self.current_turn == 2)

    def _active_table_seats(self):
        return [seat for seat in self.table_seats if int(seat.get("chips", 0)) > 0 or int(seat.get("bet", 0)) > 0]

    def _remaining_live_seats(self):
        return [seat for seat in self.table_seats if not seat.get("folded") and (seat.get("cards") or int(seat.get("bet", 0)) > 0)]

    def _remaining_live_seats_count(self):
        return len(self._remaining_live_seats())

    def _next_occupied_seat(self, seat_no, allowed=None):
        allowed_set = set(allowed or [seat["seat"] for seat in self._active_table_seats()])
        ordered = sorted(allowed_set)
        if not ordered:
            return seat_no
        for candidate in ordered:
            if int(candidate) > int(seat_no):
                return candidate
        return ordered[0]

    def _next_action_seat(self, seat_no):
        candidates = [
            seat["seat"]
            for seat in self.table_seats
            if not seat.get("folded") and not seat.get("all_in") and int(seat.get("chips", 0)) > 0
        ]
        return self._next_occupied_seat(seat_no, candidates)

    def _charge_table(self, seat, amount):
        amount = max(0, min(int(amount), int(seat.get("chips", 0))))
        seat["chips"] = int(seat.get("chips", 0)) - amount
        seat["bet"] = int(seat.get("bet", 0)) + amount
        seat["contribution"] = int(seat.get("contribution", 0)) + amount
        seat["all_in"] = seat["chips"] == 0
        self.pot += amount

    def _post_table_blinds(self):
        live = [seat["seat"] for seat in self._active_table_seats()]
        if len(live) < 2:
            raise ValidationError("Poker needs at least 2 active players.")
        small = self.dealer if len(live) == 2 else self._next_occupied_seat(self.dealer, live)
        big = self._next_occupied_seat(small, live)
        self._charge_table(self._seat_by_number(small), self.small_blind)
        self._charge_table(self._seat_by_number(big), self.big_blind)
        self.current_bet = max(int(seat.get("bet", 0)) for seat in self.table_seats)
        self.current_turn = small if len(live) == 2 else self._next_occupied_seat(big, live)
        self.actions_since_raise = 0
        self.last_action = "Blinds posted"

    def _table_betting_round_closed(self):
        contenders = self._remaining_live_seats()
        if len(contenders) <= 1:
            return True
        actionable = [
            seat for seat in contenders
            if not seat.get("all_in") and int(seat.get("chips", 0)) > 0
        ]
        if not actionable:
            return True
        return all(int(seat.get("bet", 0)) == self.current_bet for seat in actionable) and self.actions_since_raise >= len(actionable)

    def _advance_table_phase(self):
        self._refund_table_uncalled_bet()
        for seat in self.table_seats:
            seat["bet"] = 0
        self.current_bet = 0
        self.actions_since_raise = 0
        if len([s for s in self._remaining_live_seats() if not s.get("all_in") and int(s.get("chips", 0)) > 0]) <= 1:
            while self.phase != "river":
                self._deal_next_street()
            self._table_showdown()
            return
        self.current_turn = self._next_action_seat(self.dealer)
        self._deal_next_street()

    def _refund_table_uncalled_bet(self):
        live_bets = sorted([int(seat.get("bet", 0)) for seat in self._remaining_live_seats() if int(seat.get("bet", 0)) > 0])
        if len(live_bets) < 2:
            return
        matched = live_bets[-2]
        for seat in self.table_seats:
            over = int(seat.get("bet", 0)) - matched
            if over > 0:
                seat["bet"] -= over
                seat["contribution"] = max(0, int(seat.get("contribution", 0)) - over)
                seat["chips"] += over
                self.pot = max(0, self.pot - over)

    def _betting_round_closed(self):
        if self.player_one_chips == 0 or self.player_two_chips == 0:
            return True
        if self.player_one_bet != self.player_two_bet:
            return False
        return self.actions_since_raise >= 2

    def _advance_phase(self):
        self._refund_uncalled_bet()
        self.player_one_bet = 0
        self.player_two_bet = 0
        self.current_bet = 0
        self.actions_since_raise = 0
        self.current_turn = 2 if self.dealer == 1 else 1
        if self.player_one_chips == 0 or self.player_two_chips == 0:
            while self.phase != "river":
                self._deal_next_street()
            self._showdown()
            return
        self._deal_next_street()

    def _refund_uncalled_bet(self):
        if self.player_one_bet == self.player_two_bet:
            return
        if self.player_one_bet > self.player_two_bet:
            refund = self.player_one_bet - self.player_two_bet
            self.player_one_bet -= refund
            self.player_one_chips += refund
        else:
            refund = self.player_two_bet - self.player_one_bet
            self.player_two_bet -= refund
            self.player_two_chips += refund
        self.pot = max(0, self.pot - refund)

    def _deal_next_street(self):
        if self.phase == "preflop":
            self.community_cards.extend([self.deck.pop(), self.deck.pop(), self.deck.pop()])
            self.phase = "flop"
        elif self.phase == "flop":
            self.community_cards.append(self.deck.pop())
            self.phase = "turn"
        elif self.phase == "turn":
            self.community_cards.append(self.deck.pop())
            self.phase = "river"
        elif self.phase == "river":
            self._showdown()

    def _showdown(self):
        if self.table_seats:
            self._table_showdown()
            return
        one = evaluate_hand(self.player_one_cards + self.community_cards)
        two = evaluate_hand(self.player_two_cards + self.community_cards)
        if (one["rank"], one["kickers"]) > (two["rank"], two["kickers"]):
            self._award(1, one["label"])
        elif (two["rank"], two["kickers"]) > (one["rank"], one["kickers"]):
            self._award(2, two["label"])
        else:
            split = self.pot // 2
            self.player_one_chips += split
            self.player_two_chips += self.pot - split
            self.pot = 0
            self.winner = 0
            self.winning_label = "Split pot"
            self.phase = "completed"
            self.is_completed = True
            self.current_turn_started_at = None

    def _table_showdown(self):
        contenders = self._remaining_live_seats()
        if len(contenders) == 1:
            self._award_table(contenders[0]["seat"], "Fold")
            return
        scored = []
        for seat in contenders:
            best = evaluate_hand(list(seat.get("cards", [])) + self.community_cards)
            seat["best"] = best["label"]
            scored.append((best["rank"], best["kickers"], seat))

        payouts = self._calculate_side_pot_payouts(scored)
        for seat_no, amount in payouts.items():
            seat = self._seat_by_number(seat_no)
            seat["chips"] = int(seat.get("chips", 0)) + amount
        self.pot = 0
        winning_seats = [seat_no for seat_no, amount in payouts.items() if amount > 0]
        self.winner = winning_seats[0] if len(winning_seats) == 1 else 0
        scored.sort(key=lambda item: (item[0], item[1]), reverse=True)
        self.winning_label = scored[0][2].get("best") if len(winning_seats) == 1 else "Split pot"
        self.phase = "completed"
        self.is_completed = True
        self.current_turn_started_at = None

    def _calculate_side_pot_payouts(self, scored):
        score_by_seat = {seat["seat"]: (rank, kickers) for rank, kickers, seat in scored}
        live_seats = {seat["seat"] for _, _, seat in scored}
        contributions = {
            seat["seat"]: int(seat.get("contribution", 0))
            for seat in self.table_seats
            if int(seat.get("contribution", 0)) > 0
        }
        payouts = {seat["seat"]: 0 for seat in self.table_seats}
        previous = 0

        for level in sorted(set(contributions.values())):
            contributors = [seat_no for seat_no, amount in contributions.items() if amount >= level]
            pot_amount = (level - previous) * len(contributors)
            eligible = [seat_no for seat_no in contributors if seat_no in live_seats]
            if pot_amount <= 0 or not eligible:
                previous = level
                continue
            best = max(score_by_seat[seat_no] for seat_no in eligible)
            winners = [seat_no for seat_no in eligible if score_by_seat[seat_no] == best]
            share = pot_amount // len(winners)
            remainder = pot_amount % len(winners)
            for idx, seat_no in enumerate(winners):
                payouts[seat_no] += share + (1 if idx < remainder else 0)
            previous = level

        return payouts

    def _award_table(self, seat_no, label):
        seat = self._seat_by_number(seat_no)
        seat["chips"] = int(seat.get("chips", 0)) + self.pot
        self.pot = 0
        self.winner = seat_no
        self.winning_label = label
        self.phase = "completed"
        self.is_completed = True
        self.current_turn_started_at = None

    def _award(self, player, label):
        if player == 1:
            self.player_one_chips += self.pot
        else:
            self.player_two_chips += self.pot
        self.pot = 0
        self.winner = player
        self.winning_label = label
        self.phase = "completed"
        self.is_completed = True
        self.current_turn_started_at = None

    def apply_ai_action(self):
        if not self.is_ai_game or self.is_completed:
            return
        if self.table_seats:
            seat = self._seat_by_number(self.current_turn)
            if not seat or not seat.get("is_ai"):
                return
            bet = int(seat.get("bet", 0))
            chips = int(seat.get("chips", 0))
            if bet < self.current_bet:
                action = "call"
            elif chips <= MIN_RAISE:
                action = "check"
            else:
                action = random.choice(["check", "check", "check", "raise"])
            self._apply_table_action_for_seat(seat, action)
            return
        if self.current_turn != 2:
            return
        bet = self.player_two_bet
        if bet < self.current_bet:
            action = "call"
        elif self.player_two_chips <= MIN_RAISE:
            action = "check"
        else:
            action = random.choice(["check", "check", "check", "raise"])
        self.apply_action(action, self.player_two)

    def __str__(self):
        p1 = getattr(self.player_one, "first_name", "?") if self.player_one else "?"
        p2 = getattr(self.player_two, "first_name", "AI") if self.player_two else "Waiting"
        return f"Poker: {p1} vs {p2}"


class PokerTournament(models.Model):
    STATUS_OPEN = "open"
    STATUS_CLOSED = "closed"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_COMPLETED = "completed"
    STATUS_CANCELLED = "cancelled"

    STATUS_CHOICES = (
        (STATUS_OPEN, "Open"),
        (STATUS_CLOSED, "Closed"),
        (STATUS_IN_PROGRESS, "In progress"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_CANCELLED, "Cancelled"),
    )

    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_poker_tournaments",
    )
    title = models.CharField(max_length=80)
    scheduled_start = models.DateTimeField()
    max_players = models.IntegerField(default=6)
    starting_chips = models.IntegerField(default=STARTING_CHIPS)
    small_blind = models.IntegerField(default=SMALL_BLIND)
    big_blind = models.IntegerField(default=BIG_BLIND)
    turn_timer_seconds = models.IntegerField(default=45)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_OPEN)
    game = models.ForeignKey(
        PokerGame,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="tournaments",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["scheduled_start", "-created_at"]

    def clean(self):
        if self.max_players < 2 or self.max_players > MAX_PLAYERS:
            raise ValidationError(f"Max players must be between 2 and {MAX_PLAYERS}.")
        if self.starting_chips < MIN_STARTING_CHIPS or self.starting_chips > MAX_STARTING_CHIPS:
            raise ValidationError(f"Starting chips must be between {MIN_STARTING_CHIPS} and {MAX_STARTING_CHIPS}.")
        if self.small_blind < 5:
            raise ValidationError("Small blind must be at least 5.")
        if self.big_blind < self.small_blind * 2:
            raise ValidationError("Big blind must be at least double the small blind.")
        if self.big_blind > self.starting_chips // 5:
            raise ValidationError("Big blind is too high for the starting stack.")
        if self.turn_timer_seconds < MIN_TURN_TIMER_SECONDS or self.turn_timer_seconds > MAX_TURN_TIMER_SECONDS:
            raise ValidationError(
                f"Turn timer must be between {MIN_TURN_TIMER_SECONDS} and {MAX_TURN_TIMER_SECONDS} seconds."
            )

    def registered_registrations(self):
        return self.registrations.filter(status=PokerTournamentRegistration.STATUS_REGISTERED)

    def registered_count(self):
        return self.registered_registrations().count()

    def can_register(self):
        return self.status == self.STATUS_OPEN and self.registered_count() < self.max_players

    def sync_registration_status(self):
        if self.status in {self.STATUS_IN_PROGRESS, self.STATUS_COMPLETED, self.STATUS_CANCELLED}:
            return
        self.status = self.STATUS_CLOSED if self.registered_count() >= self.max_players else self.STATUS_OPEN
        self.save(update_fields=["status", "updated_at"])

    def start(self):
        if self.status in {self.STATUS_IN_PROGRESS, self.STATUS_COMPLETED, self.STATUS_CANCELLED}:
            raise ValidationError("Tournament cannot be started from its current status.")
        if timezone.now() < self.scheduled_start:
            raise ValidationError("Tournament cannot start before its scheduled time.")
        registrations = list(
            self.registered_registrations()
            .select_related("user")
            .order_by("created_at", "id")
        )
        if len(registrations) < 2:
            raise ValidationError("Tournament needs at least 2 registered players.")

        users = [registration.user for registration in registrations]
        game = PokerGame.objects.create(
            player_one=self.creator,
            player_two=users[1],
            is_ai_game=False,
            starting_chips=self.starting_chips,
            small_blind=self.small_blind,
            big_blind=self.big_blind,
            turn_timer_seconds=self.turn_timer_seconds,
            max_players=self.max_players,
        )
        ordered_users = [self.creator] + [user for user in users if user.id != self.creator_id]
        game.initialize_table(ordered_users[: self.max_players])
        game.ensure_dealt()

        self.game = game
        self.status = self.STATUS_IN_PROGRESS
        self.save(update_fields=["game", "status", "updated_at"])
        return game

    def __str__(self):
        return self.title


class PokerTournamentRegistration(models.Model):
    STATUS_REGISTERED = "registered"
    STATUS_WITHDRAWN = "withdrawn"
    STATUS_REMOVED = "removed"

    STATUS_CHOICES = (
        (STATUS_REGISTERED, "Registered"),
        (STATUS_WITHDRAWN, "Withdrawn"),
        (STATUS_REMOVED, "Removed"),
    )

    tournament = models.ForeignKey(
        PokerTournament,
        on_delete=models.CASCADE,
        related_name="registrations",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="poker_tournament_registrations",
    )
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_REGISTERED)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("tournament", "user")
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"{self.user_id} -> {self.tournament_id} ({self.status})"
