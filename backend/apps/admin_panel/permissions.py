"""Permissions restricting the admin panel to staff members."""
from rest_framework.permissions import BasePermission


class IsStaffUser(BasePermission):
    """Allow access only to active staff accounts."""

    message = "Staff access is required."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_staff and user.is_active)
