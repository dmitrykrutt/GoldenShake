"""Serializers for coin balances, exchanges, fiat and CryptoPay checks."""
from decimal import Decimal
from rest_framework import serializers

from apps.coins.models import EXCHANGE_RATES, RARITY_ORDER, CoinTransaction, HandshakeCoin


class HandshakeCoinSerializer(serializers.ModelSerializer):
    class Meta:
        model = HandshakeCoin
        fields = ("rarity", "amount", "updated_at")
        read_only_fields = fields


class CoinBalanceSerializer(serializers.Serializer):
    balances = serializers.DictField(child=serializers.IntegerField())
    level = serializers.CharField()
    next_level = serializers.CharField(allow_null=True)
    next_rarity = serializers.CharField(required=False, allow_null=True)
    needed = serializers.IntegerField()
    exchange_rates = serializers.DictField(required=False)


class ExchangeSerializer(serializers.Serializer):
    target_rarity = serializers.ChoiceField(choices=[r for r in RARITY_ORDER if r != "green"])
    count = serializers.IntegerField(min_value=1, max_value=1000, default=1)

    def validate_target_rarity(self, value):
        if value not in EXCHANGE_RATES:
            raise serializers.ValidationError("This rarity cannot be minted by exchange.")
        return value


class CoinTransactionSerializer(serializers.ModelSerializer):
    from_username = serializers.CharField(source="from_user.username", default=None, read_only=True)
    to_username = serializers.CharField(source="to_user.username", default=None, read_only=True)

    class Meta:
        model = CoinTransaction
        fields = (
            "id",
            "from_user",
            "from_username",
            "to_user",
            "to_username",
            "amount",
            "rarity",
            "transaction_type",
            "memo",
            "metadata",
            "created_at",
        )
        read_only_fields = fields


class DonationSerializer(serializers.Serializer):
    recipient_username = serializers.CharField()
    rarity = serializers.ChoiceField(choices=RARITY_ORDER)
    amount = serializers.IntegerField(min_value=1, max_value=100000)
    room_id = serializers.UUIDField(required=False, allow_null=True)
    memo = serializers.CharField(max_length=255, required=False, allow_blank=True)

    def validate_recipient_username(self, value):
        from django.contrib.auth import get_user_model

        User = get_user_model()
        recipient = User.objects.filter(username__iexact=value).first()
        if recipient is None:
            raise serializers.ValidationError("Recipient not found.")
        if recipient == self.context["request"].user:
            raise serializers.ValidationError("You cannot donate to yourself.")
        self.context["recipient"] = recipient
        return value


class FiatBalanceSerializer(serializers.Serializer):
    currency = serializers.CharField()
    amount = serializers.DecimalField(max_digits=18, decimal_places=2)
    updated_at = serializers.DateTimeField()


class FiatTransactionSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    currency = serializers.CharField()
    amount = serializers.DecimalField(max_digits=18, decimal_places=2)
    tx_type = serializers.CharField()
    description = serializers.CharField()
    created_at = serializers.DateTimeField()


class DepositSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=Decimal("0.01"))
    currency = serializers.CharField(max_length=10)


class WithdrawSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=Decimal("0.01"))
    currency = serializers.ChoiceField(choices=["USDT", "TON"])
