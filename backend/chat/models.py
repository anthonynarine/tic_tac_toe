from tabnanny import verbose
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
    
    conversation = models.ForeignKey(
        "Conversation",
        on_delete=models.CASCADE,
        related_name="messages",
        help_text="The conversation this message belongs to",
        null=True
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

class Conversation(models.Model):
    """
    Represents a private 1 on 1 conversations between 2 users.
    
    Fields:
    - user1: One participant in the conversation
    - user2: The other participant
    - created_at: When the conversation was created
    """
    user1 = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="conversation_user1",
        help_text="One of the users in the conversation"
    )
    user2 = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="conversation_user2",
        help_text="The other user in the conversation"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp when the conversation was first created. "
    )
    
    class Meta:
        unique_together = ("user1", "user2")
        verbose_name = "Conversation"
        verbose_name_plural = "Conversations"
        
    def __str__(self):
        return f"Conversation between {self.user1.email} and {self.user2.email}"


    def get_participants(self):
        return [self.user1, self.user2]

    def includes(self, user):
        return user == self.user1 or user == self.user2
