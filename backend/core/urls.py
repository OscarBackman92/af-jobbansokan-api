from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    JobApplicationViewSet,
    ProfileView,
    ResumeParseView,
    ResumeSuggestSkillsView,
    ResumeView,
    SavedJobSearchDetailView,
    SavedJobSearchListCreateView,
    job_filters,
    job_groups,
    job_municipalities,
    job_search,
)

router = DefaultRouter()
router.register(r"applications", JobApplicationViewSet, basename="applications")

urlpatterns = [
    path("me/", ProfileView.as_view(), name="me"),
    path("me/resume/", ResumeView.as_view(), name="my-resume"),
    path("me/resume/parse/", ResumeParseView.as_view(), name="my-resume-parse"),
    path(
        "me/resume/suggest-skills/",
        ResumeSuggestSkillsView.as_view(),
        name="my-resume-suggest-skills",
    ),
    path(
        "me/saved-searches/",
        SavedJobSearchListCreateView.as_view(),
        name="saved-searches",
    ),
    path(
        "me/saved-searches/<int:pk>/",
        SavedJobSearchDetailView.as_view(),
        name="saved-search-detail",
    ),
    path("jobs/", job_search, name="job-search"),
    path("jobs/filters/", job_filters, name="job-filters"),
    path("jobs/groups/", job_groups, name="job-groups"),
    path("jobs/municipalities/", job_municipalities, name="job-municipalities"),
    path("", include(router.urls)),
]
