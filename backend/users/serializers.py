from pyexpat import model
from rest_framework import serializers
from .models import CustomUser, Friendship

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
    from_user_name = serializers.CharField(source="from_user.first_name", read_only=True)
    to_user_name = serializers.CharField(source="to_user.first_name", read_only=True)

    class Meta:
        model = Friendship
        fields = [
            "id",
            "from_user",
            "to_user",
            "from_user_name",
            "to_user_name",
            "is_accepted",
            "created_at"
        ]
        read_only_fields = ["from_user", "is_accepted", "created_at"]

    def validate(self, data):
        request_user = self.context["request"].user
        to_user = data["to_user"]

        if request_user == to_user:
            raise serializers.ValidationError("You cannot add yourself as a friend.")

        if Friendship.objects.filter(from_user=request_user, to_user=to_user).exists():
            raise serializers.ValidationError("Friend request already sent.")

        if Friendship.objects.filter(from_user=to_user, to_user=request_user).exists():
            raise serializers.ValidationError("This user already sent you a request.")

        return data

        

