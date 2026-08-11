from django.contrib import admin

from apps.admin_panel.models import AdminAction, BannedUser


@admin.register(AdminAction)
class AdminActionAdmin(admin.ModelAdmin):
    list_display = ("created_at", "actor", "action", "target_type", "target_id")
    list_filter = ("action",)
    readonly_fields = ("id", "created_at")


@admin.register(BannedUser)
class BannedUserAdmin(admin.ModelAdmin):
    list_display = ("user", "banned_by", "expires_at", "created_at")
