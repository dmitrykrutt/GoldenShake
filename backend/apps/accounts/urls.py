"""URL routes for the accounts app."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.accounts import views

router = DefaultRouter()
router.register("invites", views.InviteLinkViewSet, basename="invite")
router.register(
    "verification-requests",
    views.VerificationRequestViewSet,
    basename="verification-request",
)
router.register("profiles", views.ProfileViewSet, basename="profile")

app_name = "accounts"

urlpatterns = [
    path("register/", views.RegisterView.as_view(), name="register"),
    path("register/allowed-domains/", views.AllowedEmailDomainsView.as_view(), name="allowed-domains"),
    path("email/confirm/", views.EmailConfirmView.as_view(), name="email-confirm"),
    path("login/request-code/", views.LoginRequestCodeView.as_view(), name="login-request-code"),
    path("login/", views.LoginView.as_view(), name="login"),
    path("logout/", views.LogoutView.as_view(), name="logout"),
    path("token/refresh/", views.TokenRefreshDocView.as_view(), name="token-refresh"),
    path("totp/", views.TOTPSetupView.as_view(), name="totp-setup"),
    path("", include(router.urls)),
]
