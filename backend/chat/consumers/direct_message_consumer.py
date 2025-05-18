import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth import get_user_model
from channels.db import database_sync_to_async
from chat.models import DirectMessage
from friends.models import Friendship

User = get_user_model()