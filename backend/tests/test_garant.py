"""Tests for the escrow (garant) deal lifecycle."""
import hashlib
import hmac
import json
from decimal import Decimal
from unittest import mock

import pytest
from django.test import override_settings
from django.urls import reverse

from apps.garant.models import GarantDeal, GarantDispute, GarantPayment

pytestmark = pytest.mark.django_db


def create_deal(client, **overrides):
    payload = {
        "title": "Premium account transfer",
        "description": "Handing over a verified account with full access.",
        "price_crypto": "100.00",
        "crypto_currency": "USDT",
    }
    payload.update(overrides)
    return client.post(reverse("v1:garant:garant-deal-list"), payload, format="json")


@pytest.fixture
def buyer_client(authenticate, other_user):
    return authenticate(other_user)


class TestDealCreation:
    def test_create_deal_generates_private_link(self, auth_client):
        response = create_deal(auth_client)
        assert response.status_code == 201, response.data
        assert response.data["private_link_token"]
        assert "/garant/" in response.data["private_url"]
        assert response.data["status"] == GarantDeal.Status.AWAITING_BUYER

    def test_platform_fee_is_five_percent(self, auth_client):
        response = create_deal(auth_client)
        deal = GarantDeal.objects.get(id=response.data["id"])
        assert deal.platform_fee_pct == 5
        assert deal.platform_fee == Decimal("5.00")
        assert deal.seller_payout == Decimal("95.00")

    def test_price_must_be_positive(self, auth_client):
        response = create_deal(auth_client, price_crypto="0")
        assert response.status_code == 400

    def test_deals_are_private_to_participants(self, auth_client, buyer_client):
        create_deal(auth_client)
        listing = buyer_client.get(reverse("v1:garant:garant-deal-list"))
        assert listing.data == [] or listing.data["count"] == 0


class TestDealAgreement:
    def test_buyer_can_open_deal_by_token(self, auth_client, buyer_client):
        token = create_deal(auth_client).data["private_link_token"]
        response = buyer_client.get(
            reverse("v1:garant:garant-deal-by-token", kwargs={"token": token})
        )
        assert response.status_code == 200
        assert response.data["title"] == "Premium account transfer"
        assert "private_link_token" not in response.data

    def test_unknown_token_returns_404(self, buyer_client):
        response = buyer_client.get(
            reverse("v1:garant:garant-deal-by-token", kwargs={"token": "nope"})
        )
        assert response.status_code == 404

    def test_buyer_agrees_and_garant_room_is_created(self, auth_client, buyer_client):
        token = create_deal(auth_client).data["private_link_token"]
        response = buyer_client.post(
            reverse("v1:garant:garant-deal-agree", kwargs={"token": token})
        )
        assert response.status_code == 200, response.data
        assert response.data["status"] == GarantDeal.Status.AWAITING_PAYMENT

        deal = GarantDeal.objects.get(id=response.data["id"])
        assert deal.buyer == buyer_client.user
        assert deal.room is not None
        assert deal.room.is_garant_chat is True
        assert deal.room.participants.count() == 2

    def test_seller_cannot_buy_own_deal(self, auth_client):
        token = create_deal(auth_client).data["private_link_token"]
        response = auth_client.post(
            reverse("v1:garant:garant-deal-agree", kwargs={"token": token})
        )
        assert response.status_code == 400

    def test_second_buyer_rejected(self, auth_client, buyer_client, user_factory, authenticate):
        token = create_deal(auth_client).data["private_link_token"]
        buyer_client.post(reverse("v1:garant:garant-deal-agree", kwargs={"token": token}))

        third_client = authenticate(user_factory())
        response = third_client.post(
            reverse("v1:garant:garant-deal-agree", kwargs={"token": token})
        )
        assert response.status_code == 400


