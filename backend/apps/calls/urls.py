"""URL routes for the calls app."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.calls import views

router = DefaultRouter()
router.register("logs", views.CallLogViewSet, basename="call-log")

app_name = "calls"

urlpatterns = [
    path("ice-servers/", views.IceServersView.as_view(), name="ice-servers"),
    path("", include(router.urls)),
]
