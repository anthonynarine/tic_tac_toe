from rest_framework import serializers
from django.db import models
from django.contrib.auth import get_user_model
from .models import Friendship

User = get_user_model()

class FriendshipSerializer(serializers.ModelSerializer):
    """
    Serializer for the Friendship model.

    Includes:
    - Legacy fields for friend request views (from_user_name, to_user_name)
    - Simplified `friend_id`, `friend_name`, and `friend_status` fields for frontend use
    based on the perspective of the authenticated user
    """
    to_user_email = serializers.EmailField(write_only=True)

    # Legacy fields (used by pending request UI)
    from_user_name = serializers.CharField(source="from_user.first_name", read_only=True)
    to_user_name = serializers.CharField(source="to_user.first_name", read_only=True)

    # Computed fields: these describe the "other" user in the friendship
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

    # ===== Utility for DRY access to the "friend" object =====

    def _get_other_user(self, obj):
        """
        Returns the "other" user in the friendship, relative to the authenticated user.
        """
        current_user = self.context["request"].user
        return obj.get_other_user(current_user)

    # ===== Computed display fields =====

    def get_friend_id(self, obj):
        other = self._get_other_user(obj)
        return other.id if other else None

    def get_friend_name(self, obj):
        other = self._get_other_user(obj)
        return other.first_name if other else "Unknown"

    def get_friend_status(self, obj):
        other = self._get_other_user(obj)
        return other.status if other else "offline"

    # ===== Creation logic =====

    def create(self, validated_data):
        """
        Handles sending a friend request using the recipient's email.
        """
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
