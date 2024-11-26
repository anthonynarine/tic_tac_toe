from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TicTacToeGameViewSet

# Create a router and register your viewsets
router = DefaultRouter()
router.register("", TicTacToeGameViewSet, basename="tictactoe")

# Include the router-generated URLs
urlpatterns = router.urls