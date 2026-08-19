import uuid
from django.db import models
from django.conf import settings

class Post(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='social_posts')
    content = models.TextField(blank=True, default='')
    media = models.FileField(upload_to='social_media/%Y/%m/', null=True, blank=True)
    media_type = models.CharField(max_length=20, default='text')
    likes = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='social_liked_posts', blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'social'
        ordering = ['-created_at']

    def __str__(self):
        return f"Post by {self.author.username} ({self.created_at.strftime('%Y-%m-%d %H:%M')})"
