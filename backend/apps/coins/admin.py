from django.contrib import admin

from apps.coins.models import CoinTransaction, HandshakeCoin, InviteReward


@admin.register(HandshakeCoin)
class HandshakeCoinAdmin(admin.ModelAdmin):
    list_display = ("user", "rarity", "amount", "updated_at")
    list_filter = ("rarity",)
    search_fields = ("user__username",)


@admin.register(CoinTransaction)
class CoinTransactionAdmin(admin.ModelAdmin):
    list_display = ("created_at", "transaction_type", "amount", "rarity", "from_user", "to_user")
    list_filter = ("transaction_type", "rarity")
    search_fields = ("from_user__username", "to_user__username", "memo")
    readonly_fields = ("id", "created_at")


@admin.register(InviteReward)
class InviteRewardAdmin(admin.ModelAdmin):
    list_display = ("user_invite", "amount", "rarity", "created_at")
