"""CryptoPay webhook handler for user deposits."""
import json
import logging

from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

logger = logging.getLogger(__name__)


@extend_schema(tags=["coins"], request=dict, responses={200: dict})
@api_view(["POST"])
@permission_classes([AllowAny])
def deposit_webhook(request):
    """Handle CryptoPay webhook for user deposits."""
    from apps.garant.cryptopay import verify_webhook_signature

    signature = request.headers.get("crypto-pay-api-signature", "")
    if not verify_webhook_signature(request.body, signature):
        return Response({"detail": "Invalid signature."}, status=403)

    payload = request.data or {}
    invoice = payload.get("payload") or {}
    invoice_id = str(invoice.get("invoice_id", ""))
    update_type = payload.get("update_type")

    if update_type != "invoice_paid" and invoice.get("status") != "paid":
        return Response({"ok": True})

    from apps.coins.models import DepositInvoice, FiatBalance, FiatTransaction

    deposit = DepositInvoice.objects.filter(cryptopay_invoice_id=invoice_id).first()
    if deposit is None:
        logger.warning("deposit webhook for unknown invoice %s", invoice_id)
        return Response({"ok": True})

    if deposit.status == DepositInvoice.PAID:
        return Response({"ok": True})

    deposit.status = DepositInvoice.PAID
    deposit.raw_payload = invoice
    deposit.save(update_fields=["status", "raw_payload"])

    from django.db import transaction

    with transaction.atomic():
        balance, _ = FiatBalance.objects.select_for_update().get_or_create(
            user=deposit.user, currency=deposit.currency, defaults={"amount": 0}
        )
        balance.amount += deposit.amount
        balance.save(update_fields=["amount", "updated_at"])
        FiatTransaction.objects.create(
            user=deposit.user,
            currency=deposit.currency,
            amount=deposit.amount,
            tx_type=FiatTransaction.DEPOSIT,
            description=f"CryptoPay deposit invoice {invoice_id}",
        )

    return Response({"ok": True})
