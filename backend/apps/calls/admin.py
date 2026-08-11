from django.contrib import admin

from apps.calls.models import CallLog, IceServer


@admin.register(CallLog)
class CallLogAdmin(admin.ModelAdmin):
    list_display = ("id", "caller", "room", "call_type", "status", "duration_seconds", "started_at")
    list_filter = ("call_type", "status")


@admin.register(IceServer)
class IceServerAdmin(admin.ModelAdmin):
    list_display = ("urls", "username", "is_active")
    list_filter = ("is_active",)
