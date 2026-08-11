"""REST endpoints for notifications, device tokens and preferences."""
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.notifications.models import DeviceToken, Notification, NotificationPreference
from apps.notifications.serializers import (
    DeviceTokenSerializer,
    NotificationPreferenceSerializer,
    NotificationSerializer,
)


@extend_schema(tags=["notifications"])
class NotificationViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer
    queryset = Notification.objects.none()

    def get_queryset(self):
        queryset = Notification.objects.filter(user=self.request.user)
        if self.request.query_params.get("unread") == "true":
            queryset = queryset.filter(read=False)
        return queryset

    @extend_schema(request=None, responses={200: NotificationSerializer})
    @action(detail=True, methods=["post"], url_path="read")
    def read(self, request, pk=None):
        notification = self.get_object()
        notification.mark_read()
        return Response(NotificationSerializer(notification).data)

    @extend_schema(request=None, responses={200: dict})
    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        updated = Notification.objects.filter(user=request.user, read=False).update(read=True)
        return Response({"updated": updated})

    @extend_schema(responses={200: dict})
    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        return Response(
            {"unread": Notification.objects.filter(user=request.user, read=False).count()}
        )


@extend_schema(tags=["notifications"])
class DeviceTokenViewSet(
    mixins.CreateModelMixin, mixins.ListModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet
):
    """Register/unregister FCM device tokens."""

    permission_classes = [IsAuthenticated]
    serializer_class = DeviceTokenSerializer
    queryset = DeviceToken.objects.none()

    def get_queryset(self):
        return DeviceToken.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token, _ = DeviceToken.objects.update_or_create(
            token=serializer.validated_data["token"],
            defaults={
                "user": request.user,
                "platform": serializer.validated_data.get("platform", DeviceToken.Platform.WEB),
                "is_active": True,
            },
        )
        request.user.fcm_token = token.token
        request.user.save(update_fields=["fcm_token"])
        return Response(DeviceTokenSerializer(token).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["notifications"])
class NotificationPreferenceView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationPreferenceSerializer

    @extend_schema(responses={200: NotificationPreferenceSerializer})
    def get(self, request):
        preference, _ = NotificationPreference.objects.get_or_create(user=request.user)
        return Response(NotificationPreferenceSerializer(preference).data)

    @extend_schema(request=NotificationPreferenceSerializer, responses={200: NotificationPreferenceSerializer})
    def patch(self, request):
        preference, _ = NotificationPreference.objects.get_or_create(user=request.user)
        serializer = NotificationPreferenceSerializer(preference, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
