"""Root URL configuration for GoldenShake."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

from config.views import health_check

api_v1_patterns = [
    path("accounts/", include("apps.accounts.urls")),
    path("chat/", include("apps.chat.urls")),
    path("calls/", include("apps.calls.urls")),
    path("coins/", include("apps.coins.urls")),
    path("garant/", include("apps.garant.urls")),
    path("posts/", include("apps.posts.urls")),
    path("notifications/", include("apps.notifications.urls")),
    path("admin-panel/", include("apps.admin_panel.urls")),
]

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/v1/", include((api_v1_patterns, "v1"), namespace="v1")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path(
        "api/redoc/",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),
    path("health/", health_check, name="health"),
]

if settings.DEBUG and not settings.USE_S3:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
