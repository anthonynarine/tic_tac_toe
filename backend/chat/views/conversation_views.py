from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied
from chat.models import DirectMessage, Conversation
from chat.serializer import DirectMessageSerializer


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
