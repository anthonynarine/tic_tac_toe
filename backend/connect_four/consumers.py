import logging
from asgiref.sync import async_to_sync
from channels.generic.websocket import JsonWebsocketConsumer
from django.core.exceptions import ValidationError

from utils.shared.shared_utils_game_chat import SharedUtils
from .models import ConnectFourGame
from .serializers import ConnectFourGameSerializer

logger = logging.getLogger(__name__)

C4_GROUP = "c4_{game_id}"


class ConnectFourConsumer(JsonWebsocketConsumer):

    def _group(self):
        return C4_GROUP.format(game_id=self.game_id)

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
            game = ConnectFourGame.objects.get(pk=self.game_id)
        except ConnectFourGame.DoesNotExist:
            self._accept_and_close(4004)
            return

        is_participant = (
            game.player_one == self.user
            or (game.player_two and game.player_two == self.user)
        )
        if not is_participant:
            self._accept_and_close(4003)
            return

        async_to_sync(self.channel_layer.group_add)(self._group(), self.channel_name)
        self.accept()

        self.send_json({
            "type": "game_state",
            "game": ConnectFourGameSerializer(game).data,
            "my_piece": 1 if game.player_one == self.user else 2,
        })

    def receive_json(self, content, **kwargs):
        msg_type = content.get("type", "")

        if msg_type == "move":
            self._handle_move(content)
        elif msg_type == "sync":
            self._handle_sync()
        else:
            self.send_json({"type": "error", "message": "Unknown message type."})

    def _handle_sync(self):
        try:
            game = ConnectFourGame.objects.get(pk=self.game_id)
            self.send_json({
                "type": "game_state",
                "game": ConnectFourGameSerializer(game).data,
                "my_piece": 1 if game.player_one == self.user else 2,
            })
        except ConnectFourGame.DoesNotExist:
            self.send_json({"type": "error", "message": "Game not found."})

    def _handle_move(self, content):
        col = content.get("col")
        if col is None:
            self.send_json({"type": "error", "message": "col is required."})
            return

        try:
            game = ConnectFourGame.objects.select_for_update().get(pk=self.game_id)
            game.drop_piece(int(col), self.user)
        except ConnectFourGame.DoesNotExist:
            self.send_json({"type": "error", "message": "Game not found."})
            return
        except (ValidationError, ValueError) as e:
            self.send_json({"type": "error", "message": str(e)})
            return

        p1_id = game.player_one_id
        p2_id = game.player_two_id if game.player_two_id else None

        async_to_sync(self.channel_layer.group_send)(
            self._group(),
            {
                "type": "c4_game_update",
                "board": game.board,
                "current_turn": game.current_turn,
                "winner": game.winner,
                "is_completed": game.is_completed,
                "player_one_id": p1_id,
                "player_two_id": p2_id,
            },
        )

    def c4_game_update(self, event):
        user_id = getattr(self.user, "id", None)
        p1_id = event.get("player_one_id")
        my_piece = 1 if user_id == p1_id else 2

        self.send_json({
            "type": "game_update",
            "board": event["board"],
            "current_turn": event["current_turn"],
            "winner": event["winner"],
            "is_completed": event["is_completed"],
            "my_piece": my_piece,
        })

    def disconnect(self, close_code):
        try:
            async_to_sync(self.channel_layer.group_discard)(self._group(), self.channel_name)
        except Exception:
            pass
