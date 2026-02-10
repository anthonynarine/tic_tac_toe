# # Filename: chat/urls.py

from django.urls import path
from .views.conversation_views import (
    ConversationMessageListView,
    get_conversation_with,
    mark_conversation_read,
    delete_conversation,
    get_unread_summary
)

urlpatterns = [
    path(
        "conversations/<int:conversation_id>/messages/",
        ConversationMessageListView.as_view(),
        name="conversation-messages",
    ),
    path(
        "conversation-with/<int:friend_id>/",
        get_conversation_with,
        name="get-conversation-with",
    ),

    # Step 1: Mark as read (so unread badge stays correct across refresh/login)
    path(
        "conversations/<int:conversation_id>/mark-read/",
        mark_conversation_read,
        name="conversation-mark-read",
    ),

    # Step 2: Soft delete for requesting user only
    path(
        "conversations/<int:conversation_id>/",
        delete_conversation,
        name="conversation-delete",
    ),
    path("unread-summary/", get_unread_summary),
]
