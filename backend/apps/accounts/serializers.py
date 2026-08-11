"""Serializers for registration, login (e-mail OTP + TOTP) and profiles."""
from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import (
    EmailConfirmation,
    InviteLink,
    TOTPDevice,
    UserInvite,
    VerificationRequest,
)
from apps.accounts.totp import build_totp_setup_payload, generate_totp_secret, verify_totp
from apps.accounts.validators import (
    get_allowed_email_domains,
    validate_email_domain,
    validate_username,
)

User = get_user_model()


class PublicUserSerializer(serializers.ModelSerializer):
    """Minimal representation exposed to other users."""

    handshake_level = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "avatar",
            "bio",
            "social_links",
            "theme_color",
            "is_verified",
            "private_profile",
            "paid_messages_enabled",
            "paid_message_price",
            "handshake_level",
            "is_online",
            "last_seen",
            "public_key",
            "date_joined",
        )
        read_only_fields = fields


class UserSerializer(serializers.ModelSerializer):
    """Full self-representation returned to the authenticated owner."""

    handshake_level = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "username",
            "phone",
            "avatar",
            "bio",
            "social_links",
            "theme_color",
            "is_verified",
            "is_email_confirmed",
            "is_staff",
            "totp_enabled",
            "private_profile",
            "paid_messages_enabled",
            "paid_message_price",
            "newsletter_opt_in",
            "is_18_confirmed",
            "tos_confirmed",
            "gdpr_data_requested",
            "telegram_chat_id",
            "public_key",
            "handshake_level",
            "is_online",
            "last_seen",
            "date_joined",
        )
        read_only_fields = (
            "id",
            "email",
            "is_verified",
            "is_email_confirmed",
            "is_staff",
            "totp_enabled",
            "handshake_level",
            "is_online",
            "last_seen",
            "date_joined",
        )


class ProfileSerializer(serializers.ModelSerializer):
    """Editable profile fields."""

    class Meta:
        model = User
        fields = (
            "username",
            "phone",
            "avatar",
            "bio",
            "social_links",
            "theme_color",
            "private_profile",
            "paid_messages_enabled",
            "paid_message_price",
            "newsletter_opt_in",
            "telegram_chat_id",
            "fcm_token",
            "public_key",
        )

    def validate_username(self, value):
        validate_username(value)
        qs = User.objects.filter(username__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_social_links(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("social_links must be an object.")
        if len(value) > 10:
            raise serializers.ValidationError("At most 10 social links are allowed.")
        return value


class RegisterSerializer(serializers.Serializer):
    """Invite-only registration with provider whitelisting and TOTP bootstrap."""

    email = serializers.EmailField()
    username = serializers.CharField(max_length=32)
    password = serializers.CharField(write_only=True, min_length=10)
    password_confirm = serializers.CharField(write_only=True)
    invite_token = serializers.CharField(max_length=64)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    is_18_confirmed = serializers.BooleanField()
    tos_confirmed = serializers.BooleanField()
    newsletter_opt_in = serializers.BooleanField(required=False, default=False)

    def validate_email(self, value):
        value = value.lower().strip()
        validate_email_domain(value)
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this e-mail already exists.")
        return value

    def validate_username(self, value):
        validate_username(value)
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_invite_token(self, value):
        try:
            invite = InviteLink.objects.select_related("creator").get(hash_token=value)
        except InviteLink.DoesNotExist:
            raise serializers.ValidationError("Invalid invite link.")
        if not invite.is_usable():
            raise serializers.ValidationError("This invite link has been exhausted or expired.")
        self.context["invite"] = invite
        return value

    def validate_is_18_confirmed(self, value):
        if not value:
            raise serializers.ValidationError("You must confirm you are 18 or older.")
        return value

    def validate_tos_confirmed(self, value):
        if not value:
            raise serializers.ValidationError("You must accept the Terms of Service.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("password_confirm"):
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        from django.contrib.auth.password_validation import validate_password

        validate_password(attrs["password"])
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        from apps.accounts.tasks import send_email_confirmation_task
        from apps.coins.services import reward_invite

        invite: InviteLink = self.context["invite"]
        invite = InviteLink.objects.select_for_update().get(pk=invite.pk)
        if not invite.is_usable():
            raise serializers.ValidationError({"invite_token": "This invite link is no longer usable."})

        user = User.objects.create_user(
            email=validated_data["email"],
            username=validated_data["username"],
            password=validated_data["password"],
            phone=validated_data.get("phone", ""),
            is_18_confirmed=True,
            tos_confirmed=True,
            newsletter_opt_in=validated_data.get("newsletter_opt_in", False),
        )

        secret = generate_totp_secret()
        user.totp_secret = secret
        user.save(update_fields=["totp_secret"])
        TOTPDevice.objects.create(user=user, secret=secret, confirmed=False)

        invite.consume()
        user_invite = UserInvite.objects.create(
            inviter=invite.creator, invitee=user, invite_link=invite
        )
        reward_invite(user_invite)

        confirmation = EmailConfirmation.objects.create(
            user=user, purpose=EmailConfirmation.Purpose.REGISTRATION
        )
        send_email_confirmation_task.delay(str(user.id), confirmation.code)

        self.context["totp_setup"] = build_totp_setup_payload(user.email, secret)
        return user

    def to_representation(self, instance):
        return {
            "user": UserSerializer(instance).data,
            "totp_setup": self.context.get("totp_setup", {}),
            "message": "Account created. Confirm your e-mail code and activate your authenticator app.",
        }


class EmailConfirmSerializer(serializers.Serializer):
    """Confirm the 6-digit registration code."""

    email = serializers.EmailField()
    code = serializers.CharField(max_length=6)

    def validate(self, attrs):
        try:
            user = User.objects.get(email__iexact=attrs["email"].strip())
        except User.DoesNotExist:
            raise serializers.ValidationError("Invalid e-mail or code.")
        confirmation = (
            EmailConfirmation.objects.filter(
                user=user, code=attrs["code"], is_used=False
            )
            .order_by("-created_at")
            .first()
        )
        if confirmation is None or not confirmation.is_valid():
            raise serializers.ValidationError("Invalid or expired confirmation code.")
        attrs["user"] = user
        attrs["confirmation"] = confirmation
        return attrs

    def save(self, **kwargs):
        user = self.validated_data["user"]
        self.validated_data["confirmation"].consume()
        user.is_email_confirmed = True
        user.save(update_fields=["is_email_confirmed"])
        return user


class TOTPActivateSerializer(serializers.Serializer):
    """Confirm the authenticator app by submitting a valid code."""

    code = serializers.CharField(max_length=6)

    def validate_code(self, value):
        user = self.context["request"].user
        if not verify_totp(user.totp_secret, value):
            raise serializers.ValidationError("Invalid authenticator code.")
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        user.totp_enabled = True
        user.save(update_fields=["totp_enabled"])
        TOTPDevice.objects.update_or_create(
            user=user, defaults={"secret": user.totp_secret, "confirmed": True}
        )
        return user


class LoginRequestCodeSerializer(serializers.Serializer):
    """Step 1 of login: e-mail/phone + password → send the e-mail OTP."""

    identifier = serializers.CharField(help_text="E-mail address or phone number.")
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        identifier = attrs["identifier"].strip()
        user = User.objects.filter(
            Q(email__iexact=identifier) | Q(phone=identifier)
        ).first()
        if user is None or not user.check_password(attrs["password"]):
            raise serializers.ValidationError("Invalid credentials.")
        if not user.is_active:
            raise serializers.ValidationError("This account is disabled.")
        attrs["user"] = user
        return attrs

    def save(self, **kwargs):
        from apps.accounts.tasks import send_login_code_task

        user = self.validated_data["user"]
        confirmation = EmailConfirmation.objects.create(
            user=user, purpose=EmailConfirmation.Purpose.LOGIN
        )
        send_login_code_task.delay(str(user.id), confirmation.code)
        return user


class LoginSerializer(serializers.Serializer):
    """Step 2 of login: credentials + e-mail OTP + TOTP → JWT pair."""

    identifier = serializers.CharField()
    password = serializers.CharField(write_only=True)
    email_code = serializers.CharField(max_length=6)
    totp_code = serializers.CharField(max_length=6, required=False, allow_blank=True)

    def validate(self, attrs):
        identifier = attrs["identifier"].strip()
        user = User.objects.filter(
            Q(email__iexact=identifier) | Q(phone=identifier)
        ).first()
        if user is None or not user.check_password(attrs["password"]):
            raise serializers.ValidationError("Invalid credentials.")
        if not user.is_active:
            raise serializers.ValidationError("This account is disabled.")
        if not user.is_email_confirmed:
            raise serializers.ValidationError("Confirm your e-mail address first.")

        confirmation = (
            EmailConfirmation.objects.filter(
                user=user,
                code=attrs["email_code"],
                is_used=False,
                purpose=EmailConfirmation.Purpose.LOGIN,
            )
            .order_by("-created_at")
            .first()
        )
        if confirmation is None or not confirmation.is_valid():
            raise serializers.ValidationError({"email_code": "Invalid or expired e-mail code."})

        if user.totp_enabled and not verify_totp(user.totp_secret, attrs.get("totp_code", "")):
            raise serializers.ValidationError({"totp_code": "Invalid authenticator code."})

        confirmation.consume()
        attrs["user"] = user
        return attrs

    def save(self, **kwargs):
        from rest_framework_simplejwt.tokens import RefreshToken

        user = self.validated_data["user"]
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])
        refresh = RefreshToken.for_user(user)
        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserSerializer(user).data,
        }


