import itertools
import random
from collections import Counter

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


RANKS = "23456789TJQKA"
SUITS = "cdhs"
PHASES = ("preflop", "flop", "turn", "river", "showdown", "completed")
STARTING_CHIPS = 1000
ANTE = 10
RAISE_SIZE = 20


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
    player_one_chips = models.IntegerField(default=STARTING_CHIPS)
    player_two_chips = models.IntegerField(default=STARTING_CHIPS)
    pot = models.IntegerField(default=0)
    current_bet = models.IntegerField(default=0)
    player_one_bet = models.IntegerField(default=0)
    player_two_bet = models.IntegerField(default=0)
    current_turn = models.IntegerField(default=1)
    dealer = models.IntegerField(default=1)
    phase = models.CharField(max_length=16, default="preflop")
    last_action = models.CharField(max_length=64, blank=True, default="")
    actions_since_raise = models.IntegerField(default=0)
    winner = models.IntegerField(null=True, blank=True)
    winning_label = models.CharField(max_length=64, blank=True, default="")
    is_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def piece_for_user(self, user):
        if user == self.player_one:
            return 1
        if self.player_two and user == self.player_two:
            return 2
        return None

    def ensure_dealt(self):
        if self.player_one_cards:
            return
        deck = new_deck()
        self.player_one_cards = [deck.pop(), deck.pop()]
        self.player_two_cards = [deck.pop(), deck.pop()]
        self.deck = deck
        self.player_one_chips = STARTING_CHIPS - ANTE
        self.player_two_chips = STARTING_CHIPS - ANTE if self.player_two else STARTING_CHIPS
        self.pot = ANTE * 2 if self.player_two else ANTE
        self.current_turn = random.choice([1, 2]) if self.player_two else 1
        self.save()

    def legal_actions_for(self, user):
        player = self.piece_for_user(user)
        if self.is_completed or player != self.current_turn or not self.player_two:
            return []
        bet = self.player_one_bet if player == 1 else self.player_two_bet
        actions = ["fold"]
        actions.append("check" if bet == self.current_bet else "call")
        if self._chips(player) >= (self.current_bet - bet + RAISE_SIZE):
            actions.append("raise")
        return actions

    def apply_action(self, action, user):
        player = self.piece_for_user(user)
        if player is None:
            raise ValidationError("You are not a participant in this game.")
        if self.is_completed:
            raise ValidationError("Hand is already over.")
        if not self.player_two:
            raise ValidationError("Waiting for another player.")
        if player != self.current_turn:
            raise ValidationError("It is not your turn.")

        action = str(action or "").lower()
        if action == "fold":
            self._award(2 if player == 1 else 1, "Fold")
            self.last_action = f"Player {player} folded"
            self.save()
            return
        if action == "check":
            if self._bet(player) != self.current_bet:
                raise ValidationError("Call is required.")
            self.actions_since_raise += 1
            self.last_action = f"Player {player} checked"
        elif action == "call":
            diff = self.current_bet - self._bet(player)
            if diff <= 0:
                raise ValidationError("Check is available.")
            self._charge(player, diff)
            self.actions_since_raise += 1
            self.last_action = f"Player {player} called"
        elif action == "raise":
            diff = self.current_bet - self._bet(player) + RAISE_SIZE
            self._charge(player, diff)
            self.current_bet += RAISE_SIZE
            self.actions_since_raise = 1
            self.last_action = f"Player {player} raised"
        else:
            raise ValidationError("Unknown poker action.")

        if self.player_one_bet == self.player_two_bet and self.actions_since_raise >= 2:
            self._advance_phase()
        else:
            self.current_turn = 2 if player == 1 else 1
        self.save()

    def _chips(self, player):
        return self.player_one_chips if player == 1 else self.player_two_chips

    def _bet(self, player):
        return self.player_one_bet if player == 1 else self.player_two_bet

    def _charge(self, player, amount):
        amount = max(0, min(int(amount), self._chips(player)))
        if player == 1:
            self.player_one_chips -= amount
            self.player_one_bet += amount
        else:
            self.player_two_chips -= amount
            self.player_two_bet += amount
        self.pot += amount

    def _advance_phase(self):
        self.player_one_bet = 0
        self.player_two_bet = 0
        self.current_bet = 0
        self.actions_since_raise = 0
        self.current_turn = 2 if self.dealer == 1 else 1
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

    def apply_ai_action(self):
        if not self.is_ai_game or self.current_turn != 2 or self.is_completed:
            return
        bet = self.player_two_bet
        if bet < self.current_bet:
            action = "call"
        else:
            action = random.choice(["check", "check", "raise"])
        self.apply_action(action, self.player_two)

    def __str__(self):
        p1 = getattr(self.player_one, "first_name", "?") if self.player_one else "?"
        p2 = getattr(self.player_two, "first_name", "AI") if self.player_two else "Waiting"
        return f"Poker: {p1} vs {p2}"
