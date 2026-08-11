"""Profile posts with likes, comments and shares."""
import uuid

from django.conf import settings
from django.db import models


class Post(models.Model):
    """A post published on a user's profile."""

    class Visibility(models.TextChoices):
        PUBLIC = "public", "Public"
        FOLLOWERS = "followers", "Contacts only"
        PRIVATE = "private", "Private"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="posts"
    )
    content = models.TextField(max_length=5000, blank=True, default="")
    media = models.FileField(upload_to="posts/", blank=True, null=True)
    media_type = models.CharField(max_length=20, blank=True, default="")
    visibility = models.CharField(
        max_length=16, choices=Visibility.choices, default=Visibility.PUBLIC
    )
    is_pinned = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "posts_post"
        ordering = ("-is_pinned", "-created_at")
        indexes = [models.Index(fields=["author", "-created_at"])]

    def __str__(self) -> str:
        return f"post {self.id} by {self.author_id}"

    @property
    def like_count(self) -> int:
        return self.likes.count()

    @property
    def comment_count(self) -> int:
        return self.comments.count()

    @property
    def share_count(self) -> int:
        return self.shares.count()


class Like(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="likes")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="likes"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "posts_like"
        unique_together = ("post", "user")

    def __str__(self) -> str:
        return f"{self.user_id} likes {self.post_id}"


class Comment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="comments"
    )
    content = models.TextField(max_length=2000)
    parent = models.ForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True, related_name="replies"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "posts_comment"
        ordering = ("created_at",)

    def __str__(self) -> str:
        return f"comment {self.id} on {self.post_id}"


class Share(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="shares")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="shares"
    )
    shared_to_room = models.ForeignKey(
        "chat.ChatRoom", on_delete=models.SET_NULL, null=True, blank=True, related_name="shared_posts"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "posts_share"

    def __str__(self) -> str:
        return f"{self.user_id} shared {self.post_id}"
