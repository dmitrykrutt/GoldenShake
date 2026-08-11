"""Escrow deal lifecycle endpoints and the CryptoPay webhook."""
import json
import logging

from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.garant.cryptopay import CryptoPayClient, CryptoPayError, verify_webhook_signature
from apps.garant.models import GarantDeal, GarantDispute, GarantPayment
from apps.garant.serializers import (
    GarantDealCreateSerializer,
    GarantDealPublicSerializer,
    GarantDealSerializer,
    GarantDisputeCreateSerializer,
    GarantDisputeSerializer,
    GarantPaymentSerializer,
)

logger = logging.getLogger(__name__)


def _create_deal_room(deal: GarantDeal):
    """Open a dedicated garant chat room for the two counterparties."""
    from apps.chat.models import ChatRoom, RoomMembership

    if deal.room_id or deal.buyer_id is None:
        return deal.room
    room = ChatRoom.objects.create(
        title=f"Garant: {deal.title}"[:120],
        is_garant_chat=True,
        created_by=deal.creator,
    )
    RoomMembership.objects.create(room=room, user=deal.creator)
    RoomMembership.objects.create(room=room, user=deal.buyer)
    deal.room = room
    deal.save(update_fields=["room"])
    return room


@extend_schema(tags=["garant"])
class GarantDealViewSet(viewsets.ModelViewSet):
    """Guarantee deals: create, share, pay, complete, confirm and dispute."""

    permission_classes = [IsAuthenticated]
    serializer_class = GarantDealSerializer
    queryset = GarantDeal.objects.none()
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        from django.db.models import Q

        return (
            GarantDeal.objects.filter(Q(creator=self.request.user) | Q(buyer=self.request.user))
            .select_related("creator", "buyer", "room")
            .prefetch_related("payments", "disputes")
        )

    def get_serializer_class(self):
        if self.action == "create":
            return GarantDealCreateSerializer
        return GarantDealSerializer

    @extend_schema(responses={200: GarantDealPublicSerializer})
    @action(detail=False, methods=["get"], url_path=r"by-token/(?P<token>[^/]+)")
    def by_token(self, request, token=None):
        """Open a deal through its private link."""
        deal = GarantDeal.objects.filter(private_link_token=token).select_related("creator").first()
        if deal is None:
            return Response({"detail": "Deal not found."}, status=status.HTTP_404_NOT_FOUND)
        if deal.is_participant(request.user):
            return Response(GarantDealSerializer(deal, context={"request": request}).data)
        return Response(GarantDealPublicSerializer(deal, context={"request": request}).data)

    @extend_schema(request=None, responses={200: GarantDealSerializer})
    @action(
        detail=False,
        methods=["post"],
        url_path=r"by-token/(?P<token>[^/]+)/agree",
    )
    @transaction.atomic
    def agree(self, request, token=None):
        """The invited buyer accepts the terms; a garant chat room is opened."""
        deal = GarantDeal.objects.select_for_update().filter(private_link_token=token).first()
        if deal is None:
            return Response({"detail": "Deal not found."}, status=status.HTTP_404_NOT_FOUND)
        if deal.creator_id == request.user.id:
            return Response({"detail": "You cannot buy your own deal."}, status=400)
        if deal.buyer_id and deal.buyer_id != request.user.id:
            return Response({"detail": "This deal already has a buyer."}, status=400)
        if deal.status not in {GarantDeal.Status.AWAITING_BUYER, GarantDeal.Status.DRAFT}:
            return Response({"detail": "This deal is no longer open."}, status=400)

        deal.buyer = request.user
        deal.buyer_agreed_at = timezone.now()
        deal.status = GarantDeal.Status.AWAITING_PAYMENT
        deal.save(update_fields=["buyer", "buyer_agreed_at", "status", "updated_at"])
        _create_deal_room(deal)

        from apps.notifications.services import notify

        notify(
            deal.creator,
            "garant",
            title="Buyer joined your deal",
            body=f"@{request.user.username} agreed to '{deal.title}'.",
            data={"deal_id": str(deal.id)},
        )
        return Response(GarantDealSerializer(deal, context={"request": request}).data)

    @extend_schema(request=None, responses={201: GarantPaymentSerializer})
    @action(detail=True, methods=["post"], url_path="pay")
    def pay(self, request, pk=None):
        """Create a CryptoPay invoice for the buyer."""
        deal = self.get_object()
        if deal.buyer_id != request.user.id:
            return Response({"detail": "Only the buyer can pay."}, status=status.HTTP_403_FORBIDDEN)
        if deal.status not in {GarantDeal.Status.AWAITING_PAYMENT, GarantDeal.Status.AWAITING_BUYER}:
            return Response({"detail": "This deal is not awaiting payment."}, status=400)

        pending = deal.payments.filter(status=GarantPayment.Status.PENDING).first()
        if pending and pending.pay_url:
            return Response(GarantPaymentSerializer(pending).data, status=status.HTTP_200_OK)

        payment = GarantPayment.objects.create(
            deal=deal, amount=deal.price_crypto, currency=deal.crypto_currency
        )
        client = CryptoPayClient()
        try:
            invoice = client.create_invoice(
                amount=deal.price_crypto,
                asset=deal.crypto_currency,
                description=f"GoldenShake garant deal: {deal.title}",
                payload=json.dumps({"deal_id": str(deal.id), "payment_id": str(payment.id)}),
            )
        except CryptoPayError as exc:
            payment.status = GarantPayment.Status.FAILED
            payment.raw_payload = {"error": str(exc)}
            payment.save(update_fields=["status", "raw_payload"])
            return Response({"detail": f"Payment provider error: {exc}"}, status=status.HTTP_502_BAD_GATEWAY)

        payment.cryptopay_invoice_id = str(invoice.get("invoice_id", ""))
        payment.pay_url = invoice.get("pay_url") or invoice.get("bot_invoice_url", "")
        payment.raw_payload = invoice
        payment.save(update_fields=["cryptopay_invoice_id", "pay_url", "raw_payload"])
        return Response(GarantPaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=None, responses={200: GarantDealSerializer})
    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        """Seller marks the obligation as fulfilled."""
        deal = self.get_object()
        if deal.creator_id != request.user.id:
            return Response({"detail": "Only the seller can mark the deal complete."}, status=403)
        if deal.status != GarantDeal.Status.PAID:
            return Response({"detail": "Funds must be held before completing."}, status=400)
        deal.mark_completed()

        from apps.notifications.services import notify

        if deal.buyer:
            notify(
                deal.buyer,
                "garant",
                title="Deal marked complete",
                body=f"Confirm receipt for '{deal.title}' to release the funds.",
                data={"deal_id": str(deal.id)},
            )
        return Response(GarantDealSerializer(deal, context={"request": request}).data)

    @extend_schema(request=None, responses={200: GarantDealSerializer})
    @action(detail=True, methods=["post"], url_path="confirm")
    def confirm(self, request, pk=None):
        """Buyer confirms; the payout task releases funds to the seller."""
        deal = self.get_object()
        if deal.buyer_id != request.user.id:
            return Response({"detail": "Only the buyer can confirm."}, status=403)
        if deal.status not in {GarantDeal.Status.COMPLETED_BY_SELLER, GarantDeal.Status.PAID}:
            return Response({"detail": "Nothing to confirm yet."}, status=400)
        deal.confirm()

        from apps.garant.tasks import release_funds_task

        release_funds_task.delay(str(deal.id))
        return Response(GarantDealSerializer(deal, context={"request": request}).data)

    @extend_schema(request=GarantDisputeCreateSerializer, responses={201: GarantDisputeSerializer})
    @action(detail=True, methods=["post"], url_path="dispute")
    def dispute(self, request, pk=None):
        """Either party escalates the deal to the moderation team."""
        deal = self.get_object()
        serializer = GarantDisputeCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dispute = GarantDispute.objects.create(
            deal=deal, complainant=request.user, **serializer.validated_data
        )
        deal.status = GarantDeal.Status.DISPUTED
        deal.save(update_fields=["status", "updated_at"])

        from apps.notifications.services import notify_staff

        notify_staff(
            "garant_dispute",
            title="New garant dispute",
            body=f"Deal '{deal.title}' was disputed by @{request.user.username}.",
            data={"deal_id": str(deal.id), "dispute_id": str(dispute.id)},
        )
        return Response(
            GarantDisputeSerializer(dispute, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(request=None, responses={200: GarantDealSerializer})
    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        deal = self.get_object()
        if deal.creator_id != request.user.id:
            return Response({"detail": "Only the seller can cancel."}, status=403)
        if deal.status not in {GarantDeal.Status.DRAFT, GarantDeal.Status.AWAITING_BUYER, GarantDeal.Status.AWAITING_PAYMENT}:
            return Response({"detail": "Paid deals cannot be cancelled, open a dispute."}, status=400)
        deal.status = GarantDeal.Status.CANCELLED
        deal.save(update_fields=["status", "updated_at"])
        return Response(GarantDealSerializer(deal, context={"request": request}).data)


@extend_schema(tags=["garant"], request=dict, responses={200: dict})
@api_view(["POST"])
@permission_classes([AllowAny])
def cryptopay_webhook(request):
    """Receive invoice updates from CryptoPay and release the escrow state."""
    signature = request.headers.get("crypto-pay-api-signature", "")
    if not verify_webhook_signature(request.body, signature):
        return Response({"detail": "Invalid signature."}, status=status.HTTP_403_FORBIDDEN)

    payload = request.data or {}
    invoice = payload.get("payload") or {}
    invoice_id = str(invoice.get("invoice_id", ""))
    update_type = payload.get("update_type")

    payment = GarantPayment.objects.filter(cryptopay_invoice_id=invoice_id).first()
    if payment is None:
        logger.warning("cryptopay webhook for unknown invoice %s", invoice_id)
        return Response({"ok": True})

    if update_type == "invoice_paid" or invoice.get("status") == "paid":
        payment.mark_paid(invoice)
        deal = payment.deal
        deal.mark_paid()
        _create_deal_room(deal)

        from apps.notifications.services import notify

        notify(
            deal.creator,
            "garant",
            title="Escrow funded",
            body=f"Funds for '{deal.title}' are held by GoldenShake.",
            data={"deal_id": str(deal.id)},
        )
    return Response({"ok": True})
