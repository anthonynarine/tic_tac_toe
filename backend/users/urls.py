from rest_framework.routers import DefaultRouter
from .views import UserViewset, FriendshipViewset

router = DefaultRouter()
router.register('friends', FriendshipViewset, basename='friendship')
router.register('', UserViewset, basename='user')

urlpatterns = router.urls
