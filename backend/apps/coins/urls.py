"""URL routes for the coins app."""
from django.urls import path

from apps.coins import views
from apps.coins.cryptopay_views import deposit_webhook

app_name = "coins"

urlpatterns = [
    path("balance/", views.CoinBalanceView.as_view(), name="balance"),
    path("exchange/", views.ExchangeView.as_view(), name="exchange"),
    path("transactions/", views.TransactionHistoryView.as_view(), name="transactions"),
    path("donate/", views.DonationView.as_view(), name="donate"),
    path("levels/", views.LevelInfoView.as_view(), name="levels"),
    path("fiat-balance/", views.FiatBalanceListView.as_view(), name="fiat-balance"),
    path("fiat-transactions/", views.FiatTransactionListView.as_view(), name="fiat-transactions"),
    path("deposit/", views.DepositView.as_view(), name="deposit"),
    path("withdraw/", views.WithdrawView.as_view(), name="withdraw"),
    path("cryptopay-webhook/", deposit_webhook, name="cryptopay-webhook"),
]
