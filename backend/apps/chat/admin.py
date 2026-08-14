from django.contrib import admin

from apps.chat.models import (
    ChatRoom,
    LockedFile,
    Message,
    PinnedChat,
    RoomMembership,
    SupportTicket,
)


class RoomMembershipInline(admin.TabularInline):
    model = RoomMembership
    extra = 0


@admin.register(ChatRoom)
class ChatRoomAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "is_group", "is_support", "is_garant_chat", "updated_at")
    list_filter = ("is_group", "is_support", "is_garant_chat")
    inlines = [RoomMembershipInline]
    filter_horizontal = ("deleted_for_users",)


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    """Message bodies are encrypted and intentionally not rendered here."""

    list_display = ("id", "room", "sender", "message_type", "is_pinned", "deleted_for_all", "created_at")
    list_filter = ("message_type", "is_pinned", "deleted_for_all")
    readonly_fields = ("id", "content", "created_at")


@admin.register(LockedFile)
class LockedFileAdmin(admin.ModelAdmin):
    list_display = ("id", "message", "price_amount", "price_rarity", "created_at")


@admin.register(PinnedChat)
class PinnedChatAdmin(admin.ModelAdmin):
    list_display = ("user", "room", "order", "created_at")


@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = ("subject", "opened_by", "status", "assigned_to", "created_at")
    list_filter = ("status",)
