"""Account signals: bootstrap invite links and welcome notifications."""
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.accounts.models import InviteLink, User


@receiver(post_save, sender=User)
def create_default_invite_links(sender, instance, created, **kwargs):
    """Every new user receives one invite link with 5 uses."""
    if not created:
        return
    InviteLink.objects.get_or_create(
        creator=instance,
        defaults={"max_uses": getattr(settings, "INVITE_MAX_USES", 5)},
    )


@receiver(post_save, sender=User)
def create_welcome_notification(sender, instance, created, **kwargs):
    if not created:
        return
    from apps.notifications.models import Notification

    Notification.objects.create(
        user=instance,
        type=Notification.Type.SYSTEM,
        title="Welcome to GoldenShake",
        body="Your invite-only account is ready. Set up your authenticator app to secure it.",
        data={"onboarding": True},
    )
