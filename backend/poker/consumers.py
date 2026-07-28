from asgiref.sync import async_to_sync
from channels.generic.websocket import JsonWebsocketConsumer
from django.core.exceptions import ValidationError
from django.db import transaction

from utils.shared.shared_utils_game_chat import SharedUtils

from .models import PokerGame
from .serializers import poker_payload

POKER_GROUP = "poker_{game_id}"


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
            game = PokerGame.objects.get(pk=self.game_id)
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
        elif msg_type == "sync":
            self._handle_sync()
        else:
            self.send_json({"type": "error", "message": "Unknown message type."})

    def _handle_sync(self):
        try:
            self._send_state(PokerGame.objects.get(pk=self.game_id))
        except PokerGame.DoesNotExist:
            self.send_json({"type": "error", "message": "Game not found."})

    def _send_state(self, game):
        self.send_json({"type": "game_state", "game": poker_payload(game, self.user)})

    def _handle_action(self, content):
        try:
            with transaction.atomic():
                game = PokerGame.objects.select_for_update().get(pk=self.game_id)
                game.apply_action(content.get("action"), self.user)
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

    def poker_update(self, event):
        try:
            game = PokerGame.objects.get(pk=event["game_id"])
        except PokerGame.DoesNotExist:
            self.send_json({"type": "error", "message": "Game not found."})
            return
        self.send_json({"type": "game_update", "game": poker_payload(game, self.user)})

    def disconnect(self, close_code):
        try:
            async_to_sync(self.channel_layer.group_discard)(self._group(), self.channel_name)
        except Exception:
            pass
