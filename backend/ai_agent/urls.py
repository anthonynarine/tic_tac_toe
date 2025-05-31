# backend/ai_agent/urls.py

from django.urls import path
from .views import AskAgentView

urlpatterns = [
    path("ask-agent/", AskAgentView.as_view(), name="ask-agent"),
]
