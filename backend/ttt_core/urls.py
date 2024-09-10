
from django.contrib import admin
from django.urls import path, include

#SIMPLE_JWT
from rest_framework_simplejwt.views import (
    TokenObtainPairView, 
    TokenRefreshView

)

urlpatterns = [
    path("admin/", admin.site.urls),
    # users app urls
    path("api/", include("users.urls")),
    # SIMPLE_JWT
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh")

]




