"""Server-side envelope encryption for stored message payloads (PyNaCl)."""
import base64
import hashlib

import nacl.encoding
import nacl.exceptions
import nacl.public
import nacl.secret
import nacl.utils
from django.conf import settings


def _derive_key() -> bytes:
    """Return the 32-byte SecretBox key from settings.

    ``MESSAGE_ENCRYPTION_KEY`` should be 32 random bytes, base64 encoded. When it
    is not configured (development, tests) we deterministically derive one from
    ``SECRET_KEY`` so the platform still stores ciphertext rather than plaintext.
    """
    configured = getattr(settings, "MESSAGE_ENCRYPTION_KEY", "") or ""
    if configured:
        try:
            key = base64.b64decode(configured)
            if len(key) == nacl.secret.SecretBox.KEY_SIZE:
                return key
        except Exception:
            pass
    return hashlib.sha256(settings.SECRET_KEY.encode()).digest()


def encrypt_message(plaintext: str) -> bytes:
    """Encrypt a UTF-8 string with XSalsa20-Poly1305 and return raw bytes."""
    if plaintext is None:
        plaintext = ""
    box = nacl.secret.SecretBox(_derive_key())
    nonce = nacl.utils.random(nacl.secret.SecretBox.NONCE_SIZE)
    return bytes(box.encrypt(plaintext.encode("utf-8"), nonce))


def decrypt_message(ciphertext) -> str:
    """Decrypt bytes produced by :func:`encrypt_message`."""
    if not ciphertext:
        return ""
    if isinstance(ciphertext, memoryview):
        ciphertext = ciphertext.tobytes()
    if isinstance(ciphertext, str):
        ciphertext = ciphertext.encode("latin-1")
    box = nacl.secret.SecretBox(_derive_key())
    try:
        return box.decrypt(bytes(ciphertext)).decode("utf-8")
    except (nacl.exceptions.CryptoError, ValueError):
        return "[unable to decrypt message]"


def generate_keypair() -> dict:
    """Generate a Curve25519 keypair for client-side end-to-end encryption."""
    private_key = nacl.public.PrivateKey.generate()
    return {
        "public_key": private_key.public_key.encode(nacl.encoding.Base64Encoder).decode(),
        "private_key": private_key.encode(nacl.encoding.Base64Encoder).decode(),
    }


def seal_for_recipient(plaintext: str, recipient_public_key_b64: str) -> str:
    """Anonymous sealed box: only the recipient's private key can open it."""
    public_key = nacl.public.PublicKey(
        recipient_public_key_b64.encode(), nacl.encoding.Base64Encoder
    )
    sealed = nacl.public.SealedBox(public_key).encrypt(plaintext.encode("utf-8"))
    return base64.b64encode(sealed).decode()


def open_sealed(sealed_b64: str, private_key_b64: str) -> str:
    private_key = nacl.public.PrivateKey(
        private_key_b64.encode(), nacl.encoding.Base64Encoder
    )
    opened = nacl.public.SealedBox(private_key).decrypt(base64.b64decode(sealed_b64))
    return opened.decode("utf-8")
