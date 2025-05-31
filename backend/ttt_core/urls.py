from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include

# SIMPLE_JWT
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path("admin/", admin.site.urls),

    # Users
    path("api/users/", include("users.urls")),

    # Friends
    path("api/friends/", include("friends.urls")),

    # Games
    path("api/games/", include("game.urls")),

    # Chat
    path("api/chat/", include("chat.urls")),

    # Agent
    path("api/", include("ai_agent.urls")),  

    # JWT
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
]

# Serves media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
