from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _
from .manager import CustomUserManager

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
        upload_to='avatars/',
        blank=True,
        null=True,
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

    def __str__(self):
        return self.email
