from tabnanny import verbose
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
import logging

logger = logging.getLogger("chat")

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
    Represents a private 1-on-1 conversation between 2 users.

    Deletion semantics (clear history for me):
    - userX_deleted_at is a per-user cutoff timestamp.
    - When user deletes: set their deleted_at = now().
    - When fetching messages: return only messages with timestamp > deleted_at for that user.
    - IMPORTANT: Do NOT "revive" by clearing deleted_at — old history must never return.
    """
    user1 = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="conversation_user1",
        help_text="One of the users in the conversation",
    )
    user2 = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="conversation_user2",
        help_text="The other user in the conversation",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp when the conversation was first created.",
    )

    # Step 1: per-user cutoff timestamps
    user1_deleted_at = models.DateTimeField(null=True, blank=True)
    user2_deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("user1", "user2")
        verbose_name = "Conversation"
        verbose_name_plural = "Conversations"

    def __str__(self):
        return f"Conversation between {self.user1.email} and {self.user2.email}"

    def get_participants(self):
        return [self.user1, self.user2]

    def includes(self, user):
        logger.debug(
            f"[MODEL] Checking if user {getattr(user, 'id', None)} is part of conversation {self.id} "
            f"(user1={self.user1.id}, user2={self.user2.id})"
        )
        return user == self.user1 or user == self.user2

    # Step 2: mark deleted for only the requesting user (sets cutoff)
    def mark_deleted_for(self, user):
        now = timezone.now()
        if user == self.user1:
            self.user1_deleted_at = now
        elif user == self.user2:
            self.user2_deleted_at = now
        else:
            raise ValueError("User not in conversation")

        # Update both fields safely (update_fields can include both)
        self.save(update_fields=["user1_deleted_at", "user2_deleted_at"])

    # Step 3: (Deprecated) revive. DO NOT clear cutoffs.
    # Keeping this method as a no-op prevents accidental resurrection by old code paths.
    def revive_for_participants(self):
        """
        Deprecated: do not use.
        Deletion is treated as a per-user cutoff timestamp. Old history must never return.
        """
        return

    # Optional helpers
    def is_deleted_for(self, user):
        # NOTE: "deleted" means "has a cutoff"
        if user == self.user1:
            return self.user1_deleted_at is not None
        if user == self.user2:
            return self.user2_deleted_at is not None
        return True

    def deleted_cutoff_for(self, user):
        """
        Returns the cutoff timestamp for the user, or None if no delete cutoff exists.
        """
        if user == self.user1:
            return self.user1_deleted_at
        if user == self.user2:
            return self.user2_deleted_at
        raise ValueError("User not in conversation")