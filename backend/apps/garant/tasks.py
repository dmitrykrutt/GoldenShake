"""Celery tasks for the escrow lifecycle."""
import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(name="garant.release_funds", bind=True, max_retries=5)
def release_funds_task(self, deal_id: str):
    """Pay out the seller minus the platform fee once the buyer confirms."""
    from apps.garant.cryptopay import CryptoPayClient, CryptoPayError
    from apps.garant.models import GarantDeal
    from apps.notifications.services import notify

    deal = GarantDeal.objects.filter(id=deal_id).select_related("creator", "buyer").first()
    if deal is None:
        return {"ok": False, "error": "deal_not_found"}
    if deal.status != GarantDeal.Status.CONFIRMED:
        return {"ok": False, "error": f"unexpected_status:{deal.status}"}

    client = CryptoPayClient()
    telegram_id = deal.creator.telegram_chat_id
    if client.is_configured and telegram_id:
        try:
            client.transfer(
                user_id=int(telegram_id),
                asset=deal.crypto_currency,
                amount=deal.seller_payout,
                spend_id=f"garant-{deal.id}",
                comment=f"GoldenShake payout for '{deal.title}'",
            )
        except (CryptoPayError, ValueError) as exc:
            logger.error("payout failed for deal %s: %s", deal_id, exc)
            raise self.retry(exc=exc, countdown=60)

    deal.release()
    notify(
        deal.creator,
        "garant",
        title="Funds released",
        body=f"{deal.seller_payout} {deal.crypto_currency} released for '{deal.title}'.",
        data={"deal_id": str(deal.id)},
    )
    if deal.buyer:
        notify(
            deal.buyer,
            "garant",
            title="Deal completed",
            body=f"'{deal.title}' is complete. Thank you for using GoldenShake garant.",
            data={"deal_id": str(deal.id)},
        )
    return {"ok": True, "deal_id": str(deal.id), "payout": str(deal.seller_payout)}


@shared_task(name="garant.expire_stale_invoices")
def expire_stale_invoices():
    """Mark unpaid invoices older than 24h as expired."""
    from datetime import timedelta

    from django.utils import timezone

    from apps.garant.models import GarantPayment

    cutoff = timezone.now() - timedelta(hours=24)
    return GarantPayment.objects.filter(
        status=GarantPayment.Status.PENDING, created_at__lt=cutoff
    ).update(status=GarantPayment.Status.EXPIRED)


@shared_task(name="garant.sync_invoice_status")
def sync_invoice_status(payment_id: str):
    """Poll CryptoPay for an invoice status (fallback when webhooks are lost)."""
    from apps.garant.cryptopay import CryptoPayClient, CryptoPayError
    from apps.garant.models import GarantPayment

    payment = GarantPayment.objects.filter(id=payment_id).select_related("deal").first()
    if payment is None or not payment.cryptopay_invoice_id:
        return {"ok": False}
    try:
        result = CryptoPayClient().get_invoices(invoice_ids=[payment.cryptopay_invoice_id])
    except CryptoPayError as exc:
        logger.warning("invoice sync failed: %s", exc)
        return {"ok": False, "error": str(exc)}

    items = result.get("items", []) if isinstance(result, dict) else []
    if items and items[0].get("status") == "paid":
        payment.mark_paid(items[0])
        payment.deal.mark_paid()
        return {"ok": True, "status": "paid"}
    return {"ok": True, "status": items[0].get("status") if items else "unknown"}
