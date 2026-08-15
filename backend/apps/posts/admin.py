from django.contrib import admin

from apps.posts.models import Comment, Like, Post, PostAttachment, Share


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("id", "author", "visibility", "is_pinned", "created_at")
    list_filter = ("visibility", "is_pinned")
    search_fields = ("author__username", "content")


@admin.register(PostAttachment)
class PostAttachmentAdmin(admin.ModelAdmin):
    list_display = ("id", "post", "file_type", "created_at")
    list_filter = ("file_type",)


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("id", "post", "author", "created_at")
    search_fields = ("author__username", "content")


@admin.register(Like)
class LikeAdmin(admin.ModelAdmin):
    list_display = ("post", "user", "created_at")


@admin.register(Share)
class ShareAdmin(admin.ModelAdmin):
    list_display = ("post", "user", "shared_to_room", "created_at")
