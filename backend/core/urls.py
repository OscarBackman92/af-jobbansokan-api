from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import JobApplicationViewSet, JobPostingViewSet, me, employer_applications

router = DefaultRouter()
router.register(r"applications", JobApplicationViewSet, basename="applications")
router.register(r"postings", JobPostingViewSet, basename="postings")

urlpatterns = [
    path("me/", me, name="me"),
    path("", include(router.urls)),
    path("employer/applications/", employer_applications, name="employer-applications"),

]
