from django.contrib import admin

from apps.notifications.models import DeviceToken, Notification, NotificationPreference


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("user", "type", "title", "read", "created_at")
    list_filter = ("type", "read")
    search_fields = ("user__username", "title", "body")


@admin.register(DeviceToken)
class DeviceTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "platform", "is_active", "created_at")
    list_filter = ("platform", "is_active")


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = ("user", "push_enabled", "email_enabled", "telegram_enabled", "mute_until")
