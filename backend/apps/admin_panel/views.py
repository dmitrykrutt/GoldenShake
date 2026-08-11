"""Staff-only moderation endpoints: queues, reviews, bans and stats."""
from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import VerificationRequest
from apps.accounts.serializers import VerificationRequestSerializer
from apps.admin_panel.models import AdminAction, BannedUser
from apps.admin_panel.permissions import IsStaffUser
from apps.admin_panel.serializers import (
    AdminActionSerializer,
    BannedUserSerializer,
    BanSerializer,
    DisputeResolveSerializer,
    GrantCoinsSerializer,
    ReviewSerializer,
)
from apps.chat.models import SupportTicket
from apps.chat.serializers import SupportTicketSerializer
from apps.garant.models import GarantDeal, GarantDispute
from apps.garant.serializers import GarantDisputeSerializer

User = get_user_model()


def log_action(actor, action_name, target_type="", target_id="", note="", metadata=None):
    return AdminAction.objects.create(
        actor=actor,
        action=action_name,
        target_type=target_type,
        target_id=str(target_id),
        note=note,
        metadata=metadata or {},
    )


@extend_schema(tags=["admin"])
class SupportQueueViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """Queue of support tickets awaiting an agent."""

    permission_classes = [IsStaffUser]
    serializer_class = SupportTicketSerializer

    def get_queryset(self):
        queryset = SupportTicket.objects.select_related("room", "opened_by", "assigned_to")
        ticket_status = self.request.query_params.get("status")
        if ticket_status:
            return queryset.filter(status=ticket_status)
        return queryset.exclude(status=SupportTicket.Status.CLOSED)

    @extend_schema(request=None, responses={200: SupportTicketSerializer})
    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, pk=None):
        ticket = self.get_object()
        ticket.assigned_to = request.user
        ticket.status = SupportTicket.Status.IN_PROGRESS
        ticket.save(update_fields=["assigned_to", "status"])
        from apps.chat.models import RoomMembership

        RoomMembership.objects.get_or_create(
            room=ticket.room, user=request.user, defaults={"role": RoomMembership.Role.SUPPORT}
        )
        log_action(request.user, AdminAction.Action.CLOSE_TICKET, "support_ticket", ticket.id, "assigned")
        return Response(SupportTicketSerializer(ticket, context={"request": request}).data)

    @extend_schema(request=None, responses={200: SupportTicketSerializer})
    @action(detail=True, methods=["post"], url_path="close")
    def close(self, request, pk=None):
        ticket = self.get_object()
        ticket.close()
        log_action(request.user, AdminAction.Action.CLOSE_TICKET, "support_ticket", ticket.id)
        return Response(SupportTicketSerializer(ticket, context={"request": request}).data)


@extend_schema(tags=["admin"])
class VerificationQueueViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """Pending verification (golden badge) requests."""

    permission_classes = [IsStaffUser]
    serializer_class = VerificationRequestSerializer

    def get_queryset(self):
        queryset = VerificationRequest.objects.select_related("user")
        request_status = self.request.query_params.get("status", VerificationRequest.Status.PENDING)
        return queryset.filter(status=request_status)

    @extend_schema(request=ReviewSerializer, responses={200: VerificationRequestSerializer})
    @action(detail=True, methods=["post"], url_path="review")
    def review(self, request, pk=None):
        verification = self.get_object()
        serializer = ReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        approved = serializer.validated_data["decision"] == "approve"

        verification.status = (
            VerificationRequest.Status.APPROVED if approved else VerificationRequest.Status.REJECTED
        )
        verification.reviewer_note = serializer.validated_data.get("note", "")
        verification.save(update_fields=["status", "reviewer_note", "updated_at"])

        if approved:
            verification.user.is_verified = True
            verification.user.save(update_fields=["is_verified"])

        log_action(
            request.user,
            AdminAction.Action.VERIFY_USER if approved else AdminAction.Action.REJECT_VERIFICATION,
            "verification_request",
            verification.id,
            verification.reviewer_note,
        )

        from apps.notifications.services import notify

        notify(
            verification.user,
            "verification",
            title="Verification reviewed",
            body="Your account is now verified." if approved else "Your verification request was rejected.",
            data={"approved": approved, "note": verification.reviewer_note},
        )
        return Response(VerificationRequestSerializer(verification, context={"request": request}).data)


@extend_schema(tags=["admin"])
class GarantComplaintViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """Garant disputes awaiting arbitration."""

    permission_classes = [IsStaffUser]
    serializer_class = GarantDisputeSerializer

    def get_queryset(self):
        queryset = GarantDispute.objects.select_related("deal", "complainant")
        dispute_status = self.request.query_params.get("status")
        if dispute_status:
            return queryset.filter(status=dispute_status)
        return queryset.filter(status__in=[GarantDispute.Status.OPEN, GarantDispute.Status.REVIEWING])

    @extend_schema(request=DisputeResolveSerializer, responses={200: GarantDisputeSerializer})
    @action(detail=True, methods=["post"], url_path="resolve")
    def resolve(self, request, pk=None):
        dispute = self.get_object()
        serializer = DisputeResolveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        decision = serializer.validated_data["decision"]

        deal = dispute.deal
        if decision == "buyer":
            dispute.status = GarantDispute.Status.RESOLVED_BUYER
            deal.status = GarantDeal.Status.REFUNDED
        elif decision == "seller":
            dispute.status = GarantDispute.Status.RESOLVED_SELLER
            deal.status = GarantDeal.Status.CONFIRMED
        else:
            dispute.status = GarantDispute.Status.REJECTED

        dispute.resolution_note = serializer.validated_data.get("note", "")
        dispute.resolved_by = request.user
        dispute.save(update_fields=["status", "resolution_note", "resolved_by", "updated_at"])
        deal.save(update_fields=["status", "updated_at"])

        if decision == "seller":
            from apps.garant.tasks import release_funds_task

            release_funds_task.delay(str(deal.id))

        log_action(
            request.user,
            AdminAction.Action.RESOLVE_DISPUTE,
            "garant_dispute",
            dispute.id,
            dispute.resolution_note,
            {"decision": decision},
        )
        return Response(GarantDisputeSerializer(dispute, context={"request": request}).data)


