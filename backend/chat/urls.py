# # Filename: chat/urls.py

from django.urls import path
from .views.conversation_views import (
    ConversationMessageListView,
    get_conversation_with,
    mark_conversation_read,
    delete_conversation,
    get_unread_summary
)
from .views.group_views import (
    add_group_members,
    clear_group_history,
    delete_group_for_everyone,
    group_detail,
    group_list_create,
    group_messages,
    mark_group_read,
    remove_group_member,
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
    path("groups/", group_list_create, name="chat-groups"),
    path("groups/<int:room_id>/", group_detail, name="chat-group-detail"),
    path("groups/<int:room_id>/messages/", group_messages, name="chat-group-messages"),
    path("groups/<int:room_id>/mark-read/", mark_group_read, name="chat-group-mark-read"),
    path("groups/<int:room_id>/clear/", clear_group_history, name="chat-group-clear"),
    path("groups/<int:room_id>/delete/", delete_group_for_everyone, name="chat-group-delete"),
    path("groups/<int:room_id>/members/", add_group_members, name="chat-group-add-members"),
    path(
        "groups/<int:room_id>/members/<int:user_id>/",
        remove_group_member,
        name="chat-group-remove-member",
    ),
]
