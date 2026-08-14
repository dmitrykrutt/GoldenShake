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


@extend_schema(tags=["coins"])
class FiatBalanceListView(APIView):
    """List all fiat balances for the authenticated user."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: list})
    def get(self, request):
        from apps.coins.models import FiatBalance

        balances = FiatBalance.objects.filter(user=request.user).values(
            "currency", "amount", "updated_at"
        )
        return Response(list(balances))


@extend_schema(tags=["coins"])
class FiatTransactionListView(APIView):
    """List fiat transaction history for the authenticated user."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: list})
    def get(self, request):
        from apps.coins.models import FiatTransaction

        txs = FiatTransaction.objects.filter(user=request.user).values(
            "id", "currency", "amount", "tx_type", "description", "created_at"
        )
        return Response(list(txs))


@extend_schema(tags=["coins"])
class DepositView(APIView):
    """Create a CryptoPay invoice for a user deposit."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={201: dict})
    def post(self, request):
        from apps.coins.models import DepositInvoice
        from apps.coins.serializers import DepositSerializer
        from apps.garant.cryptopay import CryptoPayClient, CryptoPayError

        serializer = DepositSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        amount = serializer.validated_data["amount"]
        currency = serializer.validated_data["currency"].upper()

        invoice_obj = DepositInvoice.objects.create(
            user=request.user, amount=amount, currency=currency
        )
        client = CryptoPayClient()
        if not client.is_configured:
            return Response(
                {"detail": "Payment provider not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        try:
            import json

            invoice = client.create_invoice(
                amount=amount,
                asset=currency,
                description=f"GoldenShake deposit for @{request.user.username}",
                payload=json.dumps(
                    {"deposit_invoice_id": str(invoice_obj.id), "user_id": str(request.user.id)}
                ),
            )
        except CryptoPayError as exc:
            return Response(
                {"detail": f"Payment provider error: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        invoice_obj.cryptopay_invoice_id = str(invoice.get("invoice_id", ""))
        invoice_obj.pay_url = invoice.get("pay_url") or invoice.get("bot_invoice_url", "")
        invoice_obj.raw_payload = invoice
        invoice_obj.save(update_fields=["cryptopay_invoice_id", "pay_url", "raw_payload"])
        return Response(
            {
                "invoice_id": str(invoice_obj.id),
                "pay_url": invoice_obj.pay_url,
                "amount": str(amount),
                "currency": currency,
            },
            status=status.HTTP_201_CREATED,
        )


@extend_schema(tags=["coins"])
class WithdrawView(APIView):
    """Submit a withdrawal request (processed manually by staff)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={201: dict})
    def post(self, request):
        from apps.coins.models import FiatBalance, WithdrawalRequest
        from apps.coins.serializers import WithdrawSerializer

        serializer = WithdrawSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        amount = serializer.validated_data["amount"]
        currency = serializer.validated_data["currency"].upper()
        wallet = serializer.validated_data["wallet"]

        from django.db import transaction as db_transaction

        with db_transaction.atomic():
            balance = FiatBalance.objects.select_for_update().filter(
                user=request.user, currency=currency
            ).first()
            available = balance.amount if balance else 0
            if available < amount:
                return Response(
                    {"detail": f"Insufficient balance: {available} {currency} available."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if balance:
                balance.amount = available - amount
                balance.save(update_fields=["amount", "updated_at"])
            withdrawal = WithdrawalRequest.objects.create(
                user=request.user,
                currency=currency,
                amount=amount,
                wallet_address=wallet,
            )
            from apps.coins.models import FiatTransaction
            FiatTransaction.objects.create(
                user=request.user,
                currency=currency,
                amount=amount,
                tx_type=FiatTransaction.WITHDRAWAL,
                description=f"Withdrawal to {wallet}",
            )

        return Response(
            {
                "detail": "Withdrawal request submitted and will be processed within 24 hours.",
                "id": withdrawal.id,
                "status": withdrawal.status,
            },
            status=status.HTTP_201_CREATED,
        )
