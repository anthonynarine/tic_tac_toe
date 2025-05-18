from rest_framework import viewsets, status, permissions, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import models
from django.core.exceptions import ObjectDoesNotExist

from .models import CustomUser
from .serializers import UserSerializer

from utils.logger.log_helpers import get_logger, log_event, log_error

import logging
logger = logging.getLogger(__name__)



class UserViewset(viewsets.ModelViewSet):
    """
    API endpoint for managing user accounts.
    
    Provides:
    - User registration
    - Listing all users (public)
    - Profile retrieval (authenticated)
    """
    queryset = CustomUser.objects.all()
    serializer_class = UserSerializer

    def get_permissions(self):
        """
        Apply different permissions based on the action.
        - Allow unauthenticated access for registration and list
        - Require authentication for all other operations
        """
        if self.action in ['create', 'list']:
            self.permission_classes = [permissions.AllowAny]
        else:
            self.permission_classes = [permissions.IsAuthenticated]
        return super().get_permissions()

    def perform_create(self, serializer):
        """
        Called during registration to save the new user.
        """
        serializer.save()

    @action(detail=False, methods=["GET"], permission_classes=[permissions.IsAuthenticated])
    def profile(self, request):
        """
        Returns the authenticated user's profile.
        """
        try:
            serializer = UserSerializer(request.user, context={"request": request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        except ObjectDoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

