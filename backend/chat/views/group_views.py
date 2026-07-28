import logging

from django.contrib.auth import get_user_model
from django.db import models, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from chat.models import ChatRoom, ChatRoomMember, ChatRoomMessage
from chat.serializer import (
    ChatRoomCreateSerializer,
    ChatRoomMessageSerializer,
    ChatRoomSerializer,
)
from friends.models import Friendship
from utils.notifications.notify import notify_user


User = get_user_model()
logger = logging.getLogger("chat.group_views")


def _active_membership(room_id, user):
    return ChatRoomMember.objects.filter(
        room_id=room_id,
        room__archived_at__isnull=True,
        user=user,
        left_at__isnull=True,
    ).first()


def _require_active_member(room_id, user):
    membership = _active_membership(room_id, user)
    if not membership:
        raise PermissionDenied("You are not a member of this group.")
    return membership


def _require_admin(room_id, user):
    membership = _require_active_member(room_id, user)
    if membership.role not in (ChatRoomMember.ROLE_OWNER, ChatRoomMember.ROLE_ADMIN):
        raise PermissionDenied("Only group admins can manage members.")
    return membership


def _accepted_friend_ids(user):
    rows = Friendship.objects.filter(
        is_accepted=True,
    ).filter(
        models.Q(from_user=user) | models.Q(to_user=user)
    ).values_list("from_user_id", "to_user_id")

    ids = set()
    for from_id, to_id in rows:
        ids.add(to_id if from_id == user.id else from_id)
    return ids


def _validate_friend_member_ids(user, member_ids):
    friend_ids = _accepted_friend_ids(user)
    invalid = [member_id for member_id in member_ids if member_id not in friend_ids]
    if invalid:
        raise ValidationError(
            {"member_ids": "Groups can only include accepted friends."}
        )
    users = list(User.objects.filter(id__in=member_ids))
    if len(users) != len(set(member_ids)):
        raise ValidationError({"member_ids": "One or more members do not exist."})
    return users


def _notify_group_membership(*, user_ids, room, event_type, actor):
    payload = {
        "type": event_type,
        "room_id": room.id,
        "room_name": room.name,
        "actor_id": actor.id,
        "actor_name": actor.first_name,
    }
    for user_id in user_ids:
        try:
            notify_user(user_id=user_id, payload=payload)
        except Exception:
            logger.exception(
                "Failed to notify user=%s about room=%s event=%s",
                user_id,
                room.id,
                event_type,
            )


def _active_room_member_ids(room):
    return list(
        ChatRoomMember.objects.filter(
            room=room,
            left_at__isnull=True,
        ).values_list("user_id", flat=True)
    )


@api_view(["GET", "POST"])
@permission_classes([permissions.IsAuthenticated])
def group_list_create(request):
    if request.method == "GET":
        rooms = (
            ChatRoom.objects.filter(
                archived_at__isnull=True,
                memberships__user=request.user,
                memberships__left_at__isnull=True,
            )
            .prefetch_related("memberships__user")
            .distinct()
        )
        return Response(ChatRoomSerializer(rooms, many=True).data)

    serializer = ChatRoomCreateSerializer(
        data=request.data,
        context={"request": request},
    )
    serializer.is_valid(raise_exception=True)

    member_ids = serializer.validated_data["member_ids"]
    users = _validate_friend_member_ids(request.user, member_ids)

    with transaction.atomic():
        room = ChatRoom.objects.create(
            name=serializer.validated_data["name"],
            created_by=request.user,
        )
        ChatRoomMember.objects.create(
            room=room,
            user=request.user,
            role=ChatRoomMember.ROLE_OWNER,
            last_read_at=timezone.now(),
        )
        ChatRoomMember.objects.bulk_create(
            [
                ChatRoomMember(room=room, user=user, role=ChatRoomMember.ROLE_MEMBER)
                for user in users
            ]
        )

    room = ChatRoom.objects.prefetch_related("memberships__user").get(id=room.id)
    _notify_group_membership(
        user_ids=[user.id for user in users],
        room=room,
        event_type="group_created",
        actor=request.user,
    )
    return Response(ChatRoomSerializer(room).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([permissions.IsAuthenticated])
def group_detail(request, room_id):
    room = get_object_or_404(ChatRoom, id=room_id, archived_at__isnull=True)
    membership = _require_active_member(room.id, request.user)

    if request.method == "GET":
        return Response(ChatRoomSerializer(room).data)

    if request.method == "PATCH":
        if membership.role not in (ChatRoomMember.ROLE_OWNER, ChatRoomMember.ROLE_ADMIN):
            raise PermissionDenied("Only group admins can rename this group.")
        name = str(request.data.get("name") or "").strip()
        if len(name) < 2 or len(name) > 80:
            raise ValidationError({"name": "Group name must be 2-80 characters."})
        room.name = name
        room.save(update_fields=["name", "updated_at"])
        return Response(ChatRoomSerializer(room).data)

    membership.leave()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["DELETE"])
