"""WebSocket routes for WebRTC signaling."""
from django.urls import path

from apps.calls.consumers import CallConsumer

websocket_urlpatterns = [
    path("ws/calls/<uuid:room_id>/", CallConsumer.as_asgi()),
]
