from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TicTacToeGameViewsets

# Create a router and register your viewsets
router = DefaultRouter()
router.register("games", TicTacToeGameViewsets, basename="tictactoe")

# Include the router-generated URLs
urlpatterns = router.urls