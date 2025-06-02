from django.urls import path
from .views import AskAgentView

urlpatterns = [
    path("trinity/", AskAgentView.as_view(), name="trinity-agent"),
]