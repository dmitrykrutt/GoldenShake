from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/accounts/', include('apps.accounts.urls')),
    path('api/v1/coins/', include('apps.coins.urls')),
    path('api/v1/garant/', include('apps.garant.urls')),
    path('api/v1/chat/', include('apps.chat.urls')),
    path('api/v1/social/', include('apps.social.urls')),
    path('api/v1/notifications/', include('apps.notifications.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
