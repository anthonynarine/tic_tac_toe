from pyexpat import model
from rest_framework import serializers
from .models import CustomUser, Friendship
from django.db import models

class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for the CustomUser model.
    Handles user registration and profile serialization.
    """

    class Meta:
        model = CustomUser
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "password",
            "avatar",
            "total_games_played",
            "wins",
            "losses",
            "status"
        ]
        extra_kwargs = {
            "password": {"write_only": True}  # Ensure password is not exposed in responses
        }

    def create(self, validated_data):
        user = CustomUser.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data["first_name"],
            last_name=validated_data["last_name"],
            avatar=validated_data.get("avatar", None),
        )
        return user
    
class FriendshipSerializer(serializers.ModelSerializer):
    to_user_email = serializers.EmailField(write_only=True)
    from_user_name = serializers.CharField(source="from_user.first_name", read_only=True)
    to_user_name = serializers.CharField(source="to_user.first_name", read_only=True)

    class Meta:
        model = Friendship
        fields = [
            "id",
            "from_user",
            "to_user_email",
            "from_user_name",
            "to_user_name",
            "is_accepted",
            "created_at"
        ]
        read_only_fields = ["id", "from_user", "is_accepted", "created_at"]
        
    def create(self, validated_data):
        request = self.context["request"]
        from_user = request.user
        to_email = validated_data.pop("to_user_email")

        if from_user.email == to_email:
            raise serializers.ValidationError("You cannot send a friend request to yourself.")

        try:
            to_user = CustomUser.objects.get(email=to_email)
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError("User not found.")

        # Prevent duplicates
        if Friendship.objects.filter(
            models.Q(from_user=from_user, to_user=to_user) |
            models.Q(from_user=to_user, to_user=from_user)
        ).exists():
            raise serializers.ValidationError("Friend request already exists.")

        return Friendship.objects.create(from_user=from_user, to_user=to_user)


        

