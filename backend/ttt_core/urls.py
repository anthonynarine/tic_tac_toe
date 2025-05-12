from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include

# SIMPLE_JWT
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path("admin/", admin.site.urls),

    # Users app URLs
    path("api/", include("users.urls")),

    # Friends app URLs
    path("api/", include("friends.urls")),

    # Game app URLs
    path("api/games/", include("game.urls")),

    # Chat app URLs (REST endpoints, not WebSocket)
    path("api/chat/", include("chat.urls")), 

    # JWT Token endpoints
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
]

# Serves media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
