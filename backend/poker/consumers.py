import threading

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from channels.generic.websocket import JsonWebsocketConsumer
from django.core.exceptions import ValidationError
from django.db import transaction

from utils.shared.shared_utils_game_chat import SharedUtils

from .models import PokerGame
from .serializers import poker_payload

POKER_GROUP = "poker_{game_id}"
_TURN_TIMERS = {}
_TURN_TIMERS_LOCK = threading.Lock()
_NEXT_HAND_TIMERS = {}
_NEXT_HAND_TIMERS_LOCK = threading.Lock()
AUTO_NEXT_HAND_DELAY_SECONDS = 5.0


def _resolve_ai_turn(game):
    guard = 0
    while game.is_ai_game and game.current_turn == 2 and not game.is_completed and guard < 8:
        game.apply_ai_action()
        guard += 1


def _cancel_turn_timer(game_id):
    with _TURN_TIMERS_LOCK:
        timer = _TURN_TIMERS.pop(str(game_id), None)
    if timer:
        timer.cancel()


def _cancel_next_hand_timer(game_id):
    with _NEXT_HAND_TIMERS_LOCK:
        entry = _NEXT_HAND_TIMERS.pop(str(game_id), None)
    if entry:
        entry[1].cancel()


def _schedule_turn_timer(game):
    deadline = game.current_turn_deadline_at()
    game_id = str(game.id)
    _cancel_turn_timer(game_id)
    if not deadline:
        return

    delay = max(0.1, (deadline - timezone_now()).total_seconds())
    started_at = game.current_turn_started_at.isoformat() if game.current_turn_started_at else None
    timer = threading.Timer(delay, _fire_turn_timeout, args=(game_id, started_at))
    timer.daemon = True
    with _TURN_TIMERS_LOCK:
        _TURN_TIMERS[game_id] = timer
    timer.start()


def _schedule_next_hand_timer(game):
    game_id = str(game.id)
    if not game.is_completed or game.is_ai_game:
        _cancel_next_hand_timer(game_id)
        return

    hand_number = int(game.hand_number or 1)
    with _NEXT_HAND_TIMERS_LOCK:
        existing = _NEXT_HAND_TIMERS.get(game_id)
        if existing and existing[0] == hand_number:
            return
        if existing:
            existing[1].cancel()

        timer = threading.Timer(AUTO_NEXT_HAND_DELAY_SECONDS, _fire_auto_next_hand, args=(game_id, hand_number))
        timer.daemon = True
        _NEXT_HAND_TIMERS[game_id] = (hand_number, timer)
        timer.start()


def _schedule_game_timers(game):
    _schedule_turn_timer(game)
    _schedule_next_hand_timer(game)


def timezone_now():
    from django.utils import timezone

    return timezone.now()


def _fire_turn_timeout(game_id, started_at):
    changed = False
    try:
        with transaction.atomic():
            game = PokerGame.objects.select_for_update().get(pk=game_id)
            current_started_at = game.current_turn_started_at.isoformat() if game.current_turn_started_at else None
            if current_started_at != started_at:
                return
            changed = game.enforce_turn_timeout()
            if not changed:
                _schedule_turn_timer(game)
                return
    except PokerGame.DoesNotExist:
        _cancel_turn_timer(game_id)
        return
    if changed:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            POKER_GROUP.format(game_id=game_id),
            {"type": "poker_update", "game_id": game_id},
        )


def _fire_auto_next_hand(game_id, hand_number):
    with _NEXT_HAND_TIMERS_LOCK:
        existing = _NEXT_HAND_TIMERS.get(str(game_id))
        if not existing or existing[0] != int(hand_number):
            return
        _NEXT_HAND_TIMERS.pop(str(game_id), None)

    try:
        with transaction.atomic():
            game = PokerGame.objects.select_for_update().get(pk=game_id)
            if not game.is_completed or int(game.hand_number or 1) != int(hand_number):
                return
            game.start_next_hand(game.player_one)
            _resolve_ai_turn(game)
    except (PokerGame.DoesNotExist, ValidationError):
        return

    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        POKER_GROUP.format(game_id=game_id),
        {"type": "poker_update", "game_id": game_id},
    )


