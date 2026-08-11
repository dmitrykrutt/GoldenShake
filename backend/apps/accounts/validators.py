"""Server-side validators for account data."""
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _


def get_allowed_email_domains() -> list:
    return [d.lower() for d in getattr(settings, "ALLOWED_EMAIL_DOMAINS", [])]


def validate_email_domain(value: str) -> None:
    """Reject any e-mail whose provider is not explicitly whitelisted.

    This is enforced on the model, the serializer and the manager so that the
    rule can never be bypassed from the client side.
    """
    allowed = get_allowed_email_domains()
    if not allowed:
        return
    try:
        domain = value.rsplit("@", 1)[1].lower().strip()
    except IndexError:
        raise ValidationError(_("Enter a valid e-mail address."))
    if domain not in allowed:
        raise ValidationError(
            _("E-mail provider '%(domain)s' is not allowed. Allowed providers: %(allowed)s.")
            % {"domain": domain, "allowed": ", ".join(allowed)}
        )


def validate_username(value: str) -> None:
    """Usernames are 3-32 chars of letters, digits and underscores."""
    import re

    if not re.fullmatch(r"[A-Za-z0-9_]{3,32}", value or ""):
        raise ValidationError(
            _("Username must be 3-32 characters: letters, digits or underscores.")
        )
