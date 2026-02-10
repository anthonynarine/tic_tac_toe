# ✅ New Code
from django.urls import path
from notifications.consumers import NotificationConsumer

websocket_urlpatterns = [
    # Step 1: Global notification channel (single user socket)
    path("ws/notifications/", NotificationConsumer.as_asgi()),
]
