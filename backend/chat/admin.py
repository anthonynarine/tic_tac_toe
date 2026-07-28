from django.contrib import admin
from chat.models import ChatRoom, ChatRoomMember, ChatRoomMessage, Conversation, DirectMessage


admin.site.register(Conversation)
admin.site.register(DirectMessage)
admin.site.register(ChatRoom)
admin.site.register(ChatRoomMember)
admin.site.register(ChatRoomMessage)
