"""REST endpoints for the profile post feed."""
from django.db.models import Q
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.posts.models import Comment, Like, Post, Share
from apps.posts.serializers import CommentSerializer, PostSerializer, ShareSerializer


@extend_schema(tags=["posts"])
class PostViewSet(viewsets.ModelViewSet):
    """Create and browse posts. Private profiles are only visible to their owner."""

    permission_classes = [IsAuthenticated]
    serializer_class = PostSerializer
    queryset = Post.objects.none()

    def get_queryset(self):
        user = self.request.user
        queryset = Post.objects.select_related("author").prefetch_related("likes", "comments", "shares")
        author = self.request.query_params.get("author")
        if author:
            queryset = queryset.filter(author__username__iexact=author)
        return queryset.filter(
            Q(author=user)
            | Q(visibility=Post.Visibility.PUBLIC, author__private_profile=False)
            | Q(visibility=Post.Visibility.FOLLOWERS, author__chat_rooms__participants=user)
        ).distinct()

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def perform_update(self, serializer):
        if serializer.instance.author_id != self.request.user.id:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("You can only edit your own posts.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.author_id != self.request.user.id:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("You can only delete your own posts.")
        instance.delete()

    @extend_schema(request=None, responses={200: dict})
    @action(detail=True, methods=["post"], url_path="like")
    def like(self, request, pk=None):
        post = self.get_object()
        like, created = Like.objects.get_or_create(post=post, user=request.user)
        if not created:
            like.delete()
        elif post.author_id != request.user.id:
            from apps.notifications.services import notify

            notify(
                post.author,
                "post_like",
                title="New like",
                body=f"@{request.user.username} liked your post.",
                data={"post_id": str(post.id)},
            )
        return Response({"post_id": str(post.id), "liked": created, "like_count": post.like_count})

    @extend_schema(
        parameters=[OpenApiParameter("post", str)],
        responses={200: CommentSerializer(many=True)},
    )
    @action(detail=True, methods=["get", "post"], url_path="comments")
    def comments(self, request, pk=None):
        post = self.get_object()
        if request.method == "GET":
            queryset = post.comments.filter(parent__isnull=True).select_related("author")
            return Response(CommentSerializer(queryset, many=True, context={"request": request}).data)

        serializer = CommentSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        comment = serializer.save(author=request.user, post=post)
        if post.author_id != request.user.id:
            from apps.notifications.services import notify

            notify(
                post.author,
                "post_comment",
                title="New comment",
                body=f"@{request.user.username} commented on your post.",
                data={"post_id": str(post.id), "comment_id": str(comment.id)},
            )
        return Response(
            CommentSerializer(comment, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(request=ShareSerializer, responses={201: ShareSerializer})
    @action(detail=True, methods=["post"], url_path="share")
    def share(self, request, pk=None):
        post = self.get_object()
        share = Share.objects.create(
            post=post, user=request.user, shared_to_room_id=request.data.get("shared_to_room")
        )
        return Response(
            ShareSerializer(share, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


@extend_schema(tags=["posts"])
class CommentViewSet(viewsets.ModelViewSet):
    """Comment management (authors may delete their own comments)."""

    permission_classes = [IsAuthenticated]
    serializer_class = CommentSerializer
    queryset = Comment.objects.none()

    def get_queryset(self):
        return Comment.objects.select_related("author", "post")

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def perform_destroy(self, instance):
        if instance.author_id != self.request.user.id and instance.post.author_id != self.request.user.id:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("You cannot delete this comment.")
        instance.delete()
