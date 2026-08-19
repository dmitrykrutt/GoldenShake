"""REST endpoints for coins, fiat balances and instant CryptoPay check withdrawals."""
import json
import logging
from decimal import Decimal

from django.db import transaction as db_transaction
from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.coins.models import (
    EXCHANGE_RATES,
    LEVEL_THRESHOLDS,
    CoinTransaction,
    DepositInvoice,
    FiatBalance,
    FiatTransaction,
    WithdrawalRequest,
)
from apps.coins.serializers import (
    CoinBalanceSerializer,
    CoinTransactionSerializer,
    DepositSerializer,
    DonationSerializer,
    ExchangeSerializer,
    WithdrawSerializer,
)
from apps.coins.services import InsufficientCoins, InvalidExchange, exchange, level_progress, transfer
from apps.garant.cryptopay import CryptoPayClient, CryptoPayError

logger = logging.getLogger(__name__)


@extend_schema(tags=["coins"])
class CoinBalanceView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CoinBalanceSerializer

    @extend_schema(responses={200: CoinBalanceSerializer})
    def get(self, request):
        payload = level_progress(request.user)
        payload["exchange_rates"] = EXCHANGE_RATES
        return Response(CoinBalanceSerializer(payload).data)


@extend_schema(tags=["coins"])
class ExchangeView(APIView):
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
        except (InsufficientCoins, InvalidExchange) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)


@extend_schema(tags=["coins"])
class TransactionHistoryView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CoinTransactionSerializer

    def get_queryset(self):
        return (
            CoinTransaction.objects.filter(
                Q(from_user=self.request.user) | Q(to_user=self.request.user)
            )
            .select_related("from_user", "to_user")
            .order_by("-created_at")
        )


@extend_schema(tags=["coins"])
class DonationView(APIView):
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
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: dict})
    def get(self, request):
        return Response({"levels": LEVEL_THRESHOLDS, "exchange_rates": EXCHANGE_RATES})


@extend_schema(tags=["coins"])
class FiatBalanceListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: list})
    def get(self, request):
        balances = FiatBalance.objects.filter(user=request.user).values(
            "currency", "amount", "updated_at"
        )
        return Response(list(balances))


@extend_schema(tags=["coins"])
class FiatTransactionListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: list})
    def get(self, request):
        txs = FiatTransaction.objects.filter(user=request.user).values(
            "id", "currency", "amount", "tx_type", "description", "created_at"
        )
        return Response(list(txs))


@extend_schema(tags=["coins"])
class DepositView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={201: dict})
    def post(self, request):
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
                {"detail": "Платежный шлюз не настроен."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        try:
            invoice = client.create_invoice(
                amount=amount,
                asset=currency,
                description=f"Пополнение GoldenShake для @{request.user.username}",
                payload=json.dumps(
                    {"deposit_invoice_id": str(invoice_obj.id), "user_id": str(request.user.id)}
                ),
            )
        except CryptoPayError as exc:
            return Response(
                {"detail": f"Ошибка платежного провайдера: {exc}"},
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
    """Instant withdrawal by generating a CryptoPay Check."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: dict})
    def post(self, request):
        serializer = WithdrawSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        amount = serializer.validated_data["amount"]
        currency = serializer.validated_data["currency"].upper()

        client = CryptoPayClient()
        if not client.is_configured:
            return Response(
                {"detail": "Платежный шлюз не настроен."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # 1. Проверяем баланс пользователя
        balance = FiatBalance.objects.filter(user=request.user, currency=currency).first()
        available = balance.amount if balance else Decimal("0.00")
        if available < amount:
            return Response(
                {"detail": f"Недостаточно средств на балансе: доступно {available} {currency}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 2. Вызываем CryptoPay createCheck
        try:
            check_data = client.create_check(asset=currency, amount=amount)
        except CryptoPayError as exc:
            logger.error("Failed to create CryptoPay check: %s", exc)
            return Response(
                {"detail": f"Ошибка создания чека CryptoPay: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        check_url = check_data.get("bot_check_url") or check_data.get("check_url", "")
        check_id = str(check_data.get("check_id", ""))

        # 3. Атомарно списываем баланс после успешного создания чека
        with db_transaction.atomic():
            locked_balance = FiatBalance.objects.select_for_update().get(user=request.user, currency=currency)
            locked_balance.amount -= amount
            locked_balance.save(update_fields=["amount", "updated_at"])

            withdrawal = WithdrawalRequest.objects.create(
                user=request.user,
                currency=currency,
                network="CryptoPay Check",
                amount=amount,
                wallet_address=check_url or f"Check #{check_id}",
                status=WithdrawalRequest.COMPLETED,
            )
            FiatTransaction.objects.create(
                user=request.user,
                currency=currency,
                amount=amount,
                tx_type=FiatTransaction.WITHDRAWAL,
                description=f"Чек CryptoPay #{check_id}",
            )

        logger.info(
            "CryptoPay check created #%s: %s %s for user @%s url=%s",
            check_id, amount, currency, request.user.username, check_url,
        )

        return Response(
            {
                "detail": f"Чек на {amount} {currency} готов к получению!",
                "check_url": check_url,
                "amount": str(amount),
                "currency": currency,
            },
            status=status.HTTP_200_OK,
        )
