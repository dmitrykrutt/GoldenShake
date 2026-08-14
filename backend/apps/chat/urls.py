"""URL routes for the chat app."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.chat import views

router = DefaultRouter()
router.register("rooms", views.ChatRoomViewSet, basename="room")
router.register("messages", views.MessageViewSet, basename="message")
router.register("pinned", views.PinnedChatViewSet, basename="pinned-chat")
router.register("support-tickets", views.SupportTicketViewSet, basename="support-ticket")

app_name = "chat"

urlpatterns = [path("", include(router.urls))]
urlpatterns += [
    path("media/<path:file_path>/", views.ChatMediaViewSet.as_view({"get": "retrieve"}), name="media"),
]
