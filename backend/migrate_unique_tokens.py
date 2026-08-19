import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.coins.models import HandshakeCoin, HandshakeToken, TokenOwnershipHistory

print("=== Starting Unique Token Backfill ===")
for coin in HandshakeCoin.objects.filter(amount__gt=0):
    existing = HandshakeToken.objects.filter(current_owner=coin.user, rarity=coin.rarity, is_burned=False).count()
    needed = coin.amount - existing
    if needed > 0:
        tokens = [
            HandshakeToken(rarity=coin.rarity, creator=coin.user, current_owner=coin.user, is_burned=False)
            for _ in range(needed)
        ]
        created = HandshakeToken.objects.bulk_create(tokens)
        histories = [TokenOwnershipHistory(token=t, user=coin.user) for t in created]
        TokenOwnershipHistory.objects.bulk_create(histories, ignore_conflicts=True)
        print(f"Minted {needed} unique {coin.rarity} tokens for user @{coin.user.username}")

print("=== Unique Token Migration Complete ===")
