# # Filename: backend/game/signals/game_update_signal.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from ..models import TicTacToeGame
import logging

logger = logging.getLogger("game")


def game_group(game_id: str) -> str:
    """
    Canonical group name for in-game WebSocket updates.
    Keeps game updates isolated from lobby sockets.
    """
    return f"game_{game_id}"


@receiver(post_save, sender=TicTacToeGame)
def game_update_signal(sender, instance, created, **kwargs):
    """
    Signal to broadcast game updates to WebSocket clients.
    """
    # Step 1: Skip new instances
    if created:
        logger.info(f"Skipping broadcast for newly created game ID {instance.id}")
        return

    # Step 2: Skip broadcasting for AI games
    if instance.is_ai_game:
        logger.debug(f"Skipping broadcast for AI game ID {instance.id}")
        return

    # Step 3: Prepare the WebSocket payload
    payload = {
        # IMPORTANT: This "type" maps to GameConsumer.game_update(event)
        "type": "game_update",
        "game_id": str(instance.id),
        "board_state": instance.board_state,
        "current_turn": instance.current_turn,
        "winner": instance.winner,
        "player_x": {
            "id": instance.player_x.id,
            "first_name": instance.player_x.first_name,
        } if instance.player_x else None,
        "player_o": {
            "id": instance.player_o.id,
            "first_name": instance.player_o.first_name,
        } if instance.player_o else None,
    }

    # Step 4: Broadcast ONLY to the game group (never the lobby group)
    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            game_group(str(instance.id)),
            payload,
        )
        logger.info(f"Game update broadcasted successfully for game ID {instance.id}")
    except Exception as e:
        logger.error(f"Failed to broadcast game update: {str(e)}")
