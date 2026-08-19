from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Post

User = get_user_model()

class PostAuthorSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'avatar', 'handshake_level']
        read_only_fields = fields

class PostSerializer(serializers.ModelSerializer):
    author = PostAuthorSerializer(read_only=True)
    likes_count = serializers.IntegerField(source='likes.count', read_only=True)
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = ['id', 'author', 'content', 'media', 'media_type', 'likes_count', 'is_liked', 'created_at']
        read_only_fields = ['id', 'author', 'likes_count', 'is_liked', 'created_at']

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(id=request.user.id).exists()
        return False
