"""URL routes for the coins app."""
from django.urls import path

from apps.coins import views

app_name = "coins"

urlpatterns = [
    path("balance/", views.CoinBalanceView.as_view(), name="balance"),
    path("exchange/", views.ExchangeView.as_view(), name="exchange"),
    path("transactions/", views.TransactionHistoryView.as_view(), name="transactions"),
    path("donate/", views.DonationView.as_view(), name="donate"),
    path("levels/", views.LevelInfoView.as_view(), name="levels"),
]
