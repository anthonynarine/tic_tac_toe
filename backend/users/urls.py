from rest_framework.routers import DefaultRouter
from .views import UserViewset, FriendshipViewset

router = DefaultRouter()
router.register('', UserViewset, basename='user')
router.register('friends', FriendshipViewset, basename='friendship')

urlpatterns = router.urls
