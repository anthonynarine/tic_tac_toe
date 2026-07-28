from rest_framework import serializers, generics, permissions
from rest_framework.exceptions import PermissionDenied
from chat.models import ChatRoom, ChatRoomMember, ChatRoomMessage, DirectMessage, Conversation
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


class ChatRoomMemberSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = ChatRoomMember
        fields = [
            "id",
            "user_id",
            "first_name",
            "email",
            "role",
            "joined_at",
            "last_read_at",
            "deleted_at",
            "left_at",
        ]
        read_only_fields = fields


class ChatRoomSerializer(serializers.ModelSerializer):
    created_by_id = serializers.IntegerField(source="created_by.id", read_only=True)
    created_by_name = serializers.CharField(source="created_by.first_name", read_only=True)
    members = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatRoom
        fields = [
            "id",
            "name",
            "room_type",
            "created_by_id",
            "created_by_name",
            "created_at",
            "updated_at",
            "members",
            "member_count",
        ]
        read_only_fields = fields

    def get_members(self, obj):
        memberships = obj.memberships.filter(left_at__isnull=True).select_related("user")
        return ChatRoomMemberSerializer(memberships, many=True).data

    def get_member_count(self, obj):
        return obj.memberships.filter(left_at__isnull=True).count()


class ChatRoomCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=80, trim_whitespace=True)
    member_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
        max_length=20,
    )

    def validate_name(self, value):
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError("Group name must be at least 2 characters.")
        return value

    def validate_member_ids(self, value):
        deduped = list(dict.fromkeys(int(v) for v in value))
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            deduped = [user_id for user_id in deduped if user_id != request.user.id]
        if not deduped:
            raise serializers.ValidationError("Add at least one other member.")
        return deduped


class ChatRoomMessageSerializer(serializers.ModelSerializer):
    sender_id = serializers.IntegerField(source="sender.id", read_only=True)
    sender_name = serializers.CharField(source="sender.first_name", read_only=True)

    class Meta:
        model = ChatRoomMessage
        fields = [
            "id",
            "room",
            "sender_id",
            "sender_name",
            "content",
            "timestamp",
        ]
        read_only_fields = fields

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