class InviteLinkSerializer(serializers.ModelSerializer):
    uses_left = serializers.IntegerField(read_only=True)
    url = serializers.SerializerMethodField()

    class Meta:
        model = InviteLink
        fields = (
            "id",
            "hash_token",
            "url",
            "max_uses",
            "use_count",
            "uses_left",
            "is_active",
            "created_at",
            "expires_at",
        )
        read_only_fields = ("id", "hash_token", "use_count", "is_active", "created_at")

    def get_url(self, obj) -> str:
        from django.conf import settings

        return f"{settings.FRONTEND_URL.rstrip('/')}/auth/register?invite={obj.hash_token}"


class VerificationRequestSerializer(serializers.ModelSerializer):
    user = PublicUserSerializer(read_only=True)

    class Meta:
        model = VerificationRequest
        fields = (
            "id",
            "user",
            "reason",
            "proof_url",
            "status",
            "reviewer_note",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "user", "status", "reviewer_note", "created_at", "updated_at")


class AllowedDomainsSerializer(serializers.Serializer):
    """Advertises the whitelisted e-mail providers to the frontend."""

    domains = serializers.ListField(child=serializers.CharField())

    @staticmethod
    def current() -> dict:
        return {"domains": get_allowed_email_domains()}


class GDPRRequestSerializer(serializers.Serializer):
    confirm = serializers.BooleanField()

    def validate_confirm(self, value):
        if not value:
            raise serializers.ValidationError("Confirmation required.")
        return value

    def save(self, **kwargs):
        from apps.accounts.tasks import export_user_data_task

        user = self.context["request"].user
        user.gdpr_data_requested = True
        user.gdpr_data_requested_at = timezone.now()
        user.save(update_fields=["gdpr_data_requested", "gdpr_data_requested_at"])
        export_user_data_task.delay(str(user.id))
        return user
