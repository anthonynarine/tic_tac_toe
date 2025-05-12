from rest_framework.routers import DefaultRouter
from .views import UserViewset

router = DefaultRouter()
router.register('users', UserViewset, basename='user')

urlpatterns = router.urls
