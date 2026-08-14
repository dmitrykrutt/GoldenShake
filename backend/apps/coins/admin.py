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
from apps.coins.models import DepositInvoice, FiatBalance, FiatTransaction, WithdrawalRequest


@admin.register(FiatBalance)
class FiatBalanceAdmin(admin.ModelAdmin):
    list_display = ("user", "currency", "amount", "updated_at")
    list_filter = ("currency",)
    search_fields = ("user__username",)


@admin.register(FiatTransaction)
class FiatTransactionAdmin(admin.ModelAdmin):
    list_display = ("created_at", "tx_type", "amount", "currency", "user")
    list_filter = ("tx_type", "currency")
    search_fields = ("user__username", "description")


@admin.register(DepositInvoice)
class DepositInvoiceAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "amount", "currency", "status", "created_at")
    list_filter = ("status", "currency")
    search_fields = ("user__username", "cryptopay_invoice_id")


@admin.register(WithdrawalRequest)
class WithdrawalRequestAdmin(admin.ModelAdmin):
    list_display = ("user", "amount", "currency", "status", "wallet_address", "created_at")
    list_filter = ("status", "currency")
    search_fields = ("user__username", "wallet_address")
