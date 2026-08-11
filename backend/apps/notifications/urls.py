"""URL routes for the notifications app."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.notifications import views

router = DefaultRouter()
router.register("notifications", views.NotificationViewSet, basename="notification")
router.register("devices", views.DeviceTokenViewSet, basename="device-token")

app_name = "notifications"

urlpatterns = [
    path("preferences/", views.NotificationPreferenceView.as_view(), name="preferences"),
    path("", include(router.urls)),
]
