"""REST endpoints for the handshake coin economy."""
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.coins.models import EXCHANGE_RATES, LEVEL_THRESHOLDS, CoinTransaction
from apps.coins.serializers import (
    CoinBalanceSerializer,
    CoinTransactionSerializer,
    DonationSerializer,
    ExchangeSerializer,
)
from apps.coins.services import InsufficientCoins, InvalidExchange, exchange, level_progress, transfer


@extend_schema(tags=["coins"])
class CoinBalanceView(APIView):
    """Current balances, level and progress toward the next level."""

    permission_classes = [IsAuthenticated]
    serializer_class = CoinBalanceSerializer

    @extend_schema(responses={200: CoinBalanceSerializer})
    def get(self, request):
        payload = level_progress(request.user)
        payload["exchange_rates"] = EXCHANGE_RATES
        return Response(CoinBalanceSerializer(payload).data)


@extend_schema(tags=["coins"])
class ExchangeView(APIView):
    """Burn lower-rarity handshakes to mint a higher rarity."""

    permission_classes = [IsAuthenticated]
    serializer_class = ExchangeSerializer

    @extend_schema(request=ExchangeSerializer, responses={200: dict})
    def post(self, request):
        serializer = ExchangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = exchange(
                request.user,
                serializer.validated_data["target_rarity"],
                serializer.validated_data.get("count", 1),
            )
        except InsufficientCoins as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except InvalidExchange as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)


@extend_schema(tags=["coins"])
class TransactionHistoryView(ListAPIView):
    """Paginated ledger of all coin movements involving the current user."""

    permission_classes = [IsAuthenticated]
    serializer_class = CoinTransactionSerializer

    def get_queryset(self):
        from django.db.models import Q

        return (
            CoinTransaction.objects.filter(
                Q(from_user=self.request.user) | Q(to_user=self.request.user)
            )
            .select_related("from_user", "to_user")
            .order_by("-created_at")
        )


@extend_schema(tags=["coins"])
class DonationView(APIView):
    """Send handshakes to another user (optionally inside a chat room)."""

    permission_classes = [IsAuthenticated]
    serializer_class = DonationSerializer

    @extend_schema(request=DonationSerializer, responses={201: dict})
    def post(self, request):
        serializer = DonationSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        recipient = serializer.context["recipient"]
        data = serializer.validated_data
        try:
            new_balance = transfer(
                request.user,
                recipient,
                data["rarity"],
                data["amount"],
                CoinTransaction.Type.DONATION,
                memo=data.get("memo", ""),
            )
        except InsufficientCoins as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        from apps.notifications.services import notify

        notify(
            recipient,
            "coin_donation",
            title="You received handshakes",
            body=f"@{request.user.username} sent you {data['amount']} {data['rarity']} handshakes.",
            data={"amount": data["amount"], "rarity": data["rarity"], "from": request.user.username},
        )
        return Response(
            {
                "detail": "Donation sent.",
                "recipient": recipient.username,
                "recipient_balance": new_balance,
            },
            status=status.HTTP_201_CREATED,
        )


@extend_schema(tags=["coins"])
class LevelInfoView(APIView):
    """Static reference data: level ladder and exchange rates."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: dict})
    def get(self, request):
        return Response({"levels": LEVEL_THRESHOLDS, "exchange_rates": EXCHANGE_RATES})
