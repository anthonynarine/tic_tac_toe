from rest_framework import serializers, generics, permissions
from rest_framework.exceptions import PermissionDenied
from chat.models import DirectMessage, Conversation
import logging

logger = logging.getLogger("chat")

class DirectMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = DirectMessage
        fields = [
            "id",
            "sender",
            "receiver",
            "content",
            "timestamp",
            "is_read",
            "conversation_id",
        ]
        read_only_fields = ["id", "sender", "timestamp", "conversation_id", "is_read"]

class ConversationMessageListView(generics.ListAPIView):
    """
    Returns all messages in a given conversation, sorted by timestamp.
    Only accessible by conversation participants.
    """
    serializer_class = DirectMessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        conversation_id = self.kwargs.get("conversation_id")
        user = self.request.user

        logger.debug(f"[REST] Authenticated user: {user} (ID={user.id})")

        try:
            conversation = Conversation.objects.get(id=conversation_id)
            logger.debug(f"[REST] Found conversation {conversation.id}: user1={conversation.user1.id}, user2={conversation.user2.id}")
        except Conversation.DoesNotExist:
            logger.warning(f"[REST] Conversation {conversation_id} not found")
            raise PermissionDenied("Conversation not found.")

        if not conversation.includes(user):
            logger.warning(f"[REST] Access denied. User {user.id} is not part of conversation {conversation.id}")
            raise PermissionDenied("You are not a participant in this conversation.")

        return conversation.messages.all().order_by("timestamp")
