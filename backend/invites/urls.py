
# Step 1: Django imports
from django.urls import path

# Step 2: Local imports
from .views import InviteCreateView, InviteAcceptView, InviteDeclineView

urlpatterns = [
    # Step 1: POST /api/invites/
    path("", InviteCreateView.as_view(), name="invite-create"),

    # Step 2: POST /api/invites/<invite_id>/accept/
    path("<uuid:invite_id>/accept/", InviteAcceptView.as_view(), name="invite-accept"),

    # Step 3: POST /api/invites/<invite_id>/decline/
    path("<uuid:invite_id>/decline/", InviteDeclineView.as_view(), name="invite-decline"),
]
