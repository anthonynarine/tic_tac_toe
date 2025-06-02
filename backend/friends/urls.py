from rest_framework.routers import DefaultRouter
from .views import FriendshipViewset

router = DefaultRouter()
router.register('', FriendshipViewset, basename='friendship')

urlpatterns = router.urls
