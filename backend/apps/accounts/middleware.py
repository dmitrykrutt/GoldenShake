"""JWT authentication middleware for Django Channels WebSocket connections."""
from urllib.parse import parse_qs

from channels.auth import AuthMiddlewareStack
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken


@database_sync_to_async
def get_user_from_token(raw_token: str):
    User = get_user_model()
    try:
        token = AccessToken(raw_token)
        user = User.objects.get(id=token["user_id"])
    except (TokenError, KeyError, User.DoesNotExist, ValueError):
        return AnonymousUser()
    return user if user.is_active else AnonymousUser()


def _extract_token(scope) -> str:
    """Look for the JWT in the query string, the Authorization or subprotocol header."""
    query_string = scope.get("query_string", b"").decode()
    params = parse_qs(query_string)
    if params.get("token"):
        return params["token"][0]

    headers = {k.decode().lower(): v.decode() for k, v in scope.get("headers", [])}
    authorization = headers.get("authorization", "")
    if authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()

    protocol = headers.get("sec-websocket-protocol", "")
    parts = [p.strip() for p in protocol.split(",") if p.strip()]
    if len(parts) == 2 and parts[0] in {"bearer", "jwt", "access_token"}:
        return parts[1]
    return ""


class JWTAuthMiddleware:
    """Populate ``scope['user']`` from a SimpleJWT access token."""

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        scope = dict(scope)
        token = _extract_token(scope)
        scope["user"] = await get_user_from_token(token) if token else AnonymousUser()
        return await self.inner(scope, receive, send)


def JWTAuthMiddlewareStack(inner):
    """Session auth first (browser admin tooling), then JWT for API clients."""
    return JWTAuthMiddleware(AuthMiddlewareStack(inner))
