from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    FavoriteViewSet,
    JobApplicationViewSet,
    JobPostingViewSet,
    ProfileView,
    ResumeParseView,
    ResumeView,
)

router = DefaultRouter()
router.register(r"applications", JobApplicationViewSet, basename="applications")
router.register(r"postings", JobPostingViewSet, basename="postings")
router.register(r"favorites", FavoriteViewSet, basename="favorites")

urlpatterns = [
    path("me/", ProfileView.as_view(), name="me"),
    path("me/resume/", ResumeView.as_view(), name="my-resume"),
    path("me/resume/parse/", ResumeParseView.as_view(), name="my-resume-parse"),
    path("", include(router.urls)),
]
