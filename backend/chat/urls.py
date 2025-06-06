from django.urls import path
from .views.conversation_views import ConversationMessageListView, get_conversation_with

urlpatterns = [
    path(
        "conversations/<int:conversation_id>/messages/",
        ConversationMessageListView.as_view(),
        name="conversation-messages"
    ),
    path(
        "conversation-with/<int:friend_id>/",
        get_conversation_with,
        name="get-conversation-with"
        
    ),
]
