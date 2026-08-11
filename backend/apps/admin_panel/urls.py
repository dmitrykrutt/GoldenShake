"""URL routes for the staff admin panel."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.admin_panel import views

router = DefaultRouter()
router.register("support-queue", views.SupportQueueViewSet, basename="support-queue")
router.register("verifications", views.VerificationQueueViewSet, basename="admin-verification")
router.register("garant-complaints", views.GarantComplaintViewSet, basename="garant-complaint")
router.register("actions", views.AdminActionViewSet, basename="admin-action")

app_name = "admin_panel"

urlpatterns = [
    path("stats/", views.DashboardStatsView.as_view(), name="stats"),
    path("moderation/ban/", views.ModerationView.as_view(), name="moderation-ban"),
    path("moderation/grant-coins/", views.GrantCoinsView.as_view(), name="moderation-grant-coins"),
    path("", include(router.urls)),
]
