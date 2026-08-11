"""Serializers for notifications, devices and preferences."""
from rest_framework import serializers

from apps.notifications.models import DeviceToken, Notification, NotificationPreference


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ("id", "type", "title", "body", "data", "read", "created_at")
        read_only_fields = ("id", "type", "title", "body", "data", "created_at")


class DeviceTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceToken
        fields = ("id", "token", "platform", "is_active", "created_at")
        read_only_fields = ("id", "is_active", "created_at")


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = ("push_enabled", "email_enabled", "telegram_enabled", "mute_until")
