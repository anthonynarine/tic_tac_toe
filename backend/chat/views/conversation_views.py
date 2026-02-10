# # Filename: chat/conversation_views.py

"""
chat/conversation_views.py

This module contains REST views for 1-on-1 Direct Message conversations.

Production behaviors implemented here:
- Conversation IDs are stable per user-pair (users sorted, get_or_create).
- "Delete conversation" is a per-user soft delete (does not destroy history for the other user).
- If a user has deleted the conversation, fetching messages returns ONLY messages AFTER their deleted cutoff
  (i.e., "clear history for me" behavior).
- Mark-read updates only the requesting user's unread messages.
- Unread-summary respects per-user deletion cutoffs (deleted history does not count toward unread).
"""

from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.db.models import Count, Q, F

from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from chat.models import Conversation, DirectMessage
from chat.serializer import DirectMessageSerializer


User = get_user_model()


class ConversationMessageListView(generics.ListAPIView):
    """
    List all messages in a conversation for an authenticated participant.

    Key behaviors:
    - Only participants can access the conversation.
    - If the requesting user has soft-deleted this conversation, only returns messages AFTER their deleted cutoff
      (so the UI shows an empty thread after deletion, until new messages arrive).
    - Otherwise, returns all messages sorted by timestamp ascending.
    """

    serializer_class = DirectMessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Returns a queryset of messages for the conversation if permitted.

        - Raises 403 if requester is not a participant.
        - If conversation was deleted by requester, only returns messages AFTER their deleted cutoff.
        """
        conversation_id = self.kwargs.get("conversation_id")
        convo = get_object_or_404(Conversation, id=conversation_id)

        user = self.request.user

        if not convo.includes(user):
            raise PermissionDenied("You are not a participant in this conversation.")

        qs = convo.messages.all().order_by("timestamp")

        # Step 1: "Clear history for me" via per-user deleted_at cutoff timestamps
        # If user1_deleted_at exists for this requester, hide anything at/before that timestamp.
        if user == convo.user1 and getattr(convo, "user1_deleted_at", None):
            return qs.filter(timestamp__gt=convo.user1_deleted_at)

        # If user2_deleted_at exists for this requester, hide anything at/before that timestamp.
        if user == convo.user2 and getattr(convo, "user2_deleted_at", None):
            return qs.filter(timestamp__gt=convo.user2_deleted_at)

        return qs


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def get_conversation_with(request, friend_id):
    """
    Resolve (or create) the stable 1-on-1 conversation between the authenticated user and friend.

    Returns:
      { "conversation_id": <int> }

    IMPORTANT:
    - This endpoint MUST NOT revive a deleted conversation. Deletion should remain in effect
      until a NEW message arrives (revival happens in the message-send path, not on open).
    """
    user = request.user
    friend = get_object_or_404(User, id=friend_id)

    # Ensure the unique_together constraint holds regardless of who requests it.
    user1, user2 = sorted([user, friend], key=lambda u: u.id)
    convo, _ = Conversation.objects.get_or_create(user1=user1, user2=user2)

    return Response({"conversation_id": convo.id}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def mark_conversation_read(request, conversation_id):
    """
    Mark all unread messages in a conversation as read for the requesting user.

    Behavior:
    - Only participants can mark a conversation read.
    - Only messages where receiver == request.user are updated.
    - If the user has deleted the conversation, this still safely returns OK (no harm).
    """
    convo = get_object_or_404(Conversation, id=conversation_id)

    if not convo.includes(request.user):
        raise PermissionDenied("You are not a participant in this conversation.")

    updated = (
        DirectMessage.objects.filter(conversation=convo, receiver=request.user, is_read=False)
        .update(is_read=True)
    )

    return Response({"updated": updated}, status=status.HTTP_200_OK)


@api_view(["DELETE"])
@permission_classes([permissions.IsAuthenticated])
def delete_conversation(request, conversation_id):
    """
    Soft-delete a conversation for the requesting user only.

    Production semantics:
    - This does NOT delete the conversation for the other participant.
    - After deletion, fetching messages returns only messages newer than the user's deleted_at cutoff.
      (So the UI appears empty until new messages arrive.)
    - Unread counts should also ignore messages at/before the cutoff.

    Requires:
    - Conversation.mark_deleted_for(user)
    - Conversation has per-user deleted cutoff fields (e.g., user1_deleted_at/user2_deleted_at)
    """
    convo = get_object_or_404(Conversation, id=conversation_id)

    if not convo.includes(request.user):
        raise PermissionDenied("You are not a participant in this conversation.")

    # Step 1: Record deletion cutoff for this user
    convo.mark_deleted_for(request.user)

    # Step 2: 204 is the most REST-standard response for successful delete.
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def get_unread_summary(request):
    """
    Returns unread DM counts for the authenticated user grouped by sender.
    Used to rehydrate unread badges after refresh.

    IMPORTANT:
    - Respects per-user deletion cutoffs so a "cleared" conversation does not contribute unread
      for messages at/before the cutoff.
    """
    user = request.user

    base = DirectMessage.objects.filter(receiver=user, is_read=False)

    # Step 1: Apply deletion cutoff semantics (clear history for me)
    # If I'm convo.user1: allow unread if user1_deleted_at is null OR msg.timestamp > user1_deleted_at
    cond_user1 = (
        Q(conversation__user1=user)
        & (Q(conversation__user1_deleted_at__isnull=True) | Q(timestamp__gt=F("conversation__user1_deleted_at")))
    )

    # If I'm convo.user2: allow unread if user2_deleted_at is null OR msg.timestamp > user2_deleted_at
    cond_user2 = (
        Q(conversation__user2=user)
        & (Q(conversation__user2_deleted_at__isnull=True) | Q(timestamp__gt=F("conversation__user2_deleted_at")))
    )

    qs = (
        base.filter(cond_user1 | cond_user2)
        .values("sender_id")
        .annotate(count=Count("id"))
    )

    by_friend = {str(row["sender_id"]): row["count"] for row in qs}
    total = sum(by_friend.values())

    return Response(
        {
            "dm_unread_total": total,
            "by_friend": by_friend,
        },
        status=status.HTTP_200_OK,
    )
