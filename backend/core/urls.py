from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    EmployerApplicationsView,
    JobApplicationViewSet,
    JobPostingViewSet,
    me,
    partner_application_events,
)

router = DefaultRouter()
router.register(r"applications", JobApplicationViewSet, basename="applications")
router.register(r"postings", JobPostingViewSet, basename="postings")

urlpatterns = [
    path("me/", me, name="me"),
    path("", include(router.urls)),
    path(
        "employer/applications/",
        EmployerApplicationsView.as_view(),
        name="employer-applications",
    ),
    path(
        "partner/application-events/",
        partner_application_events,
        name="partner-application-events",
    ),
]
