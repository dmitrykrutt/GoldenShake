"""Serializers for call history and ICE configuration."""
from rest_framework import serializers

from apps.accounts.serializers import PublicUserSerializer
from apps.calls.models import CallLog, IceServer


class CallLogSerializer(serializers.ModelSerializer):
    caller = PublicUserSerializer(read_only=True)
    participants = PublicUserSerializer(many=True, read_only=True)

    class Meta:
        model = CallLog
        fields = (
            "id",
            "room",
            "caller",
            "participants",
            "call_type",
            "status",
            "started_at",
            "answered_at",
            "ended_at",
            "duration_seconds",
        )
        read_only_fields = fields


class CallStartSerializer(serializers.Serializer):
    room = serializers.UUIDField()
    call_type = serializers.ChoiceField(choices=CallLog.Type.choices, default=CallLog.Type.AUDIO)


class IceServerSerializer(serializers.ModelSerializer):
    class Meta:
        model = IceServer
        fields = ("urls", "username", "credential")
        read_only_fields = fields
