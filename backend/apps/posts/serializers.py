"""Serializers for posts, likes, comments and shares."""
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.accounts.serializers import PublicUserSerializer
from apps.posts.models import Comment, Like, Post, Share


class CommentSerializer(serializers.ModelSerializer):
    author = PublicUserSerializer(read_only=True)
    replies = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ("id", "post", "author", "content", "parent", "replies", "created_at")
        read_only_fields = ("id", "author", "replies", "created_at")

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_replies(self, obj):
        if obj.parent_id is not None:
            return []
        return CommentSerializer(obj.replies.all(), many=True, context=self.context).data


class PostSerializer(serializers.ModelSerializer):
    author = PublicUserSerializer(read_only=True)
    like_count = serializers.IntegerField(read_only=True)
    comment_count = serializers.IntegerField(read_only=True)
    share_count = serializers.IntegerField(read_only=True)
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = (
            "id",
            "author",
            "content",
            "media",
            "media_type",
            "visibility",
            "is_pinned",
            "like_count",
            "comment_count",
            "share_count",
            "is_liked",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "author", "created_at", "updated_at")

    def get_is_liked(self, obj) -> bool:
        request = self.context.get("request")
        return bool(request) and obj.likes.filter(user=request.user).exists()

    def validate(self, attrs):
        if not attrs.get("content") and not attrs.get("media") and not self.instance:
            raise serializers.ValidationError("A post needs text or media.")
        return attrs


class LikeSerializer(serializers.ModelSerializer):
    user = PublicUserSerializer(read_only=True)

    class Meta:
        model = Like
        fields = ("id", "post", "user", "created_at")
        read_only_fields = fields


class ShareSerializer(serializers.ModelSerializer):
    user = PublicUserSerializer(read_only=True)

    class Meta:
        model = Share
        fields = ("id", "post", "user", "shared_to_room", "created_at")
        read_only_fields = ("id", "user", "created_at")
