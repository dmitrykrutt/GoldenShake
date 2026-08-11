"""TOTP helpers: provisioning, QR generation and verification."""
import base64
import io

import pyotp
import qrcode
from django.conf import settings


TOTP_ISSUER = "GoldenShake"


def generate_totp_secret() -> str:
    """Return a fresh base32 TOTP secret."""
    return pyotp.random_base32()


def get_provisioning_uri(email: str, secret: str) -> str:
    """otpauth:// URI understood by Google Authenticator / Aegis / 1Password."""
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=TOTP_ISSUER)


def generate_qr_code_data_uri(uri: str) -> str:
    """Render the provisioning URI as an inline PNG data-URI."""
    qr = qrcode.QRCode(box_size=6, border=2)
    qr.add_data(uri)
    qr.make(fit=True)
    image = qr.make_image(fill_color="#C9A84C", back_color="#0D0D0D")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/png;base64,{encoded}"


def verify_totp(secret: str, code: str, valid_window: int = 1) -> bool:
    """Verify a 6-digit TOTP code allowing +/- one time step of clock drift."""
    if not secret or not code:
        return False
    try:
        return pyotp.TOTP(secret).verify(str(code).strip(), valid_window=valid_window)
    except Exception:
        return False


def build_totp_setup_payload(email: str, secret: str) -> dict:
    uri = get_provisioning_uri(email, secret)
    return {
        "secret": secret,
        "otpauth_uri": uri,
        "qr_code": generate_qr_code_data_uri(uri),
        "issuer": TOTP_ISSUER,
        "digits": 6,
        "period": 30,
        "debug": settings.DEBUG,
    }