@permission_classes([permissions.IsAuthenticated])
def delete_group_for_everyone(request, room_id):
    room = get_object_or_404(ChatRoom, id=room_id, archived_at__isnull=True)
    membership = _require_active_member(room.id, request.user)
    if membership.role != ChatRoomMember.ROLE_OWNER:
        raise PermissionDenied("Only the group owner can delete this group.")

    member_ids = _active_room_member_ids(room)
    room.archive_for_everyone(request.user)
    _notify_group_membership(
        user_ids=[user_id for user_id in member_ids if user_id != request.user.id],
        room=room,
        event_type="group_deleted",
        actor=request.user,
    )
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def group_messages(request, room_id):
    membership = _require_active_member(room_id, request.user)
    qs = ChatRoomMessage.objects.filter(room_id=room_id, room__archived_at__isnull=True).select_related("sender")
    if membership.deleted_at:
        qs = qs.filter(timestamp__gt=membership.deleted_at)
    return Response(ChatRoomMessageSerializer(qs.order_by("timestamp"), many=True).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def mark_group_read(request, room_id):
    membership = _require_active_member(room_id, request.user)
    membership.mark_read()
    return Response({"updated": 1}, status=status.HTTP_200_OK)


@api_view(["DELETE"])
@permission_classes([permissions.IsAuthenticated])
def clear_group_history(request, room_id):
    membership = _require_active_member(room_id, request.user)
    membership.mark_deleted()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def add_group_members(request, room_id):
    room = get_object_or_404(ChatRoom, id=room_id, archived_at__isnull=True)
    _require_admin(room.id, request.user)

    member_ids = request.data.get("member_ids", [])
    if not isinstance(member_ids, list) or not member_ids:
        raise ValidationError({"member_ids": "Provide at least one member id."})
    try:
        member_ids = list(dict.fromkeys(int(member_id) for member_id in member_ids))
    except (TypeError, ValueError):
        raise ValidationError({"member_ids": "Member ids must be integers."})
    member_ids = [member_id for member_id in member_ids if member_id != request.user.id]

    users = _validate_friend_member_ids(request.user, member_ids)

    notified_user_ids = []

    with transaction.atomic():
        for user in users:
            membership, created = ChatRoomMember.objects.get_or_create(
                room=room,
                user=user,
                defaults={"role": ChatRoomMember.ROLE_MEMBER},
            )
            if created:
                notified_user_ids.append(user.id)
            elif membership.left_at is not None:
                membership.left_at = None
                membership.deleted_at = None
                membership.save(update_fields=["left_at", "deleted_at"])
                notified_user_ids.append(user.id)
        room.save(update_fields=["updated_at"])

    room = ChatRoom.objects.prefetch_related("memberships__user").get(id=room.id)
    if notified_user_ids:
        _notify_group_membership(
            user_ids=notified_user_ids,
            room=room,
            event_type="group_member_added",
            actor=request.user,
        )
    return Response(ChatRoomSerializer(room).data)


@api_view(["DELETE"])
@permission_classes([permissions.IsAuthenticated])
def remove_group_member(request, room_id, user_id):
    room = get_object_or_404(ChatRoom, id=room_id, archived_at__isnull=True)
    target = get_object_or_404(
        ChatRoomMember,
        room=room,
        user_id=user_id,
        left_at__isnull=True,
    )

    is_self = target.user_id == request.user.id
    if not is_self:
        _require_admin(room.id, request.user)
    else:
        _require_active_member(room.id, request.user)

    if target.role == ChatRoomMember.ROLE_OWNER and not is_self:
        raise ValidationError("The owner cannot be removed by another member.")

    target.leave()
    room.save(update_fields=["updated_at"])
    return Response(status=status.HTTP_204_NO_CONTENT)


def get_group_unread_summary_for_user(user):
    memberships = ChatRoomMember.objects.filter(
        user=user,
        room__archived_at__isnull=True,
        left_at__isnull=True,
    ).values("room_id", "last_read_at", "deleted_at")

    unread = {}
    for membership in memberships:
        cutoff = membership["last_read_at"]
        deleted_at = membership["deleted_at"]
        qs = ChatRoomMessage.objects.filter(room_id=membership["room_id"]).exclude(sender=user)
        if cutoff:
            qs = qs.filter(timestamp__gt=cutoff)
        if deleted_at:
            qs = qs.filter(timestamp__gt=deleted_at)
        count = qs.count()
        if count:
            unread[str(membership["room_id"])] = count

    return unread
