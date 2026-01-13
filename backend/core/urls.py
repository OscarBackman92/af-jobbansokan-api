from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import JobApplicationViewSet, JobPostingViewSet, me

router = DefaultRouter()
router.register(r"applications", JobApplicationViewSet, basename="applications")
router.register(r"postings", JobPostingViewSet, basename="postings")

urlpatterns = [
    path("me/", me, name="me"),
    path("", include(router.urls)),
]