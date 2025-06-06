from rest_framework import generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model

from chat.models import Conversation
from chat.serializer import DirectMessageSerializer

User = get_user_model()


class ConversationMessageListView(generics.ListAPIView):
    """
    Returns all messages in a given conversation, sorted by timestamp.
    Only accessible by conversation participants.
    """
    serializer_class = DirectMessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        conversation_id = self.kwargs.get("conversation_id")
        try:
            conversation = Conversation.objects.get(id=conversation_id)
        except Conversation.DoesNotExist:
            raise PermissionDenied("Conversation not found.")

        if not conversation.includes(self.request.user):
            raise PermissionDenied("You are not a participant in this conversation.")

        return conversation.messages.all().order_by("timestamp")


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def get_conversation_with(request, friend_id):
    """
    Returns the conversation ID between the logged-in user and a friend.
    Ensures consistent ID by sorting user IDs and using get_or_create.
    """
    user = request.user
    friend = get_object_or_404(User, id=friend_id)

    user1, user2 = sorted([user, friend], key=lambda u: u.id)
    convo, _ = Conversation.objects.get_or_create(user1=user1, user2=user2)

    return Response({"conversation_id": convo.id})
