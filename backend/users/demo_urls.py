# Filename: backend/users/demo_urls.py
# ✅ New Code

from django.urls import path

from .demo_views import DemoLoginPlayer1, DemoLoginPlayer2

urlpatterns = [
    # Step 1: Demo endpoints
    path("login/player1/", DemoLoginPlayer1.as_view(), name="demo_login_player1"),
    path("login/player2/", DemoLoginPlayer2.as_view(), name="demo_login_player2"),
]
