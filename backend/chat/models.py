from django.db import models
from django.contrib.auth import get_user_model
from django.dispatch import receiver

User = get_user_model()

class DirectMessage(models.Model):
    """
    Represents a private message exchanged between two users.

    Fields:
    - sender: The user who sent the message
    - recipient: The user who receives the message
    - content: The textual body of the message
    - timestamp: When the message was created
    - is_read: Boolean indicating whether the recipient has read the message
    """
    sender = models.ForeignKey(
        User,
        related_name="sent_messages",
        on_delete=models.CASCADE,
        help_text="User who sent the message"
    )

    receiver = models.ForeignKey(
        User,
        related_name="received_messages",
        on_delete=models.CASCADE,
        help_text="User who receives the message"
    )

    content = models.TextField(
        help_text="Message content (text only)"
    )

    timestamp = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp of when the message was created"
    )


    is_read = models.BooleanField(
        default=False,
        help_text="Marks whether the message has been read by the recipient"
    )

    class Meta:
        ordering = ["timestamp"]
        verbose_name = "Direct Message"
        verbose_name_plural = "Direct Messages"

    @property
    def conversation_id(self):
        """
        Returns a deterministic conversation ID for this message,
        ensuring both users in the chat always resolve to the same ID.
        Format: "<smaller_user_id>__<larger_user_id>"
        """
        ids = sorted([self.sender.id, self.receiver.id])
        return f"{ids[0]}__{ids[1]}"

    def __str__(self):
        return f"{self.sender} → {self.receiver}: {self.content[:20]}"

