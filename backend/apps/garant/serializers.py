"""Serializers for escrow deals, payments and disputes."""
from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from apps.accounts.serializers import PublicUserSerializer
from apps.garant.models import GarantDeal, GarantDispute, GarantPayment


class GarantPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = GarantPayment
        fields = (
            "id",
            "cryptopay_invoice_id",
            "pay_url",
            "amount",
            "currency",
            "status",
            "paid_at",
            "created_at",
        )
        read_only_fields = fields


class GarantDisputeSerializer(serializers.ModelSerializer):
    complainant = PublicUserSerializer(read_only=True)

    class Meta:
        model = GarantDispute
        fields = (
            "id",
            "deal",
            "complainant",
            "description",
            "evidence_url",
            "status",
            "resolution_note",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "complainant", "status", "resolution_note", "created_at", "updated_at")


class GarantDealSerializer(serializers.ModelSerializer):
    creator = PublicUserSerializer(read_only=True)
    buyer = PublicUserSerializer(read_only=True)
    payments = GarantPaymentSerializer(many=True, read_only=True)
    disputes = GarantDisputeSerializer(many=True, read_only=True)
    platform_fee = serializers.DecimalField(max_digits=20, decimal_places=8, read_only=True)
    seller_payout = serializers.DecimalField(max_digits=20, decimal_places=8, read_only=True)
    private_url = serializers.CharField(read_only=True)

    class Meta:
        model = GarantDeal
        fields = (
            "id",
            "creator",
            "buyer",
            "title",
            "description",
            "price_crypto",
            "crypto_currency",
            "status",
            "private_link_token",
            "private_url",
            "platform_fee_pct",
            "platform_fee",
            "seller_payout",
            "room",
            "payments",
            "disputes",
            "buyer_agreed_at",
            "completed_at",
            "confirmed_at",
            "released_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class GarantDealPublicSerializer(serializers.ModelSerializer):
    """What an invited buyer sees before agreeing (no internal tokens)."""

    creator = PublicUserSerializer(read_only=True)
    platform_fee = serializers.DecimalField(max_digits=20, decimal_places=8, read_only=True)

    class Meta:
        model = GarantDeal
        fields = (
            "id",
            "creator",
            "title",
            "description",
            "price_crypto",
            "crypto_currency",
            "status",
            "platform_fee_pct",
            "platform_fee",
            "created_at",
        )
        read_only_fields = fields


class GarantDealCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = GarantDeal
        fields = ("title", "description", "price_crypto", "crypto_currency")

    def validate_price_crypto(self, value):
        if value <= Decimal("0"):
            raise serializers.ValidationError("Price must be greater than zero.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        from django.conf import settings

        return GarantDeal.objects.create(
            creator=self.context["request"].user,
            platform_fee_pct=getattr(settings, "GARANT_PLATFORM_FEE_PCT", 5),
            **validated_data,
        )

    def to_representation(self, instance):
        return GarantDealSerializer(instance, context=self.context).data


class GarantDisputeCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = GarantDispute
        fields = ("description", "evidence_url")
