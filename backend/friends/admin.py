from django.contrib import admin
from .models import Friendship

@admin.register(Friendship)
class FriendshipAdmin(admin.ModelAdmin):
    list_display = ("from_user", "to_user", "is_accepted", "created_at")
    search_fields = ("from_user__email", "to_user__email")
    list_filter = ("is_accepted", "created_at")
