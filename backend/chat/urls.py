from django.urls import path
from .views.conversation_views import ConversationMessageListView

urlpatterns = [
    path(
        "conversations/<int:conversation_id>/messages/",
        ConversationMessageListView.as_view(),
        name="conversation-messages"
    ),
]
