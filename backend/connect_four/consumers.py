import logging
import random
import time
from asgiref.sync import async_to_sync
from channels.generic.websocket import JsonWebsocketConsumer
from django.core.exceptions import ValidationError

from utils.shared.shared_utils_game_chat import SharedUtils
from utils.redis.redis_game_lobby_manager import RedisGameLobbyManager
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
        logger.info(
            "[C4] connected game_id=%s user_id=%s group=%s",
            self.game_id,
            getattr(self.user, "id", None),
            self._group(),
        )

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
        elif msg_type == "rematch_request":
            self._handle_rematch_request()
        elif msg_type == "rematch_accept":
            self._handle_rematch_accept()
        elif msg_type == "rematch_decline":
            self._handle_rematch_decline()
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

    def _get_game_and_pieces(self):
        game = ConnectFourGame.objects.get(pk=self.game_id)
        if game.player_one_id == self.user.id:
            return game, 1, game.player_two_id
        if game.player_two_id == self.user.id:
            return game, 2, game.player_one_id
        return game, None, None

    def _handle_rematch_request(self):
        try:
            game, requester_piece, receiver_id = self._get_game_and_pieces()
        except ConnectFourGame.DoesNotExist:
            self.send_json({"type": "error", "message": "Game not found."})
            return

        if not game.is_completed:
            self.send_json({"type": "error", "message": "Finish the game before requesting a rematch."})
            return
        if requester_piece not in (1, 2) or not receiver_id:
            self.send_json({"type": "error", "message": "Both players must be present to rematch."})
            return

        manager = RedisGameLobbyManager()
        offer = {
            "game_id": str(self.game_id),
            "requesterUserId": int(self.user.id),
            "receiverUserId": int(receiver_id),
            "requesterPiece": requester_piece,
            "message": f"{self.user.first_name or 'Player'} wants a rematch!",
            "createdAtMs": int(time.time() * 1000),
        }
        manager.store_rematch_offer(str(self.game_id), offer)

        async_to_sync(self.channel_layer.group_send)(
            self._group(),
            {
                "type": "c4_rematch_offer",
                **offer,
            },
        )

    def _handle_rematch_accept(self):
        manager = RedisGameLobbyManager()
        offer = manager.get_rematch_offer(str(self.game_id))
        if not offer:
            self.send_json({"type": "error", "message": "No pending rematch offer found."})
            return
        if str(offer.get("receiverUserId")) != str(self.user.id):
            self.send_json({"type": "error", "message": "Only the other player can accept this rematch."})
            return

        try:
            game = ConnectFourGame.objects.get(pk=self.game_id)
        except ConnectFourGame.DoesNotExist:
            self.send_json({"type": "error", "message": "Game not found."})
            return

        if not game.player_one_id or not game.player_two_id:
            self.send_json({"type": "error", "message": "Both players must be present to rematch."})
            return

        manager.pop_rematch_offer(str(self.game_id))
        new_game = ConnectFourGame.objects.create(
            player_one=game.player_one,
            player_two=game.player_two,
            is_ai_game=False,
            current_turn=random.choice([1, 2]),
        )

        async_to_sync(self.channel_layer.group_send)(
            self._group(),
            {
                "type": "c4_rematch_start",
                "new_game_id": str(new_game.id),
                "message": "Rematch created.",
            },
        )

    def _handle_rematch_decline(self):
        manager = RedisGameLobbyManager()
        offer = manager.get_rematch_offer(str(self.game_id))
        if offer:
            manager.clear_rematch_offer(str(self.game_id))

        async_to_sync(self.channel_layer.group_send)(
            self._group(),
            {
                "type": "c4_rematch_declined",
                "message": f"{self.user.first_name or 'Player'} declined the rematch.",
            },
        )

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
        logger.info(
            "[C4] move accepted game_id=%s user_id=%s col=%s next_turn=%s group=%s",
            self.game_id,
            getattr(self.user, "id", None),
            col,
            game.current_turn,
            self._group(),
        )

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
        logger.info(
            "[C4] sending update game_id=%s user_id=%s current_turn=%s",
            self.game_id,
            user_id,
            event["current_turn"],
        )

        self.send_json({
            "type": "game_update",
            "board": event["board"],
            "current_turn": event["current_turn"],
            "winner": event["winner"],
            "is_completed": event["is_completed"],
            "my_piece": my_piece,
        })

    def c4_rematch_offer(self, event):
        user_id = getattr(self.user, "id", None)
        receiver_id = event.get("receiverUserId")
        requester_id = event.get("requesterUserId")
        self.send_json({
            "type": "rematch_offer",
            "game_id": event.get("game_id"),
            "message": event.get("message"),
            "requesterUserId": requester_id,
            "receiverUserId": receiver_id,
            "showActions": str(user_id) == str(receiver_id),
            "uiMode": "receiver" if str(user_id) == str(receiver_id) else "requester",
            "createdAtMs": event.get("createdAtMs"),
            "rematchPending": True,
        })

    def c4_rematch_start(self, event):
        self.send_json({
            "type": "rematch_start",
            "new_game_id": event.get("new_game_id"),
            "message": event.get("message"),
        })

    def c4_rematch_declined(self, event):
        self.send_json({
            "type": "rematch_declined",
            "message": event.get("message"),
            "rematchPending": False,
        })

    def disconnect(self, close_code):
        logger.info(
            "[C4] disconnected game_id=%s user_id=%s code=%s",
            getattr(self, "game_id", None),
            getattr(getattr(self, "user", None), "id", None),
            close_code,
        )
        try:
            async_to_sync(self.channel_layer.group_discard)(self._group(), self.channel_name)
        except Exception:
            pass
