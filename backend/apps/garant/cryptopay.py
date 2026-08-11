"""Thin client for the CryptoPay (Crypto Bot) merchant API."""
import hashlib
import hmac
import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class CryptoPayError(Exception):
    """Raised when the CryptoPay API rejects a request."""


class CryptoPayClient:
    """Wrapper around https://help.crypt.bot/crypto-pay-api endpoints."""

    def __init__(self, token: str = None, base_url: str = None, timeout: int = 15):
        self.token = token or settings.CRYPTOPAY_API_TOKEN
        self.base_url = (base_url or settings.CRYPTOPAY_API_URL).rstrip("/")
        self.timeout = timeout

    @property
    def is_configured(self) -> bool:
        return bool(self.token)

    def _request(self, method: str, endpoint: str, **kwargs) -> dict:
        if not self.is_configured:
            raise CryptoPayError("CRYPTOPAY_API_TOKEN is not configured.")
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        headers = {"Crypto-Pay-API-Token": self.token}
        try:
            response = requests.request(
                method, url, headers=headers, timeout=self.timeout, **kwargs
            )
            response.raise_for_status()
            payload = response.json()
        except requests.RequestException as exc:
            logger.error("CryptoPay request failed: %s", exc)
            raise CryptoPayError(str(exc)) from exc
        if not payload.get("ok", False):
            raise CryptoPayError(payload.get("error", "Unknown CryptoPay error"))
        return payload.get("result", {})

    def get_me(self) -> dict:
        return self._request("GET", "getMe")

    def create_invoice(self, amount, asset: str, description: str = "", payload: str = "", expires_in: int = 3600) -> dict:
        """Create a payment invoice; returns ``invoice_id`` and ``pay_url``."""
        return self._request(
            "POST",
            "createInvoice",
            json={
                "asset": asset,
                "amount": str(amount),
                "description": description[:1024],
                "payload": payload,
                "expires_in": expires_in,
                "allow_comments": False,
                "allow_anonymous": False,
            },
        )

    def get_invoices(self, invoice_ids=None, status: str = None) -> dict:
        params = {}
        if invoice_ids:
            params["invoice_ids"] = ",".join(str(i) for i in invoice_ids)
        if status:
            params["status"] = status
        return self._request("GET", "getInvoices", params=params)

    def transfer(self, user_id: int, asset: str, amount, spend_id: str, comment: str = "") -> dict:
        """Pay out the seller after the buyer confirms the deal."""
        return self._request(
            "POST",
            "transfer",
            json={
                "user_id": user_id,
                "asset": asset,
                "amount": str(amount),
                "spend_id": spend_id,
                "comment": comment[:1024],
                "disable_send_notification": False,
            },
        )

    def get_balance(self) -> dict:
        return self._request("GET", "getBalance")


def verify_webhook_signature(body: bytes, signature: str) -> bool:
    """Validate the ``crypto-pay-api-signature`` header of a webhook call."""
    token = settings.CRYPTOPAY_API_TOKEN
    secret_source = settings.CRYPTOPAY_WEBHOOK_SECRET or token
    if not secret_source or not signature:
        return False
    secret = hashlib.sha256(secret_source.encode()).digest()
    expected = hmac.new(secret, body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
