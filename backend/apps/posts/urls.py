"""URL routes for the posts app."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.posts import views

router = DefaultRouter()
router.register("posts", views.PostViewSet, basename="post")
router.register("comments", views.CommentViewSet, basename="comment")

app_name = "posts"

urlpatterns = [path("", include(router.urls))]