class PokerConsumer(JsonWebsocketConsumer):
    def _group(self):
        return POKER_GROUP.format(game_id=self.game_id)

    def _accept_and_close(self, code):
        self.accept()
        self.close(code=code)

    def connect(self):
        raw_id = self.scope.get("url_route", {}).get("kwargs", {}).get("game_id")
        if not raw_id:
            self._accept_and_close(4002)
            return
        self.game_id = str(raw_id)
        self.user = SharedUtils.authenticate_user(self.scope)
        if not self.user:
            self._accept_and_close(4001)
            return
        try:
            with transaction.atomic():
                game = PokerGame.objects.select_for_update().get(pk=self.game_id)
                if game.enforce_turn_timeout():
                    pass
                elif not game.current_turn_started_at and game._current_turn_can_act():
                    game.refresh_turn_timer()
                    game.save(update_fields=["current_turn_started_at", "updated_at"])
        except PokerGame.DoesNotExist:
            self._accept_and_close(4004)
            return
        if game.piece_for_user(self.user) is None:
            self._accept_and_close(4003)
            return

        async_to_sync(self.channel_layer.group_add)(self._group(), self.channel_name)
        self.accept()
        self._send_state(game)

    def receive_json(self, content, **kwargs):
        msg_type = content.get("type", "")
        if msg_type == "action":
            self._handle_action(content)
        elif msg_type == "next_hand":
            self._handle_next_hand(content)
        elif msg_type == "sync":
            self._handle_sync()
        else:
            self.send_json({"type": "error", "message": "Unknown message type."})

    def _handle_sync(self):
        try:
            with transaction.atomic():
                game = PokerGame.objects.select_for_update().get(pk=self.game_id)
                game.enforce_turn_timeout()
            self._send_state(game)
        except PokerGame.DoesNotExist:
            self.send_json({"type": "error", "message": "Game not found."})

    def _send_state(self, game):
        _schedule_game_timers(game)
        self.send_json({"type": "game_state", "game": poker_payload(game, self.user)})

    def _handle_action(self, content):
        try:
            with transaction.atomic():
                game = PokerGame.objects.select_for_update().get(pk=self.game_id)
                game.apply_action(content.get("action"), self.user, content.get("amount"))
                _resolve_ai_turn(game)
        except PokerGame.DoesNotExist:
            self.send_json({"type": "error", "message": "Game not found."})
            return
        except ValidationError as exc:
            self.send_json({"type": "error", "message": str(exc)})
            return

        async_to_sync(self.channel_layer.group_send)(
            self._group(),
            {"type": "poker_update", "game_id": self.game_id},
        )

    def _handle_next_hand(self, content=None):
        content = content or {}
        try:
            with transaction.atomic():
                game = PokerGame.objects.select_for_update().get(pk=self.game_id)
                game.start_next_hand(self.user)
                _resolve_ai_turn(game)
                _cancel_next_hand_timer(self.game_id)
        except PokerGame.DoesNotExist:
            self.send_json({"type": "error", "message": "Game not found."})
            return
        except ValidationError as exc:
            if content.get("auto"):
                self._handle_sync()
                return
            self.send_json({"type": "error", "message": str(exc)})
            return

        async_to_sync(self.channel_layer.group_send)(
            self._group(),
            {"type": "poker_update", "game_id": self.game_id},
        )

    def poker_update(self, event):
        try:
            with transaction.atomic():
                game = PokerGame.objects.select_for_update().get(pk=event["game_id"])
                game.enforce_turn_timeout()
        except PokerGame.DoesNotExist:
            self.send_json({"type": "error", "message": "Game not found."})
            return
        _schedule_game_timers(game)
        self.send_json({"type": "game_update", "game": poker_payload(game, self.user)})

    def disconnect(self, close_code):
        try:
            async_to_sync(self.channel_layer.group_discard)(self._group(), self.channel_name)
        except Exception:
            pass
