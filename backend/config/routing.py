"""Aggregated WebSocket URL patterns for all realtime apps."""
from apps.accounts.routing import websocket_urlpatterns as presence_ws
from apps.calls.routing import websocket_urlpatterns as calls_ws
from apps.chat.routing import websocket_urlpatterns as chat_ws
from apps.notifications.routing import websocket_urlpatterns as notifications_ws

websocket_urlpatterns = chat_ws + calls_ws + presence_ws + notifications_ws
