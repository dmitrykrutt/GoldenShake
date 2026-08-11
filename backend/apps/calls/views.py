"""REST endpoints for call history and WebRTC configuration."""
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.calls.models import CallLog, IceServer
from apps.calls.serializers import CallLogSerializer, CallStartSerializer


@extend_schema(tags=["calls"])
class CallLogViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """History of calls the user took part in."""

    permission_classes = [IsAuthenticated]
    serializer_class = CallLogSerializer

    def get_queryset(self):
        from django.db.models import Q

        return (
            CallLog.objects.filter(Q(caller=self.request.user) | Q(participants=self.request.user))
            .select_related("caller", "room")
            .prefetch_related("participants")
            .distinct()
        )


@extend_schema(tags=["calls"])
class IceServersView(APIView):
    """ICE (STUN/TURN) servers for the browser RTCPeerConnection."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=CallStartSerializer, responses={200: dict})
    def get(self, request):
        servers = [server.as_dict() for server in IceServer.objects.filter(is_active=True)]
        if not servers:
            servers = [{"urls": "stun:stun.l.google.com:19302"}]
        return Response({"ice_servers": servers})
