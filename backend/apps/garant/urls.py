"""URL routes for the garant (escrow) app."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.garant import views

router = DefaultRouter()
router.register("deals", views.GarantDealViewSet, basename="garant-deal")

app_name = "garant"

urlpatterns = [
    path("webhook/cryptopay/", views.cryptopay_webhook, name="cryptopay-webhook"),
    path("", include(router.urls)),
]
