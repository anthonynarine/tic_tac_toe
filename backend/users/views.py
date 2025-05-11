from rest_framework import viewsets, status, permissions, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import models
from django.core.exceptions import ObjectDoesNotExist

from .models import CustomUser, Friendship
from .serializers import UserSerializer, FriendshipSerializer

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


class FriendshipViewset(viewsets.ModelViewSet):
    """
    API endpoint for managing friendships between users.

    Functionality:
    - Send friend requests
    - View pending and accepted friendships
    - Accept incoming friend requests
    """
    queryset = Friendship.objects.all()
    serializer_class = FriendshipSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Returns all friendship records where the current user is involved,
        either as sender or receiver.
        """
        user = self.request.user
        return (Friendship.objects
                .filter(models.Q(from_user=user) | models.Q(to_user=user))
                .distinct())

    @action(detail=False, methods=["get"])
    def friends(self, request):
        """
        Returns all accepted friendships involving the current user.
        """
        user = request.user
        friendships = Friendship.objects.filter(
            models.Q(from_user=user) | models.Q(to_user=user),
            is_accepted=True
        ).distinct()
        serializer = FriendshipSerializer(friendships, many=True, context={"request": request})
        return Response(serializer.data)


    @action(detail=False, methods=["get"])
    def pending(self, request):
        """
        Lists pending friendship requests:
        - Sent by the current user
        - Received by the current user
        """
        user = request.user
        sent = Friendship.objects.filter(from_user=user, is_accepted=False)
        received = Friendship.objects.filter(to_user=user, is_accepted=False)
        
        return Response({
            "sent_requests": FriendshipSerializer(sent, many=True, context={"request": request}).data,
            "received_requests": FriendshipSerializer(received, many=True, context={"request": request}).data,
        })


    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        """
        Accepts a pending friend request if the current user is the recipient.
        """
        try:
            friendship = Friendship.objects.get(id=pk, to_user=request.user)
            if friendship.is_accepted:
                return Response({"message": "Friend request already accepted."})
            friendship.is_accepted = True
            friendship.save()
            return Response({"message": "Friend request accepted."})
        except Friendship.DoesNotExist:
            return Response({"error": "Friend request not found."}, status=status.HTTP_404_NOT_FOUND)
        
    @action(detail=True, methods=["delete"])
    def decline(self, request, pk=None):
        """
        Declines (deletes) a pending friend request if the current user is the recipient.
        """
        try:
            friendship = Friendship.objects.get(id=pk, to_user=request.user, is_accepted=False)
            friendship.delete()
            return Response({"message": "Friend request declined."}, status=204)
        except Friendship.DoesNotExist:
            return Response({"error": "Pending friend request not found."}, status=404)

