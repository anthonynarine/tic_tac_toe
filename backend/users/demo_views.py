# Filename: backend/users/demo_views.py


import secrets

from django.conf import settings
from django.contrib.auth import get_user_model

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from rest_framework_simplejwt.tokens import RefreshToken


def ensure_demo_user(*, email: str, first_name: str, last_name: str):
    """Ensure demo user exists and is forced to minimal privileges.

    Notes:
        - If user exists: we do NOT change their password.
        - If user does not exist: we create with a random password.
        - Always enforces:
            - is_staff=False
            - is_superuser=False
            - is_active=True

    Args:
        email: Demo user email.
        first_name: Demo user's first name.
        last_name: Demo user's last name.

    Returns:
        tuple: (user, created)
    """
    # Step 1: Resolve user model
    User = get_user_model()
    normalized_email = User.objects.normalize_email(email)

    # Step 2: Get or create
    user = User.objects.filter(email=normalized_email).first()
    created = False

    if not user:
        created = True
        user = User.objects.create_user(
            email=normalized_email,
            password=secrets.token_urlsafe(32),
            first_name=first_name,
            last_name=last_name,
            is_active=True,
            is_staff=False,
            is_superuser=False,
        )

    # Step 3: Enforce minimal privileges
    dirty = False

    if user.first_name != first_name:
        user.first_name = first_name
        dirty = True

    if user.last_name != last_name:
        user.last_name = last_name
        dirty = True

    if user.is_staff:
        user.is_staff = False
        dirty = True

    if user.is_superuser:
        user.is_superuser = False
        dirty = True

    if not user.is_active:
        user.is_active = True
        dirty = True

    if dirty:
        user.save()

    return user, created


class DemoLoginBase(APIView):
    """Passwordless demo login endpoint guarded by DEMO_MODE."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "demo_login"

    # Step 1: Override in subclasses
    demo_email = None
    demo_first_name = None
    demo_last_name = None

    def post(self, request, *args, **kwargs):
        # Step 2: Guard behind DEMO_MODE (return 404 to hide existence)
        if not getattr(settings, "DEMO_MODE", False):
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        # Step 3: Validate subclass config
        if not all([self.demo_email, self.demo_first_name, self.demo_last_name]):
            return Response(
                {"detail": "Demo endpoint misconfigured."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Step 4: Ensure demo user exists
        user, _created = ensure_demo_user(
            email=self.demo_email,
            first_name=self.demo_first_name,
            last_name=self.demo_last_name,
        )

        # Step 5: Mint tokens (SimpleJWT exact shape)
        refresh = RefreshToken.for_user(user)
        return Response(
            {"access": str(refresh.access_token), "refresh": str(refresh)},
            status=status.HTTP_200_OK,
        )


class DemoLoginPlayer1(DemoLoginBase):
    # Step 1: Use your existing demo identities
    demo_email = settings.DEMO_PLAYER1_EMAIL  
    demo_first_name = settings.DEMO_PLAYER1_FIRST_NAME  
    demo_last_name = settings.DEMO_PLAYER1_LAST_NAME  


class DemoLoginPlayer2(DemoLoginBase):
    # Step 1: Use your existing demo identities
    demo_email = settings.DEMO_PLAYER2_EMAIL  
    demo_first_name = settings.DEMO_PLAYER2_FIRST_NAME  
    demo_last_name = settings.DEMO_PLAYER2_LAST_NAME  
