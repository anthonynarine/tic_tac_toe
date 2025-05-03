from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.conf import settings
from yaml import serialize

from .manager import CustomUserManager
from .image_validators import validate_icon_image_size, validate_image_file_extension
from .image_path import avatar_upload_path, default_avatar
from .resize_img import resize_image
from django.contrib.auth import get_user_model

User = settings.AUTH_USER_MODEL


class CustomUser(AbstractUser):
    """
    Custom user model using email as the unique identifier instead of username.
    Adds support for avatars and game-related stats.
    """
    email = models.EmailField(
        _('email address'),
        unique=True,
        help_text='Your login email address.'
    )

    first_name = models.CharField(
        max_length=26,
        verbose_name='First Name',
        help_text='Your first name.'
    )

    last_name = models.CharField(
        max_length=26,
        verbose_name='Last Name',
        help_text='Your last name.'
    )

    username = None  # Removed in favor of email login

    avatar = models.ImageField(
        upload_to=avatar_upload_path,
        blank=True,
        null=True,
        default=default_avatar,
        validators=[validate_image_file_extension],
        help_text='Upload a profile image. Default will be used if none is provided.'
    )

    total_games_played = models.IntegerField(
        default=0,
        help_text='Total number of games this user has played.'
    )

    wins = models.IntegerField(
        default=0,
        help_text='Total number of games this user has won.'
    )

    losses = models.IntegerField(
        default=0,
        help_text='Total number of games this user has lost.'
    )

    status = models.CharField(
        max_length=10,
        default='offline',
        help_text='Current online status of the user (e.g., "online", "offline").'
    )

    # Authentication settings
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ['first_name', 'last_name']

    objects = CustomUserManager()

    def save(self, *args, **kwargs):
        """
        Custom save method:
        - Deletes old avatar if replaced.
        - Resizes avatar image unless using default.
        """
        try:
            old = CustomUser.objects.get(id=self.id)
            if old.avatar and self.avatar != old.avatar:
                old.avatar.delete(save=False)
        except CustomUser.DoesNotExist:
            pass  # New user, no avatar to remove

        if self.avatar and not self.avatar.name.endswith('default.png'):
            self.avatar = resize_image(self.avatar)

        super().save(*args, **kwargs)

    def __str__(self):
        return self.email


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

    def __str__(self):
        return f"{self.from_user.email} → {self.to_user.email} | Accepted: {self.is_accepted}"
    

