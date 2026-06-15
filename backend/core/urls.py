from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    JobApplicationViewSet,
    JobPostingViewSet,
    ProfileView,
    ResumeParseView,
    ResumeView,
    job_filters,
    job_search,
)

router = DefaultRouter()
router.register(r"applications", JobApplicationViewSet, basename="applications")
router.register(r"postings", JobPostingViewSet, basename="postings")

urlpatterns = [
    path("me/", ProfileView.as_view(), name="me"),
    path("me/resume/", ResumeView.as_view(), name="my-resume"),
    path("me/resume/parse/", ResumeParseView.as_view(), name="my-resume-parse"),
    path("jobs/", job_search, name="job-search"),
    path("jobs/filters/", job_filters, name="job-filters"),
    path("", include(router.urls)),
]
