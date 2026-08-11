from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from apps.accounts.models import (
    EmailConfirmation,
    InviteLink,
    TOTPDevice,
    User,
    UserInvite,
    VerificationRequest,
)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("-date_joined",)
    list_display = ("username", "email", "is_verified", "is_email_confirmed", "totp_enabled", "is_staff")
    list_filter = ("is_verified", "is_email_confirmed", "totp_enabled", "is_staff", "is_active")
    search_fields = ("username", "email", "phone")
    readonly_fields = ("date_joined", "last_login", "last_seen")
    fieldsets = (
        (None, {"fields": ("email", "username", "password")}),
        ("Profile", {"fields": ("phone", "avatar", "bio", "social_links", "theme_color")}),
        (
            "Preferences",
            {
                "fields": (
                    "private_profile",
                    "paid_messages_enabled",
                    "paid_message_price",
                    "newsletter_opt_in",
                )
            },
        ),
        ("Security", {"fields": ("totp_secret", "totp_enabled", "public_key")}),
        ("Compliance", {"fields": ("is_18_confirmed", "tos_confirmed", "gdpr_data_requested")}),
        (
            "Permissions",
            {"fields": ("is_active", "is_staff", "is_superuser", "is_verified", "groups", "user_permissions")},
        ),
        ("Dates", {"fields": ("last_login", "date_joined", "last_seen")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "username", "password1", "password2"),
            },
        ),
    )


@admin.register(InviteLink)
class InviteLinkAdmin(admin.ModelAdmin):
    list_display = ("hash_token", "creator", "use_count", "max_uses", "is_active", "created_at")
    search_fields = ("hash_token", "creator__username")
    list_filter = ("is_active",)


@admin.register(UserInvite)
class UserInviteAdmin(admin.ModelAdmin):
    list_display = ("inviter", "invitee", "rewarded", "created_at")
    search_fields = ("inviter__username", "invitee__username")


@admin.register(EmailConfirmation)
class EmailConfirmationAdmin(admin.ModelAdmin):
    list_display = ("user", "purpose", "is_used", "expires_at", "created_at")
    list_filter = ("purpose", "is_used")


@admin.register(TOTPDevice)
class TOTPDeviceAdmin(admin.ModelAdmin):
    list_display = ("user", "confirmed", "created_at")
    list_filter = ("confirmed",)


@admin.register(VerificationRequest)
class VerificationRequestAdmin(admin.ModelAdmin):
    list_display = ("user", "status", "created_at", "updated_at")
    list_filter = ("status",)
    search_fields = ("user__username",)
