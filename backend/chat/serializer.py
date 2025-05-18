from rest_framework import serializers
from chat.models import DirectMessage

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
