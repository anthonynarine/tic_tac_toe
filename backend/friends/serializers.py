from rest_framework import serializers
from django.db import models
from django.contrib.auth import get_user_model

from .models import Friendship

User = get_user_model()


class FriendshipSerializer(serializers.ModelSerializer):
    to_user_email = serializers.EmailField(write_only=True)

    # Legacy fields for pending request UI
    from_user_name = serializers.CharField(source="from_user.first_name", read_only=True)
    to_user_name = serializers.CharField(source="to_user.first_name", read_only=True)

    # Display the other user's info (used in friends list)
    friend_id = serializers.SerializerMethodField()
    friend_name = serializers.SerializerMethodField()
    friend_status = serializers.SerializerMethodField()

    class Meta:
        model = Friendship
        fields = [
            "id",
            "from_user",
            "to_user_email",
            "from_user_name",
            "to_user_name",
            "friend_id",
            "friend_name",
            "friend_status",
            "is_accepted",
            "created_at"
        ]
        read_only_fields = ["id", "from_user", "is_accepted", "created_at"]

    def get_friend_id(self, obj):
        current_user = self.context["request"].user
        other = obj.get_other_user(current_user)
        return other.id if other else None

    def get_friend_name(self, obj):
        current_user = self.context["request"].user
        other = obj.get_other_user(current_user)
        return other.first_name if other else "Unknown"

    def get_friend_status(self, obj):
        current_user = self.context["request"].user
        other = obj.get_other_user(current_user)
        return other.status == "online" if other else False

    def create(self, validated_data):
        request = self.context["request"]
        from_user = request.user
        to_email = validated_data.pop("to_user_email")

        if from_user.email == to_email:
            raise serializers.ValidationError("You cannot send a friend request to yourself.")

        try:
            to_user = User.objects.get(email=to_email)
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found.")

        if Friendship.objects.filter(
            models.Q(from_user=from_user, to_user=to_user) |
            models.Q(from_user=to_user, to_user=from_user)
        ).exists():
            raise serializers.ValidationError("Friend request already exists.")

        return Friendship.objects.create(from_user=from_user, to_user=to_user)