@extend_schema(tags=["admin"])
class ModerationView(APIView):
    """Ban/unban users and grant coins."""

    permission_classes = [IsStaffUser]

    @extend_schema(request=BanSerializer, responses={201: BannedUserSerializer})
    def post(self, request):
        serializer = BanSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(username__iexact=serializer.validated_data["username"]).first()
        if user is None:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        ban, _ = BannedUser.objects.update_or_create(
            user=user,
            defaults={
                "reason": serializer.validated_data["reason"],
                "banned_by": request.user,
                "expires_at": serializer.validated_data.get("expires_at"),
            },
        )
        user.is_active = False
        user.save(update_fields=["is_active"])
        log_action(request.user, AdminAction.Action.BAN_USER, "user", user.id, ban.reason)
        return Response(BannedUserSerializer(ban).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=dict, responses={200: dict})
    def delete(self, request):
        username = request.data.get("username") or request.query_params.get("username")
        user = User.objects.filter(username__iexact=username or "").first()
        if user is None:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        BannedUser.objects.filter(user=user).delete()
        user.is_active = True
        user.save(update_fields=["is_active"])
        log_action(request.user, AdminAction.Action.UNBAN_USER, "user", user.id)
        return Response({"detail": f"@{user.username} unbanned."})


@extend_schema(tags=["admin"])
class GrantCoinsView(APIView):
    """Manually credit handshake coins (compensation, campaigns)."""

    permission_classes = [IsStaffUser]

    @extend_schema(request=GrantCoinsSerializer, responses={201: dict})
    def post(self, request):
        from apps.coins.models import CoinTransaction
        from apps.coins.services import credit

        serializer = GrantCoinsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(username__iexact=serializer.validated_data["username"]).first()
        if user is None:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        transaction = credit(
            user,
            serializer.validated_data["rarity"],
            serializer.validated_data["amount"],
            CoinTransaction.Type.ADMIN_GRANT,
            from_user=request.user,
            memo=serializer.validated_data.get("note", "Admin grant"),
        )
        log_action(
            request.user,
            AdminAction.Action.GRANT_COINS,
            "user",
            user.id,
            metadata={"amount": serializer.validated_data["amount"], "rarity": serializer.validated_data["rarity"]},
        )
        return Response(
            {"detail": "Coins granted.", "transaction_id": str(transaction.id)},
            status=status.HTTP_201_CREATED,
        )


@extend_schema(tags=["admin"])
class DashboardStatsView(APIView):
    """High-level platform statistics for the admin dashboard."""

    permission_classes = [IsStaffUser]

    @extend_schema(responses={200: dict})
    def get(self, request):
        from datetime import timedelta

        from apps.chat.models import Message
        from apps.coins.models import CoinTransaction

        day_ago = timezone.now() - timedelta(days=1)
        return Response(
            {
                "users": {
                    "total": User.objects.count(),
                    "verified": User.objects.filter(is_verified=True).count(),
                    "online": User.objects.filter(is_online=True).count(),
                    "new_24h": User.objects.filter(date_joined__gte=day_ago).count(),
                },
                "messages_24h": Message.objects.filter(created_at__gte=day_ago).count(),
                "coin_transactions_24h": CoinTransaction.objects.filter(created_at__gte=day_ago).count(),
                "queues": {
                    "support_open": SupportTicket.objects.exclude(
                        status=SupportTicket.Status.CLOSED
                    ).count(),
                    "verifications_pending": VerificationRequest.objects.filter(
                        status=VerificationRequest.Status.PENDING
                    ).count(),
                    "disputes_open": GarantDispute.objects.filter(
                        status__in=[GarantDispute.Status.OPEN, GarantDispute.Status.REVIEWING]
                    ).count(),
                },
                "garant": GarantDeal.objects.aggregate(
                    total=Count("id"),
                    active=Count("id", filter=Q(status__in=[
                        GarantDeal.Status.PAID,
                        GarantDeal.Status.AWAITING_PAYMENT,
                        GarantDeal.Status.COMPLETED_BY_SELLER,
                    ])),
                    disputed=Count("id", filter=Q(status=GarantDeal.Status.DISPUTED)),
                ),
            }
        )


@extend_schema(tags=["admin"])
class AdminActionViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Audit log of moderation actions."""

    permission_classes = [IsStaffUser]
    serializer_class = AdminActionSerializer
    queryset = AdminAction.objects.select_related("actor")
