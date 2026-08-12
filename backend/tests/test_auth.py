"""Tests for registration, invites, TOTP and login."""
import pytest
from django.urls import reverse

from apps.accounts.models import EmailConfirmation, InviteLink, TOTPDevice, UserInvite
from apps.accounts.totp import generate_totp_secret
from apps.coins.models import RARITY_GREEN, HandshakeCoin

pytestmark = pytest.mark.django_db

VALID_PASSWORD = "GoldenShake!2024"


def register_payload(invite_token, **overrides):
    payload = {
        "username": "new_member",
        "password": VALID_PASSWORD,
        "password_confirm": VALID_PASSWORD,
        "invite_token": invite_token,
        "is_18_confirmed": True,
        "tos_confirmed": True,
    }
    payload.update(overrides)
    return payload


class TestRegistration:
    def test_register_with_valid_invite_creates_user(self, api_client, invite_link):
        response = api_client.post(
            reverse("v1:accounts:register"), register_payload(invite_link.hash_token), format="json"
        )
        assert response.status_code == 201, response.data
        assert response.data["user"]["username"] == "new_member"
        assert response.data["totp_setup"]["qr_code"].startswith("data:image/png;base64,")

    def test_register_requires_valid_invite(self, api_client):
        response = api_client.post(
            reverse("v1:accounts:register"), register_payload("not-a-real-token"), format="json"
        )
        assert response.status_code == 400
        assert "invite_token" in response.data

    def test_register_requires_age_and_tos_confirmation(self, api_client, invite_link):
        response = api_client.post(
            reverse("v1:accounts:register"),
            register_payload(invite_link.hash_token, is_18_confirmed=False),
            format="json",
        )
        assert response.status_code == 400

    def test_register_creates_totp_device_without_email_code(self, api_client, invite_link):
        api_client.post(
            reverse("v1:accounts:register"), register_payload(invite_link.hash_token), format="json"
        )
        from django.contrib.auth import get_user_model

        user = get_user_model().objects.get(username="new_member")
        assert TOTPDevice.objects.filter(user=user, confirmed=False).exists()
        assert not EmailConfirmation.objects.filter(user=user, is_used=False).exists()
        assert user.totp_secret
        assert user.totp_enabled is True


class TestInviteSystem:
    def test_new_user_gets_invite_link_with_five_uses(self, user):
        link = InviteLink.objects.get(creator=user)
        assert link.max_uses == 5
        assert link.uses_left == 5

    def test_invite_consumption_and_exhaustion(self, api_client, invite_link):
        for index in range(5):
            response = api_client.post(
                reverse("v1:accounts:register"),
                register_payload(
                    invite_link.hash_token,
                    username=f"member{index}",
                ),
                format="json",
            )
            assert response.status_code == 201, response.data

        invite_link.refresh_from_db()
        assert invite_link.use_count == 5
        assert invite_link.is_active is False

        response = api_client.post(
            reverse("v1:accounts:register"),
            register_payload(invite_link.hash_token, username="late_one"),
            format="json",
        )
        assert response.status_code == 400

    def test_inviter_receives_green_handshakes(self, api_client, user, invite_link):
        before = HandshakeCoin.objects.get(user=user, rarity=RARITY_GREEN).amount
        api_client.post(
            reverse("v1:accounts:register"), register_payload(invite_link.hash_token), format="json"
        )
        after = HandshakeCoin.objects.get(user=user, rarity=RARITY_GREEN).amount
        assert after == before + 10
        assert UserInvite.objects.filter(inviter=user, rewarded=True).exists()

    def test_invite_check_endpoint(self, api_client, invite_link):
        url = reverse("v1:accounts:invite-check", kwargs={"token": invite_link.hash_token})
        response = api_client.get(url)
        assert response.status_code == 200
        assert response.data["valid"] is True
        assert response.data["uses_left"] == 5


class TestLoginFlow:
    def test_login_after_registration_requires_valid_totp_code(self, api_client, invite_link):
        import pyotp
        from django.contrib.auth import get_user_model

        response = api_client.post(
            reverse("v1:accounts:register"), register_payload(invite_link.hash_token), format="json"
        )
        assert response.status_code == 201, response.data
        user = get_user_model().objects.get(username="new_member")

        missing = api_client.post(
            reverse("v1:accounts:login"),
            {"username": user.username, "password": VALID_PASSWORD},
            format="json",
        )
        assert missing.status_code == 400
        assert "totp_code" in missing.data

        wrong = api_client.post(
            reverse("v1:accounts:login"),
            {"username": user.username, "password": VALID_PASSWORD, "totp_code": "123456"},
            format="json",
        )
        assert wrong.status_code == 400
        assert "totp_code" in wrong.data

        good = api_client.post(
            reverse("v1:accounts:login"),
            {
                "username": user.username,
                "password": VALID_PASSWORD,
                "totp_code": pyotp.TOTP(user.totp_secret).now(),
            },
            format="json",
        )
        assert good.status_code == 200, good.data

    def test_login_returns_jwt_with_username_password(self, api_client, user):
        response = api_client.post(
            reverse("v1:accounts:login"),
            {"username": user.username, "password": VALID_PASSWORD},
            format="json",
        )
        assert response.status_code == 200, response.data
        assert "access" in response.data and "refresh" in response.data

    def test_login_with_totp_enabled_requires_totp_code(self, api_client, user):
        import pyotp

        secret = generate_totp_secret()
        user.totp_secret = secret
        user.totp_enabled = True
        user.save(update_fields=["totp_secret", "totp_enabled"])

        bad = api_client.post(
            reverse("v1:accounts:login"),
            {
                "username": user.username,
                "password": VALID_PASSWORD,
                "totp_code": "123456",
            },
            format="json",
        )
        assert bad.status_code == 400

        good = api_client.post(
            reverse("v1:accounts:login"),
            {
                "username": user.username,
                "password": VALID_PASSWORD,
                "totp_code": pyotp.TOTP(secret).now(),
            },
            format="json",
        )
        assert good.status_code == 200, good.data

    def test_wrong_password_rejected(self, api_client, user):
        response = api_client.post(
            reverse("v1:accounts:login"),
            {"username": user.username, "password": "wrong-password"},
            format="json",
        )
        assert response.status_code == 400


class TestProfile:
    def test_me_endpoint(self, auth_client):
        response = auth_client.get(reverse("v1:accounts:profile-me"))
        assert response.status_code == 200
        assert response.data["username"] == auth_client.user.username

    def test_profile_update(self, auth_client):
        response = auth_client.patch(
            reverse("v1:accounts:profile-update-me"),
            {"bio": "Premium member", "theme_color": "gold"},
            format="json",
        )
        assert response.status_code == 200
        assert response.data["bio"] == "Premium member"

    def test_totp_setup_returns_qr(self, auth_client):
        response = auth_client.get(reverse("v1:accounts:totp-setup"))
        assert response.status_code == 200
        assert response.data["qr_code"].startswith("data:image/png;base64,")

    def test_totp_activation(self, auth_client):
        import pyotp

        setup = auth_client.get(reverse("v1:accounts:totp-setup")).data
        response = auth_client.post(
            reverse("v1:accounts:totp-setup"),
            {"code": pyotp.TOTP(setup["secret"]).now()},
            format="json",
        )
        assert response.status_code == 200
        assert response.data["totp_enabled"] is True

    def test_anonymous_access_denied(self, api_client):
        assert api_client.get(reverse("v1:accounts:profile-me")).status_code == 401
