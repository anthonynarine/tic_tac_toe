from django.shortcuts import render

# Create your views here.
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import models
from django.shortcuts import get_object_or_404

from .models import Friendship
from .serializers import FriendshipSerializer


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
        user = self.request.user
        return Friendship.objects.filter(
            models.Q(from_user=user) | models.Q(to_user=user)
        ).distinct()

    @action(detail=False, methods=["get"])
    def friends(self, request):
        user = request.user
        friendships = Friendship.objects.filter(
            models.Q(from_user=user) | models.Q(to_user=user),
            is_accepted=True
        ).distinct()
        serializer = self.get_serializer(friendships, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def pending(self, request):
        user = request.user
        sent = Friendship.objects.filter(from_user=user, is_accepted=False)
        received = Friendship.objects.filter(to_user=user, is_accepted=False)

        return Response({
            "sent_requests": self.get_serializer(sent, many=True, context={"request": request}).data,
            "received_requests": self.get_serializer(received, many=True, context={"request": request}).data,
        })

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        friendship = get_object_or_404(Friendship, id=pk, to_user=request.user)
        if friendship.is_accepted:
            return Response({"message": "Friend request already accepted."})
        friendship.is_accepted = True
        friendship.save()
        return Response({"message": "Friend request accepted."})

    @action(detail=True, methods=["delete"])
    def decline(self, request, pk=None):
        friendship = get_object_or_404(Friendship, id=pk, to_user=request.user, is_accepted=False)
        friendship.delete()
        return Response({"message": "Friend request declined."}, status=status.HTTP_204_NO_CONTENT)