class TestPaymentAndCompletion:
    @mock.patch("apps.garant.views.CryptoPayClient")
    def test_buyer_creates_invoice(self, client_cls, auth_client, buyer_client):
        client_cls.return_value.create_invoice.return_value = {
            "invoice_id": 424242,
            "pay_url": "https://t.me/CryptoBot?start=inv_424242",
        }
        token = create_deal(auth_client).data["private_link_token"]
        deal_id = buyer_client.post(
            reverse("v1:garant:garant-deal-agree", kwargs={"token": token})
        ).data["id"]

        response = buyer_client.post(
            reverse("v1:garant:garant-deal-pay", kwargs={"pk": deal_id})
        )
        assert response.status_code == 201, response.data
        assert response.data["cryptopay_invoice_id"] == "424242"
        assert GarantPayment.objects.filter(deal_id=deal_id).count() == 1

    def test_seller_cannot_pay(self, auth_client, buyer_client):
        token = create_deal(auth_client).data["private_link_token"]
        deal_id = buyer_client.post(
            reverse("v1:garant:garant-deal-agree", kwargs={"token": token})
        ).data["id"]
        response = auth_client.post(reverse("v1:garant:garant-deal-pay", kwargs={"pk": deal_id}))
        assert response.status_code == 403

    def test_full_lifecycle_to_release(self, auth_client, buyer_client):
        token = create_deal(auth_client).data["private_link_token"]
        deal_id = buyer_client.post(
            reverse("v1:garant:garant-deal-agree", kwargs={"token": token})
        ).data["id"]

        deal = GarantDeal.objects.get(id=deal_id)
        deal.mark_paid()

        completed = auth_client.post(
            reverse("v1:garant:garant-deal-complete", kwargs={"pk": deal_id})
        )
        assert completed.status_code == 200
        assert completed.data["status"] == GarantDeal.Status.COMPLETED_BY_SELLER

        with mock.patch("apps.garant.tasks.release_funds_task.delay") as release:
            confirmed = buyer_client.post(
                reverse("v1:garant:garant-deal-confirm", kwargs={"pk": deal_id})
            )
        assert confirmed.status_code == 200
        assert confirmed.data["status"] == GarantDeal.Status.CONFIRMED
        assert release.called

    def test_buyer_cannot_mark_complete(self, auth_client, buyer_client):
        token = create_deal(auth_client).data["private_link_token"]
        deal_id = buyer_client.post(
            reverse("v1:garant:garant-deal-agree", kwargs={"token": token})
        ).data["id"]
        GarantDeal.objects.filter(id=deal_id).update(status=GarantDeal.Status.PAID)
        response = buyer_client.post(
            reverse("v1:garant:garant-deal-complete", kwargs={"pk": deal_id})
        )
        assert response.status_code == 403

    def test_release_task_pays_out_seller_share(self, auth_client, buyer_client):
        from apps.garant.tasks import release_funds_task

        token = create_deal(auth_client).data["private_link_token"]
        deal_id = buyer_client.post(
            reverse("v1:garant:garant-deal-agree", kwargs={"token": token})
        ).data["id"]
        deal = GarantDeal.objects.get(id=deal_id)
        deal.mark_paid()
        deal.confirm()

        result = release_funds_task(str(deal.id))
        deal.refresh_from_db()
        assert result["ok"] is True
        assert deal.status == GarantDeal.Status.RELEASED
        assert Decimal(result["payout"]) == Decimal("95.00")

    @override_settings(CRYPTOPAY_TOKEN="secret-token", CRYPTOPAY_WEBHOOK_SECRET="")
    def test_cryptopay_webhook_marks_payment_paid(self, auth_client, buyer_client):
        token = create_deal(auth_client).data["private_link_token"]
        deal_id = buyer_client.post(
            reverse("v1:garant:garant-deal-agree", kwargs={"token": token})
        ).data["id"]
        payment = GarantPayment.objects.create(
            deal_id=deal_id,
            amount="100.00",
            currency="USDT",
            cryptopay_invoice_id="12345",
        )
        payload = {"update_type": "invoice_paid", "payload": {"invoice_id": "12345", "status": "paid"}}
        secret = hashlib.sha256(b"secret-token").digest()
        signature = hmac.new(
            secret, json.dumps(payload, separators=(",", ":")).encode(), hashlib.sha256
        ).hexdigest()
        response = auth_client.post(
            reverse("v1:garant:cryptopay-webhook"),
            payload,
            format="json",
            HTTP_CRYPTO_PAY_API_SIGNATURE=signature,
        )
        assert response.status_code == 200
        payment.refresh_from_db()
        payment.deal.refresh_from_db()
        assert payment.status == GarantPayment.Status.PAID
        assert payment.deal.status == GarantDeal.Status.PAID


class TestDisputes:
    def test_buyer_can_open_dispute(self, auth_client, buyer_client):
        token = create_deal(auth_client).data["private_link_token"]
        deal_id = buyer_client.post(
            reverse("v1:garant:garant-deal-agree", kwargs={"token": token})
        ).data["id"]
        GarantDeal.objects.filter(id=deal_id).update(status=GarantDeal.Status.PAID)

        response = buyer_client.post(
            reverse("v1:garant:garant-deal-dispute", kwargs={"pk": deal_id}),
            {"description": "The seller never delivered the account."},
            format="json",
        )
        assert response.status_code == 201, response.data
        assert GarantDeal.objects.get(id=deal_id).status == GarantDeal.Status.DISPUTED

    def test_staff_resolves_dispute_for_buyer(self, auth_client, buyer_client, staff_client):
        token = create_deal(auth_client).data["private_link_token"]
        deal_id = buyer_client.post(
            reverse("v1:garant:garant-deal-agree", kwargs={"token": token})
        ).data["id"]
        GarantDeal.objects.filter(id=deal_id).update(status=GarantDeal.Status.PAID)
        dispute_id = buyer_client.post(
            reverse("v1:garant:garant-deal-dispute", kwargs={"pk": deal_id}),
            {"description": "Not delivered."},
            format="json",
        ).data["id"]

        response = staff_client.post(
            reverse("v1:admin_panel:garant-complaint-resolve", kwargs={"pk": dispute_id}),
            {"decision": "buyer", "note": "Refund issued."},
            format="json",
        )
        assert response.status_code == 200, response.data
        assert GarantDispute.objects.get(id=dispute_id).status == GarantDispute.Status.RESOLVED_BUYER
        assert GarantDeal.objects.get(id=deal_id).status == GarantDeal.Status.REFUNDED

    def test_non_staff_cannot_access_complaint_queue(self, auth_client):
        response = auth_client.get(reverse("v1:admin_panel:garant-complaint-list"))
        assert response.status_code == 403


class TestCancellation:
    def test_seller_can_cancel_unpaid_deal(self, auth_client):
        deal_id = create_deal(auth_client).data["id"]
        response = auth_client.post(
            reverse("v1:garant:garant-deal-cancel", kwargs={"pk": deal_id})
        )
        assert response.status_code == 200
        assert response.data["status"] == GarantDeal.Status.CANCELLED

    def test_paid_deal_cannot_be_cancelled(self, auth_client):
        deal_id = create_deal(auth_client).data["id"]
        GarantDeal.objects.filter(id=deal_id).update(status=GarantDeal.Status.PAID)
        response = auth_client.post(
            reverse("v1:garant:garant-deal-cancel", kwargs={"pk": deal_id})
        )
        assert response.status_code == 400
