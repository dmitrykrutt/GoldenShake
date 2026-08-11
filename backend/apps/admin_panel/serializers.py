"""Serializers used by the staff admin panel."""
from rest_framework import serializers

from apps.accounts.serializers import PublicUserSerializer
from apps.admin_panel.models import AdminAction, BannedUser


class AdminActionSerializer(serializers.ModelSerializer):
    actor = PublicUserSerializer(read_only=True)

    class Meta:
        model = AdminAction
        fields = ("id", "actor", "action", "target_type", "target_id", "note", "metadata", "created_at")
        read_only_fields = fields


class BannedUserSerializer(serializers.ModelSerializer):
    user = PublicUserSerializer(read_only=True)

    class Meta:
        model = BannedUser
        fields = ("id", "user", "reason", "expires_at", "created_at")
        read_only_fields = ("id", "user", "created_at")


class ReviewSerializer(serializers.Serializer):
    """Approve/reject payload used by verification and dispute reviews."""

    decision = serializers.ChoiceField(choices=["approve", "reject"])
    note = serializers.CharField(max_length=2000, required=False, allow_blank=True)


class BanSerializer(serializers.Serializer):
    username = serializers.CharField()
    reason = serializers.CharField(max_length=2000)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)


class GrantCoinsSerializer(serializers.Serializer):
    username = serializers.CharField()
    rarity = serializers.ChoiceField(choices=["green", "blue", "purple", "red", "gold"])
    amount = serializers.IntegerField(min_value=1, max_value=100000)
    note = serializers.CharField(max_length=255, required=False, allow_blank=True)


class DisputeResolveSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=["buyer", "seller", "reject"])
    note = serializers.CharField(max_length=2000, required=False, allow_blank=True)
