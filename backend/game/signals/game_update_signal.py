from django.db.models.signals import post_save
from django.dispatch import receiver
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from ..models import TicTacToeGame
import logging

logger = logging.getLogger("game")

@receiver(post_save, sender=TicTacToeGame)
def game_update_signal(sender, instance, created, **kwargs):
    """
    Signal to broadcast game updates to WebSocket clients.

    Args:
        sender: The model class that triggered the signal.
        instance (TicTacToeGame): The specific instance that was saved.
        created (bool): Whether this is a new instance (True) or an update (False).
        **kwargs: Additional arguments.
    """
    if created:
        logger.info(f"Skipping broadcast for newly created game ID {instance.id}")
        return

    # Skip broadcasting for AI games
    if instance.is_ai_game:
        logger.debug(f"Skipping broadcast for AI game ID {instance.id}")
        return

    # Prepare the WebSocket payload
    payload = {
        "type": "game_update",
        "game_id": instance.id,
        "board_state": instance.board_state,
        "current_turn": instance.current_turn,
        "winner": instance.winner,
        "player_x": {
            "id": instance.player_x.id,
            "first_name": instance.player_x.first_name,
        } if instance.player_x else None,
        "player_o": {
            "id": instance.player_o.id,
            "first_name": instance.player_o.first_name if instance.player_o else "Waiting..."
        } if instance.player_o else None,
    }

    # Broadcast the update to the WebSocket channel
    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"game_lobby_{instance.id}",
            payload
        )
        logger.info(f"Game update broadcasted successfully for game ID {instance.id}")
    except Exception as e:
        logger.error(f"Failed to broadcast game update: {str(e)}")
