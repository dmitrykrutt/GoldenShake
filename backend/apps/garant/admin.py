from django.contrib import admin

from apps.garant.models import GarantDeal, GarantDispute, GarantPayment


class GarantPaymentInline(admin.TabularInline):
    model = GarantPayment
    extra = 0
    readonly_fields = ("cryptopay_invoice_id", "pay_url", "amount", "currency", "status", "paid_at")


@admin.register(GarantDeal)
class GarantDealAdmin(admin.ModelAdmin):
    list_display = ("title", "creator", "buyer", "price_crypto", "crypto_currency", "status", "created_at")
    list_filter = ("status", "crypto_currency")
    search_fields = ("title", "creator__username", "buyer__username", "private_link_token")
    inlines = [GarantPaymentInline]


@admin.register(GarantPayment)
class GarantPaymentAdmin(admin.ModelAdmin):
    list_display = ("cryptopay_invoice_id", "deal", "amount", "currency", "status", "paid_at")
    list_filter = ("status", "currency")


@admin.register(GarantDispute)
class GarantDisputeAdmin(admin.ModelAdmin):
    list_display = ("deal", "complainant", "status", "created_at")
    list_filter = ("status",)
