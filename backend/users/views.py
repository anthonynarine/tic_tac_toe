from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import CustomUser
from .serializers import UserSerializer
from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist


class UserViewset(viewsets.ModelViewSet):
    queryset = CustomUser.objects.all()
    serializer_class = UserSerializer

    # Define permissin for different actions
    def get_permissions(self):
        if self.action in ["create", list]:
            self.permission_classes = [AllowAny] # Allow registrations and viewing user list
        else:
            self.permission_classes = [IsAuthenticated] # Other actions need authentication
        return super().get_permissions()

    def perform_create(self, serializer):
        # Add andy custom logic during user creaton
        serializer.save()

    @action(detail=False, methods=["GET"], permission_classes=[IsAuthenticated])
    def profile(self, request):
        """
        Custom actin to retrieve the current user's profile
        """
        try:
            serializer = UserSerializer(request.user, context={"request": request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        except ObjectDoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
