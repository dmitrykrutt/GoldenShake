"""REST endpoints for authentication, profiles, invites and verification."""
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Q
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.models import InviteLink, VerificationRequest
from apps.accounts.serializers import (
    GDPRRequestSerializer,
    InviteLinkSerializer,
    LoginSerializer,
    ProfileSerializer,
    PublicUserSerializer,
    RegisterSerializer,
    TOTPActivateSerializer,
    UserSerializer,
    VerificationRequestSerializer,
)
from apps.accounts.totp import build_totp_setup_payload, generate_totp_secret

User = get_user_model()

@extend_schema(tags=["auth"])
class RegisterView(APIView):
    """Invite-only registration endpoint."""

    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

    @extend_schema(request=RegisterSerializer, responses={201: dict})
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["auth"])
class LoginView(APIView):
    """Username + password + optional TOTP → JWT pair."""

    permission_classes = [AllowAny]
    serializer_class = LoginSerializer

    @extend_schema(request=LoginSerializer, responses={200: dict})
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.save())


@extend_schema(tags=["auth"])
class LogoutView(APIView):
    """Blacklist the supplied refresh token."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=dict, responses={205: None})
    def post(self, request):
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = request.data.get("refresh")
        if refresh:
            try:
                RefreshToken(refresh).blacklist()
            except Exception:
                pass
        request.user.mark_seen(online=False)
        return Response(status=status.HTTP_205_RESET_CONTENT)


@extend_schema(tags=["auth"])
class TOTPSetupView(APIView):
    """Return (or regenerate) the authenticator provisioning payload + QR."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: dict})
    def get(self, request):
        user = request.user
        if not user.totp_secret:
            user.totp_secret = generate_totp_secret()
            user.save(update_fields=["totp_secret"])
        return Response(build_totp_setup_payload(user.username, user.totp_secret))

    @extend_schema(request=TOTPActivateSerializer, responses={200: UserSerializer})
    def post(self, request):
        serializer = TOTPActivateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data)


@extend_schema(tags=["profile"])
class ProfileViewSet(viewsets.GenericViewSet):
    """Own profile management plus public profile lookup by username."""

    permission_classes = [IsAuthenticated]
    serializer_class = ProfileSerializer
    queryset = User.objects.all()
    lookup_field = "username"

    @extend_schema(responses={200: UserSerializer})
    @action(detail=False, methods=["get"], url_path="me")
    def me(self, request):
        return Response(UserSerializer(request.user).data)

    @extend_schema(request=ProfileSerializer, responses={200: UserSerializer})
    @action(detail=False, methods=["patch", "put"], url_path="me/update")
    def update_me(self, request):
        serializer = ProfileSerializer(
            request.user, data=request.data, partial=request.method == "PATCH"
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)

    @extend_schema(responses={200: PublicUserSerializer})
    def retrieve(self, request, username=None):
        try:
            user = User.objects.get(username__iexact=username)
        except User.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        data = PublicUserSerializer(user).data
        if user.private_profile and user != request.user:
            data = {
                key: data[key]
                for key in ("id", "username", "avatar", "is_verified", "private_profile")
            }
        return Response(data)

    @extend_schema(
        parameters=[OpenApiParameter("q", str, description="Username fragment.")],
        responses={200: PublicUserSerializer(many=True)},
    )
    @action(detail=False, methods=["get"], url_path="search")
    def search(self, request):
        query = (request.query_params.get("q") or "").strip()
        if len(query) < 2:
            return Response([])
        users = User.objects.filter(
            Q(username__icontains=query) & Q(is_active=True)
        ).exclude(pk=request.user.pk)[:20]
        return Response(PublicUserSerializer(users, many=True).data)

    @extend_schema(request=GDPRRequestSerializer, responses={202: dict})
    @action(detail=False, methods=["post"], url_path="gdpr-export")
    def gdpr_export(self, request):
        serializer = GDPRRequestSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"detail": "Your data export has been queued and will be e-mailed to you."},
            status=status.HTTP_202_ACCEPTED,
        )


@extend_schema(tags=["invites"])
class InviteLinkViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Users generate invite links; each link admits up to 5 people."""

    serializer_class = InviteLinkSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return InviteLink.objects.filter(creator=self.request.user)

    def perform_create(self, serializer):
        serializer.save(
            creator=self.request.user,
            max_uses=serializer.validated_data.get("max_uses", settings.INVITE_MAX_USES),
        )

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active"])

    @extend_schema(responses={200: dict})
    @action(detail=False, methods=["get"], url_path=r"check/(?P<token>[^/]+)", permission_classes=[AllowAny])
    def check(self, request, token=None):
        invite = InviteLink.objects.filter(hash_token=token).first()
        if invite is None:
            return Response({"valid": False, "detail": "Unknown invite link."}, status=404)
        return Response(
            {
                "valid": invite.is_usable(),
                "uses_left": invite.uses_left,
                "inviter": invite.creator.username,
            }
        )


@extend_schema(tags=["verification"])
class VerificationRequestViewSet(
    mixins.CreateModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet
):
    """Users submit verification requests reviewed in the admin panel."""

    serializer_class = VerificationRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return VerificationRequest.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        if VerificationRequest.objects.filter(
            user=self.request.user, status=VerificationRequest.Status.PENDING
        ).exists():
            from rest_framework.exceptions import ValidationError

            raise ValidationError("You already have a pending verification request.")
        serializer.save(user=self.request.user)


class TokenRefreshDocView(TokenRefreshView):
    """JWT refresh endpoint (documented under the auth tag)."""

    @extend_schema(tags=["auth"])
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)
