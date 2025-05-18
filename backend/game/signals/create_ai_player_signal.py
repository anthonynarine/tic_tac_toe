import email
from django.db.models.signals import post_migrate
from django.contrib.auth import get_user_model
from django.dispatch import receiver
from django.utils.crypto import get_random_string
import logging

logger = logging.getLogger("game")

User = get_user_model()

@receiver(post_migrate)
def create_ai_user(sender, **kwargs):
    """
    Ensure the AI user exists after migrations are applied.
    """
    ai_email = "ai@tictactoe.com"

    
    try:
        # Check if the AI user already exists
        if not User.objects.filter(email=ai_email).exists():
            User.objects.create_user(
                email=ai_email,
                first_name="AI",
                last_name="Narine",
                password=get_random_string(20),
                avatar=None,
            )
            logger.info("AI user created successfully after migrations.")
        else:
            logger.info("AI user already exists.")
    except Exception as e:
        logger.error(f"Failed to create AI user: {e}")