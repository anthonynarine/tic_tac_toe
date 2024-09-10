from rest_framework import serializers
from .models import CustomUser

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ["id", "email", "first_name", "last_name", "avatar", "total_games_played", "wins", "losses", "status"]
        extra_kwargs = {
            "password": {"write_only": True} # Ensure password is write-only
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