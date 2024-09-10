from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import CustomUser
from .serializers import UserSerializer

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
