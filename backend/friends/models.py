from django.conf import settings
from django.db import models
from django.contrib.auth import get_user_model


User = get_user_model()

class Friendship(models.Model):
    """
    Represents a friendship relationship between two users.
    One user sends the request (from_user), and the other receives it (to_user).
    """
    from_user = models.ForeignKey(
        User,
        related_name="sent_friend_request",
        on_delete=models.CASCADE,
        help_text="User who sent the friend request."
    )

    to_user = models.ForeignKey(
        User,
        related_name="received_friend_request",
        on_delete=models.CASCADE,
        help_text="User who received the friend request."
    )

    is_accepted = models.BooleanField(
        default=False,
        help_text="Indicates whether the friend request has been accepted."
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp when the friend request was created."
    )

    class Meta:
        unique_together = ("from_user", "to_user")
        verbose_name = "Friendship"
        verbose_name_plural = "Friendships"
        ordering = ["-created_at"]
        db_table = "users_friendship" 
    
    def get_other_user(self, current_user):
        """
        Returns the friend (not the current user) from this friendship.
        """
        if self.from_user == current_user:
            return self.to_user
        elif self.to_user == current_user:
            return self.from_user
        return None  # In case of data inconsistency

        
    def __str__(self):
        return f"{self.from_user.email} → {self.to_user.email} | Accepted: {self.is_accepted}"
    