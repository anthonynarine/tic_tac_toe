from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _
from .manager import CustomUserManager
from .image_validators import validate_icon_image_size, validate_image_file_extension
from .image_path import avatar_upload_path, default_avatar
from .resize_img import resize_image


class CustomUser(AbstractUser):
    """
    Custom user model where email is the unique identifier for authentication
    instead of usernames.
    """
    email = models.EmailField(
        _('email address'),
        unique=True,
        help_text='Enter your email address. Used for login.'
    )
    first_name = models.CharField(
        max_length=26,
        verbose_name='First Name',
        help_text='Enter your first name.'
    )
    last_name = models.CharField(
        max_length=26,
        verbose_name='Last Name',
        help_text='Enter your last name.'
    )
    username = None  # Email is the unique identifier

    # Additional fields for gaming
    avatar = models.ImageField(
        upload_to=avatar_upload_path, # Custom upload path for avatars with UUID
        blank=True,
        null=True,
        default=default_avatar,
        validators=[validate_image_file_extension],
        help_text='Upload a profile picture to represent you in the game.'
    )
    total_games_played = models.IntegerField(
        default=0,
        help_text='The total number of games played by the user.'
    )
    wins = models.IntegerField(
        default=0,
        help_text='The total number of games won by the user.'
    )
    losses = models.IntegerField(
        default=0,
        help_text='The total number of games lost by the user.'
    )
    status = models.CharField(
        max_length=10,
        default='offline',
        help_text='Indicates whether the user is online or offline.'
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ['first_name', 'last_name']

    objects = CustomUserManager()

    def save(self, *args, **kwargs):
        # Check if updating the avatar and delete the old one if necessary
        try:
            this = CustomUser.objects.get(id=self.id)
            if this.avatar and self.avatar != this.avatar:
                this.avatar.delete(save=False) # Delete the old avatar file
        except CustomUser.DoesNotExist:
            pass # If creating a new user, no action is neded

        # Resize avatar if necessary
        if self.avatar and not self.avatar.name.endswith('default.jpg'):
            self.avatar = resize_image(self.avatar)
        
        super().save(*args, **kwargs)

    def __str__(self):
        return self.email
