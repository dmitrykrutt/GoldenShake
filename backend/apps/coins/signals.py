"""Coin signals: bootstrap balances and reward invites."""
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.accounts.models import User, UserInvite
from apps.coins.models import RARITY_ORDER, HandshakeCoin


@receiver(post_save, sender=User)
def bootstrap_balances(sender, instance, created, **kwargs):
    """Create zeroed balances for each rarity so the UI always has rows."""
    if not created:
        return
    HandshakeCoin.objects.bulk_create(
        [HandshakeCoin(user=instance, rarity=rarity, amount=0) for rarity in RARITY_ORDER],
        ignore_conflicts=True,
    )


@receiver(post_save, sender=UserInvite)
def grant_invite_reward(sender, instance, created, **kwargs):
    """Guarantee the inviter is rewarded even if the invite was created elsewhere."""
    if not created:
        return
    from apps.coins.services import reward_invite

    reward_invite(instance)
