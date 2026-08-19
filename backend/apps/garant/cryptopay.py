"""CryptoPay API client with robust URL handling and error reporting."""
import hashlib
import hmac
import logging
from decimal import Decimal
from typing import Any, Dict, Optional

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class CryptoPayError(Exception):
    """Raised when the CryptoPay API returns an error or fails to respond."""


def verify_webhook_signature(body: bytes, signature: str) -> bool:
    token = getattr(settings, "CRYPTOPAY_API_TOKEN", "")
    if not token or not signature:
        return False
    secret = hashlib.sha256(token.encode("utf-8")).digest()
    expected = hmac.new(secret, body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


class CryptoPayClient:
    def __init__(self, token: Optional[str] = None, base_url: Optional[str] = None):
        self.token = token or getattr(settings, "CRYPTOPAY_API_TOKEN", "")
        raw_url = (base_url or getattr(settings, "CRYPTOPAY_API_URL", "https://pay.crypt.bot")).rstrip("/")
        # Нормализуем URL: гарантируем ровно один /api на конце
        if raw_url.endswith("/api"):
            self.base_url = raw_url
        else:
            self.base_url = f"{raw_url}/api"

    @property
    def is_configured(self) -> bool:
        return bool(self.token)

    def _headers(self) -> Dict[str, str]:
        return {
            "Crypto-Pay-API-Token": self.token,
            "Content-Type": "application/json",
        }

    def _post(self, path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        if not self.is_configured:
            raise CryptoPayError("CryptoPay API token is not configured.")
        clean_path = path.lstrip("/")
        url = f"{self.base_url}/{clean_path}"
        try:
            resp = requests.post(url, json=payload, headers=self._headers(), timeout=15)
            data = resp.json()
        except Exception as exc:
            logger.exception("CryptoPay request to %s failed: %s", url, exc)
            raise CryptoPayError(f"HTTP transport failed: {exc}") from exc

        if not data.get("ok"):
            error_info = data.get("error", {})
            error_name = error_info.get("name") or str(error_info)
            logger.error("CryptoPay error on %s: %s", url, data)
            raise CryptoPayError(f"{error_name}")
        return data.get("result", {})

    def create_invoice(
        self,
        amount: Decimal,
        asset: str,
        description: str = "",
        payload: Optional[str] = None,
        paid_btn_name: str = "callback",
        paid_btn_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        body: Dict[str, Any] = {
            "asset": asset.upper(),
            "amount": str(amount),
            "description": description[:1024],
        }
        if paid_btn_name and paid_btn_name != "callback":
            body["paid_btn_name"] = paid_btn_name
        if paid_btn_url:
            body["paid_btn_url"] = paid_btn_url
        if payload:
            body["payload"] = payload
        return self._post("createInvoice", body)

    def create_check(self, asset: str, amount: Decimal, pin_to_user_id: Optional[int] = None) -> Dict[str, Any]:
        """Create an instant CryptoPay check to be claimed via Telegram bot."""
        body: Dict[str, Any] = {
            "asset": asset.upper(),
            "amount": str(amount),
        }
        if pin_to_user_id:
            body["pin_to_user_id"] = pin_to_user_id
        return self._post("createCheck", body)

    def get_me(self) -> Dict[str, Any]:
        return self._post("getMe", {})

    def get_balance(self) -> Any:
        return self._post("getBalance", {})
