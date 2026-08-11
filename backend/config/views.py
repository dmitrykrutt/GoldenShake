"""Infrastructure-level views (health probes)."""
from django.db import connection
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@extend_schema(tags=["system"], responses={200: dict})
@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    """Liveness/readiness probe used by Docker and the load balancer."""
    database_ok = True
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:  # pragma: no cover - only on outage
        database_ok = False
    return Response({"status": "ok" if database_ok else "degraded", "database": database_ok})
